import { Context } from "elysia";
import { db } from "../lib/connect";
export const Orderscontroller = {
  orderhistory: async ({
    set,
    body,
  }: {
    set: Context["set"];
    params: Context["params"];
    body: { table_number: Number };
  }) => {
    const tablenumber = body.table_number;
    if (!tablenumber) {
      set.status = 404;
      return { message: "No table number" };
    }
    const result = await db.query(` SELECT 
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
    LEFT JOIN sessions s ON o.customer_session = s.session_id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    GROUP BY o.table_number, o.id, o.status, o.created_at,
             s.session_id, s.opened_at, s.closed_at
    ORDER BY o.created_at DESC
    LIMIT 100`);
    console.log("order", result.rows);
    return { order: result.rows };
  },
};
