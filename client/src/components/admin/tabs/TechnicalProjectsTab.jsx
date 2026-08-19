import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

export const TechnicalProjectsTab = ({ API_BASE, employees }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);

  // Filter out only technical team members (or all employees if you want to assign to anyone)
  const techEmployees = employees.filter(e => e.role === "technical" || e.role === "admin" || e.role === "boss");

  const fetchAllProjects = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/technical-projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(data);
      } else {
        toast.error(data.message || "Failed to load projects");
      }
    } catch (err) {
      console.error("Error fetching technical projects:", err);
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchAllProjects();
  }, [fetchAllProjects]);

  const handleAssignProject = async (projectId, techId, techName) => {
    if (!techId) {
      toast.error("Please select a valid developer!");
      return;
    }

    setAssigningId(projectId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/technical-projects/assign/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ techId, techName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign project");

      toast.success(data.message || "Project assigned successfully!");
      fetchAllProjects();
    } catch (err) {
      toast.error(err.message || "Error assigning project");
    } finally {
      setAssigningId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Unassigned":
        return "bg-red-500/10 text-red-600 border-red-500/20 animate-pulse";
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
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Header Card */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
            🛠️ PRODUCTION MANAGEMENT
          </span>
          <h2 className="text-xl font-extrabold text-[var(--color-heading)] tracking-tight mt-1">
            Technical App Pipeline & Tracking
          </h2>
          <p className="text-xs text-[var(--color-body)] mt-0.5">
            Manage app production requests generated automatically after accountant invoice approval.
          </p>
        </div>
        <button
          onClick={fetchAllProjects}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-heading)] border border-[var(--color-border)] transition-all cursor-pointer flex items-center gap-2"
        >
          🔄 Refresh List
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] text-[var(--color-body)] font-medium">Total Pipeline</span>
          <h3 className="text-lg font-extrabold text-[var(--color-heading)] mt-0.5">{projects.length}</h3>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] text-[var(--color-body)] font-medium">Unassigned Queue</span>
          <h3 className="text-lg font-extrabold text-red-600 mt-0.5">{projects.filter(p => p.status === "Unassigned").length}</h3>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] text-[var(--color-body)] font-medium">In Production</span>
          <h3 className="text-lg font-extrabold text-amber-600 mt-0.5">{projects.filter(p => p.status === "In Progress" || p.status === "Testing").length}</h3>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] text-[var(--color-body)] font-medium">Successfully Delivered</span>
          <h3 className="text-lg font-extrabold text-emerald-600 mt-0.5">{projects.filter(p => p.status === "Delivered").length}</h3>
        </div>
      </div>

      {/* Projects Table / Cards List */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-[var(--color-heading)]">All Client App Projects</h3>

        {loading ? (
          <div className="py-12 text-center text-[var(--color-body)] animate-pulse">Loading technical production pipeline...</div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-body)] bg-[var(--color-background)] rounded-2xl border border-dashed border-[var(--color-border)]">
            No app production orders found yet. Approve an invoice to generate a project automatically!
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div 
                key={project._id}
                className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-all hover:border-purple-500/40"
              >
                {/* Left details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-purple-600 bg-purple-500/10 px-2.5 py-1 rounded-lg">
                      {project.projectId}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadge(project.status)}`}>
                      {project.status}
                    </span>
                    <span className="text-xs text-[var(--color-body)]">
                      Invoice: <strong className="text-[var(--color-heading)]">#{project.invoiceId}</strong>
                    </span>
                  </div>

                  <h4 className="text-base font-extrabold text-[var(--color-heading)]">
                    {project.instituteName}
                  </h4>

                  <p className="text-xs text-[var(--color-body)]">
                    App Title: <strong className="text-[var(--color-heading)]">{project.appName}</strong> | Validity: <strong>{project.packageValidity}</strong>
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {project.addons?.testModule && <span className="text-[10px] bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-md font-medium">Test Module</span>}
                    {project.addons?.windowApp && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-md font-medium">Windows App</span>}
                    {project.addons?.iosApp && <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-md font-medium">iOS App</span>}
                  </div>
                </div>

                {/* Middle: Logo & Timeline */}
                <div className="flex flex-col gap-2 min-w-[160px]">
                  {project.logoProof ? (
                    <a
                      href={project.logoProof}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-card)] hover:bg-[var(--color-border)] text-[var(--color-heading)] border border-[var(--color-border)] text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      🖼️ View Client Logo
                    </a>
                  ) : (
                    <span className="text-[11px] text-[var(--color-body)] italic text-center">No logo proof</span>
                  )}
                  <div className="text-[10px] text-[var(--color-body)] text-center">
                    Created: {new Date(project.createdAt).toLocaleDateString("en-IN")}
                  </div>
                  {project.deliveredAt && (
                    <div className="text-[10px] text-emerald-600 font-semibold text-center">
                      Delivered: {new Date(project.deliveredAt).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </div>

                {/* Right: Assign Developer Action */}
                <div className="flex flex-col gap-2 w-full lg:w-72 bg-[var(--color-card)] p-3 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[11px] font-bold text-[var(--color-heading)]">
                    Assigned Tech: <span className="text-purple-600">{project.assignedTechName || "None"}</span>
                  </span>
                  
                  <div className="flex gap-2">
                    <select
                      id={`select-${project._id}`}
                      defaultValue={project.assignedTechId || ""}
                      disabled={assigningId === project._id}
                      className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--color-heading)] font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      <option value="">-- Select Developer --</option>
                      {techEmployees.map((emp) => (
                        <option key={emp.userId} value={emp.userId}>
                          {emp.name} ({emp.userId})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        const selectEl = document.getElementById(`select-${project._id}`);
                        const selectedUserId = selectEl.value;
                        const selectedEmp = techEmployees.find(e => e.userId === selectedUserId);
                        const selectedName = selectedEmp ? selectedEmp.name : selectedUserId;
                        handleAssignProject(project._id, selectedUserId, selectedName);
                      }}
                      disabled={assigningId === project._id}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      {assigningId === project._id ? "..." : "Assign"}
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};