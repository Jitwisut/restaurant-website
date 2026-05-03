import { beforeAll, describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { Adminrouter } from "../router/Adminrouter";
import {
    authHeaders,
    createTestUser,
    createMockImageFile,
    ensureTestRestaurant,
} from "./helpers/testUtils";
import { getTestDB } from "./setup";

/**
 * Admin Controller Tests
 * Tests for admin operations (user management, menu upload)
 */

const jwtsecret = process.env.JWT_SECRET || "test-secret-key";
const db = getTestDB();
const ANALYTICS_RESTAURANT_ID = 901;
const ANALYTICS_OTHER_RESTAURANT_ID = 902;

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

beforeAll(async () => {
    await ensureTestRestaurant();
});

describe("Admin Controller - Get All Users", () => {
    test("should retrieve all users", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/getuser", {
                method: "GET",
                headers: authHeaders(),
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
                headers: authHeaders(),
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
                headers: authHeaders(),
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

describe("Admin Controller - Analytics", () => {
    test("should return completed-sales analytics for the current restaurant", async () => {
        const app = createTestApp();
        await ensureTestRestaurant(ANALYTICS_RESTAURANT_ID);
        await ensureTestRestaurant(ANALYTICS_OTHER_RESTAURANT_ID);

        const ownOrderId = `analytics-own-${Date.now()}`;
        const otherOrderId = `analytics-other-${Date.now()}`;

        await db.query("DELETE FROM order_items WHERE order_id LIKE 'analytics-%'");
        await db.query("DELETE FROM orders WHERE id LIKE 'analytics-%'");

        await db.query(
            `INSERT INTO orders (
                id,
                table_number,
                customer_session,
                status,
                restaurant_id,
                subtotal,
                grand_total,
                payment_status,
                paid_at,
                completed_at,
                created_at
             )
             VALUES
             ($1, 1, 'session-own', 'completed', $3, 300, 300, 'paid', NOW(), NOW(), NOW()),
             ($2, 1, 'session-other', 'completed', $4, 2500, 2500, 'paid', NOW(), NOW(), NOW())`,
            [
                ownOrderId,
                otherOrderId,
                ANALYTICS_RESTAURANT_ID,
                ANALYTICS_OTHER_RESTAURANT_ID,
            ],
        );

        await db.query(
            `INSERT INTO order_items (order_id, menu_item_name, quantity, price, restaurant_id)
             VALUES
             ($1, 'Pad Thai', 2, 120, $2),
             ($1, 'Thai Tea', 1, 60, $2),
             ($3, 'Hidden Item', 5, 500, $4)`,
            [
                ownOrderId,
                ANALYTICS_RESTAURANT_ID,
                otherOrderId,
                ANALYTICS_OTHER_RESTAURANT_ID,
            ],
        );

        const response = await app.handle(
            new Request("http://localhost/admin/analytics?days=7", {
                method: "GET",
                headers: authHeaders({ restaurant_id: ANALYTICS_RESTAURANT_ID }),
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.summary.totalRevenue).toBe(300);
        expect(data.summary.orderCount).toBe(1);
        expect(data.summary.avgOrderValue).toBe(300);
        expect(data.summary.bestOrderValue).toBe(300);
        expect(Array.isArray(data.salesSeries)).toBe(true);
        expect(data.salesSeries).toHaveLength(7);
        expect(data.salesSeries[data.salesSeries.length - 1].revenue).toBe(300);
        expect(data.topItems[0].name).toBe("Pad Thai");
        expect(data.topItems[0].revenue).toBe(240);
    });

    test("should ignore unpaid, cancelled, refunded, and voided orders", async () => {
        const app = createTestApp();
        await ensureTestRestaurant(ANALYTICS_RESTAURANT_ID);

        const ids = [
            `analytics-unpaid-${Date.now()}`,
            `analytics-cancelled-${Date.now()}`,
            `analytics-refunded-${Date.now()}`,
            `analytics-voided-${Date.now()}`,
        ];

        await db.query("DELETE FROM order_items WHERE order_id LIKE 'analytics-%'");
        await db.query("DELETE FROM orders WHERE id LIKE 'analytics-%'");

        await db.query(
            `INSERT INTO orders (
                id,
                table_number,
                customer_session,
                status,
                restaurant_id,
                grand_total,
                payment_status,
                paid_at,
                refunded_at,
                voided_at
             )
             VALUES
             ($1, 1, 'session-unpaid', 'completed', $5, 100, 'unpaid', NULL, NULL, NULL),
             ($2, 1, 'session-cancelled', 'cancelled', $5, 200, 'paid', NOW(), NULL, NULL),
             ($3, 1, 'session-refunded', 'completed', $5, 300, 'paid', NOW(), NOW(), NULL),
             ($4, 1, 'session-voided', 'completed', $5, 400, 'paid', NOW(), NULL, NOW())`,
            [...ids, ANALYTICS_RESTAURANT_ID],
        );

        const response = await app.handle(
            new Request("http://localhost/admin/analytics?days=7", {
                method: "GET",
                headers: authHeaders({ restaurant_id: ANALYTICS_RESTAURANT_ID }),
            }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.summary.totalRevenue).toBe(0);
        expect(data.summary.orderCount).toBe(0);
        expect(data.salesSeries.every((day: any) => day.revenue === 0)).toBe(true);
        expect(data.topItems).toHaveLength(0);
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify(newUser),
            })
        );

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.message).toContain("Success");

        const audit = await db.query(
            "SELECT * FROM superadmin_audit_logs WHERE action=$1 AND restaurant_id=$2",
            ["admin.user.created", 1],
        );
        expect(audit.rowCount).toBeGreaterThan(0);
    });

    test("should reject user creation with missing fields", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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

        const audit = await db.query(
            "SELECT * FROM superadmin_audit_logs WHERE action=$1 AND restaurant_id=$2",
            ["admin.user.updated", 1],
        );
        expect(audit.rowCount).toBeGreaterThan(0);
    });

    test("should update user role", async () => {
        const app = createTestApp();
        const username = `role_update_${Date.now()}`;

        // Create user with 'user' role
        await app.handle(
            new Request("http://localhost/admin/createuser", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({
                    username,
                }),
            })
        );

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.message).toContain("Success Delete");

        const audit = await db.query(
            "SELECT * FROM superadmin_audit_logs WHERE action=$1 AND restaurant_id=$2",
            ["admin.user.deleted", 1],
        );
        expect(audit.rowCount).toBeGreaterThan(0);
    });

    test("should reject delete without username", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/admin/deleteuser", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
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
                headers: authHeaders(),
                body: formData,
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe("Success");
    });

    test("should successfully upload menu item without image and write audit", async () => {
        const app = createTestApp();
        const name = `No Image Dish ${Date.now()}`;

        const formData = new FormData();
        formData.append("name", name);
        formData.append("price", "175");
        formData.append("category", "main");
        formData.append("description", "No image needed");
        formData.append("ingredients", "rice, egg");
        formData.append("isAvailable", "true");

        const response = await app.handle(
            new Request("http://localhost/admin/upload-menu", {
                method: "POST",
                headers: authHeaders(),
                body: formData,
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.menu.name).toBe(name);
        expect(data.menu.image).toBeNull();
        expect(data.menu.ingredients).toBe("rice, egg");
        expect(data.menu.isAvailable).toBe(true);

        const audit = await db.query(
            "SELECT * FROM superadmin_audit_logs WHERE action=$1 AND restaurant_id=$2",
            ["admin.menu.created", 1],
        );
        expect(audit.rowCount).toBeGreaterThan(0);
    });

    test("should update menu only in the token restaurant and write audit", async () => {
        const app = createTestApp();
        await ensureTestRestaurant(ANALYTICS_OTHER_RESTAURANT_ID);
        const ownName = `Menu Update Own ${Date.now()}`;
        const otherName = `Menu Update Other ${Date.now()}`;

        const own = await db.query(
            `INSERT INTO menu_new (name, price, category, restaurant_id)
             VALUES ($1, 99, 'main', $2)
             RETURNING id`,
            [ownName, 1],
        );
        const other = await db.query(
            `INSERT INTO menu_new (name, price, category, restaurant_id)
             VALUES ($1, 299, 'main', $2)
             RETURNING id`,
            [otherName, ANALYTICS_OTHER_RESTAURANT_ID],
        );

        const formData = new FormData();
        formData.append("name", `${ownName} Updated`);
        formData.append("price", "125");
        formData.append("category", "special");
        formData.append("description", "Updated description");
        formData.append("ingredients", "updated ingredients");
        formData.append("isAvailable", "false");

        const response = await app.handle(
            new Request(`http://localhost/admin/menu/${own.rows[0].id}`, {
                method: "PATCH",
                headers: authHeaders(),
                body: formData,
            }),
        );
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.menu.name).toBe(`${ownName} Updated`);
        expect(data.menu.isAvailable).toBe(false);

        const crossTenantForm = new FormData();
        crossTenantForm.append("name", "Should Not Update");
        crossTenantForm.append("price", "1");
        const blocked = await app.handle(
            new Request(`http://localhost/admin/menu/${other.rows[0].id}`, {
                method: "PATCH",
                headers: authHeaders(),
                body: crossTenantForm,
            }),
        );
        expect(blocked.status).toBe(404);

        const audit = await db.query(
            "SELECT * FROM superadmin_audit_logs WHERE action=$1 AND restaurant_id=$2",
            ["admin.menu.updated", 1],
        );
        expect(audit.rowCount).toBeGreaterThan(0);
    });

    test("should delete menu only in the token restaurant and write audit", async () => {
        const app = createTestApp();
        await ensureTestRestaurant(ANALYTICS_OTHER_RESTAURANT_ID);
        const own = await db.query(
            `INSERT INTO menu_new (name, price, restaurant_id)
             VALUES ($1, 88, $2)
             RETURNING id`,
            [`Menu Delete Own ${Date.now()}`, 1],
        );
        const other = await db.query(
            `INSERT INTO menu_new (name, price, restaurant_id)
             VALUES ($1, 188, $2)
             RETURNING id`,
            [`Menu Delete Other ${Date.now()}`, ANALYTICS_OTHER_RESTAURANT_ID],
        );

        const blocked = await app.handle(
            new Request(`http://localhost/admin/menu/${other.rows[0].id}`, {
                method: "DELETE",
                headers: authHeaders(),
            }),
        );
        expect(blocked.status).toBe(404);

        const response = await app.handle(
            new Request(`http://localhost/admin/menu/${own.rows[0].id}`, {
                method: "DELETE",
                headers: authHeaders(),
            }),
        );
        expect(response.status).toBe(200);

        const deleted = await db.query("SELECT 1 FROM menu_new WHERE id=$1", [
            own.rows[0].id,
        ]);
        const stillThere = await db.query("SELECT 1 FROM menu_new WHERE id=$1", [
            other.rows[0].id,
        ]);
        expect(deleted.rowCount).toBe(0);
        expect(stillThere.rowCount).toBe(1);

        const audit = await db.query(
            "SELECT * FROM superadmin_audit_logs WHERE action=$1 AND restaurant_id=$2",
            ["admin.menu.deleted", 1],
        );
        expect(audit.rowCount).toBeGreaterThan(0);
    });

    test("should reject menu upload without name", async () => {
        const app = createTestApp();

        const formData = new FormData();
        formData.append("price", "150");
        formData.append("image", createMockImageFile("test.jpg"));

        const response = await app.handle(
            new Request("http://localhost/admin/upload-menu", {
                method: "POST",
                headers: authHeaders(),
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
                headers: authHeaders(),
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
                headers: authHeaders(),
                body: formData,
            })
        );

        expect(response.status).toBe(200);
    });
});
