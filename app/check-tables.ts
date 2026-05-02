import { getDB } from "./src/lib/connect";
async function run() {
  const db = getDB();
  try {
    const res = await db.query("SELECT * FROM tables");
    console.log("Tables:", res.rows);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    process.exit(0);
  }
}
run();