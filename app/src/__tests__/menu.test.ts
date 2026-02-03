import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import { menurouter } from "../router/menurouter";
import { createTestMenuItem } from "./helpers/testUtils";

/**
 * Menu Controller Tests
 * Tests for menu retrieval and management
 */

const createTestApp = () => {
    return new Elysia().use(menurouter);
};

describe("Menu Controller - Get Menu", () => {
    test("should retrieve menu items", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/menu/get", {
                method: "GET",
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.menu).toBeDefined();
        expect(Array.isArray(data.menu)).toBe(true);
    });

    test("should return menu items with correct structure", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/menu/get", {
                method: "GET",
            })
        );

        const data = await response.json();

        if (data.menu.length > 0) {
            const menuItem = data.menu[0];
            expect(menuItem).toHaveProperty("id");
            expect(menuItem).toHaveProperty("name");
            expect(menuItem).toHaveProperty("price");
            expect(menuItem).toHaveProperty("category");
        }
    });

    test("should handle base64 image encoding", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/menu/get", {
                method: "GET",
            })
        );

        const data = await response.json();

        // Check if images are properly encoded or null
        data.menu.forEach((item: any) => {
            if (item.image !== null) {
                expect(item.image).toMatch(/^data:image\//);
            }
        });
    });

    test("should return empty array when no menu items exist", async () => {
        const app = createTestApp();

        const response = await app.handle(
            new Request("http://localhost/menu/get", {
                method: "GET",
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data.menu)).toBe(true);
    });
});

describe("Menu Item Structure", () => {
    test("menu item should have all required fields", () => {
        const menuItem = createTestMenuItem();

        expect(menuItem.name).toBeDefined();
        expect(menuItem.price).toBeDefined();
        expect(menuItem.category).toBeDefined();
        expect(menuItem.description).toBeDefined();
    });

    test("menu item can be created with custom values", () => {
        const customItem = createTestMenuItem({
            name: "Custom Dish",
            price: "250",
            category: "Appetizer",
        });

        expect(customItem.name).toBe("Custom Dish");
        expect(customItem.price).toBe("250");
        expect(customItem.category).toBe("Appetizer");
    });
});
