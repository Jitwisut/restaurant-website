import pkg from "pg";
const { Pool } = pkg;
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:0805555za@localhost:5432/restaurant_test";

// ประกาศ pool ตัวเดียว (global)
let pool: any = null;
let tablesTenantSchemaPromise: Promise<void> | null = null;

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

//export const db = getDB();
