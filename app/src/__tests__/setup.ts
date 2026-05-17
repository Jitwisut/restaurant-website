import { beforeAll, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import pg from "pg";

/**
 * Test database setup
 * This file provides utilities for setting up and tearing down test databases
 */

let testDb: any = null;
const fallbackTestConnectionString =
  "postgresql://postgres:0805555za@localhost:5432/restaurant_test";
const connectionString = process.env.DATABASE_URL || fallbackTestConnectionString;

function assertTestDatabaseConnectionString(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized.includes("restaurant_test")) {
    throw new Error(
      `Unsafe test DATABASE_URL detected: ${value}. Load app/.env.test before running tests.`,
    );
  }
}

assertTestDatabaseConnectionString(connectionString);
/**
 * Get test database connection
 * Returns a PostgreSQL connection for testing
 */
export function getTestDB() {
  if (!testDb) {
    assertTestDatabaseConnectionString(connectionString);
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
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      owner_id INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      plan VARCHAR(50) DEFAULT 'free',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      restaurant_id INTEGER REFERENCES restaurants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (restaurant_id, username)
    )
  `);

  await db.query("ALTER TABLE users ALTER COLUMN restaurant_id DROP NOT NULL");
  await db.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
      ) THEN
        ALTER TABLE users DROP CONSTRAINT users_username_key;
      END IF;
    END $$;
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_restaurant_username_key
      ON users(restaurant_id, username)
      WHERE restaurant_id IS NOT NULL
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_global_superadmin_username_key
      ON users(username)
      WHERE role = 'superadmin'
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS menu_new (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      ingredients TEXT,
      is_available BOOLEAN NOT NULL DEFAULT true,
      image_blob BYTEA,
      image_mime VARCHAR(50),
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    ALTER TABLE menu_new
      ADD COLUMN IF NOT EXISTS ingredients TEXT,
      ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_menu_restaurant_category_available
      ON menu_new(restaurant_id, category, is_available)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tables (
      id SERIAL PRIMARY KEY,
      table_number VARCHAR(10) NOT NULL,
      status VARCHAR(50) DEFAULT 'available',
      opened_at TIMESTAMP,
      customer_session VARCHAR(255),
      qr_code_url TEXT,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (restaurant_id, table_number)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255) UNIQUE NOT NULL,
      table_number INTEGER,
      opened_at TIMESTAMP,
      closed_at TIMESTAMP,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(255) PRIMARY KEY,
      table_number INTEGER NOT NULL,
      customer_session VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      service_charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
      payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
      payment_reference TEXT,
      payment_review_note TEXT,
      payment_submitted_at TIMESTAMP,
      payment_reviewed_at TIMESTAMP,
      payment_reviewed_by INTEGER,
      paid_at TIMESTAMP,
      completed_at TIMESTAMP,
      refunded_at TIMESTAMP,
      voided_at TIMESTAMP,
      updated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
      ADD COLUMN IF NOT EXISTS payment_reference TEXT,
      ADD COLUMN IF NOT EXISTS payment_review_note TEXT,
      ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS payment_reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS payment_reviewed_by INTEGER,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
  `);

  await db.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'status_check'
           AND conrelid = 'orders'::regclass
      ) THEN
        ALTER TABLE orders DROP CONSTRAINT status_check;
      END IF;

      IF EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'orders_status_check'
           AND conrelid = 'orders'::regclass
      ) THEN
        ALTER TABLE orders DROP CONSTRAINT orders_status_check;
      END IF;

      ALTER TABLE orders
        ADD CONSTRAINT orders_status_check
        CHECK (
          status IN (
            'pending',
            'accepted',
            'preparing',
            'ready',
            'completed',
            'cancelled',
            'rejected'
          )
        );
    END $$;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(255) REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      notes TEXT,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS notes TEXT
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_sales_paid
      ON orders(restaurant_id, payment_status, paid_at)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_sales_status_created
      ON orders(restaurant_id, status, created_at)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_order_items_order_restaurant
      ON order_items(order_id, restaurant_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status
      ON tables(restaurant_id, status)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
      plan_code VARCHAR(50) NOT NULL DEFAULT 'starter',
      billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 day'),
      grace_ends_at TIMESTAMP,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
      renewal_requested_at TIMESTAMP,
      renewal_request_note TEXT,
      last_payment_at TIMESTAMP,
      activated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS superadmin_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      actor_email VARCHAR(255) NULL,
      restaurant_id INTEGER NULL REFERENCES restaurants(id) ON DELETE SET NULL,
      target_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      reason TEXT NULL,
      old_value_json JSONB NULL,
      new_value_json JSONB NULL,
      ip_address VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS billing_requests (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      requested_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
      plan_code VARCHAR(50) NOT NULL DEFAULT 'starter',
      months INTEGER NOT NULL DEFAULT 1,
      amount NUMERIC(12, 2),
      note TEXT,
      proof_blob BYTEA,
      proof_mime VARCHAR(100),
      proof_filename VARCHAR(255),
      reviewed_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      review_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
      account_security JSONB NOT NULL DEFAULT '{}'::jsonb,
      team_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      order_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      table_qr_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      menu_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      danger_zone JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  await db.query("DELETE FROM superadmin_audit_logs");
  await db.query("DELETE FROM billing_requests");
  await db.query("DELETE FROM restaurant_settings");
  await db.query("DELETE FROM subscriptions");
  await db.query("DELETE FROM users");
  await db.query("DELETE FROM restaurants");
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
  await db.query("DROP TABLE IF EXISTS superadmin_audit_logs CASCADE");
  await db.query("DROP TABLE IF EXISTS billing_requests CASCADE");
  await db.query("DROP TABLE IF EXISTS restaurant_settings CASCADE");
  await db.query("DROP TABLE IF EXISTS subscriptions CASCADE");
  await db.query("DROP TABLE IF EXISTS users CASCADE");
  await db.query("DROP TABLE IF EXISTS restaurants CASCADE");
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

  await db.query(
    `INSERT INTO restaurants (id, name, slug, status, plan)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [1, "Default Restaurant", "default", "active", "free"],
  );
  await db.query(
    `INSERT INTO subscriptions (
      restaurant_id,
      plan_code,
      billing_interval,
      status,
      current_period_start,
      current_period_end,
      grace_ends_at,
      last_payment_at
    )
     VALUES ($1, 'starter', 'monthly', 'active', NOW(), NOW() + INTERVAL '30 day', NOW() + INTERVAL '37 day', NOW())
     ON CONFLICT (restaurant_id) DO NOTHING`,
    [1],
  );

  // Add a test user (password: password123)
  await db.query(
    `INSERT INTO users (username, email, password, role, restaurant_id) 
     VALUES ($1, $2, $3, $4, $5)`,
    [
      "testuser",
      "test@example.com",
      "$2a$10$YourHashedPasswordHere", // bcrypt hash for "password123"
      "user",
      1,
    ],
  );

  // Add test menu items
  await db.query(
    `INSERT INTO menu_new (name, price, category, description, restaurant_id) 
     VALUES ($1, $2, $3, $4, $5)`,
    ["Pad Thai", "120", "Main Course", "Traditional Thai noodles", 1],
  );

  // Add test tables
  for (let i = 1; i <= 5; i++) {
    const tableNum = i.toString().padStart(2, "0");
    await db.query(
      `INSERT INTO tables (table_number, status, restaurant_id) VALUES ($1, $2, $3)`,
      [tableNum, "available", 1],
    );
  }
}

beforeAll(async () => {
  await setupTestDB();
});

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
