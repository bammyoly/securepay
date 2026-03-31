import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "./payroll.db"));

// 1. Force Foreign Keys ON so we don't leave orphaned rows
db.pragma("foreign_keys = ON");

const tables = ["schedules", "payments", "employees", "employers", "users"];

console.log("🚀 Starting Absolute Database Reset...");

const reset = db.transaction(() => {
  for (const table of tables) {
    try {
      // Delete all rows from the table
      const info = db.prepare(`DELETE FROM ${table}`).run();
      // Reset the auto-increment counters (IMPORTANT)
      db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
      console.log(`  ✓ Cleared ${table} (${info.changes} rows)`);
    } catch (e) {
      console.warn(`  ! Table ${table} might not exist or failed: ${e.message}`);
    }
  }
});

try {
  reset();
  // 2. Shrink the database file and finalize changes
  db.prepare("VACUUM").run();
  console.log("\n✨ Database is now completely empty and IDs are reset.");
} catch (err) {
  console.error("\n❌ Critical Failure during reset:", err.message);
} finally {
  db.close();
}