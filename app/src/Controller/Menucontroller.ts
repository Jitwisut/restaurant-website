import { Context } from "elysia";
import { getDB } from "../lib/connect";
import { findActiveSessionByHash } from "../lib/guestSession";
import {
  getRestaurantSubscriptionSnapshot,
  isSubscriptionBlocked,
} from "../lib/subscription";
import { requireRole } from "../middleware/restaurantScope";
import {
  getRestaurantSettings,
  isWithinBusinessHours,
} from "../lib/restaurantSettings";

const db = getDB();

function serializeMenu(rows: any[]) {
  return rows.map((row: any) => {
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
  });
}

export const menucontroller = {
  getmenu: async (context: Context & { jwt?: any }) => {
    const scope = await requireRole(context, [
      "user",
      "staff",
      "kitchen",
      "admin",
      "owner",
      "superadmin",
    ]);
    if (!scope.ok) return scope.response;

    const result = await db.query(
      "SELECT * FROM menu_new WHERE restaurant_id=$1 ORDER BY category ASC, name ASC",
      [scope.restaurantId],
    );

    return { menu: serializeMenu(result.rows) };
  },

  getSessionMenu: async (
    context: Context & {
      params: { session: string };
    },
  ) => {
    const { set, params } = context;
    const sessionId = params.session;

    if (!sessionId) {
      set.status = 400;
      return { message: "Session not found" };
    }

    const session = await findActiveSessionByHash(db, sessionId);
    if (!session) {
      set.status = 404;
      return { message: "Table session not found" };
    }

    if (
      session.restaurant_status !== "active" ||
      session.status !== "open" ||
      session.closed_at
    ) {
      set.status = 403;
      return { message: "Table session is not active" };
    }

    const subscription = await getRestaurantSubscriptionSnapshot(
      session.restaurant_id,
    );
    if (subscription && isSubscriptionBlocked(subscription.status)) {
      set.status = 403;
      return { message: "Restaurant subscription is inactive" };
    }

    const settingsPayload = await getRestaurantSettings(Number(session.restaurant_id));
    if (settingsPayload?.settings?.danger_zone?.temporaryClosed) {
      set.status = 403;
      return { message: "Restaurant is temporarily closed" };
    }
    const businessHours = isWithinBusinessHours(settingsPayload?.settings);
    if (!businessHours.open) {
      set.status = 403;
      return { message: businessHours.reason || "Restaurant is closed" };
    }

    const hideUnavailable =
      settingsPayload?.settings?.menu_settings?.hideUnavailableFromQr !== false;
    const result = await db.query(
      `SELECT *
         FROM menu_new
        WHERE restaurant_id=$1
          AND ($2::boolean = false OR is_available = true)
        ORDER BY category ASC, name ASC`,
      [session.restaurant_id, hideUnavailable],
    );

    return {
      menu: serializeMenu(result.rows),
      settings: {
        profile: settingsPayload?.settings?.profile || {},
        order_settings: settingsPayload?.settings?.order_settings || {},
        table_qr_settings: settingsPayload?.settings?.table_qr_settings || {},
        menu_settings: settingsPayload?.settings?.menu_settings || {},
        notification_settings:
          settingsPayload?.settings?.notification_settings || {},
      },
      table: {
        table_number: session.table_number,
        customer_session: session.session_id,
        restaurant_id: session.restaurant_id,
      },
    };
  },
};
