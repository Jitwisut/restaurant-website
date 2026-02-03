import { beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import pg from "pg";

/**
 * Test database setup
 * This file provides utilities for setting up and tearing down test databases
 */

let testDb: any = null;
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:0805555za@localhost:5432/restaurant_test";
/**
 * Get test database connection
 * Returns a PostgreSQL connection for testing
 */
export function getTestDB() {
  if (!testDb) {
    // Use test database connection
    testDb = new pg.Pool({
      connectionString: connectionString,
    });
  }
  return testDb;
}

/**
 * Setup test database schema
 */
export async function setupTestDB() {
  const db = getTestDB();

  // Create tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS menu_new (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      image_blob BYTEA,
      image_mime VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tables (
      id SERIAL PRIMARY KEY,
      table_number VARCHAR(10) UNIQUE NOT NULL,
      status VARCHAR(50) DEFAULT 'available',
      opened_at TIMESTAMP,
      customer_session VARCHAR(255),
      qr_code_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255) UNIQUE NOT NULL,
      table_number INTEGER,
      opened_at TIMESTAMP,
      closed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      table_number INTEGER NOT NULL,
      customer_session VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Clean test database
 */
export async function cleanTestDB() {
  const db = getTestDB();

  // Delete all data in reverse order of dependencies
  await db.query("DELETE FROM order_items");
  await db.query("DELETE FROM orders");
  await db.query("DELETE FROM sessions");
  await db.query("DELETE FROM tables");
  await db.query("DELETE FROM menu_new");
  await db.query("DELETE FROM users");
}

/**
 * Drop test database tables
 */
export async function teardownTestDB() {
  const db = getTestDB();

  await db.query("DROP TABLE IF EXISTS order_items CASCADE");
  await db.query("DROP TABLE IF EXISTS orders CASCADE");
  await db.query("DROP TABLE IF EXISTS sessions CASCADE");
  await db.query("DROP TABLE IF EXISTS tables CASCADE");
  await db.query("DROP TABLE IF EXISTS menu_new CASCADE");
  await db.query("DROP TABLE IF EXISTS users CASCADE");
}

/**
 * Close test database connection
 */
export async function closeTestDB() {
  if (testDb) {
    await testDb.end();
    testDb = null;
  }
}

/**
 * Seed test data
 */
export async function seedTestData() {
  const db = getTestDB();

  // Add a test user (password: password123)
  await db.query(
    `INSERT INTO users (username, email, password, role) 
     VALUES ($1, $2, $3, $4)`,
    [
      "testuser",
      "test@example.com",
      "$2a$10$YourHashedPasswordHere", // bcrypt hash for "password123"
      "user",
    ],
  );

  // Add test menu items
  await db.query(
    `INSERT INTO menu_new (name, price, category, description) 
     VALUES ($1, $2, $3, $4)`,
    ["Pad Thai", "120", "Main Course", "Traditional Thai noodles"],
  );

  // Add test tables
  for (let i = 1; i <= 5; i++) {
    const tableNum = i.toString().padStart(2, "0");
    await db.query(
      `INSERT INTO tables (table_number, status) VALUES ($1, $2)`,
      [tableNum, "available"],
    );
  }
}
if (import.meta.main) {
  (async () => {
    try {
      console.log("🚀 Starting Database Setup...");
      
      // 1. สร้างตาราง
      await setupTestDB();
      
      // 2. ใส่ข้อมูลทดสอบ (Seed)
      await seedTestData();
      
      console.log("🏁 Database Setup Complete!");
      
      // 3. ปิด Connection
      await closeTestDB();
      
      process.exit(0);
    } catch (error) {
      console.error("💀 Setup Failed:", error);
      process.exit(1);
    }
  })();
}