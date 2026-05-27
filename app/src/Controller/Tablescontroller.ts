import { Context } from "elysia";
import QRCode from "qrcode";
import { getDB } from "../lib/connect";
import { randomUUID } from "crypto";
import { requireRole } from "../middleware/restaurantScope";
import { notifyTableClosed } from "../router/websocket";
import { buildBillPaymentQr } from "../lib/paymentQr";
import {
  listSessionTimeline,
  writeOrderEvent,
} from "../lib/orderEvents";
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

async function recalculateSessionOrderTotals(
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
        SET subtotal = order_totals.subtotal,
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
            )
       FROM order_totals
      WHERE o.id = order_totals.id
        AND o.restaurant_id = $1`,
    [restaurantId, sessionId, serviceChargeRate, taxRate],
  );
}

async function buildSessionBill(
  restaurantId: string | number,
  sessionId: string,
) {
  const settingsPayload = await getRestaurantSettings(Number(restaurantId));
  const orderSettings = settingsPayload?.settings?.order_settings || {};
  const sessionResult = await db.query(
    `SELECT
       s.session_id,
       s.table_number,
       s.opened_at,
       s.closed_at
     FROM sessions s
    WHERE s.restaurant_id = $1
      AND s.session_id::text = $2
    LIMIT 1`,
    [restaurantId, sessionId],
  );

  if (sessionResult.rowCount === 0) return null;

  const ordersResult = await db.query(
    `SELECT
       o.id,
       o.status,
       o.payment_status,
       o.created_at,
       COALESCE(o.subtotal, 0) AS subtotal,
       COALESCE(o.discount_amount, 0) AS discount_amount,
       COALESCE(o.service_charge_amount, 0) AS service_charge_amount,
       COALESCE(o.tax_amount, 0) AS tax_amount,
       COALESCE(o.grand_total, 0) AS grand_total,
       COALESCE(
         json_agg(
           json_build_object(
             'order_id', o.id,
             'menu_item_name', oi.menu_item_name,
             'quantity', oi.quantity,
             'price', oi.price,
             'subtotal', oi.quantity * oi.price::numeric,
             'notes', oi.notes
           ) ORDER BY oi.id
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'
       ) AS items
     FROM orders o
     LEFT JOIN order_items oi
       ON oi.order_id = o.id
      AND oi.restaurant_id = o.restaurant_id
    WHERE o.restaurant_id = $1
      AND o.customer_session::text = $2
    GROUP BY o.id, o.status, o.payment_status, o.created_at,
             o.subtotal, o.discount_amount, o.service_charge_amount,
             o.tax_amount, o.grand_total
    ORDER BY o.created_at ASC`,
    [restaurantId, sessionId],
  );

  const orders = ordersResult.rows || [];
  const items = orders.flatMap((order: any) =>
    Array.isArray(order.items) ? order.items : [],
  );
  const itemSubtotal = items.reduce(
    (sum: number, item: any) => sum + Number(item.subtotal || 0),
    0,
  );
  const subtotal = orders.reduce(
    (sum: number, order: any) =>
      sum + Number(order.subtotal || 0),
    0,
  ) || itemSubtotal;
  const serviceChargeAmount = orders.reduce(
    (sum: number, order: any) =>
      sum + Number(order.service_charge_amount || 0),
    0,
  );
  const taxAmount = orders.reduce(
    (sum: number, order: any) => sum + Number(order.tax_amount || 0),
    0,
  );
  const discountAmount = orders.reduce(
    (sum: number, order: any) =>
      sum + Number(order.discount_amount || 0),
    0,
  );
  const grandTotal = orders.reduce(
    (sum: number, order: any) => sum + Number(order.grand_total || 0),
    0,
  ) || Math.max(subtotal + serviceChargeAmount + taxAmount - discountAmount, 0);
  const payment = await buildBillPaymentQr(orderSettings, grandTotal);
  const paymentStatuses = Array.from(
    new Set(orders.map((order: any) => order.payment_status || "unpaid")),
  );

  return {
    session: sessionResult.rows[0],
    orders,
    items,
    totals: {
      subtotal,
      service_charge_amount: serviceChargeAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      grand_total: grandTotal,
    },
    payment,
    payment_status:
      paymentStatuses.length === 1 ? paymentStatuses[0] : "mixed",
  };
}

async function buildSessionOrderHistory(
  restaurantId: string | number,
  sessionId: string,
) {
  const result = await db.query(
    `SELECT
       o.id,
       o.table_number,
       o.status,
       o.payment_status,
       o.created_at,
       COALESCE(o.subtotal, 0) AS subtotal,
       COALESCE(o.discount_amount, 0) AS discount_amount,
       COALESCE(o.service_charge_amount, 0) AS service_charge_amount,
       COALESCE(o.tax_amount, 0) AS tax_amount,
       COALESCE(NULLIF(o.grand_total, 0), SUM(oi.quantity * oi.price::numeric), 0) AS total,
       COALESCE(
         json_agg(
           json_build_object(
             'menu_item_name', oi.menu_item_name,
             'quantity', oi.quantity,
             'price', oi.price,
             'subtotal', oi.quantity * oi.price::numeric,
             'notes', oi.notes
           ) ORDER BY oi.id
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'
       ) AS items
     FROM orders o
     LEFT JOIN order_items oi
       ON oi.order_id = o.id
      AND oi.restaurant_id = o.restaurant_id
    WHERE o.restaurant_id = $1
      AND o.customer_session::text = $2
    GROUP BY o.id, o.table_number, o.status, o.payment_status, o.created_at,
             o.subtotal, o.discount_amount, o.service_charge_amount,
             o.tax_amount, o.grand_total
    ORDER BY o.created_at DESC`,
    [restaurantId, sessionId],
  );

  return result.rows || [];
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
        await writeOrderEvent({
          restaurantId: scope.restaurantId,
          sessionId: hash,
          actorRole: scope.payload?.role || null,
          actorEmail: scope.payload?.email || null,
          eventType: "table_opened",
          metadata: { table_number: tableNumber, rotated_from: oldSessionId || null },
        });
        return {
          message: "Open table success",
          table_number: tableNumber,
          session_hash: hash,
          qr_code_url: rotated.rows[0].qr_code_url,
          fullurl: fullURL,
        };
      }

      await db.query("COMMIT");
      await writeOrderEvent({
        restaurantId: scope.restaurantId,
        sessionId: hash,
        actorRole: scope.payload?.role || null,
        actorEmail: scope.payload?.email || null,
        eventType: "table_opened",
        metadata: { table_number: tableNumber },
      });
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

      let bill = null;
      if (closedSessionId) {
        await recalculateSessionOrderTotals(scope.restaurantId, String(closedSessionId));
        await writeOrderEvent({
          restaurantId: scope.restaurantId,
          sessionId: String(closedSessionId),
          actorRole: scope.payload?.role || null,
          actorEmail: scope.payload?.email || null,
          eventType: "table_closed",
          metadata: { table_number: tableNumber },
        });
        bill = await buildSessionBill(scope.restaurantId, String(closedSessionId));
      }

      return {
        message: "Close table success",
        table_number: tableNumber,
        session_id: closedSessionId,
        bill,
      };
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
    await writeOrderEvent({
      restaurantId: scope.restaurantId,
      sessionId: String(sessionId),
      actorRole: scope.payload?.role || null,
      actorEmail: scope.payload?.email || null,
      eventType: "payment_approved",
      metadata: { table_number: tablenumber, source: "ordersuccess" },
    });
    return { message: "success" };
  },

  sessionBill: async (
    context: Context & {
      params: { session: string };
      jwt?: any;
    },
  ) => {
    const { set, params } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const bill = await buildSessionBill(scope.restaurantId, params.session);
    if (!bill) {
      set.status = 404;
      return { message: "Bill not found" };
    }

    return { bill };
  },

  sessionOrders: async (
    context: Context & {
      params: { session: string };
      jwt?: any;
    },
  ) => {
    const { set, params } = context;
    const scope = await requireRole(context, [
      "user",
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const tokenSessionId = (scope.payload as any)?.session_id;
    if (scope.payload?.role === "user" && tokenSessionId !== params.session) {
      set.status = 403;
      return { message: "Forbidden: Invalid table session" };
    }

    const orders = await buildSessionOrderHistory(
      scope.restaurantId,
      params.session,
    );

    return { orders };
  },

  publicSessionBill: async (
    context: Context & {
      params: { session: string };
    },
  ) => {
    const { set, params } = context;
    const sessionResult = await db.query(
      `SELECT s.restaurant_id, r.status AS restaurant_status
         FROM sessions s
         LEFT JOIN restaurants r ON r.id = s.restaurant_id
        WHERE s.session_id::text = $1
        LIMIT 1`,
      [params.session],
    );

    if (sessionResult.rowCount === 0) {
      set.status = 404;
      return { message: "Bill not found" };
    }

    if (sessionResult.rows[0].restaurant_status !== "active") {
      set.status = 403;
      return { message: "Restaurant is suspended" };
    }

    const bill = await buildSessionBill(
      sessionResult.rows[0].restaurant_id,
      params.session,
    );
    if (!bill) {
      set.status = 404;
      return { message: "Bill not found" };
    }

    return { bill };
  },

  sessionTimeline: async (
    context: Context & {
      params: { session: string };
      jwt?: any;
    },
  ) => {
    const { set, params } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "kitchen",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const sessionResult = await db.query(
      `SELECT 1
         FROM sessions
        WHERE restaurant_id = $1
          AND session_id::text = $2
        LIMIT 1`,
      [scope.restaurantId, params.session],
    );
    if (sessionResult.rowCount === 0) {
      set.status = 404;
      return { message: "Session not found" };
    }

    const timeline = await listSessionTimeline(
      scope.restaurantId,
      params.session,
      scope.payload?.role || null,
    );
    return { timeline };
  },

  submitSessionPaymentProof: async (
    context: Context & {
      params: { session: string };
      body: { reference?: string; note?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, [
      "user",
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const tokenSessionId = (scope.payload as any)?.session_id;
    if (scope.payload?.role === "user" && tokenSessionId !== params.session) {
      set.status = 403;
      return { message: "Forbidden: Invalid table session" };
    }

    const result = await db.query(
      `UPDATE orders
          SET payment_status = 'pending_review',
              payment_reference = COALESCE($3::text, payment_reference),
              payment_review_note = $4::text,
              payment_submitted_at = NOW(),
              payment_reviewed_at = NULL,
              payment_reviewed_by = NULL
        WHERE restaurant_id = $1
          AND customer_session::text = $2
          AND status NOT IN ('cancelled', 'rejected')
        RETURNING id`,
      [scope.restaurantId, params.session, body.reference || null, body.note || null],
    );
    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "No payable orders found for this session" };
    }

    await writeOrderEvent({
      restaurantId: scope.restaurantId,
      sessionId: params.session,
      actorRole: scope.payload?.role || null,
      actorEmail: scope.payload?.email || null,
      eventType: "payment_submitted",
      metadata: { reference: body.reference || null, note: body.note || null },
    });
    const bill = await buildSessionBill(scope.restaurantId, params.session);
    return { bill, updated_orders: result.rowCount };
  },

  approveSessionPayment: async (
    context: Context & {
      params: { session: string };
      body: { note?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    await recalculateSessionOrderTotals(scope.restaurantId, params.session);
    const reviewerIdResult = scope.payload?.email
      ? await db.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [
          scope.payload.email,
        ])
      : { rows: [] };
    const result = await db.query(
      `UPDATE orders
          SET status = 'completed',
              payment_status = 'paid',
              payment_review_note = $3::text,
              payment_reviewed_at = NOW(),
              payment_reviewed_by = $4::integer,
              paid_at = COALESCE(paid_at, NOW()),
              completed_at = COALESCE(completed_at, NOW()),
              updated_at = NOW()
        WHERE restaurant_id = $1
          AND customer_session::text = $2
          AND status NOT IN ('cancelled', 'rejected')
        RETURNING id`,
      [
        scope.restaurantId,
        params.session,
        body.note || null,
        reviewerIdResult.rows?.[0]?.id || null,
      ],
    );
    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "No payable orders found for this session" };
    }

    await writeOrderEvent({
      restaurantId: scope.restaurantId,
      sessionId: params.session,
      actorRole: scope.payload?.role || null,
      actorEmail: scope.payload?.email || null,
      eventType: "payment_approved",
      metadata: { note: body.note || null },
    });
    const bill = await buildSessionBill(scope.restaurantId, params.session);
    return { bill, updated_orders: result.rowCount };
  },

  rejectSessionPayment: async (
    context: Context & {
      params: { session: string };
      body: { reason?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    if (!body.reason?.trim()) {
      set.status = 400;
      return { message: "Reason is required" };
    }

    const reviewerIdResult = scope.payload?.email
      ? await db.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [
          scope.payload.email,
        ])
      : { rows: [] };
    const result = await db.query(
      `UPDATE orders
          SET payment_status = 'rejected',
              payment_review_note = $3::text,
              payment_reviewed_at = NOW(),
              payment_reviewed_by = $4::integer
        WHERE restaurant_id = $1
          AND customer_session::text = $2
          AND status NOT IN ('cancelled', 'rejected')
        RETURNING id`,
      [
        scope.restaurantId,
        params.session,
        body.reason,
        reviewerIdResult.rows?.[0]?.id || null,
      ],
    );
    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "No payable orders found for this session" };
    }

    await writeOrderEvent({
      restaurantId: scope.restaurantId,
      sessionId: params.session,
      actorRole: scope.payload?.role || null,
      actorEmail: scope.payload?.email || null,
      eventType: "payment_rejected",
      metadata: { reason: body.reason },
    });
    const bill = await buildSessionBill(scope.restaurantId, params.session);
    return { bill, updated_orders: result.rowCount };
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
