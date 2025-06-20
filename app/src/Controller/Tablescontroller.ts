import { Database } from "bun:sqlite";
import { customAlphabet } from "nanoid";
import { Context } from "elysia";
import QRCode from "qrcode";
import crypto from "crypto";
const db = new Database("restaurant.sqlite");
const nanoid = customAlphabet("1234567890abcdef", 8);
export const Tablecontroller = {
  gettable: async ({ set }: Context) => {
    const query = "SELECT * FROM tables";
    const result = await db.query(query).all();
    set.status = 200;
    return { tables: result };
  },
  opentable: async ({ set, body }: any) => {
    const tableNumber = body.number?.trim();
    if (!/^\d{1,2}$/.test(tableNumber ?? "")) {
      set.status = 400;
      return { message: "หมายเลขโต๊ะไม่ถูกต้อง" };
    }
    const hash = nanoid(10); // hash สำหรับ session
    const qrPath = `/order/${hash}`;
    const bashurl = "http://localhost:3000";
    const fullURL = `${bashurl}${qrPath}`;

    try {
      const qrBase64 = await QRCode.toDataURL(fullURL);

      const result = await db
        .prepare(
          `
        UPDATE tables
        SET status          = 'open',
            opened_at       = CURRENT_TIMESTAMP,
            customer_session= ?,        -- เก็บ hash ตรงนี้
            qr_code_url     = ?
        WHERE table_number  = ?
          AND status        = 'available'
      `
        )
        .run(hash, qrBase64, tableNumber);

      if (result.changes === 0) {
        set.status = 409; // Conflict
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
      console.error(err);
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
    const number = body.number?.trim();

    if (!/^\d{1,2}$/.test(number ?? "")) {
      set.status = 400;
      return { message: "หมายเลขโต๊ะไม่ถูกต้อง" };
    }
    console.log(number);
    try {
      const result = await db
        .prepare(
          `
        UPDATE tables
        SET    status           = 'available',
               opened_at        = NULL,
               qr_code_url      = NULL,
               customer_session = NULL
        WHERE  table_number     = ?
          AND  status <> 'available'
      `
        )
        .run(number);

      if (result.changes === 0) {
        set.status = 404;
        return { message: "โต๊ะนี้ไม่มีข้อมูลหรือว่างอยู่แล้ว" };
      }

      return { message: "ปิดโต๊ะเรียบร้อย", table_number: number };
    } catch (err) {
      console.error(err);
      set.status = 500;
      return { message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" };
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
    const query = "SELECT * FROM tables WHERE customer_session=?";
    const result = await db.prepare(query).get(hashcode);
    if (!result) {
      set.status = 404;
      return { message: "ไม่พบโต๊ะ" };
    }
    set.status = 200;
    return { message: "พบโต๊ะ", table: result };
  },
};
