import { Context } from "elysia";
import QRCode from "qrcode";
import { getDB } from "../lib/connect";
import { randomUUID } from "crypto";
import { requireRole } from "../middleware/restaurantScope";
import { notifyTableClosed } from "../router/websocket";
import {
  buildGuestSessionUsername,
  findActiveSessionByHash,
  GUEST_SESSION_TTL_SECONDS,
} from "../lib/guestSession";
import {
  getRestaurantSubscriptionSnapshot,
  isSubscriptionBlocked,
} from "../lib/subscription";
import {
  getRestaurantSettings,
  isTableSessionExpired,
} from "../lib/restaurantSettings";

const db = getDB();

function getFrontendBaseUrl(context: any) {
  const configured =
    Bun.env.ORIGIN_URL ||
    Bun.env.FRONTEND_URL ||
    Bun.env.NEXT_PUBLIC_FRONTEND_URL ||
    Bun.env.ORIGIN_URL2;
  const requestOrigin =
    context.headers?.origin ||
    context.headers?.Origin ||
    context.request?.headers?.get?.("origin");

  return String(configured || requestOrigin || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

async function markSessionOrdersPaid(
  restaurantId: string | number,
  sessionId: string,
) {
  const settingsPayload = await getRestaurantSettings(Number(restaurantId));
  const orderSettings = settingsPayload?.settings?.order_settings || {};
  const serviceChargeRate =
    Number(orderSettings.serviceChargePercent || 0) / 100;
  const taxRate = Number(orderSettings.taxPercent || 0) / 100;

  return db.query(
    `WITH order_totals AS (
       SELECT
         o.id,
         COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS subtotal
       FROM orders o
       LEFT JOIN order_items oi
         ON oi.order_id = o.id
        AND oi.restaurant_id = o.restaurant_id
       WHERE o.restaurant_id = $1
         AND o.customer_session = $2
         AND o.status <> 'cancelled'
       GROUP BY o.id
     )
     UPDATE orders o
        SET status = 'completed',
            subtotal = order_totals.subtotal,
            service_charge_amount = ROUND(order_totals.subtotal * $3::numeric, 2),
            tax_amount = ROUND(
              (order_totals.subtotal + ROUND(order_totals.subtotal * $3::numeric, 2) - o.discount_amount)
                * $4::numeric,
              2
            ),
            grand_total = GREATEST(
              order_totals.subtotal
                - o.discount_amount
                + ROUND(order_totals.subtotal * $3::numeric, 2)
                + ROUND(
                  (order_totals.subtotal + ROUND(order_totals.subtotal * $3::numeric, 2) - o.discount_amount)
                    * $4::numeric,
                  2
                ),
              0
            ),
            payment_status = 'paid',
            paid_at = COALESCE(o.paid_at, NOW()),
            completed_at = COALESCE(o.completed_at, NOW())
       FROM order_totals
      WHERE o.id = order_totals.id
        AND o.restaurant_id = $1`,
    [restaurantId, sessionId, serviceChargeRate, taxRate],
  );
}

export const Tablecontroller = {
  gettable: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "kitchen",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const result = await db.query(
      "SELECT * FROM tables WHERE restaurant_id=$1 ORDER BY table_number ASC",
      [scope.restaurantId],
    );
    set.status = 200;

    return { tables: result.rows };
  },

  opentable: async (context: any) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "staff", "superadmin"]);
    if (!scope.ok) return scope.response;

    await db.query("BEGIN");
    const rawNumber = body.number;
    const tableNumber = parseInt(rawNumber ?? "", 10);
    const hash = randomUUID();

    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      await db.query("ROLLBACK");
      set.status = 400;
      return { message: "Invalid table number" };
    }

    const qrPath = `/order/${hash}`;
    const fullURL = `${getFrontendBaseUrl(context)}${qrPath}`;

    try {
      const qrBase64 = await QRCode.toDataURL(fullURL);
      await db.query(
        "INSERT INTO sessions (session_id,table_number,opened_at,restaurant_id) VALUES ($1,$2,NOW(),$3)",
        [hash, tableNumber, scope.restaurantId],
      );
      const result = await db.query(
        `UPDATE tables
            SET status = 'open',
                opened_at = NOW(),
                customer_session = $1,
                qr_code_url = $2
          WHERE table_number = $3
            AND restaurant_id = $4
            AND status = 'available'
          RETURNING table_number, status, opened_at, customer_session, qr_code_url`,
        [hash, qrBase64, tableNumber, scope.restaurantId],
      );

      if (result.rowCount === 0) {
        const existing = await db.query(
          `SELECT table_number, status, customer_session
             FROM tables
            WHERE table_number = $1
              AND restaurant_id = $2
            LIMIT 1`,
          [tableNumber, scope.restaurantId],
        );
        const oldSessionId = existing.rows[0]?.customer_session;
        const activeSession = oldSessionId
          ? await findActiveSessionByHash(db, String(oldSessionId))
          : null;
        const settingsPayload = await getRestaurantSettings(
          Number(scope.restaurantId),
        );
        const canRotateExpiredSession =
          existing.rows[0]?.status === "open" &&
          activeSession &&
          settingsPayload?.settings &&
          isTableSessionExpired(activeSession, settingsPayload.settings);

        if (!canRotateExpiredSession) {
          await db.query("ROLLBACK");
          set.status = 409;
          return { message: "Table is already open or not found" };
        }

        await db.query(
          `UPDATE sessions
              SET closed_at = NOW()
            WHERE session_id::text = $1
              AND restaurant_id = $2
              AND closed_at IS NULL`,
          [String(oldSessionId), scope.restaurantId],
        );
        const rotated = await db.query(
          `UPDATE tables
              SET status = 'open',
                  opened_at = NOW(),
                  customer_session = $1,
                  qr_code_url = $2
            WHERE table_number = $3
              AND restaurant_id = $4
            RETURNING table_number, status, opened_at, customer_session, qr_code_url`,
          [hash, qrBase64, tableNumber, scope.restaurantId],
        );

        await db.query("COMMIT");
        return {
          message: "Open table success",
          table_number: tableNumber,
          session_hash: hash,
          qr_code_url: rotated.rows[0].qr_code_url,
          fullurl: fullURL,
        };
      }

      await db.query("COMMIT");
      return {
        message: "Open table success",
        table_number: tableNumber,
        session_hash: hash,
        qr_code_url: qrBase64,
        fullurl: fullURL,
      };
    } catch (err) {
      await db.query("ROLLBACK");
      console.error("opentable error:", err);
      set.status = 500;
      return { message: "Internal server error" };
    }
  },

  closetable: async (context: {
    set: Context["set"];
    body: { number: string };
    server: Context["server"];
    jwt?: any;
    headers: Context["headers"];
  }) => {
    const { set, body, server } = context;
    const scope = await requireRole(context as any, [
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const tableNumber = parseInt(body.number ?? "", 10);
    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      set.status = 400;
      return { message: "Invalid table number" };
    }

    try {
      const currentTable = await db.query(
        `SELECT customer_session
           FROM tables
          WHERE table_number=$1
            AND restaurant_id=$2
            AND status <> 'available'`,
        [tableNumber, scope.restaurantId],
      );
      if (currentTable.rowCount === 0) {
        set.status = 404;
        return { message: "Table not found" };
      }

      const closedSessionId = currentTable.rows[0].customer_session;
      const stmt = await db.query(
        `UPDATE tables
            SET status = 'available',
                opened_at = NULL,
                qr_code_url = NULL,
                customer_session = NULL
          WHERE table_number = $1
            AND restaurant_id = $2
            AND status <> 'available'`,
        [tableNumber, scope.restaurantId],
      );

      await db.query(
        "UPDATE sessions SET closed_at=NOW() WHERE session_id=$1 AND restaurant_id=$2",
        [closedSessionId, scope.restaurantId],
      );

      if (stmt.rowCount === 0) {
        set.status = 404;
        return { message: "Table not found or already available" };
      }

      if (closedSessionId) {
        const notified = notifyTableClosed(String(closedSessionId));
        if (!notified) {
          server?.publish(
            closedSessionId,
            JSON.stringify({
              type: "table_closed",
              message: "Table has been close",
            }),
          );
        }
      }

      if (closedSessionId) {
        await markSessionOrdersPaid(scope.restaurantId, String(closedSessionId));
      }

      return { message: "Close table success", table_number: tableNumber };
    } catch (err) {
      console.error("closetable error:", (err as Error).message);
      set.status = 500;
      return { message: "Internal server error" };
    }
  },

  checktabel: async ({
    set,
    params,
  }: {
    set: Context["set"];
    params: Context["params"];
  }) => {
    const hashcode = params.session;
    if (!hashcode) {
      set.status = 400;
      return { message: "Session not found" };
    }

    const result = await db.query(
      `SELECT t.*, r.status AS restaurant_status
         FROM tables t
         LEFT JOIN restaurants r ON r.id = t.restaurant_id
        WHERE t.customer_session::text = $1`,
      [hashcode],
    );

    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "Table not found" };
    }

    if (result.rows[0].restaurant_status !== "active") {
      set.status = 403;
      return { message: "Restaurant is suspended" };
    }

    const subscription = await getRestaurantSubscriptionSnapshot(
      result.rows[0].restaurant_id,
    );
    if (subscription && isSubscriptionBlocked(subscription.status)) {
      set.status = 403;
      return { message: "Restaurant subscription is inactive" };
    }

    set.status = 200;
    return { message: "Table found", table: result.rows[0] };
  },

  createGuestToken: async (
    context: Context & {
      params: { session: string };
      jwt?: any;
    },
  ) => {
    const { set, params, jwt } = context;
    const sessionId = params.session;

    if (!sessionId) {
      set.status = 400;
      return { message: "Session not found" };
    }

    const session = await findActiveSessionByHash(db, sessionId);
    if (!session) {
      set.status = 404;
      return { message: "Table not found" };
    }

    if (session.restaurant_status !== "active") {
      set.status = 403;
      return { message: "Restaurant is suspended" };
    }

    const subscription = await getRestaurantSubscriptionSnapshot(
      session.restaurant_id,
    );
    if (subscription && isSubscriptionBlocked(subscription.status)) {
      set.status = 403;
      return { message: "Restaurant subscription is inactive" };
    }

    if (session.status !== "open" || session.closed_at) {
      set.status = 409;
      return { message: "Table session is no longer active" };
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await jwt.sign({
      username: buildGuestSessionUsername(sessionId),
      role: "user",
      restaurant_id: session.restaurant_id,
      session_id: sessionId,
      table_number: session.table_number,
      token_type: "guest_session",
      iat: now,
      exp: now + GUEST_SESSION_TTL_SECONDS,
    });

    set.status = 200;
    return {
      token,
      expires_in: GUEST_SESSION_TTL_SECONDS,
      session_id: sessionId,
      table_number: session.table_number,
      restaurant_id: session.restaurant_id,
    };
  },

  ordersuccess: async (
    context: Context & {
      body: { table_number: Number };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "staff", "superadmin"]);
    if (!scope.ok) return scope.response;

    const tablenumber = body.table_number;
    if (!tablenumber) {
      set.status = 404;
      return { message: "No table number" };
    }

    const currentTable = await db.query(
      `SELECT customer_session
         FROM tables
        WHERE table_number = $1
          AND restaurant_id = $2`,
      [tablenumber, scope.restaurantId],
    );

    const sessionId = currentTable.rows?.[0]?.customer_session;
    if (!sessionId) {
      set.status = 404;
      return { message: "No active table session" };
    }

    await markSessionOrdersPaid(scope.restaurantId, String(sessionId));
    return { message: "success" };
  },

  addtable: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    try {
      await db.query("BEGIN");
      const result = await db.query(
        `INSERT INTO tables (table_number, status, restaurant_id)
         VALUES (
           (SELECT COALESCE(MAX(table_number::integer), 0) + 1
              FROM tables
             WHERE restaurant_id=$1),
           'available',
           $1
         )
         RETURNING table_number`,
        [scope.restaurantId],
      );
      await db.query("COMMIT");
      const newtablenumber = parseInt(result.rows[0].table_number);
      return {
        success: true,
        message: `Add table ${newtablenumber} success`,
        new_table: newtablenumber,
      };
    } catch (err: any) {
      console.error(err.message);
      await db.query("ROLLBACK");
      set.status = 500;
      return { message: "Internal server error" };
    }
  },
};
