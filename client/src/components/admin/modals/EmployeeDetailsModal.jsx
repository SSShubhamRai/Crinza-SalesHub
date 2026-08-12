import React from "react";

export const EmployeeDetailsModal = ({
  selectedEmpLogs,
  setSelectedEmpLogs,
  loadingLogs,
  API_BASE,
  setTransferModalDeal,
}) => {
  if (!selectedEmpLogs) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-3xl w-full p-6 md:p-8 text-[var(--color-heading)] space-y-4 shadow-2xl my-8 transform scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-primary)]">
              Salesperson Activity & Location Report
            </h3>
            <p className="text-xs text-[var(--color-body)]">
              Salesperson ID: <strong>{selectedEmpLogs.userId === "null" ? "Unassigned" : selectedEmpLogs.userId}</strong>
            </p>
          </div>
          <button
            onClick={() => setSelectedEmpLogs(null)}
            className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-xs text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer transition active:scale-90"
          >
            ✕
          </button>
        </div>

        {loadingLogs ? (
          <div className="py-12 text-center text-xs text-[var(--color-body)] animate-pulse">
            Fetching full activity logs...
          </div>
        ) : selectedEmpLogs.deals.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
            No deals or visit records submitted by this salesperson yet.
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-body)]">
              Showing all <strong>{selectedEmpLogs.deals.length}</strong> deal(s) created by this salesperson:
            </p>

            <div className="space-y-3">
              {selectedEmpLogs.deals.map((deal) => (
                <div
                  key={deal._id}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-3 text-xs transition hover:border-[var(--color-primary)]/40"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--color-border)] pb-3">
                    <span className="text-sm font-bold text-[var(--color-heading)]">
                      {deal.instituteName} ({deal.appName})
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${deal.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : deal.status === "rejected" ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"}`}
                    >
                      {deal.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-heading)]">
                    <div>📍 <strong>Manual Address:</strong> {deal.address || "N/A"}</div>
                    <div>🏙️ <strong>City & State:</strong> {deal.city || "N/A"}, {deal.state || "N/A"}</div>
                    <div>📮 <strong>Pincode:</strong> {deal.pincode || "N/A"}</div>
                    <div>📞 <strong>Contact:</strong> {deal.mobileNo} | {deal.email}</div>
                  </div>

                  {deal.latitude && deal.longitude ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between text-xs mt-2">
                      <span className="text-emerald-700 font-medium">
                        🛰️ <strong>Verified GPS:</strong> {deal.latitude.toFixed(5)}, {deal.longitude.toFixed(5)}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${deal.latitude},${deal.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-xl transition shadow-sm active:scale-95"
                      >
                        🗺️ Map
                      </a>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-amber-600 text-xs mt-2 font-medium">
                      ⚠️ GPS Coordinates were not captured for this deal submission.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--color-border)] text-xs font-medium">
                    <span>Total: <strong className="text-[var(--color-heading)]">₹{deal.totalAmount}</strong></span>
                    <span className="text-emerald-600">Paid: <strong>₹{deal.paidAmount}</strong></span>
                    <span className="text-red-500">Due: <strong>₹{deal.dueAmount}</strong></span>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border)] flex justify-end">
                    <button
                      type="button"
                      onClick={() => setTransferModalDeal(deal)}
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 border border-purple-500/20 text-xs px-3.5 py-2 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      🔄 Transfer This Deal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setSelectedEmpLogs(null)}
          className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-border)] py-3 rounded-2xl font-semibold text-xs border border-[var(--color-border)] mt-2 cursor-pointer transition active:scale-95"
        >
          Close Report
        </button>
      </div>
    </div>
  );
};