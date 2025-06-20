import { Database } from 'bun:sqlite'
import { customAlphabet } from 'nanoid'

// สร้าง nanoid generator
const nanoid = customAlphabet('1234567890abcdef', 8) // ความยาว 8 ตัว เช่น "e3d91f0a"

// เชื่อมต่อฐานข้อมูล
const db = new Database('restaurant.sqlite')

// เตรียมคำสั่ง insert
const insert = db.prepare(`
  INSERT INTO tables (table_number, status, qr_code_url)
  VALUES (?, ?, ?)
`)

// ใช้ transaction เพิ่มโต๊ะ
const insertMany = db.transaction(() => {
  for (let i = 1; i <= 10; i++) {
    const number = i.toString().padStart(2, '0')  // "01" ถึง "10"
    const randomCode = nanoid()                  // UUID-like string
    const qrUrl = `/qr/table/${randomCode}.png`  // URL ที่เดาไม่ได้

    insert.run(number, 'available', qrUrl)
  }
})

// เรียกใช้งาน
insertMany()
console.log('สร้างโต๊ะ 10 ตัวพร้อม QR แบบสุ่มเรียบร้อยแล้ว')