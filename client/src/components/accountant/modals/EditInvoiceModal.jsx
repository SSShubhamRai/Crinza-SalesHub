import React from "react";

const EditInvoiceModal = ({ data, onChange, onSubmit, onClose, recalculateEditTotal }) => {
  if (!data) return null;
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <form
        onSubmit={onSubmit}
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-xl w-full mx-auto my-auto p-6 text-[var(--color-heading)] space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
          <h3 className="text-base font-bold text-[var(--color-heading)]">Edit Invoice Request</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[var(--color-body)] block mb-1">Institute Name</label>
            <input
              type="text"
              value={data.instituteName}
              onChange={(e) => onChange({ ...data, instituteName: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">App Name</label>
            <input
              type="text"
              value={data.appName}
              onChange={(e) => onChange({ ...data, appName: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Mobile Number</label>
            <input
              type="text"
              value={data.mobileNo}
              onChange={(e) => onChange({ ...data, mobileNo: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Email Address</label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => onChange({ ...data, email: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Base Price (₹)</label>
            <input
              type="number"
              value={data.baseAmount || data.totalAmount}
              onChange={(e) => {
                const updated = { ...data, baseAmount: Number(e.target.value) };
                onChange(recalculateEditTotal(updated));
              }}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Previous Due Balance (₹)</label>
            <input
              type="number"
              value={data.previousDueBalance || 0}
              onChange={(e) => {
                const updated = { ...data, previousDueBalance: Number(e.target.value) };
                onChange(recalculateEditTotal(updated));
              }}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] font-semibold text-amber-600 focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Coupon Code</label>
            <input
              type="text"
              value={data.couponCode || ""}
              placeholder="e.g. CRINZA"
              onChange={(e) => {
                const code = e.target.value.toUpperCase();
                const updated = { ...data, couponCode: code };
                onChange(recalculateEditTotal(updated));
              }}
              className="uppercase w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-mono transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Total Amount (₹) [Auto]</label>
            <input
              type="number"
              readOnly
              value={data.totalAmount}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] font-bold focus:outline-none opacity-80 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Paid Amount (₹)</label>
            <input
              type="number"
              value={data.paidAmount}
              onChange={(e) => {
                const paid = Number(e.target.value);
                const due = Math.max(0, data.totalAmount - paid);
                onChange({ ...data, paidAmount: paid, dueAmount: due });
              }}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="text-[var(--color-body)] block mb-1">Payment Mode</label>
            <select
              value={data.paymentMode || "ONLINE"}
              onChange={(e) => onChange({ ...data, paymentMode: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] transition cursor-pointer"
            >
              <option value="ONLINE">ONLINE</option>
              <option value="CASH">CASH</option>
              <option value="CHEQUE">CHEQUE</option>
            </select>
          </div>
        </div>

        <div className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-2">
          <label className="block text-[10px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">
            Modify Add-ons
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2.5 rounded-xl border border-[var(--color-border)] transition hover:border-[var(--color-primary)]">
              <input
                type="checkbox"
                checked={!!data.addons?.testModule}
                onChange={(e) => {
                  const updatedAddons = { ...data.addons, testModule: e.target.checked };
                  onChange(recalculateEditTotal({ ...data, addons: updatedAddons }));
                }}
                className="accent-[var(--color-primary)]"
              />
              <span>Test Module (+₹5k)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2.5 rounded-xl border border-[var(--color-border)] transition hover:border-[var(--color-primary)]">
              <input
                type="checkbox"
                checked={!!data.addons?.windowApp}
                onChange={(e) => {
                  const updatedAddons = { ...data.addons, windowApp: e.target.checked };
                  onChange(recalculateEditTotal({ ...data, addons: updatedAddons }));
                }}
                className="accent-[var(--color-primary)]"
              />
              <span>Windows App (+₹5k)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2.5 rounded-xl border border-[var(--color-border)] transition hover:border-[var(--color-primary)]">
              <input
                type="checkbox"
                checked={!!data.addons?.iosApp}
                onChange={(e) => {
                  const updatedAddons = { ...data.addons, iosApp: e.target.checked };
                  onChange(recalculateEditTotal({ ...data, addons: updatedAddons }));
                }}
                className="accent-[var(--color-primary)]"
              />
              <span>iOS App (+₹45k)</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[var(--color-surface)] py-3 rounded-2xl text-xs font-semibold border border-[var(--color-border)] cursor-pointer transition active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-[var(--color-primary)] hover:opacity-90 py-3 rounded-2xl text-xs font-semibold text-white shadow-sm cursor-pointer transition active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditInvoiceModal;