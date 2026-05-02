# Multi-tenant MVP Follow-up Plan

## ภาพรวม

สถานะตอนนี้:
- มี migration MVP สำหรับ `restaurants` และ `restaurant_id` แล้ว
- มี JWT restaurant scope แล้ว
- มีการ scope backend หลัก (`auth`, `admin`, `menu`, `tables`, `orders`, `websocket`) ระดับแรกแล้ว
- มี Restaurant API ระดับ MVP แล้ว

สิ่งที่ยังเหลือคือทำให้ระบบ "ใช้งานได้จริงครบ flow" และ "ทดสอบผ่าน" ก่อนค่อยขยับไป billing หรือ enterprise features

---

## Phase 1: Apply และ Validate Database

### 1. รัน migration กับฐานข้อมูลจริง
**สถานะ:** ยังไม่ทำ

**งานที่ต้องทำ:**
- รัน `bun run migrate:multi-tenant`
- ตรวจสอบว่าตาราง `restaurants` ถูกสร้างครบ
- ตรวจสอบว่าตารางหลักมี `restaurant_id` ครบ:
  - `users`
  - `menu_new`
  - `tables`
  - `sessions`
  - `orders`
  - `order_items`
- ตรวจสอบว่า default restaurant (`id=1`) ถูกสร้าง
- ตรวจสอบว่า index ถูกสร้างครบ

**สิ่งที่ต้องเช็กหลังรัน:**
- user เดิมทุกคนมี `restaurant_id`
- menu/table/session/order เดิมทุก record มี `restaurant_id`
- `tables` ใช้ unique แบบ `(restaurant_id, table_number)` แล้ว

---

## Phase 2: Backend Stabilization

### 2. เก็บ backend ให้ครบทุก endpoint
**สถานะ:** ทำไปบางส่วนแล้ว

**งานที่ต้องทำต่อ:**
- ตรวจทุก query ที่ยังไม่ได้ `WHERE restaurant_id = ?`
- ตรวจ route ที่ควรบังคับ auth แต่ยังไม่บังคับ
- ตรวจ role matrix ให้ชัด:
  - `owner`
  - `admin`
  - `staff`
  - `kitchen`
  - `superadmin`
- ปรับ error response ให้ consistent มากขึ้น โดยเฉพาะ:
  - 401 unauthorized
  - 403 forbidden
  - 404 not found
  - 409 conflict

### 3. เก็บ Restaurant API ให้ครบ flow
**สถานะ:** มี MVP แล้ว

**งานที่ต้องทำต่อ:**
- เพิ่ม endpoint approve/suspend/reject ให้ชื่อ endpoint ชัดเจน
- เพิ่ม endpoint list pending restaurants
- เพิ่มการเช็ก slug ซ้ำแบบชัดเจนและ message ที่เข้าใจง่าย
- เพิ่ม guard สำหรับ owner ที่แก้ได้เฉพาะร้านตัวเอง

### 4. เก็บ WebSocket ฝั่ง multi-tenant
**สถานะ:** scope ตามร้านแล้วระดับหนึ่ง

**งานที่ต้องทำต่อ:**
- บังคับให้ client ส่ง token ที่ verify ได้จริง
- ลดการเชื่อ `restaurant_id` จาก query string โดยตรง
- ตรวจว่า event ทุกชนิดไม่ส่งข้ามร้าน:
  - `message`
  - `order`
  - `order_status`
  - `call_staff`
  - `table_closed`
- ตรวจ logic บันทึก `orders` และ `order_items` ให้ `restaurant_id` ตรงกันเสมอ

---

## Phase 3: Testing Fixes

### 5. อัปเดต test backend ทั้งชุด
**สถานะ:** ยังไม่ผ่าน

**ปัญหาปัจจุบัน:**
- test เดิมเรียก admin/table/order โดยไม่ส่ง JWT
- test เดิมยัง assume single-tenant behavior
- schema test ต้องใช้ `restaurants` และ `restaurant_id` ทุก seed

**งานที่ต้องทำ:**
- ปรับ `auth.test.ts`
  - signup ต้องรองรับ `restaurant_name` / `restaurant_slug`
  - signin ต้องเช็กว่า token มี `restaurant_id`
  - owner/admin pending ต้อง redirect ไป `/restaurant/pending`
- ปรับ `admin.test.ts`
  - login รับ token ก่อนทุกเคสที่ต้อง auth
  - ตรวจว่าเห็น user เฉพาะร้านตัวเอง
- ปรับ `menu.test.ts`
  - ถ้า route public ได้ ต้องกำหนด default behavior ให้ชัด
  - ถ้า route ต้อง auth ให้ test ส่ง token ให้ครบ
- ปรับ `table.test.ts`
  - ทุก endpoint ที่ protected ต้องส่ง token
  - เพิ่มเคส cross-tenant isolation
- ปรับ `order.test.ts`
  - ตรวจว่า order history ไม่ปนร้าน
  - ตรวจว่า session/order/order_items ผูก tenant เดียวกัน
- เพิ่ม `restaurant.test.ts`
  - register
  - pending
  - approve
  - suspend
  - reject
- เพิ่ม `isolation.test.ts`
  - ร้าน A ต้องไม่เห็นข้อมูลร้าน B

### 6. แก้ปัญหา tooling test/build
**สถานะ:** ยังติดบางจุด

**งานที่ต้องทำ:**
- แก้ปัญหา `tsc` ที่เรียกผ่าน `npx` ไม่ได้ใน environment ปัจจุบัน
- แก้ปัญหา `bun build` / `tsconfig` path permission (`EPERM`)
- เพิ่ม command validation ที่รันได้แน่นอนใน repo นี้

---

## Phase 4: Frontend Integration

### 7. เชื่อม frontend เข้ากับ flow ร้านใหม่
**สถานะ:** ยังไม่ทำ

**งานที่ต้องทำ:**
- เพิ่มหน้า `/restaurant/register`
- เพิ่มหน้า `/restaurant/pending`
- ปรับ login flow ให้รองรับ redirect pending
- เก็บ token ที่มี `restaurant_id`
- เพิ่ม restaurant context ฝั่ง frontend
- ปรับหน้า admin / orders / tables / order ให้ดึงข้อมูลใน restaurant context เดียวกัน

### 8. ปรับ WebSocket client
**สถานะ:** ยังไม่ทำ

**งานที่ต้องทำ:**
- ส่ง token ตอน connect websocket
- ผูก connection กับ restaurant context ปัจจุบัน
- ตรวจ reconnect flow หลัง login / switch context

---

## Phase 5: Operations และ Production Readiness

### 9. จัดการ config และ env
**สถานะ:** ยังไม่ครบ

**งานที่ต้องทำ:**
- เพิ่ม `.env.example`
- ระบุ env สำคัญ:
  - `DEFAULT_RESTAURANT_ID`
  - `JWT_SECRET`
  - `DATABASE_URL`
  - `SUPER_ADMIN_EMAIL`
  - `SUPER_ADMIN_PASSWORD`
  - `RESTAURANT_SIGNUP_ENABLED`
- เตรียม seed superadmin หรือ bootstrap script

### 10. ตรวจ deploy path
**สถานะ:** ยังไม่ทำ

**งานที่ต้องทำ:**
- กำหนดขั้นตอน migration ก่อน deploy
- กำหนด rollback plan
- ทดสอบบน staging database ก่อน production

---

## ลำดับทำงานแนะนำ

1. รัน migration กับ database
2. ตรวจ schema และ data migration ให้ครบ
3. อัปเดต test backend ทั้งชุดให้ผ่าน
4. เก็บ backend endpoint และ websocket ที่ยังไม่ครบ
5. เชื่อม frontend เข้ากับ flow ร้านใหม่
6. เตรียม env, superadmin, และ deploy flow

---

## Definition of Done

งานก้อนนี้ถือว่าเสร็จเมื่อ:
- migration รันผ่านบน database เป้าหมาย
- backend flow นี้ใช้งานได้จริง:
  - signup owner
  - restaurant pending
  - superadmin approve
  - signin
  - admin/menu/tables/orders ใช้งานในขอบเขตร้านเดียว
- websocket ไม่ส่ง event ข้าม tenant
- test สำคัญผ่าน
- frontend ใช้งาน flow ร้านใหม่ได้อย่างน้อยในเส้นทางหลัก
