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
  });
});
