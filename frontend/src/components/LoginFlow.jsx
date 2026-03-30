import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Config — replace with your actual API base URL
// ---------------------------------------------------------------------------
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const api = {
  async checkUser(address) {
    const r = await fetch(`${API_BASE}/api/auth/check/${address}`);
    return r.json(); // { exists: bool, user: {...} | null }
  },
  async register(payload) {
    const r = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Registration failed");
    return r.json(); // { user: {...}, token: "..." }
  },
  async login(address, signature, message) {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature, message }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Login failed");
    return r.json(); // { user: {...}, token: "..." }
  },
};

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
const short = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

const SIGN_MESSAGE = (nonce) =>
  `Welcome to ConfidentialPayroll\n\nSign this message to verify your wallet.\n\nNonce: ${nonce}\nThis request does not trigger a blockchain transaction.`;

// ---------------------------------------------------------------------------
// Particle canvas background
// ---------------------------------------------------------------------------
const ParticleField = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.alpha})`;
        ctx.fill();
      });
      // Draw faint connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
const Steps = ({ current, steps }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {steps.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500 ${
              done    ? "bg-indigo-500 border-indigo-500 text-white" :
              active  ? "bg-transparent border-indigo-400 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.5)]" :
                        "bg-transparent border-slate-700 text-slate-600"
            }`}>
              {done
                ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                : i + 1}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
              active ? "text-indigo-400" : done ? "text-slate-400" : "text-slate-700"
            }`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 h-px mb-4 transition-all duration-500 ${done ? "bg-indigo-500" : "bg-slate-800"}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// STEP 0 — Connect wallet
// ---------------------------------------------------------------------------
const StepConnect = ({ onConnected, error, loading }) => (
  <div className="flex flex-col items-center text-center">
    {/* Logo mark */}
    <div className="relative mb-8">
      <div className="w-20 h-20 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.15)]">
        <svg className="w-9 h-9 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#07090f] flex items-center justify-center">
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
      </div>
    </div>

    <h1 className="text-2xl font-black tracking-tight text-white mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>
      ConfidentialPayroll
    </h1>
    <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-8">
      FHE-encrypted payroll on Arbitrum Sepolia.<br/>Connect your wallet to get started.
    </p>

    {/* MetaMask button */}
    <button onClick={onConnected} disabled={loading}
      className={`group relative w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 overflow-hidden ${
        loading ? "bg-slate-800 text-slate-600 cursor-wait" : "bg-indigo-600 hover:bg-indigo-500 text-white"
      }`}>
      <span className="absolute inset-0 bg-gradient-to-r from-indigo-600/0 via-white/5 to-indigo-600/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"/>
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Connecting…
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 7.5V6a3 3 0 00-3-3H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21H18a3 3 0 003-3v-1.5"/>
            <path d="M15 9.75h6v4.5h-6a2.25 2.25 0 010-4.5z"/>
          </svg>
          Connect Wallet & Login
        </span>
      )}
    </button>

    {error && (
      <p className="mt-4 text-xs text-red-400 font-bold bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 w-full text-center">
        {error}
      </p>
    )}

    <p className="mt-6 text-[10px] text-slate-700 font-bold">
      Supports MetaMask · WalletConnect · Coinbase Wallet
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// STEP 1 — Sign message to verify wallet
// ---------------------------------------------------------------------------
const StepSign = ({ address, onSigned, error, loading }) => (
  <div className="flex flex-col items-center text-center">
    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
      <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
      </svg>
    </div>

    <h2 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Verify Ownership</h2>
    <p className="text-slate-500 text-sm mb-6">Sign a message to prove you own this wallet. No gas required.</p>

    {/* Wallet address badge */}
    <div className="w-full mb-6 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-indigo-400"/>
      </div>
      <div className="flex-1 text-left">
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Connected Wallet</p>
        <p className="text-sm font-mono text-white">{address}</p>
      </div>
    </div>

    {/* Message preview */}
    <div className="w-full mb-6 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800/50 text-left">
      <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-2">You will sign</p>
      <p className="text-xs text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">
        {`Welcome to ConfidentialPayroll\n\nSign to verify your wallet.\nNo blockchain transaction.`}
      </p>
    </div>

    <button onClick={onSigned} disabled={loading}
      className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
        loading ? "bg-slate-800 text-slate-600 cursor-wait" : "bg-amber-500 hover:bg-amber-400 text-black"
      }`}>
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Waiting for signature…
        </span>
      ) : "Sign Message"}
    </button>

    {error && <p className="mt-4 text-xs text-red-400 font-bold">{error}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// STEP 2 — Profile setup (name + email)
// ---------------------------------------------------------------------------
const StepProfile = ({ address, onNext, loading, error }) => {
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [localErr, setLocalErr] = useState("");

  const submit = () => {
    if (!name.trim())  { setLocalErr("Full name is required"); return; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { setLocalErr("Valid email required"); return; }
    setLocalErr("");
    onNext({ name: name.trim(), email: email.trim() });
  };

  return (
    <div className="flex flex-col">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-6 mx-auto shadow-[0_0_30px_rgba(99,102,241,0.1)]">
        <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
      </div>

      <h2 className="text-xl font-black text-white mb-1 text-center" style={{ fontFamily: "'Syne', sans-serif" }}>Your Profile</h2>
      <p className="text-slate-500 text-sm mb-6 text-center">Tell us who you are. This links your identity to your wallet.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Full Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Ada Okafor"
            onKeyDown={e => e.key === "Enter" && submit()}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-medium"/>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Email Address</label>
          <input value={email} onChange={e => setEmail(e.target.value)}
            type="email" placeholder="ada@company.io"
            onKeyDown={e => e.key === "Enter" && submit()}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-medium"/>
        </div>
      </div>

      {/* Wallet already linked */}
      <div className="mt-4 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"/>
        <div>
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Wallet</p>
          <p className="text-xs font-mono text-slate-400">{short(address)}</p>
        </div>
      </div>

      {(localErr || error) && (
        <p className="mt-3 text-xs text-red-400 font-bold">{localErr || error}</p>
      )}

      <button onClick={submit} disabled={loading}
        className={`mt-6 w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
          loading ? "bg-slate-800 text-slate-600 cursor-wait" : "bg-indigo-600 hover:bg-indigo-500 text-white"
        }`}>
        {loading ? "Saving…" : "Continue →"}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// STEP 3 — Role selection
// ---------------------------------------------------------------------------
const StepRole = ({ onSelect, loading, error }) => {
  const [role, setRole] = useState(null);

  const roles = [
    {
      id: "employer",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      ),
      label: "Employer",
      desc: "Manage payroll, add employees, run salary payments from your vault.",
      color: "indigo",
      highlight: "bg-indigo-600/10 border-indigo-500/30 text-indigo-400",
      ring: "ring-indigo-500",
    },
    {
      id: "employee",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
      ),
      label: "Employee",
      desc: "View your encrypted salary and withdraw payments to your wallet.",
      color: "emerald",
      highlight: "bg-emerald-600/10 border-emerald-500/30 text-emerald-400",
      ring: "ring-emerald-500",
    },
  ];

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-black text-white mb-1 text-center" style={{ fontFamily: "'Syne', sans-serif" }}>Your Role</h2>
      <p className="text-slate-500 text-sm mb-6 text-center">How will you use ConfidentialPayroll?</p>

      <div className="space-y-3">
        {roles.map((r) => (
          <button key={r.id} onClick={() => setRole(r.id)}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
              role === r.id
                ? `${r.highlight} ring-2 ${r.ring} ring-offset-2 ring-offset-[#07090f]`
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
            }`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
              role === r.id ? r.highlight : "bg-slate-800 text-slate-500"
            }`}>
              {r.icon}
            </div>
            <div className="flex-1">
              <p className="font-black text-white text-sm mb-0.5">{r.label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              role === r.id
                ? r.id === "employer" ? "border-indigo-400 bg-indigo-500" : "border-emerald-400 bg-emerald-500"
                : "border-slate-600"
            }`}>
              {role === r.id && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-xs text-red-400 font-bold">{error}</p>}

      <button onClick={() => role && onSelect(role)} disabled={!role || loading}
        className={`mt-6 w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
          role && !loading
            ? "bg-indigo-600 hover:bg-indigo-500 text-white"
            : "bg-slate-800 text-slate-600 cursor-not-allowed"
        }`}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Creating account…
          </span>
        ) : "Complete Setup →"}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// STEP 4 — All done
// ---------------------------------------------------------------------------
const StepDone = ({ user, onEnter }) => {
  useEffect(() => {
    const t = setTimeout(onEnter, 2500);
    return () => clearTimeout(t);
  }, [onEnter]);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated success ring */}
      <div className="relative mb-8">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="#1e1b4b" strokeWidth="4"/>
          <circle cx="48" cy="48" r="40" fill="none" stroke="#6366f1" strokeWidth="4"
            strokeDasharray="251" strokeDashoffset="0"
            style={{ transition: "stroke-dashoffset 1.5s ease", strokeLinecap: "round" }}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)]">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>
        Welcome, {user?.name?.split(" ")[0]}!
      </h2>
      <p className="text-slate-500 text-sm mb-2">Your account is ready.</p>
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-950/50 border border-indigo-900/40 mb-6">
        <div className={`w-2 h-2 rounded-full ${user?.role === "employer" ? "bg-indigo-400" : "bg-emerald-400"}`}/>
        <span className={`text-xs font-black uppercase tracking-widest ${user?.role === "employer" ? "text-indigo-400" : "text-emerald-400"}`}>
          {user?.role}
        </span>
      </div>
      <p className="text-xs text-slate-600 animate-pulse">Redirecting to dashboard…</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main LoginFlow component
// ---------------------------------------------------------------------------
const STEPS = ["Connect", "Verify", "Profile", "Role"];

const LoginFlow = ({ onAuthenticated }) => {
  const [step,      setStep]      = useState(0);
  const [address,   setAddress]   = useState(null);
  const [signature, setSignature] = useState(null);
  const [nonce,     setNonce]     = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [user,      setUser]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const clearErr = () => setError("");

  // ------------------------------------------------------------------
  // Step 0: Connect wallet & check existing user
  // ------------------------------------------------------------------
  const handleConnect = async () => {
    clearErr();
    setLoading(true);
    try {
      if (!window.ethereum) throw new Error("MetaMask not found. Please install it.");

      const provider  = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer    = await provider.getSigner();
      const addr      = await signer.getAddress();
      setAddress(addr);

      // Check if user already exists
      const { exists, user: existingUser } = await api.checkUser(addr);

      if (exists) {
        // Existing user — just sign to prove ownership, then log in
        const n = crypto.randomUUID();
        setNonce(n);
        setUser(existingUser);
        setStep(1); // go to sign step, but will skip profile/role after
      } else {
        // New user — full onboarding
        const n = crypto.randomUUID();
        setNonce(n);
        setStep(1);
      }
    } catch (err) {
      setError(err.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Step 1: Sign message
  // ------------------------------------------------------------------
  const handleSign = async () => {
    clearErr();
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const message  = SIGN_MESSAGE(nonce);
      const sig      = await signer.signMessage(message);
      setSignature(sig);

      // If existing user — login directly
      if (user) {
        const result = await api.login(address, sig, message);
        localStorage.setItem("cp_token",   result.token);
        localStorage.setItem("cp_address", address);
        localStorage.setItem("cp_user",    JSON.stringify(result.user));
        setUser(result.user);
        setStep(4); // done
      } else {
        setStep(2); // new user → profile
      }
    } catch (err) {
      if (err.code === 4001) setError("Signature rejected. Please sign to continue.");
      else setError(err.message || "Signing failed");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Step 2: Profile
  // ------------------------------------------------------------------
  const handleProfile = async (profileData) => {
    clearErr();
    setLoading(true);
    try {
      setProfile(profileData);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Step 3: Role → register
  // ------------------------------------------------------------------
  const handleRole = async (role) => {
    clearErr();
    setLoading(true);
    try {
      const result = await api.register({
        address,
        signature,
        nonce,
        name:  profile.name,
        email: profile.email,
        role,
      });
      localStorage.setItem("cp_token",   result.token);
      localStorage.setItem("cp_address", address);
      localStorage.setItem("cp_user",    JSON.stringify(result.user));
      setUser(result.user);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Step 4: Enter dashboard
  // ------------------------------------------------------------------
  const handleEnter = () => {
    onAuthenticated?.(user);
  };

  // Display steps only for new users (skip profile/role for existing)
  const isNewUser = !user || step >= 2;
  const visibleSteps = isNewUser ? STEPS : ["Connect", "Verify"];

  return (
    <>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div className="min-h-screen bg-[#07090f] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background */}
        <ParticleField />

        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl pointer-events-none"/>

        {/* Grid texture */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px" }}/>

        {/* Card */}
        <div className="relative w-full max-w-md z-10">
          {/* Glass card */}
          <div className="bg-[#0b0f1a]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl"
            style={{ boxShadow: "0 0 0 1px rgba(99,102,241,0.05), 0 25px 50px rgba(0,0,0,0.6)" }}>

            {/* Top brand bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">ConfidentialPayroll</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-900/40">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Arbitrum Sepolia</span>
              </div>
            </div>

            {/* Step indicator (hidden on step 0 and 4) */}
            {step > 0 && step < 4 && (
              <Steps current={step - 1} steps={isNewUser ? ["Verify", "Profile", "Role"] : ["Verify"]} />
            )}

            {/* Step content with slide transition */}
            <div className="transition-all duration-300">
              {step === 0 && <StepConnect  onConnected={handleConnect} error={error} loading={loading}/>}
              {step === 1 && <StepSign     address={address} onSigned={handleSign} error={error} loading={loading}/>}
              {step === 2 && <StepProfile  address={address} onNext={handleProfile} loading={loading} error={error}/>}
              {step === 3 && <StepRole     onSelect={handleRole} loading={loading} error={error}/>}
              {step === 4 && <StepDone     user={user} onEnter={handleEnter}/>}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-700 font-bold mt-4 uppercase tracking-widest">
            Powered by Fhenix FHE · Arbitrum
          </p>
        </div>
      </div>
    </>
  );
};

export default LoginFlow;