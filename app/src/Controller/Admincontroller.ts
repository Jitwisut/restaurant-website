import { Context } from "elysia";
import bcryptjs from "bcryptjs";
import { ensureSalesSchema, getDB } from "../lib/connect";
import { requireRole } from "../middleware/restaurantScope";
import { writeSuperadminAudit } from "../lib/superadminAudit";
import { getRestaurantPresence } from "../router/websocket";

const db = getDB();

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return fallback;
}

function serializeMenuRow(row: any) {
  const base64 = row.image_blob
    ? Buffer.from(row.image_blob).toString("base64")
    : null;

  return {
    id: row.id,
    name: row.name,
    price: row.price,
    category: row.category,
    description: row.description,
    ingredients: row.ingredients || null,
    isAvailable: row.is_available !== false,
    image: base64
      ? `data:${row.image_mime || "image/jpeg"};base64,${base64}`
      : null,
  };
}

async function getActorUserId(email?: string | null) {
  if (!email) return null;
  const result = await db.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [
    email,
  ]);
  return result.rows?.[0]?.id || null;
}

async function writeAdminAudit(scope: any, action: string, input: {
  targetUserId?: number | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await writeSuperadminAudit({
    actorUserId: await getActorUserId(scope.payload?.email),
    actorEmail: scope.payload?.email || null,
    restaurantId: scope.restaurantId,
    targetUserId: input.targetUserId || null,
    action,
    oldValue: input.oldValue,
    newValue: input.newValue,
  });
}

export const Admincontroller = {
  analytics: async (
    context: Context & {
      query?: { days?: string };
      jwt?: any;
    },
  ) => {
    const { set, query } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const parsedDays = Number.parseInt(query?.days || "7", 10);
    const days = Number.isFinite(parsedDays)
      ? Math.min(Math.max(parsedDays, 1), 90)
      : 7;

    try {
      await ensureSalesSchema();

      const summaryResult = await db.query(
        `WITH paid_orders AS (
           SELECT grand_total
             FROM orders
            WHERE restaurant_id = $1
              AND status = 'completed'
              AND payment_status = 'paid'
              AND paid_at IS NOT NULL
              AND refunded_at IS NULL
              AND voided_at IS NULL
              AND paid_at::date >= (CURRENT_DATE - ($2::int - 1))
        )
         SELECT
           COALESCE(SUM(grand_total), 0) AS total_revenue,
           COUNT(*)::int AS order_count,
           COALESCE(AVG(grand_total), 0) AS avg_order_value,
           COALESCE(MAX(grand_total), 0) AS best_order_value
         FROM paid_orders`,
        [scope.restaurantId, days],
      );

      const salesSeriesResult = await db.query(
        `WITH days AS (
           SELECT generate_series(
             (CURRENT_DATE - ($2::int - 1)),
             CURRENT_DATE,
             '1 day'::interval
           )::date AS sale_date
         ),
         paid_daily AS (
           SELECT
             paid_at::date AS sale_date,
             COALESCE(SUM(grand_total), 0) AS revenue,
             COUNT(*)::int AS order_count
           FROM orders o
           WHERE o.restaurant_id = $1
             AND o.status = 'completed'
             AND o.payment_status = 'paid'
             AND o.paid_at IS NOT NULL
             AND o.refunded_at IS NULL
             AND o.voided_at IS NULL
             AND o.paid_at::date >= (CURRENT_DATE - ($2::int - 1))
           GROUP BY o.paid_at::date
         )
         SELECT
           TO_CHAR(days.sale_date, 'YYYY-MM-DD') AS date,
           COALESCE(paid_daily.revenue, 0) AS revenue,
           COALESCE(paid_daily.order_count, 0) AS order_count
         FROM days
         LEFT JOIN paid_daily
           ON paid_daily.sale_date = days.sale_date
         ORDER BY days.sale_date ASC`,
        [scope.restaurantId, days],
      );

      const topItemsResult = await db.query(
        `SELECT
           oi.menu_item_name,
           SUM(oi.quantity)::int AS quantity,
           COALESCE(SUM(oi.quantity * oi.price::numeric), 0) AS revenue
         FROM order_items oi
         INNER JOIN orders o
           ON o.id = oi.order_id
          AND o.restaurant_id = oi.restaurant_id
         WHERE oi.restaurant_id = $1
           AND o.status = 'completed'
           AND o.payment_status = 'paid'
           AND o.paid_at IS NOT NULL
           AND o.refunded_at IS NULL
           AND o.voided_at IS NULL
           AND o.paid_at::date >= (CURRENT_DATE - ($2::int - 1))
         GROUP BY oi.menu_item_name
         ORDER BY revenue DESC, quantity DESC, oi.menu_item_name ASC
         LIMIT 5`,
        [scope.restaurantId, days],
      );

      const openTablesResult = await db.query(
        `SELECT COUNT(*)::int AS open_tables
           FROM tables
          WHERE restaurant_id = $1
            AND status = 'open'`,
        [scope.restaurantId],
      );

      const summary = summaryResult.rows?.[0] || {};

      set.status = 200;
      return {
        summary: {
          totalRevenue: Number.parseFloat(summary.total_revenue || "0"),
          orderCount: Number(summary.order_count || 0),
          avgOrderValue: Number.parseFloat(summary.avg_order_value || "0"),
          bestOrderValue: Number.parseFloat(summary.best_order_value || "0"),
          openTables: Number(openTablesResult.rows?.[0]?.open_tables || 0),
        },
        salesSeries: (salesSeriesResult.rows || []).map((row: any) => ({
          date: row.date,
          revenue: Number.parseFloat(row.revenue || "0"),
          orderCount: Number(row.order_count || 0),
        })),
        topItems: (topItemsResult.rows || []).map((row: any) => ({
          name: row.menu_item_name,
          quantity: Number(row.quantity || 0),
          revenue: Number.parseFloat(row.revenue || "0"),
        })),
        range: {
          days,
          timezone: "Asia/Bangkok",
          basis: "paid_completed_orders",
        },
      };
    } catch (error) {
      console.error("Error in analytics:", error);
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  getalluser: async (context: Context & { jwt?: any }) => {
    const { set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    try {
      const result = await db.query(
        "SELECT * FROM users WHERE restaurant_id=$1",
        [scope.restaurantId],
      );
      const usersRaw = result.rows;

      if (!Array.isArray(usersRaw)) {
        throw new Error("Query result is not an array");
      }

      const users = usersRaw as { role: string }[];
      const presence = getRestaurantPresence(scope.restaurantId);
      const usersWithPresence = usersRaw.map((user: any) => ({
        ...user,
        online_status: presence.active.has(user.username) ? "active" : "offline",
        last_active_at: presence.active.has(user.username)
          ? new Date().toISOString()
          : presence.seen.get(user.username) || null,
      }));
      const roles = users.reduce((acc: Record<string, number>, user) => {
        if (user.role) acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      set.status = 200;
      return {
        user: usersWithPresence,
        count: users.length,
        roles,
      };
    } catch (error) {
      console.error("Backend error:", (error as Error).message);
      set.status = 500;
      return {
        message: "Error fetching users",
        detail: (error as Error).message,
      };
    }
  },

  updateuser: async (
    context: Context & {
      body: { username: string; email: string; role: string; originuser: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    try {
      const { originuser, username, email, role } = body;
      const duplicateUsername = await db.query(
        `SELECT 1
           FROM users
          WHERE restaurant_id=$1
            AND username=$2
            AND username<>$3`,
        [scope.restaurantId, username, originuser],
      );
      if (duplicateUsername.rowCount > 0) {
        set.status = 400;
        return { message: "Username already exist in this restaurant" };
      }

      const duplicateEmail = await db.query(
        `SELECT 1
           FROM users
          WHERE LOWER(email)=LOWER($1)
            AND NOT (restaurant_id=$2 AND username=$3)`,
        [email, scope.restaurantId, originuser],
      );
      if (duplicateEmail.rowCount > 0) {
        set.status = 400;
        return { message: "Email already exist" };
      }

      const before = await db.query(
        "SELECT id, username, email, role FROM users WHERE username=$1 AND restaurant_id=$2",
        [originuser, scope.restaurantId],
      );
      const result = await db.query(
        "UPDATE users SET username=$1, email=$2, role=$3 WHERE username=$4 AND restaurant_id=$5 RETURNING id, username, email, role",
        [username, email.trim().toLowerCase(), role, originuser, scope.restaurantId],
      );

      if (result.rowCount === 0) {
        set.status = 404;
        return { message: "User not found in this restaurant" };
      }

      await writeAdminAudit(scope, "admin.user.updated", {
        targetUserId: result.rows[0].id,
        oldValue: before.rows[0] || null,
        newValue: result.rows[0],
      });

      set.status = 200;
      return { message: `Success update user ${username}` };
    } catch (error) {
      console.error("Error in updateuser:", error);
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  createuser: async (
    context: Context & {
      body: { username: string; email: string; password: string; role: string };
      jwt?: any;
    },
  ) => {
    const { set, body } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    if (!body.username || !body.email || !body.password || !body.role) {
      set.status = 400;
      return { message: "Please fill all field" };
    }

    try {
      const resultemail = await db.query(
        "SELECT email FROM users WHERE LOWER(email)=LOWER($1)",
        [body.email],
      );
      const user = await db.query(
        "SELECT * FROM users WHERE restaurant_id=$1 AND username=$2",
        [scope.restaurantId, body.username],
      );

      if (user.rowCount > 0) {
        set.status = 400;
        return { message: "Username already exist in this restaurant" };
      }
      if (resultemail.rowCount > 0) {
        set.status = 400;
        return { message: "Email already exist" };
      }

      const hashpass = await bcryptjs.hash(body.password, 10);
      const email = body.email.trim().toLowerCase();
      const result = await db.query(
        "INSERT INTO users (username,email,password,role,restaurant_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, email, role",
        [body.username, email, hashpass, body.role, scope.restaurantId],
      );

      if (result.rowCount > 0) {
        await writeAdminAudit(scope, "admin.user.created", {
          targetUserId: result.rows[0].id,
          newValue: result.rows[0],
        });
        set.status = 201;
        return { message: "Success create user" };
      }
    } catch (error) {
      set.status = 500;
      return { message: (error as Error).message };
    }
  },

  uploaddata: async (
    context: Context & {
      body: {
        name: string;
        price: string;
        image?: File;
        category: string;
        description: string;
        ingredients?: string;
        isAvailable?: string | boolean;
      };
      jwt?: any;
    },
  ) => {
    const { body, set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const { name, price, category, description } = body;
    const image = body.image as File;
    const hasImage = image && typeof image.arrayBuffer === "function";
    const buffer = hasImage ? new Uint8Array(await image.arrayBuffer()) : null;
    const imageMime = hasImage ? image.type : null;
    if (!name || !price) {
      set.status = 400;
      return { message: "Please Enter value" };
    }

    try {
      const result = await db.query(
        `INSERT INTO menu_new
          (name, price, image_blob, image_mime, category, description, ingredients, is_available, restaurant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, name, price, category, description, ingredients, is_available, image_blob, image_mime`,
        [
          name,
          price,
          buffer,
          imageMime,
          category || null,
          description || null,
          body.ingredients || null,
          parseBoolean(body.isAvailable, true),
          scope.restaurantId,
        ],
      );
      await writeAdminAudit(scope, "admin.menu.created", {
        newValue: serializeMenuRow(result.rows[0]),
      });
      return { message: "Success", menu: serializeMenuRow(result.rows[0]) };
    } catch (err) {
      console.error("error", err);
      set.status = 500;
      return { message: (err as Error).message };
    }
  },

  updateMenu: async (
    context: Context & {
      params: { id: string };
      body: {
        name: string;
        price: string;
        image?: File;
        category?: string;
        description?: string;
        ingredients?: string;
        isAvailable?: string | boolean;
      };
      jwt?: any;
    },
  ) => {
    const { body, params, set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      set.status = 400;
      return { message: "Invalid menu id" };
    }
    if (!body.name || !body.price) {
      set.status = 400;
      return { message: "Please Enter value" };
    }

    const before = await db.query(
      "SELECT * FROM menu_new WHERE id=$1 AND restaurant_id=$2",
      [id, scope.restaurantId],
    );
    if (before.rowCount === 0) {
      set.status = 404;
      return { message: "Menu item not found in this restaurant" };
    }

    const image = body.image as File;
    const hasImage = image && typeof image.arrayBuffer === "function" && image.size > 0;
    const buffer = hasImage ? new Uint8Array(await image.arrayBuffer()) : null;
    const imageMime = hasImage ? image.type : null;

    const result = await db.query(
      `UPDATE menu_new
          SET name=$1,
              price=$2,
              category=$3,
              description=$4,
              ingredients=$5,
              is_available=$6,
              image_blob=CASE WHEN $7::boolean THEN $8 ELSE image_blob END,
              image_mime=CASE WHEN $7::boolean THEN $9 ELSE image_mime END
        WHERE id=$10
          AND restaurant_id=$11
        RETURNING id, name, price, category, description, ingredients, is_available, image_blob, image_mime`,
      [
        body.name,
        body.price,
        body.category || null,
        body.description || null,
        body.ingredients || null,
        parseBoolean(body.isAvailable, true),
        hasImage,
        buffer,
        imageMime,
        id,
        scope.restaurantId,
      ],
    );

    await writeAdminAudit(scope, "admin.menu.updated", {
      oldValue: serializeMenuRow(before.rows[0]),
      newValue: serializeMenuRow(result.rows[0]),
    });

    set.status = 200;
    return { message: "Success update menu", menu: serializeMenuRow(result.rows[0]) };
  },

  deleteMenu: async (
    context: Context & {
      params: { id: string };
      jwt?: any;
    },
  ) => {
    const { params, set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      set.status = 400;
      return { message: "Invalid menu id" };
    }

    const result = await db.query(
      "DELETE FROM menu_new WHERE id=$1 AND restaurant_id=$2 RETURNING *",
      [id, scope.restaurantId],
    );
    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "Menu item not found in this restaurant" };
    }

    await writeAdminAudit(scope, "admin.menu.deleted", {
      oldValue: serializeMenuRow(result.rows[0]),
    });

    set.status = 200;
    return { message: "Success delete menu" };
  },

  deletedata: async (
    context: Context & {
      body: { username: string };
      jwt?: any;
    },
  ) => {
    const { body, set } = context;
    const scope = await requireRole(context, ["admin", "owner", "superadmin"]);
    if (!scope.ok) return scope.response;

    const { username } = body;
    if (!username) {
      set.status = 400;
      return { message: "Please Enter username" };
    }

    const result = await db.query(
      "DELETE FROM users WHERE username=$1 AND restaurant_id=$2 RETURNING id, username, email, role",
      [username, scope.restaurantId],
    );

    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "User not found in this restaurant" };
    }

    await writeAdminAudit(scope, "admin.user.deleted", {
      targetUserId: null,
      oldValue: result.rows[0],
    });

    set.status = 201;
    return { message: "Success Delete user" };
  },
};
