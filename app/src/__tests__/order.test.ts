import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { randomUUID } from "crypto";
import { Orderrouter } from "../router/Orderrouter";
import { getTestDB } from "./setup";
import {
  authHeaders,
  createAvailableTable,
  ensureTestRestaurant,
  OTHER_RESTAURANT_ID,
  TEST_JWT_SECRET,
  TEST_RESTAURANT_ID,
} from "./helpers/testUtils";

const db = getTestDB();

const createTestApp = () => {
  return new Elysia()
    .use(jwt({ name: "jwt", secret: TEST_JWT_SECRET }))
    .use(Orderrouter);
};

async function seedOrder(restaurantId: number, tableNumber: number, orderId: string) {
  await ensureTestRestaurant(restaurantId);
  await createAvailableTable(tableNumber, restaurantId);
  const sessionId = randomUUID();
  await db.query(
    `INSERT INTO sessions (session_id, table_number, opened_at, restaurant_id)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT DO NOTHING`,
    [sessionId, tableNumber, restaurantId],
  );
  await db.query(
    `INSERT INTO orders (id, table_number, customer_session, status, restaurant_id)
     VALUES ($1, $2, $3, 'pending', $4)
     ON CONFLICT DO NOTHING`,
    [orderId, tableNumber, sessionId, restaurantId],
  );
  await db.query(
    `INSERT INTO order_items (order_id, menu_item_name, quantity, price, restaurant_id)
     VALUES ($1, 'Pad Thai', 2, 120, $2)`,
    [orderId, restaurantId],
  );
}

beforeEach(async () => {
  await ensureTestRestaurant(TEST_RESTAURANT_ID);
  await ensureTestRestaurant(OTHER_RESTAURANT_ID);
});

describe("Order Controller - Order History", () => {
  test("rejects order history without JWT", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    expect(response.status).toBe(401);
  });

  test("retrieves order history for the token restaurant", async () => {
    const app = createTestApp();
    const orderId = `ORD-TEST-${Date.now()}`;
    await seedOrder(TEST_RESTAURANT_ID, 11, orderId);

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ table_number: 11 }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.order)).toBe(true);
    expect(data.order.some((order: any) => order.id === orderId)).toBe(true);
  });

  test("does not leak orders from another restaurant", async () => {
    const app = createTestApp();
    const otherOrderId = `ORD-OTHER-${Date.now()}`;
    await seedOrder(OTHER_RESTAURANT_ID, 12, otherOrderId);

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.order.some((order: any) => order.id === otherOrderId)).toBe(false);
  });
});
