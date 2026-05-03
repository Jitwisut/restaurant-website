BEGIN;

CREATE TABLE IF NOT EXISTS superadmin_audit_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255) NULL,
  restaurant_id INTEGER NULL REFERENCES restaurants(id) ON DELETE SET NULL,
  target_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  reason TEXT NULL,
  old_value_json JSONB NULL,
  new_value_json JSONB NULL,
  ip_address VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_restaurant
  ON superadmin_audit_logs(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_actor
  ON superadmin_audit_logs(actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_action
  ON superadmin_audit_logs(action, created_at DESC);

COMMIT;
