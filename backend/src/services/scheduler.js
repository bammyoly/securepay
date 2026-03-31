// src/services/scheduler.js
// Cron job that checks for due schedules and flags them.
// Does NOT submit transactions — employer must click "Run Payroll" (Option A).

import cron from "node-cron";
import db from "../db/schema.js";

export const startScheduler = () => {
  // Run every day at 8am — check for due payroll schedules
  cron.schedule("0 8 * * *", () => {
    const today = new Date().toISOString().split("T")[0];

    const dueSchedules = db.prepare(`
      SELECT * FROM schedules
      WHERE status = 'active' AND next_run_date <= ?
    `).all(today);

    if (dueSchedules.length > 0) {
      console.log(`[scheduler] ${dueSchedules.length} payroll schedule(s) due today`);
      // In production: send email/push notification to employer
      // For now: the dashboard polls /payments/due to show the banner
    }
  });

  console.log("[scheduler] started — checking daily at 8am");
};