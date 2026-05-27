# AGENTS.md

คู่มือสั้นสำหรับ agent/developer ที่เข้ามาทำงานใน repo นี้

## Project Layout

- `app/` คือ backend Elysia/Bun/PostgreSQL
- `frontend/` คือ frontend Next.js
- migration backend อยู่ที่ `app/migrations/`
- tests backend อยู่ที่ `app/src/__tests__/`

## สำคัญมาก: Database ก่อนรัน Test

ห้ามรัน test กับฐานข้อมูลหลักหรือฐานข้อมูล production เด็ดขาด

ก่อนรัน backend test ต้องเปลี่ยน database context ไปเป็น test database ก่อนเสมอ:

- ใช้ test database เช่น `restaurant_test`
- ให้ `DATABASE_URL` ชี้ไป test database
- คำสั่งที่แนะนำคือรันจากโฟลเดอร์ `app/` ด้วย `npm test` เพราะ script นี้โหลด `app/.env.test`

```powershell
cd app
npm test
```

ถ้ามีการแก้ `.env`, shell env, หรือ connection string ชั่วคราวเพื่อรัน test:

1. จด/เก็บค่าเดิมของ database หลักไว้ก่อน
2. เปลี่ยนไปใช้ test database ก่อนรัน test
3. รัน test ให้จบ
4. เปลี่ยนค่ากลับเป็น database หลักทันทีหลัง test เสร็จ

อย่าปล่อยให้ dev server หรือ shell session ค้างอยู่บน test database โดยไม่ตั้งใจ และอย่าปล่อยให้ test command ไปแตะ database หลัก

## Common Commands

Backend:

```powershell
cd app
npm test
npm run dev
```

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

Root dev server:

```powershell
bun dev
```

## Working Rules

- อย่า revert งานของคนอื่นใน working tree
- ก่อนแก้ schema ให้เพิ่ม migration ใหม่ใน `app/migrations/`
- Backend query ทุกตัวที่เกี่ยวกับร้านต้อง scope ด้วย `restaurant_id`
- WebSocket เป็นตัว notify UI เท่านั้น ห้ามใช้เป็น source of truth แทน DB
- ฟีเจอร์ payment ตอนนี้เป็น manual payment/reference/proof ก่อน ยังไม่ใช่ gateway production

## QA ที่ควรเช็กหลังแก้ flow หลัก

- เปิดโต๊ะ
- เข้า QR/order
- สั่งอาหาร
- kitchen รับ/เปลี่ยนสถานะ
- staff/admin เห็นคิวเสิร์ฟ
- mark served
- ปิดโต๊ะแล้วเห็น bill summary
- submit/approve payment
- daily closing report ยอดถูกต้อง
