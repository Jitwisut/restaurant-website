# Multi-tenant Restaurant SaaS Migration Plan

## Production Readiness Update (2026-05-02)

**Current backend status:** Not production-ready yet. It is suitable for local development or staging validation, but should not be used as a paid/customer-facing product until the checklist below is completed.

**Latest backend test result:** `bun --env-file=.env.test test` = 80 passed, 5 failed. The remaining failures are around `/menu/get` because tests still expect public menu access, while the backend currently requires JWT.

### Must Fix Before Production

- Decide and implement the menu access model. If customer menu pages are public, add a slug-based public endpoint such as `/menu/:slug` or `/app/:slug/menu` that resolves `restaurant_id` from restaurant slug. Keep admin/staff menu management protected by JWT.
- Move all runtime schema changes into migrations. Runtime request paths must not run `CREATE TABLE` or `ALTER TABLE`; `subscriptions` schema setup currently still lives in runtime helpers and should become a migration.
- Add complete production migrations for `subscriptions`, default table provisioning, tenant indexes, constraints, and rollback notes.
- Add `.env.example` with `DATABASE_URL`, `JWT_SECRET`, `PORT`, `ORIGIN_URL`, `ORIGIN_URL2`, `DEFAULT_RESTAURANT_ID`, `DEFAULT_TABLE_COUNT`, `RESTAURANT_SIGNUP_ENABLED`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD`.
- Remove unsafe database fallback for production. `connect.ts` should fail fast when `DATABASE_URL` is missing outside test/dev instead of falling back to `restaurant_test`.
- Expand tenant isolation tests for menu, upload, profile, websocket, admin users, tables, orders, guest sessions, and superadmin impersonation.
- Harden WebSocket auth by requiring a valid token on connect, binding every connection to token-derived `restaurant_id`, and verifying every event stays inside the same tenant.
- Add production operations basics: health check endpoint, structured logging, request IDs, deployment migration step, bootstrap/seed superadmin script, backup/rollback notes, and tenant-aware rate limiting.

### Recently Stabilized

- `/tables/gettable` no longer runs schema migration during requests.
- CORS headers are now applied on error responses, so frontend can see real backend errors instead of misleading browser CORS messages.
- New restaurants now get default tables automatically.
- Existing `weedguy` restaurant in the local dev database has been provisioned with 12 available tables.
- Focused validation passed: `table.test.ts` = 13/13, `restaurant.test.ts` = 6/6.

---

## ภาพรวม

เปลี่ยนแปลงระบบ backend จากร้านอาหารเดียว ให้รองรับระบบหลายร้านอาหาร (Multi-tenant Restaurant SaaS) โดยแต่ละร้านอาหารสามารถจัดการข้อมูลของตัวเองได้อย่างเป็นอิสระ

**Strategy:** Shared Database, Shared Schema — เพิ่ม `restaurant_id` ทุกตารางที่เกี่ยวข้อง (Row-level isolation) พร้อมใช้ PostgreSQL Row-Level Security เป็น safety net ชั้นที่สอง

**Tenant Resolution:** Resolve จาก JWT token เป็นหลัก ใช้ slug ใน URL path (`/app/:slug`) สำหรับ public-facing pages — ไม่ใช้ subdomain เพื่อลด infrastructure complexity

**Registration Flow:** Self-service แต่ status เริ่มต้นเป็น `pending` จนกว่า Super Admin จะ approve

---

## Phase 0: Pre-migration Audit ⬅️ เพิ่มใหม่

### 0.1 Raw Query Audit

**ก่อนแตะ database ต้อง audit codebase ให้ครบก่อน — ถ้าพลาด WHERE clause จุดเดียวก็ data leak แล้ว**

**งานที่ต้องทำ:**
- Grep หา raw SQL queries ทั้งหมดในโปรเจกต์
- List ทุก query ที่ยังไม่มี `restaurant_id` filter
- สร้าง checklist ก่อน Phase 3 เริ่ม

```bash
# ตัวอย่าง grep commands
grep -rn 'SELECT\|INSERT\|UPDATE\|DELETE' app/src/ > query_audit.txt
grep -rn 'FROM users\|FROM orders\|FROM menu' app/src/ >> query_audit.txt
```

### 0.2 RLS Strategy

PostgreSQL Row-Level Security เป็น safety net ชั้นที่สอง — application layer ยังต้องใส่ `WHERE restaurant_id = ?` เหมือนเดิม
> ⚠️ **Technical Debt Warning:** หากใช้ Connection Pooling (เช่น PgBouncer หรือ Connection Pool ในระดับไดรเวอร์ของแอป) ต้องมั่นใจว่ามีการทำ `RESET app.restaurant_id` เสมอเมื่อจบ Request แต่ละครั้ง เพื่อป้องกันค่าของร้านก่อนหน้าค้างอยู่ใน session และหลุดไปทำงานกับ request ของร้านอื่น

```sql
-- ตัวอย่าง RLS policy
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY restaurant_isolation ON orders
  USING (restaurant_id = current_setting('app.restaurant_id')::int);
```

**งานที่ต้องทำ:**
- เปิด RLS บน PostgreSQL ทุกตารางที่มี `restaurant_id`
- สร้าง policy ให้ app role เข้าถึงได้เฉพาะแถวที่ `restaurant_id` ตรงกับ `current_setting`

**ไฟล์ที่ต้องสร้าง:**
- `app/db/migrations/006_enable_rls.sql`

---

## Phase 1: Database Foundation

### 1. ออกแบบ Database Schema สำหรับ Multi-tenant
**สถานะ:** รอเริ่มงาน

**Schema ตารางใหม่: `restaurants`**
```sql
CREATE TABLE restaurants (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(100) UNIQUE NOT NULL,  -- ใช้ใน URL path: /app/:slug
  owner_id   INTEGER REFERENCES users(id),
  status     VARCHAR(50) DEFAULT 'pending', -- pending|active|suspended|inactive
  plan       VARCHAR(50) DEFAULT 'free',    -- free|pro|enterprise
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**ตารางที่ต้องเพิ่ม `restaurant_id`:**

| ตาราง | คอลัมน์ที่เพิ่ม | Constraint | หมายเหตุ |
|-------|----------------|------------|----------|
| users | restaurant_id INTEGER | REFERENCES restaurants(id) | |
| menu_new | restaurant_id INTEGER | REFERENCES restaurants(id) | |
| tables | restaurant_id INTEGER | REFERENCES restaurants(id) | |
| sessions | restaurant_id INTEGER | REFERENCES restaurants(id) | |
| orders | restaurant_id INTEGER | REFERENCES restaurants(id) | |
| order_items | restaurant_id INTEGER | REFERENCES restaurants(id) | Denormalized เพื่อ query performance — ต้องเพิ่ม DB trigger ป้องกัน mismatch กับ orders.restaurant_id |

**ไฟล์ที่ต้องแก้:**
- `app/src/__tests__/setup.ts` (test schema)

---

### 2. สร้าง Migration Script สำหรับ Database
**สถานะ:** รอเริ่มงาน

> ⚠️ **Critical:** ทุก script ต้องอยู่ใน `BEGIN...COMMIT` transaction และต้องทดสอบบน staging ก่อน production เตรียม rollback script คู่ไว้เสมอ

**ไฟล์ที่ต้องสร้าง (รันตามลำดับ):**
- `app/db/migrations/001_add_restaurants_table.sql`
- `app/db/migrations/002_add_restaurant_id_nullable.sql` — เพิ่มแบบ nullable ก่อน
- `app/db/migrations/003_migrate_existing_data.sql` — ย้ายข้อมูลเดิม → default restaurant
- `app/db/migrations/004_add_not_null_constraints.sql` — เปลี่ยนเป็น NOT NULL หลัง migrate
- `app/db/migrations/005_add_indexes.sql` — เพิ่ม indexes บน `restaurant_id`
- `app/db/migrations/006_enable_rls.sql` — เปิด RLS ทุกตาราง

**ขั้นตอน migration (003):**

```sql
BEGIN;

-- 1. สร้าง default restaurant
INSERT INTO restaurants (name, slug, status) VALUES ('Default', 'default', 'active')
  RETURNING id;  -- สมมติได้ id = 1

-- 2. ย้ายข้อมูลทุกตาราง
UPDATE users        SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE menu_new     SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE tables       SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE sessions     SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE orders       SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE order_items  SET restaurant_id = 1 WHERE restaurant_id IS NULL;

COMMIT;
```

**indexes ที่ต้องเพิ่ม (005):**
```sql
CREATE INDEX idx_users_restaurant        ON users(restaurant_id);
CREATE INDEX idx_menu_restaurant         ON menu_new(restaurant_id);
CREATE INDEX idx_tables_restaurant       ON tables(restaurant_id);
CREATE INDEX idx_sessions_restaurant     ON sessions(restaurant_id);
CREATE INDEX idx_orders_restaurant       ON orders(restaurant_id);
CREATE INDEX idx_orders_restaurant_time  ON orders(restaurant_id, created_at);
CREATE INDEX idx_order_items_restaurant  ON order_items(restaurant_id);
```

---

## Phase 2: Backend Core

### 3. สร้าง Restaurant Management Controller และ Router
**สถานะ:** รอเริ่มงาน

**Registration Flow: Self-service แต่ status เริ่มเป็น `pending` จนกว่า Super Admin approve**

**API Endpoints:**

| Method | Endpoint | คำอธิบาย | Access | Status ที่ได้ |
|--------|----------|----------|--------|--------------|
| POST | `/api/restaurant/register` | Owner สมัครร้านใหม่ | Auth (any) | pending |
| GET | `/api/restaurant/me` | ข้อมูลร้านของตัวเอง | Owner | - |
| PUT | `/api/restaurant/me` | แก้ไขข้อมูลร้านตัวเอง | Owner | - |
| GET | `/api/restaurant/:id` | ข้อมูลร้านใดก็ได้ | Super Admin | - |
| PUT | `/api/restaurant/:id` | แก้ไขร้านใดก็ได้ | Super Admin | - |
| DELETE | `/api/restaurant/:id` | ลบ/ปิดร้าน (Soft Delete) | Super Admin | deleted |
| POST | `/api/restaurant/:id/approve` | อนุมัติร้าน | Super Admin | active |
| POST | `/api/restaurant/:id/suspend` | ระงับร้าน | Super Admin | suspended |
| POST | `/api/restaurant/:id/reject` | ปฏิเสธร้าน | Super Admin | inactive |

**ไฟล์ใหม่ที่ต้องสร้าง:**
- `app/src/Controller/RestaurantController.ts`
- `app/src/router/RestaurantRouter.ts`

---

### 4. สร้าง Middleware สำหรับ Restaurant Authorization
**สถานะ:** รอเริ่มงาน

> 🔒 **Security:** `restaurant_id` ต้องดึงจาก JWT เท่านั้น ห้ามเชื่อ `req.body.restaurant_id` หรือ `req.query.restaurant_id` จาก client โดยเด็ดขาด

**Middleware ที่ต้องสร้าง:**

| Middleware | หน้าที่ | ไฟล์ |
|------------|---------|------|
| `withRestaurantScope` | ดึง `restaurant_id` จาก JWT → ใส่ใน `req.restaurantId` | `middleware/withRestaurantScope.ts` |
| `onlyOwner` | ตรวจว่า `req.user.role === 'owner'` และเป็นเจ้าของร้านนั้น | `middleware/onlyOwner.ts` |
| `onlyRestaurantStaff` | ตรวจว่า user เป็น staff ของ `restaurant_id` ใน request | `middleware/onlyRestaurantStaff.ts` |
| `onlySuperAdmin` | ตรวจว่า `req.user.role === 'superadmin'` | `middleware/onlySuperAdmin.ts` |
| `onlyActiveRestaurant` | ตรวจว่า `restaurant.status === 'active'` ก่อน serve request | `middleware/onlyActiveRestaurant.ts` |

---

### 5. สร้าง Super Admin Dashboard API
**สถานะ:** รอเริ่มงาน

**Endpoints:**

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/superadmin/restaurants` | รายการทุกร้าน + status filter |
| GET | `/superadmin/restaurants/pending` | รายการรอ approve |
| GET | `/superadmin/stats` | สถิติ aggregate ทุกร้าน |
| GET | `/superadmin/restaurant/:id/stats` | สถิติเฉพาะร้าน |
| POST | `/superadmin/restaurant/:id/approve` | อนุมัติร้าน |
| POST | `/superadmin/restaurant/:id/reject` | ปฏิเสธร้าน |
| POST | `/superadmin/restaurant/:id/suspend` | ระงับร้าน |
| GET | `/superadmin/users` | รายการ user ทั้งหมด (cross-restaurant) |

**ไฟล์ใหม่:**
- `app/src/router/SuperAdminRouter.ts`
- `app/src/Controller/SuperAdminController.ts`

---

## Phase 3: Scope Existing Features

> ทุก task ใน Phase นี้ต้อง reference checklist จาก Phase 0 audit — ห้าม complete task โดยไม่ cross-check

### 6. แก้ไข Auth System ให้รองรับ Multi-tenant
**สถานะ:** รอเริ่มงาน

**การเปลี่ยนแปลง:**
1. เพิ่ม `restaurant_id` และ `role` (`owner`/`staff`/`superadmin`) ใน JWT payload
2. Signup flow: ถ้าเป็น owner ต้องสร้าง restaurant record พร้อมกัน (status: `pending`)
3. Login: ถ้า user เป็น staff หลายร้าน → return รายการ restaurants ให้ client เลือก แล้ว issue JWT ใหม่ต่อ session ต่อร้าน
4. เพิ่ม middleware ตรวจ `restaurant.status` ก่อน serve — ถ้า `suspended` ให้ return 403

**ไฟล์ที่ต้องแก้:**
- `app/src/Controller/Authcontroller.ts`
- `app/src/type/type.ts` — เพิ่ม `restaurant_id`, `role` ใน `JWTPayload`
- `app/src/middleware/onlyadmin.ts`
- `app/src/router/Auth.ts`

---

### 7. แก้ไข Admin Controller ให้รองรับ Restaurant Scope
**สถานะ:** รอเริ่มงาน

**การเปลี่ยนแปลง:**
1. `getalluser` → `WHERE restaurant_id = req.restaurantId`
2. `createuser` → inject `restaurant_id` จาก token
3. `updateuser` / `deletedata` → ตรวจ user ต้องอยู่ใน restaurant เดียวกัน

**ไฟล์ที่ต้องแก้:**
- `app/src/Controller/Admincontroller.ts`

---

### 8. แก้ไข Menu System ให้รองรับ Restaurant Scope
**สถานะ:** รอเริ่มงาน

**การเปลี่ยนแปลง:**
1. `GET /menu/get` → เพิ่ม `WHERE restaurant_id` จาก token (หรือ public slug)
2. `POST /admin/upload-menu` → inject `restaurant_id` จาก token
3. **Storage Isolation:** ปรับ path สำหรับบันทึกไฟล์รูปภาพ (เช่น โลโก้, รูปเมนู) ให้แยกตามร้าน เช่น `[storage_path]/restaurants/[restaurant_id]/menus/...` ป้องกันร้านอื่นเข้าถึงไฟล์ข้ามกัน และใช้คำนวณพื้นที่จัดเก็บได้

**ไฟล์ที่ต้องแก้:**
- `app/src/Controller/Menucontroller.ts`
- `app/src/router/menurouter.ts`
- `app/src/Controller/Admincontroller.ts` (method `uploaddata`)

---

### 9. แก้ไข Table Management ให้รองรับ Restaurant Scope
**สถานะ:** รอเริ่มงาน

**การเปลี่ยนแปลง:**
1. ทุก CRUD → เพิ่ม `WHERE restaurant_id = req.restaurantId`
2. `addtable` → inject `restaurant_id` จาก token

**ไฟล์ที่ต้องแก้:**
- `app/src/Controller/Tablescontroller.ts`
- `app/src/router/Tablerouter.ts`

---

### 10. แก้ไข Order System ให้รองรับ Restaurant Scope
**สถานะ:** รอเริ่มงาน

**การเปลี่ยนแปลง:**
1. `orderhistory` → `WHERE restaurant_id = req.restaurantId`
2. INSERT `orders` + `order_items` → inject `restaurant_id` จาก token
3. เพิ่ม DB trigger ตรวจ `order_items.restaurant_id` ตรงกับ `orders.restaurant_id` เสมอ

**ไฟล์ที่ต้องแก้:**
- `app/src/Controller/Ordercontroller.ts`
- `app/src/router/Orderrouter.ts`

---

## Phase 4: Testing (ควบคู่กับ Phase 3)

> ให้เขียน test ไปพร้อมกับแต่ละ task ใน Phase 3 ไม่ใช่ทำทีหลัง

### 11. อัปเดต Tests สำหรับ Multi-tenant System
**สถานะ:** รอเริ่มงาน

**ไฟล์ที่ต้องแก้/สร้าง:**
- `app/src/__tests__/setup.ts` — เพิ่ม `restaurants` table + `restaurant_id` ในทุก seed + สร้าง 2 restaurants เพื่อ test isolation
- `app/src/__tests__/auth.test.ts`
- `app/src/__tests__/admin.test.ts`
- `app/src/__tests__/menu.test.ts`
- `app/src/__tests__/order.test.ts`
- `app/src/__tests__/table.test.ts`
- `app/src/__tests__/restaurant.test.ts` ← ใหม่
- `app/src/__tests__/isolation.test.ts` ← ใหม่ (cross-tenant isolation ครบทุก endpoint)

**Test cases ที่ต้องเพิ่มต่อ suite:**

| Test Suite | Test Cases ใหม่ |
|------------|----------------|
| auth.test.ts | Login พร้อม restaurant context, JWT มี restaurant_id, multi-restaurant user เลือกร้าน |
| admin.test.ts | Admin เห็นเฉพาะ user ในร้านตัวเอง, ไม่สามารถ manage user ร้านอื่น |
| menu.test.ts | Menu isolate ต่อร้าน, cross-restaurant access ถูก block |
| table.test.ts | Table isolate ต่อร้าน, cross-restaurant access ถูก block |
| order.test.ts | Order isolate ต่อร้าน, order_items restaurant_id sync กับ orders |
| restaurant.test.ts | Register flow, approval flow, status transitions, slug uniqueness |
| isolation.test.ts | Cross-tenant isolation test ครบทุก endpoint |

---

## Phase 5: Frontend

### 12. แก้ไข Frontend ให้รองรับ Multi-tenant
**สถานะ:** รอเริ่มงาน

**URL Structure:**

| Path | คำอธิบาย |
|------|----------|
| `/restaurant/register` | หน้าสมัครร้านอาหารใหม่ |
| `/restaurant/pending` | หน้าแจ้งว่ารอ approve |
| `/app/:slug/admin` | Admin dashboard ของร้าน |
| `/app/:slug/menu` | หน้าเมนู (public, resolve restaurant จาก slug) |
| `/superadmin` | Super Admin dashboard |

**การเปลี่ยนแปลง:**
1. สร้าง `RestaurantContext` ที่เก็บ restaurant ที่ active อยู่
2. ถ้า user มีหลายร้าน → แสดง restaurant picker modal หลัง login
3. เก็บ restaurant slug ใน localStorage สำหรับ persist selection
4. แก้ Admin ให้แสดงข้อมูลเฉพาะ restaurant ที่เลือก
5. API calls ส่ง `restaurant_id` ผ่าน JWT (Authorization header) ไม่ใช่ body

**ไฟล์ที่ต้องแก้/สร้าง:**
- `frontend/src/app/layout.js` — wrap ด้วย `RestaurantProvider`
- `frontend/src/app/admin/page.jsx` — ปรับ scope
- `frontend/src/app/restaurant/register/page.jsx` ← ใหม่
- `frontend/src/app/restaurant/pending/page.jsx` ← ใหม่
- `frontend/src/components/RestaurantPicker.jsx` ← ใหม่
- `frontend/src/context/RestaurantContext.js` ← ใหม่
- `frontend/src/lib/api.js` — ส่ง `restaurant_id` ผ่าน JWT เท่านั้น

---

## Phase 6: Configuration & Operations

### 13. เพิ่ม Environment Variables และ Configuration
**สถานะ:** รอเริ่มงาน

```env
# Restaurant
DEFAULT_RESTAURANT_ID=1
SUPER_ADMIN_EMAIL=admin@restaurant.com
SUPER_ADMIN_PASSWORD=changeme_in_production
RESTAURANT_SIGNUP_ENABLED=true

# Database
DATABASE_URL=postgresql://...
DB_APP_ROLE=app_user  # role ที่ใช้กับ RLS

# Rate Limiting
RATE_LIMIT_PER_RESTAURANT_RPM=1000  # requests per minute per restaurant
```

**ไฟล์ที่ต้องแก้:**
- `app/.env` (หรือ `.env.example`)
- `app/package.json` — เพิ่ม scripts สำหรับ migration

### 14. Rate Limiting ต่อ Tenant ← เพิ่มใหม่
**สถานะ:** รอเริ่มงาน

- เพิ่ม rate limit แยกต่อ `restaurant_id` เพื่อป้องกัน noisy neighbor
- ใช้ Redis key: `rate:restaurant:{id}` สำหรับ sliding window counter
- Super Admin exempt จาก rate limit

---

## Phase 7: Monetization & Billing (เพื่อการขาย SaaS) ⬅️ เพิ่มใหม่

### 15. สร้างระบบ Billing และ Subscription
**สถานะ:** รอเริ่มงาน

**การเปลี่ยนแปลง:**
1. ผูกกับ Payment Gateway (เช่น Stripe, Omise)
2. สร้างหน้า Payment / Pricing Plan ให้ Owner เลือกอัปเกรด (Free -> Pro)
3. ระบบ Webhook รับสถานะการจ่ายเงินเพื่ออัปเดต `restaurants.plan` อัตโนมัติ
4. ระบบ Trial Period (เช่น ให้ใช้ Pro ฟรี 14 วัน ก่อนตัดเงิน หรือลด plan เป็น free)
5. ระงับการใช้งานฟีเจอร์พรีเมียมถ้าร้านค้าสถานะการจ่ายเงินไม่ผ่าน

**ไฟล์ที่ต้องสร้าง:**
- `app/src/Controller/BillingController.ts`
- `app/src/router/BillingRouter.ts`

---

## Phase 8: Future Enhancements ⬅️ เพิ่มใหม่

### 16. ระบบ Custom Domain สำหรับ Enterprise
**สถานะ:** รอเริ่มงานในอนาคต

**แนวคิด:**
- รองรับให้ร้านค้าเชื่อมโดเมนตัวเอง (เช่น `menu.somboon.com`) แทนการใช้แค่ `slug`
- ต้องมีตาราง `domains` ไว้ map hostname กลับไปหา `restaurant_id`
- ปรับ Middleware ให้เช็ค Host header ควบคู่กับ Slug

---

## ลำดับการทำงานแนะนำ

```
Phase 0 (Audit — ทำก่อนทุกอย่าง)
├── 0.1 Raw Query Audit
└── 0.2 RLS Strategy

Phase 1 (Database)
├── 1. Database Schema Design
└── 2. Migration Scripts (001–006)

Phase 2 (Backend Core)
├── 3. Restaurant Management API
├── 4. Authorization Middleware
└── 5. Super Admin Dashboard

Phase 3 + 4 (Existing Features + Tests — ทำควบคู่กัน)
├── 6. Auth System + tests
├── 7. Admin Controller + tests
├── 8. Menu System + tests
├── 9. Table Management + tests
└── 10. Order System + tests

Phase 5 (Frontend)
└── 12. Frontend Updates

Phase 6 (Configuration)
├── 13. Environment Variables
└── 14. Rate Limiting

Phase 7 (Monetization & Billing - New)
└── 15. Billing & Subscription System

Phase 8 (Future Enhancements)
└── 16. Custom Domain Support
```

---

## หมายเหตุสำคัญ

1. **Data Isolation:** ทุก query ต้องมี `WHERE restaurant_id = ?` — RLS เป็น fallback ไม่ใช่ primary mechanism
2. **restaurant_id Source:** ดึงจาก JWT เท่านั้น ห้ามเชื่อ client input
3. **Migration Safety:** ทุก migration ต้องอยู่ใน transaction + มี rollback script + test บน staging ก่อน production
4. **order_items Consistency:** เพิ่ม DB trigger ตรวจ `restaurant_id` ตรงกับ parent order เสมอ
5. **Performance:** เพิ่ม index บน `restaurant_id` ทุกตาราง และ composite index `(restaurant_id, created_at)` สำหรับ time-series queries
6. **Backward Compat:** เพิ่ม `restaurant_id` แบบ nullable ก่อน migrate แล้วค่อย NOT NULL
7. **Slug Usage:** ใช้ใน URL path (`/app/:slug`) สำหรับ public-facing pages — ต้อง resolve เป็น `restaurant_id` ก่อน query
8. **Multi-restaurant User:** JWT ออกใหม่ต่อ session ต่อร้าน — ถ้า user เป็น staff หลายร้านต้องเลือก context ก่อน
9. **Data Retention:** การลบร้านอาหารและข้อมูลสำคัญควรทำเป็น Soft Delete (เปลี่ยน status เป็น `deleted`) และเก็บข้อมูลไว้ระยะหนึ่งก่อน purge ทิ้งจริง ป้องกันการลบผิดพลาดหรือเพื่อกู้คืนข้อมูลให้ลูกค้า

---

*สร้างเมื่อ: 2026-04-27 | v2.0 — revised*
