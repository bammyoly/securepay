// src/utils/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ---------------------------------------------------------------------------
// Auth headers — JWT token from localStorage
// ---------------------------------------------------------------------------
export const getAuthHeaders = () => ({
  "Content-Type":  "application/json",
  "Authorization": `Bearer ${localStorage.getItem("cp_token") ?? ""}`,
});

export const clearAuth = () => {};

// ---------------------------------------------------------------------------
// Core fetch wrapper — JWT authenticated
// ---------------------------------------------------------------------------
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });

  if (res.status === 401) {
    localStorage.removeItem("cp_token");
    localStorage.removeItem("cp_address");
    localStorage.removeItem("cp_user");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }

  return res.json();
};

// ---------------------------------------------------------------------------
// Public fetch — no auth (for received payments lookup)
// ---------------------------------------------------------------------------
const publicFetch = async (path) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
};

// ---------------------------------------------------------------------------
// Auth endpoints (no token needed — public)
// ---------------------------------------------------------------------------
const authFetch = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
};

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------
export const api = {
  auth: {
    check:    (address) => authFetch(`/api/auth/check/${address}`),
    login:    (data)    => authFetch("/api/auth/login",    { method: "POST", body: JSON.stringify(data) }),
    register: (data)    => authFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  },
  employees: {
    list:       ()           => apiFetch("/api/employees"),
    get:        (id)         => apiFetch(`/api/employees/${id}`),
    create:     (data)       => apiFetch("/api/employees",       { method: "POST",  body: JSON.stringify(data) }),
    update:     (id, data)   => apiFetch(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deactivate: (id)         => apiFetch(`/api/employees/${id}`, { method: "DELETE" }),
  },
  payments: {
    list:         (params = {}) => apiFetch("/api/payments?" + new URLSearchParams(params)),
    due:          ()            => apiFetch("/api/payments/due"),
    record:       (data)        => apiFetch("/api/payments",      { method: "POST",  body: JSON.stringify(data) }),
    confirm:      (id, tx_hash) => apiFetch(`/api/payments/${id}/confirm`, { method: "PATCH", body: JSON.stringify({ tx_hash }) }),
    confirmBatch: (ids, tx_hash)=> apiFetch("/api/payments/confirm-batch", { method: "PATCH", body: JSON.stringify({ payment_ids: ids, tx_hash }) }),
    // Public — no auth needed, employee looks up their own wallet
    received:     (wallet)      => publicFetch(`/api/payments/received/${wallet}`),
  },
  schedules: {
    list:   ()         => apiFetch("/api/schedules"),
    create: (data)     => apiFetch("/api/schedules",       { method: "POST",   body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/api/schedules/${id}`, { method: "PATCH",  body: JSON.stringify(data) }),
    run:    (id)       => apiFetch(`/api/schedules/${id}/run`, { method: "POST" }),
    pause:  (id)       => apiFetch(`/api/schedules/${id}`, { method: "DELETE" }),
  },
};