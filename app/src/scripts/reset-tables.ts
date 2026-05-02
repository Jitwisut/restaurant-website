import { getDB } from "../lib/connect.js";

async function run() {
  const db = getDB();
  try {
    console.log("กำลังเคลียร์ฐานข้อมูล...");
    
    await db.query(`
      TRUNCATE TABLE 
        users, 
        restaurants, 
        menu_new, 
        tables, 
        sessions, 
        orders, 
        order_items 
      CASCADE;
    `);

    console.log("กำลังสร้างร้าน Default...");
    await db.query(`
      INSERT INTO restaurants (id, name, slug, status, plan)
      VALUES (1, 'Default Restaurant', 'default', 'active', 'free');
    `);

    await db.query(`
      SELECT setval(pg_get_serial_sequence('restaurants', 'id'), 1);
    `);

    console.log("กำลังสร้างโต๊ะ 1-10...");
    await db.query(`
      INSERT INTO tables (table_number, status, restaurant_id)
      VALUES 
        ('1', 'available', 1),
        ('2', 'available', 1),
        ('3', 'available', 1),
        ('4', 'available', 1),
        ('5', 'available', 1),
        ('6', 'available', 1),
        ('7', 'available', 1),
        ('8', 'available', 1),
        ('9', 'available', 1),
        ('10', 'available', 1);
    `);

    console.log("สำเร็จ! รีเซ็ตข้อมูลโต๊ะเรียบร้อยแล้ว");
  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);
  } finally {
    process.exit(0);
  }
}

run();