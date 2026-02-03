# สรุปการแก้ไข Test Database Connection

## 📋 สรุปปัญหา

Tests ไม่สามารถเชื่อมต่อกับฐานข้อมูล `restaurant_test` ได้ เนื่องจาก:
1. ฐานข้อมูล `restaurant_test` ยังไม่มี schema (ไม่มี tables)
2. Test endpoints ไม่ตรงกับ router configuration
3. HTTP methods ที่ใช้ใน tests ไม่ตรงกับที่กำหนดใน router

## ✅ การแก้ไขที่ทำ

### 1. สร้าง Database Schema

**ไฟล์:** [init-test-db.ts](file:///e:/restaurant-website/app/src/__tests__/init-test-db.ts) (ไฟล์ใหม่)

สร้างสคริปต์เพื่อ initialize ฐานข้อมูล test โดยใช้ `setupTestDB()` ที่มีอยู่แล้วใน [setup.ts](file:///e:/restaurant-website/app/src/__tests__/setup.ts)

**วิธีใช้:**
```bash
bun run src/__tests__/init-test-db.ts
```

**ผลลัพธ์:** สร้าง tables ทั้งหมดใน `restaurant_test` database:
- `users`
- `menu_new`
- `tables`
- `sessions`
- `orders`
- `order_items`

### 2. สร้าง Database Connection Test

**ไฟล์:** [db-connection.test.ts](file:///e:/restaurant-website/app/src/__tests__/db-connection.test.ts) (ไฟล์ใหม่)

สร้าง tests เพื่อตรวจสอบการเชื่อมต่อฐานข้อมูล:
- ✅ ตรวจสอบว่าเชื่อมต่อกับ `restaurant_test` database
- ✅ ตรวจสอบว่าสามารถ query users table ได้
- ✅ ตรวจสอบว่าสามารถ insert และ delete ข้อมูลได้

### 3. แก้ไข API Endpoints และ HTTP Methods

**ไฟล์:** [admin.test.ts](file:///e:/restaurant-website/app/src/__tests__/admin.test.ts)

#### การเปลี่ยนแปลง:

| การแก้ไข | Code เก่า | Code ใหม่ | บรรทัด |
|---------|----------|----------|--------|
| **Update User Method** | `method: "PUT"` | `method: "POST"` | 234, 271 |
| **Delete User Endpoint** | `/admin/deletedata` | `/admin/deleteuser` | 306, 324 |
| **Delete User Method** | `method: "DELETE"` | `method: "POST"` | 307, 326 |
| **Upload Menu Endpoint** | `/admin/uploaddata` | `/admin/upload-menu` | 350, 369, 386, 406 |

#### รายละเอียดการแก้ไข:

**🔧 แก้ไข #1: Update User - เปลี่ยน PUT เป็น POST**
```diff
  const response = await app.handle(
      new Request("http://localhost/admin/updateuser", {
-         method: "PUT",
+         method: "POST",
          headers: { "Content-Type": "application/json" },
```
- บรรทัด 234 (test: "should successfully update user")
- บรรทัด 271 (test: "should update user role")

**🔧 แก้ไข #2: Delete User - เปลี่ยน endpoint และ method**
```diff
  const response = await app.handle(
-     new Request("http://localhost/admin/deletedata", {
-         method: "DELETE",
+     new Request("http://localhost/admin/deleteuser", {
+         method: "POST",
          headers: { "Content-Type": "application/json" },
```
- บรรทัด 306-307 (test: "should successfully delete user")
- บรรทัด 324-326 (test: "should reject delete without username")

**🔧 แก้ไข #3: Upload Menu - เปลี่ยน endpoint**
```diff
  const response = await app.handle(
-     new Request("http://localhost/admin/uploaddata", {
+     new Request("http://localhost/admin/upload-menu", {
          method: "POST",
```
- บรรทัด 350 (test: "should successfully upload menu item")
- บรรทัด 369 (test: "should reject menu upload without name")
- บรรทัด 386 (test: "should reject menu upload without price")
- บรรทัด 406 (test: "should handle image upload correctly")

## 📊 ผลการทดสอบ

### ก่อนแก้ไข:
```
❌ 15 fail
✅ 1 pass
```

### หลังแก้ไข:
```
✅ 16 pass
❌ 0 fail
```

## 🎯 สาเหตุของปัญหา

ปัญหาเกิดจากความไม่ตรงกันระหว่าง **Router Configuration** และ **Test Code**:

### Router Configuration ([Adminrouter.ts](file:///e:/restaurant-website/app/src/router/Adminrouter.ts))

```typescript
export const Adminrouter = (app: Elysia) => {
  return app.group("/admin", (app) => {
    app
      .get("/getuser", Admincontroller.getalluser)
      .post("/updateuser", Admincontroller.updateuser)     // ใช้ POST ไม่ใช่ PUT
      .post("/createuser", Admincontroller.createuser)
      .post("/upload-menu", Admincontroller.uploaddata)    // endpoint คือ upload-menu
      .post("/deleteuser", Admincontroller.deletedata);    // ใช้ POST และ endpoint คือ deleteuser
    return app;
  });
};
```

## 📁 ไฟล์ที่เกี่ยวข้อง

### ไฟล์ที่แก้ไข:
1. [admin.test.ts](file:///e:/restaurant-website/app/src/__tests__/admin.test.ts) - แก้ไข endpoints และ HTTP methods

### ไฟล์ใหม่:
1. [init-test-db.ts](file:///e:/restaurant-website/app/src/__tests__/init-test-db.ts) - สคริปต์ initialize database
2. [db-connection.test.ts](file:///e:/restaurant-website/app/src/__tests__/db-connection.test.ts) - ทดสอบการเชื่อมต่อ database

### ไฟล์ที่ใช้อยู่แล้ว:
1. [setup.ts](file:///e:/restaurant-website/app/src/__tests__/setup.ts) - มี functions สำหรับจัดการ test database
2. [.env.test](file:///e:/restaurant-website/app/.env.test) - มีการตั้งค่าเชื่อมต่อ database อยู่แล้ว
3. [connect.ts](file:///e:/restaurant-website/app/src/lib/connect.ts) - ใช้ `DATABASE_URL_test` เชื่อมต่อ database อยู่แล้ว

## 🔍 การตรวจสอบ

### ตรวจสอบว่า Database เชื่อมต่อถูกต้อง:
```bash
bun test src/__tests__/db-connection.test.ts
```

### รัน Admin Tests:
```bash
bun test src/__tests__/admin.test.ts
```

### รัน Tests ทั้งหมด:
```bash
bun test
```

## 💡 บันทึกเพิ่มเติม

- ✅ Database `restaurant_test` ถูกสร้างและพร้อมใช้งานแล้ว
- ✅ ตัวแปร environment ใน `.env.test` ตั้งค่าถูกต้องแล้ว:
  ```
  DATABASE_URL_test=postgresql://postgres:0805555za@localhost:5432/restaurant_test
  ```
- ✅ `connect.ts` ใช้ `Bun.env.DATABASE_URL_test` อยู่แล้ว ทำให้ tests เชื่อมต่อกับ database ที่ถูกต้อง

## 📝 สรุป

การแก้ไขครั้งนี้ทำให้:
1. ✅ Tests สามารถเชื่อมต่อกับฐานข้อมูล `restaurant_test` ได้สำเร็จ
2. ✅ Tests ทั้งหมดใช้ endpoints และ HTTP methods ที่ถูกต้อง
3. ✅ มีสคริปต์สำหรับ initialize test database
4. ✅ มี tests สำหรับตรวจสอบการเชื่อมต่อ database

**ผลลัพธ์:** Admin tests ทั้งหมด 16 tests ผ่านหมด! 🎉
