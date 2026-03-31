// src/index.js
import "dotenv/config";
import express from "express";
import cors    from "cors";

import "./db/schema.js";
import { startScheduler } from "./services/scheduler.js";
import authRouter      from "./routes/auth.js";
import employeesRouter from "./routes/employees.js";
import paymentsRouter  from "./routes/payments.js";
import schedulesRouter from "./routes/schedules.js";

const app  = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  // Added Authorization so the JWT Bearer token passes through
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (_, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// Auth — public (no middleware)
app.use("/api/auth",      authRouter);

// Protected — all use requireEmployer internally (unchanged)
app.use("/api/employees", employeesRouter);
app.use("/api/payments",  paymentsRouter);
app.use("/api/schedules", schedulesRouter);

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
  startScheduler();
});