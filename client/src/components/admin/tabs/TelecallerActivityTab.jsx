import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const TelecallerActivityTab = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);

  const API_BASE = import.meta.env.PROD ? "https://crinza-saleshub.onrender.com" : "http://localhost:5000";

  const fetchActivityLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/admin/telecaller-activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch telecaller activities");

      setActivities(data.telecallerActivity || []);
      setTotalLeads(data.totalLeadsCount || 0);
    } catch (err) {
      toast.error(err.message || "Error loading telemetry data");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm">
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">ADMIN MONITORING</span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-heading)] mt-1">Telecaller Activity Tracking</h2>
          <p className="text-xs text-[var(--color-body)]">Total System Leads Tracked: {totalLeads}</p>
        </div>
        <button 
          onClick={fetchActivityLogs} 
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white cursor-pointer shadow-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-center py-12 text-xs text-[var(--color-body)]">Loading telecaller metrics...</p>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 bg-[var(--color-card)] rounded-3xl border text-xs text-[var(--color-body)]">No telecaller activities recorded yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {activities.map((item) => (
            <div key={item.telecallerId} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--color-heading)]">Telecaller ID: {item.telecallerId}</h3>
                  <p className="text-xs text-[var(--color-body)]">Performance breakdown and lead dispatches</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 font-bold border border-blue-500/20">Created: {item.totalCreated}</span>
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">Assigned: {item.totalAssigned}</span>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">Pending: {item.totalPending}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-[var(--color-body)]">Dispatched Leads History</h4>
                {item.assignedDetails.length === 0 ? (
                  <p className="text-xs text-[var(--color-body)] italic">No leads assigned to salespersons by this telecaller yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b text-[var(--color-body)]">
                          <th className="p-2.5 font-semibold">Institute Name</th>
                          <th className="p-2.5 font-semibold">Requirement</th>
                          <th className="p-2.5 font-semibold">Salesperson ID</th>
                          <th className="p-2.5 font-semibold">Schedule Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.assignedDetails.map((lead, idx) => (
                          <tr key={idx} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface)]">
                            <td className="p-2.5 font-bold text-[var(--color-heading)]">{lead.instituteName}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 uppercase">
                                {lead.requirementType}
                              </span>
                            </td>
                            <td className="p-2.5 font-medium text-[var(--color-heading)]">{lead.salespersonId}</td>
                            <td className="p-2.5 text-[var(--color-body)]">
                              {lead.followUpDate ? `${lead.followUpDate.split('T')[0]} (${lead.followUpTime || '--:--'})` : "Not Scheduled"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TelecallerActivityTab;