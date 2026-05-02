import { Elysia, t } from "elysia";
import type { ServerWebSocket } from "bun";
import { getDB } from "../lib/connect";
import { UUID } from "crypto";
import Redis from "ioredis"; // เพิ่ม Redis เข้ามา

const db = getDB();

// ================================
// SYSTEM DESIGN: Redis Setup
// สร้าง 2 Connection: ตัวนึงไว้อ่าน (Sub) ตัวนึงไว้เขียน (Pub)
// ================================
const redisPub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const redisSub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const CHANNELS = {
  MESSAGE: "ws:message",
  ORDER: "ws:order",
  ORDER_STATUS: "ws:order_status",
  CALL_STAFF: "ws:call_staff",
  TABLE_CLOSED: "ws:table_closed",
};

// ================================
// SECTION A — Types & Stores
// ================================
type Role = "user" | "kitchen" | "admin";

type MsgPing = { type: "ping" };
type MsgMessage = { type: "message"; to: string; content: string };
type MsgOrder = { type: "order"; menu: any; table_number?: number | string; session: UUID };
type MsgOrderStatus = { type: "order_status"; to: string; order_id: string; status: "accepted" | "preparing" | "done" | "rejected" };
type Msgcallstaff = { type: "call_staff"; table_number: number | string };
type IncomingMsg = MsgPing | MsgMessage | MsgOrder | Msgcallstaff | MsgOrderStatus | { type: string };

// ================================
// MULTI-TENANT ISOLATION
// ================================
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

interface Client { ws: ServerWebSocket; role: Role; restaurant_id: string; }
const clients = new Map<string, Client>();

// ================================
// SYSTEM DESIGN: Redis Subscriber
// คอยฟังข้อความจาก Server อื่นๆ แล้วเช็คว่าคนรับต่ออยู่กับเครื่องนี้ไหม
// ================================
Object.values(CHANNELS).forEach((ch) => redisSub.subscribe(ch));

redisSub.on("message", (channel, message) => {
  const payload = JSON.parse(message);
  const targetRestaurantId = payload.restaurant_id || "1";
  const restSockets = getRestaurantSockets(targetRestaurantId);

  if (channel === CHANNELS.MESSAGE || channel === CHANNELS.ORDER_STATUS) {
    // ถ้าผู้รับเป้าหมาย ต่ออยู่กับ Server เครื่องนี้พอดี ให้ส่งข้อมูลไปให้
    const targetClient = clients.get(payload.to);
    if (targetClient && targetClient.ws.readyState === 1 && targetClient.restaurant_id === targetRestaurantId) {
      sendJSON(targetClient.ws, payload);
    }
  } 
  else if (channel === CHANNELS.ORDER) {
    // Broadcast หา "ห้องครัว" ทุกจอ ที่ต่ออยู่กับ Server เครื่องนี้ของร้านนี้
    restSockets.kitchen.forEach((ws) => sendJSON(ws, payload));
  } 
  else if (channel === CHANNELS.CALL_STAFF) {
    // Broadcast หา "แอดมิน" ทุกจอ ที่ต่ออยู่กับ Server เครื่องนี้ของร้านนี้
    restSockets.admin.forEach((ws) => sendJSON(ws, payload));
  }
  else if (channel === CHANNELS.TABLE_CLOSED) {
    const targetClient = clients.get(payload.sessionHash);
    if (targetClient && targetClient.ws.readyState === 1) { // Maybe skip restaurant check for session as it's globally unique
      sendJSON(targetClient.ws, { type: "table_closed", message: "Table has been closed by staff" });
    }
  }
});

// ================================
// SECTION B — Helpers
// ================================
const td = new TextDecoder();

async function validateTable(tablesNumber: number): Promise<boolean> {
  const result = await db.query("SELECT tables_number,status FROM tables WHERE tables_number=$1");
  if (result.rows.length === 0) return false;
  return result.rows[0].status === "avaliable";
}

async function updateTableStatus(tableNumber: number, status: string) {
  await db.query("UPDATE tables SET status =$1, opened_at=NOW() WHERE tables_number=$2", [status, tableNumber]);
}

// ================================
// SYSTEM DESIGN FIX: Race Condition
// ใช้ Redis INCR รับประกันว่าไม่มีทางได้เลขซ้ำ แม้สั่งพร้อมกัน 1,000 โต๊ะ
// ================================
async function generateOrderId(): Promise<string> {
  const date = new Date();
  const datePrefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  
  const redisKey = `order_seq:${datePrefix}`;
  
  try {
    // INCR ทำงานแบบ Atomic ไม่มีทางขัดแย้งกัน
    const sequence = await redisPub.incr(redisKey);
    
    // ตั้งให้ Key นี้หมดอายุใน 24 ชั่วโมง จะได้ไม่เปลือง Memory Redis
    if (sequence === 1) {
      await redisPub.expire(redisKey, 86400); 
    }

    const sequenceStr = String(sequence).padStart(3, "0");
    const orderId = `ORD-${datePrefix}-${sequenceStr}`;
    console.log(`✅ Generated order ID via Redis: ${orderId}`);
    return orderId;

  } catch (err) {
    console.error("❌ Redis error generating ID, fallback to timestamp:", err);
    return `ORD-${datePrefix}-${Date.now()}`;
  }
}

async function Savetodb(order: { id: string; menu: any; table_number: number; session?: UUID }) {
  try {
    await db.query("BEGIN");
    await db.query(
      "INSERT INTO orders (id,table_number,customer_session,status,updated_at) VALUES ($1,$2,$3,'pending',NOW())",
      [order.id, order.table_number, order.session]
    );
    const items = order.menu.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        await db.query(
          `INSERT INTO order_items (order_id, menu_item_name, quantity, price, notes) VALUES ($1, $2, $3, $4, $5)`,
          [order.id, item.name, item.qty, item.price, item.notes || null]
        );
      }
    }
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error FROM Savetodb function", (err as Error).message);
  }
}

function safeParse(msg: unknown): { ok: true; data: any } | { ok: false; err: Error } {
  try {
    if (msg !== null && typeof msg === "object" && !(msg instanceof Uint8Array)) return { ok: true, data: msg };
    const text = typeof msg === "string" ? msg : msg instanceof Uint8Array ? td.decode(msg) : String(msg);
    return { ok: true, data: JSON.parse(text) };
  } catch (err: any) {
    return { ok: false, err };
  }
}

function sendJSON(ws: ServerWebSocket<any>, obj: any) {
  try { ws.send(JSON.stringify(obj)); } 
  catch (e) { console.error("[WS SEND ERROR]", e); }
}

function preview(val: unknown, max = 300) {
  try {
    const s = typeof val === "string" ? val : val instanceof Uint8Array ? td.decode(val) : JSON.stringify(val);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch { return String(val); }
}

function ensureCallStaff(x: any): x is Msgcallstaff { return x?.type === "call_staff" && (typeof x?.table_number === "string" || typeof x?.table_number === "number"); }
function ensureMessage(x: any): x is MsgMessage { return typeof x?.to === "string" && typeof x?.content === "string"; }
function ensureOrder(x: any): x is MsgOrder { return typeof x?.menu !== "undefined"; }
function ensureOrderStatus(x: any): x is MsgOrderStatus { return typeof x?.to === "string" && typeof x?.order_id === "string" && ["accepted", "preparing", "done", "rejected"].includes(x?.status); }

// ================================
// SECTION C — WS Route
// ================================
export const web = (app: Elysia) => {
  return app.ws("/ws/:user", {
    query: t.Object({
      role: t.Union([t.Literal("user"), t.Literal("kitchen"), t.Literal("admin")], { default: "user" }),
      restaurant_id: t.Optional(t.String()),
    }),

    open(ws) {
      const username = ws.data.params.user as string;
      const role = ws.data.query.role as Role;
      const restaurant_id = ws.data.query.restaurant_id || "1";

      const restSockets = getRestaurantSockets(restaurant_id);
      restSockets[role].set(username, (ws as any).raw);
      clients.set(username, { ws: (ws as any).raw, role, restaurant_id });
      ws.subscribe(username);
      
      sendJSON(ws as any, { type: "system", message: `เชื่อมต่อสำเร็จในชื่อ ${username} (Role: ${role}, Restaurant: ${restaurant_id})` });
      console.log(`[WS OPEN] ${username} (${role}) connected to this node for restaurant ${restaurant_id}`);
    },

    message(ws, msg) {
      const username = ws.data.params.user as string;
      const sender = clients.get(username);

      if (!sender) {
        sendJSON(ws as any, { type: "error", message: "ไม่พบผู้ใช้หรือไม่ได้เชื่อมต่อ" });
        return;
      }

      const parsed = safeParse(msg);
      if (!parsed.ok) {
        sendJSON(ws as any, { type: "error", message: "ข้อความต้องเป็น JSON ที่ถูกต้อง" });
        return;
      }

      const data: IncomingMsg = parsed.data;
      if (!data || typeof (data as any).type !== "string") {
        sendJSON(ws as any, { type: "error", message: "ข้อความต้องมี type และโครงสร้างที่ถูกต้อง" });
        return;
      }

      routeMessage({ ws: ws as any, username, sender }, data);
    },

    close(ws) {
      const username = ws.data.params.user as string;
      const client = clients.get(username);
      if (client) {
        const restSockets = getRestaurantSockets(client.restaurant_id);
        restSockets[client.role].delete(username);
        clients.delete(username);
      }
      console.log(`[WS CLOSE] ${username} disconnected from this node`);
    },
  });
};

// ================================
// MESSAGE ROUTER (Publish to Redis)
// ================================
async function routeMessage(ctx: { ws: ServerWebSocket; username: string; sender: Client }, msg: IncomingMsg) {
  const { ws, username, sender } = ctx;

  switch (msg.type) {
    case "ping": {
      sendJSON(ws, { type: "pong", ts: Date.now() });
      return;
    }

    case "message": {
      if (!ensureMessage(msg)) return sendJSON(ws, { type: "error", message: "message ต้องมี to และ content เป็นสตริง" });
      
      const payload = { type: "message", to: msg.to, from: username, content: msg.content, timestamp: new Date().toISOString(), restaurant_id: sender.restaurant_id };
      
      // ส่งเข้า Redis ให้ Server ทุกตัวช่วยหาผู้รับ
      await redisPub.publish(CHANNELS.MESSAGE, JSON.stringify(payload));
      sendJSON(ws, { type: "system", message: `ส่งข้อความถึง ${msg.to} แล้ว`, content: msg.content });
      return;
    }

    case "order": {
      if (sender.role !== "user") return sendJSON(ws, { type: "error", message: "เฉพาะ role=user เท่านั้นที่ส่ง order ได้" });
      if (!ensureOrder(msg)) return sendJSON(ws, { type: "error", message: "order ต้องมี menu" });

      // 1. เครื่องต้นทาง Generate ID และ Save DB เป็นคนเดียว ป้องกันข้อมูลซ้ำซ้อน
      const orderId = await generateOrderId();
      try {
        await Savetodb({ id: orderId, menu: msg.menu, session: msg.session, table_number: parseInt(String(msg.table_number)) });
      } catch (err) {
        console.error("Error savedb", (err as Error).message);
        return sendJSON(ws, { type: "error", message: "เกิดข้อผิดพลาดในการบันทึกออเดอร์" });
      }

      const payload = { type: "order", order_id: orderId, from: username, menu: msg.menu, session: msg.session, table_number: msg.table_number, timestamp: new Date().toISOString(), restaurant_id: sender.restaurant_id };
      
      // 2. Publish บอกให้ Server ทุกเครื่องส่งออเดอร์เข้าจอครัว
      await redisPub.publish(CHANNELS.ORDER, JSON.stringify(payload));

      // 3. แจ้งลูกค้าว่ารับออเดอร์แล้ว
      sendJSON(ws, { type: "system", message: "ส่งคำสั่งอาหารไปยังครัวแล้ว", order_id: orderId, timestamp: new Date().toISOString() });
      return;
    }

    case "order_status": {
      if (!ensureOrderStatus(msg)) return sendJSON(ws, { type: "error", message: "ข้อมูล order_status ไม่ถูกต้อง" });
      
      const payload = { type: "order_status", to: msg.to, from: username, order_id: msg.order_id, status: msg.status, timestamp: new Date().toISOString(), restaurant_id: sender.restaurant_id };
      
      await redisPub.publish(CHANNELS.ORDER_STATUS, JSON.stringify(payload));
      return;
    }

    case "call_staff": {
      if (!ensureCallStaff(msg)) return sendJSON(ws, { type: "error", message: "ข้อมูล call_staff ไม่ถูกต้อง" });
      
      const payload = { type: "call_staff", from: username, table_number: msg.table_number, timestamp: new Date().toISOString(), restaurant_id: sender.restaurant_id };
      
      await redisPub.publish(CHANNELS.CALL_STAFF, JSON.stringify(payload));
      sendJSON(ws, { type: "system", message: "เรียกพนักงานแล้ว รอสักครู่..." });
      return;
    }

    default: {
      sendJSON(ws, { type: "error", message: "รูปแบบข้อความไม่ถูกต้อง" });
      return;
    }
  }
}

// ================================
// EXTERNAL NOTIFIER
// ================================
export const notifyTableClosed = async (sessionHash: string) => {
  // ยิงเข้า Redis เพื่อให้ Server เครื่องที่ถือ Connection ของ session นี้อยู่ เป็นคนเตะออก
  await redisPub.publish(CHANNELS.TABLE_CLOSED, JSON.stringify({ sessionHash }));
  return true;
};