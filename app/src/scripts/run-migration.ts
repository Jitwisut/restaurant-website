import { readFile } from "fs/promises";
import { resolve } from "path";
import { getDB } from "../lib/connect";

const migrationFile = process.argv[2] || "db/migrations/001_multi_tenant_mvp.sql";
const migrationPath = resolve(process.cwd(), migrationFile);

const db = getDB();

try {
  const sql = await readFile(migrationPath, "utf8");
  await db.query(sql);
  console.log(`Migration completed: ${migrationFile}`);
} finally {
  await db.end?.();
}
