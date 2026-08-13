import React from "react";

export const LiveTrackingTab = ({
  trackerDate,          // Start Date / Single Date
  setTrackerDate,
  trackerEndDate,       // NEW: End Date for Range
  setTrackerEndDate,    // NEW: Setter for End Date
  selectedTrackerEmp,
  setSelectedTrackerEmp,
  employees,
  fetchSalespersonTravelHistory,
  fetchSalespersonShiftInfo,
  liveLocations,
  shiftData,
  travelData,
  resolvedAddresses,
  resolvePlaceName,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-[var(--color-card)] p-5 rounded-3xl border border-[var(--color-border)] shadow-sm gap-3 transition-all">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-heading)]">
            🛰️ Salesperson Live Location & Travel History
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-0.5">
            View live position, custom date range distance, and exact place names.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* From Date */}
          <div className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-[var(--color-body)]">From:</span>
            <input
              type="date"
              value={trackerDate}
              max={todayStr}
              onChange={(e) => {
                const newStartDate = e.target.value;
                setTrackerDate(newStartDate);
                if (selectedTrackerEmp) {
                  fetchSalespersonTravelHistory(selectedTrackerEmp, newStartDate, trackerEndDate);
                  fetchSalespersonShiftInfo(selectedTrackerEmp, newStartDate);
                }
              }}
              className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold"
            />
          </div>

          {/* To Date (Range) */}
          <div className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-[var(--color-body)]">To:</span>
            <input
              type="date"
              value={trackerEndDate || trackerDate}
              min={trackerDate}
              max={todayStr}
              onChange={(e) => {
                const newEndDate = e.target.value;
                setTrackerEndDate(newEndDate);
                if (selectedTrackerEmp) {
                  fetchSalespersonTravelHistory(selectedTrackerEmp, trackerDate, newEndDate);
                }
              }}
              className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold"
            />
          </div>

          {/* Salesperson Dropdown */}
          <select
            value={selectedTrackerEmp}
            onChange={(e) => {
              const empId = e.target.value;
              setSelectedTrackerEmp(empId);
              if (empId) {
                fetchSalespersonTravelHistory(empId, trackerDate, trackerEndDate || trackerDate);
                fetchSalespersonShiftInfo(empId, trackerDate);
              }
            }}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold"
          >
            <option value="">-- Choose Salesperson --</option>
            {employees
              .filter((emp) => emp.role === "salesperson")
              .map((emp) => (
                <option key={emp.userId} value={emp.userId}>
                  {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                </option>
              ))}
          </select>
        </div>
      </div>

      {!selectedTrackerEmp ? (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
          <span className="text-3xl animate-bounce">📍</span>
          <h3 className="text-sm font-bold text-[var(--color-heading)]">No Salesperson Selected</h3>
          <p className="text-xs text-[var(--color-body)]">Please choose a salesperson from the dropdown above to view their live GPS status and travel report.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6">
            {/* Live GPS Status */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4 transition-all hover:shadow-md">
              <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">🟢 Live GPS Status</h4>
              {liveLocations[selectedTrackerEmp] ? (
                <div className="space-y-3 text-xs text-[var(--color-heading)]">
                  <p>Lat/Lng: <strong className="font-mono">{liveLocations[selectedTrackerEmp].latitude.toFixed(4)}, {liveLocations[selectedTrackerEmp].longitude.toFixed(4)}</strong></p>
                  <p className="text-[var(--color-body)]">Last Ping: {new Date(liveLocations[selectedTrackerEmp].timestamp).toLocaleTimeString('en-IN')}</p>
                  <a
                    href={`https://www.google.com/maps?q=${liveLocations[selectedTrackerEmp].latitude},${liveLocations[selectedTrackerEmp].longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition shadow-sm active:scale-95"
                  >
                    🗺️ Open Live Position on Map
                  </a>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                  Waiting for continuous live GPS ping from app...
                </div>
              )}
            </div>

            {/* Shift Status */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4 transition-all hover:shadow-md">
              <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">⏱️ Shift & Attendance Status</h4>
              {shiftData ? (
                <div className="space-y-2 text-xs sm:text-sm text-[var(--color-heading)]">
                  <p>Shift Status: <strong className={shiftData.status === 'STARTED' ? 'text-emerald-600 font-extrabold' : 'text-amber-600 font-extrabold'}>{shiftData.status}</strong></p>
                  
                  {(shiftData.startAddress || shiftData.locationName) && (
                    <p className="text-xs font-semibold text-[var(--color-primary)] truncate">
                      📍 Start Location: <strong className="text-[var(--color-heading)] truncate">{shiftData.startAddress || shiftData.locationName}</strong>
                    </p>
                  )}

                  <p>🕒 Start Time: <strong>{new Date(shiftData.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></p>
                  <p>🏁 End Time: <strong>{shiftData.endTime ? new Date(shiftData.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Still Active / Not Ended'}</strong></p>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                  No shift started by this employee on this date.
                </div>
              )}
            </div>
          </div>

          {/* Travel Summary & Range Route Points */}
          <div className="md:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4 transition-all hover:shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-3 gap-2">
              <h4 className="text-sm font-bold text-[var(--color-heading)]">
                🛣️ Travel Summary ({trackerDate} {trackerEndDate && trackerEndDate !== trackerDate ? `to ${trackerEndDate}` : ''})
              </h4>
              <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-xl font-extrabold text-xs">
                Total Distance: {travelData.totalDistanceKm || 0} KM
              </span>
            </div>

            <p className="text-xs text-[var(--color-body)]">
              Route history logged: <strong>{travelData.routePoints?.length || 0}</strong> coordinate pings recorded in this date range.
            </p>

            <div className="max-h-80 overflow-y-auto space-y-2 border border-[var(--color-border)] p-3 rounded-2xl bg-[var(--color-surface)] text-xs">
              {travelData.routePoints?.length === 0 ? (
                <div className="py-8 text-center text-[var(--color-body)]">No route coordinates logged for this date range.</div>
              ) : (
                travelData.routePoints?.map((pt, idx) => {
                  const pointKey = pt._id || `${pt.latitude}-${pt.longitude}-${idx}`;
                  if (!resolvedAddresses[pointKey]) {
                    resolvePlaceName(pt.latitude, pt.longitude, pointKey);
                  }
                  return (
                    <div key={pointKey} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] gap-2 transition hover:border-[var(--color-primary)]/40">
                      <div className="space-y-0.5">
                        <span className="font-bold text-[var(--color-heading)] flex items-center gap-1">
                          📍 {resolvedAddresses[pointKey] || `GPS Point (${pt.latitude.toFixed(3)}, ${pt.longitude.toFixed(3)})`}
                        </span>
                        <span className="text-[10px] text-[var(--color-body)] font-mono">
                          Lat: {pt.latitude.toFixed(5)}, Lng: {pt.longitude.toFixed(5)}
                        </span>
                      </div>
                      <span className="text-[var(--color-body)] whitespace-nowrap">
                        🕒 {new Date(pt.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};