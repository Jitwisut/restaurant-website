import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { Auths } from "../router/Auth";
import {
  createTestAdmin,
  createTestKitchen,
  decodeJWT,
  ensureTestRestaurant,
} from "./helpers/testUtils";

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";

const createTestApp = () => {
  return new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: jwtsecret,
      }),
    )
    .use(Auths);
};

describe("Auth Controller - Signup", () => {
  test("should successfully register an owner/admin account with email login", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const admin = createTestAdmin({
      username: `admin_${suffix}`,
      email: `admin_${suffix}@example.com`,
      restaurant_slug: `auth-owner-${suffix}`,
    });

    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin),
      }),
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.message).toContain("Success");
  });

  test("should reject duplicate owner/admin email", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const email = `duplicate_owner_${suffix}@example.com`;

    const first = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestAdmin({
            username: `owner_a_${suffix}`,
            email,
            restaurant_slug: `owner-a-${suffix}`,
          }),
        ),
      }),
    );
    const second = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestAdmin({
            username: `owner_b_${suffix}`,
            email,
            restaurant_slug: `owner-b-${suffix}`,
          }),
        ),
      }),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  test("should reject duplicate staff username inside the same restaurant", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const username = `duplicate_kitchen_${suffix}`;
    await ensureTestRestaurant(31, { slug: `duplicate-tenant-${suffix}` });

    const first = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestKitchen({
            username,
            email: `${username}_a@example.com`,
            restaurant_slug: `duplicate-tenant-${suffix}`,
          }),
        ),
      }),
    );
    const second = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestKitchen({
            username,
            email: `${username}_b@example.com`,
            restaurant_slug: `duplicate-tenant-${suffix}`,
          }),
        ),
      }),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    const data = await second.json();
    expect(data.message).toContain("already exists in this restaurant");
  });

  test("should allow duplicate staff usernames across different restaurants", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const username = `shared_kitchen_${suffix}`;
    await ensureTestRestaurant(41, { slug: `tenant-a-${suffix}` });
    await ensureTestRestaurant(42, { slug: `tenant-b-${suffix}` });

    const first = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestKitchen({
            username,
            email: `${username}_a@example.com`,
            restaurant_slug: `tenant-a-${suffix}`,
          }),
        ),
      }),
    );
    const second = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestKitchen({
            username,
            email: `${username}_b@example.com`,
            restaurant_slug: `tenant-b-${suffix}`,
          }),
        ),
      }),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });
});

describe("Auth Controller - Signin", () => {
  test("should login owner/admin by email", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const email = `signin_admin_${suffix}@example.com`;

    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestAdmin({
            username: `signin_admin_${suffix}`,
            email,
            password: "password123",
            restaurant_slug: `signin-admin-${suffix}`,
          }),
        ),
      }),
    );

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "password123",
        }),
      }),
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toContain("Success");
    expect(data.token).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    expect(data.role).toBe("admin");
  });

  test("should reject owner/admin email signin with invalid password", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const email = `invalid_pass_${suffix}@example.com`;

    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestAdmin({
            username: `invalid_pass_${suffix}`,
            email,
            password: "correctpassword",
            restaurant_slug: `invalid-pass-${suffix}`,
          }),
        ),
      }),
    );

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "wrongpassword",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain("Invalid password");
  });

  test("should login staff by restaurant slug and username", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const username = `kitchen_${suffix}`;
    await ensureTestRestaurant(51, { slug: `staff-login-${suffix}` });

    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createTestKitchen({
            username,
            email: `${username}@example.com`,
            password: "password123",
            restaurant_slug: `staff-login-${suffix}`,
          }),
        ),
      }),
    );

    const response = await app.handle(
      new Request("http://localhost/auth/staff-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: `staff-login-${suffix}`,
          username,
          password: "password123",
        }),
      }),
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.redirectpath).toBe("/kitchen");
    expect(decodeJWT(data.token).restaurant_id).toBe(51);
  });

  test("should issue tenant-specific tokens for the same kitchen username", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const username = `shared_kitchen_${suffix}`;
    await ensureTestRestaurant(61, { slug: `token-tenant-a-${suffix}` });
    await ensureTestRestaurant(62, { slug: `token-tenant-b-${suffix}` });

    for (const [restaurantId, slug] of [
      [61, `token-tenant-a-${suffix}`],
      [62, `token-tenant-b-${suffix}`],
    ] as const) {
      const response = await app.handle(
        new Request("http://localhost/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            createTestKitchen({
              username,
              email: `${username}_${restaurantId}@example.com`,
              password: "password123",
              restaurant_slug: slug,
            }),
          ),
        }),
      );
      expect(response.status).toBe(201);
    }

    const responseA = await app.handle(
      new Request("http://localhost/auth/staff-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: `token-tenant-a-${suffix}`,
          username,
          password: "password123",
        }),
      }),
    );
    const responseB = await app.handle(
      new Request("http://localhost/auth/staff-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: `token-tenant-b-${suffix}`,
          username,
          password: "password123",
        }),
      }),
    );

    const dataA = await responseA.json();
    const dataB = await responseB.json();
    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(decodeJWT(dataA.token).restaurant_id).toBe(61);
    expect(decodeJWT(dataB.token).restaurant_id).toBe(62);
  });

  test("should login superadmin without restaurant context", async () => {
    const app = createTestApp();
    const suffix = Date.now();
    const username = `superadmin_${suffix}`;
    const email = `${username}@example.com`;

    const signup = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password: "password123",
          role: "superadmin",
        }),
      }),
    );
    expect(signup.status).toBe(201);

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "password123",
        }),
      }),
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.redirectpath).toBe("/superadmin");
    expect(decodeJWT(data.token).restaurant_id).toBeNull();
  });
});
