import pkg from "pg";
const { Pool } = pkg;

// ประกาศ pool ตัวเดียว (global)
let pool: any = null;

// ฟังก์ชัน getDB
export function getDB() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    console.log("✅ DB Connected");
  }
  return pool;
}

//export const db = getDB();
