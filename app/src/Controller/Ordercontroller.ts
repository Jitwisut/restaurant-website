import { Context } from "elysia";
import { ensureSalesSchema, getDB } from "../lib/connect";
import { requireRole } from "../middleware/restaurantScope";
import { writeSuperadminAudit } from "../lib/superadminAudit";
import { buildGuestSessionUsername } from "../lib/guestSession";
import { notifyAdmins } from "../router/websocket";

const db = getDB();

const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
  "rejected",
];
const PAYMENT_STATUSES = [
  "unpaid",
  "pending_review",
  "paid",
  "rejected",
  "refunded",
  "voided",
];

function normalizeStatus(status: unknown) {
  const value = String(status || "").trim();
  return value === "done" ? "ready" : value;
}

async function getActorUserId(email?: string | null) {
  if (!email) return null;
  const result = await db.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [
    email,
  ]);
  return result.rows?.[0]?.id || null;
}

async function writeOrderAudit(scope: any, action: string, input: {
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}) {
  await writeSuperadminAudit({
    actorUserId: await getActorUserId(scope.payload?.email),
    actorEmail: scope.payload?.email || null,
    restaurantId: scope.restaurantId,
    action,
    reason: input.reason || null,
    oldValue: input.oldValue,
    newValue: input.newValue,
  });
}

function buildOrderSelect(where: string) {
  return `SELECT
      o.table_number,
      o.id,
      o.status,
      o.payment_status,
      o.payment_reference,
      o.payment_review_note,
      o.payment_submitted_at,
      o.payment_reviewed_at,
      o.paid_at,
      o.completed_at,
      o.refunded_at,
      o.voided_at,
      o.created_at,
      s.session_id,
      s.opened_at,
      s.closed_at,
      COALESCE(
        json_agg(
          json_build_object(
            'menu_item_name', oi.menu_item_name,
            'quantity', oi.quantity,
            'price', oi.price,
            'notes', oi.notes
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) as items,
      COALESCE(SUM(oi.quantity * oi.price::numeric), 0) as subtotal,
      COALESCE(NULLIF(o.service_charge_amount, 0), 0) as service_charge_amount,
      COALESCE(NULLIF(o.tax_amount, 0), 0) as tax_amount,
      COALESCE(NULLIF(o.discount_amount, 0), 0) as discount_amount,
      COALESCE(NULLIF(o.grand_total, 0), SUM(oi.quantity * oi.price::numeric), 0) as total,
      CASE
        WHEN s.session_id IS NOT NULL THEN $guest_username$ || s.session_id
        ELSE NULL
      END as customer_username
    FROM orders o
    LEFT JOIN sessions s
      ON o.customer_session = s.session_id
     AND s.restaurant_id = o.restaurant_id
    LEFT JOIN order_items oi
      ON o.id = oi.order_id
     AND oi.restaurant_id = o.restaurant_id
    ${where}
    GROUP BY o.table_number, o.id, o.status, o.payment_status,
             o.payment_reference, o.payment_review_note,
             o.payment_submitted_at, o.payment_reviewed_at,
             o.paid_at, o.completed_at, o.refunded_at, o.voided_at,
             o.created_at, o.service_charge_amount, o.tax_amount,
             o.discount_amount, o.grand_total,
             s.session_id, s.opened_at, s.closed_at`;
}

async function getOrderSnapshot(restaurantId: number | string, orderId: string) {
  await ensureSalesSchema();
  const query = buildOrderSelect(
    "WHERE o.restaurant_id = $1 AND o.id = $2",
  ).replace("$guest_username$", `'${buildGuestSessionUsername("")}'`);
  const result = await db.query(`${query} LIMIT 1`, [restaurantId, orderId]);
  return result.rows?.[0] || null;
}

async function listOrders(scope: any, filters: {
  tableNumber?: number | string | null;
  status?: string | null;
  activeOnly?: boolean;
  paymentStatus?: string | null;
}) {
  await ensureSalesSchema();

  const params: unknown[] = [scope.restaurantId];
  const clauses = ["o.restaurant_id = $1"];

  if (filters.tableNumber) {
    params.push(filters.tableNumber);
    clauses.push(`o.table_number = $${params.length}`);
  }

  if (filters.status && filters.status !== "all") {
    params.push(normalizeStatus(filters.status));
    clauses.push(`o.status = $${params.length}`);
  }

  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    params.push(filters.paymentStatus);
    clauses.push(`o.payment_status = $${params.length}`);
  }

  if (filters.activeOnly) {
    clauses.push("o.status IN ('pending', 'accepted', 'preparing')");
    clauses.push("s.session_id IS NOT NULL");
    clauses.push("s.closed_at IS NULL");
    clauses.push(
      `EXISTS (
        SELECT 1
          FROM tables t
         WHERE t.restaurant_id = o.restaurant_id
           AND t.table_number::text = o.table_number::text
           AND t.customer_session::text = o.customer_session::text
           AND t.status = 'open'
      )`,
    );
  }

  const query = buildOrderSelect(
    `WHERE ${clauses.join(" AND ")}`,
  ).replace("$guest_username$", `'${buildGuestSessionUsername("")}'`);
  const result = await db.query(
    `${query} ORDER BY o.created_at DESC LIMIT 100`,
    params,
  );

  return result.rows;
}

async function updateOrderPayment(scope: any, orderId: string, input: {
  paymentStatus: string;
  note?: string | null;
  reference?: string | null;
  reason?: string | null;
}) {
  if (!PAYMENT_STATUSES.includes(input.paymentStatus)) {
    return { error: "Invalid payment status" };
  }

  const before = await getOrderSnapshot(scope.restaurantId, orderId);
  if (!before) return { error: "Order not found" };

  const reviewerId = await getActorUserId(scope.payload?.email);
  const result = await db.query(
    `UPDATE orders
        SET payment_status = $3::varchar,
            payment_reference = COALESCE($4::text, payment_reference),
            payment_review_note = $5::text,
            payment_submitted_at = CASE
              WHEN $3::text = 'pending_review' THEN NOW()
              ELSE payment_submitted_at
            END,
            payment_reviewed_at = CASE
              WHEN $3::text IN ('paid', 'rejected', 'refunded', 'voided') THEN NOW()
              ELSE payment_reviewed_at
            END,
            payment_reviewed_by = CASE
              WHEN $3::text IN ('paid', 'rejected', 'refunded', 'voided') THEN $6::integer
              ELSE payment_reviewed_by
            END,
            paid_at = CASE WHEN $3::text = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
            refunded_at = CASE WHEN $3::text = 'refunded' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
            voided_at = CASE WHEN $3::text = 'voided' THEN COALESCE(voided_at, NOW()) ELSE voided_at END
      WHERE restaurant_id = $1::integer
        AND id = $2::text
      RETURNING id`,
    [
      scope.restaurantId,
      orderId,
      input.paymentStatus,
      input.reference || null,
      input.note || input.reason || null,
      reviewerId,
    ],
  );

  if (result.rowCount === 0) return { error: "Order not found" };

  const order = await getOrderSnapshot(scope.restaurantId, orderId);
  await writeOrderAudit(scope, `order.payment.${input.paymentStatus}`, {
    oldValue: before,
    newValue: order,
    reason: input.reason || input.note || null,
  });
  notifyAdmins(scope.restaurantId, {
    type: "order_updated",
    order,
    order_id: orderId,
    status: order?.status,
    timestamp: new Date().toISOString(),
  });

  return { order };
}

export const Orderscontroller = {
  orderhistory: async (
    context: Context & {
      body: {
        table_number?: Number;
        status?: string;
        payment_status?: string;
      };
      jwt?: any;
    },
  ) => {
    const { body } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "kitchen",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const order = await listOrders(scope, {
      tableNumber: body.table_number as any,
      status: body.status,
      paymentStatus: body.payment_status,
    });
    return { order };
  },

  active: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "kitchen",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const order = await listOrders(scope, { activeOnly: true });
    return { order };
  },

  updateStatus: async (
    context: Context & {
      params: { id: string };
      body: { status: string; reason?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const status = normalizeStatus(body.status);
    if (!ORDER_STATUSES.includes(status)) {
      set.status = 400;
      return { message: "Invalid order status" };
    }

    if (["cancelled", "rejected"].includes(status) && !body.reason?.trim()) {
      set.status = 400;
      return { message: "Reason is required for cancelled or rejected orders" };
    }

    const before = await getOrderSnapshot(scope.restaurantId, params.id);
    if (!before) {
      set.status = 404;
      return { message: "Order not found" };
    }

    const result = await db.query(
      `UPDATE orders
          SET status = $3,
              completed_at = CASE
                WHEN $3 = 'completed' THEN COALESCE(completed_at, NOW())
                ELSE completed_at
              END,
              updated_at = NOW()
        WHERE restaurant_id = $1
          AND id = $2
        RETURNING id`,
      [scope.restaurantId, params.id, status],
    );

    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "Order not found" };
    }

    const order = await getOrderSnapshot(scope.restaurantId, params.id);
    await writeOrderAudit(scope, "order.status.updated", {
      oldValue: before,
      newValue: order,
      reason: body.reason || null,
    });
    notifyAdmins(scope.restaurantId, {
      type: "order_updated",
      order,
      order_id: params.id,
      status,
      timestamp: new Date().toISOString(),
    });

    return { order };
  },

  pendingPayments: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const order = await listOrders(scope, {
      paymentStatus: "pending_review",
    });
    return { order };
  },

  submitProof: async (
    context: Context & {
      params: { id: string };
      body: { reference?: string; note?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const result = await updateOrderPayment(scope, params.id, {
      paymentStatus: "pending_review",
      reference: body.reference || null,
      note: body.note || null,
    });
    if (result.error) {
      set.status = result.error === "Order not found" ? 404 : 400;
      return { message: result.error };
    }
    return { order: result.order };
  },

  approvePayment: async (
    context: Context & {
      params: { id: string };
      body: { note?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const result = await updateOrderPayment(scope, params.id, {
      paymentStatus: "paid",
      note: body.note || null,
    });
    if (result.error) {
      set.status = result.error === "Order not found" ? 404 : 400;
      return { message: result.error };
    }
    return { order: result.order };
  },

  rejectPayment: async (
    context: Context & {
      params: { id: string };
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

    const result = await updateOrderPayment(scope, params.id, {
      paymentStatus: "rejected",
      reason: body.reason,
    });
    if (result.error) {
      set.status = result.error === "Order not found" ? 404 : 400;
      return { message: result.error };
    }
    return { order: result.order };
  },

  refundPayment: async (
    context: Context & {
      params: { id: string };
      body: { reason?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const result = await updateOrderPayment(scope, params.id, {
      paymentStatus: "refunded",
      reason: body.reason || null,
    });
    if (result.error) {
      set.status = result.error === "Order not found" ? 404 : 400;
      return { message: result.error };
    }
    return { order: result.order };
  },

  voidPayment: async (
    context: Context & {
      params: { id: string };
      body: { reason?: string };
      jwt?: any;
    },
  ) => {
    const { set, params, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const result = await updateOrderPayment(scope, params.id, {
      paymentStatus: "voided",
      reason: body.reason || null,
    });
    if (result.error) {
      set.status = result.error === "Order not found" ? 404 : 400;
      return { message: result.error };
    }
    return { order: result.order };
  },
};
