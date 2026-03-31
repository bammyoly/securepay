// src/db/schema.js
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, "../../payroll.db");

export const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  -- -------------------------------------------------------------------------
  -- Users — wallet-linked accounts with name, email and role
  -- One user per wallet. Employer users map 1-to-1 with the employers table.
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    role           TEXT NOT NULL CHECK(role IN ('employer','employee')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet
    ON users (LOWER(wallet_address));

  -- -------------------------------------------------------------------------
  -- Employers — unchanged, still the FK target for all payroll data
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS employers (
    id             TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    company_name   TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id               TEXT PRIMARY KEY,
    employer_id      TEXT NOT NULL REFERENCES employers(id),
    wallet_address   TEXT NOT NULL,
    name             TEXT NOT NULL,
    email            TEXT,
    role             TEXT,
    department       TEXT,
    salary_usd       REAL NOT NULL,
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(employer_id, wallet_address)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id             TEXT PRIMARY KEY,
    employer_id    TEXT NOT NULL REFERENCES employers(id),
    employee_id    TEXT NOT NULL REFERENCES employees(id),
    tx_hash        TEXT,
    amount_usd     REAL NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    scheduled_date TEXT,
    triggered_at   TEXT,
    confirmed_at   TEXT,
    error_message  TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id            TEXT PRIMARY KEY,
    employer_id   TEXT NOT NULL REFERENCES employers(id),
    name          TEXT NOT NULL,
    frequency     TEXT NOT NULL,
    next_run_date TEXT NOT NULL,
    employee_ids  TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_employees_employer ON employees(employer_id);
  CREATE INDEX IF NOT EXISTS idx_payments_employer  ON payments(employer_id);
  CREATE INDEX IF NOT EXISTS idx_payments_employee  ON payments(employee_id);
  CREATE INDEX IF NOT EXISTS idx_payments_status    ON payments(status);
  CREATE INDEX IF NOT EXISTS idx_schedules_employer ON schedules(employer_id);
  CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_date);
`);

console.log("[db] ready:", DB_PATH);
export default db;