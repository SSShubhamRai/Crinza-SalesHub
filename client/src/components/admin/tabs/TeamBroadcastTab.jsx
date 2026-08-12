import React from "react";

export const TeamBroadcastTab = ({
  broadcastMsg,
  setBroadcastMsg,
  handleSendBroadcast,
  isBroadcasting,
}) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
        <div>
          <h3 className="text-base font-bold text-[var(--color-primary)] flex items-center gap-2">
            <span>📢</span> Send Live Broadcast Announcement
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-1">
            Instantly push real-time alerts, daily goals, or important updates to all active salesperson apps.
          </p>
        </div>

        <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Priority Level *</label>
            <select
              value={broadcastMsg.priority}
              onChange={(e) => setBroadcastMsg({ ...broadcastMsg, priority: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-semibold focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
            >
              <option value="normal">🟢 Normal Update</option>
              <option value="important">🟡 Important Notice</option>
              <option value="urgent">🔴 Urgent / Emergency</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Headline / Title *</label>
            <input
              type="text"
              required
              placeholder="e.g., Evening Team Sync-up at 6 PM"
              value={broadcastMsg.title}
              onChange={(e) => setBroadcastMsg({ ...broadcastMsg, title: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>

          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Message Details *</label>
            <textarea
              required
              rows="4"
              placeholder="Type your complete announcement here..."
              value={broadcastMsg.message}
              onChange={(e) => setBroadcastMsg({ ...broadcastMsg, message: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] resize-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isBroadcasting}
            className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition cursor-pointer shadow-sm text-xs disabled:opacity-50 active:scale-95"
          >
            {isBroadcasting ? "Broadcasting to Team..." : "🚀 Push Broadcast to All Devices"}
          </button>
        </form>
      </div>
    </div>
  );
};