import React from "react";

export const SecurityAlertsTab = ({ spoofingAlerts }) => {
  return (
    <div className="bg-[var(--color-card)] border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-4 gap-4">
        <div>
          <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
            <span>🚨</span> Live Mock Location / Spoofing Security Logs
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-0.5">Real-time flags triggered when salespersons attempt to bypass location restrictions using fake GPS.</p>
        </div>
        <span className="bg-red-500/10 text-red-600 border border-red-500/20 px-3 py-1.5 rounded-xl font-extrabold text-xs">
          Total Flags: {spoofingAlerts.length}
        </span>
      </div>

      {spoofingAlerts.length === 0 ? (
        <div className="py-16 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] space-y-2">
          <span className="text-2xl">🛡️</span>
          <p>No spoofing or fake GPS attempts detected in the current active session.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {spoofingAlerts.map((alert, idx) => (
            <div key={idx} className="bg-red-500/5 border border-red-500/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs transition hover:bg-red-500/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <strong className="text-sm text-red-600 font-bold">Salesperson ID: {alert.salespersonId}</strong>
                  <span className="bg-red-500 text-white px-2 py-0.5 rounded-md text-[10px] font-bold animate-pulse">Mock Detected</span>
                </div>
                <p className="text-[var(--color-heading)]">📍 Coordinates flagged: <span className="font-mono">{alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}</span></p>
                <p className="text-[var(--color-body)]">⏰ Timestamp: {new Date(alert.timestamp || Date.now()).toLocaleString('en-IN')}</p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold transition shadow-sm text-center active:scale-95"
              >
                🗺️ View Flagged Location
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};