import React from "react";

const HistoryTab = ({ list, onViewDetails }) => {
  if (list.length === 0) {
    return (
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 bg-[var(--color-surface)] rounded-full flex items-center justify-center mx-auto text-xl animate-bounce">
          📂
        </div>
        <h3 className="text-sm font-bold text-[var(--color-heading)]">No History Records Found</h3>
        <p className="text-xs text-[var(--color-body)]">There are no approved or rejected invoices matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((item) => (
        <div
          key={item._id}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm space-y-3 hover:border-[var(--color-border)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-3">
              <strong className="text-[var(--color-heading)] text-sm font-bold">
                {item.instituteName} <span className="text-[var(--color-body)] font-normal">({item.appName})</span>
              </strong>
              <span className="text-[10px] bg-[var(--color-surface)] px-2.5 py-1 rounded-lg border border-[var(--color-border)] font-mono">
                #{item.invoiceId}
              </span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                item.status === "approved"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/25"
                  : "bg-red-500/10 text-red-500 border border-red-500/25"
              }`}
            >
              {item.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[var(--color-body)]">
            <div>
              📍 <strong>Address:</strong> {item.address || "N/A"}, {item.city || ""}, {item.state || ""}
            </div>
            <div>
              📞 <strong>Contact:</strong> {item.mobileNo} • {item.email}
            </div>
            <div>
              👤 <strong>Salesperson:</strong> {item.salespersonId}
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-[var(--color-border)] text-xs">
            <div className="flex gap-4">
              <span>
                Total: <strong className="text-[var(--color-heading)]">₹{item.totalAmount?.toLocaleString("en-IN")}</strong>
              </span>
              <span className="text-emerald-600">
                Paid: <strong>₹{item.paidAmount?.toLocaleString("en-IN")}</strong>
              </span>
              <span className="text-red-500">
                Due: <strong>₹{item.dueAmount?.toLocaleString("en-IN")}</strong>
              </span>
            </div>

            <button
              onClick={() => onViewDetails(item)}
              className="bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-xs px-3.5 py-2 rounded-xl border border-[var(--color-border)] font-medium cursor-pointer transition-all active:scale-95 shadow-xs"
            >
              👁️ View Full Breakdown
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryTab;