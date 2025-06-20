// a.js  (Bun / ESM)
import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { Database } from "bun:sqlite";

/* ---------- ตั้งค่า ---------- */
const DB_FILE = "restaurant.sqlite"; // ไฟล์ SQLite
const IMG_DIR = "src/image"; // ชื่อโฟลเดอร์ที่เก็บรูป (ปรับได้)
const EXT = ".jpg"; // นามสกุลรูป
/* -------------------------------- */

/* โฟลเดอร์รูปแบบ absolute */
const IMG_ABS = resolve(import.meta.dir, IMG_DIR); // เช่น D:\Bun\app\images

/* เปิดฐานข้อมูล */
const db = new Database(DB_FILE);

/* สร้างตารางถ้ายังไม่มี */
db.run(`
  CREATE TABLE IF NOT EXISTS menu_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    price       INTEGER NOT NULL,
    image_blob  BLOB,
    image_mime  TEXT,
    category    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/* statement insert */
const insertStmt = db.prepare(`
  INSERT INTO menu_new (name, price, image_blob, image_mime, category)
  VALUES (? , ? , ? , ? , ?)
`);

/* ---- loop ใส่รูป 1.jpg 2.jpg 3.jpg ---- */
for (let i = 10; i <= 11; i++) {
  const filePath = join(IMG_ABS, `${i}${EXT}`); // <IMG_DIR>/1.jpg …
  if (!existsSync(filePath)) {
    console.warn(`⚠️  ไม่พบไฟล์ ${filePath} ข้ามไป`);
    continue;
  }

  const buf = readFileSync(filePath);
  const mime = EXT === ".png" ? "image/png" : "image/jpeg";

  insertStmt.run(`เมนู ${i}`, 0, buf, mime, "import");
  console.log(`✔️  บันทึก ${filePath}`);
}

console.log("🎉  เสร็จสิ้นนำเข้ารูป");
