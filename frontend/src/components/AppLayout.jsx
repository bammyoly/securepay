
import React from "react";
import Sidebar from "./Sidebar";

const AppLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#07090f]">
      <Sidebar />
      {/* Main content — offset by sidebar width */}
      <main className="flex-1 lg:ml-64 min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;