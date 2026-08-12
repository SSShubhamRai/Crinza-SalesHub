import React from "react";

export const CouponsTab = ({
  newCoupon,
  setNewCoupon,
  couponStatus,
  handleCreateCoupon,
  coupons,
  handleDeleteCoupon,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
          🎟️ Generate Coupon
        </h3>
        {couponStatus.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3 rounded-2xl text-xs font-semibold animate-fade-in">
            {couponStatus.success}
          </div>
        )}
        {couponStatus.error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-2xl text-xs font-semibold animate-fade-in">
            {couponStatus.error}
          </div>
        )}
        <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Coupon Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. FESTIVE50"
              value={newCoupon.code}
              onChange={(e) =>
                setNewCoupon({
                  ...newCoupon,
                  code: e.target.value.toUpperCase(),
                })
              }
              className="w-full uppercase bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-mono font-bold focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Discount Type *</label>
            <select
              value={newCoupon.discountType}
              onChange={(e) =>
                setNewCoupon({
                  ...newCoupon,
                  discountType: e.target.value,
                })
              }
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-semibold focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Amount (₹)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">
              {newCoupon.discountType === "percentage"
                ? "Percentage Value (e.g. 10) *"
                : "Amount in Rupees (e.g. 500) *"}
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder={
                newCoupon.discountType === "percentage" ? "10" : "500"
              }
              value={newCoupon.discountValue}
              onChange={(e) =>
                setNewCoupon({
                  ...newCoupon,
                  discountValue: e.target.value,
                })
              }
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Expiry Date (Optional)</label>
            <input
              type="date"
              value={newCoupon.expiryDate}
              onChange={(e) =>
                setNewCoupon({
                  ...newCoupon,
                  expiryDate: e.target.value,
                })
              }
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition cursor-pointer"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white text-xs font-semibold py-3 rounded-2xl transition cursor-pointer shadow-sm active:scale-95"
          >
            Generate & Save Coupon
          </button>
        </form>
      </div>

      <div className="md:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-[var(--color-heading)]">
          Active Discount Coupons ({coupons.length})
        </h3>
        {coupons.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
            No active discount coupons generated yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)] max-h-[420px] overflow-y-auto">
            {coupons.map((coupon) => (
              <div
                key={coupon._id}
                className="py-3.5 flex justify-between items-center text-xs transition hover:bg-[var(--color-surface)] px-2 rounded-xl"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm bg-purple-500/10 text-purple-600 px-2.5 py-1 rounded-xl border border-purple-500/20">
                      {coupon.code}
                    </span>
                    <span className="text-[var(--color-heading)] font-semibold">
                      {coupon.discountType === "percentage"
                        ? `${coupon.discountValue}% OFF`
                        : `₹${coupon.discountValue} OFF`}
                    </span>
                  </div>
                  <p className="text-[var(--color-body)] mt-1">
                    Expires:{" "}
                    {coupon.expiryDate
                      ? new Date(
                          coupon.expiryDate,
                        ).toLocaleDateString()
                      : "No Expiry"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-xl font-bold text-[10px] uppercase">
                    Active
                  </span>
                  <button
                    onClick={() =>
                      handleDeleteCoupon(coupon._id, coupon.code)
                    }
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 px-3.5 py-2 rounded-xl transition cursor-pointer font-semibold active:scale-95"
                  >
                    ❌ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};