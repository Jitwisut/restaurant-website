import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { Auths } from "../router/Auth";
import {
  createTestUser,
  createTestAdmin,
  createTestKitchen,
} from "./helpers/testUtils";

/**
 * Auth Controller Tests
 * Tests for user authentication (signin/signup)
 */

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";

// Create test app instance
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
  test("should successfully register a new user", async () => {
    const app = createTestApp();
    const testUser = createTestUser({
      username: `user_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
    });

    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser),
      }),
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.message).toContain("Success");
  });

  test("should reject signup with missing fields", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          email: "test@example.com",
          role: "user",
          // missing password and role
        }),
      }),
    );

    expect(response.status).toBe(422);
  });

  test("should reject duplicate username", async () => {
    const app = createTestApp();
    const username = `duplicate_${Date.now()}`;
    const testUser = createTestUser({
      username,
      email: `${username}@example.com`,
    });

    // First signup - should succeed
    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser),
      }),
    );

    // Second signup with same username - should fail
    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...testUser,
          email: "different@example.com",
        }),
      }),
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.message).toContain("already exists");
  });

  test("should accept different user roles", async () => {
    const app = createTestApp();

    // Test admin role
    const admin = createTestAdmin({
      username: `admin_${Date.now()}`,
      email: `admin_${Date.now()}@example.com`,
    });

    const adminResponse = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin),
      }),
    );

    expect(adminResponse.status).toBe(201);

    // Test kitchen role
    const kitchen = createTestKitchen({
      username: `kitchen_${Date.now()}`,
      email: `kitchen_${Date.now()}@example.com`,
    });

    const kitchenResponse = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kitchen),
      }),
    );

    expect(kitchenResponse.status).toBe(201);
  });
});

describe("Auth Controller - Signin", () => {
  test("should successfully login with valid credentials", async () => {
    const app = createTestApp();
    const username = `signin_test_${Date.now()}`;
    const password = "password123";

    // First, create a user
    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          password,
          role: "user",
        }),
      }),
    );

    // Then try to sign in
    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("Success");
    expect(data.token).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    expect(data.redirectpath).toBeDefined();
  });

  test("should reject signin with invalid password", async () => {
    const app = createTestApp();
    const username = `invalid_pass_${Date.now()}`;

    // Create user
    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          password: "correctpassword",
          role: "user",
        }),
      }),
    );

    // Try signin with wrong password
    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "wrongpassword",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain("Invalid password");
  });

  test("should reject signin for non-existent user", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "nonexistentuser",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toContain("not found");
  });

  test("should reject signin with missing fields", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          // missing password
        }),
      }),
    );

    expect(response.status).toBe(422);
  });

  test("should return correct redirect path for admin", async () => {
    const app = createTestApp();
    const username = `admin_redirect_${Date.now()}`;

    // Create admin user
    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          password: "password123",
          role: "admin",
        }),
      }),
    );

    // Sign in
    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "password123",
        }),
      }),
    );

    const data = await response.json();
    expect(data.redirectpath).toBe("/");
  });

  test("should return correct redirect path for kitchen", async () => {
    const app = createTestApp();
    const username = `kitchen_redirect_${Date.now()}`;

    // Create kitchen user
    await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username}@example.com`,
          password: "password123",
          role: "kitchen",
        }),
      }),
    );

    // Sign in
    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "password123",
        }),
      }),
    );

    const data = await response.json();
    expect(data.redirectpath).toBe("/kitchen");
  });

  test("should return correct redirect path for user", async () => {
    const app = createTestApp();
    const username = `user_redirect_${Date.now()}`;

    // Create regular user
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

    // Sign in
    const response = await app.handle(
      new Request("http://localhost/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "password123",
        }),
      }),
    );

    const data = await response.json();
    expect(data.redirectpath).toBe("/wellcome");
  });
});
