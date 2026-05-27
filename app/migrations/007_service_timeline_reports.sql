BEGIN;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE orders
   SET status = 'ready'
 WHERE status = 'done';

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
);

CREATE INDEX IF NOT EXISTS idx_order_events_session
  ON order_events(restaurant_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_order
  ON order_events(restaurant_id, order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_type_date
  ON order_events(restaurant_id, event_type, created_at DESC);

COMMIT;
