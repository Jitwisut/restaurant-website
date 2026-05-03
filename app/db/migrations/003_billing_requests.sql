BEGIN;

CREATE TABLE IF NOT EXISTS billing_requests (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  requested_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  plan_code VARCHAR(50) NOT NULL DEFAULT 'starter',
  months INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC(12, 2) NULL,
  note TEXT NULL,
  proof_blob BYTEA NULL,
  proof_mime VARCHAR(100) NULL,
  proof_filename VARCHAR(255) NULL,
  reviewed_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT billing_requests_status_check CHECK (
    status IN ('pending_review', 'approved', 'rejected')
  ),
  CONSTRAINT billing_requests_months_check CHECK (months BETWEEN 1 AND 24)
);

CREATE INDEX IF NOT EXISTS idx_billing_requests_restaurant
  ON billing_requests(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_requests_status
  ON billing_requests(status, created_at DESC);

COMMIT;
