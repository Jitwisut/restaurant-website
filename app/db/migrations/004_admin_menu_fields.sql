BEGIN;

ALTER TABLE menu_new
  ADD COLUMN IF NOT EXISTS ingredients TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_menu_restaurant_category_available
  ON menu_new(restaurant_id, category, is_available);

COMMIT;
