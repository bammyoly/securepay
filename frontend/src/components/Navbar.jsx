import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";
import { sepolia, arbitrumSepolia } from "wagmi/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useTheme } from "./ThemeContext";
import { useNetworkSwitch } from "../hooks/useNetworkSwitch";

const PRIMARY_CHAIN = arbitrumSepolia;

const CHAIN_META = {
  [arbitrumSepolia.id]: {
    label: "Arbitrum Sepolia",
    short: "Arb Sepolia",
    color: "text-emerald-400",
    dot:   "bg-emerald-400",
    fhe:   true,
  },
  [sepolia.id]: {
    label: "Ethereum Sepolia",
    short: "Eth Sepolia",
    color: "text-amber-400",
    dot:   "bg-amber-400",
    fhe:   false,
  },
};

const getStoredUser  = () => {
  try { return JSON.parse(localStorage.getItem("cp_user") || "null"); }
  catch { return null; }
};
const getStoredToken = () => localStorage.getItem("cp_token") || null;
const clearSession   = () => {
  localStorage.removeItem("cp_token");
  localStorage.removeItem("cp_address");
  localStorage.removeItem("cp_user");
};

const ROLE_META = {
  employer: { label: "Employer", bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  employee: { label: "Employee", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

// Always-visible nav links — shown to all users regardless of auth state
const NAV_LINKS = [
  { path: "#solutions", label: "Solutions" },
  { path: "#faqs",      label: "FAQs"      },
  { path: "#support",   label: "Support"   },
];

const Navbar = ({ onLogout }) => {
  const { isDark, toggleTheme }              = useTheme();
  const [showWalletMenu, setShowWalletMenu]  = useState(false);
  const [showMobileMenu, setShowMobileMenu]  = useState(false);
  const [cpUser,         setCpUser]          = useState(getStoredUser);
  const [copied,         setCopied]          = useState(false);

  const { isConnected, address, chainId }    = useAccount();
  const { openConnectModal }                 = useConnectModal();
  const { disconnect }                       = useDisconnect();
  const { switchTo, switching, switchError } = useNetworkSwitch();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setCpUser(getStoredUser());
    window.addEventListener("cp:auth", sync);
    return () => window.removeEventListener("cp:auth", sync);
  }, []);

  useEffect(() => { setCpUser(getStoredUser()); }, [location.pathname]);

  const isActive    = (path) => location.pathname === path;
  const shortenAddr = (a)    => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

  const currentChain = CHAIN_META[chainId] ?? null;
  const isWrongChain = isConnected && chainId !== PRIMARY_CHAIN.id;
  const isFheChain   = chainId === PRIMARY_CHAIN.id;
  const isLoggedIn   = !!cpUser && !!getStoredToken();
  const roleMeta     = cpUser ? ROLE_META[cpUser.role] : null;

  const handleSwitch = async (targetChainId) => {
    if (switching || chainId === targetChainId) return;
    const ok = await switchTo(targetChainId);
    if (ok) { setShowWalletMenu(false); setShowMobileMenu(false); }
  };

  const handleLoginClick = () => {
    if (!isConnected) openConnectModal?.();
    else navigate("/login");
  };

  const handleLogout = () => {
    clearSession();
    setCpUser(null);
    disconnect();
    setShowWalletMenu(false);
    setShowMobileMenu(false);
    onLogout?.();
    navigate("/");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setShowWalletMenu(false);
  };

  const NetworkButton = ({ chain, meta }) => {
    const active = chainId === chain.id;
    return (
      <button onClick={() => handleSwitch(chain.id)} disabled={switching || active}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
          active
            ? meta.fhe
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 cursor-default"
              : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-default"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        }`}>
        <div className="flex items-center gap-2">
          {switching && !active ? (
            <svg className="w-3 h-3 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
          )}
          <span>{meta.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
            meta.fhe
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
          }`}>
            {meta.fhe ? "FHE" : "No FHE"}
          </span>
          {active && (
            <svg className="w-3.5 h-3.5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
            </svg>
          )}
        </div>
      </button>
    );
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-[100] transition-all duration-300
      bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b
      border-slate-200 dark:border-slate-800">

      {/* Wrong-chain banner */}
      {isWrongChain && (
        <div className="bg-amber-500 text-white py-2 px-4 flex items-center justify-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest">
            FHE features require Arbitrum Sepolia
          </span>
          <button onClick={() => handleSwitch(PRIMARY_CHAIN.id)} disabled={switching}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30
              border border-white/30 text-[10px] font-black uppercase tracking-wider transition-all
              disabled:opacity-60 disabled:cursor-wait">
            {switching ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Switching…
              </>
            ) : "Switch Now"}
          </button>
          {switchError && <span className="text-[10px] font-bold text-white/80">{switchError}</span>}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600
            flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white">
            Secure<span className="text-indigo-600 dark:text-indigo-400">Pay</span>
          </span>
        </Link>

        {/* Desktop nav — always visible */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a key={link.path} href={link.path}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all
                text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white
                hover:bg-slate-100 dark:hover:bg-slate-800">
              {link.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800
              bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400
              hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all shadow-sm">
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
            )}
          </button>

          <div className="relative">

            {/* Logged in pill */}
            {isLoggedIn && isConnected ? (
              <button onClick={() => setShowWalletMenu(!showWalletMenu)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                  isFheChain
                    ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 hover:bg-indigo-100 dark:hover:bg-indigo-500/10"
                    : "border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-100 dark:hover:bg-amber-500/10"
                }`}>
                <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-black text-white">
                    {cpUser?.name?.charAt(0).toUpperCase() ?? "?"}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 hidden sm:inline max-w-[80px] truncate">
                  {cpUser?.name?.split(" ")[0]}
                </span>
                {roleMeta && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border hidden lg:inline
                    ${roleMeta.bg} ${roleMeta.text} ${roleMeta.border}`}>
                    {roleMeta.label}
                  </span>
                )}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isFheChain ? "bg-emerald-400" : "bg-amber-400"}`} />
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showWalletMenu ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="2.5" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

            ) : isConnected && !isLoggedIn ? (
              <button onClick={handleLoginClick}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500
                  text-white text-sm font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                Login
              </button>

            ) : (
              <button onClick={handleLoginClick}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500
                  text-white text-sm font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                Login
              </button>
            )}

            {/* Logged-in dropdown */}
            {showWalletMenu && isLoggedIn && (
              <>
                <div className="fixed inset-0 z-[10]" onClick={() => setShowWalletMenu(false)} />
                <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-slate-200 dark:border-slate-800
                  bg-white dark:bg-slate-900 shadow-2xl shadow-black/10 dark:shadow-black/50 p-2 z-[20]">

                  <div className="px-3 py-3 mb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600
                        flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                        <span className="text-sm font-black text-white">
                          {cpUser?.name?.charAt(0).toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-white truncate">{cpUser?.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{cpUser?.email}</p>
                      </div>
                      {roleMeta && (
                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg border flex-shrink-0
                          ${roleMeta.bg} ${roleMeta.text} ${roleMeta.border}`}>
                          {roleMeta.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-3 py-2 mx-1 mb-1 rounded-xl bg-slate-50 dark:bg-slate-800/60
                    border border-slate-200 dark:border-slate-700/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Wallet</p>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{address}</p>
                  </div>

                  <div className="px-1 py-1 border-t border-slate-100 dark:border-slate-800 my-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1.5">Network</p>
                    <div className="space-y-0.5">
                      <NetworkButton chain={arbitrumSepolia} meta={CHAIN_META[arbitrumSepolia.id]} />
                      <NetworkButton chain={sepolia}         meta={CHAIN_META[sepolia.id]} />
                    </div>
                    {switchError && (
                      <p className="text-[10px] text-red-400 font-bold px-3 pt-2">{switchError}</p>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <button onClick={handleCopy}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold
                        text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {copied ? (
                        <>
                          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                          </svg>
                          <span className="text-emerald-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                          </svg>
                          Copy Address
                        </>
                      )}
                    </button>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold
                        text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                      </svg>
                      Log Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 text-slate-600 dark:text-slate-400"
            onClick={() => setShowMobileMenu(!showMobileMenu)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2.5"
                d={showMobileMenu ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"}/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800
          bg-white dark:bg-slate-950 px-4 py-4 space-y-1">

          {/* Always-visible links */}
          {NAV_LINKS.map((link) => (
            <a key={link.path} href={link.path}
              onClick={() => setShowMobileMenu(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-bold transition-all
                text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              {link.label}
            </a>
          ))}

          {/* User identity */}
          {isLoggedIn && cpUser && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 px-4 py-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600
                  flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-white">{cpUser.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{cpUser.name}</p>
                  <p className="text-[10px] text-slate-500">{cpUser.email}</p>
                </div>
                {roleMeta && (
                  <span className={`ml-auto text-[9px] font-black px-2 py-1 rounded-lg border
                    ${roleMeta.bg} ${roleMeta.text} ${roleMeta.border}`}>
                    {roleMeta.label}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Network switcher */}
          {isConnected && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 pb-1">Network</p>
              <NetworkButton chain={arbitrumSepolia} meta={CHAIN_META[arbitrumSepolia.id]} />
              <NetworkButton chain={sepolia}         meta={CHAIN_META[sepolia.id]} />
              {switchError && <p className="text-[10px] text-red-400 font-bold px-3 pt-1">{switchError}</p>}
            </div>
          )}

          {/* Logout */}
          {isLoggedIn && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold
                  text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Log Out
              </button>
            </div>
          )}

          {/* Login */}
          {!isLoggedIn && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => { handleLoginClick(); setShowMobileMenu(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                  bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                Login
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;