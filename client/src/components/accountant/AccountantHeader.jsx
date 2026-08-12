import React from "react";

const AccountantHeader = ({ userId, onLogoutClick }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm gap-4 transition-all duration-300 hover:shadow-md">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          ACCOUNTANT PANEL
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-heading)] tracking-tight">
          Invoice Billing & Verification
        </h1>
        <p className="text-[var(--color-body)] text-xs">
          Signed in as <strong className="text-[var(--color-primary)]">{userId}</strong>
        </p>
      </div>

      <button
        onClick={onLogoutClick}
        className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95"
      >
        Logout
      </button>
    </div>
  );
};

export default AccountantHeader;