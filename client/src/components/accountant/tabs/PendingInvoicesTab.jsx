import React from "react";

const PendingInvoicesTab = ({
  list,
  API_BASE,
  actionMessage,
  onViewDetails,
  onEditDetails,
  onOpenLightbox,
  onApprove,
  onRejectPrompt,
}) => {
  if (list.length === 0) {
    return (
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 bg-[var(--color-surface)] rounded-full flex items-center justify-center mx-auto text-xl animate-bounce">
          🎉
        </div>
        <h3 className="text-sm font-bold text-[var(--color-heading)]">No Pending Verifications</h3>
        <p className="text-xs text-[var(--color-body)]">
          All caught up! There are no pending invoice requests matching your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {list.map((item) => (
        <div
          key={item._id}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 flex flex-col lg:flex-row justify-between gap-6 shadow-sm hover:border-[var(--color-primary)]/40 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[var(--color-heading)] font-extrabold text-base">{item.instituteName}</span>
              <span className="text-[10px] font-mono bg-[var(--color-surface)] text-[var(--color-heading)] px-2.5 py-1 rounded-lg border border-[var(--color-border)]">
                #{item.invoiceId}
              </span>
              <span className="text-[10px] font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2.5 py-1 rounded-lg">
                Emp: {item.salespersonId}
              </span>

              {item.paymentMode === "CASH" ? (
                <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-500/20">
                  💵 Cash (Voucher: {item.receiptNo || "N/A"})
                </span>
              ) : item.paymentMode === "CHEQUE" ? (
                <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 px-2.5 py-1 rounded-lg border border-purple-500/20">
                  🏦 Cheque No: {item.chequeNo || "N/A"} ({item.bankName || "Bank"})
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-mono">
                  📱 UPI UTR: {item.utrNumber || "N/A"}
                </span>
              )}

              {item.couponCode && (
                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  🏷️ {item.couponCode} (-₹{item.discountAmount || 999})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {item.ocrStatus === "GREEN" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  🟢 {item.ocrMessage || "AI Verified: UTR & Amount Matched"}
                </span>
              )}
              {item.ocrStatus === "YELLOW" && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  title={item.ocrMessage}
                >
                  ⚠️ {item.ocrMessage || "Mismatch Warning: Data differs from screenshot!"}
                </span>
              )}
              {item.ocrStatus === "RED" && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20"
                  title={item.ocrMessage}
                >
                  🔴 {item.ocrMessage || "Fraud Alert: Duplicate UTR detected!"}
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--color-body)]">
              App: <strong className="text-[var(--color-heading)]">{item.appName}</strong> • Email: {item.email} • Mobile:{" "}
              {item.mobileNo}
            </p>

            <div className="inline-flex flex-wrap gap-3 bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)] text-xs">
              <div>
                <span className="text-[var(--color-body)] text-[10px] block">Total Amount</span>
                <strong className="text-[var(--color-heading)] text-sm">₹{item.totalAmount?.toLocaleString("en-IN")}</strong>
              </div>
              <div className="w-px bg-[var(--color-border)]"></div>
              <div>
                <span className="text-[var(--color-body)] text-[10px] block">Paid Amount</span>
                <strong className="text-emerald-600 text-sm">₹{item.paidAmount?.toLocaleString("en-IN")}</strong>
              </div>
              <div className="w-px bg-[var(--color-border)]"></div>
              <div>
                <span className="text-[var(--color-body)] text-[10px] block">Due Balance</span>
                <strong className="text-red-500 text-sm">₹{item.dueAmount?.toLocaleString("en-IN")}</strong>
              </div>
            </div>

            {actionMessage.id === item._id && actionMessage.text && (
              <div className="text-xs text-[var(--color-primary)] font-medium animate-pulse">⚡ {actionMessage.text}</div>
            )}
            {actionMessage.id === item._id && actionMessage.error && (
              <div className="text-xs text-red-500 font-medium">⚠️ {actionMessage.error}</div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 justify-center border-t lg:border-t-0 lg:border-l border-[var(--color-border)] pt-4 lg:pt-0 lg:pl-6 min-w-[240px]">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onViewDetails(item)}
                className="bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-heading)] text-xs py-2 px-3 rounded-xl border border-[var(--color-border)] transition-all cursor-pointer font-medium active:scale-95 shadow-xs"
              >
                👁️ Full Details
              </button>
              <button
                onClick={() => onEditDetails(item)}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-xs py-2 px-3 rounded-xl border border-amber-500/20 transition-all cursor-pointer font-medium active:scale-95 shadow-xs"
              >
                ✏️ Edit Details
              </button>
            </div>

{item.paymentProof && (
  <button
    onClick={() => {
      // Agar paymentProof pehle se http se shuru hota hai toh wahi use karein, nahi toh API_BASE jodein
      const imageUrl = item.paymentProof.startsWith("http") 
        ? item.paymentProof 
        : `${API_BASE}/${item.paymentProof.replace(/^\/+/, "")}`;
      onOpenLightbox(imageUrl);
    }}
    className="bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs py-2.5 px-3 rounded-xl border border-[var(--color-primary)]/20 text-center font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
  >
    🖼️ View Payment Proof
  </button>
)}

            <a
              href={`https://api.whatsapp.com/send?phone=${item.mobileNo}&text=${encodeURIComponent(
                `Hello from Crinza Technologies,\n\nDear ${item.instituteName} Management,\nYour subscription invoice/ledger #${item.invoiceId} for "${item.appName}" has been reviewed.\n\nGrand Total: ₹${item.totalAmount?.toLocaleString('en-IN')}\nPaid: ₹${item.paidAmount?.toLocaleString('en-IN')}\nDue Balance: ₹${item.dueAmount?.toLocaleString('en-IN')}\n\nThank you for choosing us!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 text-xs py-2.5 px-3 rounded-xl text-center font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
            >
              📱 Send via WhatsApp
            </a>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onApprove(item._id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-sm text-center active:scale-95"
              >
                Approve & Email
              </button>
              <button
                onClick={() => onRejectPrompt(item._id)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center active:scale-95 shadow-xs"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingInvoicesTab;