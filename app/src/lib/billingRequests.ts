import { getDB } from "./connect";

const db = getDB();

export const BILLING_REQUEST_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
] as const;

export type BillingRequestStatus = (typeof BILLING_REQUEST_STATUSES)[number];

let billingSchemaPromise: Promise<void> | null = null;

export async function ensureBillingRequestsSchema() {
  if (!billingSchemaPromise) {
    billingSchemaPromise = db
      .query(`
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
      `)
      .then(() => undefined)
      .catch((error) => {
        billingSchemaPromise = null;
        throw error;
      });
  }

  await billingSchemaPromise;
}

function decodeProof(input?: string | null) {
  if (!input) return null;
  const cleaned = input.includes(",") ? input.split(",").pop() : input;
  return cleaned ? Buffer.from(cleaned, "base64") : null;
}

export async function createBillingRequest(input: {
  restaurantId: number;
  requestedByUserId?: number | null;
  planCode?: string | null;
  months?: number | null;
  amount?: number | string | null;
  note?: string | null;
  proofBase64?: string | null;
  proofMime?: string | null;
  proofFilename?: string | null;
}) {
  await ensureBillingRequestsSchema();

  const months = Math.min(24, Math.max(1, Math.floor(Number(input.months || 1))));
  const result = await db.query(
    `INSERT INTO billing_requests (
       restaurant_id,
       requested_by_user_id,
       status,
       plan_code,
       months,
       amount,
       note,
       proof_blob,
       proof_mime,
       proof_filename,
       updated_at
     )
     VALUES ($1, $2, 'pending_review', $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING id, restaurant_id, requested_by_user_id, status, plan_code, months,
               amount, note, proof_mime, proof_filename, reviewed_by_user_id,
               review_note, created_at, reviewed_at, updated_at,
               (proof_blob IS NOT NULL) AS has_proof`,
    [
      input.restaurantId,
      input.requestedByUserId || null,
      input.planCode || "starter",
      months,
      input.amount || null,
      input.note || null,
      decodeProof(input.proofBase64),
      input.proofMime || null,
      input.proofFilename || null,
    ],
  );

  return result.rows[0];
}

export async function listRestaurantBillingRequests(restaurantId: number) {
  await ensureBillingRequestsSchema();
  const result = await db.query(
    `SELECT id, restaurant_id, requested_by_user_id, status, plan_code, months,
            amount, note, proof_mime, proof_filename, reviewed_by_user_id,
            review_note, created_at, reviewed_at, updated_at,
            (proof_blob IS NOT NULL) AS has_proof
       FROM billing_requests
      WHERE restaurant_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [restaurantId],
  );

  return result.rows;
}

export async function listSuperadminBillingRequests(status?: string | null) {
  await ensureBillingRequestsSchema();
  const params: unknown[] = [];
  let where = "";
  if (status && status !== "all") {
    params.push(status);
    where = "WHERE br.status = $1";
  }

  const result = await db.query(
    `SELECT br.id, br.restaurant_id, br.requested_by_user_id, br.status,
            br.plan_code, br.months, br.amount, br.note, br.proof_mime,
            br.proof_filename, br.reviewed_by_user_id, br.review_note,
            br.created_at, br.reviewed_at, br.updated_at,
            (br.proof_blob IS NOT NULL) AS has_proof,
            r.name AS restaurant_name,
            r.slug AS restaurant_slug,
            u.username AS requested_by_username,
            u.email AS requested_by_email
       FROM billing_requests br
       JOIN restaurants r ON r.id = br.restaurant_id
       LEFT JOIN users u ON u.id = br.requested_by_user_id
       ${where}
      ORDER BY br.created_at DESC
      LIMIT 100`,
    params,
  );

  return result.rows;
}

export async function getBillingRequestProof(requestId: number) {
  await ensureBillingRequestsSchema();
  const result = await db.query(
    `SELECT proof_blob, proof_mime, proof_filename
       FROM billing_requests
      WHERE id = $1`,
    [requestId],
  );

  if (result.rowCount === 0 || !result.rows[0].proof_blob) return null;
  return result.rows[0];
}

export async function updateBillingRequestReview(input: {
  requestId: number;
  status: "approved" | "rejected";
  reviewedByUserId?: number | null;
  reviewNote?: string | null;
}) {
  await ensureBillingRequestsSchema();
  const result = await db.query(
    `UPDATE billing_requests
        SET status = $2,
            reviewed_by_user_id = $3,
            review_note = $4,
            reviewed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND status = 'pending_review'
      RETURNING id, restaurant_id, requested_by_user_id, status, plan_code, months,
                amount, note, proof_mime, proof_filename, reviewed_by_user_id,
                review_note, created_at, reviewed_at, updated_at,
                (proof_blob IS NOT NULL) AS has_proof`,
    [
      input.requestId,
      input.status,
      input.reviewedByUserId || null,
      input.reviewNote || null,
    ],
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}
