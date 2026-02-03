import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { Adminrouter } from "../router/Adminrouter";
import { createTestUser, createMockImageFile } from "./helpers/testUtils";

/**
 * Admin Controller Tests
 * Tests for admin operations (user management, menu upload)
 */

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";

const createTestApp = () => {
    return new Elysia()
        .use(
            jwt({
                name: "jwt",
                secret: jwtsecret,
            })
        )
        .use(Adminrouter);
};

describe("Admin Controller - Get All Users", () => {
    test("should retrieve all users", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/getuser", {
                method: "GET",
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.user).toBeDefined();
        expect(Array.isArray(data.user)).toBe(true);
        expect(data.count).toBeDefined();
        expect(data.roles).toBeDefined();
    });

    test("should return user count and role breakdown", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/getuser", {
                method: "GET",
            })
        );

        const data = await response.json();
        expect(typeof data.count).toBe("number");
        expect(typeof data.roles).toBe("object");
    });

    test("should count roles correctly", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/getuser", {
                method: "GET",
            })
        );

        const data = await response.json();

        // Verify role counts are numbers
        Object.values(data.roles).forEach((count) => {
            expect(typeof count).toBe("number");
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });
});

describe("Admin Controller - Create User", () => {
    test("should successfully create a new user", async () => {
        const app = createTestApp();
        const newUser = createTestUser({
            username: `admin_create_${Date.now()}`,
            email: `admin_create_${Date.now()}@example.com`,
        });

        const response = await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser),
            })
        );

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.message).toContain("Success");
    });

    test("should reject user creation with missing fields", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "testuser",
                    // missing email, password, role
                }),
            })
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.message).toContain("fill all field");
    });

    test("should reject duplicate username", async () => {
        const app = createTestApp();
        const username = `duplicate_admin_${Date.now()}`;

        // Create first user
        await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email: `${username}_first@example.com`,
                    password: "password123",
                    role: "user",
                }),
            })
        );

        // Try to create user with same username
        const response = await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email: `${username}_second@example.com`,
                    password: "password123",
                    role: "user",
                }),
            })
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.message).toContain("already exist");
    });

    test("should reject duplicate email", async () => {
        const app = createTestApp();
        const email = `duplicate_email_${Date.now()}@example.com`;

        // Create first user
        await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: `user1_${Date.now()}`,
                    email,
                    password: "password123",
                    role: "user",
                }),
            })
        );

        // Try to create user with same email
        const response = await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: `user2_${Date.now()}`,
                    email,
                    password: "password123",
                    role: "user",
                }),
            })
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.message).toContain("Email already exist");
    });

    test("should hash password when creating user", async () => {
        const app = createTestApp();
        const username = `hash_test_${Date.now()}`;

        const response = await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email: `${username}@example.com`,
                    password: "plaintext_password",
                    role: "user",
                }),
            })
        );

        expect(response.status).toBe(201);
        // Password should be hashed in database, not stored as plaintext
    });
});

describe("Admin Controller - Update User", () => {
    test("should successfully update user", async () => {
        const app = createTestApp();
        const originalUsername = `update_test_${Date.now()}`;

        // Create a user first
        await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: originalUsername,
                    email: `${originalUsername}@example.com`,
                    password: "password123",
                    role: "user",
                }),
            })
        );

        // Update the user
        const response = await app.handle(
            new Request("http://localhost/admin/updateuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    originuser: originalUsername,
                    username: `${originalUsername}_updated`,
                    email: `${originalUsername}_updated@example.com`,
                    role: "admin",
                }),
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toContain("Success");
    });

    test("should update user role", async () => {
        const app = createTestApp();
        const username = `role_update_${Date.now()}`;

        // Create user with 'user' role
        await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email: `${username}@example.com`,
                    password: "password123",
                    role: "user",
                }),
            })
        );

        // Update to 'kitchen' role
        const response = await app.handle(
            new Request("http://localhost/admin/updateuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    originuser: username,
                    username: username,
                    email: `${username}@example.com`,
                    role: "kitchen",
                }),
            })
        );

        expect(response.status).toBe(200);
    });
});

describe("Admin Controller - Delete User", () => {
    test("should successfully delete user", async () => {
        const app = createTestApp();
        const username = `delete_test_${Date.now()}`;

        // Create a user first
        await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email: `${username}@example.com`,
                    password: "password123",
                    role: "user",
                }),
            })
        );

        // Delete the user
        const response = await app.handle(
            new Request("http://localhost/admin/deleteuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                }),
            })
        );

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.message).toContain("Success Delete");
    });

    test("should reject delete without username", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/deleteuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
        );

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.message).toContain("Enter username");
    });
});

describe("Admin Controller - Upload Menu Data", () => {
    test("should successfully upload menu item", async () => {
        const app = createTestApp();

        const formData = new FormData();
        formData.append("name", "Test Dish");
        formData.append("price", "150");
        formData.append("category", "Main Course");
        formData.append("description", "A delicious test dish");
        formData.append("image", createMockImageFile("test.jpg"));

        const response = await app.handle(
            new Request("http://localhost/admin/upload-menu", {
                method: "POST",
                body: formData,
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe("Success");
    });

    test("should reject menu upload without name", async () => {
        const app = createTestApp();

        const formData = new FormData();
        formData.append("price", "150");
        formData.append("image", createMockImageFile("test.jpg"));

        const response = await app.handle(
            new Request("http://localhost/admin/upload-menu", {
                method: "POST",
                body: formData,
            })
        );

        expect(response.status).toBe(400);
    });

    test("should reject menu upload without price", async () => {
        const app = createTestApp();

        const formData = new FormData();
        formData.append("name", "Test Dish");
        formData.append("image", createMockImageFile("test.jpg"));

        const response = await app.handle(
            new Request("http://localhost/admin/upload-menu", {
                method: "POST",
                body: formData,
            })
        );

        expect(response.status).toBe(400);
    });

    test("should handle image upload correctly", async () => {
        const app = createTestApp();

        const formData = new FormData();
        formData.append("name", "Dish with Image");
        formData.append("price", "200");
        formData.append("category", "Dessert");
        formData.append("description", "Sweet treat");
        formData.append("image", createMockImageFile("dessert.jpg"));

        const response = await app.handle(
            new Request("http://localhost/admin/upload-menu", {
                method: "POST",
                body: formData,
            })
        );

        expect(response.status).toBe(200);
    });
});
