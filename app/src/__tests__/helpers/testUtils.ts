import { expect } from "bun:test";
import { createHmac, randomUUID } from "crypto";
import { getTestDB } from "../setup";

const db = getTestDB();

export const TEST_RESTAURANT_ID = 1;
export const OTHER_RESTAURANT_ID = 2;
export const TEST_JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createTestToken(overrides: any = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    username: "admin",
    email: "admin@example.com",
    role: "admin",
    restaurant_id: TEST_RESTAURANT_ID,
    iat: now,
    exp: now + 60 * 60,
    ...overrides,
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", TEST_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

export function authHeaders(overrides: any = {}) {
  return {
    Authorization: `Bearer ${createTestToken(overrides)}`,
  };
}

export async function ensureTestRestaurant(
  restaurantId = TEST_RESTAURANT_ID,
  overrides: any = {},
) {
  await db.query(
    `INSERT INTO restaurants (id, name, slug, status, plan)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         status = EXCLUDED.status,
         plan = EXCLUDED.plan`,
    [
      restaurantId,
      overrides.name || `Test Restaurant ${restaurantId}`,
      overrides.slug || `test-restaurant-${restaurantId}`,
      overrides.status || "active",
      overrides.plan || "free",
    ],
  );
  await db.query(
    `INSERT INTO subscriptions (
      restaurant_id,
      plan_code,
      billing_interval,
      status,
      current_period_start,
      current_period_end,
      grace_ends_at,
      last_payment_at,
      updated_at
    )
     VALUES ($1, $2, 'monthly', $3, NOW(), NOW() + INTERVAL '30 day', NOW() + INTERVAL '37 day', NOW(), NOW())
     ON CONFLICT (restaurant_id) DO UPDATE
     SET plan_code = EXCLUDED.plan_code,
         status = EXCLUDED.status,
         updated_at = NOW()`,
    [
      restaurantId,
      overrides.subscription_plan || "starter",
      overrides.subscription_status || "active",
    ],
  );
}

export async function setTestSubscription(
  restaurantId = TEST_RESTAURANT_ID,
  overrides: any = {},
) {
  const { status: _subscriptionStatus, ...restaurantOverrides } = overrides;
  await ensureTestRestaurant(restaurantId, restaurantOverrides);
  await db.query(
    `UPDATE subscriptions
        SET status = COALESCE($2, status),
            current_period_end = COALESCE($3, current_period_end),
            grace_ends_at = COALESCE($4, grace_ends_at),
            renewal_requested_at = $5,
            renewal_request_note = $6,
            updated_at = NOW()
      WHERE restaurant_id = $1`,
    [
      restaurantId,
      overrides.status || null,
      overrides.current_period_end || null,
      overrides.grace_ends_at || null,
      overrides.renewal_requested_at || null,
      overrides.renewal_request_note || null,
    ],
  );
}

export function createTestUser(overrides: any = {}) {
  return {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
    role: "user",
    ...overrides,
  };
}

export function createTestAdmin(overrides: any = {}) {
  const suffix = Date.now();
  return {
    username: "admin",
    email: "admin@example.com",
    password: "adminpass123",
    role: "admin",
    restaurant_name: `Test Admin Restaurant ${suffix}`,
    restaurant_slug: `test-admin-restaurant-${suffix}`,
    ...overrides,
  };
}

export function createTestKitchen(overrides: any = {}) {
  return {
    username: "kitchen",
    email: "kitchen@example.com",
    password: "kitchenpass123",
    role: "kitchen",
    ...overrides,
  };
}

export function createTestMenuItem(overrides: any = {}) {
  return {
    name: "Test Dish",
    price: "150",
    category: "Main Course",
    description: "A delicious test dish",
    ...overrides,
  };
}

export function createMockImageFile(filename = "test.jpg") {
  const buffer = Buffer.from("fake-image-data");
  return new File([buffer], filename, { type: "image/jpeg" });
}

export function createMockBlob(data = "test-data", type = "image/jpeg") {
  return new Blob([data], { type });
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomTableNumber() {
  return Math.floor(Math.random() * 99) + 1;
}

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

export function decodeJWT(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token");
  }
  const payload = Buffer.from(parts[1], "base64").toString();
  return JSON.parse(payload);
}

export const createAvailableTable = async (
  tableNumber: number,
  restaurantId = TEST_RESTAURANT_ID,
) => {
  await ensureTestRestaurant(restaurantId);
  await db.query(
    `DELETE FROM order_items
      WHERE order_id IN (
        SELECT id FROM orders WHERE table_number = $1 AND restaurant_id = $2
      )`,
    [tableNumber, restaurantId],
  );
  await db.query("DELETE FROM orders WHERE table_number = $1 AND restaurant_id = $2", [
    tableNumber,
    restaurantId,
  ]);
  await db.query("DELETE FROM sessions WHERE table_number = $1 AND restaurant_id = $2", [
    tableNumber,
    restaurantId,
  ]);
  await db.query("DELETE FROM tables WHERE table_number = $1 AND restaurant_id = $2", [
    tableNumber,
    restaurantId,
  ]);
  await db.query(
    "INSERT INTO tables (table_number, status, restaurant_id) VALUES ($1, 'available', $2)",
    [tableNumber, restaurantId],
  );
};

export const createOpenTable = async (
  tableNumber: number,
  restaurantId = TEST_RESTAURANT_ID,
) => {
  await createAvailableTable(tableNumber, restaurantId);
  const sessionId = randomUUID();
  await db.query(
    `UPDATE tables
        SET status = 'open', customer_session = $1, opened_at = NOW()
      WHERE table_number = $2 AND restaurant_id = $3`,
    [sessionId, tableNumber, restaurantId],
  );
  await db.query(
    `INSERT INTO sessions (session_id, table_number, opened_at, restaurant_id)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT DO NOTHING`,
    [sessionId, tableNumber, restaurantId],
  );
  return sessionId;
};
