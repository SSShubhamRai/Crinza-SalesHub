import React from "react";

const LightboxModal = ({ url, onClose }) => {
  if (!url) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 w-screen h-screen bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-fade-in cursor-zoom-out"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] overflow-auto bg-[var(--color-card)] p-3 rounded-3xl border border-[var(--color-border)] shadow-2xl transition-all transform scale-100 animate-in zoom-in-95 duration-200 mx-auto my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-2 px-2 border-b border-[var(--color-border)] mb-2">
          <span className="text-xs font-bold text-[var(--color-heading)]">Payment Proof Verification</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--color-surface)] text-[var(--color-heading)] flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-red-500 hover:text-white transition active:scale-90"
          >
            ✕
          </button>
        </div>
        <img
          src={url}
          alt="Payment Proof Receipt"
          className="rounded-2xl max-h-[75vh] w-auto object-contain mx-auto transition-transform duration-300 hover:scale-[1.01]"
        />
      </div>
    </div>
  );
};

export default LightboxModal;