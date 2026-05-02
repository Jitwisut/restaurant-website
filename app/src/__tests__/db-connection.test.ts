import { describe, test, expect } from "bun:test";
import { getTestDB } from "./setup";
import { ensureTestRestaurant, TEST_RESTAURANT_ID } from "./helpers/testUtils";

/**
 * Database Connection Test
 * Verify that tests can connect to the configured PostgreSQL database.
 */

describe("Database Connection", () => {
  test("should connect to configured database", async () => {
    const db = getTestDB();

    // Query to check which database we're connected to
    const result = await db.query("SELECT current_database()");
    const dbName = result.rows[0].current_database;

    console.log("Connected to database:", dbName);
    expect(typeof dbName).toBe("string");
    expect(dbName.length).toBeGreaterThan(0);
  });

  test("should be able to query users table", async () => {
    const db = getTestDB();

    // Try to query the users table
    const result = await db.query("SELECT COUNT(*) as count FROM users");
    const count = parseInt(result.rows[0].count);

    console.log("Number of users in database:", count);
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should be able to insert and delete test data", async () => {
    const db = getTestDB();
    const testUsername = `test_connection_${Date.now()}`;
    await ensureTestRestaurant();

    // Insert test user
    await db.query(
      "INSERT INTO users (username, email, password, role, restaurant_id) VALUES ($1, $2, $3, $4, $5)",
      [testUsername, `${testUsername}@test.com`, "testpass", "user", TEST_RESTAURANT_ID],
    );

    // Verify insertion
    const selectResult = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [testUsername],
    );
    expect(selectResult.rowCount).toBe(1);

    // Clean up
    await db.query("DELETE FROM users WHERE username = $1", [testUsername]);

    // Verify deletion
    const verifyResult = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [testUsername],
    );
    expect(verifyResult.rowCount).toBe(0);
  });
});

export default getTestDB;
