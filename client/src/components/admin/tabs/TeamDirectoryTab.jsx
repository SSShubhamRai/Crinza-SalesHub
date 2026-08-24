import React from "react";

export const TeamDirectoryTab = ({
  directorySearch,
  setDirectorySearch,
  filteredDirectoryStats,
  employees,
  userId,
  handleViewEmployeeDetails,
  handleDeleteEmployee,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--color-card)] p-5 rounded-3xl border border-[var(--color-border)] shadow-sm gap-3 transition-all">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-heading)]">
            Search Salesperson & Deal Records
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-0.5">
            Look up salesperson performance, revenue history, and deal pipelines.
          </p>
        </div>
        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Search by Salesperson Name or ID..."
            value={directorySearch}
            onChange={(e) => setDirectorySearch(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl pl-10 pr-4 py-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
          />
          <span className="absolute left-3.5 top-3.5 text-xs text-[var(--color-body)]">🔍</span>
        </div>
      </div>

      <h3 className="text-base font-bold text-[var(--color-heading)]">
        Salesperson Cards & Deal Summaries ({filteredDirectoryStats.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDirectoryStats.map((stat) => {
          const matchedEmp = employees.find((e) => e.userId === stat.salespersonId);
          return (
            <div
              key={stat.salespersonId || "unassigned"}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4 hover:border-[var(--color-primary)]/40 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <div>
                  <h4 className="font-extrabold text-[var(--color-heading)] text-base">
                    {matchedEmp?.name ? `${matchedEmp.name}` : (stat.salespersonId || "Unassigned")}
                  </h4>
                  <span className="text-[10px] text-[var(--color-body)] font-mono">
                    ID: {stat.salespersonId || "N/A"}
                  </span>
                </div>
                <span className="text-[10px] bg-[var(--color-surface)] px-3 py-1 rounded-xl border border-[var(--color-border)] font-semibold">
                  {stat.totalDeals} Total Deals
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)]">
                <div>
                  <span className="text-[10px] text-[var(--color-body)] block">Approved</span>
                  <strong className="text-emerald-600 text-sm">{stat.approvedDeals}</strong>
                </div>
                <div className="border-x border-[var(--color-border)]">
                  <span className="text-[10px] text-[var(--color-body)] block">Pending</span>
                  <strong className="text-amber-600 text-sm">{stat.pendingDeals}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--color-body)] block">Rejected</span>
                  <strong className="text-red-500 text-sm">{stat.rejectedDeals}</strong>
                </div>
              </div>

              <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] text-xs space-y-1.5 font-medium">
                <div className="flex justify-between">
                  <span className="text-[var(--color-body)]">Total Revenue:</span>
                  <strong className="text-[var(--color-heading)]">₹{stat.totalBusiness?.toLocaleString("en-IN") || 0}</strong>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Collected:</span>
                  <strong>₹{stat.totalPaid?.toLocaleString("en-IN") || 0}</strong>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleViewEmployeeDetails(stat.salespersonId || "null")}
                  className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border border-purple-500/20 text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer text-center active:scale-95"
                >
                  👁️ View Deals History
                </button>

                {stat.salespersonId && stat.salespersonId !== "Unassigned" && stat.salespersonId !== userId && (
                  <button
                    onClick={() => handleDeleteEmployee(stat.salespersonId)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs px-3.5 py-2.5 rounded-xl font-semibold transition cursor-pointer active:scale-95"
                  >
                    ❌
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};