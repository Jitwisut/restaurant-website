#!/bin/bash

echo "🔧 เริ่มกระบวนการเปลี่ยน schema ตาราง 'tables'..."

sqlite3 restaurant.sqlite <<EOF

-- 1. สร้างตารางใหม่ชื่อ tables_new
CREATE TABLE tables_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('available', 'open', 'reserved','maintenance')) DEFAULT 'available',
  opened_at DATETIME,
  customer_session TEXT,
  qr_code_url TEXT
);

-- 2. คัดลอกข้อมูลจากตารางเก่า
INSERT INTO tables_new (id, table_number, status, opened_at, customer_session, qr_code_url)
SELECT id, table_number, status, opened_at, customer_session, qr_code_url FROM tables;

-- 3. ลบตารางเดิม
DROP TABLE tables;

-- 4. เปลี่ยนชื่อ tables_new -> tables
ALTER TABLE tables_new RENAME TO tables;

EOF

echo "✅ แก้ไข schema ตาราง 'tables' สำเร็จแล้ว!"