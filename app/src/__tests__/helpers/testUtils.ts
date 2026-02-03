import { expect } from "bun:test";
import { getTestDB } from "../setup";
/**
 * Helper function to create a test user
 */
const db = getTestDB();
export function createTestUser(overrides: any = {}) {
  return {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
    role: "user",
    ...overrides,
  };
}

/**
 * Helper function to create a test admin user
 */
export function createTestAdmin(overrides: any = {}) {
  return {
    username: "admin",
    email: "admin@example.com",
    password: "adminpass123",
    role: "admin",
    ...overrides,
  };
}

/**
 * Helper function to create a test kitchen user
 */
export function createTestKitchen(overrides: any = {}) {
  return {
    username: "kitchen",
    email: "kitchen@example.com",
    password: "kitchenpass123",
    role: "kitchen",
    ...overrides,
  };
}

/**
 * Helper function to create a test menu item
 */
export function createTestMenuItem(overrides: any = {}) {
  return {
    name: "Test Dish",
    price: "150",
    category: "Main Course",
    description: "A delicious test dish",
    ...overrides,
  };
}

/**
 * Helper function to create a mock image file
 */
export function createMockImageFile(filename = "test.jpg") {
  const buffer = Buffer.from("fake-image-data");
  return new File([buffer], filename, { type: "image/jpeg" });
}

/**
 * Helper to create a mock blob
 */
export function createMockBlob(data = "test-data", type = "image/jpeg") {
  return new Blob([data], { type });
}

/**
 * Helper to wait for async operations
 */
export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to generate random table number
 */
export function randomTableNumber() {
  return Math.floor(Math.random() * 99) + 1;
}

/**
 * Helper to create test order
 */
export function createTestOrder(overrides: any = {}) {
  return {
    table_number: 1,
    items: [
      {
        menu_item_name: "Test Dish",
        quantity: 2,
        price: "150",
      },
    ],
    ...overrides,
  };
}

/**
 * Custom matchers for API responses
 */
export function expectSuccessResponse(response: any) {
  expect(response).toBeDefined();
  expect(response.message).toBeDefined();
}

export function expectErrorResponse(response: any, status?: number) {
  expect(response).toBeDefined();
  expect(response.message).toBeDefined();
  if (status) {
    expect(response.status).toBe(status);
  }
}

/**
 * Helper to extract JWT payload without verification
 */
export function decodeJWT(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token");
  }
  const payload = Buffer.from(parts[1], "base64").toString();
  return JSON.parse(payload);
}
export const createAvailableTable = async (tableNumber: number) => {
  // ลบของเก่า (ถ้ามี)
  await db.query("DELETE FROM tables WHERE table_number = $1", [tableNumber]);
  // สร้างใหม่
  await db.query(
    "INSERT INTO tables (table_number, status) VALUES ($1, 'available')",
    [tableNumber],
  );
};

export const createOpenTable = async (tableNumber: number) => {
  await createAvailableTable(tableNumber); // สร้างโต๊ะเปล่าก่อน
  // อัปเดตให้เป็นสถานะ Open (จำลองว่ามีคนเปิดแล้ว)
  const sessionId = "test-session-hash-" + tableNumber;
  await db.query(
    `
        UPDATE tables 
        SET status = 'open', customer_session = $1, opened_at = NOW() 
        WHERE table_number = $2
    `,
    [sessionId, tableNumber],
  );

  // ต้อง insert session ด้วยเพราะ code คุณมีการ join หรือ check session
  await db.query(
    "INSERT INTO sessions (session_id, table_number, opened_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING",
    [sessionId, tableNumber],
  );
};
