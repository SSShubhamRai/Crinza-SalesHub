import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export const CallMonitoringTab = ({
  API_BASE,
  employees = [],
}) => {
  // ============================================================
  // 📞 FILTERS
  // ============================================================

  const salespersonList = useMemo(
    () =>
      employees.filter(
        (employee) => employee.role === "salesperson"
      ),
    [employees]
  );

  const [selectedSalesperson, setSelectedSalesperson] =
    useState("");

  const [fromDate, setFromDate] = useState("");

  const [toDate, setToDate] = useState("");

  // ============================================================
  // 📊 DATA
  // ============================================================

  const [analytics, setAnalytics] = useState(null);

  const [callHistory, setCallHistory] = useState([]);

  const [loadingAnalytics, setLoadingAnalytics] =
    useState(false);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [expandedCustomer, setExpandedCustomer] =
    useState(null);

  // ============================================================
  // 🎯 SELECT FIRST SALESPERSON
  // ============================================================

  useEffect(() => {
    if (
      !selectedSalesperson &&
      salespersonList.length > 0
    ) {
      setSelectedSalesperson(
        salespersonList[0].userId
      );
    }
  }, [
    selectedSalesperson,
    salespersonList,
  ]);

  // ============================================================
  // ⏱️ FORMAT DURATION
  // ============================================================

  const formatCallDuration = (seconds = 0) => {
    const totalSeconds = Math.max(
      0,
      Number(seconds) || 0
    );

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
  };

  // ============================================================
  // 📊 FETCH ANALYTICS
  // ============================================================

  const fetchAnalytics = useCallback(
    async () => {
      if (!selectedSalesperson) {
        setAnalytics(null);
        return;
      }

      try {
        setLoadingAnalytics(true);

        const token =
          localStorage.getItem("token");

        const params = new URLSearchParams();

        if (fromDate) {
          params.set("from", fromDate);
        }

        if (toDate) {
          params.set("to", toDate);
        }

        const query = params.toString();

        const url =
          `${API_BASE}/api/boss/salesperson-call-analytics/${selectedSalesperson}` +
          (query ? `?${query}` : "");

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        });

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load call analytics"
          );
        }

        setAnalytics(
          data.analytics || null
        );
      } catch (error) {
        console.error(
          "Admin call analytics error:",
          error
        );

        setAnalytics(null);

        toast.error(
          error.message ||
            "Failed to load call analytics"
        );
      } finally {
        setLoadingAnalytics(false);
      }
    },
    [
      API_BASE,
      selectedSalesperson,
      fromDate,
      toDate,
    ]
  );

  // ============================================================
  // 📞 FETCH CALL HISTORY
  // ============================================================

  const fetchCallHistory =
    useCallback(async () => {
      if (!selectedSalesperson) {
        setCallHistory([]);
        return;
      }

      try {
        setLoadingHistory(true);

        const token =
          localStorage.getItem("token");

        const params = new URLSearchParams();

        if (fromDate) {
          params.set("from", fromDate);
        }

        if (toDate) {
          params.set("to", toDate);
        }

        const query = params.toString();

        const url =
          `${API_BASE}/api/boss/salesperson-call-history/${selectedSalesperson}` +
          (query ? `?${query}` : "");

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        });

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load call history"
          );
        }

        setCallHistory(
          Array.isArray(data.calls)
            ? data.calls
            : []
        );
      } catch (error) {
        console.error(
          "Admin call history error:",
          error
        );

        setCallHistory([]);

        toast.error(
          error.message ||
            "Failed to load call history"
        );
      } finally {
        setLoadingHistory(false);
      }
    }, [
      API_BASE,
      selectedSalesperson,
      fromDate,
      toDate,
    ]);

  // ============================================================
  // 🔄 LOAD DATA
  // ============================================================

  useEffect(() => {
    fetchAnalytics();
    fetchCallHistory();

    setExpandedCustomer(null);
  }, [
    fetchAnalytics,
    fetchCallHistory,
  ]);

  // ============================================================
  // 👤 SELECTED SALESPERSON NAME
  // ============================================================

  const selectedSalespersonName =
    salespersonList.find(
      (employee) =>
        employee.userId ===
        selectedSalesperson
    )?.name ||
    selectedSalesperson ||
    "Select Salesperson";

  // ============================================================
  // 👥 CUSTOMER-WISE GROUPING
  // ============================================================

  const groupedCallHistory = useMemo(() => {
    const groups = {};

    callHistory.forEach((call) => {
      const key =
        call.phoneNumber ||
        call.leadId ||
        call.customerName ||
        "unknown";

      if (!groups[key]) {
        groups[key] = {
          customerName:
            call.customerName ||
            "Unknown Customer",

          phoneNumber:
            call.phoneNumber || "",

          leadId:
            call.leadId || "",

          totalCalls: 0,

          connectedCalls: 0,

          totalDurationSeconds: 0,

          lastCalledAt:
            call.dialedAt || null,

          calls: [],
        };
      }

      groups[key].calls.push(call);

      groups[key].totalCalls += 1;

      if (
        call.status === "CONNECTED" ||
        call.status === "ENDED"
      ) {
        groups[key].connectedCalls += 1;
      }

      groups[key].totalDurationSeconds +=
        Number(call.durationSeconds) || 0;

      if (
        call.dialedAt &&
        (!groups[key].lastCalledAt ||
          new Date(call.dialedAt) >
            new Date(
              groups[key].lastCalledAt
            ))
      ) {
        groups[key].lastCalledAt =
          call.dialedAt;
      }
    });

    return Object.values(groups).sort(
      (a, b) =>
        new Date(b.lastCalledAt || 0) -
        new Date(a.lastCalledAt || 0)
    );
  }, [callHistory]);

  // ============================================================
  // 🎨 STATUS STYLE
  // ============================================================

  const getStatusClass = (status) => {
    switch (status) {
      case "CONNECTED":
        return "bg-green-100 text-green-700";

      case "ENDED":
        return "bg-green-100 text-green-700";

      case "NOT_CONNECTED":
        return "bg-yellow-100 text-yellow-700";

      case "MISSED":
        return "bg-red-100 text-red-700";

      case "REJECTED":
        return "bg-red-100 text-red-700";

      case "FAILED":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // ============================================================
  // 🚫 NO SALESPERSON
  // ============================================================

  if (salespersonList.length === 0) {
    return (
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold text-[var(--color-heading)]">
          📞 Call Monitoring
        </h2>

        <p className="text-sm text-[var(--color-body)] mt-2">
          No salesperson accounts available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ====================================================== */}
      {/* 📞 HEADER + FILTERS */}
      {/* ====================================================== */}

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-sm">

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">

          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--color-heading)]">
              📞 Call Monitoring
            </h2>

            <p className="text-xs text-[var(--color-body)] mt-1">
              Monitor salesperson calling activity,
              conversation time and recordings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchAnalytics();
              fetchCallHistory();
            }}
            className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-semibold"
          >
            🔄 Refresh
          </button>
        </div>

        {/* FILTERS */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">

          <div>
            <label className="block text-xs font-semibold text-[var(--color-body)] mb-1.5">
              Salesperson
            </label>

            <select
              value={selectedSalesperson}
              onChange={(e) =>
                setSelectedSalesperson(
                  e.target.value
                )
              }
              className="w-full px-3 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-heading)] outline-none"
            >
              {salespersonList.map(
                (employee) => (
                  <option
                    key={employee.userId}
                    value={employee.userId}
                  >
                    {employee.name ||
                      employee.userId}{" "}
                    ({employee.userId})
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-body)] mb-1.5">
              From Date
            </label>

            <input
              type="date"
              value={fromDate}
              onChange={(e) =>
                setFromDate(e.target.value)
              }
              className="w-full px-3 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-heading)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-body)] mb-1.5">
              To Date
            </label>

            <input
              type="date"
              value={toDate}
              onChange={(e) =>
                setToDate(e.target.value)
              }
              className="w-full px-3 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-heading)] outline-none"
            />
          </div>

        </div>
      </div>

      {/* ====================================================== */}
      {/* 📊 ANALYTICS */}
      {/* ====================================================== */}

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-sm">

        <div className="flex items-center justify-between mb-5">

          <div>
            <h3 className="text-lg font-bold text-[var(--color-heading)]">
              📊 Call Analytics
            </h3>

            <p className="text-xs text-[var(--color-body)] mt-1">
              {selectedSalespersonName}
            </p>
          </div>

          {(loadingAnalytics ||
            loadingHistory) && (
            <span className="text-xs text-[var(--color-body)]">
              Loading...
            </span>
          )}

        </div>

        {loadingAnalytics && !analytics ? (
          <div className="py-10 text-center text-sm text-[var(--color-body)]">
            Loading call analytics...
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">

            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-body)]">
                Total Dials
              </p>
              <p className="text-2xl font-bold mt-1">
                {analytics.totalDials}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-body)]">
                Unique
              </p>
              <p className="text-2xl font-bold mt-1">
                {analytics.uniqueDials}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-body)]">
                Duplicate
              </p>
              <p className="text-2xl font-bold mt-1">
                {analytics.duplicateDials}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-body)]">
                Connected
              </p>
              <p className="text-2xl font-bold mt-1">
                {analytics.connectedCalls}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-body)]">
                Not Connected
              </p>
              <p className="text-2xl font-bold mt-1">
                {analytics.notConnectedCalls}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-body)]">
                Talk Time
              </p>
              <p className="text-lg font-bold mt-2">
                {formatCallDuration(
                  analytics.totalDurationSeconds
                )}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-body)]">
                Avg. Duration
              </p>
              <p className="text-lg font-bold mt-2">
                {formatCallDuration(
                  analytics.averageDurationSeconds
                )}
              </p>
            </div>

          </div>
        ) : (
          <div className="py-10 text-center text-sm text-[var(--color-body)]">
            No call analytics available.
          </div>
        )}
      </div>

      {/* ====================================================== */}
      {/* 👥 CUSTOMER-WISE HISTORY */}
      {/* ====================================================== */}

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-sm">

        <div className="mb-5">

          <h3 className="text-lg font-bold text-[var(--color-heading)]">
            👥 Customer Call History
          </h3>

          <p className="text-xs text-[var(--color-body)] mt-1">
            {selectedSalespersonName}
          </p>

        </div>

        {loadingHistory ? (
          <div className="py-10 text-center text-sm text-[var(--color-body)]">
            Loading call history...
          </div>
        ) : groupedCallHistory.length ===
          0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-body)]">
            No call history available.
          </div>
        ) : (
          <div className="space-y-3">

            {groupedCallHistory.map(
              (customer) => {

                const customerKey =
                  customer.phoneNumber ||
                  customer.leadId ||
                  customer.customerName;

                const isExpanded =
                  expandedCustomer ===
                  customerKey;

                return (
                  <div
                    key={customerKey}
                    className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
                  >

                    {/* CUSTOMER SUMMARY */}

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCustomer(
                          isExpanded
                            ? null
                            : customerKey
                        )
                      }
                      className="w-full text-left p-4"
                    >

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                        <div className="min-w-0">

                          <div className="flex items-center gap-2">

                            <h4 className="font-bold text-[var(--color-heading)] truncate">
                              {customer.customerName}
                            </h4>

                            <span className="text-xs">
                              {isExpanded
                                ? "▲"
                                : "▼"}
                            </span>

                          </div>

                          <p className="text-xs text-[var(--color-body)] mt-1">
                            {customer.phoneNumber ||
                              "Phone unavailable"}
                          </p>

                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center">

                          <div>
                            <p className="text-xs text-[var(--color-body)]">
                              Calls
                            </p>

                            <p className="font-bold">
                              {customer.totalCalls}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-[var(--color-body)]">
                              Connected
                            </p>

                            <p className="font-bold">
                              {customer.connectedCalls}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-[var(--color-body)]">
                              Talk Time
                            </p>

                            <p className="font-bold">
                              {formatCallDuration(
                                customer.totalDurationSeconds
                              )}
                            </p>
                          </div>

                        </div>

                      </div>
                    </button>

                    {/* INDIVIDUAL CALLS */}

                    {isExpanded && (
                      <div className="border-t border-[var(--color-border)] p-4">

                        <h5 className="text-sm font-bold text-[var(--color-heading)] mb-3">
                          📞 Individual Calls
                        </h5>

                        <div className="space-y-3">

                          {customer.calls
                            .slice()
                            .sort(
                              (a, b) =>
                                new Date(
                                  b.dialedAt
                                ) -
                                new Date(
                                  a.dialedAt
                                )
                            )
                            .map(
                              (
                                call,
                                index
                              ) => (

                                <div
                                  key={
                                    call._id ||
                                    `${customerKey}-${index}`
                                  }
                                  className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]"
                                >

                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                                    {/* DATE */}

                                    <div>
                                      <p className="text-sm font-semibold">
                                        {call.dialedAt
                                          ? new Date(
                                              call.dialedAt
                                            ).toLocaleString(
                                              "en-IN"
                                            )
                                          : "Date unavailable"}
                                      </p>

                                      <p className="text-xs text-[var(--color-body)] mt-1">
                                        📞{" "}
                                        {call.phoneNumber ||
                                          "Phone unavailable"}
                                      </p>
                                    </div>

                                    {/* STATUS */}

                                    <span
                                      className={`inline-flex w-fit px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                                        call.status
                                      )}`}
                                    >
                                      {call.status ||
                                        "UNKNOWN"}
                                    </span>

                                    {/* DURATION */}

                                    <div className="text-left sm:text-right">
                                      <p className="text-xs text-[var(--color-body)]">
                                        Duration
                                      </p>

                                      <p className="font-bold mt-1">
                                        {formatCallDuration(
                                          call.durationSeconds
                                        )}
                                      </p>
                                    </div>

                                  </div>

                                  {/* CONNECTED / ENDED */}

                                  {(call.connectedAt ||
                                    call.endedAt) && (
                                    <div className="mt-3 pt-3 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-2">

                                      <div>
                                        <p className="text-xs text-[var(--color-body)]">
                                          Connected At
                                        </p>

                                        <p className="text-xs font-semibold mt-1">
                                          {call.connectedAt
                                            ? new Date(
                                                call.connectedAt
                                              ).toLocaleString(
                                                "en-IN"
                                              )
                                            : "—"}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-xs text-[var(--color-body)]">
                                          Ended At
                                        </p>

                                        <p className="text-xs font-semibold mt-1">
                                          {call.endedAt
                                            ? new Date(
                                                call.endedAt
                                              ).toLocaleString(
                                                "en-IN"
                                              )
                                            : "—"}
                                        </p>
                                      </div>

                                    </div>
                                  )}

                                  {/* 🎙️ RECORDING */}

                                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">

                                    {call.recordingUrl ? (
                                      <div className="space-y-2">

                                        <p className="text-xs font-semibold text-[var(--color-heading)]">
                                          🎙️ Call Recording
                                        </p>

                                        <audio
                                          controls
                                          preload="metadata"
                                          className="w-full"
                                          src={
                                            call.recordingUrl
                                          }
                                        />

                                      </div>
                                    ) : (
                                      <p className="text-xs text-[var(--color-body)]">
                                        🎙️ No recording uploaded
                                      </p>
                                    )}

                                  </div>

                                </div>
                              )
                            )}

                        </div>
                      </div>
                    )}

                  </div>
                );
              }
            )}

          </div>
        )}
      </div>

    </div>
  );
};

export default CallMonitoringTab;