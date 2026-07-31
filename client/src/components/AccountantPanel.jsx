import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getPendingInvoices,
  approveInvoice,
  updateInvoice,
  rejectInvoice,
} from "../api/api";

const AccountantPanel = ({ userId, onLogout }) => {
  // Tabs State ('pending' | 'history')
  const [activeTab, setActiveTab] = useState("pending");

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Individual Add-on Prices
  const ADDON_PRICES = {
    testModule: 5000,
    windowApp: 5000,
    iosApp: 45000,
  };

  // Base URL for serving static uploaded image files (Fixed for Vite)
  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  const [pendingList, setPendingList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState({
    id: "",
    text: "",
    error: "",
  });

  const [viewModalData, setViewModalData] = useState(null);
  const [editModalData, setEditModalData] = useState(null);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Fetch Pending Invoices
  const fetchPendingInvoices = async () => {
    try {
      const data = await getPendingInvoices();
      setPendingList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch pending error:", err);
      setPendingList([]);
    }
  };

  // Fetch Approved / Processed Invoices History
  const fetchInvoiceHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setHistoryList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Fetch history error:", err);
      setHistoryList([]);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchPendingInvoices(), fetchInvoiceHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered lists logic with safety Array checks
  const filteredPendingList = (Array.isArray(pendingList) ? pendingList : []).filter((item) => {
    return (
      item.instituteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredHistoryList = (Array.isArray(historyList) ? historyList : []).filter((item) => {
    const matchesSearch =
      item.instituteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate total automatically when editing baseAmount, coupon or addons in Edit Modal
  const recalculateEditTotal = (updatedData) => {
    const base = Number(updatedData.baseAmount || 0);
    const addonsObj = updatedData.addons || {};

    let totalAddonCost = 0;
    if (addonsObj.testModule) totalAddonCost += ADDON_PRICES.testModule;
    if (addonsObj.windowApp) totalAddonCost += ADDON_PRICES.windowApp;
    if (addonsObj.iosApp) totalAddonCost += ADDON_PRICES.iosApp;

    // Dynamic discount handling
    let discount = 0;
    if (updatedData.couponCode?.trim().toUpperCase() === "CRINZA") {
      discount = 999;
    } else if (updatedData.couponCode?.trim() === "") {
      discount = 0;
    } else {
      discount = Number(updatedData.discountAmount) || 0;
    }

    const newTotal = Math.max(0, base + totalAddonCost - discount);
    const newDue = Math.max(0, newTotal - Number(updatedData.paidAmount || 0));

    return {
      ...updatedData,
      totalAmount: newTotal,
      dueAmount: newDue,
      discountAmount: discount,
    };
  };

  const handleApprove = async (id) => {
    setActionMessage({
      id,
      text: "Generating PDF & sending email...",
      error: "",
    });
    try {
      const data = await approveInvoice(id);
      toast.success(data.message || "Invoice Approved & Emailed Successfully!");
      setActionMessage({ id, text: "", error: "" });
      fetchPendingInvoices();
      fetchInvoiceHistory();
    } catch (err) {
      const errMsg = err.response?.data?.message || "Approval failed";
      toast.error(errMsg);
      setActionMessage({ id, text: "", error: errMsg });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateInvoice(editModalData._id, editModalData);
      toast.success("Invoice details updated successfully!");
      setEditModalData(null);
      fetchPendingInvoices();
      fetchInvoiceHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update details");
    }
  };

  const handleRejectSubmit = async () => {
    try {
      await rejectInvoice(rejectModalId, rejectReason);
      toast.success("Invoice rejected.");
      setRejectModalId(null);
      setRejectReason("");
      fetchPendingInvoices();
      fetchInvoiceHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject invoice");
    }
  };

  // 📊 Export History to CSV Function
  const exportHistoryToCSV = () => {
    if (!historyList || historyList.length === 0) {
      toast.error("No invoice history available to export!");
      return;
    }

    const formattedData = historyList.map((item) => ({
      InvoiceID: item.invoiceId,
      InstituteName: item.instituteName,
      AppName: item.appName,
      ContactPerson: item.contactPerson || "N/A",
      MobileNo: item.mobileNo,
      Email: item.email,
      City: item.city || "",
      State: item.state || "",
      TotalAmount: item.totalAmount,
      PaidAmount: item.paidAmount,
      DueAmount: item.dueAmount,
      Status: item.status,
      SalespersonID: item.salespersonId,
      CreatedAt: new Date(item.createdAt).toLocaleDateString(),
    }));

    const keys = Object.keys(formattedData[0]);
    let csvContent = keys.join(",") + "\n";

    formattedData.forEach((item) => {
      const row = keys.map((key) => {
        let value = item[key];
        if (value === null || value === undefined) value = "";
        if (typeof value === "string") {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Crinza_Invoice_History_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Invoice history exported successfully!");
  };

  // ⏳ Skeleton Loader Component for Smooth Loading State
  const AccountantSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-6 shadow-sm"
        >
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-6 w-48 bg-[var(--color-surface)] rounded-md"></div>
              <div className="h-5 w-24 bg-[var(--color-surface)] rounded-md"></div>
            </div>
            <div className="h-4 w-72 bg-[var(--color-surface)] rounded-md"></div>
            <div className="flex gap-6 pt-2">
              <div className="h-4 w-20 bg-[var(--color-surface)] rounded-md"></div>
              <div className="h-4 w-20 bg-[var(--color-surface)] rounded-md"></div>
              <div className="h-4 w-20 bg-[var(--color-surface)] rounded-md"></div>
            </div>
          </div>
          <div className="flex flex-col gap-2 justify-center min-w-[220px]">
            <div className="h-9 w-full bg-[var(--color-surface)] rounded-lg"></div>
            <div className="h-9 w-full bg-[var(--color-surface)] rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-5 gap-4">
          <div>
            <span className="text-xs bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full font-semibold border border-emerald-200">
              ACCOUNTANT PANEL
            </span>
            <h1 className="text-2xl font-bold text-[var(--color-heading)] mt-1">
              Invoice Billing & Verification
            </h1>
            <p className="text-[var(--color-body)] text-xs">
              Logged in as:{" "}
              <strong className="text-[var(--color-primary)]">{userId}</strong>
            </p>
          </div>

          <button
            onClick={onLogout}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Logout
          </button>
        </div>

        {/* Navigation Tabs & Export Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${activeTab === "pending" ? "bg-[var(--color-primary)] text-white shadow-md" : "bg-[var(--color-card)] text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}
            >
              ⏳ Pending Verification ({pendingList.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${activeTab === "history" ? "bg-[var(--color-primary)] text-white shadow-md" : "bg-[var(--color-card)] text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}
            >
              📜 Processed / Approved History ({historyList.length})
            </button>
          </div>

          {activeTab === "history" && historyList.length > 0 && (
            <button
              onClick={exportHistoryToCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-2"
            >
              📥 Export History to CSV
            </button>
          )}
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[var(--color-card)] p-4 rounded-2xl border border-[var(--color-border)] shadow-sm">
          <div className="w-full sm:w-80">
            <input
              type="text"
              placeholder="🔍 Search by Institute, ID, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {activeTab === "history" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-[var(--color-body)]">
                Filter Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--color-heading)] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <AccountantSkeleton />
        ) : (
          <>
            {/* TAB 1: PENDING INVOICES */}
            {activeTab === "pending" && (
              <div>
                {filteredPendingList.length === 0 ? (
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-12 text-center text-[var(--color-body)] shadow-sm">
                    🎉 No matching pending invoice requests found!
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredPendingList.map((item) => (
                      <div
                        key={item._id}
                        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-6 shadow-sm"
                      >
                        {/* Details Summary */}
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[var(--color-primary)] font-bold text-lg">
                              {item.instituteName}
                            </span>
                            <span className="text-xs bg-[var(--color-surface)] text-[var(--color-heading)] px-2.5 py-1 rounded-md border border-[var(--color-border)]">
                              ID: {item.invoiceId}
                            </span>
                            <span className="text-xs bg-[var(--color-primary-light)]/20 text-[var(--color-primary-dark)] px-2.5 py-1 rounded-md">
                              Salesperson: {item.salespersonId}
                            </span>
                            {item.couponCode && (
                              <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-md font-semibold border border-emerald-300">
                                🏷️ Coupon: {item.couponCode} (-₹
                                {item.discountAmount || 999})
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-[var(--color-heading)]">
                            App: <strong>{item.appName}</strong> | Email:{" "}
                            {item.email} | Mobile: {item.mobileNo}
                          </p>

                          <div className="flex gap-6 text-sm mt-2">
                            <span className="text-[var(--color-body)]">
                              Total:{" "}
                              <strong className="text-[var(--color-heading)]">
                                ₹{item.totalAmount}
                              </strong>
                            </span>
                            <span className="text-[var(--color-success)]">
                              Paid: <strong>₹{item.paidAmount}</strong>
                            </span>
                            <span className="text-[var(--color-danger)]">
                              Due: <strong>₹{item.dueAmount}</strong>
                            </span>
                          </div>

                          {actionMessage.id === item._id &&
                            actionMessage.text && (
                              <div className="text-xs text-[var(--color-success)] mt-2 font-medium">
                                {actionMessage.text}
                              </div>
                            )}
                          {actionMessage.id === item._id &&
                            actionMessage.error && (
                              <div className="text-xs text-[var(--color-danger)] mt-2 font-medium">
                                {actionMessage.error}
                              </div>
                            )}
                        </div>

                        {/* Actions Section */}
                        <div className="flex flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-[var(--color-border)] pt-4 md:pt-0 md:pl-6 min-w-[220px]">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewModalData(item)}
                              className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-heading)] text-xs py-2 px-3 rounded-lg border border-[var(--color-border)] cursor-pointer"
                            >
                              👁️ Full Details
                            </button>

                            <button
                              onClick={() => setEditModalData(item)}
                              className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-xs py-2 px-3 rounded-lg border border-amber-200 cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                          </div>

                          {item.paymentProof && (
                            <a
                              href={`${API_BASE}/${item.paymentProof}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[var(--color-primary-light)]/20 hover:bg-[var(--color-primary-light)]/30 text-[var(--color-primary-dark)] text-xs py-2 px-3 rounded-lg border border-[var(--color-primary-light)]/40 text-center font-medium"
                            >
                              🖼️ View Payment Proof
                            </a>
                          )}

                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleApprove(item._id)}
                              className="flex-1 bg-[var(--color-success)] hover:opacity-90 text-white font-semibold text-xs py-2.5 rounded-lg transition cursor-pointer shadow-md"
                            >
                              Approve & Send Email
                            </button>

                            <button
                              onClick={() => setRejectModalId(item._id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 font-semibold text-xs py-2.5 px-3 rounded-lg transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PROCESSED & APPROVED HISTORY */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-[var(--color-heading)]">
                  Processed Invoices History
                </h3>

                {filteredHistoryList.length === 0 ? (
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-12 text-center text-[var(--color-body)] shadow-sm">
                    No matching history records found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistoryList.map((item) => (
                      <div
                        key={item._id}
                        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-3"
                      >
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--color-border)] pb-2">
                          <div className="flex items-center gap-3">
                            <strong className="text-[var(--color-primary)] text-md">
                              {item.instituteName} ({item.appName})
                            </strong>
                            <span className="text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded border border-[var(--color-border)] font-mono">
                              #{item.invoiceId}
                            </span>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${item.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-300" : "bg-red-500/10 text-red-500 border border-red-200"}`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-[var(--color-heading)]">
                          <div>
                            📍 <strong>Address:</strong> {item.address || "N/A"}
                            , {item.city || ""}, {item.state || ""}
                          </div>
                          <div>
                            📞 <strong>Contact:</strong> {item.mobileNo} |{" "}
                            {item.email}
                          </div>
                          <div>
                            👤 <strong>Salesperson:</strong>{" "}
                            {item.salespersonId}
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-[var(--color-border)] text-xs">
                          <div className="flex gap-4">
                            <span>
                              Total:{" "}
                              <strong>
                                ₹{item.totalAmount?.toLocaleString("en-IN")}
                              </strong>
                            </span>
                            <span className="text-emerald-600">
                              Paid:{" "}
                              <strong>
                                ₹{item.paidAmount?.toLocaleString("en-IN")}
                              </strong>
                            </span>
                            <span className="text-red-500">
                              Due:{" "}
                              <strong>
                                ₹{item.dueAmount?.toLocaleString("en-IN")}
                              </strong>
                            </span>
                          </div>

                          <button
                            onClick={() => setViewModalData(item)}
                            className="bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] font-medium cursor-pointer"
                          >
                            👁️ View Full Breakdown
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* --- FULL DETAILS MODAL --- */}
        {viewModalData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 text-[var(--color-heading)] space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-lg font-bold text-[var(--color-heading)]">
                  Full Invoice Details
                </h3>
                <button
                  onClick={() => setViewModalData(null)}
                  className="text-[var(--color-body)] hover:text-[var(--color-heading)]"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    Institute
                  </span>{" "}
                  <strong>{viewModalData.instituteName}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    App Name
                  </span>{" "}
                  <strong>{viewModalData.appName}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    Mobile
                  </span>{" "}
                  <strong>{viewModalData.mobileNo}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    Email
                  </span>{" "}
                  <strong>{viewModalData.email}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    Pincode
                  </span>{" "}
                  <strong>{viewModalData.pincode}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    GST No
                  </span>{" "}
                  <strong>{viewModalData.gstNo || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    Validity
                  </span>{" "}
                  <strong>{viewModalData.packageValidity}</strong>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block text-xs">
                    Salesperson ID
                  </span>{" "}
                  <strong>{viewModalData.salespersonId}</strong>
                </div>

                {/* Add-on Packages Display */}
                <div className="col-span-2 bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)] mt-1">
                  <span className="text-[var(--color-body)] block text-xs mb-1 font-medium">
                    Add-on Packages Selected
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {viewModalData.addons?.testModule && (
                      <span className="bg-[var(--color-primary-light)]/20 text-[var(--color-primary-dark)] border border-[var(--color-primary-light)]/40 text-xs px-2.5 py-1 rounded-md font-medium">
                        Test Series Module (+₹5,000)
                      </span>
                    )}
                    {viewModalData.addons?.windowApp && (
                      <span className="bg-[var(--color-primary-light)]/20 text-[var(--color-primary-dark)] border border-[var(--color-primary-light)]/40 text-xs px-2.5 py-1 rounded-md font-medium">
                        Windows Desktop App (+₹5,000)
                      </span>
                    )}
                    {viewModalData.addons?.iosApp && (
                      <span className="bg-[var(--color-primary-light)]/20 text-[var(--color-primary-dark)] border border-[var(--color-primary-light)]/40 text-xs px-2.5 py-1 rounded-md font-medium">
                        iOS Mobile App (+₹45,000)
                      </span>
                    )}
                    {!viewModalData.addons?.testModule &&
                      !viewModalData.addons?.windowApp &&
                      !viewModalData.addons?.iosApp && (
                        <span className="text-[var(--color-body)] text-xs">
                          No Add-ons selected
                        </span>
                      )}
                  </div>
                </div>

                {/* Coupon Code Information */}
                {viewModalData.couponCode && (
                  <div className="col-span-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs flex justify-between items-center text-emerald-600">
                    <span>
                      Applied Coupon Code:{" "}
                      <strong>{viewModalData.couponCode}</strong>
                    </span>
                    <strong>
                      Discount: -₹{viewModalData.discountAmount || 999}
                    </strong>
                  </div>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)] text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span>Base Amount:</span>{" "}
                  <strong>
                    ₹{viewModalData.baseAmount || viewModalData.totalAmount}
                  </strong>
                </div>
                {viewModalData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon Discount:</span>{" "}
                    <strong>-₹{viewModalData.discountAmount}</strong>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--color-border)] pt-1 text-sm font-bold">
                  <span>Total Amount:</span>{" "}
                  <strong>₹{viewModalData.totalAmount}</strong>
                </div>
                <div className="flex justify-between text-[var(--color-success)]">
                  <span>Paid Amount:</span>{" "}
                  <strong>₹{viewModalData.paidAmount}</strong>
                </div>
                <div className="flex justify-between text-[var(--color-danger)] font-semibold">
                  <span>Due Amount:</span>{" "}
                  <strong>₹{viewModalData.dueAmount}</strong>
                </div>
              </div>

              <div>
                <span className="text-[var(--color-body)] block text-xs mb-1">
                  Terms & Conditions
                </span>
                <p className="text-xs bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)] text-[var(--color-body)] whitespace-pre-line">
                  {viewModalData.termsAndConditions}
                </p>
              </div>

              <button
                onClick={() => setViewModalData(null)}
                className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-border)] py-2.5 rounded-xl font-medium text-sm border border-[var(--color-border)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* --- EDIT DETAILS MODAL --- */}
        {editModalData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form
              onSubmit={handleEditSubmit}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-xl w-full p-6 text-[var(--color-heading)] space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-lg font-bold text-[var(--color-heading)]">
                  Edit Request Details
                </h3>
                <button
                  type="button"
                  onClick={() => setEditModalData(null)}
                  className="text-[var(--color-body)] hover:text-[var(--color-heading)]"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    Institute Name
                  </label>
                  <input
                    type="text"
                    value={editModalData.instituteName}
                    onChange={(e) =>
                      setEditModalData({
                        ...editModalData,
                        instituteName: e.target.value,
                      })
                    }
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    App Name
                  </label>
                  <input
                    type="text"
                    value={editModalData.appName}
                    onChange={(e) =>
                      setEditModalData({
                        ...editModalData,
                        appName: e.target.value,
                      })
                    }
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={editModalData.mobileNo}
                    onChange={(e) =>
                      setEditModalData({
                        ...editModalData,
                        mobileNo: e.target.value,
                      })
                    }
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editModalData.email}
                    onChange={(e) =>
                      setEditModalData({
                        ...editModalData,
                        email: e.target.value,
                      })
                    }
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    Base Price (₹)
                  </label>
                  <input
                    type="number"
                    value={
                      editModalData.baseAmount || editModalData.totalAmount
                    }
                    onChange={(e) => {
                      const updated = {
                        ...editModalData,
                        baseAmount: Number(e.target.value),
                      };
                      setEditModalData(recalculateEditTotal(updated));
                    }}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={editModalData.couponCode || ""}
                    placeholder="e.g. CRINZA"
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      const updated = { ...editModalData, couponCode: code };
                      setEditModalData(recalculateEditTotal(updated));
                    }}
                    className="uppercase w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    Total Amount (₹) [Auto]
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={editModalData.totalAmount}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)] font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--color-body)]">
                    Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={editModalData.paidAmount}
                    onChange={(e) => {
                      const paid = Number(e.target.value);
                      const due = Math.max(0, editModalData.totalAmount - paid);
                      setEditModalData({
                        ...editModalData,
                        paidAmount: paid,
                        dueAmount: due,
                      });
                    }}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2 rounded-lg text-[var(--color-heading)]"
                  />
                </div>
              </div>

              {/* Add-ons Checkboxes in Edit Modal */}
              <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
                <label className="block text-xs font-semibold mb-2 text-[var(--color-primary)] uppercase tracking-wider">
                  Modify Add-ons
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[var(--color-heading)]">
                  <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2 rounded-lg border border-[var(--color-border)]">
                    <input
                      type="checkbox"
                      checked={!!editModalData.addons?.testModule}
                      onChange={(e) => {
                        const updatedAddons = {
                          ...editModalData.addons,
                          testModule: e.target.checked,
                        };
                        setEditModalData(
                          recalculateEditTotal({
                            ...editModalData,
                            addons: updatedAddons,
                          }),
                        );
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    <span>Test Module (+₹5k)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2 rounded-lg border border-[var(--color-border)]">
                    <input
                      type="checkbox"
                      checked={!!editModalData.addons?.windowApp}
                      onChange={(e) => {
                        const updatedAddons = {
                          ...editModalData.addons,
                          windowApp: e.target.checked,
                        };
                        setEditModalData(
                          recalculateEditTotal({
                            ...editModalData,
                            addons: updatedAddons,
                          }),
                        );
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    <span>Windows App (+₹5k)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2 rounded-lg border border-[var(--color-border)]">
                    <input
                      type="checkbox"
                      checked={!!editModalData.addons?.iosApp}
                      onChange={(e) => {
                        const updatedAddons = {
                          ...editModalData.addons,
                          iosApp: e.target.checked,
                        };
                        setEditModalData(
                          recalculateEditTotal({
                            ...editModalData,
                            addons: updatedAddons,
                          }),
                        );
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    <span>iOS App (+₹45k)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalData(null)}
                  className="flex-1 bg-[var(--color-surface)] py-2 rounded-xl text-sm border border-[var(--color-border)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] py-2 rounded-xl text-sm font-semibold text-white shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- REJECT REASON MODAL --- */}
        {rejectModalId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 text-[var(--color-heading)] space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-[var(--color-danger)]">
                Reject Invoice Request
              </h3>
              <p className="text-xs text-[var(--color-body)]">
                Specify the reason why this invoice is being rejected:
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Payment screenshot invalid or amount mismatch."
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-sm text-[var(--color-heading)] focus:outline-none focus:border-red-500 h-24"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setRejectModalId(null)}
                  className="flex-1 bg-[var(--color-surface)] py-2.5 rounded-xl text-sm border border-[var(--color-border)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm shadow-md cursor-pointer"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountantPanel;