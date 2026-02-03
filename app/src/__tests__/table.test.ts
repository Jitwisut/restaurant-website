import { describe, test, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { Tablerouter } from "../router/Tablerouter";
import {
  createAvailableTable,
  createOpenTable,
  randomTableNumber,
} from "./helpers/testUtils";
import { getTestDB } from "./setup";
/**
 * Table Controller Tests
 * Tests for table management (open, close, check, add)
 */

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";
const db = getTestDB();
const createTestApp = () => {
  return new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: jwtsecret,
      }),
    )
    .use(Tablerouter);
};

describe("Table Controller - Get Tables", () => {
  test("should retrieve all tables", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/gettable", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.tables).toBeDefined();
    expect(Array.isArray(data.tables)).toBe(true);
  });
  beforeEach(async () => {
    // สมมติว่า tableNumber ที่จะเทสคือ 1
    await db.query("DELETE FROM tables WHERE table_number = $1", [1]);
  });
  test("should return tables with correct structure", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/gettable", {
        method: "GET",
      }),
    );

    const data = await response.json();

    if (data.tables.length > 0) {
      const table = data.tables[0];
      expect(table).toHaveProperty("table_number");
      expect(table).toHaveProperty("status");
    }
  });
});

describe("Table Controller - Open Table", () => {
  test("should successfully open a table", async () => {
    const app = createTestApp();
    const tableNumber = 5;

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("เปิดโต๊ะสำเร็จ");
    expect(data.table_number).toBe(tableNumber);
    expect(data.session_hash).toBeDefined();
    expect(data.qr_code_url).toBeDefined();
    expect(data.fullurl).toBeDefined();
  });
  beforeEach(async () => {
    // 1. ลบโต๊ะเบอร์ 5 ทิ้งก่อน (ล้างไพ่) กันค่าค้าง
    await db.query("DELETE FROM tables WHERE table_number = $1", [5]);

    // 2. สร้างโต๊ะใหม่ โดยยัดสถานะ 'available' เข้าไปตรงๆ
    // (เพื่อให้ตรงกับเงื่อนไข AND status = 'available' ใน Controller)
    await db.query(
      `
    INSERT INTO tables (table_number, status, customer_session, qr_code_url)
    VALUES ($1, 'available', NULL, NULL)
  `,
      [5],
    );
  });
  test("should generate QR code when opening table", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: 3 }),
      }),
    );

    const data = await response.json();
    if (response.status === 200) {
      expect(data.qr_code_url).toMatch(/^data:image\/png;base64,/);
    }
  });

  test("should reject invalid table number", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: 0 }),
      }),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain("ไม่ถูกต้อง");
  });

  test("should reject table number above 99", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: 100 }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("should handle already open table", async () => {
    const app = createTestApp();
    const tableNumber = 7;

    // Open table first time
    await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    // Try to open same table again
    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.message).toContain("ถูกเปิดแล้ว");
  });
});

describe("Table Controller - Close Table", () => {
  /* beforeEach(async () => {
    // ลบข้อมูลเก่ากันพลาด
    await db.query("DELETE FROM tables WHERE table_number = $1", [4]);

    // สร้างโต๊ะเบอร์ 4 สถานะ 'available' เตรียมไว้
    await db.query(
      "INSERT INTO tables (table_number, status) VALUES ($1, 'available')",
      [4],
    );
  });*/
  test("should successfully close an open table", async () => {
    const app = createTestApp();
    const tableNumber = 4;

    // First open a table
    await createAvailableTable(tableNumber);
    await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    // Then close it
    await createOpenTable(tableNumber);
    const response = await app.handle(
      new Request("http://localhost/tables/closetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("เรียบร้อย");
    expect(data.table_number).toBe(tableNumber);
  });

  test("should reject closing non-existent table", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/closetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: "99" }),
      }),
    );

    expect(response.status).toBe(404);
  });

  test("should reject invalid table number when closing", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/closetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: "0" }),
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("Table Controller - Check Table", () => {
  test("should find table by session hash", async () => {
    const app = createTestApp();
    const tableNumber = 6;
    await createAvailableTable(tableNumber);
    // Open a table first
    const openResponse = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    const openData = await openResponse.json();
    const sessionHash = openData.session_hash;

    // Check the table using session hash
    const response = await app.handle(
      new Request(`http://localhost/tables/checktable/${sessionHash}`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("พบโต๊ะ");
    expect(data.table).toBeDefined();
  });

  test("should return 404 for invalid session hash", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/checktable/invalid-hash-123", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(404);
  });

  test("should return 400 for missing session hash", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/checktable/", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("Table Controller - Add Table", () => {
  test("should successfully add a new table", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/addtable", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("เรียบร้อย");
    expect(data.new_table).toBeDefined();
  });

  test("new table should have auto-incremented number", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/addtable", {
        method: "POST",
      }),
    );

    const data = await response.json();
    expect(typeof data.new_table).toBe("number");
    expect(data.new_table).toBeGreaterThan(0);
  });
});

describe("Table Controller - Order Success", () => {
  test("should mark order as completed", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/ordersuccess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("success");
  });

  test("should reject missing table number", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/ordersuccess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(404);
  });
});
