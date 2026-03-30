import React from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Home      from '../pages/Home'
import WrapUsdc  from '../pages/WrapUsdc'
import Dashboard from '../pages/Dashboard'
import Payments  from '../pages/Payments'
import Employees from '../pages/Employees'
import LoginFlow from '../components/LoginFlow'
import Navbar    from '../components/Navbar'
import AppLayout from '../components/AppLayout'

// ---------------------------------------------------------------------------
// Route wrappers
// ---------------------------------------------------------------------------

// Public pages — Navbar at top, no sidebar
const PublicPage = ({ children }) => (
  <>
    <Navbar />
    <div className="pt-16">{children}</div>
  </>
);

// Authenticated pages — Sidebar layout, no Navbar
const AuthPage = ({ children }) => (
  <AppLayout>{children}</AppLayout>
);

// ---------------------------------------------------------------------------
// RouterConfig
// ---------------------------------------------------------------------------
const RouterConfig = () => {
  const navigate = useNavigate();

  return (
    <Routes>
      {/* Public */}
      <Route path="/"      element={<PublicPage><Home /></PublicPage>} />
      <Route path="/login" element={
        <PublicPage>
          <LoginFlow
            onAuthenticated={() => {
              window.dispatchEvent(new Event("cp:auth"));
              navigate("/dashboard");
            }}
          />
        </PublicPage>
      } />

      {/* Authenticated — sidebar layout */}
      <Route path="/dashboard" element={<AuthPage><Dashboard /></AuthPage>} />
      <Route path="/wrap"      element={<AuthPage><WrapUsdc /></AuthPage>} />
      <Route path="/payments"  element={<AuthPage><Payments /></AuthPage>} />
      <Route path="/employees" element={<AuthPage><Employees /></AuthPage>} />
    </Routes>
  );
};

export default RouterConfig;