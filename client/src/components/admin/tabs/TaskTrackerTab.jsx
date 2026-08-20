import React, { useMemo, useState } from "react";

export const TaskTrackerTab = ({
  tasksList,
  employees,
  selectedSalespersonTaskFilter,
  setSelectedSalespersonTaskFilter,
  selectedTaskDateFilter,
  setSelectedTaskDateFilter,
}) => {
  // New state for task type filter ("all", "call", "demo")
  const [selectedTaskTypeFilter, setSelectedTaskTypeFilter] = useState("all");

  const employeeMap = useMemo(() => {
    return new Map(employees.map((emp) => [emp.userId, emp]));
  }, [employees]);

  // Memoize filtered tasks with taskType check included
  const filteredTasksList = useMemo(() => {
    return tasksList.filter((task) => {
      const matchesSalesperson =
        selectedSalespersonTaskFilter === "all" ||
        task.salespersonId === selectedSalespersonTaskFilter;

      const matchesType =
        selectedTaskTypeFilter === "all" ||
        task.taskType?.toLowerCase() === selectedTaskTypeFilter.toLowerCase();

      let matchesDate = true;
      if (selectedTaskDateFilter && task.dueDate) {
        const taskDateOnly = String(task.dueDate).substring(0, 10);
        matchesDate = taskDateOnly === selectedTaskDateFilter;
      }

      return matchesSalesperson && matchesType && matchesDate;
    });
  }, [tasksList, selectedSalespersonTaskFilter, selectedTaskTypeFilter, selectedTaskDateFilter]);

  const salespersonList = useMemo(() => {
    return employees.filter((emp) => emp.role === "salesperson");
  }, [employees]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--color-card)] p-5 rounded-3xl border border-[var(--color-border)] shadow-sm gap-3 transition-all">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-heading)]">
            📞 Salesperson Call, Demo & Follow-up Schedule
          </h3>
          <p className="text-xs text-[var(--color-body)] mt-0.5">
            Monitor scheduled calls and client software demos across your team.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)]">
            <label htmlFor="task-date-filter" className="text-[11px] text-[var(--color-body)] font-medium">
              Date:
            </label>
            <input
              id="task-date-filter"
              type="date"
              value={selectedTaskDateFilter}
              onChange={(e) => setSelectedTaskDateFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold"
            />
            {selectedTaskDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedTaskDateFilter("")}
                className="text-[var(--color-body)] hover:text-red-500 font-bold text-xs ml-1 cursor-pointer"
                aria-label="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>

          {/* Task Type Filter (Call / Demo) */}
          <div className="flex items-center gap-1.5 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)]">
            <label htmlFor="task-type-filter" className="text-[11px] text-[var(--color-body)] font-medium">
              Type:
            </label>
            <select
              id="task-type-filter"
              value={selectedTaskTypeFilter}
              onChange={(e) => setSelectedTaskTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer uppercase font-semibold"
            >
              <option value="all">All Types</option>
              <option value="call">Call</option>
              <option value="demo">Demo</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)]">
            <label htmlFor="salesperson-filter" className="text-[11px] text-[var(--color-body)] font-medium">
              Employee:
            </label>
            <select
              id="salesperson-filter"
              value={selectedSalespersonTaskFilter}
              onChange={(e) => setSelectedSalespersonTaskFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Salespersons</option>
              {salespersonList.map((emp) => (
                <option key={emp.userId} value={emp.userId}>
                  {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Task Grid Section */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[var(--color-heading)]">
          Scheduled Calls & Demos ({filteredTasksList.length})
        </h3>

        {filteredTasksList.length === 0 ? (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-[var(--color-surface)] rounded-full flex items-center justify-center mx-auto text-xl animate-bounce">
              📭
            </div>
            <h3 className="text-sm font-bold text-[var(--color-heading)]">No Tasks Scheduled</h3>
            <p className="text-xs text-[var(--color-body)]">
              There are no matching calls or demos found for the selected filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasksList.map((task) => {
              const empObj = employeeMap.get(task.salespersonId);
              return (
                <div
                  key={task._id}
                  className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-3 hover:border-[var(--color-primary)]/40 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                    <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 px-3 py-1 rounded-xl border border-purple-500/20 uppercase tracking-wider">
                      👤 {empObj?.name ? `${empObj.name} (${task.salespersonId})` : task.salespersonId}
                    </span>
                    <span
                      className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        task.taskType?.toLowerCase() === "demo"
                          ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}
                    >
                      {task.taskType}
                    </span>
                  </div>

                  <div className="text-xs space-y-2 text-[var(--color-heading)]">
                    <p>
                      🏛️ Institute: <strong className="text-sm">{task.instituteName}</strong>
                    </p>
                    {task.dueDate && (
                      <p className="text-emerald-600 font-semibold">
                        📅 Scheduled Date: {new Date(task.dueDate).toLocaleDateString("en-IN")}
                      </p>
                    )}
                    {task.notes && (
                      <p className="text-[var(--color-body)] bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)]">
                        📝 Notes: {task.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};