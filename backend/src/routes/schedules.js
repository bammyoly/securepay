// src/routes/schedules.js
import { Router } from "express";
import { requireEmployer } from "../middleware/auth.js";
import db from "../db/schema.js";

const router = Router();
router.use(requireEmployer);

const nextRunDate = (frequency, from = new Date()) => {
  const d = new Date(from);
  switch (frequency) {
    case "weekly":    d.setDate(d.getDate() + 7);    break;
    case "biweekly":  d.setDate(d.getDate() + 14);   break;
    case "monthly":   d.setMonth(d.getMonth() + 1);  break;
    default:          d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
};

// GET /schedules
router.get("/", (req, res) => {
  const schedules = db.prepare(`
    SELECT * FROM schedules WHERE employer_id = ? ORDER BY next_run_date ASC
  `).all(req.employer.id);

  // Enrich with employee names
  const enriched = schedules.map(s => {
    const ids = JSON.parse(s.employee_ids);
    const placeholders = ids.map(() => "?").join(",");
    const employees = ids.length
      ? db.prepare(`SELECT id, name, wallet_address, salary_usd FROM employees WHERE id IN (${placeholders})`).all(...ids)
      : [];
    return { ...s, employees };
  });

  res.json(enriched);
});

// POST /schedules — create a schedule
router.post("/", (req, res) => {
  const { name, frequency, next_run_date, employee_ids } = req.body;

  if (!name || !frequency || !next_run_date || !employee_ids?.length) {
    return res.status(400).json({ error: "name, frequency, next_run_date, employee_ids required" });
  }

  if (!["weekly", "biweekly", "monthly"].includes(frequency)) {
    return res.status(400).json({ error: "frequency must be weekly, biweekly, or monthly" });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO schedules (id, employer_id, name, frequency, next_run_date, employee_ids)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.employer.id, name, frequency, next_run_date, JSON.stringify(employee_ids));

  res.status(201).json(db.prepare("SELECT * FROM schedules WHERE id = ?").get(id));
});

// PATCH /schedules/:id — update a schedule
router.patch("/:id", (req, res) => {
  const sched = db.prepare("SELECT * FROM schedules WHERE id = ? AND employer_id = ?")
                  .get(req.params.id, req.employer.id);
  if (!sched) return res.status(404).json({ error: "Schedule not found" });

  const { name, status, employee_ids } = req.body;
  db.prepare(`
    UPDATE schedules SET
      name         = COALESCE(?, name),
      status       = COALESCE(?, status),
      employee_ids = COALESCE(?, employee_ids),
      updated_at   = datetime('now')
    WHERE id = ?
  `).run(name ?? null, status ?? null, employee_ids ? JSON.stringify(employee_ids) : null, req.params.id);

  res.json(db.prepare("SELECT * FROM schedules WHERE id = ?").get(req.params.id));
});

// POST /schedules/:id/run — employer clicks "Run Now" — returns employees ready to pay
router.post("/:id/run", (req, res) => {
  const sched = db.prepare("SELECT * FROM schedules WHERE id = ? AND employer_id = ? AND status = 'active'")
                  .get(req.params.id, req.employer.id);
  if (!sched) return res.status(404).json({ error: "Schedule not found or inactive" });

  const employee_ids = JSON.parse(sched.employee_ids);
  const placeholders = employee_ids.map(() => "?").join(",");
  const employees    = db.prepare(`
    SELECT id, name, wallet_address, salary_usd
    FROM employees WHERE id IN (${placeholders}) AND active = 1
  `).all(...employee_ids);

  // Advance next_run_date
  const next = nextRunDate(sched.frequency);
  db.prepare("UPDATE schedules SET next_run_date = ?, updated_at = datetime('now') WHERE id = ?")
    .run(next, sched.id);

  res.json({
    schedule_id:   sched.id,
    name:          sched.name,
    employees,
    next_run_date: next,
  });
});

// DELETE /schedules/:id
router.delete("/:id", (req, res) => {
  db.prepare("UPDATE schedules SET status = 'paused', updated_at = datetime('now') WHERE id = ? AND employer_id = ?")
    .run(req.params.id, req.employer.id);
  res.json({ success: true });
});

export default router;