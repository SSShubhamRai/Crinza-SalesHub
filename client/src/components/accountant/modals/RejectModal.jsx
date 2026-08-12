import React from "react";

const RejectModal = ({ isOpen, reason, onReasonChange, onClose, onSubmit }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-md w-full mx-auto my-auto p-6 text-[var(--color-heading)] space-y-4 shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200">
        <h3 className="text-base font-bold text-red-500">Reject Invoice Request</h3>
        <p className="text-xs text-[var(--color-body)]">
          Please specify the reason why this invoice is being rejected. This will be shared with the team:
        </p>

        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="e.g. Payment screenshot is unclear or amount mismatch."
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-red-500 h-28 transition shadow-inner"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-[var(--color-surface)] py-3 rounded-2xl text-xs font-semibold border border-[var(--color-border)] cursor-pointer transition active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-2xl text-xs shadow-sm cursor-pointer transition active:scale-95"
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectModal;