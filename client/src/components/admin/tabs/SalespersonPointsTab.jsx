import { useCallback, useEffect, useMemo, useState } from "react";

const SalespersonPointsTab = ({ employees = [] }) => {
  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  // --------------------------------------------------
  // Get the actual salesperson business ID
  // Example: CRZ-001
  // --------------------------------------------------
  const getSalespersonId = useCallback((employee) => {
    if (!employee) return "";

    return (
      employee.employeeId ||
      employee.salespersonId ||
      employee.userId ||
      employee.employeeCode ||
      employee.code ||
      employee._id ||
      ""
    );
  }, []);

  // --------------------------------------------------
  // Salespersons
  // --------------------------------------------------
  const salespersons = useMemo(() => {
    return employees.filter(
      (employee) =>
        String(employee.role || "").toLowerCase() ===
        "salesperson"
    );
  }, [employees]);

  // --------------------------------------------------
  // Selected salesperson
  // --------------------------------------------------
  const [selectedSalesperson, setSelectedSalesperson] =
    useState("");

  // --------------------------------------------------
  // Dates
  // --------------------------------------------------
  const getToday = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(
      2,
      "0"
    );
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const [fromDate, setFromDate] = useState(getToday);
  const [toDate, setToDate] = useState(getToday);

  // --------------------------------------------------
  // API states
  // --------------------------------------------------
  const [pointsData, setPointsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Set first salesperson
  // --------------------------------------------------
  useEffect(() => {
    if (!selectedSalesperson && salespersons.length > 0) {
      const firstSalesperson = salespersons[0];

      const salespersonId =
        getSalespersonId(firstSalesperson);

      console.log(
        "👤 DEFAULT SALESPERSON:",
        salespersonId,
        firstSalesperson
      );

      if (salespersonId) {
        setSelectedSalesperson(salespersonId);
      }
    }
  }, [
    salespersons,
    selectedSalesperson,
    getSalespersonId,
  ]);

  // --------------------------------------------------
  // Fetch salesperson points
  // --------------------------------------------------
  const fetchSalespersonPoints = useCallback(async () => {
    if (!selectedSalesperson) {
      console.log(
        "⚠️ No salesperson selected"
      );

      setPointsData(null);
      return;
    }

    if (!fromDate || !toDate) {
      setError("Please select both dates.");
      return;
    }

    if (fromDate > toDate) {
      setError(
        "From date cannot be greater than To date."
      );
      setPointsData(null);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      console.log("🎯 POINTS API REQUEST:", {
        salespersonId: selectedSalesperson,
        from: fromDate,
        to: toDate,
      });

      const url =
        `${API_BASE}/api/boss/salesperson-points/` +
        `${encodeURIComponent(selectedSalesperson)}` +
        `?from=${encodeURIComponent(fromDate)}` +
        `&to=${encodeURIComponent(toDate)}`;

      console.log("🌐 POINTS API URL:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      console.log(
        "📊 POINTS API RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Request failed with status ${response.status}`
        );
      }

      if (!data.success) {
        throw new Error(
          data?.message ||
            "Failed to fetch salesperson points."
        );
      }

      setPointsData(data);
    } catch (err) {
      console.error(
        "❌ Failed to fetch salesperson points:",
        err
      );

      setError(
        err.message ||
          "Failed to load salesperson points."
      );

      setPointsData(null);
    } finally {
      setLoading(false);
    }
  }, [
    API_BASE,
    selectedSalesperson,
    fromDate,
    toDate,
  ]);

  // --------------------------------------------------
  // Automatically load when salesperson is selected
  // --------------------------------------------------
  useEffect(() => {
    if (selectedSalesperson) {
      fetchSalespersonPoints();
    }
  }, [
    selectedSalesperson,
    fetchSalespersonPoints,
  ]);

  // --------------------------------------------------
  // Today button
  // --------------------------------------------------
  const handleToday = () => {
    const today = getToday();

    setFromDate(today);
    setToDate(today);
  };

  // --------------------------------------------------
  // Apply button
  // --------------------------------------------------
  const handleApply = () => {
    fetchSalespersonPoints();
  };

  // --------------------------------------------------
  // Selected salesperson name
  // --------------------------------------------------
  const selectedEmployee = useMemo(() => {
    return salespersons.find(
      (employee) =>
        getSalespersonId(employee) ===
        selectedSalesperson
    );
  }, [
    salespersons,
    selectedSalesperson,
    getSalespersonId,
  ]);

  // --------------------------------------------------
  // Summary
  // --------------------------------------------------
  const summary = pointsData?.summary || {
    totalPoints: 0,
    workingDays: 0,
    averagePoints: 0,
    targetPerDay: 100,
    targetAchievement: 0,
  };

  // --------------------------------------------------
  // Daily breakdown
  // --------------------------------------------------
  const dailyBreakdown =
    pointsData?.dailyBreakdown || [];

  return (
    <div className="space-y-6">
      {/* ==========================================
          HEADER
      ========================================== */}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-heading)]">
          🎯 Salesperson Points
        </h2>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          View daily and date-range performance points.
        </p>
      </div>

      {/* ==========================================
          FILTER CARD
      ========================================== */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* ----------------------------------------
              SALESPERSON
          ---------------------------------------- */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--color-heading)]">
              Salesperson
            </label>

            <select
              value={selectedSalesperson}
              onChange={(e) => {
                console.log(
                  "👤 SALESPERSON SELECTED:",
                  e.target.value
                );

                setSelectedSalesperson(
                  e.target.value
                );
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-heading)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">
                Select Salesperson
              </option>

              {salespersons.map((employee) => {
                const salespersonId =
                  getSalespersonId(employee);

                if (!salespersonId) return null;

                return (
                  <option
                    key={salespersonId}
                    value={salespersonId}
                  >
                    {employee.name ||
                      employee.fullName ||
                      employee.employeeName ||
                      employee.username ||
                      salespersonId}
                  </option>
                );
              })}
            </select>

            {selectedEmployee && (
              <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                ID: {selectedSalesperson}
              </p>
            )}
          </div>

          {/* ----------------------------------------
              FROM DATE
          ---------------------------------------- */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--color-heading)]">
              From Date
            </label>

            <input
              type="date"
              value={fromDate}
              onChange={(e) =>
                setFromDate(e.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-heading)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* ----------------------------------------
              TO DATE
          ---------------------------------------- */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--color-heading)]">
              To Date
            </label>

            <input
              type="date"
              value={toDate}
              onChange={(e) =>
                setToDate(e.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm text-[var(--color-heading)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* ----------------------------------------
              BUTTONS
          ---------------------------------------- */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="flex-1 rounded-xl border border-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white active:scale-95"
            >
              Today
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={
                loading ||
                !selectedSalesperson
              }
              className="flex-1 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>
      </div>

      {/* ==========================================
          ERROR
      ========================================== */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* ==========================================
          LOADING
      ========================================== */}
      {loading && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">
          Loading salesperson points...
        </div>
      )}

      {/* ==========================================
          SUMMARY CARDS
      ========================================== */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Points */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--color-text-muted)]">
              Total Points
            </p>

            <h3 className="mt-2 text-3xl font-bold text-[var(--color-heading)]">
              {summary.totalPoints || 0}
            </h3>
          </div>

          {/* Working Days */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--color-text-muted)]">
              Working Days
            </p>

            <h3 className="mt-2 text-3xl font-bold text-[var(--color-heading)]">
              {summary.workingDays || 0}
            </h3>
          </div>

          {/* Average */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--color-text-muted)]">
              Average / Day
            </p>

            <h3 className="mt-2 text-3xl font-bold text-[var(--color-heading)]">
              {summary.averagePoints || 0}
            </h3>
          </div>

          {/* Target Achievement */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--color-text-muted)]">
              Target Achievement
            </p>

            <h3 className="mt-2 text-3xl font-bold text-[var(--color-primary)]">
              {summary.targetAchievement || 0}%
            </h3>

            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Target: {summary.targetPerDay || 100}
              /day
            </p>
          </div>
        </div>
      )}

      {/* ==========================================
          DAILY BREAKDOWN
      ========================================== */}
      {!loading && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          {/* Header */}
          <div className="border-b border-[var(--color-border)] p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-heading)]">
                  Daily Points
                </h3>

                {pointsData?.dateRange && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {pointsData.dateRange.from} →{" "}
                    {pointsData.dateRange.to}
                  </p>
                )}
              </div>

              {selectedSalesperson && (
                <span className="rounded-lg bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]">
                  {selectedSalesperson}
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Date
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Status
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Leads
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Revisits
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Demos
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Deals
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Calls
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-[var(--color-heading)]">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {dailyBreakdown.length > 0 ? (
                  dailyBreakdown.map((day) => {
                    const breakdown =
                      day.breakdown || {};

                    return (
                      <tr
                        key={day.date}
                        className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-background)]"
                      >
                        {/* Date */}
                        <td className="px-5 py-4 text-sm font-medium text-[var(--color-heading)]">
                          {day.date}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 text-sm">
                          {day.startedDay ? (
                            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                              Started
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                              Not Started
                            </span>
                          )}
                        </td>

                        {/* Leads */}
                        <td className="px-5 py-4 text-sm text-[var(--color-heading)]">
                          {breakdown.leadsCreated || 0}
                        </td>

                        {/* Revisits */}
                        <td className="px-5 py-4 text-sm text-[var(--color-heading)]">
                          {breakdown.revisits || 0}
                        </td>

                        {/* Demos */}
                        <td className="px-5 py-4 text-sm text-[var(--color-heading)]">
                          {breakdown.demosDone || 0}
                        </td>

                        {/* Deals */}
                        <td className="px-5 py-4 text-sm text-[var(--color-heading)]">
                          {breakdown.dealsClosed || 0}
                        </td>

                        {/* Calls */}
                        <td className="px-5 py-4 text-sm text-[var(--color-heading)]">
                          {(breakdown.callsConnected || 0) +
                            (breakdown.dialCalls || 0)}
                        </td>

                        {/* Total */}
                        <td className="px-5 py-4 text-sm font-bold text-[var(--color-primary)]">
                          {day.totalPoints || 0}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-5 py-12 text-center"
                    >
                      <div className="text-3xl">
                        🎯
                      </div>

                      <p className="mt-2 text-sm font-semibold text-[var(--color-heading)]">
                        No points found
                      </p>

                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        No salesperson activity was
                        recorded for the selected date
                        range.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalespersonPointsTab;