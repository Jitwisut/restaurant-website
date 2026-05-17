import { Elysia, t } from "elysia";
import type { ServerWebSocket } from "bun";
import { UUID } from "crypto";
import { getDB } from "../lib/connect";
import {
  buildGuestSessionUsername,
  findActiveSessionByHash,
  GUEST_SESSION_TOKEN_TYPE,
  isGuestSessionPayload,
} from "../lib/guestSession";
import {
  getRestaurantSubscriptionSnapshot,
  isSubscriptionBlocked,
} from "../lib/subscription";
import {
  getRestaurantStatusById,
  normalizeRestaurantId,
} from "../middleware/restaurantScope";
import {
  getRestaurantSettings,
  isWithinBusinessHours,
} from "../lib/restaurantSettings";

const db = getDB();

type Role = "user" | "kitchen" | "admin";
type JwtRole = Role | "owner" | "staff" | "superadmin";

type MsgPing = { type: "ping" };
type MsgMessage = { type: "message"; to: string; content: string };
type MsgOrder = {
  type: "order";
  menu: unknown;
  table_number?: number | string;
  session: UUID;
};
type MsgOrderStatus = {
  type: "order_status";
  to: string;
  order_id: string;
  status: "accepted" | "preparing" | "done" | "ready" | "rejected";
};
type MsgCallStaff = {
  type: "call_staff";
  table_number: number | string;
};
type IncomingMsg =
  | MsgPing
  | MsgMessage
  | MsgOrder
  | MsgCallStaff
  | MsgOrderStatus
  | { type: string };

const sockets = new Map<string, Record<Role, Map<string, ServerWebSocket<any>>>>();

function getRestaurantSockets(restaurantId: string) {
  if (!sockets.has(restaurantId)) {
    sockets.set(restaurantId, {
      user: new Map(),
      kitchen: new Map(),
      admin: new Map(),
    });
  }
  return sockets.get(restaurantId)!;
}

interface Client {
  ws: ServerWebSocket;
  role: Role;
  jwt_role: JwtRole;
  restaurant_id: string;
  username: string;
  session_id?: string;
  table_number?: string;
  token_type?: string;
}

const clients = new Map<string, Client>();
const lastSeen = new Map<string, string>();
const td = new TextDecoder();

function clientKey(restaurantId: string, username: string) {
  return `${restaurantId}:${username}`;
}

function getClient(restaurantId: string, username: string) {
  return clients.get(clientKey(restaurantId, username));
}

export function getRestaurantPresence(restaurantId: string | number) {
  const prefix = `${restaurantId}:`;
  const active = new Set(
    Array.from(clients.keys())
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length)),
  );
  const seen = new Map(
    Array.from(lastSeen.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );

  return { active, seen };
}

function mapJwtRoleToSocketRole(role: JwtRole): Role {
  if (role === "owner" || role === "staff" || role === "superadmin") {
    return "admin";
  }
  return role;
}

function isKnownJwtRole(role: unknown): role is JwtRole {
  return ["user", "kitchen", "admin", "owner", "staff", "superadmin"].includes(
    String(role),
  );
}

async function validateTable(
  tableNumber: number,
  restaurantId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await db.query(
    `SELECT table_number, status
       FROM tables
      WHERE table_number = $1
        AND restaurant_id = $2
        AND customer_session::text = $3`,
    [tableNumber, restaurantId, sessionId],
  );

  if (result.rows.length === 0) return false;
  return result.rows[0].status === "open";
}

async function validateGuestSocketPayload(payload: any) {
  if (!isGuestSessionPayload(payload)) return false;

  const session = await findActiveSessionByHash(db, payload.session_id);
  if (!session) return false;

  return (
    session.restaurant_status === "active" &&
    session.status === "open" &&
    !session.closed_at &&
    String(normalizeRestaurantId(payload.restaurant_id)) ===
      String(normalizeRestaurantId(session.restaurant_id)) &&
    String(payload.table_number) === String(session.table_number)
  );
}

async function generateOrderId(restaurantId: string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePrefix = `${year}${month}${day}`;

  try {
    const result = await db.query(
      `SELECT id
         FROM orders
        WHERE id LIKE $1
          AND restaurant_id = $2
        ORDER BY id DESC
        LIMIT 1`,
      [`ORD-${datePrefix}-%`, restaurantId],
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const parts = String(result.rows[0].id).split("-");
      sequence = Number.parseInt(parts[2], 10) + 1;
    }

    return `ORD-${datePrefix}-${String(sequence).padStart(3, "0")}`;
  } catch (err) {
    console.error("Error generating order id:", err);
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}

async function saveOrderToDb(order: {
  id: string;
  menu: any;
  table_number: number;
  restaurant_id: string;
  session?: UUID;
}) {
  try {
    const settingsPayload = await getRestaurantSettings(Number(order.restaurant_id));
    const orderSettings = settingsPayload?.settings?.order_settings || {};
    const serviceChargeRate =
      Number(orderSettings.serviceChargePercent || 0) / 100;
    const taxRate = Number(orderSettings.taxPercent || 0) / 100;
    const items = order.menu?.items;
    const subtotal = Array.isArray(items)
      ? items.reduce(
          (sum: number, item: any) =>
            sum + Number(item.price || 0) * Number(item.qty || 0),
          0,
        )
      : 0;
    const serviceChargeAmount = Number((subtotal * serviceChargeRate).toFixed(2));
    const taxAmount = Number(
      ((subtotal + serviceChargeAmount) * taxRate).toFixed(2),
    );
    const grandTotal = subtotal + serviceChargeAmount + taxAmount;

    await db.query("BEGIN");
    await db.query(
      `INSERT INTO orders
        (id, table_number, customer_session, status, updated_at, restaurant_id,
         subtotal, service_charge_amount, tax_amount, grand_total)
       VALUES ($1, $2, $3, 'pending', NOW(), $4, $5, $6, $7, $8)`,
      [
        order.id,
        order.table_number,
        order.session,
        order.restaurant_id,
        subtotal,
        serviceChargeAmount,
        taxAmount,
        grandTotal,
      ],
    );

    if (Array.isArray(items)) {
      for (const item of items) {
        await db.query(
          `INSERT INTO order_items
            (order_id, menu_item_name, quantity, price, notes, restaurant_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            order.id,
            item.name,
            item.qty,
            item.price,
            item.notes || null,
            order.restaurant_id,
          ],
        );
      }
    }

    await db.query("COMMIT");
    return true;
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error saving order:", (err as Error).message);
    return false;
  }
}

async function getOrderSnapshot(restaurantId: string, orderId: string) {
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
      AND o.id = $2
    GROUP BY o.table_number, o.id, o.status, o.created_at,
             s.session_id, s.opened_at, s.closed_at
    LIMIT 1`,
    [restaurantId, orderId],
  );

  return result.rows?.[0] || null;
}

async function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  status: MsgOrderStatus["status"],
) {
  const normalizedStatus = status === "done" ? "ready" : status;
  const result = await db.query(
    `UPDATE orders
        SET status = $3,
            updated_at = NOW()
      WHERE restaurant_id = $1
        AND id = $2
      RETURNING id`,
    [restaurantId, orderId, normalizedStatus],
  );

  if (result.rowCount === 0) return null;
  return getOrderSnapshot(restaurantId, orderId);
}

export function notifyAdmins(restaurantId: string | number, payload: any) {
  const restSockets = getRestaurantSockets(String(restaurantId));
  Array.from(restSockets.admin.values()).forEach((adminWs) => {
    sendJSON(adminWs, payload);
  });
}

function safeParse(
  msg: unknown,
): { ok: true; data: any } | { ok: false; err: Error } {
  try {
    if (msg !== null && typeof msg === "object" && !(msg instanceof Uint8Array)) {
      return { ok: true, data: msg };
    }

    const text =
      typeof msg === "string"
        ? msg
        : msg instanceof Uint8Array
          ? td.decode(msg)
          : String(msg);

    return { ok: true, data: JSON.parse(text) };
  } catch (err: any) {
    return { ok: false, err };
  }
}

function sendJSON(ws: ServerWebSocket, obj: any) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (err) {
    console.error("[WS SEND ERROR]", err);
  }
}

function preview(val: unknown, max = 300) {
  try {
    const rendered =
      typeof val === "string"
        ? val
        : val instanceof Uint8Array
          ? td.decode(val)
          : JSON.stringify(val);
    return rendered.length > max ? `${rendered.slice(0, max)}…` : rendered;
  } catch {
    return String(val);
  }
}

function ensureCallStaff(x: any): x is MsgCallStaff {
  return (
    x?.type === "call_staff" &&
    (typeof x?.table_number === "string" || typeof x?.table_number === "number")
  );
}

function ensureMessage(x: any): x is MsgMessage {
  return typeof x?.to === "string" && typeof x?.content === "string";
}

function ensureOrder(x: any): x is MsgOrder {
  return typeof x?.menu !== "undefined";
}

function ensureOrderStatus(x: any): x is MsgOrderStatus {
  return (
    typeof x?.to === "string" &&
    typeof x?.order_id === "string" &&
    ["accepted", "preparing", "done", "ready", "rejected"].includes(x?.status)
  );
}

async function resolvePayload(ws: any) {
  const token = ws.data.query.token;
  const jwt = ws.data.jwt;
  if (!token || !jwt) return null;

  try {
    return await jwt.verify(token);
  } catch {
    return null;
  }
}

export const web = (app: Elysia) => {
  return app.ws("/ws/:user", {
    query: t.Object({
      role: t.Union(
        [t.Literal("user"), t.Literal("kitchen"), t.Literal("admin")],
        { default: "user" },
      ),
      restaurant_id: t.Optional(t.String()),
      token: t.Optional(t.String()),
    }),

    async open(ws) {
      const payload = await resolvePayload(ws as any);
      if (!payload) {
        sendJSON((ws as any).raw, {
          type: "error",
          message: "Unauthorized websocket connection",
        });
        (ws as any).raw.close(1008, "Unauthorized");
        return;
      }

      if (
        isGuestSessionPayload(payload) &&
        !(await validateGuestSocketPayload(payload))
      ) {
        sendJSON((ws as any).raw, {
          type: "error",
          message: "Guest session is not active",
        });
        (ws as any).raw.close(1008, "Inactive session");
        return;
      }

      const username = String(payload.username);
      if (!username || !isKnownJwtRole(payload.role)) {
        sendJSON((ws as any).raw, {
          type: "error",
          message: "Invalid websocket token payload",
        });
        (ws as any).raw.close(1008, "Invalid token payload");
        return;
      }

      const jwtRole = payload.role as JwtRole;
      const role = mapJwtRoleToSocketRole(jwtRole);
      const restaurantId = String(normalizeRestaurantId(payload.restaurant_id));

      if (jwtRole !== "superadmin") {
        const restaurantStatus = await getRestaurantStatusById(restaurantId);
        if (restaurantStatus !== "active") {
          sendJSON((ws as any).raw, {
            type: "error",
            message: "Restaurant is suspended",
          });
          (ws as any).raw.close(1008, "Suspended restaurant");
          return;
        }

        const subscription = await getRestaurantSubscriptionSnapshot(
          restaurantId,
        );
        if (subscription && isSubscriptionBlocked(subscription.status)) {
          sendJSON((ws as any).raw, {
            type: "error",
            message: "Subscription is inactive",
          });
          (ws as any).raw.close(4002, "subscription_inactive");
          return;
        }
      }

      const restSockets = getRestaurantSockets(restaurantId);
      restSockets[role].set(username, (ws as any).raw);

      clients.set(clientKey(restaurantId, username), {
        ws: (ws as any).raw,
        role,
        jwt_role: jwtRole,
        restaurant_id: restaurantId,
        username,
        session_id:
          typeof payload.session_id === "string" ? payload.session_id : undefined,
        table_number:
          typeof payload.table_number !== "undefined"
            ? String(payload.table_number)
            : undefined,
        token_type:
          typeof payload.token_type === "string" ? payload.token_type : undefined,
      });

      ws.subscribe(clientKey(restaurantId, username));
      sendJSON(ws as any, {
        type: "system",
        message: `เชื่อมต่อสำเร็จในชื่อ ${username} (Role: ${role}, Restaurant: ${restaurantId})`,
      });
    },

    async message(ws, msg) {
      const payload = await resolvePayload(ws as any);
      if (!payload || !isKnownJwtRole(payload.role)) {
        sendJSON(ws as any, {
          type: "error",
          message: "Unauthorized websocket message",
        });
        (ws as any).raw?.close?.(1008, "Unauthorized");
        return;
      }

      const username = String(payload.username);
      const restaurantId = payload
        ? String(normalizeRestaurantId(payload.restaurant_id))
        : "";
      const sender = restaurantId ? getClient(restaurantId, username) : undefined;

      if (!sender) {
        sendJSON(ws as any, {
          type: "error",
          message: "ไม่พบผู้ใช้หรือไม่ได้เชื่อมต่อ",
        });
        return;
      }

      console.log(
        `[WS IN] user=${username} role=${sender.role} typeof=${typeof msg} raw=${preview(msg)}`,
      );

      const parsed = safeParse(msg);
      if (!parsed.ok) {
        sendJSON(ws as any, {
          type: "error",
          message: "ข้อความต้องเป็น JSON ที่ถูกต้อง",
        });
        return;
      }

      const data: IncomingMsg = parsed.data;
      if (!data || typeof (data as any).type !== "string") {
        sendJSON(ws as any, {
          type: "error",
          message: "ข้อความต้องมี type และโครงสร้างที่ถูกต้อง",
        });
        return;
      }

      await routeMessage({ ws: ws as any, username, sender }, data);
    },

    async close(ws) {
      const payload = await resolvePayload(ws as any);
      if (!payload) return;

      const username = String(payload.username);
      const restaurantId = payload
        ? String(normalizeRestaurantId(payload.restaurant_id))
        : "";
      const client = restaurantId ? getClient(restaurantId, username) : undefined;

      if (client) {
        const restSockets = getRestaurantSockets(client.restaurant_id);
        restSockets[client.role].delete(username);
        clients.delete(clientKey(client.restaurant_id, username));
        lastSeen.set(clientKey(client.restaurant_id, username), new Date().toISOString());
      }
    },
  });
};

async function routeMessage(
  ctx: { ws: ServerWebSocket; username: string; sender: Client },
  msg: IncomingMsg,
) {
  const { ws, username, sender } = ctx;
  const restSockets = getRestaurantSockets(sender.restaurant_id);

  switch (msg.type) {
    case "ping": {
      sendJSON(ws, { type: "pong", ts: Date.now() });
      return;
    }

    case "message": {
      if (!ensureMessage(msg)) {
        sendJSON(ws, {
          type: "error",
          message: "message ต้องมี to และ content เป็นสตริง",
        });
        return;
      }

      const recipient = getClient(sender.restaurant_id, msg.to);
      if (!recipient || recipient.restaurant_id !== sender.restaurant_id) {
        sendJSON(ws, {
          type: "error",
          message: `ไม่พบผู้ใช้ ${msg.to} หรือไม่ได้เชื่อมต่อ`,
        });
        return;
      }

      sendJSON(recipient.ws, {
        type: "message",
        from: username,
        content: msg.content,
        timestamp: new Date().toISOString(),
      });

      sendJSON(ws, {
        type: "system",
        message: `ส่งข้อความถึง ${msg.to} แล้ว`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    case "order": {
      if (sender.jwt_role !== "superadmin") {
        const restaurantStatus = await getRestaurantStatusById(sender.restaurant_id);
        if (restaurantStatus !== "active") {
          sendJSON(ws, {
            type: "error",
            message: "Restaurant is suspended",
          });
          return;
        }

        const subscription = await getRestaurantSubscriptionSnapshot(
          sender.restaurant_id,
        );
        if (subscription && isSubscriptionBlocked(subscription.status)) {
          sendJSON(ws, {
            type: "error",
            message: "Subscription is inactive",
          });
          return;
        }
      }
      const settingsPayload = await getRestaurantSettings(
        Number(sender.restaurant_id),
      );
      if (settingsPayload?.settings?.danger_zone?.temporaryClosed) {
        sendJSON(ws, {
          type: "error",
          message: "Restaurant is temporarily closed",
        });
        return;
      }
      const businessHours = isWithinBusinessHours(settingsPayload?.settings);
      if (!businessHours.open) {
        sendJSON(ws, {
          type: "error",
          message: businessHours.reason || "Restaurant is closed",
        });
        return;
      }

      if (sender.role !== "user") {
        sendJSON(ws, {
          type: "error",
          message: "เฉพาะ role=user เท่านั้นที่ส่ง order ได้",
        });
        return;
      }

      if (!ensureOrder(msg)) {
        sendJSON(ws, { type: "error", message: "order ต้องมี menu" });
        return;
      }

      if (!msg.table_number || !msg.session) {
        sendJSON(ws, {
          type: "error",
          message: "order must include table_number and session",
        });
        return;
      }

      if (sender.token_type === GUEST_SESSION_TOKEN_TYPE) {
        if (
          sender.session_id !== String(msg.session) ||
          sender.table_number !== String(msg.table_number)
        ) {
          sendJSON(ws, {
            type: "error",
            message: "Guest token can only order for its own table session",
          });
          return;
        }
      }

      const tableNumber = Number.parseInt(String(msg.table_number), 10);
      const isValidTable = await validateTable(
        tableNumber,
        sender.restaurant_id,
        String(msg.session),
      );
      if (!isValidTable) {
        sendJSON(ws, {
          type: "error",
          message: "Table session is not valid for this restaurant",
        });
        return;
      }
      const kitchenClients = Array.from(restSockets.kitchen.values());
      if (kitchenClients.length === 0) {
        sendJSON(ws, {
          type: "error",
          message: "ไม่พบครัวที่เชื่อมต่ออยู่",
        });
        return;
      }

      const orderId = await generateOrderId(sender.restaurant_id);
      const saved = await saveOrderToDb({
        id: orderId,
        menu: msg.menu,
        session: msg.session,
        table_number: tableNumber,
        restaurant_id: sender.restaurant_id,
      });
      if (!saved) {
        sendJSON(ws, {
          type: "error",
          message: "Unable to save order. Please try again.",
        });
        return;
      }

      const orderSnapshot = await getOrderSnapshot(sender.restaurant_id, orderId);
      kitchenClients.forEach((kitchenWs) => {
        sendJSON(kitchenWs, {
          type: "order",
          order_id: orderId,
          from: username,
          menu: msg.menu,
          session: msg.session,
          status: orderSnapshot?.status || "pending",
          table_number: msg.table_number,
          timestamp: orderSnapshot?.created_at || new Date().toISOString(),
        });
      });
      if (orderSnapshot) {
        notifyAdmins(sender.restaurant_id, {
          type: "order_created",
          order: orderSnapshot,
          timestamp: new Date().toISOString(),
        });
      }

      sendJSON(ws, {
        type: "system",
        message: "ส่งคำสั่งอาหารไปยังครัวแล้ว",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    case "order_status": {
      if (sender.role !== "kitchen" && sender.role !== "admin") {
        sendJSON(ws, {
          type: "error",
          message: "Only kitchen or admin clients can update order status",
        });
        return;
      }

      if (!ensureOrderStatus(msg)) {
        sendJSON(ws, {
          type: "error",
          message:
            "order_status ต้องมี to, order_id และ status (accepted|preparing|done|ready|rejected)",
        });
        return;
      }

      let orderSnapshot = null;
      try {
        orderSnapshot = await updateOrderStatus(
          sender.restaurant_id,
          msg.order_id,
          msg.status,
        );
      } catch (err) {
        console.error("order_status update error:", (err as Error).message);
        sendJSON(ws, {
          type: "error",
          message: "Unable to update order status. Please try again.",
        });
        return;
      }

      if (!orderSnapshot) {
        sendJSON(ws, {
          type: "error",
          message: "Order was not found for this restaurant",
        });
        return;
      }

      const recipient = getClient(sender.restaurant_id, msg.to);
      if (!recipient || recipient.restaurant_id !== sender.restaurant_id) {
        sendJSON(ws, {
          type: "system",
          message: `Order status saved, but ${msg.to} is not connected`,
        });
      } else {
        sendJSON(recipient.ws, {
          type: "order_status",
          from: username,
          order_id: msg.order_id,
          status: msg.status,
          timestamp: new Date().toISOString(),
        });
      }

      if (orderSnapshot) {
        notifyAdmins(sender.restaurant_id, {
          type: "order_updated",
          order: orderSnapshot,
          order_id: msg.order_id,
          status: orderSnapshot.status,
          kitchen_status: msg.status,
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }

    case "call_staff": {
      if (sender.jwt_role !== "superadmin") {
        const restaurantStatus = await getRestaurantStatusById(sender.restaurant_id);
        if (restaurantStatus !== "active") {
          sendJSON(ws, {
            type: "error",
            message: "Restaurant is suspended",
          });
          return;
        }

        const subscription = await getRestaurantSubscriptionSnapshot(
          sender.restaurant_id,
        );
        if (subscription && isSubscriptionBlocked(subscription.status)) {
          sendJSON(ws, {
            type: "error",
            message: "Subscription is inactive",
          });
          return;
        }
      }

      if (!ensureCallStaff(msg)) {
        sendJSON(ws, {
          type: "error",
          message: "call_staff ต้องมี table_number",
        });
        return;
      }

      if (sender.token_type === GUEST_SESSION_TOKEN_TYPE) {
        if (!sender.session_id || sender.table_number !== String(msg.table_number)) {
          sendJSON(ws, {
            type: "error",
            message: "Guest token can only call staff for its own table",
          });
          return;
        }

        const isValidTable = await validateTable(
          Number.parseInt(String(msg.table_number), 10),
          sender.restaurant_id,
          sender.session_id,
        );
        if (!isValidTable) {
          sendJSON(ws, {
            type: "error",
            message: "Table session is not valid for this restaurant",
          });
          return;
        }
      }

      const adminEntries = Array.from(restSockets.admin.values());
      if (adminEntries.length === 0) {
        sendJSON(ws, {
          type: "error",
          message: "ไม่พบผู้ดูแลหรือพนักงานที่เชื่อมต่ออยู่",
        });
        return;
      }

      adminEntries.forEach((adminWs) => {
        sendJSON(adminWs, {
          type: "call_staff",
          from: username,
          table_number: msg.table_number,
          timestamp: new Date().toISOString(),
        });
      });

      sendJSON(ws, {
        type: "system",
        message: "เรียกพนักงานแล้ว รอสักครู่...",
      });
      return;
    }

    default: {
      sendJSON(ws, {
        type: "error",
        message: "Unsupported websocket message type",
      });
    }
  }
}

export const notifyTableClosed = (sessionHash: string) => {
  const matchedClients = Array.from(clients.values()).filter(
    (entry) =>
      entry.session_id === sessionHash ||
      entry.username === buildGuestSessionUsername(sessionHash),
  );

  if (matchedClients.length > 0) {
    matchedClients.forEach((client) => {
      if (!client?.ws) return;

      sendJSON(client.ws, {
        type: "table_closed",
        message: "Table has been closed by staff",
      });

      try {
        client.ws.close(4001, "table_closed");
      } catch (err) {
        console.error("[WS CLOSE ERROR]", err);
      }
    });
    return true;
  }

  return false;
};
