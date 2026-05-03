import { describe, expect, test } from "bun:test";
import jwt from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import bcryptjs from "bcryptjs";
import { RestaurantRouter } from "../router/RestaurantRouter";
import {
  authHeaders,
  createAvailableTable,
  decodeJWT,
  ensureTestRestaurant,
  OTHER_RESTAURANT_ID,
  setTestSubscription,
  TEST_JWT_SECRET,
  TEST_RESTAURANT_ID,
} from "./helpers/testUtils";
import { getTestDB } from "./setup";
import { Tablerouter } from "../router/Tablerouter";

const db = getTestDB();

const createTestApp = () =>
  new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: TEST_JWT_SECRET,
      }),
    )
    .post("/__test/token", ({ body, jwt }: any) => jwt.sign(body), {
      body: t.Object({
        username: t.String(),
        email: t.String(),
        role: t.String(),
        restaurant_id: t.Number(),
        iat: t.Number(),
      }),
    })
    .use(Tablerouter)
    .use(RestaurantRouter);

describe("Restaurant API", () => {
  test("register creates a pending restaurant and returns a token scoped to it", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(1, { slug: "default", status: "active" });

    const suffix = Date.now();
    const username = `owner_flow_${suffix}`;
    await db.query(
      `INSERT INTO users (username, email, password, role, restaurant_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [username, `${username}@example.com`, "hash", "user", 1],
    );

    const tokenResponse = await app.handle(
      new Request("http://localhost/__test/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          role: "user",
          restaurant_id: 1,
          iat: Math.floor(Date.now() / 1000),
        }),
      }),
    );
    const token = await tokenResponse.text();
    expect(decodeJWT(token).username).toBe(username);

    const response = await app.handle(
      new Request("http://localhost/restaurant/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `Owner Flow ${suffix}`,
          slug: `owner-flow-${suffix}`,
        }),
      }),
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.restaurant.status).toBe("pending");
    expect(data.token).toBeDefined();

    const tokenPayload = decodeJWT(data.token);
    expect(tokenPayload.role).toBe("owner");
    expect(Number(tokenPayload.restaurant_id)).toBe(data.restaurant.id);
  });

  test("superadmin can list pending restaurants and approve one", async () => {
    const app = createTestApp();
    const id = 9000 + Math.floor(Math.random() * 1000);
    await ensureTestRestaurant(id, {
      name: `Pending Restaurant ${id}`,
      slug: `pending-restaurant-${id}`,
      status: "pending",
    });

    const pendingResponse = await app.handle(
      new Request("http://localhost/restaurant/pending", {
        headers: authHeaders({ role: "superadmin", restaurant_id: 1 }),
      }),
    );

    expect(pendingResponse.status).toBe(200);
    const pendingData = await pendingResponse.json();
    expect(
      pendingData.restaurants.some((restaurant: any) => restaurant.id === id),
    ).toBe(true);

    const approveResponse = await app.handle(
      new Request(`http://localhost/restaurant/${id}/approve`, {
        method: "POST",
        headers: authHeaders({ role: "superadmin", restaurant_id: 1 }),
      }),
    );

    expect(approveResponse.status).toBe(200);
    const approveData = await approveResponse.json();
    expect(approveData.restaurant.status).toBe("active");
  });

  test("non-superadmin cannot approve restaurants", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(1, { slug: "default", status: "active" });

    const response = await app.handle(
      new Request("http://localhost/restaurant/1/approve", {
        method: "POST",
        headers: authHeaders({ role: "admin", restaurant_id: 1 }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("superadmin impersonation keeps table queries scoped to the selected restaurant", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(TEST_RESTAURANT_ID, {
      slug: "default",
      status: "active",
    });
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "other-restaurant",
      status: "active",
    });
    await createAvailableTable(11, TEST_RESTAURANT_ID);
    await createAvailableTable(22, OTHER_RESTAURANT_ID);

    const impersonateResponse = await app.handle(
      new Request(`http://localhost/restaurant/${OTHER_RESTAURANT_ID}/impersonate`, {
        method: "POST",
        headers: authHeaders({ role: "superadmin", restaurant_id: TEST_RESTAURANT_ID }),
      }),
    );

    expect(impersonateResponse.status).toBe(200);
    const impersonateData = await impersonateResponse.json();

    const tablesResponse = await app.handle(
      new Request("http://localhost/tables/gettable", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${impersonateData.token}`,
        },
      }),
    );

    expect(tablesResponse.status).toBe(200);
    const tablesData = await tablesResponse.json();
    expect(Array.isArray(tablesData.tables)).toBe(true);
    expect(tablesData.tables.length).toBeGreaterThan(0);
    expect(
      tablesData.tables.every(
        (table: any) => Number(table.restaurant_id) === OTHER_RESTAURANT_ID,
      ),
    ).toBe(true);
    expect(
      tablesData.tables.some(
        (table: any) => Number(table.restaurant_id) === TEST_RESTAURANT_ID,
      ),
    ).toBe(false);
  });

  test("owner can view billing details and request renewal while subscription is suspended", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(TEST_RESTAURANT_ID, {
      slug: "default",
      status: "active",
    });
    await setTestSubscription(TEST_RESTAURANT_ID, {
      status: "suspended",
    });

    const detailsResponse = await app.handle(
      new Request("http://localhost/restaurant/subscription", {
        method: "GET",
        headers: authHeaders({ role: "owner", restaurant_id: TEST_RESTAURANT_ID }),
      }),
    );

    expect(detailsResponse.status).toBe(200);
    const details = await detailsResponse.json();
    expect(details.subscription.status).toBe("suspended");

    const renewalResponse = await app.handle(
      new Request("http://localhost/restaurant/subscription/request-renewal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders({ role: "owner", restaurant_id: TEST_RESTAURANT_ID }),
        },
        body: JSON.stringify({ note: "Need another month" }),
      }),
    );

    expect(renewalResponse.status).toBe(200);
    const renewalData = await renewalResponse.json();
    expect(renewalData.subscription.renewal_requested_at).toBeDefined();
  });

  test("owner can load and update production admin settings for only their restaurant", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(TEST_RESTAURANT_ID, {
      name: "Settings Restaurant",
      slug: "settings-restaurant",
      status: "active",
    });
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      name: "Other Settings Restaurant",
      slug: "other-settings-restaurant",
      status: "active",
    });
    await db.query(
      "DELETE FROM restaurant_settings WHERE restaurant_id IN ($1, $2)",
      [TEST_RESTAURANT_ID, OTHER_RESTAURANT_ID],
    );

    const loadResponse = await app.handle(
      new Request("http://localhost/restaurant/settings", {
        method: "GET",
        headers: authHeaders({
          role: "owner",
          restaurant_id: TEST_RESTAURANT_ID,
        }),
      }),
    );
    expect(loadResponse.status).toBe(200);
    const initial = await loadResponse.json();
    expect(initial.settings.profile.name).toBe("Settings Restaurant");

    const updateResponse = await app.handle(
      new Request("http://localhost/restaurant/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders({
            role: "owner",
            restaurant_id: TEST_RESTAURANT_ID,
          }),
        },
        body: JSON.stringify({
          profile: {
            name: "Updated Settings Restaurant",
            slug: "updated-settings-restaurant",
            contactEmail: "ops@example.com",
            phone: "0812345678",
            address: "Bangkok",
          },
          order_settings: {
            serviceChargePercent: 10,
            taxPercent: 7,
            discountEnabled: true,
            paymentMethods: { cash: true, bankTransfer: true },
          },
          notification_settings: {
            callStaffSound: false,
            orderAlertSound: true,
            kitchenAlertSound: true,
          },
        }),
      }),
    );

    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.restaurant.name).toBe("Updated Settings Restaurant");
    expect(updated.restaurant.slug).toBe("updated-settings-restaurant");
    expect(updated.settings.profile.contactEmail).toBe("ops@example.com");
    expect(updated.settings.order_settings.serviceChargePercent).toBe(10);

    const other = await db.query(
      "SELECT name, slug FROM restaurants WHERE id=$1",
      [OTHER_RESTAURANT_ID],
    );
    expect(other.rows[0].name).toBe("Other Settings Restaurant");
    expect(other.rows[0].slug).toBe("other-settings-restaurant");
  });

  test("settings update rejects duplicate restaurant slugs", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(TEST_RESTAURANT_ID, {
      slug: "settings-primary",
      status: "active",
    });
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "settings-taken",
      status: "active",
    });

    const response = await app.handle(
      new Request("http://localhost/restaurant/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders({
            role: "admin",
            restaurant_id: TEST_RESTAURANT_ID,
          }),
        },
        body: JSON.stringify({
          profile: {
            slug: "settings-taken",
          },
        }),
      }),
    );

    expect(response.status).toBe(409);
  });

  test("owner can change their account password with current password", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const username = `settings-owner-${suffix}`;
    const email = `${username}@example.com`;
    const oldPassword = "old-password-123";
    const newPassword = "new-password-456";
    await ensureTestRestaurant(TEST_RESTAURANT_ID, {
      slug: "settings-password",
      status: "active",
    });
    await db.query(
      `INSERT INTO users (username, email, password, role, restaurant_id)
       VALUES ($1, $2, $3, 'owner', $4)`,
      [
        username,
        email,
        await bcryptjs.hash(oldPassword, 10),
        TEST_RESTAURANT_ID,
      ],
    );

    const response = await app.handle(
      new Request("http://localhost/restaurant/account/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders({
            role: "owner",
            restaurant_id: TEST_RESTAURANT_ID,
            email,
          }),
        },
        body: JSON.stringify({
          current_password: oldPassword,
          new_password: newPassword,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const updated = await db.query("SELECT password FROM users WHERE email=$1", [
      email,
    ]);
    expect(await bcryptjs.compare(newPassword, updated.rows[0].password)).toBe(
      true,
    );
  });

  test("superadmin can renew a suspended restaurant subscription", async () => {
    const app = createTestApp();
    await ensureTestRestaurant(OTHER_RESTAURANT_ID, {
      slug: "renew-me",
      status: "active",
    });
    await setTestSubscription(OTHER_RESTAURANT_ID, {
      status: "suspended",
    });

    const response = await app.handle(
      new Request(`http://localhost/restaurant/${OTHER_RESTAURANT_ID}/subscription/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders({ role: "superadmin", restaurant_id: TEST_RESTAURANT_ID }),
        },
        body: JSON.stringify({ months: 2, note: "Manual renewal" }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.subscription.status).toBe("active");
    expect(data.subscription.current_period_end).toBeDefined();
  });
});
