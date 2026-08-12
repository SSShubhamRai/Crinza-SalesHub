import React from "react";

export const TransferDealModal = ({
  transferModalDeal,
  setTransferModalDeal,
  targetSalesperson,
  setTargetSalesperson,
  employees,
  isTransferring,
  handleExecuteSingleDealTransfer,
}) => {
  if (!transferModalDeal) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-md w-full p-6 md:p-8 text-[var(--color-heading)] space-y-4 shadow-2xl my-8 transform scale-100 animate-in zoom-in-95 duration-200">
        <div>
          <h3 className="text-base font-bold text-[var(--color-primary)]">
            Reassign Deal
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-1">
            Transferring deal for <strong>{transferModalDeal.instituteName}</strong>. Select the target salesperson:
          </p>
        </div>

        <div className="space-y-1.5 text-xs">
          <label className="block font-medium text-[var(--color-heading)]">
            Select Target Salesperson *
          </label>
          <select
            value={targetSalesperson}
            onChange={(e) => setTargetSalesperson(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium cursor-pointer"
          >
            <option value="" disabled>-- Choose Salesperson --</option>
            {employees
              .filter((emp) => emp.role === "salesperson" && emp.userId !== transferModalDeal.salespersonId)
              .map((emp) => (
                <option key={emp.userId} value={emp.userId}>
                  {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                </option>
              ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setTransferModalDeal(null)}
            className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-heading)] py-3 rounded-2xl text-xs font-semibold transition cursor-pointer border border-[var(--color-border)] active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteSingleDealTransfer}
            disabled={isTransferring || !targetSalesperson}
            className={`flex-1 py-3 rounded-2xl text-xs font-semibold transition cursor-pointer text-white shadow-sm active:scale-95 ${
              isTransferring || !targetSalesperson 
                ? "bg-purple-400 opacity-60 cursor-not-allowed" 
                : "bg-[var(--color-primary)] hover:opacity-90"
            }`}
          >
            {isTransferring ? "Transferring..." : "Confirm & Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
};