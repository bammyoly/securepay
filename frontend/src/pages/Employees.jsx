import React, { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const exportCSV = (employees) => {
  const headers = ["Name", "Wallet Address", "Role", "Department", "Salary (USD)", "Status", "Created"];
  const rows = employees.map(e => [
    e.name, e.wallet_address, e.role ?? "", e.department ?? "",
    e.salary_usd, e.active ? "Active" : "Inactive",
    new Date(e.created_at).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const a   = document.createElement("a");
  a.href    = "data:text/csv," + encodeURIComponent(csv);
  a.download = `employees-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
};

// ---------------------------------------------------------------------------
// Add / Edit panel
// ---------------------------------------------------------------------------
const EmployeePanel = ({ employee, onClose, onSave }) => {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    name:           employee?.name           ?? "",
    wallet_address: employee?.wallet_address ?? "",
    salary_usd:     employee?.salary_usd     ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim())                                 { setError("Name is required"); return; }
    if (!form.wallet_address.trim())                       { setError("Wallet address is required"); return; }
    if (!form.salary_usd || parseFloat(form.salary_usd) <= 0) { setError("Valid salary required"); return; }
    setLoading(true); setError("");
    try {
      if (isEdit) await api.employees.update(employee.id, { name: form.name, salary_usd: parseFloat(form.salary_usd) });
      else        await api.employees.create({ name: form.name, wallet_address: form.wallet_address, salary_usd: parseFloat(form.salary_usd) });
      onSave(); onClose();
    } catch (err) { setError(err.message); }
    finally       { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="w-full max-w-md bg-[#0d1117] border-l border-slate-800 h-full overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-black tracking-tight text-white">{isEdit ? "Edit Employee" : "Add Employee"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{isEdit ? "Update employee details" : "Register a new team member"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-7 py-6 space-y-5 flex-1">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Full Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Alice Johnson"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"/>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Wallet Address *</label>
            <input value={form.wallet_address} onChange={e => set("wallet_address", e.target.value)}
              disabled={isEdit} placeholder="0x..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"/>
            {isEdit && <p className="text-[10px] text-slate-600 mt-1">Wallet address cannot be changed</p>}
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Monthly Salary (USDC) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
              <input value={form.salary_usd} onChange={e => set("salary_usd", e.target.value)}
                type="number" min="0" placeholder="5000"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"/>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Stored off-chain · encrypted on-chain when paying</p>
          </div>
          {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
        </div>

        <div className="px-7 pb-7 pt-4 border-t border-slate-800">
          <button onClick={handleSubmit} disabled={loading}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
              loading ? "bg-slate-800 text-slate-600 cursor-wait" : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}>
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Payment History Modal
// ---------------------------------------------------------------------------
const PaymentHistory = ({ employee, onClose }) => {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.payments.list({ employee_id: employee.id, limit: 50 })
      .then(setPayments).catch(console.error).finally(() => setLoading(false));
  }, [employee.id]);

  const STATUS_CLS = {
    confirmed: "bg-emerald-950/60 text-emerald-400 border-emerald-800/50",
    submitted: "bg-indigo-950/60 text-indigo-400 border-indigo-800/50",
    pending:   "bg-amber-950/60 text-amber-400 border-amber-800/50",
    failed:    "bg-red-950/60 text-red-400 border-red-800/50",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0d1117] border border-slate-800 rounded-3xl overflow-hidden max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-black text-white">{employee.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{employee.wallet_address.slice(0,10)}…{employee.wallet_address.slice(-8)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="px-7 py-10 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800/60 rounded-xl animate-pulse"/>)}
            </div>
          ) : payments.length === 0 ? (
            <div className="px-7 py-16 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-800/60 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <p className="text-slate-500 font-bold text-sm">No payments yet</p>
              <p className="text-slate-600 text-xs mt-1">Payments will appear here after payroll runs</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Date</th>
                  <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Amount</th>
                  <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Tx Hash</th>
                  <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-7 py-3.5 text-xs text-slate-400">
                      {p.confirmed_at
                        ? new Date(p.confirmed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : p.scheduled_date ?? "—"}
                    </td>
                    <td className="px-7 py-3.5 text-sm font-black text-white">${p.amount_usd.toFixed(2)}</td>
                    <td className="px-7 py-3.5">
                      {p.tx_hash ? (
                        <a href={`https://sepolia.arbiscan.io/tx/${p.tx_hash}`} target="_blank" rel="noreferrer"
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 font-mono transition-colors">
                          {p.tx_hash.slice(0,8)}…{p.tx_hash.slice(-6)}
                        </a>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-7 py-3.5 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${STATUS_CLS[p.status] ?? STATUS_CLS.pending}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Employees Page
// ---------------------------------------------------------------------------
const Employees = () => {
  const [employees,    setEmployees]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selected,     setSelected]     = useState(new Set());
  const [showPanel,    setShowPanel]    = useState(false);
  const [editEmp,      setEditEmp]      = useState(null);
  const [historyEmp,   setHistoryEmp]   = useState(null);
  const [bulkLoading,  setBulkLoading]  = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setEmployees(await api.employees.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.wallet_address.toLowerCase().includes(search.toLowerCase()) ||
      (e.role ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "active" && e.active) ||
      (statusFilter === "inactive" && !e.active);
    return matchSearch && matchStatus;
  });

  const allSelected  = filtered.length > 0 && filtered.every(e => selected.has(e.id));
  const someSelected = selected.size > 0;

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll    = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(e => e.id)));

  const handleBulkDeactivate = async () => {
    if (!selected.size || !confirm(`Deactivate ${selected.size} employee(s)?`)) return;
    setBulkLoading(true);
    try { await Promise.all([...selected].map(id => api.employees.deactivate(id))); setSelected(new Set()); await load(); }
    catch (err) { alert(err.message); }
    finally { setBulkLoading(false); }
  };

  const handleToggleActive = async (emp) => {
    try { await api.employees.update(emp.id, { active: emp.active ? 0 : 1 }); await load(); }
    catch (err) { alert(err.message); }
  };

  const activeCount = employees.filter(e => e.active).length;

  return (
    <div className="min-h-screen bg-[#07090f] text-white">
      {showPanel && (
        <EmployeePanel employee={editEmp} onClose={() => { setShowPanel(false); setEditEmp(null); }} onSave={load}/>
      )}
      {historyEmp && <PaymentHistory employee={historyEmp} onClose={() => setHistoryEmp(null)}/>}

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-16 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row mt-10 sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Employee Registry</h1>
            <p className="text-slate-500 text-sm mt-1">
              {activeCount} active · {employees.length} total
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={() => exportCSV(filtered)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 font-bold text-sm hover:bg-slate-800 transition-all text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export
            </button>
            <button onClick={() => { setEditEmp(null); setShowPanel(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
              </svg>
              Add Employee
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active",   value: activeCount,                          color: "text-emerald-400", dot: "bg-emerald-400" },
            { label: "Inactive", value: employees.length - activeCount,       color: "text-slate-400",   dot: "bg-slate-600"   },
            { label: "Total",    value: employees.length,                     color: "text-indigo-400",  dot: "bg-indigo-400"  },
          ].map(s => (
            <div key={s.label} className="bg-[#0d1117] border border-slate-800 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</p>
              </div>
              <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, wallet, or role…"
              className="w-full bg-[#0d1117] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"/>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-slate-800">
            {["active", "inactive", "all"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                  statusFilter === s ? "bg-indigo-600 text-white" : "bg-[#0d1117] text-slate-500 hover:text-white"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk actions */}
        {someSelected && (
          <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-indigo-950/40 border border-indigo-900/50">
            <p className="text-sm font-bold text-indigo-300">{selected.size} selected</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-white font-bold transition-colors">Clear</button>
              <button onClick={handleBulkDeactivate} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-xs font-black hover:bg-red-950 transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                </svg>
                {bulkLoading ? "Deactivating…" : "Deactivate Selected"}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#0d1117] border border-slate-800 rounded-3xl overflow-hidden">
          {/* Table header */}
          <div className="px-7 py-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-black text-base tracking-tight">Employees</h3>
              <p className="text-xs text-slate-500 mt-0.5">{filtered.length} {statusFilter !== "all" ? statusFilter : "total"} employees</p>
            </div>
          </div>

          {error ? (
            <div className="px-7 py-16 text-center">
              <p className="text-red-400 font-bold text-sm">{error}</p>
              <button onClick={load} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-bold">Retry</button>
            </div>
          ) : loading ? (
            <div className="px-7 py-10 space-y-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-5 h-5 rounded bg-slate-800/60"/>
                  <div className="w-9 h-9 rounded-xl bg-slate-800/60"/>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800/60 rounded w-40"/>
                    <div className="h-2 bg-slate-800/40 rounded w-28"/>
                  </div>
                  <div className="h-3 bg-slate-800/60 rounded w-20 hidden lg:block"/>
                  <div className="h-6 bg-slate-800/60 rounded-lg w-16"/>
                  <div className="h-8 bg-slate-800/60 rounded-lg w-20"/>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-7 py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <p className="text-slate-500 font-bold text-sm">{search ? "No employees match your search" : "No employees yet"}</p>
              <p className="text-slate-600 text-xs mt-1">{search ? "Try a different term" : "Add your first employee to get started"}</p>
              {!search && (
                <button onClick={() => { setEditEmp(null); setShowPanel(true); }}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black transition-all">
                  Add Employee
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/60">
                    <th className="px-6 py-4">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"/>
                    </th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Employee</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Salary</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600 hidden lg:table-cell">Wallet</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600 text-center">Status</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filtered.map(emp => (
                    <tr key={emp.id} className={`hover:bg-slate-800/20 transition-colors ${selected.has(emp.id) ? "bg-indigo-950/20" : ""}`}>
                      <td className="px-6 py-4">
                        <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)}
                          className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"/>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center text-indigo-300 font-black text-sm flex-shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-white">{emp.name}</p>
                            {emp.department && <p className="text-[10px] text-slate-600">{emp.department}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-black text-white tabular-nums">${emp.salary_usd.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-600">/month</p>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-[11px] text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded-lg">
                          {emp.wallet_address.slice(0,8)}…{emp.wallet_address.slice(-6)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => handleToggleActive(emp)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                            emp.active
                              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/50 hover:bg-red-950/60 hover:text-red-400 hover:border-red-800/50"
                              : "bg-slate-800/60 text-slate-500 border-slate-700 hover:bg-emerald-950/60 hover:text-emerald-400 hover:border-emerald-800/50"
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? "bg-emerald-400" : "bg-slate-500"}`}/>
                          {emp.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setHistoryEmp(emp)} title="Payment history"
                            className="p-2 rounded-lg bg-slate-900 hover:bg-indigo-950/60 text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-800/50 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                          </button>
                          <button onClick={() => { setEditEmp(emp); setShowPanel(true); }} title="Edit"
                            className="p-2 rounded-lg bg-slate-900 hover:bg-indigo-950/60 text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-800/50 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Employees;