import React from "react";

const AccountantFilters = ({
  activeTab,
  setActiveTab,
  pendingCount,
  historyCount,
  searchTerm,
  setSearchTerm,
  salespersonFilter,
  setSalespersonFilter,
  allSalespersons,
  statusFilter,
  setStatusFilter,
  onExportCSV,
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 p-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-sm">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95 ${
              activeTab === "pending"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            ⏳ Pending Verification
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                activeTab === "pending" ? "bg-white/20 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)]"
              }`}
            >
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95 ${
              activeTab === "history"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            📜 Processed History
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                activeTab === "history" ? "bg-white/20 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)]"
              }`}
            >
              {historyCount}
            </span>
          </button>
        </div>

        {activeTab === "history" && historyCount > 0 && (
          <button
            onClick={onExportCSV}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95 hover:shadow-md"
          >
            📥 Export History to CSV / Excel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[var(--color-card)] p-4 rounded-3xl border border-[var(--color-border)] shadow-sm items-center transition-all">
        <div className="md:col-span-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Institute Name, ID, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl pl-10 pr-4 py-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition-all shadow-inner"
            />
            <span className="absolute left-3.5 top-3.5 text-xs text-[var(--color-body)]">🔍</span>
          </div>
        </div>

        <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)] transition-colors">
            <span className="text-[11px] text-[var(--color-body)] font-medium">Employee:</span>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Employees</option>
              {allSalespersons.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
          </div>

          {activeTab === "history" && (
            <div className="flex items-center gap-2 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)] transition-colors">
              <span className="text-[11px] text-[var(--color-body)] font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AccountantFilters;