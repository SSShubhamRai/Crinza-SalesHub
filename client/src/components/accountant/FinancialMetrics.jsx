import React from "react";

const FinancialMetrics = ({ totalPendingValue, aiFlaggedCount, totalApprovedCount }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div>
          <span className="text-[11px] text-[var(--color-body)] font-medium block">Total Pending Value</span>
          <h3 className="text-lg font-extrabold text-[var(--color-heading)] mt-0.5">
            ₹{totalPendingValue.toLocaleString("en-IN")}
          </h3>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">
          ⏳
        </div>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div>
          <span className="text-[11px] text-[var(--color-body)] font-medium block">AI Flagged / Warning</span>
          <h3 className="text-lg font-extrabold text-red-500 mt-0.5">{aiFlaggedCount} Invoices</h3>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">
          ⚠️
        </div>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div>
          <span className="text-[11px] text-[var(--color-body)] font-medium block">Total Approved Count</span>
          <h3 className="text-lg font-extrabold text-emerald-600 mt-0.5">{totalApprovedCount} Approved</h3>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">
          ✅
        </div>
      </div>
    </div>
  );
};

export default FinancialMetrics;