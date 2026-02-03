import { setupTestDB, getTestDB } from "./setup";

/**
 * Initialize test database
 * Run this script to set up the test database schema
 */

async function initTestDB() {
    console.log("🚀 Initializing test database...");

    try {
        await setupTestDB();
        console.log("✅ Test database schema created successfully");

        // Verify tables exist
        const db = getTestDB();
        const result = await db.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        console.log("\n📋 Tables created:");
        result.rows.forEach((row: any) => {
            console.log(`  - ${row.tablename}`);
        });

        // Check database name
        const dbCheck = await db.query("SELECT current_database()");
        console.log(`\n✅ Connected to database: ${dbCheck.rows[0].current_database}`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Error initializing test database:", error);
        process.exit(1);
    }
}

initTestDB();
