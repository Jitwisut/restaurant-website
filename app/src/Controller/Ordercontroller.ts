import { Context } from "elysia";
import { getDB } from "../lib/connect";
import { requireRole } from "../middleware/restaurantScope";

const db = getDB();

export const Orderscontroller = {
  orderhistory: async (
    context: Context & {
      body: { table_number?: Number };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, [
      "admin",
      "owner",
      "staff",
      "kitchen",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const tablenumber = body.table_number;
    const params: unknown[] = [scope.restaurantId];
    let tableFilter = "";

    if (tablenumber) {
      params.push(tablenumber);
      tableFilter = "AND o.table_number = $2";
    }

    const result = await db.query(
      `SELECT
        o.table_number,
        o.id,
        o.status,
        o.created_at,
        s.session_id,
        s.opened_at,
        s.closed_at,
        COALESCE(
          json_agg(
            json_build_object(
              'menu_item_name', oi.menu_item_name,
              'quantity', oi.quantity,
              'price', oi.price
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) as items,
        COALESCE(SUM(oi.quantity * oi.price::numeric), 0) as total
      FROM orders o
      LEFT JOIN sessions s
        ON o.customer_session = s.session_id
       AND s.restaurant_id = o.restaurant_id
      LEFT JOIN order_items oi
        ON o.id = oi.order_id
       AND oi.restaurant_id = o.restaurant_id
      WHERE o.restaurant_id = $1
      ${tableFilter}
      GROUP BY o.table_number, o.id, o.status, o.created_at,
               s.session_id, s.opened_at, s.closed_at
      ORDER BY o.created_at DESC
      LIMIT 100`,
      params,
    );

    return { order: result.rows };
  },
};
