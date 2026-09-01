import React from "react";

export const LeadsExportTab = ({
  filteredSystemLeads,
  allSystemLeads,
  adminLeadFilter,
  setAdminLeadFilter,
  downloadCSV,
  exportStartDate,
  exportEndDate,
  selectedLeadDateFilter,
  setSelectedLeadDateFilter,
  selectedLeadEmpFilter,
  setSelectedLeadEmpFilter,
  employees,
  loadingSystemLeads,
  API_BASE,
}) => {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm space-y-6 animate-fade-in w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-4 gap-4">
        <div>
          <h3 className="text-base font-bold text-[var(--color-heading)]">
            📊 Leads Report & Excel Export
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-0.5">
            Filter team leads by status, specific employee & date and download
            spreadsheet reports.
          </p>
        </div>
        <button
          onClick={() =>
            downloadCSV(
              filteredSystemLeads,
              `Leads_Report_${adminLeadFilter}_${exportStartDate || "all"}_to_${
                exportEndDate || "all"
              }.csv`,
            )
          }
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 py-3 rounded-2xl font-semibold transition cursor-pointer shadow-sm flex items-center gap-2 active:scale-95 hover:shadow-md"
        >
          📥 Download Excel (.CSV) Report ({filteredSystemLeads.length})
        </button>
      </div>

      {/* 🌟 Filter Container with overflow protection */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] text-xs w-full max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full min-w-0">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="font-medium text-[var(--color-heading)] flex-shrink-0">
              📅 Date:
            </span>
            <input
              type="date"
              value={selectedLeadDateFilter}
              onChange={(e) => setSelectedLeadDateFilter(e.target.value)}
              className="bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-2 rounded-xl text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold w-full sm:w-auto"
            />
            {selectedLeadDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedLeadDateFilter("")}
                className="text-red-500 font-bold hover:underline cursor-pointer flex-shrink-0"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
            <span className="font-medium text-[var(--color-heading)] flex-shrink-0">
              👤 Employee:
            </span>
            {/* 🌟 Fixed Select Width and Truncate */}
            <select
              value={selectedLeadEmpFilter}
              onChange={(e) => setSelectedLeadEmpFilter(e.target.value)}
              className="bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-2 rounded-xl text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold w-full sm:max-w-[220px] md:max-w-[260px] truncate"
            >
              <option value="all">All Employees (Sales & Telecallers)</option>
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

        <div className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-4 py-2 rounded-xl font-extrabold text-xs flex-shrink-0 text-center">
          📊 Total Leads Found: {filteredSystemLeads.length}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setAdminLeadFilter("all")}
          className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition active:scale-95 ${
            adminLeadFilter === "all"
              ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"
          }`}
        >
          All Leads ({allSystemLeads.length})
        </button>
        <button
          onClick={() => setAdminLeadFilter("call-back")}
          className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition active:scale-95 ${
            adminLeadFilter === "call-back"
              ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"
          }`}
        >
          📞 Call Back (
          {
            allSystemLeads.filter(
              (l) =>
                l.leadStatus?.toLowerCase().includes("call") ||
                l.followUpAction?.toLowerCase().includes("call"),
            ).length
          }
          )
        </button>
        <button
          onClick={() => setAdminLeadFilter("next-meeting")}
          className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition active:scale-95 ${
            adminLeadFilter === "next-meeting"
              ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"
          }`}
        >
          🤝 Next Meeting (
          {
            allSystemLeads.filter(
              (l) =>
                l.leadStatus?.toLowerCase().includes("meeting") ||
                l.followUpAction?.toLowerCase().includes("meeting") ||
                l.followUpAction?.toLowerCase().includes("next meeting"),
            ).length
          }
          )
        </button>
        
        <button
          onClick={() => setAdminLeadFilter("demo-done")}
          className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition active:scale-95 ${
            adminLeadFilter === "demo-done"
              ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"
          }`}
        >
          ✅ Demo Done (
          {
            allSystemLeads.filter(
              (l) => l.demoStatus?.toLowerCase() === "completed"
            ).length
          }
          )
        </button>

        <button
            onClick={() => setAdminLeadFilter("demo-pending")}
            className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition active:scale-95 ${
              adminLeadFilter === "demo-pending"
                ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
                : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"
            }`}
          >
            ⏳ Demo Pending (
            {
              allSystemLeads.filter(
                (l) =>
                  !l.leadStatus?.toLowerCase().includes("not interested") &&
                  !l.leadStatus?.toLowerCase().includes("closed") &&
                  (!l.demoStatus ||
                    l.demoStatus?.toLowerCase() === "not given" ||
                    l.demoStatus?.toLowerCase() === "scheduled")
              ).length
            }
            )
          </button>

        <button
          onClick={() => setAdminLeadFilter("not-interested")}
          className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition active:scale-95 ${
            adminLeadFilter === "not-interested"
              ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"
          }`}
        >
          ❌ Not Interested (
          {
            allSystemLeads.filter((l) =>
              l.leadStatus?.toLowerCase().includes("not interested"),
            ).length
          }
          )
        </button>
        <button
          onClick={() => setAdminLeadFilter("deal-closed")}
          className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition active:scale-95 ${
            adminLeadFilter === "deal-closed"
              ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"
          }`}
        >
          🎉 Deal Closed (
          {
            allSystemLeads.filter(
              (l) =>
                l.leadStatus?.toLowerCase().includes("deal close") ||
                l.leadStatus?.toLowerCase().includes("closed"),
            ).length
          }
          )
        </button>
      </div>

      {loadingSystemLeads ? (
        <div className="py-16 text-center text-xs text-[var(--color-body)] animate-pulse">
          Loading all team leads...
        </div>
      ) : filteredSystemLeads.length === 0 ? (
        <div className="py-16 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
          No leads found for this specific date and employee combination.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSystemLeads.map((lead) => {
            const generatedTimestampStr =
              lead.leadDate ||
              (lead.createdAt
                ? new Date(lead.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "N/A");

            return (
              <div
                key={lead._id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl flex flex-col gap-3 text-xs transition hover:border-[var(--color-primary)]/40 overflow-hidden w-full max-w-full"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 w-full">
                  <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
                    <strong className="text-sm text-[var(--color-heading)] font-bold break-words">
                      {lead.instituteName}
                    </strong>
                    <span className="bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0">
                      👤 {lead.salespersonName}
                    </span>
                  </div>

                  <span className="bg-blue-500/10 text-blue-600 border border-blue-500/25 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider flex-shrink-0">
                    {lead.leadStatus || "Active"}
                  </span>
                </div>

                <div className="space-y-1.5 w-full min-w-0">
                  <p className="text-emerald-600 font-semibold flex items-center gap-1">
                    <span>✨ Generated On:</span>{" "}
                    <strong>{generatedTimestampStr}</strong>
                  </p>

                  <p className="text-[var(--color-body)] break-words">
                    👤 Contact: {lead.contactPerson} | 📞{" "}
                    <a
                      href={`tel:${lead.mobileNo}`}
                      className="text-[var(--color-primary)] font-bold"
                    >
                      {lead.mobileNo}
                    </a>
                  </p>
                  
                  <p className="text-[var(--color-heading)] break-words">
                    📍 Location: {lead.city || "N/A"}, {lead.state || "N/A"}
                  </p>

                  {lead.meetingPhoto && (
                    <div className="pt-2 flex items-start gap-3 w-full min-w-0 overflow-hidden">
                      <img
                        src={
                          lead.meetingPhoto.startsWith("http")
                            ? lead.meetingPhoto
                            : `${API_BASE}/${lead.meetingPhoto}`
                        }
                        alt="Meeting Proof"
                        className="w-16 h-16 object-cover rounded-xl border border-[var(--color-border)] shadow-sm bg-black/5 flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            "https://placehold.co/100?text=Preview";
                        }}
                      />
                      <div className="overflow-hidden flex-1 min-w-0">
                        <p className="text-[10px] text-[var(--color-body)] font-mono mb-1 truncate w-full">
                          📸 {lead.meetingPhoto}
                        </p>
                        <a
                          href={
                            lead.meetingPhoto.startsWith("http")
                              ? lead.meetingPhoto
                              : `${API_BASE}/${lead.meetingPhoto}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-[var(--color-primary)] text-white text-[11px] font-semibold px-3 py-1 rounded-lg transition shadow-sm active:scale-95"
                        >
                          🔍 Open Full Image
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};