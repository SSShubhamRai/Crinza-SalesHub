import React from "react";

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in transition-all">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto my-auto space-y-4 shadow-2xl text-center transform scale-100 animate-in zoom-in-95 duration-200">
        <span className="text-4xl animate-bounce inline-block">⚠️</span>
        <h3 className="text-lg font-extrabold text-[var(--color-heading)]">Confirm Logout</h3>
        <p className="text-xs text-[var(--color-body)]">Are you sure you want to log out from the Accountant Panel?</p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)]/60 text-[var(--color-heading)] py-3 rounded-xl text-xs font-semibold cursor-pointer border border-[var(--color-border)] transition active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs font-semibold cursor-pointer transition shadow-sm active:scale-95"
          >
            Confirm Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;