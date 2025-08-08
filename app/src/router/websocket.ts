import { Elysia, t } from "elysia";
import type { ServerWebSocket } from "bun";

// กำหนดประเภทสำหรับ role
type Role = "user" | "kitchen";

// เก็บการเชื่อมต่อ WebSocket แยกตาม role
const sockets: Record<Role, Map<string, ServerWebSocket<any>>> = {
  user: new Map(),
  kitchen: new Map(),
};

// เก็บการเชื่อมต่อทั้งหมดพร้อม role เพื่อการค้นหาทั่วไป
interface Client {
  ws: ServerWebSocket;
  role: Role;
}
const clients = new Map<string, Client>();

export const web = (app: Elysia) => {
  return app.ws("/ws/:user", {
    // ตรวจสอบ query parameter สำหรับ role
    query: t.Object({
      role: t.Union([t.Literal("user"), t.Literal("kitchen")], {
        default: "user",
      }),
    }),

    open(ws) {
      const username = ws.data.params.user;
      const role = ws.data.query.role as Role;

      // เก็บการเชื่อมต่อใน sockets และ clients
      sockets[role].set(username, (ws as any).raw);
      clients.set(username, { ws: (ws as any).raw, role });
      //(`👋 ${username} (${role}) connected`);

      // แจ้งเตือนผู้ใช้เมื่อเชื่อมต่อสำเร็จ
      ws.send(
        JSON.stringify({
          type: "system",
          message: `เชื่อมต่อสำเร็จในชื่อ ${username} (Role: ${role})`,
        })
      );
    },

    message(ws, msg) {
      const username = ws.data.params.user;
      const sender = clients.get(username);
      if (!sender) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "ไม่พบผู้ใช้หรือไม่ได้เชื่อมต่อ",
          })
        );
        return;
      }

      // ตรวจสอบว่า msg เป็นสตริงและแปลงเป็น JSON
      let parsedMsg;
      try {
        parsedMsg = typeof msg === "string" ? JSON.parse(msg) : msg;
      } catch (e) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "ข้อความต้องเป็น JSON ที่ถูกต้อง",
          })
        );
        return;
      }

      // จัดการตามประเภทข้อความ
      if (typeof parsedMsg === "object" && parsedMsg.type) {
        if (
          parsedMsg.type === "order" &&
          parsedMsg.menu &&
          sender.role === "user"
        ) {
          // จัดการคำสั่งอาหาร (ส่งไปยังทุก kitchen)
          const { menu, table_number } = parsedMsg;

          // ค้นหาทุก kitchen
          const kitchenClients = Array.from(sockets.kitchen.entries());

          if (kitchenClients.length > 0) {
            // ส่งคำสั่งไปยังทุก kitchen
            kitchenClients.forEach(([kitchenUsername, kitchenWs]) => {
              kitchenWs.send(
                JSON.stringify({
                  type: "order",
                  from: username,
                  menu,
                  table_number,
                  timestamp: new Date().toISOString(),
                })
              );
            });

            // ส่งการยืนยันไปยังผู้ส่ง (user)
            ws.send(
              JSON.stringify({
                type: "system",
                message: `ส่งคำสั่งอาหารไปยังครัวแล้ว`,
                menu,
                timestamp: new Date().toISOString(),
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "ไม่พบครัวที่เชื่อมต่ออยู่",
              })
            );
          }
        } else if (
          parsedMsg.type === "message" &&
          parsedMsg.to &&
          parsedMsg.content
        ) {
          // จัดการข้อความปกติ
          const { to, content } = parsedMsg;
          const recipient = clients.get(to);

          if (recipient) {
            recipient.ws.send(
              JSON.stringify({
                type: "message",
                from: username,
                content,
                timestamp: new Date().toISOString(),
              })
            );

            ws.send(
              JSON.stringify({
                type: "system",
                message: `ส่งข้อความถึง ${to} แล้ว`,
                content,
                timestamp: new Date().toISOString(),
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `ไม่พบผู้ใช้ ${to} หรือไม่ได้เชื่อมต่อ`,
              })
            );
          }
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message:
                "รูปแบบข้อความไม่ถูกต้อง ใช้ { type: 'message', to: 'username', content: 'ข้อความ' } หรือ { type: 'order', menu: {...} }",
            })
          );
        }
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "ข้อความต้องมี type และโครงสร้างที่ถูกต้อง",
          })
        );
      }
    },

    close(ws) {
      const username = ws.data.params.user;
      const client = clients.get(username);
      if (client) {
        // ลบออกจาก sockets และ clients
        sockets[client.role].delete(username);
        clients.delete(username);
        //(`🚪 ${username} (${client.role}) disconnected`);
      }
    },
  });
};
