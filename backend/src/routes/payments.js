// src/routes/payments.js
import { Router } from "express";
import { requireEmployer } from "../middleware/auth.js";
import db from "../db/schema.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /payments/received/:wallet — employee view, no auth required
// Returns confirmed payments received by a wallet address
// ---------------------------------------------------------------------------
router.get("/received/:wallet", (req, res) => {
  const wallet = req.params.wallet?.toLowerCase();
  if (!wallet) return res.status(400).json({ error: "wallet address required" });

  const payments = db.prepare(`
    SELECT p.*, e.name as employee_name, e.wallet_address,
           emp.company_name as employer_name
    FROM payments p
    JOIN employees e  ON p.employee_id = e.id
    JOIN employers emp ON p.employer_id = emp.id
    WHERE LOWER(e.wallet_address) = ?
      AND p.status IN ('confirmed', 'submitted')
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all(wallet);

  res.json(payments);
});

// All routes below require employer auth
router.use(requireEmployer);

// GET /payments — list all payments (with optional filters)
router.get("/", (req, res) => {
  const { employee_id, status, limit = 50 } = req.query;

  let query = "SELECT p.*, e.name as employee_name, e.wallet_address FROM payments p JOIN employees e ON p.employee_id = e.id WHERE p.employer_id = ?";
  const params = [req.employer.id];

  if (employee_id) { query += " AND p.employee_id = ?"; params.push(employee_id); }
  if (status)      { query += " AND p.status = ?";      params.push(status);      }

  query += " ORDER BY p.created_at DESC LIMIT ?";
  params.push(parseInt(limit));

  res.json(db.prepare(query).all(...params));
});

// GET /payments/due — payments that are scheduled and due today
router.get("/due", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const due = db.prepare(`
    SELECT p.*, e.name as employee_name, e.wallet_address, e.salary_usd
    FROM payments p
    JOIN employees e ON p.employee_id = e.id
    WHERE p.employer_id = ?
      AND p.status = 'pending'
      AND p.scheduled_date <= ?
    ORDER BY p.scheduled_date ASC
  `).all(req.employer.id, today);
  res.json(due);
});

// POST /payments — record a payment (single or batch)
router.post("/", (req, res) => {
  const { employee_ids, tx_hash, scheduled_date } = req.body;

  if (!employee_ids?.length) {
    return res.status(400).json({ error: "employee_ids array required" });
  }

  const placeholders = employee_ids.map(() => "?").join(",");
  const employees = db.prepare(`
    SELECT * FROM employees
    WHERE id IN (${placeholders}) AND employer_id = ? AND active = 1
  `).all(...employee_ids, req.employer.id);

  if (employees.length !== employee_ids.length) {
    return res.status(400).json({ error: "One or more employees not found or inactive" });
  }

  const insertPayment = db.prepare(`
    INSERT INTO payments (id, employer_id, employee_id, tx_hash, amount_usd, status, scheduled_date, triggered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertMany = db.transaction((emps) => {
    return emps.map(emp => {
      const id = crypto.randomUUID();
      insertPayment.run(
        id, req.employer.id, emp.id,
        tx_hash ?? null,
        emp.salary_usd,
        tx_hash ? "submitted" : "pending",
        scheduled_date ?? null
      );
      return id;
    });
  });

  const ids = insertMany(employees);
  res.status(201).json({ payment_ids: ids, count: ids.length });
});

// PATCH /payments/:id/confirm — mark payment confirmed after tx mined
router.patch("/:id/confirm", (req, res) => {
  const { tx_hash } = req.body;
  const payment = db.prepare("SELECT * FROM payments WHERE id = ? AND employer_id = ?")
                    .get(req.params.id, req.employer.id);
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  db.prepare(`
    UPDATE payments SET
      status = 'confirmed',
      tx_hash = COALESCE(?, tx_hash),
      confirmed_at = datetime('now')
    WHERE id = ?
  `).run(tx_hash ?? null, req.params.id);

  res.json(db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id));
});

// PATCH /payments/confirm-batch — confirm multiple payments from one tx
router.patch("/confirm-batch", (req, res) => {
  const { payment_ids, tx_hash } = req.body;
  if (!payment_ids?.length || !tx_hash) {
    return res.status(400).json({ error: "payment_ids and tx_hash required" });
  }

  const placeholders = payment_ids.map(() => "?").join(",");
  db.prepare(`
    UPDATE payments SET
      status = 'confirmed',
      tx_hash = ?,
      confirmed_at = datetime('now')
    WHERE id IN (${placeholders}) AND employer_id = ?
  `).run(tx_hash, ...payment_ids, req.employer.id);

  res.json({ confirmed: payment_ids.length });
});

export default router;