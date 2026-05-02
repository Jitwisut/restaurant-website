# 🍽️ Restaurant Management System

ระบบจัดการร้านอาหารแบบ Full-Stack รองรับการสั่งอาหารผ่าน QR Code, การจัดการโต๊ะแบบ Real-time ผ่าน WebSocket และหน้าจอครัวสำหรับรับออเดอร์

## 📋 สารบัญ

- [ภาพรวมระบบ](#-ภาพรวมระบบ)
- [Technology Stack](#-technology-stack)
- [โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
- [การติดตั้งและรัน](#-การติดตั้งและรัน)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
- [WebSocket Events](#-websocket-events)
- [Database Schema](#-database-schema)

---

## 🧩 ภาพรวมระบบ

ระบบประกอบด้วย 2 ส่วนหลัก:

| ส่วน | คำอธิบาย | Port |
|------|---------|------|
| **Backend** (`/app`) | REST API + WebSocket Server | `4000` |
| **Frontend** (`/frontend`) | หน้าเว็บสำหรับลูกค้า, พนักงาน และแอดมิน | `3000` |

### Flow การใช้งาน

```
แอดมินเปิดโต๊ะ → สร้าง QR Code → ลูกค้าสแกน QR → สั่งอาหารผ่าน WebSocket
    → ครัวรับออเดอร์ Real-time → อัปเดตสถานะ → ลูกค้าเห็นสถานะทันที
```

---

## 🛠 Technology Stack

### Backend

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|--------|
| **Bun** | latest | JavaScript Runtime |
| **Elysia** | ^1.4.18 | Web Framework |
| **PostgreSQL** | - | ฐานข้อมูลหลัก (ผ่าน `pg`) |
| **@elysiajs/jwt** | ^1.3.0 | Authentication (JWT) |
| **@elysiajs/cors** | ^1.3.3 | Cross-Origin Resource Sharing |
| **elysiajs-helmet** | ^1.0.2 | Security Headers |
| **elysia-rate-limit** | ^4.4.2 | Rate Limiting |
| **bcryptjs** | ^3.0.2 | Password Hashing |
| **qrcode** | ^1.5.4 | สร้าง QR Code |
| **nanoid** | ^5.1.5 | สร้าง Unique ID |

### Frontend

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|--------|
| **Next.js** | 16.0.10 | React Framework |
| **React** | ^19.2.1 | UI Library |
| **Tailwind CSS** | v4 | Styling |
| **shadcn/ui** | ^3.4.2 | UI Components |
| **Motion** (Framer Motion) | ^12.23.24 | Animations |
| **Axios** | ^1.8.4 | HTTP Client |
| **Clerk** | ^6.14.3 | Authentication (Frontend) |
| **SweetAlert2** | ^11.6.13 | Alert Dialogs |
| **react-hot-toast** | ^2.6.0 | Toast Notifications |
| **Lucide React** | ^0.546.0 | Icons |
| **Font Awesome** | ^6.7.2 | Icons |

---

## 📁 โครงสร้างโปรเจกต์

```
restaurant-website/
├── app/                          # 🔧 Backend (Elysia + Bun)
│   ├── src/
│   │   ├── index.ts              # Entry point - ตั้งค่า Server
│   │   ├── Controller/           # Business Logic
│   │   │   ├── Admincontroller.ts    # จัดการ User, อัปโหลดเมนู
│   │   │   ├── Authcontroller.ts     # Login / Register
│   │   │   ├── Menucontroller.ts     # ดึงข้อมูลเมนู
│   │   │   ├── Ordercontroller.ts    # จัดการ Order
│   │   │   ├── Profilecontroller.ts  # ข้อมูลโปรไฟล์
│   │   │   └── Tablescontroller.ts   # เปิด/ปิดโต๊ะ, QR Code
│   │   ├── router/               # Route Definitions
│   │   │   ├── Auth.ts               # /signin, /signup
│   │   │   ├── Adminrouter.ts        # /admin/*
│   │   │   ├── Tablerouter.ts        # /table/*
│   │   │   ├── Orderrouter.ts        # /order/*
│   │   │   ├── menurouter.ts         # /menu/*
│   │   │   ├── Profilerouter.ts      # /profile/*
│   │   │   ├── middlewarerouter.ts    # Middleware routes
│   │   │   └── websocket.ts          # WebSocket handler
│   │   ├── middleware/           # Middleware
│   │   │   ├── onlyadmin.ts          # Admin-only guard
│   │   │   └── Afterhanler.ts        # After handler
│   │   ├── lib/                  # Utilities
│   │   │   ├── connect.ts            # PostgreSQL connection pool
│   │   │   └── rateLimite.ts         # Rate limiter config
│   │   └── type/                 # TypeScript Types
│   │       └── type.ts
│   ├── __tests__/                # Test files
│   ├── Dockerfile                # Docker config (Bun)
│   └── package.json
│
├── frontend/                     # 🎨 Frontend (Next.js)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.jsx              # หน้าหลัก (Landing)
│   │   │   ├── layout.js             # Root Layout
│   │   │   ├── globals.css           # Global Styles
│   │   │   ├── admin/                # หน้าแอดมิน
│   │   │   ├── kitchen/              # หน้าจอครัว
│   │   │   ├── order/                # หน้าสั่งอาหาร (ลูกค้า)
│   │   │   ├── orders/               # หน้าดูรายการ Order
│   │   │   ├── tables/               # หน้าจัดการโต๊ะ
│   │   │   ├── profile/              # หน้าโปรไฟล์
│   │   │   ├── signin/               # หน้า Login
│   │   │   ├── signup/               # หน้า Register
│   │   │   ├── wellcome/             # หน้า Welcome
│   │   │   ├── table-closed/         # หน้าแจ้งปิดโต๊ะ
│   │   │   └── components/           # Page-specific Components
│   │   │       ├── Sidebar.jsx           # Navigation Sidebar
│   │   │       ├── Sidebar2.jsx          # Alternative Sidebar
│   │   │       ├── CallStaff.jsx         # ปุ่มเรียกพนักงาน
│   │   │       └── menupload.jsx         # ฟอร์มอัปโหลดเมนู
│   │   ├── components/ui/        # shadcn/ui Components
│   │   │   ├── button.jsx, card.jsx, input.jsx, ...
│   │   └── lib/                  # Utilities
│   ├── public/                   # Static Assets
│   ├── Dockerfile                # Docker config (Node.js)
│   └── package.json
│
├── .env                          # Environment Variables
├── tsconfig.json                 # TypeScript Config
└── package.json                  # Root package.json
```

---

## 🚀 การติดตั้งและรัน

### ข้อกำหนดเบื้องต้น

- [Bun](https://bun.sh/) (สำหรับ Backend)
- [Node.js](https://nodejs.org/) v20+ (สำหรับ Frontend)
- [PostgreSQL](https://www.postgresql.org/) ฐานข้อมูล

### 1. Clone โปรเจกต์

```bash
git clone <repository-url>
cd restaurant-website
```

### 2. ติดตั้ง Backend

```bash
cd app
bun install
```

### 3. ติดตั้ง Frontend

```bash
cd frontend
npm install
```

### 4. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์:

```env
JWT_SECRET=your_jwt_secret
PORT=4000
ORIGIN_URL=http://localhost:3000
ORIGIN_URL2=http://localhost:3000
DATABASE_URL=postgresql://username:password@localhost:5432/restaurant
```

สร้างไฟล์ `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_WS=ws://localhost:4000
```

### 5. รัน Development Server

**Backend:**
```bash
cd app
bun run dev
# 🦊 Elysia is running at 0.0.0.0:4000
```

**Frontend:**
```bash
cd frontend
npm run dev
# ▲ Next.js running at http://localhost:3000
```

### 6. รันด้วย Docker (ทางเลือก)

**Backend:**
```bash
cd app
docker build -t restaurant-backend .
docker run -p 8000:8000 --env-file ../.env restaurant-backend
```

**Frontend:**
```bash
cd frontend
docker build -t restaurant-frontend .
docker run -p 3000:3000 restaurant-frontend
```

---

## 🔑 Environment Variables

### Backend (`.env`)

| ตัวแปร | คำอธิบาย | ตัวอย่าง |
|--------|---------|---------|
| `JWT_SECRET` | Secret key สำหรับ JWT | `your_secret_key` |
| `PORT` | Port ของ Backend | `4000` |
| `ORIGIN_URL` | URL ของ Frontend (Production) | `https://your-frontend.vercel.app` |
| `ORIGIN_URL2` | URL ของ Frontend (Development) | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL Connection String | `postgresql://user:pass@host:5432/db` |

### Frontend (`frontend/.env.local`)

| ตัวแปร | คำอธิบาย | ตัวอย่าง |
|--------|---------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | URL ของ Backend API | `http://localhost:4000` |
| `NEXT_PUBLIC_API_WS` | WebSocket URL ของ Backend | `ws://localhost:4000` |

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `POST` | `/signin` | เข้าสู่ระบบ | ❌ |
| `POST` | `/signup` | สมัครสมาชิก | ❌ |

### Tables (โต๊ะ)

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/table` | ดึงข้อมูลโต๊ะทั้งหมด | ✅ |
| `POST` | `/table/open` | เปิดโต๊ะ + สร้าง QR Code | ✅ Admin |
| `POST` | `/table/close` | ปิดโต๊ะ | ✅ Admin |
| `GET` | `/table/check/:session` | ตรวจสอบ Session โต๊ะ | ❌ |
| `POST` | `/table/add` | เพิ่มโต๊ะใหม่ | ✅ Admin |

### Menu (เมนู)

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/menu` | ดึงรายการเมนูทั้งหมด | ❌ |

### Orders (ออเดอร์)

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/orders` | ดึงรายการ Order ทั้งหมด | ✅ |

### Admin

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/admin/users` | ดึงรายชื่อ User ทั้งหมด | ✅ Admin |
| `POST` | `/admin/create` | สร้าง User ใหม่ | ✅ Admin |
| `PUT` | `/admin/update` | แก้ไขข้อมูล User | ✅ Admin |
| `DELETE` | `/admin/delete` | ลบ User | ✅ Admin |
| `POST` | `/admin/upload` | อัปโหลดเมนูอาหาร | ✅ Admin |

### Profile

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/profile` | ดึงข้อมูลโปรไฟล์ | ✅ |

### WebSocket

| Endpoint | คำอธิบาย |
|----------|---------|
| `ws://host:port/ws?role=<role>&username=<name>` | เชื่อมต่อ WebSocket |

---

## ✨ ฟีเจอร์หลัก

### 🪑 จัดการโต๊ะ (Table Management)
- เปิด/ปิดโต๊ะ พร้อมสร้าง **QR Code** อัตโนมัติ
- ลูกค้าสแกน QR Code เพื่อเข้าสู่หน้าสั่งอาหาร
- ระบบ Session ด้วย UUID สำหรับแต่ละโต๊ะ
- เพิ่มโต๊ะใหม่ได้แบบ Dynamic

### 📱 สั่งอาหาร Real-time (Order System)
- สั่งอาหารผ่าน WebSocket — ไม่ต้อง Refresh หน้า
- ครัวรับออเดอร์ทันทีแบบ Real-time
- รองรับสถานะ: `accepted`, `preparing`, `done`, `rejected`
- เก็บ Order ลงฐานข้อมูลพร้อม Order ID อัตโนมัติ

### 👨‍🍳 หน้าจอครัว (Kitchen Display)
- รับออเดอร์ผ่าน WebSocket แบบ Live
- อัปเดตสถานะออเดอร์ส่งกลับลูกค้าทันที

### 🔔 เรียกพนักงาน (Call Staff)
- ลูกค้ากดเรียกพนักงานผ่าน WebSocket
- แอดมินได้รับการแจ้งเตือนทันที

### 👤 ระบบผู้ใช้ (User Management)
- **3 บทบาท**: `admin`, `user`, `kitchen`
- Login/Register ด้วย JWT
- Password hashing ด้วย bcryptjs
- Role-based access control (Admin-only middleware)

### 🛡️ ความปลอดภัย (Security)
- **JWT Authentication** พร้อม Refresh Token
- **CORS** จำกัด Origin
- **Helmet** สำหรับ Security Headers
- **Rate Limiting** ป้องกัน Brute-force
- **bcryptjs** สำหรับ Hash รหัสผ่าน

---

## 🔌 WebSocket Events

### Client → Server

| Type | คำอธิบาย | Payload |
|------|---------|---------|
| `ping` | Heartbeat | `{ type: "ping" }` |
| `order` | สั่งอาหาร | `{ type: "order", menu: [...], table_number, session }` |
| `message` | ส่งข้อความ | `{ type: "message", to, content }` |
| `call_staff` | เรียกพนักงาน | `{ type: "call_staff", table_number }` |
| `order_status` | อัปเดตสถานะ | `{ type: "order_status", order_id, status, to }` |

### Server → Client

| Type | คำอธิบาย |
|------|---------|
| `pong` | ตอบกลับ Heartbeat |
| `new_order` | ออเดอร์ใหม่เข้า (ส่งให้ Kitchen + Admin) |
| `order_status` | สถานะออเดอร์อัปเดต |
| `call_staff` | การแจ้งเตือนเรียกพนักงาน |
| `table_closed` | โต๊ะถูกปิด |

### Roles

- **`user`** — ลูกค้า: สั่งอาหาร, เรียกพนักงาน
- **`kitchen`** — ครัว: รับออเดอร์, อัปเดตสถานะ
- **`admin`** — แอดมิน: จัดการโต๊ะ, ดู Dashboard

---

## 🗄️ Database Schema

### Tables

| Table | คำอธิบาย |
|-------|---------|
| `users` | ข้อมูลผู้ใช้ (username, email, password, role) |
| `tables` | ข้อมูลโต๊ะ (table_number, status, customer_session, qr_code_url) |
| `sessions` | Session ของโต๊ะ (session_id, table_number, opened_at, closed_at) |
| `orders` | ออเดอร์ (id, customer_session, table_number, status) |
| `order_items` | รายการในออเดอร์ (menu_item_name, quantity, price, notes) |
| `menu_new` | เมนูอาหาร (name, price, image_blob, category, description) |

---

## 🧪 การทดสอบ

### Backend Tests

```bash
cd app
bun test
```

---

## 🌐 Deployment

- **Frontend**: Deploy บน [Vercel](https://vercel.com)
- **Backend**: Deploy บน [Render](https://render.com) หรือใช้ Docker
- **Database**: ใช้ [Neon](https://neon.tech) สำหรับ PostgreSQL แบบ Serverless

---

## 📄 License

This project is for educational purposes.