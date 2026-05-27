import pkg from "pg";
const { Pool } = pkg;
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:0805555za@localhost:5432/restaurant_test";

// ประกาศ pool ตัวเดียว (global)
let pool: any = null;
let tablesTenantSchemaPromise: Promise<void> | null = null;
let salesSchemaPromise: Promise<void> | null = null;

// ฟังก์ชัน getDB
export function getDB() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    });
    console.log("✅ DB Connected");
  }
  return pool;
}

export async function ensureTablesTenantSchema() {
  if (!tablesTenantSchemaPromise) {
    tablesTenantSchemaPromise = (async () => {
      const db = getDB();
      await db.query(`
        ALTER TABLE tables
        ADD COLUMN IF NOT EXISTS id BIGSERIAL
      `);

      await db.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_table'
          ) THEN
            ALTER TABLE orders DROP CONSTRAINT fk_table;
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'tables'
              AND column_name = 'id'
          ) THEN
            EXECUTE 'UPDATE tables
                     SET id = nextval(pg_get_serial_sequence(''tables'', ''id''))
                     WHERE id IS NULL';

            EXECUTE 'SELECT setval(
              pg_get_serial_sequence(''tables'', ''id''),
              COALESCE((SELECT MAX(id) FROM tables), 0)
            )';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = 'tables'
              AND tc.constraint_type = 'PRIMARY KEY'
              AND kcu.column_name = 'table_number'
          ) THEN
            ALTER TABLE tables DROP CONSTRAINT tables_pkey;
          END IF;

          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = 'tables'
              AND tc.constraint_type = 'PRIMARY KEY'
              AND kcu.column_name = 'id'
          ) THEN
            ALTER TABLE tables ADD CONSTRAINT tables_pkey PRIMARY KEY (id);
          END IF;

          IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'tables_table_number_key'
          ) THEN
            ALTER TABLE tables DROP CONSTRAINT tables_table_number_key;
          END IF;

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'tables_restaurant_table_number_key'
          ) THEN
            ALTER TABLE tables
              ADD CONSTRAINT tables_restaurant_table_number_key
              UNIQUE (restaurant_id, table_number);
          END IF;

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'orders_restaurant_table_fkey'
          ) THEN
            ALTER TABLE orders
              ADD CONSTRAINT orders_restaurant_table_fkey
              FOREIGN KEY (restaurant_id, table_number)
              REFERENCES tables(restaurant_id, table_number);
          END IF;
        END $$;
      `);
    })().catch((error) => {
      tablesTenantSchemaPromise = null;
      throw error;
    });
  }

  await tablesTenantSchemaPromise;
}

export async function ensureSalesSchema() {
  if (!salesSchemaPromise) {
    salesSchemaPromise = (async () => {
      const db = getDB();

      await db.query(`
        ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
          ADD COLUMN IF NOT EXISTS payment_reference TEXT,
          ADD COLUMN IF NOT EXISTS payment_review_note TEXT,
          ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS payment_reviewed_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS payment_reviewed_by INTEGER,
          ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
      `);

      await db.query(`
        UPDATE orders
           SET status = 'ready'
         WHERE status = 'done'
      `);

      await db.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
              FROM pg_constraint
             WHERE conname = 'status_check'
               AND conrelid = 'orders'::regclass
          ) THEN
            ALTER TABLE orders DROP CONSTRAINT status_check;
          END IF;

          IF NOT EXISTS (
            SELECT 1
              FROM pg_constraint
             WHERE conname = 'orders_status_check'
               AND conrelid = 'orders'::regclass
          ) THEN
            ALTER TABLE orders
              ADD CONSTRAINT orders_status_check
              CHECK (
                status IN (
                  'pending',
                  'accepted',
                  'preparing',
                  'ready',
                  'served',
                  'completed',
                  'cancelled',
                  'rejected'
                )
              );
          END IF;
        END $$;
      `);

      await db.query(`
        ALTER TABLE order_items
          ADD COLUMN IF NOT EXISTS notes TEXT
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_sales_paid
          ON orders(restaurant_id, payment_status, paid_at)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_sales_status_created
          ON orders(restaurant_id, status, created_at)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_order_items_order_restaurant
          ON order_items(order_id, restaurant_id)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status
          ON tables(restaurant_id, status)
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS order_events (
          id BIGSERIAL PRIMARY KEY,
          restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          session_id TEXT,
          order_id TEXT,
          actor_role VARCHAR(50),
          actor_email VARCHAR(255),
          event_type VARCHAR(80) NOT NULL,
          metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_order_events_session
          ON order_events(restaurant_id, session_id, created_at DESC)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_order_events_order
          ON order_events(restaurant_id, order_id, created_at DESC)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_order_events_type_date
          ON order_events(restaurant_id, event_type, created_at DESC)
      `);

      await db.query(`
        WITH totals AS (
          SELECT
            o.id,
            o.restaurant_id,
            COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS subtotal
          FROM orders o
          LEFT JOIN order_items oi
            ON oi.order_id = o.id
           AND oi.restaurant_id = o.restaurant_id
          GROUP BY o.id, o.restaurant_id
        )
        UPDATE orders o
           SET subtotal = totals.subtotal,
               grand_total = totals.subtotal,
               payment_status = CASE
                 WHEN o.status = 'completed' AND o.payment_status = 'unpaid'
                   THEN 'paid'
                 ELSE o.payment_status
               END,
               paid_at = CASE
                 WHEN o.status = 'completed' AND o.paid_at IS NULL
                   THEN COALESCE(o.completed_at, o.created_at)
                 ELSE o.paid_at
               END,
               completed_at = CASE
                 WHEN o.status = 'completed' AND o.completed_at IS NULL
                   THEN COALESCE(o.paid_at, o.created_at)
                 ELSE o.completed_at
               END
          FROM totals
         WHERE o.id = totals.id
           AND o.restaurant_id = totals.restaurant_id
      `);
    })().catch((error) => {
      salesSchemaPromise = null;
      throw error;
    });
  }

  await salesSchemaPromise;
}

//export const db = getDB();
