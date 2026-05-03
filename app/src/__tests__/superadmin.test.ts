import { describe, expect, test } from "bun:test";
import jwt from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { SuperAdminRouter } from "../router/SuperAdminRouter";
import { RestaurantRouter } from "../router/RestaurantRouter";
import {
  authHeaders,
  createAvailableTable,
  decodeJWT,
  ensureTestRestaurant,
  OTHER_RESTAURANT_ID,
  TEST_JWT_SECRET,
  TEST_RESTAURANT_ID,
} from "./helpers/testUtils";
import { getTestDB } from "./setup";

const db = getTestDB();

const createTestApp = () =>
  new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: TEST_JWT_SECRET,
      }),
    )
    .use(SuperAdminRouter);

const createBillingTestApp = () =>
  new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: TEST_JWT_SECRET,
      }),
    )
    .use(RestaurantRouter)
    .use(SuperAdminRouter);

describe("Superadmin API", () => {
  test("lists restaurants with pagination and platform counts", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(TEST_RESTAURANT_ID, {
      slug: "default",
      status: "active",
    });
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "pending-ops",
      status: "pending",
    });

    const response = await app.handle(
      new Request("http://localhost/superadmin/restaurants?page=1&pageSize=10", {
        headers: authHeaders({ role: "superadmin", restaurant_id: 1 }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.pagination.total).toBeGreaterThanOrEqual(2);
    expect(Number(data.counts.total)).toBeGreaterThanOrEqual(2);
  });

  test("returns restaurant detail with aggregate counts", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "detail-ops",
      status: "active",
    });
    await createAvailableTable(31, OTHER_RESTAURANT_ID);
    await db.query(
      `INSERT INTO menu_new (name, price, restaurant_id)
       VALUES ($1, $2, $3)`,
      ["Detail Dish", "99", OTHER_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request(`http://localhost/superadmin/restaurants/${OTHER_RESTAURANT_ID}`, {
        headers: authHeaders({ role: "superadmin", restaurant_id: 1 }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.restaurant.id).toBe(OTHER_RESTAURANT_ID);
    expect(Number(data.counts.tables)).toBeGreaterThanOrEqual(1);
    expect(Number(data.counts.menu_items)).toBeGreaterThanOrEqual(1);
  });

  test("requires a reason for impersonation and writes audit", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "impersonate-ops",
      status: "active",
    });

    const blocked = await app.handle(
      new Request(
        `http://localhost/superadmin/restaurants/${OTHER_RESTAURANT_ID}/impersonate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders({ role: "superadmin", restaurant_id: 1 }),
          },
          body: JSON.stringify({}),
        },
      ),
    );
    expect(blocked.status).toBe(400);

    const response = await app.handle(
      new Request(
        `http://localhost/superadmin/restaurants/${OTHER_RESTAURANT_ID}/impersonate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders({ role: "superadmin", restaurant_id: 1 }),
          },
          body: JSON.stringify({ reason: "Support ticket review" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    const tokenPayload = decodeJWT(data.token);
    expect(tokenPayload.impersonating).toBe(true);
    expect(Number(tokenPayload.restaurant_id)).toBe(OTHER_RESTAURANT_ID);

    const audit = await db.query(
      "SELECT * FROM superadmin_audit_logs WHERE restaurant_id=$1 AND action=$2",
      [OTHER_RESTAURANT_ID, "restaurant.impersonate"],
    );
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  test("lifecycle action requires reason and writes audit", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "lifecycle-ops",
      status: "active",
    });

    const blocked = await app.handle(
      new Request(
        `http://localhost/superadmin/restaurants/${OTHER_RESTAURANT_ID}/suspend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders({ role: "superadmin", restaurant_id: 1 }),
          },
          body: JSON.stringify({}),
        },
      ),
    );
    expect(blocked.status).toBe(400);

    const response = await app.handle(
      new Request(
        `http://localhost/superadmin/restaurants/${OTHER_RESTAURANT_ID}/suspend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders({ role: "superadmin", restaurant_id: 1 }),
          },
          body: JSON.stringify({ reason: "Policy review" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.restaurant.status).toBe("suspended");

    const audit = await db.query(
      "SELECT * FROM superadmin_audit_logs WHERE restaurant_id=$1 AND action=$2",
      [OTHER_RESTAURANT_ID, "restaurant.suspended"],
    );
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  test("renewing subscription adds one month to the current period end", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "renew-period-ops",
      status: "active",
    });
    await db.query(
      `UPDATE subscriptions
          SET current_period_end = NOW() + INTERVAL '10 day',
              grace_ends_at = NOW() + INTERVAL '17 day',
              status = 'active'
        WHERE restaurant_id = $1`,
      [OTHER_RESTAURANT_ID],
    );
    const before = await db.query(
      "SELECT current_period_end FROM subscriptions WHERE restaurant_id=$1",
      [OTHER_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request(
        `http://localhost/superadmin/restaurants/${OTHER_RESTAURANT_ID}/subscription/renew`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders({ role: "superadmin", restaurant_id: 1 }),
          },
          body: JSON.stringify({
            months: 1,
            note: "Manual one-month renewal",
            reason: "Manual one-month renewal",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    const beforeDate = new Date(before.rows[0].current_period_end);
    const renewedDate = new Date(data.subscription.current_period_end);
    const expectedMinimum = new Date(beforeDate);
    expectedMinimum.setDate(expectedMinimum.getDate() + 27);

    expect(renewedDate.getTime()).toBeGreaterThan(expectedMinimum.getTime());
  });

  test("restaurant can submit billing proof and superadmin approval renews subscription", async () => {
    const app = createBillingTestApp();
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "billing-proof-ops",
      status: "active",
    });
    await db.query(
      `INSERT INTO users (username, email, password, role, restaurant_id)
       VALUES ($1, $2, 'hash', 'owner', $3)
       ON CONFLICT DO NOTHING`,
      ["billing-owner", "billing-owner@example.com", OTHER_RESTAURANT_ID],
    );

    const createResponse = await app.handle(
      new Request("http://localhost/restaurant/billing/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders({
            role: "owner",
            restaurant_id: OTHER_RESTAURANT_ID,
            email: "billing-owner@example.com",
          }),
        },
        body: JSON.stringify({
          months: 1,
          amount: 500,
          note: "Bank transfer",
          proof_base64: Buffer.from("fake-proof").toString("base64"),
          proof_mime: "image/png",
          proof_filename: "proof.png",
        }),
      }),
    );

    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();
    expect(created.request.status).toBe("pending_review");
    expect(created.request.has_proof).toBe(true);

    const approveResponse = await app.handle(
      new Request(
        `http://localhost/superadmin/billing/requests/${created.request.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders({ role: "superadmin", restaurant_id: 1 }),
          },
          body: JSON.stringify({ note: "Proof verified" }),
        },
      ),
    );

    expect(approveResponse.status).toBe(200);
    const approved = await approveResponse.json();
    expect(approved.request.status).toBe("approved");
    expect(approved.subscription.status).toBe("active");
  });
});
