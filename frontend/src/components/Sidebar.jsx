import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";
import { useTheme } from "./ThemeContext";
import { useNetworkSwitch } from "../hooks/useNetworkSwitch";
import { clearAuth } from "../utils/api";

const NAV_LINKS = [
  { path: "/dashboard", label: "Dashboard",     icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { path: "/wrap",      label: "Privacy Bridge", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  { path: "/payments",  label: "Payments",       icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { path: "/employees", label: "Employees",      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
];

const ROLE_META = {
  employer: { label: "Employer", dot: "bg-indigo-400", text: "text-indigo-300", bg: "bg-indigo-600/10 border-indigo-500/20", hover: "hover:bg-indigo-600/20" },
  employee: { label: "Employee", dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-600/10 border-emerald-500/20", hover: "hover:bg-emerald-600/20" },
};

const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("cp_user") || "null"); } catch { return null; }
};

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { isDark, toggleTheme } = useTheme();
  const { switchTo, switching } = useNetworkSwitch();
  const [showWalletMenu, setWalletMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cpUser, setCpUser] = useState(getStoredUser);
  
  // Swipe Handlers
  const touchStart = useRef(null);
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart.current - touchEnd;
    if (diff > 50) setMobileOpen(false); // Swipe left to close
    if (diff < -50) setMobileOpen(true); // Swipe right to open
    touchStart.current = null;
  };

  const isActive = (path) => location.pathname === path;
  const shortenAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
  const onArb = chainId === 421614;
  const roleMeta = cpUser ? ROLE_META[cpUser.role] : null;

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const sync = () => setCpUser(getStoredUser());
    window.addEventListener("cp:auth", sync);
    return () => window.removeEventListener("cp:auth", sync);
  }, []);

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("cp_token");
    localStorage.removeItem("cp_address");
    localStorage.removeItem("cp_user");
    disconnect();
    setMobileOpen(false);
    navigate("/");
  };

  const NavContent = ({ isMobile = false }) => {
    // On mobile, if drawer is closed, we hide labels to keep it "mini"
    const hideLabels = isMobile && !mobileOpen;

    return (
      <>
        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto overflow-x-hidden">
          {NAV_LINKS.map(link => {
            const active = isActive(link.path);
            return (
              <Link key={link.path} to={link.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group
                  ${hideLabels ? "justify-center" : ""}
                  ${active
                    ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
                  }`}>
                <svg className={`flex-shrink-0 w-6 h-6 transition-colors ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-white"}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={link.icon}/>
                </svg>
                {!hideLabels && <span className="text-sm font-bold truncate">{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`px-2 pb-4 space-y-2 border-t border-slate-800/60 pt-3 ${hideLabels ? "items-center" : ""}`}>
          <button onClick={toggleTheme}
            className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-slate-400 hover:text-white transition-all
              ${hideLabels ? "justify-center" : ""}`}>
            {isDark ? (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
            )}
            {!hideLabels && <span className="text-sm font-bold">Theme</span>}
          </button>
          
          {/* Simple logout for mini-view */}
          {hideLabels && (
            <button onClick={handleLogout} className="flex justify-center w-full px-3 py-3 text-red-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className={`hidden lg:flex fixed top-0 left-0 h-full z-40 flex-col transition-all duration-300
        bg-[#080b14] border-r border-slate-800/60
        ${collapsed ? "w-[72px]" : "w-64"}`}>
        <div className={`flex items-center h-16 px-4 border-b border-slate-800/60 flex-shrink-0 ${collapsed ? "justify-center" : "justify-between"}`}>
           <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>
              </div>
              {!collapsed && <span className="text-base font-black text-white">SecurePay</span>}
           </Link>
        </div>
        <NavContent />
      </aside>

      {/* ── Mobile Sidebar (Always Visible Rail) ──────────────────────────────── */}
      <div className="lg:hidden">
        {/* Backdrop */}
        <div className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={() => setMobileOpen(false)} />

        {/* The Sidebar (Rail when closed, Drawer when open) */}
        <aside 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-[#080b14] border-r border-slate-800/60 shadow-2xl transition-all duration-300 ease-out
          ${mobileOpen ? "w-72" : "w-16"}`} // Rail is 16 (64px) wide
        >
          {/* Header / Open Button */}
          <div className="flex items-center h-16 border-b border-slate-800/60 px-4">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
               <svg className={`w-4 h-4 text-white transition-transform duration-300 ${mobileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
               </svg>
            </button>
            {mobileOpen && <span className="ml-3 text-sm font-black text-white">SecurePay</span>}
          </div>

          <NavContent isMobile={true} />
        </aside>
      </div>
      
      {/* Adjust Main Content Margin for Rail */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1023px) {
          main, .mobile-content-container { margin-left: 64px; }
        }
      `}} />
    </>
  );
};

export default Sidebar;