// src/routes/auth.js
import { Router } from "express";
import { ethers } from "ethers";
import crypto     from "crypto";
import db         from "../db/schema.js";

// NO contract imports — backend is the sole authorization layer

const router = Router();

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body   = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  const sig    = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  const [header, body, sig] = (token || "").split(".");
  if (!header || !body || !sig) throw new Error("Malformed token");
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (sig !== expected) throw new Error("Invalid token signature");
  return JSON.parse(Buffer.from(body, "base64url").toString());
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------
function buildMessage(nonce) {
  return `Welcome to ConfidentialPayroll\n\nSign this message to verify your wallet.\n\nNonce: ${nonce}\nThis request does not trigger a blockchain transaction.`;
}

function verifySignature(address, message, signature) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/check/:address
// ---------------------------------------------------------------------------
router.get("/check/:address", (req, res) => {
  const { address } = req.params;
  if (!ethers.isAddress(address))
    return res.status(400).json({ error: "Invalid wallet address" });

  const user = db.prepare(`
    SELECT id, name, email, wallet_address, role, created_at
    FROM users WHERE LOWER(wallet_address) = LOWER(?)
  `).get(address);

  return res.json({ exists: !!user, user: user || null });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post("/login", (req, res) => {
  const { address, signature, message } = req.body;

  if (!address || !signature || !message)
    return res.status(400).json({ error: "address, signature and message are required" });
  if (!ethers.isAddress(address))
    return res.status(400).json({ error: "Invalid wallet address" });
  if (!verifySignature(address, message, signature))
    return res.status(401).json({ error: "Signature verification failed" });

  const user = db.prepare(`
    SELECT id, name, email, wallet_address, role, created_at
    FROM users WHERE LOWER(wallet_address) = LOWER(?)
  `).get(address);

  if (!user)
    return res.status(404).json({ error: "No account found. Please register." });

  let employer = null;
  if (user.role === "employer") {
    employer = db.prepare("SELECT * FROM employers WHERE LOWER(wallet_address) = LOWER(?)")
                 .get(address);
  }

  const token = signToken({ id: user.id, address: address.toLowerCase(), role: user.role });
  return res.json({ user, employer, token });
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post("/register", (req, res) => {
  const { address, signature, nonce, name, email, role } = req.body;

  if (!address || !signature || !nonce || !name || !email || !role)
    return res.status(400).json({ error: "address, signature, nonce, name, email and role are required" });
  if (!ethers.isAddress(address))
    return res.status(400).json({ error: "Invalid wallet address" });
  if (!["employer", "employee"].includes(role))
    return res.status(400).json({ error: "role must be 'employer' or 'employee'" });
  if (!/\S+@\S+\.\S+/.test(email))
    return res.status(400).json({ error: "Invalid email address" });

  const message = buildMessage(nonce);
  if (!verifySignature(address, message, signature))
    return res.status(401).json({ error: "Signature verification failed" });

  const addr = address.toLowerCase();

  // Block if a real user account already exists
  const existingUser = db.prepare(`
    SELECT id FROM users
    WHERE LOWER(wallet_address) = ? OR LOWER(email) = ?
  `).get(addr, email.trim().toLowerCase());

  if (existingUser)
    return res.status(409).json({ error: "Wallet or email already registered" });

  // Remove any stale auto-created employer row from the old middleware
  const staleEmployer = db.prepare(
    "SELECT id FROM employers WHERE LOWER(wallet_address) = ?"
  ).get(addr);

  if (staleEmployer) {
    db.prepare("DELETE FROM employers WHERE LOWER(wallet_address) = ?").run(addr);
    console.log(`[auth] removed stale employer row for ${addr}`);
  }

  // Insert user + employer DB row atomically
  const userId     = crypto.randomUUID();
  const employerId = crypto.randomUUID();

  const register = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, wallet_address, name, email, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, addr, name.trim(), email.trim().toLowerCase(), role);

    if (role === "employer") {
      db.prepare(`
        INSERT INTO employers (id, wallet_address, company_name)
        VALUES (?, ?, ?)
      `).run(employerId, addr, name.trim());
    }
  });

  try {
    register();
  } catch (err) {
    if (err.message.includes("UNIQUE"))
      return res.status(409).json({ error: "Wallet or email already registered" });
    throw err;
  }

  const user = db.prepare(`
    SELECT id, name, email, wallet_address, role, created_at
    FROM users WHERE id = ?
  `).get(userId);

  const employer = role === "employer"
    ? db.prepare("SELECT * FROM employers WHERE id = ?").get(employerId)
    : null;

  const token = signToken({ id: user.id, address: addr, role: user.role });
  return res.status(201).json({ user, employer, token });
});

export default router;