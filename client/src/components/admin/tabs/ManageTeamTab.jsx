import React from "react";

export const ManageTeamTab = ({
  newEmp,
  setNewEmp,
  empStatus,
  handleAddEmployee,
  filteredEmployees,
  employees,
  selectedRoleFilter,
  setSelectedRoleFilter,
  employeeSearch,
  setEmployeeSearch,
  handleViewEmployeeDetails,
  handleDeleteEmployee,
  userId,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
          ➕ Add Team Member
        </h3>
        {empStatus.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3 rounded-2xl text-xs font-semibold animate-fade-in">
            {empStatus.success}
          </div>
        )}
        {empStatus.error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-2xl text-xs font-semibold animate-fade-in">
            {empStatus.error}
          </div>
        )}
        <form onSubmit={handleAddEmployee} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Account Role *</label>
            <select
              value={newEmp.role}
              onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-semibold focus:outline-none focus:border-[var(--color-primary)] transition"
            >
              <option value="salesperson">👤 Salesperson</option>
              <option value="accountant">📑 Accountant</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={newEmp.name}
              onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Email Address *</label>
            <input
              type="email"
              required
              placeholder="e.g. rahul@crinza.com"
              value={newEmp.email}
              onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">WhatsApp Phone No (with Country Code) *</label>
            <input
              type="text"
              required
              placeholder="e.g. +919876543210"
              value={newEmp.phone}
              onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">User ID / Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. EMP105"
              value={newEmp.userId}
              onChange={(e) => setNewEmp({ ...newEmp, userId: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-[var(--color-heading)]">Password *</label>
            <input
              type="text"
              required
              placeholder="e.g. Pass@123"
              value={newEmp.password}
              onChange={(e) => setNewEmp({ ...newEmp, password: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white text-xs font-semibold py-3 rounded-2xl transition cursor-pointer shadow-sm active:scale-95"
          >
            Create Account
          </button>
        </form>
      </div>

      <div className="md:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-border)] pb-4">
          <h3 className="text-base font-bold text-[var(--color-heading)]">
            Active Team Members ({filteredEmployees.length} / {employees.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="salesperson">Salesperson Only</option>
              <option value="accountant">Accountant Only</option>
            </select>

            <input
              type="text"
              placeholder="Search name/ID..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="divide-y divide-[var(--color-border)] max-h-[420px] overflow-y-auto">
          {filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-body)]">
              No team members found matching your search.
            </div>
          ) : (
            filteredEmployees.map((emp) => (
              <div
                key={emp._id}
                className="py-3.5 flex justify-between items-center text-xs transition hover:bg-[var(--color-surface)] px-2 rounded-xl"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-[var(--color-heading)] text-sm font-bold">
                      {emp.name || emp.userId}
                    </strong>
                    <span className="text-[var(--color-body)] font-mono">
                      ({emp.userId})
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                        emp.role === "accountant" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                      }`}
                    >
                      {emp.role}
                    </span>
                  </div>
                  {emp.email && (
                    <p className="text-[var(--color-body)] mt-0.5">
                      {emp.email} {emp.phone ? `| 📱 ${emp.phone}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {emp.role === "salesperson" && (
                    <button
                      onClick={() => handleViewEmployeeDetails(emp.userId)}
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 text-xs px-3.5 py-2 rounded-xl border border-purple-500/20 transition cursor-pointer font-semibold active:scale-95"
                    >
                      👁️ History
                    </button>
                  )}
                  {emp.userId !== userId && (
                    <button
                      onClick={() => handleDeleteEmployee(emp.userId)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs px-3.5 py-2 transition cursor-pointer font-semibold rounded-xl active:scale-95"
                    >
                      ❌ Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};