import React from "react";

export const TransferLeadsTab = ({
  transferStatus,
  transferData,
  setTransferData,
  employees,
  fetchSalespersonLeadsForTransfer,
  selectedLeadIds,
  loadingSourceLeads,
  sourceLeads,
  handleSelectAllLeads,
  handleToggleLeadSelection,
  handleExecuteGranularTransfer,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
        <div>
          <h3 className="text-base font-bold text-[var(--color-primary)]">
            🔄 Transfer Leads
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-1">
            Select a source salesperson to view their active leads, choose specific leads using checkboxes, and reassign them to another salesperson.
          </p>
        </div>

        {transferStatus.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3.5 rounded-2xl text-xs font-semibold animate-fade-in">
            {transferStatus.success}
          </div>
        )}
        {transferStatus.error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3.5 rounded-2xl text-xs font-semibold animate-fade-in">
            {transferStatus.error}
          </div>
        )}

        <form onSubmit={handleExecuteGranularTransfer} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1.5 text-[var(--color-heading)]">
                Source Salesperson (From) *
              </label>
              <select
                required
                value={transferData.fromSalesperson}
                onChange={(e) => {
                  setTransferData({ ...transferData, fromSalesperson: e.target.value });
                  if (e.target.value) fetchSalespersonLeadsForTransfer(e.target.value);
                }}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium cursor-pointer"
              >
                <option value="">Select Salesperson to pick leads from</option>
                <option value="null">Unassigned / Deleted (null)</option>
                {employees
                  .filter((emp) => emp.role === "salesperson")
                  .map((emp) => (
                    <option key={emp.userId} value={emp.userId}>
                      {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1.5 text-[var(--color-heading)]">
                Target Salesperson (To) *
              </label>
              <select
                required
                value={transferData.toSalesperson}
                onChange={(e) => setTransferData({ ...transferData, toSalesperson: e.target.value })}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium cursor-pointer"
              >
                <option value="">Select Salesperson to assign leads to</option>
                {employees
                  .filter((emp) => emp.role === "salesperson")
                  .map((emp) => (
                    <option key={emp.userId} value={emp.userId}>
                      {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {transferData.fromSalesperson && (
            <div className="space-y-3 pt-4 border-t border-[var(--color-border)] animate-fade-in">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-[var(--color-heading)]">
                  Select Leads to Transfer ({selectedLeadIds.length} selected)
                </h4>
                {sourceLeads.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllLeads}
                    className="text-xs text-[var(--color-primary)] font-semibold hover:underline cursor-pointer"
                  >
                    {selectedLeadIds.length === sourceLeads.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {loadingSourceLeads ? (
                <div className="py-8 text-center text-xs text-[var(--color-body)] animate-pulse">Loading leads...</div>
              ) : sourceLeads.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                  No active leads found for this salesperson.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 border border-[var(--color-border)] p-3 rounded-2xl bg-[var(--color-surface)]">
                  {sourceLeads.map((lead) => (
                    <label
                      key={lead._id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead._id)}
                          onChange={() => handleToggleLeadSelection(lead._id)}
                          className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                        />
                        <div>
                          <strong className="text-[var(--color-heading)] font-bold">{lead.instituteName}</strong>
                          <span className="text-[var(--color-body)] ml-2">({lead.city || "N/A"})</span>
                        </div>
                      </div>
                      <span className="text-[var(--color-body)] font-medium">📞 {lead.mobileNo || 'N/A'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition cursor-pointer shadow-sm text-xs active:scale-95"
          >
            Transfer Selected Leads ({selectedLeadIds.length})
          </button>
        </form>
      </div>
    </div>
  );
};