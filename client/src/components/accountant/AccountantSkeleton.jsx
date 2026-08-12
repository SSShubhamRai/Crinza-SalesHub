import React from "react";

const AccountantSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((n) => (
      <div
        key={n}
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 flex flex-col md:flex-row justify-between gap-6 shadow-sm"
      >
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3">
            <div className="h-6 w-48 bg-[var(--color-surface)] rounded-md"></div>
            <div className="h-5 w-24 bg-[var(--color-surface)] rounded-md"></div>
          </div>
          <div className="h-4 w-72 bg-[var(--color-surface)] rounded-md"></div>
          <div className="flex gap-6 pt-2">
            <div className="h-4 w-20 bg-[var(--color-surface)] rounded-md"></div>
            <div className="h-4 w-20 bg-[var(--color-surface)] rounded-md"></div>
            <div className="h-4 w-20 bg-[var(--color-surface)] rounded-md"></div>
          </div>
        </div>
        <div className="flex flex-col gap-2 justify-center min-w-[220px]">
          <div className="h-9 w-full bg-[var(--color-surface)] rounded-xl"></div>
          <div className="h-9 w-full bg-[var(--color-surface)] rounded-xl"></div>
        </div>
      </div>
    ))}
  </div>
);

export default AccountantSkeleton;