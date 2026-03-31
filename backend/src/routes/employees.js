// src/routes/employees.js
import { Router } from "express";
import { requireEmployer } from "../middleware/auth.js";
import db from "../db/schema.js";
import { ethers } from "ethers";

const router = Router();
router.use(requireEmployer);

// GET /employees — list all employees for this employer
router.get("/", (req, res) => {
  const employees = db.prepare(`
    SELECT * FROM employees
    WHERE employer_id = ?
    ORDER BY name ASC
  `).all(req.employer.id);
  res.json(employees);
});

// GET /employees/:id — single employee
router.get("/:id", (req, res) => {
  const emp = db.prepare(`
    SELECT * FROM employees WHERE id = ? AND employer_id = ?
  `).get(req.params.id, req.employer.id);
  if (!emp) return res.status(404).json({ error: "Employee not found" });
  res.json(emp);
});

// POST /employees — add employee
router.post("/", (req, res) => {
  const { wallet_address, name, email, role, department, salary_usd } = req.body;

  if (!wallet_address || !name || !salary_usd) {
    return res.status(400).json({ error: "wallet_address, name, salary_usd are required" });
  }

  if (!ethers.isAddress(wallet_address)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  if (salary_usd <= 0) {
    return res.status(400).json({ error: "salary_usd must be positive" });
  }

  try {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO employees (id, employer_id, wallet_address, name, email, role, department, salary_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.employer.id, wallet_address.toLowerCase(), name, email ?? null, role ?? null, department ?? null, salary_usd);

    const emp = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
    res.status(201).json(emp);
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Employee with this wallet already exists" });
    }
    throw err;
  }
});

// PATCH /employees/:id — update employee
router.patch("/:id", (req, res) => {
  const emp = db.prepare("SELECT * FROM employees WHERE id = ? AND employer_id = ?")
                .get(req.params.id, req.employer.id);
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  const { name, email, role, department, salary_usd, active } = req.body;

  db.prepare(`
    UPDATE employees SET
      name        = COALESCE(?, name),
      email       = COALESCE(?, email),
      role        = COALESCE(?, role),
      department  = COALESCE(?, department),
      salary_usd  = COALESCE(?, salary_usd),
      active      = COALESCE(?, active),
      updated_at  = datetime('now')
    WHERE id = ?
  `).run(name ?? null, email ?? null, role ?? null, department ?? null,
         salary_usd ?? null, active ?? null, req.params.id);

  res.json(db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id));
});

// DELETE /employees/:id — deactivate (soft delete)
router.delete("/:id", (req, res) => {
  const emp = db.prepare("SELECT * FROM employees WHERE id = ? AND employer_id = ?")
                .get(req.params.id, req.employer.id);
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  db.prepare("UPDATE employees SET active = 0, updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  res.json({ success: true });
});

export default router;