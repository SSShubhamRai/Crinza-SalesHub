import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const TechnicalDashboard = ({ userId, onLogout, API_BASE }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchMyProjects = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/technical/my-projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(data);
      } else {
        toast.error(data.message || "Failed to load projects");
      }
    } catch (err) {
      console.error("Error fetching tech projects:", err);
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchMyProjects();
  }, [fetchMyProjects]);

  const handleUpdateStatus = async (projectId, newStatus) => {
    setUpdatingId(projectId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/technical/projects/status/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status");

      toast.success(`Status updated to ${newStatus}!`);
      fetchMyProjects();
    } catch (err) {
      toast.error(err.message || "Error updating status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Status Badge Color Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case "Assigned":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "In Progress":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Testing":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "Delivered":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              TECHNICAL DEVELOPMENT PORTAL
            </span>
            <h1 className="text-2xl font-extrabold text-[var(--color-heading)] tracking-tight mt-1">
              CRINZA APP PRODUCTION
            </h1>
            <p className="text-[var(--color-body)] text-xs">
              Logged in Developer ID: <strong className="text-[var(--color-primary)]">{userId}</strong>
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition-all cursor-pointer flex items-center gap-2"
          >
            Logout
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">Total Assigned Projects</span>
              <h3 className="text-lg font-extrabold text-[var(--color-heading)] mt-0.5">{projects.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-sm">📂</div>
          </div>
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">In Progress / Testing</span>
              <h3 className="text-lg font-extrabold text-amber-600 mt-0.5">
                {projects.filter(p => p.status === "In Progress" || p.status === "Testing" || p.status === "Assigned").length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">⚡</div>
          </div>
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">Successfully Delivered</span>
              <h3 className="text-lg font-extrabold text-emerald-600 mt-0.5">
                {projects.filter(p => p.status === "Delivered").length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">🎉</div>
          </div>
        </div>

        {/* Projects List Section */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-heading)]">My Assigned App Projects</h2>

          {loading ? (
            <div className="py-12 text-center text-[var(--color-body)] animate-pulse">Loading assigned projects...</div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-center text-[var(--color-body)] bg-[var(--color-background)] rounded-2xl border border-dashed border-[var(--color-border)]">
              No app projects assigned to you yet! Check back later or contact admin.
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div 
                  key={project._id}
                  className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:border-[var(--color-primary)]/50"
                >
                  {/* Left: Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-lg">
                        {project.projectId}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadge(project.status)}`}>
                        {project.status}
                      </span>
                      <span className="text-xs text-[var(--color-body)]">
                        Validity: <strong>{project.packageValidity}</strong>
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-[var(--color-heading)]">
                      {project.instituteName}
                    </h3>
                    
                    <p className="text-xs text-[var(--color-body)]">
                      App Name / Title: <strong className="text-[var(--color-heading)]">{project.appName}</strong>
                    </p>

                    {/* Add-ons badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.addons?.testModule && (
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-md font-medium">Test Module</span>
                      )}
                      {project.addons?.windowApp && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-md font-medium">Windows App</span>
                      )}
                      {project.addons?.iosApp && (
                        <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-md font-medium">iOS App</span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Logo & Files */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {project.logoProof ? (
                      <a
                        href={project.logoProof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-card)] hover:bg-[var(--color-border)] text-[var(--color-heading)] border border-[var(--color-border)] text-center transition-all flex items-center justify-center gap-1.5"
                      >
                        🖼️ View Logo/Asset
                      </a>
                    ) : (
                      <span className="text-[11px] text-[var(--color-body)] italic text-center">No logo uploaded</span>
                    )}

                    <div className="text-[10px] text-[var(--color-body)] text-center">
                      Assigned: {project.assignedAt ? new Date(project.assignedAt).toLocaleDateString("en-IN") : "N/A"}
                    </div>
                  </div>

                  {/* Right: Status Actions */}
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <label className="text-[10px] font-bold text-[var(--color-body)]">Update Status:</label>
                    <select
                      value={project.status}
                      disabled={updatingId === project._id}
                      onChange={(e) => handleUpdateStatus(project._id, e.target.value)}
                      className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                    >
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Testing">Testing</option>
                      <option value="Delivered">Delivered (Done)</option>
                    </select>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TechnicalDashboard;