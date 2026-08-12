import React from "react";

const ViewDetailsModal = ({ data, onClose }) => {
  if (!data) return null;
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-lg w-full mx-auto my-auto p-6 text-[var(--color-heading)] space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto transform scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
          <h3 className="text-base font-bold text-[var(--color-heading)]">Full Invoice Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer transition active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
            <span className="text-[var(--color-body)] block text-[10px]">Institute</span>
            <strong className="text-[var(--color-heading)] text-sm">{data.instituteName}</strong>
          </div>
          <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
            <span className="text-[var(--color-body)] block text-[10px]">App Name</span>
            <strong className="text-[var(--color-heading)] text-sm">{data.appName}</strong>
          </div>
          <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
            <span className="text-[var(--color-body)] block text-[10px]">Mobile</span>
            <strong>{data.mobileNo}</strong>
          </div>
          <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
            <span className="text-[var(--color-body)] block text-[10px]">Email</span>
            <strong className="truncate block">{data.email}</strong>
          </div>
          <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
            <span className="text-[var(--color-body)] block text-[10px]">Payment Mode</span>
            <strong>{data.paymentMode || "ONLINE"}</strong>
          </div>
          <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
            <span className="text-[var(--color-body)] block text-[10px]">
              {data.paymentMode === "CASH" ? "Receipt No" : data.paymentMode === "CHEQUE" ? "Cheque No" : "UTR Number"}
            </span>
            <strong>{data.utrNumber || data.receiptNo || data.chequeNo || "N/A"}</strong>
          </div>

          <div className="col-span-2 bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)]">
            <span className="text-[var(--color-body)] block text-[10px] mb-1 font-medium uppercase">
              Add-on Packages Selected
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {data.addons?.testModule && (
                <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs px-2.5 py-1 rounded-xl font-medium">
                  Test Series Module (+₹5,000)
                </span>
              )}
              {data.addons?.windowApp && (
                <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs px-2.5 py-1 rounded-xl font-medium">
                  Windows Desktop App (+₹5,000)
                </span>
              )}
              {data.addons?.iosApp && (
                <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs px-2.5 py-1 rounded-xl font-medium">
                  iOS Mobile App (+₹45,000)
                </span>
              )}
              {!data.addons?.testModule && !data.addons?.windowApp && !data.addons?.iosApp && (
                <span className="text-[var(--color-body)] text-xs">No Add-ons selected</span>
              )}
            </div>
          </div>

          {data.couponCode && (
            <div className="col-span-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-xs flex justify-between items-center text-emerald-600 font-medium">
              <span>
                Applied Coupon: <strong>{data.couponCode}</strong>
              </span>
              <span>Discount: -₹{data.discountAmount || 999}</span>
            </div>
          )}
        </div>

        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--color-body)]">Base Amount:</span>
            <strong>₹{data.baseAmount || data.totalAmount}</strong>
          </div>
          {data.previousDueBalance > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Previous Due Balance:</span>
              <strong>+₹{data.previousDueBalance}</strong>
            </div>
          )}
          {data.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Coupon Discount:</span>
              <strong>-₹{data.discountAmount}</strong>
            </div>
          )}
          <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-sm font-bold">
            <span>Total Amount:</span>
            <strong>₹{data.totalAmount}</strong>
          </div>
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>Paid Amount:</span>
            <strong>₹{data.paidAmount}</strong>
          </div>
          <div className="flex justify-between text-red-500 font-bold">
            <span>Due Balance:</span>
            <strong>₹{data.dueAmount}</strong>
          </div>
        </div>

        <div>
          <span className="text-[var(--color-body)] block text-xs mb-1 font-medium">Terms & Conditions</span>
          <p className="text-[11px] bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)] text-[var(--color-body)] whitespace-pre-line max-h-24 overflow-y-auto shadow-inner">
            {data.termsAndConditions}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-border)] py-3 rounded-2xl font-semibold text-xs border border-[var(--color-border)] cursor-pointer transition active:scale-95 shadow-xs"
        >
          Close Details
        </button>
      </div>
    </div>
  );
};

export default ViewDetailsModal;