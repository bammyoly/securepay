import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { api } from "../utils/api";
import { useChainGuard } from "../hooks/useChainGuard";
import { initializeCofhejs, encryptValue, getEncryptable, isCofheReady } from "../utils/Cofhe";
import { getWriteSigner, getReadProvider } from "../utils/providers";

import ConfidentialPayrollData from "../contracts/ConfidentialPayroll.json";

const ARBISCAN = "https://sepolia.arbiscan.io";

const getGasOvr = async () => {
  const provider = getReadProvider(421614);
  const feeData  = await provider.getFeeData();
  const base     = feeData.gasPrice ?? feeData.maxFeePerGas ?? 20000000n;
  return { maxFeePerGas: base * 130n / 100n, maxPriorityFeePerGas: 1500000n };
};

const ensureEmployeeOnChain = async (payrollContract, employee, signerAddress) => {
  const active = await payrollContract.isActive(signerAddress, employee.wallet_address).catch(() => false);
  if (!active) {
    const Encryptable   = getEncryptable();
    const salaryInUnits = BigInt(Math.round(employee.salary_usd * 1_000_000));
    const encSalary     = await encryptValue(Encryptable.uint64(salaryInUnits));
    const gasOvr         = await getGasOvr();
    const gasEst         = await payrollContract.addEmployee.estimateGas(employee.wallet_address, encSalary);
    await (await payrollContract.addEmployee(employee.wallet_address, encSalary, {
      gasLimit: gasEst * 120n / 100n, ...gasOvr,
    })).wait();
  }
};

// ---------------------------------------------------------------------------
// Improved Employee Selector
// ---------------------------------------------------------------------------
const EmployeeSelector = ({ employees, selected, onChange, multi = false }) => {
  const [search, setSearch] = useState("");
  const filtered = employees.filter(e =>
    e.active && (!search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.wallet_address.toLowerCase().includes(search.toLowerCase()))
  );
  const toggle = (emp) => {
    if (!multi) { onChange([emp]); return; }
    const ids = selected.map(e => e.id);
    ids.includes(emp.id) ? onChange(selected.filter(e => e.id !== emp.id)) : onChange([...selected, emp]);
  };
  const toggleAll = () => selected.length === filtered.length ? onChange([]) : onChange(filtered);

  return (
    <div className="bg-[#0d1117] border border-slate-800/60 rounded-2xl overflow-hidden ring-1 ring-white/5">
      <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/60">
        <div className="relative group">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or address..."
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"/>
        </div>
      </div>
      {multi && filtered.length > 0 && (
        <div className="px-4 py-2 flex items-center justify-between bg-slate-900/20 border-b border-slate-800/40">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{selected.length} Selected</span>
          <button onClick={toggleAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest transition-colors p-1">
            {selected.length === filtered.length ? "Clear Selection" : "Select Page"}
          </button>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-slate-500 text-sm">No employees found</p>
          </div>
        ) : filtered.map(emp => {
          const isSelected = selected.some(e => e.id === emp.id);
          return (
            <button key={emp.id} onClick={() => toggle(emp)}
              className={`w-full flex items-center gap-4 px-4 py-3 transition-all border-b border-slate-800/30 last:border-0 ${isSelected ? "bg-indigo-500/10" : "hover:bg-slate-800/30"}`}>
              {multi && (
                <div className={`w-5 h-5 rounded-lg flex-shrink-0 border-2 flex items-center justify-center transition-all ${isSelected ? "bg-indigo-500 border-indigo-500" : "border-slate-700 bg-slate-900"}`}>
                  {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                </div>
              )}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 transition-colors ${isSelected ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">{emp.name}</p>
                <p className="text-[10px] text-slate-500 font-mono tracking-tighter opacity-70">{emp.wallet_address}</p>
              </div>
              <div className="text-right flex-shrink-0 bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-800/50">
                <p className="text-xs font-black text-white">${emp.salary_usd.toLocaleString()}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">USDC</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Improved Schedule Modal
// ---------------------------------------------------------------------------
const ScheduleModal = ({ employees, onClose, onSave }) => {
  const [name, setName]           = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDate, setNextDate]   = useState("");
  const [selected, setSelected]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const handleSave = async () => {
    if (!name.trim())     { setError("Schedule name required"); return; }
    if (!nextDate)        { setError("Run date required"); return; }
    if (!selected.length) { setError("Select at least one employee"); return; }
    setLoading(true); setError("");
    try {
      await api.schedules.create({ name, frequency, next_run_date: nextDate, employee_ids: selected.map(e => e.id) });
      onSave(); onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-xl bg-[#0d1117] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-[0_0_50px_-12px_rgba(79,70,229,0.2)]">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-800/60 bg-gradient-to-r from-slate-900 to-transparent">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Recurring Payroll</h2>
            <p className="text-xs text-slate-500">Automate your confidential payouts</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-8 py-6 space-y-5 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Schedule Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 Engineering Payroll"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all shadow-inner"/>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all appearance-none">
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">First Run Date</label>
              <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"/>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Included Recipients</label>
            <EmployeeSelector employees={employees} selected={selected} onChange={setSelected} multi={true}/>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">{error}</div>}
        </div>
        <div className="px-8 py-6 bg-slate-900/30 border-t border-slate-800/60">
          <button onClick={handleSave} disabled={loading}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] ${
              loading ? "bg-slate-800 text-slate-600 cursor-wait" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
            }`}>
            {loading ? "Processing..." : "Confirm Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Improved Payments Main
// ---------------------------------------------------------------------------
const Payments = () => {
  const [tab,          setTab]          = useState("instant");
  const [paymentType,  setPaymentType]  = useState("single");
  const [employees,    setEmployees]    = useState([]);
  const [schedules,    setSchedules]    = useState([]);
  const [selectedEmps, setSelectedEmps] = useState([]);
  const [loadingEmps,  setLoadingEmps]  = useState(true);
  const [txStep,        setTxStep]       = useState("idle");
  const [txHash,        setTxHash]       = useState(null);
  const [txError,       setTxError]      = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [fheReady,      setFheReady]     = useState(false);

  const { onArb } = useChainGuard();

  useEffect(() => {
    if (!isCofheReady()) initializeCofhejs().then(r => setFheReady(r.success));
    else setFheReady(true);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoadingEmps(true);
      const [emps, scheds] = await Promise.all([api.employees.list(), api.schedules.list().catch(() => [])]);
      setEmployees(emps); setSchedules(scheds);
    } catch (err) { console.error("[payments] load:", err); }
    finally { setLoadingEmps(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalAmount = selectedEmps.reduce((s, e) => s + e.salary_usd, 0);
  const canPay      = selectedEmps.length > 0 && onArb && fheReady && txStep === "idle";

  const handlePay = async () => {
    if (!canPay) return;
    setTxError(""); setTxHash(null);
    try {
      const signer          = await getWriteSigner();
      const signerAddress   = await signer.getAddress();
      const payrollContract = new ethers.Contract(ConfidentialPayrollData.address, ConfidentialPayrollData.abi, signer);

      setTxStep("encrypting");
      for (const emp of selectedEmps) {
        setTxStep("registering");
        await ensureEmployeeOnChain(payrollContract, emp, signerAddress);
      }

      setTxStep("submitting");
      const gasOvr = await getGasOvr();
      let tx;
      if (selectedEmps.length === 1) {
        const gasEst = await payrollContract.paySalary.estimateGas(selectedEmps[0].wallet_address);
        tx = await payrollContract.paySalary(selectedEmps[0].wallet_address, { gasLimit: gasEst * 120n / 100n, ...gasOvr });
      } else {
        const addrs  = selectedEmps.map(e => e.wallet_address);
        const gasEst = await payrollContract.payBatch.estimateGas(addrs);
        tx = await payrollContract.payBatch(addrs, { gasLimit: gasEst * 120n / 100n, ...gasOvr });
      }

      setTxStep("confirming"); setTxHash(tx.hash);
      await tx.wait();
      await api.payments.record({ employee_ids: selectedEmps.map(e => e.id), tx_hash: tx.hash });
      setTxStep("done");
    } catch (err) {
      console.error("[pay]", err);
      setTxError(err.reason || err.message || "Payment failed");
      setTxStep("error");
    }
  };

  const reset = () => { setTxStep("idle"); setTxHash(null); setTxError(""); setSelectedEmps([]); };

  const handleRunSchedule = async (schedule) => {
    try {
      const result = await api.schedules.run(schedule.id);
      setTab("instant");
      setPaymentType(result.employees.length === 1 ? "single" : "batch");
      setSelectedEmps(result.employees);
    } catch (err) { alert(err.message); }
  };

  const handlePauseSchedule = async (schedule) => {
    if (!confirm(`Pause "${schedule.name}"?`)) return;
    await api.schedules.pause(schedule.id);
    loadData();
  };

  const STEP_LABEL = {
    idle: null, encrypting: "Encrypting with FHE...", registering: "Registering Employees...",
    submitting: "Broadcasting to Arbitrum...", confirming: "Confirming Block...",
    done: "Success", error: txError,
  };

  const activeSchedules = schedules.filter(s => s.status === "active");
  const today           = new Date().toISOString().split("T")[0];
  const dueSchedules    = activeSchedules.filter(s => s.next_run_date <= today);

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-sans selection:bg-indigo-500/30">
      {showSchedule && (
        <ScheduleModal employees={employees} onClose={() => setShowSchedule(false)} onSave={loadData}/>
      )}

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-24 space-y-8">

        {/* Header Section */}
        <header className="flex mt-10 flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Payments</h1>
          </div>
          <button onClick={() => setShowSchedule(true)}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-xs uppercase tracking-widest hover:bg-slate-800 hover:border-slate-700 hover:text-white transition-all group active:scale-95 shadow-xl">
            <svg className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Schedule Payout
          </button>
        </header>

        {/* Dynamic Alerts Container */}
        <div className="space-y-3">
          {!onArb && (
            <div className="px-6 py-4 rounded-[1.5rem] bg-amber-500/5 border border-amber-500/20 flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
                <svg className="w-5 h-5 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <p className="text-sm text-amber-200/80 font-medium">Network Mismatch. Please switch your wallet to <span className="text-amber-400 font-bold underline underline-offset-4">Arbitrum Sepolia</span>.</p>
            </div>
          )}

          {dueSchedules.length > 0 && (
            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-[1.5rem] p-6 shadow-2xl shadow-indigo-900/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <h3 className="text-sm font-black text-indigo-100 uppercase tracking-widest">{dueSchedules.length} Pending Automation{dueSchedules.length > 1 ? "s" : ""}</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dueSchedules.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-indigo-950/40 rounded-2xl border border-indigo-500/10 hover:border-indigo-500/30 transition-all group">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{s.name}</p>
                      <p className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter opacity-60 italic">Next: {s.next_run_date}</p>
                    </div>
                    <button onClick={() => handleRunSchedule(s)} className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg active:scale-90">
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <nav className="flex p-1.5 bg-[#0d1117] border border-slate-800 rounded-2xl shadow-inner">
          {[["instant", "Instant Payout"], ["scheduled", "Management"]].map(([val, label]) => (
            <button key={val} onClick={() => setTab(val)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-300 ${
                tab === val ? "bg-slate-800 text-indigo-400 shadow-md ring-1 ring-white/5" : "text-slate-500 hover:text-slate-300"
              }`}>
              {label}
              {val === "scheduled" && activeSchedules.length > 0 && (
                <span className="ml-3 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-black shadow-[0_0_10px_rgba(99,102,241,0.4)] animate-pulse">{activeSchedules.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Main Content Area */}
        <main className="min-h-[400px]">
          {tab === "instant" && (
            <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
              
              {txStep === "done" && (
                <div className="p-12 rounded-[2.5rem] bg-emerald-500/[0.03] border border-emerald-500/20 text-center shadow-2xl">
                  <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
                    <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2">Payout Complete</h2>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    Transaction confirmed on Arbitrum.<br/> 
                    <span className="font-bold text-slate-200">{selectedEmps.length} beneficiaries</span> received their encrypted salary.
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    {txHash && (
                      <a href={`${ARBISCAN}/tx/${txHash}`} target="_blank" rel="noreferrer"
                        className="group flex items-center gap-2 text-[10px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest transition-colors">
                        View Receipt
                        <svg className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                      </a>
                    )}
                    <button onClick={reset} className="px-10 py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-xl">
                      New Operation
                    </button>
                  </div>
                </div>
              )}

              {txStep !== "done" && (
                <>
                  <div className="flex p-1 bg-[#0d1117] border border-slate-800 rounded-xl w-fit shadow-lg">
                    {[["single", "Individual"], ["batch", "Batch Run"]].map(([val, label]) => (
                      <button key={val} onClick={() => { setPaymentType(val); setSelectedEmps([]); }}
                        className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          paymentType === val ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/5" : "text-slate-500 hover:text-slate-300"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <section className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
                      {paymentType === "single" ? "Recipient" : "Batch Selection"}
                    </label>
                    {loadingEmps ? (
                      <div className="h-48 bg-[#0d1117] border border-slate-800 rounded-[2rem] animate-pulse flex items-center justify-center text-slate-700 font-black italic tracking-widest uppercase text-xs">Syncing Ledger...</div>
                    ) : (
                      <EmployeeSelector employees={employees} selected={selectedEmps} onChange={setSelectedEmps} multi={paymentType === "batch"}/>
                    )}
                  </section>

                  {selectedEmps.length > 0 && (
                    <section className="bg-slate-900/30 border border-slate-800/60 rounded-[2rem] p-8 shadow-inner animate-in zoom-in-95 duration-300">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Execution Summary</p>
                      <div className="space-y-4 mb-8 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {selectedEmps.map(emp => (
                          <div key={emp.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-black border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                {emp.name.charAt(0)}
                              </div>
                              <span className="text-sm text-slate-200 font-bold group-hover:text-white transition-colors">{emp.name}</span>
                            </div>
                            <span className="text-sm font-black text-white tabular-nums tracking-tight">${emp.salary_usd.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between pt-6 border-t border-slate-800">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Outflow</span>
                        <div className="text-right">
                           <span className="text-xl font-black text-white tabular-nums tracking-tighter">${totalAmount.toLocaleString()}</span>
                           <span className="ml-2 text-xs font-bold text-slate-500 tracking-tighter">USDC</span>
                        </div>
                      </div>
                    </section>
                  )}

                  <div className="space-y-4">
                    {txStep !== "idle" && txStep !== "error" && (
                      <div className="flex items-center gap-4 px-6 py-5 rounded-[1.5rem] bg-indigo-600/5 border border-indigo-500/20 shadow-xl">
                        <div className="relative">
                          <div className="w-5 h-5 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"/>
                        </div>
                        <p className="text-sm text-indigo-200 font-bold tracking-tight">{STEP_LABEL[txStep]}</p>
                        {txHash && (
                          <a href={`${ARBISCAN}/tx/${txHash}`} target="_blank" rel="noreferrer"
                            className="ml-auto text-[10px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest underline underline-offset-4 decoration-indigo-500/30">Trace Tx</a>
                        )}
                      </div>
                    )}

                    {txStep === "error" && (
                      <div className="px-6 py-5 rounded-[1.5rem] bg-red-500/5 border border-red-500/20 flex items-center justify-between shadow-2xl">
                        <div className="flex items-center gap-4">
                           <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"/>
                           <p className="text-xs text-red-400 font-bold leading-relaxed max-w-[80%]">{txError}</p>
                        </div>
                        <button onClick={reset} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors underline">Retry</button>
                      </div>
                    )}

                    {!fheReady && (
                      <div className="px-6 py-4 rounded-[1.5rem] bg-indigo-950/20 border border-indigo-500/10 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"/>
                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">Cofhejs Initializing...</p>
                      </div>
                    )}

                    <button onClick={handlePay} disabled={!canPay}
                      className={`w-full py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.25em] transition-all duration-500 group relative overflow-hidden shadow-2xl active:scale-[0.98] ${
                        canPay ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 ring-1 ring-white/20" : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
                      }`}>
                      <span className="relative z-10">
                        {txStep !== "idle"
                          ? STEP_LABEL[txStep] || "Processing..."
                          : selectedEmps.length === 0 ? "Select Employee"
                          : `Execute ${selectedEmps.length > 1 ? "Batch" : ""} Transfer`}
                      </span>
                      {canPay && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"/>}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "scheduled" && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
              {activeSchedules.length === 0 ? (
                <div className="bg-[#0d1117] border border-slate-800 rounded-[3rem] py-24 text-center group">
                  <div className="w-16 h-16 rounded-[2rem] bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6 group-hover:border-indigo-500/30 transition-colors shadow-inner">
                    <svg className="w-8 h-8 text-slate-700 group-hover:text-indigo-400/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <p className="text-slate-400 font-black text-sm uppercase tracking-widest mb-1">Queue Empty</p>
                  <p className="text-slate-600 text-xs mb-8">No automated payrolls configured for this vault.</p>
                  <button onClick={() => setShowSchedule(true)}
                    className="px-8 py-3 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600 hover:text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95">
                    Configure Automation
                  </button>
                </div>
              ) : activeSchedules.map(schedule => {
                const isDue = schedule.next_run_date <= today;
                return (
                  <div key={schedule.id}
                    className={`group rounded-[2rem] border transition-all duration-500 overflow-hidden ${isDue ? "bg-indigo-900/10 border-indigo-500/30 shadow-2xl shadow-indigo-950/20" : "bg-[#0d1117] border-slate-800 hover:border-slate-700 shadow-xl"}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 border-b border-white/5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-white text-xl tracking-tight">{schedule.name}</h3>
                          {isDue && (
                            <span className="px-3 py-1 rounded-full bg-indigo-500 text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(99,102,241,0.5)]">Action Required</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"/>
                          {schedule.frequency} cycle · Next run:{" "}
                          <span className={isDue ? "text-indigo-400 font-black underline underline-offset-4" : "text-slate-300 font-bold"}>{schedule.next_run_date}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isDue && (
                          <button onClick={() => handleRunSchedule(schedule)}
                            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-90">
                            Execute Run
                          </button>
                        )}
                        <button onClick={() => handlePauseSchedule(schedule)}
                          className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-400 hover:border-red-500/20 text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                          Disable
                        </button>
                      </div>
                    </div>
                    {schedule.employees?.length > 0 && (
                      <div className="p-6 bg-slate-950/20 space-y-2">
                        {schedule.employees.map(emp => (
                          <div key={emp.id} className="flex items-center justify-between px-5 py-3 rounded-xl bg-slate-900/30 border border-white/[0.02] hover:bg-slate-900/60 transition-colors group/item">
                            <div className="flex items-center gap-4">
                              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-[10px] font-black border border-indigo-500/10 group-hover/item:bg-indigo-500 group-hover/item:text-white transition-all">
                                {emp.name.charAt(0)}
                              </div>
                              <span className="text-sm text-slate-300 font-bold group-hover/item:text-white transition-colors">{emp.name}</span>
                            </div>
                            <span className="text-xs font-black text-slate-500 tabular-nums tracking-tight group-hover/item:text-slate-200 transition-colors">${emp.salary_usd?.toLocaleString() ?? "—"}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-4 px-5">
                          <span className="text-[9px] text-slate-600 uppercase tracking-[0.2em] font-black">Periodic Requirement</span>
                          <span className="text-xs font-black text-slate-400 tabular-nums">
                            ${schedule.employees.reduce((s, e) => s + (e.salary_usd ?? 0), 0).toLocaleString()} USDC
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Payments;