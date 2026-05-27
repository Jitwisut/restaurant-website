import { getDB } from "./connect";

const db = getDB();

export type OrderEventInput = {
  restaurantId: string | number;
  sessionId?: string | null;
  orderId?: string | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  eventType: string;
  metadata?: Record<string, unknown> | null;
};

export async function ensureOrderEventsSchema() {
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
}

export async function writeOrderEvent(input: OrderEventInput) {
  await ensureOrderEventsSchema();
  await db.query(
    `INSERT INTO order_events
      (restaurant_id, session_id, order_id, actor_role, actor_email, event_type, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      Number(input.restaurantId),
      input.sessionId || null,
      input.orderId || null,
      input.actorRole || null,
      input.actorEmail || null,
      input.eventType,
      JSON.stringify(input.metadata || {}),
    ],
  );
}

export async function listSessionTimeline(
  restaurantId: string | number,
  sessionId: string,
  role?: string | null,
) {
  await ensureOrderEventsSchema();
  const params: unknown[] = [Number(restaurantId), sessionId];
  const clauses = ["restaurant_id = $1", "session_id = $2"];

  if (role === "kitchen") {
    clauses.push(
      `event_type IN (
        'order_created',
        'order_accepted',
        'order_preparing',
        'order_ready',
        'order_served',
        'order_rejected'
      )`,
    );
  }

  const result = await db.query(
    `SELECT
       id,
       restaurant_id,
       session_id,
       order_id,
       actor_role,
       actor_email,
       event_type,
       metadata_json,
       created_at
     FROM order_events
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at ASC, id ASC`,
    params,
  );

  return result.rows || [];
}
