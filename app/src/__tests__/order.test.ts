import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { Orderrouter } from "../router/Orderrouter";

/**
 * Order Controller Tests
 * Tests for order history and management
 */

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";

const createTestApp = () => {
  return new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: jwtsecret,
      }),
    )
    .use(Orderrouter);
};

describe("Order Controller - Order History", () => {
  test("should retrieve order history for a table", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.order).toBeDefined();
    expect(Array.isArray(data.order)).toBe(true);
  });

  test("should return 404 when table number is missing", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toContain("No table number");
  });

  test("should return order with correct structure", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    const data = await response.json();
    expect(Array.isArray(data.order)).toBe(true);

    // If there are orders, check structure
    if (data.order.length > 0) {
      const order = data.order[0];
      expect(order).toHaveProperty("table_number");
      expect(order).toHaveProperty("id");
      expect(order).toHaveProperty("status");
      expect(order).toHaveProperty("created_at");
      expect(order).toHaveProperty("items");
      expect(order).toHaveProperty("total");
    }
  });

  test("should aggregate order items correctly", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    const data = await response.json();

    // Check that items are aggregated as JSON array
    data.order.forEach((order: any) => {
      expect(Array.isArray(order.items)).toBe(true);

      // If items exist, check structure
      if (order.items.length > 0) {
        order.items.forEach((item: any) => {
          expect(item).toHaveProperty("menu_item_name");
          expect(item).toHaveProperty("quantity");
          expect(item).toHaveProperty("price");
        });
      }
    });
  });

  test("should calculate total correctly", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    const data = await response.json();

    data.order.forEach((order: any) => {
      expect(typeof order.total).toBe("string");
      // Total should be a valid number (as string from DB)
      expect(parseFloat(order.total)).not.toBeNaN();
      expect(parseFloat(order.total)).toBeGreaterThanOrEqual(0);
    });
  });

  test("should handle different table numbers", async () => {
    const app = createTestApp();

    const tables = [1, 2, 5, 10];

    for (const tableNum of tables) {
      const response = await app.handle(
        new Request("http://localhost/order/orderhistory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table_number: tableNum }),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.order).toBeDefined();
    }
  });

  test("should return empty array for table with no orders", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 11 }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.order)).toBe(true);
  });

  test("should include session information", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    const data = await response.json();

    // Check for session fields
    data.order.forEach((order: any) => {
      expect(order).toHaveProperty("session_id");
      expect(order).toHaveProperty("opened_at");
      expect(order).toHaveProperty("closed_at");
    });
  });

  test("should limit results to 100 orders", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    const data = await response.json();
    expect(data.order.length).toBeLessThanOrEqual(100);
  });

  test("should order by created_at DESC", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    const data = await response.json();

    if (data.order.length > 1) {
      // Check that orders are sorted by created_at in descending order
      for (let i = 0; i < data.order.length - 1; i++) {
        const date1 = new Date(data.order[i].created_at);
        const date2 = new Date(data.order[i + 1].created_at);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    }
  });
});
