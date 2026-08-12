import React from "react";
import ReactDOM from "react-dom";

export const LogoutModal = ({ show, onClose, onConfirm }) => {
  if (!show) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[999999] bg-black/75 backdrop-blur-md overflow-y-auto flex items-center justify-center p-4 animate-fade-in"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-sm w-full my-auto space-y-5 shadow-2xl text-center transform transition-all scale-100 animate-in zoom-in-95 duration-200">
        <span className="text-5xl animate-bounce inline-block">⚠️</span>
        <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">Confirm Logout</h3>
        <p className="text-xs sm:text-sm text-[var(--color-body)] leading-relaxed">
          Are you sure you want to log out from the Admin Portal?
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)]/60 text-[var(--color-heading)] py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer border border-[var(--color-border)] transition active:scale-95 min-h-[46px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition shadow-sm active:scale-95 min-h-[46px]"
          >
            Confirm Logout
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};