// src/middleware/auth.js
// Verifies JWT issued by /api/auth/login or /api/auth/register.
// Attaches req.user (always) and req.employer (when role === 'employer').
// All existing routes that use req.employer continue to work unchanged.

import db              from "../db/schema.js";
import { verifyToken } from "../routes/auth.js";

/**
 * requireAuth — base middleware, validates JWT and attaches req.user
 */
export const requireAuth = (req, res, next) => {
  try {
    const header = req.headers["authorization"] || "";
    const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const payload = verifyToken(token);
    req.user = payload; // { id, address, role, iat }
    next();
  } catch (err) {
    console.error("[auth]", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * requireEmployer — extends requireAuth, also attaches req.employer
 * Drop-in replacement for the old requireEmployer — routes don't need changes.
 */
export const requireEmployer = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== "employer") {
      return res.status(403).json({ error: "Employer access required" });
    }

    const employer = db
      .prepare("SELECT * FROM employers WHERE LOWER(wallet_address) = LOWER(?)")
      .get(req.user.address);

    if (!employer) {
      return res.status(403).json({ error: "Employer record not found" });
    }

    req.employer = employer; // existing routes read req.employer.id — preserved
    next();
  });
};