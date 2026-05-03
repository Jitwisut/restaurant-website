BEGIN;

CREATE TABLE IF NOT EXISTS restaurant_settings (
  restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  account_security JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  table_qr_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  menu_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  danger_zone JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_settings_updated
  ON restaurant_settings(updated_at DESC);

COMMIT;
