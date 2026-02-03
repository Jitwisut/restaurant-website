import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { profilerouter } from "../router/Profilerouter";

/**
 * Profile Controller Tests
 * Tests for user profile retrieval and authentication
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
    .use(profilerouter);
};

// Helper to create a JWT token for testing
async function createTestToken(
  payload: any = {
    username: "testuser",
    email: "test@example.com",
    role: "user",
  },
) {
  const app = new Elysia().use(
    jwt({
      name: "jwt",
      secret: jwtsecret,
    }),
  );

  // Get JWT instance from the app
  const jwtInstance = (app as any).decorator.jwt;
  return await jwtInstance.sign({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
  });
}

describe("Profile Controller - Get Profile", () => {
  test("should retrieve user profile with valid token (cookie)", async () => {
    const app = createTestApp();
    const token = await createTestToken();

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "GET",
        headers: {
          Cookie: `auth=${token}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Success");
    expect(data.user).toBeDefined();
    expect(data.role).toBeDefined();
  });

  test("should retrieve kitchen profile with valid token (cookie)", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "kitchen",
      email: "kitchen@example.com",
      role: "kitchen",
    });

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "GET",
        headers: {
          Cookie: `kitchen_auth=${token}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBe("kitchen");
    expect(data.role).toBe("kitchen");
  });

  test("should return 401 when no token is provided", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.message).toContain("login");
  });

  test("should return user information from token payload", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "john_doe",
      email: "john@example.com",
      role: "user",
    });

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "GET",
        headers: {
          Cookie: `auth=${token}`,
        },
      }),
    );

    const data = await response.json();
    expect(data.user).toBe("john_doe");
    expect(data.role).toBe("user");
  });
});

describe("Profile Controller - Get Kitchen Profile", () => {
  test("should retrieve kitchen profile with valid authorization header", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "kitchen_user",
      email: "kitchen@example.com",
      role: "kitchen",
    });

    const response = await app.handle(
      new Request("http://localhost/profile/kitchenprofile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("kitchen");
    expect(data.role).toBe("kitchen");
    expect(data.username).toBe("kitchen_user");
  });

  test("should return 401 when no token is provided", async () => {
    const app = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/profile/kitchenprofile", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.message).toContain("Unauthorized");
  });

  test("should return 403 for non-kitchen user", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "regular_user",
      email: "user@example.com",
      role: "user",
    });

    const response = await app.handle(
      new Request("http://localhost/profile/kitchenprofile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.message).toContain("Forbidden");
  });

  test("should return 403 for admin user trying to access kitchen endpoint", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "admin",
      email: "admin@example.com",
      role: "admin",
    });

    const response = await app.handle(
      new Request("http://localhost/profile/kitchenprofile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  test("should accept Bearer token format", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "kitchen",
      email: "kitchen@example.com",
      role: "kitchen",
    });

    const response = await app.handle(
      new Request("http://localhost/profile/kitchenprofile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    );

    expect(response.status).toBe(200);
  });

  test("should reject invalid authorization header format", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "kitchen",
      email: "kitchen@example.com",
      role: "kitchen",
    });

    // Missing "Bearer" prefix
    const response = await app.handle(
      new Request("http://localhost/profile/kitchenprofile", {
        method: "GET",
        headers: {
          Authorization: token,
        },
      }),
    );

    expect(response.status).toBe(401);
  });
});

describe("Profile Controller - Role Verification", () => {
  test("should correctly identify admin role", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "admin",
      email: "admin@example.com",
      role: "admin",
    });

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "GET",
        headers: {
          Cookie: `auth=${token}`,
        },
      }),
    );

    const data = await response.json();
    expect(data.role).toBe("admin");
  });

  test("should correctly identify user role", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "user",
      email: "user@example.com",
      role: "user",
    });

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "GET",
        headers: {
          Cookie: `auth=${token}`,
        },
      }),
    );

    const data = await response.json();
    expect(data.role).toBe("user");
  });

  test("should correctly identify kitchen role", async () => {
    const app = createTestApp();
    const token = await createTestToken({
      username: "kitchen",
      email: "kitchen@example.com",
      role: "kitchen",
    });

    const response = await app.handle(
      new Request("http://localhost/profile", {
        method: "GET",
        headers: {
          Cookie: `kitchen_auth=${token}`,
        },
      }),
    );

    const data = await response.json();
    expect(data.role).toBe("kitchen");
  });
});
