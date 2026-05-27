import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { randomUUID } from "crypto";
import { Orderrouter } from "../router/Orderrouter";
import { getTestDB } from "./setup";
import {
  authHeaders,
  createAvailableTable,
  createOpenTable,
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

  test("active kitchen queue excludes orders already marked ready", async () => {
    const app = createTestApp();
    const sessionId = await createOpenTable(13, TEST_RESTAURANT_ID);
    const pendingOrderId = `ORD-ACTIVE-PENDING-${Date.now()}`;
    const readyOrderId = `ORD-ACTIVE-READY-${Date.now()}`;

    await db.query(
      `INSERT INTO orders (id, table_number, customer_session, status, restaurant_id)
       VALUES
         ($1, 13, $3, 'preparing', $4),
         ($2, 13, $3, 'ready', $4)`,
      [pendingOrderId, readyOrderId, sessionId, TEST_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request("http://localhost/order/active", {
        method: "GET",
        headers: authHeaders({ role: "kitchen" }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    const ids = data.order.map((order: any) => order.id);
    expect(ids).toContain(pendingOrderId);
    expect(ids).not.toContain(readyOrderId);
  });

  test("active kitchen queue excludes stale orders from closed table sessions", async () => {
    const app = createTestApp();
    const sessionId = randomUUID();
    const staleOrderId = `ORD-ACTIVE-STALE-${Date.now()}`;

    await createAvailableTable(14, TEST_RESTAURANT_ID);
    await db.query(
      `UPDATE tables
          SET status = 'available',
              customer_session = NULL,
              opened_at = NULL
        WHERE table_number = $1
          AND restaurant_id = $2`,
      [14, TEST_RESTAURANT_ID],
    );
    await db.query(
      `INSERT INTO sessions (session_id, table_number, opened_at, closed_at, restaurant_id)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', NOW(), $3)
       ON CONFLICT DO NOTHING`,
      [sessionId, 14, TEST_RESTAURANT_ID],
    );
    await db.query(
      `INSERT INTO orders (id, table_number, customer_session, status, restaurant_id)
       VALUES ($1, 14, $2, 'preparing', $3)`,
      [staleOrderId, sessionId, TEST_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request("http://localhost/order/active", {
        method: "GET",
        headers: authHeaders({ role: "kitchen" }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.order.some((order: any) => order.id === staleOrderId)).toBe(
      false,
    );
  });

  test("ready-to-serve queue returns ready orders and served orders disappear", async () => {
    const app = createTestApp();
    const sessionId = await createOpenTable(15, TEST_RESTAURANT_ID);
    const readyOrderId = `ORD-SERVE-READY-${Date.now()}`;

    await db.query(
      `INSERT INTO orders (id, table_number, customer_session, status, restaurant_id)
       VALUES ($1, 15, $2, 'ready', $3)`,
      [readyOrderId, sessionId, TEST_RESTAURANT_ID],
    );

    const readyResponse = await app.handle(
      new Request("http://localhost/order/ready-to-serve", {
        method: "GET",
        headers: authHeaders({ role: "staff" }),
      }),
    );

    expect(readyResponse.status).toBe(200);
    const readyData = await readyResponse.json();
    expect(readyData.order.some((order: any) => order.id === readyOrderId)).toBe(true);

    const servedResponse = await app.handle(
      new Request(`http://localhost/order/${readyOrderId}/served`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders({ role: "staff" }) },
        body: JSON.stringify({}),
      }),
    );

    expect(servedResponse.status).toBe(200);
    const servedOrder = await db.query("SELECT status FROM orders WHERE id=$1", [
      readyOrderId,
    ]);
    expect(servedOrder.rows[0].status).toBe("served");

    const afterResponse = await app.handle(
      new Request("http://localhost/order/ready-to-serve", {
        method: "GET",
        headers: authHeaders({ role: "staff" }),
      }),
    );
    const afterData = await afterResponse.json();
    expect(afterData.order.some((order: any) => order.id === readyOrderId)).toBe(false);
  });

  test("kitchen cannot mark a ready order served", async () => {
    const app = createTestApp();
    const sessionId = await createOpenTable(16, TEST_RESTAURANT_ID);
    const readyOrderId = `ORD-SERVE-KITCHEN-${Date.now()}`;

    await db.query(
      `INSERT INTO orders (id, table_number, customer_session, status, restaurant_id)
       VALUES ($1, 16, $2, 'ready', $3)`,
      [readyOrderId, sessionId, TEST_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request(`http://localhost/order/${readyOrderId}/served`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders({ role: "kitchen" }) },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
  });
});
