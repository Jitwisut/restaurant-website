import { customAlphabet } from "nanoid";
import { Context } from "elysia";
import QRCode from "qrcode";
import { getDB } from "../lib/connect";
import { randomUUID } from "crypto";
import { notifyTableClosed } from "../router/websocket";
const baseurl = Bun.env.ORIGIN_URL;
const db = getDB();

const nanoid = randomUUID();
export const Tablecontroller = {
  gettable: async ({ set }: Context) => {
    const query = "SELECT * FROM tables";
    const result = await db.query(query);
    set.status = 200;

    return { tables: result.rows };
  },
  opentable: async ({ set, body }: any) => {
    await db.query("BEGIN");
    const rawNumber = body.number;
    const tableNumber = parseInt(rawNumber ?? "", 10);
    const paddedNumber = tableNumber.toString().padStart(2, "0"); // 2 → "02"

    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      set.status = 400;
      return { message: "หมายเลขโต๊ะไม่ถูกต้อง" };
    }

    const hash = nanoid; // session hash
    const qrPath = `/order/${hash}`;
    const fullURL = `${baseurl}${qrPath}`;

    try {
      const qrBase64 = await QRCode.toDataURL(fullURL); // ✅ async (คงไว้)
      await db.query(
        "INSERT INTO sessions (session_id,table_number,opened_at) VALUES ($1,$2,NOW())",
        [hash, paddedNumber]
      );
      const result = await db.query(
        `
  UPDATE tables
     SET status           = 'open',
         opened_at        = NOW(),
         customer_session = $1,
         qr_code_url      = $2
   WHERE table_number     = $3
     AND status           = 'available'
   RETURNING table_number, status, opened_at, customer_session, qr_code_url
  `,
        [hash, qrBase64, paddedNumber]
      );

      if (result.rowCount === 0) {
        set.status = 409; // Conflict
        return { message: "โต๊ะนี้ถูกเปิดแล้วหรือไม่พบ" };
      }
      await db.query("COMMIT");
      return {
        message: "เปิดโต๊ะสำเร็จ",
        table_number: tableNumber,
        session_hash: hash,
        qr_code_url: qrBase64,
        fullurl: fullURL,
      };
    } catch (err) {
      await db.query("ROLLBACK");
      console.error("❌ opentable error:", err);
      set.status = 500;
      return { message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" };
    }
  },
  closetable: async ({
    set,
    body,
    server,
  }: {
    set: Context["set"];
    body: { number: string };
    server: Context["server"];
  }) => {
    const rawNumber = body.number;
    const tableNumber = parseInt(rawNumber ?? "", 10);
    const paddedNumber = tableNumber.toString().padStart(2, "0"); // 2 → "02"
    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      set.status = 400;
      return { message: "หมายเลขโต๊ะไม่ถูกต้อง" };
    }

    try {
      const current_table = await db.query(
        `SELECT customer_session FROM tables WHERE table_number=$1  AND status <> 'available'`,
        [paddedNumber]
      );
      const stmt = await db.query(
        `
      UPDATE tables
         SET status           = 'available',
             opened_at        = NULL,
             qr_code_url      = NULL,
             customer_session = NULL
       WHERE table_number     = $1
         AND status <> 'available'
         
    `,
        [paddedNumber]
      );
      await db.query(
        "UPDATE sessions SET closed_at=NOW() WHERE session_id=$1",
        [current_table.rows[0].customer_session]
      );
      if (stmt.rowCount === 0) {
        set.status = 404;
        return { message: "โต๊ะนี้ไม่มีข้อมูลหรือว่างอยู่แล้ว" };
      }
      const closedSession = current_table.rows[0].customer_session; //ดึงsession จาก tableมาา
      console.log(closedSession);
      if (closedSession) {
        //ส่งข้อมูลผ่าน websocket ไปว่า table ปิดไปแล้ว
        server?.publish(
          closedSession,
          JSON.stringify({
            type: "table_closed",
            message: "Table has been close",
          })
        );
      }
      const result = await db.query(
        "UPDATE orders SET status='completed' WHERE table_number=$1",
        [tableNumber]
      );

      return { message: "ปิดโต๊ะเรียบร้อย", table_number: tableNumber };
    } catch (err) {
      console.error("❌ closetable error:", (err as Error).message);
      set.status = 500;
      return {
        message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
      };
    }
  },

  checktabel: async ({
    set,
    params,
  }: {
    set: Context["set"];
    params: Context["params"];
  }) => {
    const hashcode = params.session;
    if (!hashcode) {
      set.status = 400;
      return { message: "ไม่พบ hashcode" };
    }
    const re = db.query("SELECT * FROM tables");

    const query = "SELECT * FROM tables WHERE customer_session = $1";
    const result = await db.query(query, [hashcode]);

    if (result.rowCount === 0) {
      set.status = 404;
      return { message: "ไม่พบโต๊ะ" };
    }
    //ดึงข้อมูลแถวแรกออกมา
    const table = result.rows[0];
    set.status = 200;
    return { message: "พบโต๊ะ", table: table };
  },

  ordersuccess: async ({
    set,
    body,
  }: {
    set: Context["set"];
    body: { table_number: Number };
  }) => {
    const tablenumber = body.table_number;
    if (!tablenumber) {
      set.status = 404;
      return { message: "No table number" };
    }
    const result = await db.query(
      "UPDATE orders SET status='completed' WHERE table_number=$1",
      [tablenumber]
    );
    console.log("order", result.rows);
    return { message: "success" };
  },
};
