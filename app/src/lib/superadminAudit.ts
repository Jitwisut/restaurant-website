import { getDB } from "./connect";

const db = getDB();

let auditSchemaPromise: Promise<void> | null = null;

export async function ensureSuperadminAuditSchema() {
  if (!auditSchemaPromise) {
    auditSchemaPromise = db
      .query(`
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
      `)
      .then(() => undefined)
      .catch((error) => {
        auditSchemaPromise = null;
        throw error;
      });
  }

  await auditSchemaPromise;
}

export async function writeSuperadminAudit(input: {
  actorUserId?: number | null;
  actorEmail?: string | null;
  restaurantId?: number | null;
  targetUserId?: number | null;
  action: string;
  reason?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}) {
  await ensureSuperadminAuditSchema();

  await db.query(
    `INSERT INTO superadmin_audit_logs (
       actor_user_id,
       actor_email,
       restaurant_id,
       target_user_id,
       action,
       reason,
       old_value_json,
       new_value_json,
       ip_address
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
    [
      input.actorUserId || null,
      input.actorEmail || null,
      input.restaurantId || null,
      input.targetUserId || null,
      input.action,
      input.reason || null,
      input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
      input.newValue === undefined ? null : JSON.stringify(input.newValue),
      input.ipAddress || null,
    ],
  );
}
