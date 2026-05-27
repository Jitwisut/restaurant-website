import { Context } from "elysia";
import { ensureSalesSchema, getDB } from "../lib/connect";
import { requireRole } from "../middleware/restaurantScope";

const db = getDB();

function resolveBangkokDate(value?: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(report: any) {
  const rows: string[][] = [
    ["Daily Closing", report.date],
    ["Gross sales", report.summary.grossSales],
    ["Paid sales", report.summary.paidSales],
    ["Unpaid or pending", report.summary.unpaidPending],
    ["Order count", report.summary.orderCount],
    ["Bill/session count", report.summary.billCount],
    ["Average bill", report.summary.averageBill],
    [],
    ["Top menu items"],
    ["Item", "Quantity", "Revenue"],
    ...report.topMenuItems.map((item: any) => [
      item.name,
      item.quantity,
      item.revenue,
    ]),
    [],
    ["Open tables"],
    ["Table", "Session", "Opened at"],
    ...report.openTables.map((table: any) => [
      table.table_number,
      table.customer_session,
      table.opened_at,
    ]),
    [],
    ["Cancelled/rejected orders"],
    ["Order", "Table", "Status", "Total"],
    ...report.cancelledRejectedOrders.map((order: any) => [
      order.id,
      order.table_number,
      order.status,
      order.total,
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

async function buildDailyClosingReport(restaurantId: string | number, date: string) {
  await ensureSalesSchema();

  const summaryResult = await db.query(
    `WITH day_orders AS (
       SELECT *
         FROM orders
        WHERE restaurant_id = $1
          AND (created_at + INTERVAL '7 hours')::date = $2::date
     ),
     paid_orders AS (
       SELECT *
         FROM day_orders
        WHERE payment_status = 'paid'
          AND paid_at IS NOT NULL
          AND refunded_at IS NULL
          AND voided_at IS NULL
     )
     SELECT
       COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'rejected') THEN grand_total ELSE 0 END), 0) AS gross_sales,
       COALESCE((SELECT SUM(grand_total) FROM paid_orders), 0) AS paid_sales,
       COALESCE(SUM(CASE
         WHEN status NOT IN ('cancelled', 'rejected')
          AND payment_status IN ('unpaid', 'pending_review', 'rejected')
         THEN grand_total
         ELSE 0
       END), 0) AS unpaid_pending,
       COUNT(*)::int AS order_count,
       COUNT(DISTINCT customer_session)::int AS bill_count,
       COALESCE((SELECT AVG(session_total) FROM (
         SELECT customer_session, SUM(grand_total) AS session_total
           FROM paid_orders
          GROUP BY customer_session
       ) sessions), 0) AS average_bill
      FROM day_orders`,
    [restaurantId, date],
  );

  const topItemsResult = await db.query(
    `SELECT
       oi.menu_item_name AS name,
       SUM(oi.quantity)::int AS quantity,
       COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS revenue
     FROM order_items oi
     INNER JOIN orders o
       ON o.id = oi.order_id
      AND o.restaurant_id = oi.restaurant_id
     WHERE o.restaurant_id = $1
       AND (o.created_at + INTERVAL '7 hours')::date = $2::date
       AND o.payment_status = 'paid'
       AND o.refunded_at IS NULL
       AND o.voided_at IS NULL
     GROUP BY oi.menu_item_name
     ORDER BY revenue DESC, quantity DESC, oi.menu_item_name ASC
     LIMIT 10`,
    [restaurantId, date],
  );

  const openTablesResult = await db.query(
    `SELECT table_number, customer_session, opened_at
       FROM tables
      WHERE restaurant_id = $1
        AND status = 'open'
      ORDER BY table_number ASC`,
    [restaurantId],
  );

  const cancelledRejectedResult = await db.query(
    `SELECT id, table_number, status, grand_total AS total
       FROM orders
      WHERE restaurant_id = $1
        AND (created_at + INTERVAL '7 hours')::date = $2::date
        AND status IN ('cancelled', 'rejected')
      ORDER BY created_at DESC`,
    [restaurantId, date],
  );

  const summary = summaryResult.rows?.[0] || {};
  return {
    date,
    timezone: "Asia/Bangkok",
    summary: {
      grossSales: Number(summary.gross_sales || 0),
      paidSales: Number(summary.paid_sales || 0),
      unpaidPending: Number(summary.unpaid_pending || 0),
      orderCount: Number(summary.order_count || 0),
      billCount: Number(summary.bill_count || 0),
      averageBill: Number(summary.average_bill || 0),
    },
    topMenuItems: (topItemsResult.rows || []).map((row: any) => ({
      name: row.name,
      quantity: Number(row.quantity || 0),
      revenue: Number(row.revenue || 0),
    })),
    openTables: openTablesResult.rows || [],
    cancelledRejectedOrders: (cancelledRejectedResult.rows || []).map((row: any) => ({
      ...row,
      total: Number(row.total || 0),
    })),
  };
}

export const Reportcontroller = {
  dailyClosing: async (
    context: Context & { query?: { date?: string }; jwt?: any },
  ) => {
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const date = resolveBangkokDate(context.query?.date);
    const report = await buildDailyClosingReport(scope.restaurantId, date);
    return { report };
  },

  dailyClosingCsv: async (
    context: Context & { query?: { date?: string }; set: Context["set"]; jwt?: any },
  ) => {
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const date = resolveBangkokDate(context.query?.date);
    const report = await buildDailyClosingReport(scope.restaurantId, date);
    context.set.headers["Content-Type"] = "text/csv; charset=utf-8";
    context.set.headers["Content-Disposition"] =
      `attachment; filename="daily-closing-${date}.csv"`;
    return toCsv(report);
  },
};
