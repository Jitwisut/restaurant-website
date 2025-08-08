import { Database } from "bun:sqlite";
import { customAlphabet } from "nanoid";
import { Context } from "elysia";
import QRCode from "qrcode";
import crypto from "crypto";
const baseurl = Bun.env.ORIGIN_URL;
const db = new Database("restaurant.sqlite") as any;
const nanoid = customAlphabet("1234567890abcdef", 8);
export const Tablecontroller = {
  gettable: async ({ set }: Context) => {
    const query = "SELECT * FROM tables";
    const result = await db.query(query).all();
    set.status = 200;

    return { tables: result };
  },
  opentable: async ({ set, body }: any) => {
    const rawNumber = body.number?.trim();
    const tableNumber = parseInt(rawNumber ?? "", 10);
    const paddedNumber = tableNumber.toString().padStart(2, "0"); // 2 → "02"

    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      set.status = 400;
      return { message: "หมายเลขโต๊ะไม่ถูกต้อง" };
    }

    const hash = nanoid(10); // session hash
    const qrPath = `/order/${hash}`;
    const fullURL = `${baseurl}${qrPath}`;

    try {
      const qrBase64 = await QRCode.toDataURL(fullURL); // ✅ async (คงไว้)

      const stmt = db.prepare(`
      UPDATE tables
         SET status           = 'open',
             opened_at        = CURRENT_TIMESTAMP,
             customer_session = ?,
             qr_code_url      = ?
       WHERE table_number     = ?
         AND status           = 'available'
    `);

      stmt.run(hash, qrBase64, paddedNumber); // ❌ ห้าม await, เป็น sync
      const changes = db.changes;

      if (changes === 0) {
        set.status = 409;
        return { message: "โต๊ะนี้ถูกเปิดแล้วหรือไม่พบ" };
      }

      return {
        message: "เปิดโต๊ะสำเร็จ",
        table_number: tableNumber,
        session_hash: hash,
        qr_code_url: qrBase64,
        fullurl: fullURL,
      };
    } catch (err) {
      console.error("❌ opentable error:", err);
      set.status = 500;
      return { message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" };
    }
  },
  closetable: async ({
    set,
    body,
  }: {
    set: Context["set"];
    body: { number: string };
  }) => {
    const rawNumber = body.number?.trim();
    const tableNumber = parseInt(rawNumber ?? "", 10);
    const paddedNumber = tableNumber.toString().padStart(2, "0"); // 2 → "02"
    if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      set.status = 400;
      return { message: "หมายเลขโต๊ะไม่ถูกต้อง" };
    }

    try {
      const stmt = db.prepare(`
      UPDATE tables
         SET status           = 'available',
             opened_at        = NULL,
             qr_code_url      = NULL,
             customer_session = NULL
       WHERE table_number     = ?
         AND status <> 'available'
    `);

      stmt.run(paddedNumber); // ✅ ใช้แบบ sync เท่านั้น
      const changes = db.changes; // ✅ fallback ปลอดภัย

      if (changes === 0) {
        set.status = 404;
        return { message: "โต๊ะนี้ไม่มีข้อมูลหรือว่างอยู่แล้ว" };
      }

      return { message: "ปิดโต๊ะเรียบร้อย", table_number: tableNumber };
    } catch (err) {
      console.error("❌ closetable error:", (err as Error).message);
      set.status = 500;
      return {
        message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
        Error: (err as Error).message,
      };
    }
  },

  checktabel: ({
    set,
    params,
  }: {
    set: Context["set"];
    params: Context["params"];
  }) => {
    const hashcode = params.session;
    console.log(hashcode);
    if (!hashcode) {
      set.status = 400;
      return { message: "ไม่พบ hashcode" };
    }
    const re = db.prepare("SELECT * FROM tables");
    const reu = re.all();
    console.log("db:", reu);
    const query = "SELECT * FROM tables WHERE customer_session = ?";
    const stmt = db.prepare(query);
    const result = stmt.get(hashcode); // ✅ sync: ไม่มี await
    console.log("result", result);
    if (!result) {
      set.status = 404;
      return { message: "ไม่พบโต๊ะ" };
    }

    set.status = 200;
    return { message: "พบโต๊ะ", table: result };
  },
};
