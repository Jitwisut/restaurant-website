// src/router/websocket.ts
import { Elysia, t } from "elysia";
import type { ServerWebSocket } from "bun";
import { getDB } from "../lib/connect";

const db = getDB();
// ================================
// SECTION A — Types & Stores
// ================================
type Role = "user" | "kitchen" | "admin";

type MsgPing = { type: "ping" };
type MsgMessage = { type: "message"; to: string; content: string };
type MsgOrder = {
  type: "order";
  menu: unknown;
  table_number?: number | string;
};
type MsgOrderStatus = {
  type: "order_status";
  to: string;
  order_id: string;
  status: "accepted" | "preparing" | "done" | "rejected";
};
type IncomingMsg =
  | MsgPing
  | MsgMessage
  | MsgOrder
  | Msgcallstaff
  | MsgOrderStatus
  | { type: string };
type Msgcallstaff = {
  type: "call_staff"
  table_number: number | string
}
const sockets: Record<Role, Map<string, ServerWebSocket<any>>> = {
  user: new Map(),
  kitchen: new Map(),
  admin: new Map(),
};

interface Client {
  ws: ServerWebSocket;
  role: Role;
}
const clients = new Map<string, Client>();

// ================================
// SECTION B — Helpers
// ================================
const td = new TextDecoder();

async function validateTable(tablesNumber: number): Promise<boolean> {
  const result = await db.query(
    "SELECT tables_number,status FROM tables WHERE tables_number=$1"
  );
  if (result.rows.length === 0) {
    return false; //ไม่มีโต๊ะนี้
  }
  const tableStatus = result.rows[0].status;
  if (tableStatus !== "avaliable") {
    return false; //โต๊ะไม่พร้อมใช้งาน
  }
  return true;
}
async function updateTableStatus(tableNumber: number, status: string) {
  await db.query(
    "UPDATE tables SET status =$1, opened_at=NOW() WHERE tables_number=$2",
    [status, tableNumber]
  );
}

async function generateOrderId(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePrefix = `${year}${month}${day}`;

  try {
    // หา order ล่าสุดของวันนี้จาก database
    const result = await db.query(
      `SELECT id FROM orders 
       WHERE id LIKE $1 
       ORDER BY id DESC 
       LIMIT 1`,
      [`ORD-${datePrefix}-%`]
    );

    let sequence = 1;

    // ถ้ามี order วันนี้แล้ว เอา sequence ล่าสุด + 1
    if (result.rows.length > 0) {
      const lastId = result.rows[0].id; // เช่น "ORD-20251109-005"
      const parts = lastId.split("-"); // ["ORD", "20251109", "005"]
      const lastSequence = parseInt(parts[2]); // 5
      sequence = lastSequence + 1; // 6
    }

    const sequenceStr = String(sequence).padStart(3, "0");
    const orderId = `ORD-${datePrefix}-${sequenceStr}`;

    console.log(`✅ Generated order ID: ${orderId}`);
    return orderId;
  } catch (err) {
    console.error("❌ Error generating order ID:", err);
    // Fallback: ใช้ timestamp + random ถ้า database error
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
  }
}

async function Savetodb(order: {
  id: string;
  menu: any;
  table_number: number;
  customer_session?: string;
}) {
  try {
    await db.query("BEGIN");

    await db.query(
      "INSERT INTO orders (id,table_number,customer_session,status,updated_at) VALUES ($1,$2,$3,'pending',NOW())",
      [order.id, order.table_number, order.customer_session]
    );
    const items = order.menu.items;
    console.log("items", items);
    if (Array.isArray(order.menu.items)) {
      for (const item of items) {
        await db.query(
          `INSERT INTO order_items (order_id, menu_item_name, quantity, price, notes)
           VALUES ($1, $2, $3, $4, $5)`,
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

function safeParse(
  msg: unknown
): { ok: true; data: any } | { ok: false; err: Error } {
  try {
    //  ถ้าเป็น object (และไม่ใช่ Uint8Array) ให้รับตรง ๆ ไม่ต้อง parse
    if (
      msg !== null &&
      typeof msg === "object" &&
      !(msg instanceof Uint8Array)
    ) {
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
  } catch (e) {
    console.error("[WS SEND ERROR]", e);
  }
}

function preview(val: unknown, max = 300) {
  try {
    const s =
      typeof val === "string"
        ? val
        : val instanceof Uint8Array
          ? td.decode(val)
          : JSON.stringify(val);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return String(val);
  }
}
function ensureCallStaff(x: any): x is Msgcallstaff {
  return x?.type === "call_staff" && (typeof x?.table_number === "string" || typeof x?.table_number === "number");
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
    ["accepted", "preparing", "done", "rejected"].includes(x?.status)
  );
}

// ================================
// SECTION C — WS Route
// ================================
export const web = (app: Elysia) => {
  return app.ws("/ws/:user", {
    query: t.Object({
      role: t.Union([t.Literal("user"), t.Literal("kitchen"), t.Literal("admin")], {
        default: "user",
      }),
    }),

    open(ws) {
      const username = ws.data.params.user as string;
      const role = ws.data.query.role as Role;

      sockets[role].set(username, (ws as any).raw);
      clients.set(username, { ws: (ws as any).raw, role });

      sendJSON(ws as any, {
        type: "system",
        message: `เชื่อมต่อสำเร็จในชื่อ ${username} (Role: ${role})`,
      });

      console.log(`[WS OPEN] ${username} (${role}) connected`);
    },

    message(ws, msg) {
      const username = ws.data.params.user as string;
      const sender = clients.get(username);

      if (!sender) {
        sendJSON(ws as any, {
          type: "error",
          message: "ไม่พบผู้ใช้หรือไม่ได้เชื่อมต่อ",
        });
        return;
      }

      // Log raw payload (เห็นชัดว่า client ส่งอะไรจริง)
      console.log(
        `[WS IN] user=${username} role=${sender.role
        } typeof=${typeof msg} raw=${preview(msg)}`
      );

      const parsed = safeParse(msg);
      if (!parsed.ok) {
        console.error("[WS PARSE ERROR]", parsed.err);
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

      routeMessage({ ws: ws as any, username, sender }, data);
    },

    close(ws) {
      const username = ws.data.params.user as string;
      const client = clients.get(username);
      if (client) {
        sockets[client.role].delete(username);
        clients.delete(username);
      }
      console.log(
        `[WS CLOSE] ${username} (${client?.role ?? "?"}) disconnected`
      );
    },
  });
};

// ================================
// MESSAGE ROUTER
// ================================
async function routeMessage(
  ctx: { ws: ServerWebSocket; username: string; sender: Client },
  msg: IncomingMsg
) {
  const { ws, username, sender } = ctx;

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
      const recipient = clients.get(msg.to);
      if (!recipient) {
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
        content: msg.content,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    case "order": {
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

      const kitchenClients = Array.from(sockets.kitchen.entries());
      if (kitchenClients.length === 0) {
        sendJSON(ws, { type: "error", message: "ไม่พบครัวที่เชื่อมต่ออยู่" });
        return;
      }

      kitchenClients.forEach(([kitchenName, kitchenWs]) => {
        sendJSON(kitchenWs, {
          type: "order",
          from: username,
          menu: msg.menu,
          table_number: msg.table_number,
          timestamp: new Date().toISOString(),
        });
      });

      const orderId = await generateOrderId();
      try {
        Savetodb({
          id: orderId,
          menu: msg.menu,
          table_number: parseInt(String(msg.table_number)),
        });
      } catch (err) {
        console.error("Error savedb", (err as Error).message);
      }
      sendJSON(ws, {
        type: "system",
        message: "ส่งคำสั่งอาหารไปยังครัวแล้ว",
        menu: msg.menu,
        timestamp: new Date().toISOString(),
      });
      console.log(`[WS OUT] sent system ack to ${username}`);
      return;
    }

    case "order_status": {
      if (!ensureOrderStatus(msg)) {
        sendJSON(ws, {
          type: "error",
          message:
            "order_status ต้องมี to, order_id และ status (accepted|preparing|done|rejected)",
        });
        return;
      }

      const recipient = clients.get(msg.to);
      if (!recipient) {
        sendJSON(ws, {
          type: "error",
          message: `ไม่พบผู้ใช้ ${msg.to} หรือไม่ได้เชื่อมต่อ`,
        });
        return;
      }
      sendJSON(recipient.ws, {
        type: "order_status",
        from: username,
        order_id: msg.order_id,
        status: msg.status,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    case "call_staff": {
      if (!ensureCallStaff(msg)) {
        sendJSON(ws, {
          type: "error",
          message:
            "call_staff ต้องมี to, order_id และ status (accepted|preparing|done|rejected)",
        });
        return;
      }
      const adminEntries = Array.from(sockets.admin.values());
      if (adminEntries.length === 0) {
        sendJSON(ws, { type: "error", message: "ไม่พบผู้ใช้หรือไม่ได้เชื่อมต่อ" });
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
      sendJSON(ws, { type: "system", message: "เรียกพนักงานแล้ว รอสักครู่..." });
      return;
    }
    default: {
      console.warn("[WS INVALID TYPE]", msg);
      sendJSON(ws, {
        type: "error",
        message:
          "รูปแบบข้อความไม่ถูกต้อง ใช้ { type: 'message', to, content } หรือ { type: 'order', menu } หรือ { type:'ping' }",
      });
      return;
    }
  }
}
