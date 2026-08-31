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

  // Selected employee ka object dhoondhein taaki role pata chal sake
  const selectedEmpObj = employees.find((emp) => emp.userId === selectedTrackerEmp);
  const isTelecaller = selectedEmpObj?.role === "telecaller";

  // 🌟 Fallback logic: Live socket data ya phir database ka latest route point
  const livePt = liveLocations[selectedTrackerEmp];

  const latestDbPt =
    travelData?.routePoints?.length > 0
      ? travelData.routePoints[travelData.routePoints.length - 1]
      : null;

  const activePt =
    livePt ||
    travelData?.lastLiveLocation ||
    latestDbPt;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-[var(--color-card)] p-5 rounded-3xl border border-[var(--color-border)] shadow-sm gap-3 transition-all">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-heading)]">
            🛰️ Employee Live Location & Shift Tracking
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-0.5">
            View salesperson live travel history or telecaller shift start and end details.
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

          {/* Employee Dropdown (Salesperson & Telecaller) */}
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
            <option value="">-- Choose Employee --</option>
            {employees
              .filter((emp) => emp.role === "salesperson" || emp.role === "telecaller")
              .map((emp) => (
                <option key={emp.userId} value={emp.userId}>
                  {emp.name ? `${emp.name} (${emp.userId}) [${emp.role.toUpperCase()}]` : emp.userId}
                </option>
              ))}
          </select>
        </div>
      </div>

      {!selectedTrackerEmp ? (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
          <span className="text-3xl animate-bounce">📍</span>
          <h3 className="text-sm font-bold text-[var(--color-heading)]">No Employee Selected</h3>
          <p className="text-xs text-[var(--color-body)]">Please choose an employee from the dropdown above to view their tracking details.</p>
        </div>
      ) : isTelecaller ? (
        /* 🌟 TELECALLER VIEW: Start/End Time aur Start/End Location dikhayega */
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-5 max-w-xl mx-auto">
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
            <span className="text-3xl p-3 bg-purple-500/10 rounded-2xl">📞</span>
            <div>
              <h4 className="text-sm font-bold text-[var(--color-heading)]">Telecaller Shift Attendance & Location</h4>
              <p className="text-xs text-[var(--color-body)]">Showing shift start and end timing along with recorded locations.</p>
            </div>
          </div>

          {shiftData ? (
            <div className="space-y-4 text-xs sm:text-sm text-[var(--color-heading)] bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-body)]">Shift Status:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${shiftData.status === 'STARTED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                  {shiftData.status}
                </span>
              </div>

              {/* Start Details */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--color-border)]">
                <div>
                  <span className="text-[var(--color-body)] block font-semibold">🕒 Start Time:</span>
                  <strong className="text-[var(--color-heading)]">
                    {shiftData.startTime ? new Date(shiftData.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                  </strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block font-semibold">🏁 End Time:</span>
                  <strong className={shiftData.endTime ? 'text-[var(--color-heading)]' : 'text-amber-600'}>
                    {shiftData.endTime ? new Date(shiftData.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Still Active'}
                  </strong>
                </div>
              </div>

              {/* Start Location */}
              <div className="space-y-1 pt-2 border-t border-[var(--color-border)]">
                <span className="text-[var(--color-body)] block font-semibold">📍 Start Location / Address:</span>
                <p className="font-bold text-[var(--color-primary)] bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)]">
                  {shiftData.startAddress || shiftData.locationName || "Location coordinates recorded without text address."}
                </p>
                {shiftData.startLocation && (
                  <p className="text-[10px] text-[var(--color-body)] font-mono pt-1">
                    Lat/Lng: {shiftData.startLocation.latitude}, {shiftData.startLocation.longitude}
                  </p>
                )}
              </div>

              {/* End Location */}
              {shiftData.endLocation && (
                <div className="space-y-1 pt-2 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block font-semibold">🛑 End Location Coordinates:</span>
                  <p className="font-bold text-red-600 bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] font-mono">
                    Lat: {shiftData.endLocation.latitude}, Lng: {shiftData.endLocation.longitude}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
              No shift started by this telecaller on {trackerDate}.
            </div>
          )}
        </div>
      ) : (
        /* 🌟 SALESPERSON VIEW: Pura Live Map, Live GPS & Travel History */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6">
            {/* Live GPS Status with Resolved Address */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4 transition-all hover:shadow-md">
              <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">🟢 Live GPS Status</h4>
              {activePt ? (
                (() => {
                  const activePointKey = activePt._id || `${activePt.latitude}-${activePt.longitude}-live`;
                  if (!resolvedAddresses[activePointKey]) {
                    resolvePlaceName(activePt.latitude, activePt.longitude, activePointKey);
                  }
                  const placeName = resolvedAddresses[activePointKey];

                  return (
                    <div className="space-y-3 text-xs text-[var(--color-heading)]">
                      <div className="space-y-1">
                        <span className="text-[10px] text-[var(--color-body)] font-bold block">Current Location Name:</span>
                        <p className="font-bold text-sm text-[var(--color-heading)] flex items-start gap-1">
                          📍 {placeName || "Resolving place name..."}
                        </p>
                      </div>

                      <p className="text-[var(--color-body)] font-mono text-[11px]">
                        Lat/Lng: {activePt.latitude.toFixed(4)}, {activePt.longitude.toFixed(4)}
                      </p>

                      <div>
                        {livePt ? (
                          <span className="inline-block bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            🟢 Live Socket Active
                          </span>
                        ) : (
                          <span className="inline-block bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            🕒 Last Logged Position
                          </span>
                        )}
                      </div>

                      <p className="text-[var(--color-body)]">
                        Time: {new Date(activePt.timestamp || activePt.createdAt).toLocaleTimeString('en-IN')}
                      </p>

                      <a
                        href={`https://www.google.com/maps?q=${activePt.latitude},${activePt.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition shadow-sm active:scale-95"
                      >
                        🗺️ Open Position on Map
                      </a>
                    </div>
                  );
                })()
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