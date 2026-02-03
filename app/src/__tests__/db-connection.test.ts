import { describe, test, expect } from "bun:test";
import { getTestDB } from "./setup";

/**
 * Database Connection Test
 * Verify that tests can connect to restaurant_test database
 */

describe("Database Connection", () => {
  test("should connect to restaurant_test database", async () => {
    const db = getTestDB();

    // Query to check which database we're connected to
    const result = await db.query("SELECT current_database()");
    const dbName = result.rows[0].current_database;

    console.log("Connected to database:", dbName);
    expect(dbName).toBe("restaurant_test");
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

    // Insert test user
    await db.query(
      "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)",
      [testUsername, `${testUsername}@test.com`, "testpass", "user"],
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
