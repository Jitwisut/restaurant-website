import type { Pool } from "pg";

export const GUEST_SESSION_TOKEN_TYPE = "guest_session";
export const GUEST_SESSION_TTL_SECONDS = Number(
  Bun.env.GUEST_SESSION_TTL_SECONDS || 8 * 60 * 60,
);

export type GuestSessionPayload = {
  username: string;
  role: "user";
  restaurant_id: number | string;
  session_id: string;
  table_number: number | string;
  token_type: typeof GUEST_SESSION_TOKEN_TYPE;
  iat?: number;
  exp?: number;
};

export function buildGuestSessionUsername(sessionId: string) {
  return `session:${sessionId}`;
}

export function isGuestSessionPayload(
  payload: unknown,
): payload is GuestSessionPayload {
  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as Partial<GuestSessionPayload>;
  return (
    candidate.token_type === GUEST_SESSION_TOKEN_TYPE &&
    candidate.role === "user" &&
    typeof candidate.username === "string" &&
    typeof candidate.session_id === "string" &&
    typeof candidate.restaurant_id !== "undefined" &&
    typeof candidate.table_number !== "undefined"
  );
}

export async function findActiveSessionByHash(db: Pool, sessionId: string) {
  const result = await db.query(
    `SELECT
       t.table_number,
       t.status,
       t.restaurant_id,
       r.status AS restaurant_status,
       t.customer_session,
       s.session_id,
       s.opened_at,
       s.closed_at
     FROM tables t
     LEFT JOIN sessions s
       ON s.session_id::text = t.customer_session::text
      AND s.restaurant_id = t.restaurant_id
     LEFT JOIN restaurants r
       ON r.id = t.restaurant_id
     WHERE t.customer_session::text = $1
     LIMIT 1`,
    [sessionId],
  );

  if (result.rowCount === 0) return null;
  return result.rows[0];
}
