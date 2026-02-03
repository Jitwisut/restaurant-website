import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import cors from "@elysiajs/cors";
import jwt from "@elysiajs/jwt";
import { Auths } from "../../router/Auth";
import { Adminrouter } from "../../router/Adminrouter";
import { Tablerouter } from "../../router/Tablerouter";
import { menurouter } from "../../router/menurouter";
import { profilerouter } from "../../router/Profilerouter";
import { Orderrouter } from "../../router/Orderrouter";

/**
 * API Integration Tests
 * Tests for complete API flows including authentication, CORS, and middleware
 */

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";
const testOrigin = "http://localhost:3000";

// Create full app instance similar to production
const createFullApp = () => {
  return new Elysia()
    .use(
      cors({
        origin: (request) => {
          const origin = request.headers.get("origin");
          if (origin?.includes("localhost")) return true;
          return false;
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-XSRF-TOKEN"],
      }),
    )
    .use(
      jwt({
        name: "jwt",
        secret: jwtsecret,
      }),
    )
    .get("/", () => "Hello Elysia")
    .use(profilerouter)
    .use(Tablerouter)
    .use(Adminrouter)
    .use(Auths)
    .use(menurouter)
    .use(Orderrouter);
};

describe("API Integration - Complete Authentication Flow", () => {
  test("should complete full signup -> signin -> profile flow", async () => {
    const app = createFullApp();
    const username = `integration_${Date.now()}`;
    const password = "password123";

    // Step 1: Signup
    const signupResponse = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: testOrigin,
        },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          password,
          role: "user",
        }),
      }),
    );

    expect(signupResponse.status).toBe(201);

    // Step 2: Signin
    const signinResponse = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: testOrigin,
        },
        body: JSON.stringify({
          username,
          password,
        }),
      }),
    );

    expect(signinResponse.status).toBe(200);
    const signinData = await signinResponse.json();
    expect(signinData.token).toBeDefined();
    expect(signinData.refreshToken).toBeDefined();

    // Step 3: Get Profile with token
    const profileResponse = await app.handle(
      new Request("http://localhost/profile/", {
        method: "GET",
        headers: {
          Cookie: `auth=${signinData.token}`,
          Origin: testOrigin,
        },
      }),
    );

    expect(profileResponse.status).toBe(200);
    const profileData = await profileResponse.json();
    expect(profileData.user).toBe(username);
  });

  test("should handle admin authentication flow", async () => {
    const app = createFullApp();
    const username = `admin_integration_${Date.now()}`;

    // Create admin user
    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          password: "admin123",
          role: "admin",
        }),
      }),
    );

    // Admin signin
    const signinResponse = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "admin123",
        }),
      }),
    );

    const data = await signinResponse.json();
    expect(data.redirectpath).toBe("/");
  });
});

describe("API Integration - CORS Headers", () => {
  test("should include CORS headers for localhost origin", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "GET",
        headers: {
          Origin: "http://localhost:3000",
        },
      }),
    );

    const headers = response.headers;
    expect(headers.get("access-control-allow-origin")).toBeTruthy();
  });

  test("should handle OPTIONS preflight request", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
        },
      }),
    );

    expect(response.status).toBe(204);
  });

  test("should allow credentials in CORS", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "GET",
        headers: {
          Origin: "http://localhost:3000",
        },
      }),
    );

    const headers = response.headers;
    expect(headers.get("access-control-allow-credentials")).toBe("true");
  });
});

describe("API Integration - Table and Order Flow", () => {
  test("should complete table open -> order -> close flow", async () => {
    const app = createFullApp();
    const tableNumber = 8;

    // Step 1: Open table
    const openResponse = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(openResponse.status).toBe(200);
    const openData = await openResponse.json();
    expect(openData.session_hash).toBeDefined();
    expect(openData.qr_code_url).toBeDefined();

    // Step 2: Check table by session
    const checkResponse = await app.handle(
      new Request(
        `http://localhost/tables/checktable/${openData.session_hash}`,
        {
          method: "GET",
        },
      ),
    );

    expect(checkResponse.status).toBe(200);

    // Step 3: Get order history
    const orderResponse = await app.handle(
      new Request("http://localhost/order/orderhistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: tableNumber }),
      }),
    );

    expect(orderResponse.status).toBe(200);

    // Step 4: Close table
    const closeResponse = await app.handle(
      new Request("http://localhost/tables/closetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber.toString() }),
      }),
    );

    expect(closeResponse.status).toBe(200);
  });

  test("should prevent opening already open table", async () => {
    const app = createFullApp();
    const tableNumber = 9;

    // Open table
    await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    // Try to open again
    const response = await app.handle(
      new Request("http://localhost/tables/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: tableNumber }),
      }),
    );

    expect(response.status).toBe(409);
  });
});

describe("API Integration - Menu and Admin Flow", () => {
  test("should allow menu retrieval without authentication", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/menu/get", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.menu).toBeDefined();
  });

  test("should retrieve all users from admin endpoint", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/admin/getuser", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.count).toBeDefined();
    expect(data.roles).toBeDefined();
  });
});

describe("API Integration - Error Handling", () => {
  test("should return 404 for non-existent endpoints", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/nonexistent", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(404);
  });

  test("should handle validation errors", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing required fields
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("should return proper error messages", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "nonexistent",
          password: "wrong",
        }),
      }),
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toBeDefined();
  });
});

describe("API Integration - Root Endpoint", () => {
  test("should return welcome message from root", async () => {
    const app = createFullApp();

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Hello Elysia");
  });
});

describe("API Integration - JWT Token Validation", () => {
  test("should validate JWT token structure", async () => {
    const app = createFullApp();
    const username = `jwt_test_${Date.now()}`;

    // Create and signin user
    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          password: "password123",
          role: "user",
        }),
      }),
    );

    const signinResponse = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "password123",
        }),
      }),
    );

    const data = await signinResponse.json();

    // JWT should have 3 parts separated by dots
    expect(data.token).toBeDefined();
    expect(data.token.split(".").length).toBe(3);
    expect(data.refreshToken).toBeDefined();
    expect(data.refreshToken.split(".").length).toBe(3);
  });
});
