import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useChainGuard } from "../hooks/useChainGuard";
import { initializeCofhejs, unsealValue, encryptValue, getEncryptable, isCofheReady } from "../utils/Cofhe";
import { getReadProvider, getEventsProvider, getWriteSigner } from "../utils/providers";
import { api } from "../utils/api";

import cUSDCData   from "../contracts/cUSDC.json";
import VaultData   from "../contracts/Vault.json";
import PayrollData from "../contracts/ConfidentialPayroll.json";

const ARBISCAN = "https://sepolia.arbiscan.io";

const CUSDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const getGasOverrides = async () => {
  const provider = getReadProvider(421614);
  const feeData  = await provider.getFeeData();
  const base     = feeData.gasPrice ?? feeData.maxFeePerGas ?? 20000000n;
  return { maxFeePerGas: base * 130n / 100n, maxPriorityFeePerGas: 1500000n };
};

const Modal = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
    <div className="w-full max-w-md bg-[#0d1117] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div className="px-7 py-6">{children}</div>
    </div>
  </div>
);

const AmountInput = ({ value, onChange, max, label, onMax }) => (
  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 focus-within:border-indigo-500 transition-colors">
    <div className="flex justify-between mb-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      {onMax && (
        <button onClick={onMax} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors">
          Max · {max}
        </button>
      )}
    </div>
    <div className="flex items-center gap-3">
      <input type="number" min="0" placeholder="0.00" value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 bg-transparent text-3xl font-black text-white placeholder:text-slate-700 outline-none tabular-nums"/>
      <span className="text-sm font-black text-slate-400 bg-slate-800 px-3 py-1.5 rounded-xl">cUSDC</span>
    </div>
  </div>
);

const DepositModal = ({ onClose, onSuccess }) => {
  const [amount, setAmount]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState("idle");
  const [cusdcBal, setCusdcBal] = useState("0.00");
  const [error, setError]       = useState("");

  useEffect(() => {
    (async () => {
      try {
        const signer = await getWriteSigner();
        const user   = await signer.getAddress();
        const c      = new ethers.Contract(cUSDCData.address, CUSDC_ABI, getReadProvider(421614));
        setCusdcBal(parseFloat(ethers.formatUnits(await c.balanceOf(user), 6)).toFixed(2));
      } catch {}
    })();
  }, []);

  const handle = async () => {
    if (!amount || loading) return;
    setError(""); setLoading(true);
    try {
      const signer     = await getWriteSigner();
      const user       = await signer.getAddress();
      const cusdcWrite = new ethers.Contract(cUSDCData.address, CUSDC_ABI, signer);
      const cusdcRead  = new ethers.Contract(cUSDCData.address, CUSDC_ABI, getReadProvider(421614));
      const vaultWrite = new ethers.Contract(VaultData.address, VaultData.abi, signer);
      const parsed     = ethers.parseUnits(amount, 6);
      const allowance  = await cusdcRead.allowance(user, VaultData.address);
      if (allowance < parsed) {
        setStep("approving");
        await (await cusdcWrite.approve(VaultData.address, parsed, await getGasOverrides())).wait();
      }
      setStep("depositing");
      const gas = await vaultWrite.depositToVault.estimateGas(parsed);
      await (await vaultWrite.depositToVault(parsed, { gasLimit: gas * 120n / 100n, ...await getGasOverrides() })).wait();
      setStep("done");
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err.reason || err.message || "Deposit failed"); setStep("idle");
    } finally { setLoading(false); }
  };

  const labels = { idle: null, approving: "Approving cUSDC…", depositing: "Depositing to vault…", done: "✓ Deposited!" };
  return (
    <Modal title="Deposit to Vault" subtitle="Move cUSDC into your FHE-encrypted payroll vault" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-500 font-bold">Available cUSDC</span>
          <span className="text-sm font-black text-white">{cusdcBal} cUSDC</span>
        </div>
        <AmountInput value={amount} onChange={setAmount} max={cusdcBal} label="Amount to deposit" onMax={() => setAmount(cusdcBal)}/>
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-px bg-slate-800"/>
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
            </svg>
          </div>
          <div className="flex-1 h-px bg-slate-800"/>
        </div>
        <div className="bg-indigo-950/40 border border-indigo-900/40 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400/60 mb-1">Encrypted Vault</p>
          <p className="text-2xl font-black text-white/30 tracking-[0.3em]">••••••</p>
          <p className="text-[10px] text-indigo-400/40 mt-1">FHE-encrypted · Fhenix CoFHE</p>
        </div>
        {labels[step] && <p className={`text-xs text-center font-bold ${step === "done" ? "text-emerald-400" : "text-indigo-400"}`}>{labels[step]}</p>}
        {error && <p className="text-xs text-center font-bold text-red-400">{error}</p>}
        <button onClick={handle} disabled={!amount || loading}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
            amount && !loading ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}>
          {loading ? labels[step] || "Processing…" : "Confirm Deposit"}
        </button>
      </div>
    </Modal>
  );
};

const WithdrawModal = ({ onClose, onSuccess, decryptedBal }) => {
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState("idle");
  const [error, setError]     = useState("");
  const maxBal                = decryptedBal ?? "0.00";

  const handle = async () => {
    if (!amount || loading) return;
    setError(""); setLoading(true);
    try {
      const signer     = await getWriteSigner();
      const vaultWrite = new ethers.Contract(VaultData.address, VaultData.abi, signer);
      const parsed     = ethers.parseUnits(amount, 6);
      setStep("encrypting");
      const Encryptable = getEncryptable();
      const encAmt      = await encryptValue(Encryptable.uint64(BigInt(Math.round(parseFloat(amount) * 1_000_000))));
      setStep("withdrawing");
      const gas = await vaultWrite.withdraw.estimateGas(parsed, encAmt);
      await (await vaultWrite.withdraw(parsed, encAmt, { gasLimit: gas * 120n / 100n, ...await getGasOverrides() })).wait();
      setStep("done");
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err.reason || err.message || "Withdrawal failed"); setStep("idle");
    } finally { setLoading(false); }
  };

  const labels = { idle: null, encrypting: "Encrypting amount…", withdrawing: "Withdrawing from vault…", done: "✓ Withdrawn!" };
  return (
    <Modal title="Withdraw from Vault" subtitle="Move cUSDC from your encrypted vault back to your wallet" onClose={onClose}>
      <div className="space-y-4">
        {decryptedBal ? (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-500 font-bold">Vault Balance</span>
            <span className="text-sm font-black text-white">{decryptedBal} cUSDC</span>
          </div>
        ) : (
          <div className="px-4 py-3 bg-amber-950/30 border border-amber-800/40 rounded-xl">
            <p className="text-xs text-amber-400 font-bold">Decrypt your vault balance first to see available funds.</p>
          </div>
        )}
        <AmountInput value={amount} onChange={setAmount} max={maxBal} label="Amount to withdraw"
          onMax={decryptedBal ? () => setAmount(maxBal) : null}/>
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-px bg-slate-800"/>
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
            </svg>
          </div>
          <div className="flex-1 h-px bg-slate-800"/>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60 mb-1">You will receive</p>
          <p className="text-2xl font-black text-white">{amount || "0.00"} <span className="text-emerald-400 text-lg">cUSDC</span></p>
          <p className="text-[10px] text-emerald-400/40 mt-1">Returned to your wallet as plain cUSDC</p>
        </div>
        {labels[step] && <p className={`text-xs text-center font-bold ${step === "done" ? "text-emerald-400" : "text-indigo-400"}`}>{labels[step]}</p>}
        {error && <p className="text-xs text-center font-bold text-red-400">{error}</p>}
        <button onClick={handle} disabled={!amount || loading}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
            amount && !loading ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}>
          {loading ? labels[step] || "Processing…" : "Confirm Withdrawal"}
        </button>
      </div>
    </Modal>
  );
};

const StatCard = ({ label, value, sub, icon, iconBg, accent }) => (
  <div className="bg-[#0d1117] border border-slate-800 rounded-2xl p-6 flex items-start justify-between">
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">{label}</p>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1.5 font-medium">{sub}</p>}
    </div>
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <svg className={`w-5 h-5 ${accent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={icon}/>
      </svg>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Helper — format block timestamp to readable date
// We fetch the block timestamp for each tx so we have real dates
// ---------------------------------------------------------------------------
const formatTimestamp = (ts) => {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const Dashboard = () => {
  const [showDeposit,  setShowDeposit]  = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [fheStatus,    setFheStatus]    = useState("idle");
  const [ctHash,       setCtHash]       = useState(null);
  const [decryptedBal, setDecryptedBal] = useState(null);
  const [decrypting,   setDecrypting]   = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [cusdcBalance, setCusdcBalance] = useState("—");
  const [transactions, setTransactions] = useState([]);
  const [dueSchedules, setDueSchedules] = useState([]);
  const [stats,        setStats]        = useState({ employees: 0, payments: 0, nextRun: null });
  const [loadingTxns,  setLoadingTxns]  = useState(true);

  const { chainId, onArb } = useChainGuard();

  const cpUser     = (() => { try { return JSON.parse(localStorage.getItem("cp_user") || "null"); } catch { return null; } })();
  const isEmployer = cpUser?.role === "employer";

  useEffect(() => {
    if (decryptedBal === null) return;
    const t = setTimeout(() => setDecryptedBal(null), 60_000);
    return () => clearTimeout(t);
  }, [decryptedBal]);

  const runInit = useCallback(async () => {
    if (isCofheReady()) { setFheStatus("ready"); return; }
    setFheStatus("loading");
    const r = await initializeCofhejs();
    setFheStatus(r.success ? "ready" : "error");
  }, []);

  useEffect(() => { if (window.ethereum) runInit(); }, [chainId]);

  const fetchBalances = useCallback(async () => {
    try {
      const signer = await getWriteSigner();
      const user   = await signer.getAddress();
      const rp     = getReadProvider(421614);
      const c      = new ethers.Contract(cUSDCData.address, CUSDC_ABI, rp);
      setCusdcBalance(parseFloat(ethers.formatUnits(await c.balanceOf(user), 6)).toFixed(2));
      const v = new ethers.Contract(VaultData.address, VaultData.abi, rp);
      setCtHash(await v.balanceOf(user));
    } catch { setCusdcBalance("Error"); }
  }, []);

  useEffect(() => { if (window.ethereum && onArb) fetchBalances(); }, [fetchBalances, onArb]);

  const handleDecrypt = async () => {
    if (decrypting) return;
    setDecryptError("");
    if (fheStatus !== "ready") {
      const r = await initializeCofhejs();
      if (!r.success) { setDecryptError("FHE init failed"); return; }
      setFheStatus("ready");
    }
    if (!ctHash) { setDecryptError("No vault balance — deposit first"); return; }
    const zero = "0x0000000000000000000000000000000000000000000000000000000000000000";
    if (ctHash === zero || ctHash.toString() === zero) { setDecryptedBal("0.00"); return; }
    try {
      setDecrypting(true);
      const raw = await unsealValue(ctHash);
      setDecryptedBal((Number(raw) / 1_000_000).toFixed(2));
    } catch (err) {
      if (err.message?.includes("not found")) setDecryptedBal("0.00");
      else setDecryptError(err.message || "Decryption failed");
    } finally { setDecrypting(false); }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [emps, scheds] = await Promise.all([
          api.employees.list().catch(() => []),
          api.schedules.list().catch(() => []),
        ]);
        const today    = new Date().toISOString().split("T")[0];
        const active   = scheds.filter(s => s.status === "active");
        const due      = active.filter(s => s.next_run_date <= today);
        const upcoming = active.sort((a, b) => a.next_run_date.localeCompare(b.next_run_date))[0];
        setDueSchedules(due);
        setStats(s => ({ ...s, employees: emps.filter(e => e.active).length, nextRun: upcoming?.next_run_date ?? null }));
      } catch {}
    };
    if (onArb) load();
  }, [onArb]);

  // ---------------------------------------------------------------------------
  // Load transactions — fetch block timestamps for each event
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadTxns = async () => {
      if (!onArb) { setLoadingTxns(false); return; }
      try {
        setLoadingTxns(true);
        const signer   = await getWriteSigner();
        const user     = await signer.getAddress();
        const ep       = getEventsProvider(421614);
        const rp       = getReadProvider(421614);

        const vault = new ethers.Contract(VaultData.address, VaultData.abi, ep);
        const [deps, withs] = await Promise.all([
          vault.queryFilter(vault.filters.Deposited(user), 0),
          vault.queryFilter(vault.filters.Withdrawn(user), 0),
        ]);

        // Fetch timestamps for all events in parallel
        const getTimestamp = async (blockNumber) => {
          try {
            const block = await rp.getBlock(blockNumber);
            return block?.timestamp ?? null;
          } catch { return null; }
        };

        const fmtEvents = async (evs, type, token) =>
          Promise.all(evs.map(async e => ({
            id:        e.transactionHash,
            type,
            token,
            status:    "Confirmed",
            amount:    parseFloat(ethers.formatUnits(e.args.amount, 6)).toFixed(2),
            hash:      e.transactionHash,
            block:     e.blockNumber,
            timestamp: await getTimestamp(e.blockNumber),
          })));

        let sentTxns = [], receivedTxns = [];
        try {
          const payroll = new ethers.Contract(PayrollData.address, PayrollData.abi, ep);
          if (isEmployer) {
            // ← RENAMED: "Salary Sent" → "Payment Sent"
            const sentEvents = await payroll.queryFilter(payroll.filters.SalaryPaid(user), 0);
            sentTxns = await Promise.all(sentEvents.map(async e => ({
              id:        e.transactionHash,
              type:      "Payment Sent",         // ← renamed
              token:     "cUSDC → Employee",
              status:    "Encrypted",
              amount:    "Encrypted",
              hash:      e.transactionHash,
              block:     e.blockNumber,
              timestamp: await getTimestamp(e.blockNumber),
            })));
          } else {
            const receivedEvents = await payroll.queryFilter(payroll.filters.SalaryPaid(null, user), 0);
            receivedTxns = await Promise.all(receivedEvents.map(async e => ({
              id:        e.transactionHash,
              type:      "Payment Received",
              token:     "Vault → Wallet",
              status:    "Encrypted",
              amount:    "Encrypted",
              hash:      e.transactionHash,
              block:     e.blockNumber,
              timestamp: await getTimestamp(e.blockNumber),
            })));
          }
        } catch (e) { console.warn("[txns] payroll:", e.message); }

        const [fmtDeps, fmtWiths] = await Promise.all([
          fmtEvents(deps,  "Vault Deposit",  "cUSDC → Vault"),
          fmtEvents(withs, "Vault Withdraw", "Vault → cUSDC"),
        ]);

        const all = [...fmtDeps, ...fmtWiths, ...sentTxns, ...receivedTxns]
          .sort((a, b) => (b.block ?? 0) - (a.block ?? 0))
          .slice(0, 20);

        setTransactions(all);
        setStats(s => ({ ...s, payments: all.filter(t => t.type === "Payment Sent" || t.type === "Salary Received").length }));
      } catch (err) {
        console.error("[loadTxns]", err); setTransactions([]);
      } finally { setLoadingTxns(false); }
    };
    if (window.ethereum) loadTxns();
  }, [onArb, isEmployer]);

  const fheBadge = {
    idle:    { label: "Connecting",  cls: "bg-slate-800 text-slate-400 border-slate-700" },
    loading: { label: "FHE Loading", cls: "bg-amber-950/50 text-amber-400 border-amber-800/50" },
    ready:   { label: "FHE Active",  cls: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50" },
    error:   { label: "FHE Error",   cls: "bg-red-950/50 text-red-400 border-red-800/50" },
  };
  const badge = fheBadge[fheStatus];

  const TYPE_STYLES = {
    "Vault Deposit":   { icon: "M19 14l-7 7m0 0l-7-7m7 7V3",         bg: "bg-indigo-950",  text: "text-indigo-400"  },
    "Vault Withdraw":  { icon: "M5 10l7-7m0 0l7 7m-7-7v18",           bg: "bg-emerald-950", text: "text-emerald-400" },
    "Payment Sent":    { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-violet-950", text: "text-violet-400" },
    "Salary Received": { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-teal-950",   text: "text-teal-400"   },
  };

  const STATUS_CLS = {
    Confirmed: "bg-slate-800/80 text-slate-400 border-slate-700",
    Encrypted: "bg-emerald-950/60 text-emerald-400 border-emerald-800/50",
  };

  return (
    <div className="min-h-screen bg-[#07090f] text-white">
      {showDeposit  && <DepositModal  onClose={() => setShowDeposit(false)}  onSuccess={() => { fetchBalances(); setDecryptedBal(null); }}/>}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} onSuccess={() => { fetchBalances(); setDecryptedBal(null); }} decryptedBal={decryptedBal}/>}

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-16 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-1">
              {isEmployer ? "Employer" : "Employee"}
            </p>
            <h1 className="text-2xl mt-10 font-black tracking-tight">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">
              {isEmployer ? "Manage payroll, employees and encrypted payments." : "View your vault balance and payment history."}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${badge.cls}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            {badge.label}
          </div>
        </div>

        {!onArb && (
          <div className="px-5 py-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse"/>
            <p className="text-sm text-amber-300 font-bold">Switch to Arbitrum Sepolia to use FHE features.</p>
          </div>
        )}

        {/* Hero balance card */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-[#0d1117]">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(rgba(99,102,241,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.6) 1px,transparent 1px)", backgroundSize: "28px 28px" }}/>
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none"/>
          <div className="relative z-10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Shielded Vault Balance</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">FHE-encrypted · Fhenix CoFHE</p>
                  </div>
                </div>
                {decryptedBal !== null ? (
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-5xl font-black tabular-nums text-white">{decryptedBal}</span>
                    <span className="text-2xl font-bold text-indigo-300">cUSDC</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-5xl font-black tracking-[0.3em] text-white/20 select-none">••••••</span>
                    <span className="text-2xl font-bold text-indigo-300/20">cUSDC</span>
                  </div>
                )}
                <p className="text-slate-600 text-xs mb-6">
                  {decryptedBal !== null ? "Visible · auto-hides in 60s" : ctHash ? "FHE-encrypted · click reveal to decrypt" : "Deposit cUSDC to fund your vault"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={handleDecrypt} disabled={decrypting || !ctHash || !onArb}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border ${
                      !ctHash || !onArb ? "bg-slate-800/50 border-slate-700 text-slate-600 cursor-not-allowed"
                      : decrypting     ? "bg-indigo-950 border-indigo-800/50 text-indigo-300 cursor-wait"
                      : "bg-indigo-950/60 hover:bg-indigo-950 border-indigo-800/40 text-indigo-300"}`}>
                    {decrypting
                      ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
                    {decrypting ? "Decrypting…" : decryptedBal !== null ? "Refresh" : "Reveal Balance"}
                  </button>
                  <button onClick={() => setShowDeposit(true)} disabled={!onArb}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${onArb ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-slate-800 text-slate-600 cursor-not-allowed"}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                    Deposit
                  </button>
                  <button onClick={() => setShowWithdraw(true)} disabled={!onArb}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border ${onArb ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200" : "bg-slate-800 border-slate-800 text-slate-600 cursor-not-allowed"}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                    Withdraw
                  </button>
                  {decryptError && <p className="text-xs text-red-400 font-bold">{decryptError}</p>}
                </div>
              </div>
              <div className="lg:w-64 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex-shrink-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Wallet cUSDC</p>
                <p className="text-xs text-slate-600 mb-4">Plaintext · unwrapped USDC</p>
                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-3xl font-black tabular-nums text-white">{cusdcBalance}</span>
                  <span className="text-base font-bold text-slate-400">cUSDC</span>
                </div>
                <Link to="/wrap" className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-black text-slate-300 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                  Wrap / Unwrap
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Active Employees" value={stats.employees} sub="Total on payroll"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            iconBg="bg-indigo-950/60 border border-indigo-900/40" accent="text-indigo-400"/>
          <StatCard label="Payments Processed" value={stats.payments} sub="Encrypted transfers"
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            iconBg="bg-emerald-950/60 border border-emerald-900/40" accent="text-emerald-400"/>
          <StatCard label="Next Payroll Run" value={stats.nextRun ?? "—"} sub={stats.nextRun ? "Scheduled" : "No active schedules"}
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            iconBg="bg-amber-950/60 border border-amber-900/40" accent="text-amber-400"/>
        </div>

        {/* Quick actions */}
        {isEmployer && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { to: "/employees", label: "Add Employee",      icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", cls: "hover:border-indigo-500/40 hover:bg-indigo-950/20" },
              { to: "/payments",  label: "Run Payroll",       icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", cls: "hover:border-emerald-500/40 hover:bg-emerald-950/20" },
              { to: "/payments",  label: "Schedule Payment",  icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", cls: "hover:border-amber-500/40 hover:bg-amber-950/20" },
            ].map(a => (
              <Link key={a.label} to={a.to} className={`flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#0d1117] border border-slate-800 transition-all group ${a.cls}`}>
                <svg className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={a.icon}/>
                </svg>
                <span className="text-sm font-black text-slate-400 group-hover:text-white transition-colors">{a.label}</span>
                <svg className="w-4 h-4 text-slate-700 group-hover:text-slate-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Due schedules */}
        {dueSchedules.length > 0 && (
          <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"/>
                <p className="text-sm font-black text-indigo-300">
                  {dueSchedules.length} scheduled payment{dueSchedules.length > 1 ? "s" : ""} due
                </p>
              </div>
              <Link to="/payments" className="text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors">View all →</Link>
            </div>
            <div className="space-y-2">
              {dueSchedules.map(s => (
                <div key={s._id ?? s.id} className="flex items-center justify-between px-4 py-3 bg-indigo-950/40 rounded-xl border border-indigo-900/30">
                  <div>
                    <p className="text-sm font-bold text-white">{s.name}</p>
                    <p className="text-[10px] text-indigo-400/60 mt-0.5">{s.employees?.length ?? 0} employees · due {s.next_run_date}</p>
                  </div>
                  <Link to="/payments" className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all">Run Now</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Transaction history ── */}
        <div className="bg-[#0d1117] border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-7 py-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-black text-base tracking-tight">
                {isEmployer ? "Payment History" : "Transaction History"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEmployer ? "Vault deposits, withdrawals and salary payments" : "Your vault activity and received payments"}
              </p>
            </div>
            <a href={`${ARBISCAN}/address/${VaultData.address}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
              Arbiscan
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          </div>

          {loadingTxns ? (
            <div className="px-7 py-10 space-y-5">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/60"/>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800/60 rounded w-28"/>
                    <div className="h-2 bg-slate-800/40 rounded w-20"/>
                  </div>
                  <div className="h-3 bg-slate-800/60 rounded w-24 hidden md:block"/>
                  <div className="h-3 bg-slate-800/60 rounded w-16"/>
                  <div className="h-6 bg-slate-800/60 rounded-lg w-20"/>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-7 py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-500">{onArb ? "No activity yet" : "Switch to Arbitrum Sepolia"}</p>
              <p className="text-xs text-slate-600 mt-1">
                {onArb ? (isEmployer ? "Deposit cUSDC to get started" : "You haven't received any payments yet") : ""}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/60">
                    <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Type</th>
                    <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Amount</th>
                    {/* ← NEW: Timestamp column */}
                    <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hidden md:table-cell">Date</th>
                    <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hidden md:table-cell">Tx Hash</th>
                    <th className="px-7 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {transactions.map(tx => {
                    const s = TYPE_STYLES[tx.type] ?? TYPE_STYLES["Vault Deposit"];
                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-7 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                              <svg className={`w-4 h-4 ${s.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={s.icon}/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{tx.type}</p>
                              <p className="text-[10px] text-slate-600">{tx.token}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-7 py-4">
                          <p className="text-sm font-black text-white tabular-nums">{tx.amount}</p>
                        </td>
                        {/* ← NEW: Timestamp cell */}
                        <td className="px-7 py-4 hidden md:table-cell">
                          <p className="text-xs text-slate-400">{formatTimestamp(tx.timestamp)}</p>
                        </td>
                        <td className="px-7 py-4 hidden md:table-cell">
                          <a href={`${ARBISCAN}/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                            className="text-[11px] text-slate-600 hover:text-indigo-400 font-mono transition-colors">
                            {tx.hash.slice(0,8)}…{tx.hash.slice(-6)}
                          </a>
                        </td>
                        <td className="px-7 py-4 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${STATUS_CLS[tx.status] ?? STATUS_CLS.Confirmed}`}>
                            {tx.status === "Encrypted" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>}
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;