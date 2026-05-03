BEGIN;

CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  plan VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO restaurants (id, name, slug, status, plan)
VALUES (1, 'Default Restaurant', 'default', 'active', 'free')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('restaurants', 'id'),
  GREATEST((SELECT MAX(id) FROM restaurants), 1)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id);
ALTER TABLE menu_new ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'order_items'
      AND column_name = 'order_id'
      AND data_type <> 'character varying'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'order_items_order_id_fkey'
    ) THEN
      ALTER TABLE order_items DROP CONSTRAINT order_items_order_id_fkey;
    END IF;

    ALTER TABLE order_items
      ALTER COLUMN order_id TYPE VARCHAR(255)
      USING order_id::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
      AND column_name = 'id'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE orders
      ALTER COLUMN id TYPE VARCHAR(255)
      USING id::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_order_id_fkey'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE users SET restaurant_id = 1 WHERE restaurant_id IS NULL AND role <> 'superadmin';
UPDATE menu_new SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE tables SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE sessions SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE orders SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE order_items SET restaurant_id = 1 WHERE restaurant_id IS NULL;

ALTER TABLE users ALTER COLUMN restaurant_id DROP NOT NULL;
ALTER TABLE menu_new ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE tables ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN restaurant_id SET NOT NULL;

DO $$
BEGIN
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
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurants_owner_id_fkey'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES users(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
DROP INDEX IF EXISTS users_username_key;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_username_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_restaurant_username_key
  ON users(restaurant_id, username)
  WHERE restaurant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_global_superadmin_username_key
  ON users(username)
  WHERE role = 'superadmin';
CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_new(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status ON tables(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_restaurant ON sessions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_time ON orders(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_sales_paid ON orders(restaurant_id, payment_status, paid_at);
CREATE INDEX IF NOT EXISTS idx_orders_sales_status_created ON orders(restaurant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_restaurant ON order_items(order_id, restaurant_id);

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
   AND o.restaurant_id = totals.restaurant_id;

COMMIT;
