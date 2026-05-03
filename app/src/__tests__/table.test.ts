import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { Tablerouter } from "../router/Tablerouter";
import { getTestDB } from "./setup";
import {
  authHeaders,
  createAvailableTable,
  createOpenTable,
  decodeJWT,
  ensureTestRestaurant,
  setTestSubscription,
  OTHER_RESTAURANT_ID,
  TEST_JWT_SECRET,
  TEST_RESTAURANT_ID,
} from "./helpers/testUtils";

const db = getTestDB();

const createTestApp = () => {
  return new Elysia()
    .use(jwt({ name: "jwt", secret: TEST_JWT_SECRET }))
    .use(Tablerouter);
};

beforeEach(async () => {
  await ensureTestRestaurant();
});

describe("Table Controller - Multi-tenant auth", () => {
  test("rejects protected table endpoints without JWT", async () => {
    const app = createTestApp();
    const response = await app.handle(
      new Request("http://localhost/tables/gettable", { method: "GET" }),
    );

    expect(response.status).toBe(401);
  });

  test("retrieves tables for the token restaurant", async () => {
    const app = createTestApp();
    await createAvailableTable(21);

    const response = await app.handle(
      new Request("http://localhost/tables/gettable", {
        method: "GET",
        headers: authHeaders(),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.tables)).toBe(true);
    expect(data.tables.every((table: any) => table.restaurant_id === TEST_RESTAURANT_ID)).toBe(true);
  });

  test("blocks table access when the subscription is suspended", async () => {
    const app = createTestApp();
    await setTestSubscription(TEST_RESTAURANT_ID, {
      status: "suspended",
    });

    const response = await app.handle(
      new Request("http://localhost/tables/gettable", {
        method: "GET",
        headers: authHeaders(),
      }),
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.code).toBe("subscription_inactive");
  });
});

describe("Table Controller - Open and close", () => {
  test("opens an available table in the token restaurant", async () => {
    const app = createTestApp();
    const tableNumber = 31;
    await createAvailableTable(tableNumber);

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("Open table success");
    expect(data.table_number).toBe(tableNumber);
    expect(data.session_hash).toBeDefined();
    expect(data.qr_code_url).toMatch(/^data:image\/png;base64,/);
    expect(data.fullurl).toBe(`http://localhost:3000/order/${data.session_hash}`);
  });

  test("rejects invalid table numbers before opening", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ number: 0 }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("rejects opening an already open table", async () => {
    const app = createTestApp();
    const tableNumber = 32;
    await createOpenTable(tableNumber);

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(409);
  });

  test("rotates an expired open table session when opening again", async () => {
    const app = createTestApp();
    const tableNumber = 39;
    const oldSession = await createOpenTable(tableNumber);
    await db.query(
      `INSERT INTO restaurant_settings (restaurant_id, table_qr_settings)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (restaurant_id) DO UPDATE
       SET table_qr_settings = EXCLUDED.table_qr_settings`,
      [
        TEST_RESTAURANT_ID,
        JSON.stringify({ autoCloseSessionMinutes: 1 }),
      ],
    );
    await db.query(
      `UPDATE sessions
          SET opened_at = NOW() - INTERVAL '20 minutes'
        WHERE session_id::text = $1
          AND restaurant_id = $2`,
      [oldSession, TEST_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.session_hash).toBeDefined();
    expect(data.session_hash).not.toBe(oldSession);
    expect(data.fullurl).toBe(`http://localhost:3000/order/${data.session_hash}`);
  });

  test("closes an open table in the token restaurant", async () => {
    const app = createTestApp();
    const tableNumber = 33;
    await createOpenTable(tableNumber);

    const response = await app.handle(
      new Request("http://localhost/tables/closetable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("Close table success");
    expect(data.table_number).toBe(tableNumber);
  });
});

describe("Table Controller - Session and add table", () => {
  test("finds table by public session hash", async () => {
    const app = createTestApp();
    const tableNumber = 34;
    const session = await createOpenTable(tableNumber);

    const response = await app.handle(
      new Request(`http://localhost/tables/checktable/${session}`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Number(data.table.table_number)).toBe(tableNumber);
  });

  test("issues a guest token for an active public session", async () => {
    const app = createTestApp();
    const tableNumber = 35;
    const session = await createOpenTable(tableNumber);

    const response = await app.handle(
      new Request(`http://localhost/tables/session/${session}/guest-token`, {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(data.session_id).toBe(session);
    expect(Number(data.table_number)).toBe(tableNumber);
    expect(Number(data.restaurant_id)).toBe(TEST_RESTAURANT_ID);

    const payload = decodeJWT(data.token);
    expect(payload.role).toBe("user");
    expect(payload.token_type).toBe("guest_session");
    expect(payload.session_id).toBe(session);
    expect(Number(payload.table_number)).toBe(tableNumber);
    expect(Number(payload.restaurant_id)).toBe(TEST_RESTAURANT_ID);
  });

  test("returns public menu only for the active table session restaurant", async () => {
    const app = createTestApp();
    const tableNumber = 37;
    const session = await createOpenTable(tableNumber, TEST_RESTAURANT_ID);
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "other-menu-restaurant",
    });

    await db.query("DELETE FROM menu_new WHERE restaurant_id IN ($1, $2)", [
      TEST_RESTAURANT_ID,
      OTHER_RESTAURANT_ID,
    ]);
    await db.query(
      `INSERT INTO menu_new (name, price, category, restaurant_id)
       VALUES
       ('Session Dish', 120, 'Main', $1),
       ('Other Tenant Dish', 999, 'Main', $2)`,
      [TEST_RESTAURANT_ID, OTHER_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request(`http://localhost/tables/session/${session}/menu`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Number(data.table.table_number)).toBe(tableNumber);
    expect(data.menu.map((item: any) => item.name)).toContain("Session Dish");
    expect(data.menu.map((item: any) => item.name)).not.toContain(
      "Other Tenant Dish",
    );
  });

  test("does not expire a newly opened table when timeout settings are too low", async () => {
    const app = createTestApp();
    const tableNumber = 39;
    const session = await createOpenTable(tableNumber, TEST_RESTAURANT_ID);
    await db.query(
      `INSERT INTO restaurant_settings (restaurant_id, table_qr_settings)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (restaurant_id) DO UPDATE
       SET table_qr_settings = EXCLUDED.table_qr_settings`,
      [
        TEST_RESTAURANT_ID,
        JSON.stringify({ autoCloseSessionMinutes: 1 }),
      ],
    );

    const response = await app.handle(
      new Request(`http://localhost/tables/session/${session}/menu`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
  });

  test("does not expose hidden menu items to public table sessions", async () => {
    const app = createTestApp();
    const tableNumber = 38;
    const session = await createOpenTable(tableNumber, TEST_RESTAURANT_ID);

    await db.query("DELETE FROM menu_new WHERE restaurant_id=$1", [
      TEST_RESTAURANT_ID,
    ]);
    await db.query(
      `INSERT INTO menu_new (name, price, category, restaurant_id, is_available)
       VALUES
       ('Visible Dish', 120, 'Main', $1, true),
       ('Hidden Dish', 130, 'Main', $1, false)`,
      [TEST_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request(`http://localhost/tables/session/${session}/menu`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    const names = data.menu.map((item: any) => item.name);
    expect(names).toContain("Visible Dish");
    expect(names).not.toContain("Hidden Dish");
  });

  test("rejects guest token requests for missing sessions", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request(
        "http://localhost/tables/session/not-a-real-session/guest-token",
        {
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(404);
  });

  test("rejects guest token requests after the table is closed", async () => {
    const app = createTestApp();
    const tableNumber = 36;
    const session = await createOpenTable(tableNumber);

    await app.handle(
      new Request("http://localhost/tables/closetable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    const response = await app.handle(
      new Request(`http://localhost/tables/session/${session}/guest-token`, {
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
  });

  test("adds the next table number per restaurant", async () => {
    const app = createTestApp();
    await db.query("DELETE FROM order_items WHERE restaurant_id=$1", [TEST_RESTAURANT_ID]);
    await db.query("DELETE FROM orders WHERE restaurant_id=$1", [TEST_RESTAURANT_ID]);
    await db.query("DELETE FROM sessions WHERE restaurant_id=$1", [TEST_RESTAURANT_ID]);
    await db.query("DELETE FROM tables WHERE restaurant_id=$1", [TEST_RESTAURANT_ID]);

    const response = await app.handle(
      new Request("http://localhost/tables/addtable", {
        method: "POST",
        headers: authHeaders(),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.new_table).toBe(1);
  });

  test("marks orders complete only in the token restaurant", async () => {
    const app = createTestApp();
    const sessionId = await createOpenTable(1, TEST_RESTAURANT_ID);
    await ensureTestRestaurant(OTHER_RESTAURANT_ID);
    await db.query("DELETE FROM restaurant_settings WHERE restaurant_id=$1", [
      TEST_RESTAURANT_ID,
    ]);
    const ownOrderId = `table-paid-own-${Date.now()}`;
    const otherOrderId = `table-paid-other-${Date.now()}`;

    await db.query("DELETE FROM order_items WHERE order_id IN ($1, $2)", [
      ownOrderId,
      otherOrderId,
    ]);
    await db.query("DELETE FROM orders WHERE id IN ($1, $2)", [
      ownOrderId,
      otherOrderId,
    ]);

    await db.query(
      `INSERT INTO orders (id, table_number, customer_session, status, restaurant_id)
       VALUES
       ($1, 1, $2, 'pending', $3),
       ($4, 1, 'other-session', 'pending', $5)`,
      [ownOrderId, sessionId, TEST_RESTAURANT_ID, otherOrderId, OTHER_RESTAURANT_ID],
    );
    await db.query(
      `INSERT INTO order_items (order_id, menu_item_name, quantity, price, restaurant_id)
       VALUES
       ($1, 'Test Dish', 2, 150, $2),
       ($3, 'Other Dish', 1, 999, $4)`,
      [ownOrderId, TEST_RESTAURANT_ID, otherOrderId, OTHER_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request("http://localhost/tables/ordersuccess", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ table_number: 1 }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("success");

    const ownOrder = await db.query(
      "SELECT status, payment_status, grand_total, paid_at FROM orders WHERE id=$1",
      [ownOrderId],
    );
    const otherOrder = await db.query(
      "SELECT status, payment_status, grand_total, paid_at FROM orders WHERE id=$1",
      [otherOrderId],
    );

    expect(ownOrder.rows[0].status).toBe("completed");
    expect(ownOrder.rows[0].payment_status).toBe("paid");
    expect(Number(ownOrder.rows[0].grand_total)).toBe(300);
    expect(ownOrder.rows[0].paid_at).toBeTruthy();
    expect(otherOrder.rows[0].status).toBe("pending");
    expect(otherOrder.rows[0].payment_status).toBe("unpaid");
  });
});
