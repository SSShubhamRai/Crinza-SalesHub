/**
 * =========================================================================
 * 👤 ACCOUNTANT PANEL COMPONENT (`AccountantPanel.jsx`)
 * =========================================================================
 * Description: Allows accountant to view pending invoice requests, review payment proofs,
 * edit billing/add-ons/payment modes, approve invoices, or reject them.
 * Further Enhanced with: Glassmorphism, Advanced Micro-Animations, & Polish.
 */

import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

const AccountantPanel = ({ userId, onLogout }) => {
  // Tabs State ('pending' | 'history')
  const [activeTab, setActiveTab] = useState("pending");

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");

  // --- 🚪 Logout & Lightbox Modal States ---
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Individual Add-on Prices
  const ADDON_PRICES = {
    testModule: 5000,
    windowApp: 5000,
    iosApp: 45000,
  };

  // Base URL for API & static files (Fixed for Vite)
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

  const socketRef = useRef(null);

  // --- ⌨️ KEYBOARD ESCAPE KEY LISTENER FOR MODALS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setViewModalData(null);
        setEditModalData(null);
        setRejectModalId(null);
        setShowLogoutModal(false);
        setLightboxUrl(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- SOCKET.IO CONNECTION & FORCE LOGOUT LISTENER ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    socketRef.current = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Accountant connected to Socket Server, ID:', socketRef.current.id);
      if (userId) {
        socketRef.current.emit('register_user', { userId });
      }
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    // 🚪 Force Logout Listener for Single Session Enforcement
    socketRef.current.on('force_logout', (data) => {
      toast.error(data?.message || "Logged in from another device. Logging out...", {
        duration: 6000,
      });
      localStorage.clear();
      if (typeof onLogout === 'function') {
        onLogout();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId, API_BASE, onLogout]);

  // Fetch Pending Invoices
  const fetchPendingInvoices = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const items = Array.isArray(data) ? data : (data.invoices || []);
        setPendingList(items);
      } else {
        setPendingList([]);
      }
    } catch (err) {
      console.error("Fetch pending error:", err);
      setPendingList([]);
    }
  };

  // Fetch Invoice History
  const fetchInvoiceHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const items = Array.isArray(data) ? data : (data.invoices || []);
        setHistoryList(items);
      } else {
        setHistoryList([]);
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

  // Unique list of salespersons
  const allSalespersons = Array.from(
    new Set([
      ...pendingList.map((item) => item.salespersonId),
      ...historyList.map((item) => item.salespersonId),
    ])
  ).filter(Boolean);

  // Filtered lists logic
  const filteredPendingList = (Array.isArray(pendingList) ? pendingList : []).filter((item) => {
    const matchesSearch =
      item.instituteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSalesperson =
      salespersonFilter === "all" || item.salespersonId === salespersonFilter;

    return matchesSearch && matchesSalesperson;
  });

  const filteredHistoryList = (Array.isArray(historyList) ? historyList : []).filter((item) => {
    const matchesSearch =
      item.instituteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    const matchesSalesperson =
      salespersonFilter === "all" || item.salespersonId === salespersonFilter;

    return matchesSearch && matchesStatus && matchesSalesperson;
  });

  // --- 📊 FINANCIAL KPI METRIC CALCULATIONS ---
  const totalPendingValue = pendingList.reduce((acc, item) => acc + Number(item.totalAmount || 0), 0);
  const aiFlaggedCount = pendingList.filter((item) => item.ocrStatus === 'YELLOW' || item.ocrStatus === 'RED').length;
  const totalApprovedCount = historyList.filter((item) => item.status === 'approved').length;

  // Recalculate totals in Edit Modal (Including Previous Due Balance)
  const recalculateEditTotal = (updatedData) => {
    const base = Number(updatedData.baseAmount || 0);
    const addonsObj = updatedData.addons || {};
    const prevDue = Number(updatedData.previousDueBalance || 0);

    let totalAddonCost = 0;
    if (addonsObj.testModule) totalAddonCost += ADDON_PRICES.testModule;
    if (addonsObj.windowApp) totalAddonCost += ADDON_PRICES.windowApp;
    if (addonsObj.iosApp) totalAddonCost += ADDON_PRICES.iosApp;

    let discount = 0;
    if (updatedData.couponCode?.trim().toUpperCase() === "CRINZA") {
      discount = 999;
    } else if (updatedData.couponCode?.trim() === "") {
      discount = 0;
    } else {
      discount = Number(updatedData.discountAmount) || 0;
    }

    const newTotal = Math.max(0, base + totalAddonCost - discount + prevDue);
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
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/approve/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed");

      toast.success(data.message || "Invoice Approved & Emailed Successfully!");
      setActionMessage({ id, text: "", error: "" });
      fetchPendingInvoices();
      fetchInvoiceHistory();
    } catch (err) {
      const errMsg = err.message || "Approval failed";
      toast.error(errMsg);
      setActionMessage({ id, text: "", error: errMsg });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/update/${editModalData._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editModalData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update details");

      toast.success("Invoice details updated successfully!");
      setEditModalData(null);
      fetchPendingInvoices();
      fetchInvoiceHistory();
    } catch (err) {
      toast.error(err.message || "Failed to update details");
    }
  };

  const handleRejectSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/reject/${rejectModalId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rejectionReason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject invoice");

      toast.success("Invoice rejected.");
      setRejectModalId(null);
      setRejectReason("");
      fetchPendingInvoices();
      fetchInvoiceHistory();
    } catch (err) {
      toast.error(err.message || "Failed to reject invoice");
    }
  };

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
      PaymentMode: item.paymentMode || "ONLINE",
      UTR_Receipt_Cheque: item.utrNumber || item.receiptNo || item.chequeNo || "N/A",
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

  const AccountantSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 flex flex-col md:flex-row justify-between gap-6 shadow-sm"
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
            <div className="h-9 w-full bg-[var(--color-surface)] rounded-xl"></div>
            <div className="h-9 w-full bg-[var(--color-surface)] rounded-xl"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        
        {/* 🚪 Logout Confirmation Modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in transition-all">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl text-center transform scale-100 animate-in zoom-in-95 duration-200">
              <span className="text-4xl animate-bounce inline-block">⚠️</span>
              <h3 className="text-lg font-extrabold text-[var(--color-heading)]">Confirm Logout</h3>
              <p className="text-xs text-[var(--color-body)]">
                Are you sure you want to log out from the Accountant Panel?
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)]/60 text-[var(--color-heading)] py-3 rounded-xl text-xs font-semibold cursor-pointer border border-[var(--color-border)] transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutModal(false);
                    onLogout();
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs font-semibold cursor-pointer transition shadow-sm active:scale-95"
                >
                  Confirm Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- 🖼️ PAYMENT PROOF LIGHTBOX MODAL --- */}
        {lightboxUrl && (
          <div 
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-fade-in cursor-zoom-out"
          >
            <div className="relative max-w-4xl max-h-[90vh] overflow-auto bg-[var(--color-card)] p-3 rounded-3xl border border-[var(--color-border)] shadow-2xl transition-all transform scale-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-2 px-2 border-b border-[var(--color-border)] mb-2">
                <span className="text-xs font-bold text-[var(--color-heading)]">Payment Proof Verification</span>
                <button 
                  onClick={() => setLightboxUrl(null)}
                  className="w-7 h-7 rounded-full bg-[var(--color-surface)] text-[var(--color-heading)] flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-red-500 hover:text-white transition active:scale-90"
                >
                  ✕
                </button>
              </div>
              <img 
                src={lightboxUrl} 
                alt="Payment Proof Receipt" 
                className="rounded-2xl max-h-[75vh] w-auto object-contain mx-auto transition-transform duration-300 hover:scale-[1.01]"
              />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm gap-4 transition-all duration-300 hover:shadow-md">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              ACCOUNTANT PANEL
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--color-heading)] tracking-tight">
              Invoice Billing & Verification
            </h1>
            <p className="text-[var(--color-body)] text-xs">
              Signed in as <strong className="text-[var(--color-primary)]">{userId}</strong>
            </p>
          </div>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95"
          >
            Logout
          </button>
        </div>

        {/* --- 📊 FINANCIAL KPI SUMMARY CARDS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">Total Pending Value</span>
              <h3 className="text-lg font-extrabold text-[var(--color-heading)] mt-0.5">₹{totalPendingValue.toLocaleString("en-IN")}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">⏳</div>
          </div>

          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">AI Flagged / Warning</span>
              <h3 className="text-lg font-extrabold text-red-500 mt-0.5">{aiFlaggedCount} Invoices</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">⚠️</div>
          </div>

          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">Total Approved Count</span>
              <h3 className="text-lg font-extrabold text-emerald-600 mt-0.5">{totalApprovedCount} Approved</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">✅</div>
          </div>
        </div>

        {/* Navigation Tabs & Export Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-2 p-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-sm">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95 ${
                activeTab === "pending"
                  ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                  : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
              }`}
            >
              ⏳ Pending Verification 
              <span className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${activeTab === "pending" ? "bg-white/20 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)]"}`}>
                {pendingList.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95 ${
                activeTab === "history"
                  ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                  : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
              }`}
            >
              📜 Processed History
              <span className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${activeTab === "history" ? "bg-white/20 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)]"}`}>
                {historyList.length}
              </span>
            </button>
          </div>

          {activeTab === "history" && historyList.length > 0 && (
            <button
              onClick={exportHistoryToCSV}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95 hover:shadow-md"
            >
              📥 Export History to CSV / Excel
            </button>
          )}
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[var(--color-card)] p-4 rounded-3xl border border-[var(--color-border)] shadow-sm items-center transition-all">
          <div className="md:col-span-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Institute Name, ID, or Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl pl-10 pr-4 py-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition-all shadow-inner"
              />
              <span className="absolute left-3.5 top-3.5 text-xs text-[var(--color-body)]">🔍</span>
            </div>
          </div>

          <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)] transition-colors">
              <span className="text-[11px] text-[var(--color-body)] font-medium">Employee:</span>
              <select
                value={salespersonFilter}
                onChange={(e) => setSalespersonFilter(e.target.value)}
                className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Employees</option>
                {allSalespersons.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            {activeTab === "history" && (
              <div className="flex items-center gap-2 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)] transition-colors">
                <span className="text-[11px] text-[var(--color-body)] font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <AccountantSkeleton />
        ) : (
          <>
            {/* TAB 1: PENDING INVOICES */}
            {activeTab === "pending" && (
              <div className="animate-fade-in">
                {filteredPendingList.length === 0 ? (
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
                    <div className="w-12 h-12 bg-[var(--color-surface)] rounded-full flex items-center justify-center mx-auto text-xl animate-bounce">🎉</div>
                    <h3 className="text-sm font-bold text-[var(--color-heading)]">No Pending Verifications</h3>
                    <p className="text-xs text-[var(--color-body)]">All caught up! There are no pending invoice requests matching your filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPendingList.map((item) => (
                      <div
                        key={item._id}
                        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 flex flex-col lg:flex-row justify-between gap-6 shadow-sm hover:border-[var(--color-primary)]/40 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                      >
                        {/* Details Summary */}
                        <div className="space-y-3 flex-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-[var(--color-heading)] font-extrabold text-base">
                              {item.instituteName}
                            </span>
                            <span className="text-[10px] font-mono bg-[var(--color-surface)] text-[var(--color-heading)] px-2.5 py-1 rounded-lg border border-[var(--color-border)]">
                              #{item.invoiceId}
                            </span>
                            <span className="text-[10px] font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2.5 py-1 rounded-lg">
                              Emp: {item.salespersonId}
                            </span>

                            {/* 🌟 PAYMENT MODE BADGE DISPLAY */}
                            {item.paymentMode === 'CASH' ? (
                              <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-500/20">
                                💵 Cash (Voucher: {item.receiptNo || 'N/A'})
                              </span>
                            ) : item.paymentMode === 'CHEQUE' ? (
                              <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 px-2.5 py-1 rounded-lg border border-purple-500/20">
                                🏦 Cheque No: {item.chequeNo || 'N/A'} ({item.bankName || 'Bank'})
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-mono">
                                📱 UPI UTR: {item.utrNumber || 'N/A'}
                              </span>
                            )}

                            {item.couponCode && (
                              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                🏷️ {item.couponCode} (-₹{item.discountAmount || 999})
                              </span>
                            )}
                          </div>

                          {/* 🌟 AI OCR VERIFICATION / MISMATCH WARNING BADGE */}
                          <div className="flex flex-wrap items-center gap-2">
                            {item.ocrStatus === 'GREEN' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                🟢 {item.ocrMessage || "AI Verified: UTR & Amount Matched"}
                              </span>
                            )}
                            {item.ocrStatus === 'YELLOW' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20" title={item.ocrMessage}>
                                ⚠️ {item.ocrMessage || "Mismatch Warning: Data differs from screenshot!"}
                              </span>
                            )}
                            {item.ocrStatus === 'RED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20" title={item.ocrMessage}>
                                🔴 {item.ocrMessage || "Fraud Alert: Duplicate UTR detected!"}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[var(--color-body)]">
                            App: <strong className="text-[var(--color-heading)]">{item.appName}</strong> • Email: {item.email} • Mobile: {item.mobileNo}
                          </p>

                          {/* Financial Pills */}
                          <div className="inline-flex flex-wrap gap-3 bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)] text-xs">
                            <div>
                                <span className="text-[var(--color-body)] text-[10px] block">Total Amount</span>
                                <strong className="text-[var(--color-heading)] text-sm">₹{item.totalAmount?.toLocaleString("en-IN")}</strong>
                            </div>
                            <div className="w-px bg-[var(--color-border)]"></div>
                            <div>
                              <span className="text-[var(--color-body)] text-[10px] block">Paid Amount</span>
                              <strong className="text-emerald-600 text-sm">₹{item.paidAmount?.toLocaleString("en-IN")}</strong>
                            </div>
                            <div className="w-px bg-[var(--color-border)]"></div>
                            <div>
                              <span className="text-[var(--color-body)] text-[10px] block">Due Balance</span>
                              <strong className="text-red-500 text-sm">₹{item.dueAmount?.toLocaleString("en-IN")}</strong>
                            </div>
                          </div>

                          {actionMessage.id === item._id && actionMessage.text && (
                            <div className="text-xs text-[var(--color-primary)] font-medium animate-pulse">
                              ⚡ {actionMessage.text}
                            </div>
                          )}
                          {actionMessage.id === item._id && actionMessage.error && (
                            <div className="text-xs text-red-500 font-medium">
                              ⚠️ {actionMessage.error}
                            </div>
                          )}
                        </div>

                        {/* Actions Section */}
                        <div className="flex flex-col gap-2.5 justify-center border-t lg:border-t-0 lg:border-l border-[var(--color-border)] pt-4 lg:pt-0 lg:pl-6 min-w-[240px]">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setViewModalData(item)}
                              className="bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-heading)] text-xs py-2 px-3 rounded-xl border border-[var(--color-border)] transition-all cursor-pointer font-medium active:scale-95 shadow-xs"
                            >
                              👁️ Full Details
                            </button>
                            <button
                              onClick={() => setEditModalData(item)}
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-xs py-2 px-3 rounded-xl border border-amber-500/20 transition-all cursor-pointer font-medium active:scale-95 shadow-xs"
                            >
                              ✏️ Edit Details
                            </button>
                          </div>

                          {item.paymentProof && (
                            <button
                              onClick={() => setLightboxUrl(`${API_BASE}/${item.paymentProof}`)}
                              className="bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs py-2.5 px-3 rounded-xl border border-[var(--color-primary)]/20 text-center font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                            >
                              🖼️ View Payment Proof
                            </button>
                          )}

                          {/* 📱 Direct WhatsApp Send Button for Accountant */}
                          <a
                            href={`https://api.whatsapp.com/send?phone=${item.mobileNo}&text=${encodeURIComponent(`Hello from Crinza Technologies,\n\nDear ${item.instituteName} Management,\nYour subscription invoice/ledger #${item.invoiceId} for "${item.appName}" has been reviewed.\n\nGrand Total: ₹${item.totalAmount?.toLocaleString('en-IN')}\nPaid: ₹${item.paidAmount?.toLocaleString('en-IN')}\nDue Balance: ₹${item.dueAmount?.toLocaleString('en-IN')}\n\nThank you for choosing us!`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 text-xs py-2.5 px-3 rounded-xl text-center font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                          >
                            📱 Send via WhatsApp
                          </a>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => handleApprove(item._id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-sm text-center active:scale-95"
                            >
                              Approve & Email
                            </button>
                            <button
                              onClick={() => setRejectModalId(item._id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center active:scale-95 shadow-xs"
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
              <div className="space-y-4 animate-fade-in">
                {filteredHistoryList.length === 0 ? (
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
                    <div className="w-12 h-12 bg-[var(--color-surface)] rounded-full flex items-center justify-center mx-auto text-xl animate-bounce">📂</div>
                    <h3 className="text-sm font-bold text-[var(--color-heading)]">No History Records Found</h3>
                    <p className="text-xs text-[var(--color-body)]">There are no approved or rejected invoices matching your criteria.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistoryList.map((item) => (
                      <div
                        key={item._id}
                        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm space-y-3 hover:border-[var(--color-border)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--color-border)] pb-3">
                          <div className="flex items-center gap-3">
                            <strong className="text-[var(--color-heading)] text-sm font-bold">
                              {item.instituteName} <span className="text-[var(--color-body)] font-normal">({item.appName})</span>
                            </strong>
                            <span className="text-[10px] bg-[var(--color-surface)] px-2.5 py-1 rounded-lg border border-[var(--color-border)] font-mono">
                              #{item.invoiceId}
                            </span>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              item.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/25"
                                : "bg-red-500/10 text-red-500 border border-red-500/25"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[var(--color-body)]">
                          <div>
                            📍 <strong>Address:</strong> {item.address || "N/A"}, {item.city || ""}, {item.state || ""}
                          </div>
                          <div>
                            📞 <strong>Contact:</strong> {item.mobileNo} • {item.email}
                          </div>
                          <div>
                            👤 <strong>Salesperson:</strong> {item.salespersonId}
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-[var(--color-border)] text-xs">
                          <div className="flex gap-4">
                            <span>Total: <strong className="text-[var(--color-heading)]">₹{item.totalAmount?.toLocaleString("en-IN")}</strong></span>
                            <span className="text-emerald-600">Paid: <strong>₹{item.paidAmount?.toLocaleString("en-IN")}</strong></span>
                            <span className="text-red-500">Due: <strong>₹{item.dueAmount?.toLocaleString("en-IN")}</strong></span>
                          </div>

                          <button
                            onClick={() => setViewModalData(item)}
                            className="bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-xs px-3.5 py-2 rounded-xl border border-[var(--color-border)] font-medium cursor-pointer transition-all active:scale-95 shadow-xs"
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
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-lg w-full p-6 text-[var(--color-heading)] space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto transform scale-100 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-bold text-[var(--color-heading)]">
                  Full Invoice Details
                </h3>
                <button
                  onClick={() => setViewModalData(null)}
                  className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer transition active:scale-90"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block text-[10px]">Institute</span>
                  <strong className="text-[var(--color-heading)] text-sm">{viewModalData.instituteName}</strong>
                </div>
                <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block text-[10px]">App Name</span>
                  <strong className="text-[var(--color-heading)] text-sm">{viewModalData.appName}</strong>
                </div>
                <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block text-[10px]">Mobile</span>
                  <strong>{viewModalData.mobileNo}</strong>
                </div>
                <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block text-[10px]">Email</span>
                  <strong className="truncate block">{viewModalData.email}</strong>
                </div>
                <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block text-[10px]">Payment Mode</span>
                  <strong>{viewModalData.paymentMode || 'ONLINE'}</strong>
                </div>
                <div className="bg-[var(--color-surface)] p-2.5 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block text-[10px]">
                    {viewModalData.paymentMode === 'CASH' ? 'Receipt No' : viewModalData.paymentMode === 'CHEQUE' ? 'Cheque No' : 'UTR Number'}
                  </span>
                  <strong>{viewModalData.utrNumber || viewModalData.receiptNo || viewModalData.chequeNo || 'N/A'}</strong>
                </div>

                {/* Add-on Packages Display */}
                <div className="col-span-2 bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-body)] block text-[10px] mb-1 font-medium uppercase">
                    Add-on Packages Selected
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {viewModalData.addons?.testModule && (
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs px-2.5 py-1 rounded-xl font-medium">
                        Test Series Module (+₹5,000)
                      </span>
                    )}
                    {viewModalData.addons?.windowApp && (
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs px-2.5 py-1 rounded-xl font-medium">
                        Windows Desktop App (+₹5,000)
                      </span>
                    )}
                    {viewModalData.addons?.iosApp && (
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs px-2.5 py-1 rounded-xl font-medium">
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

                {viewModalData.couponCode && (
                  <div className="col-span-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-xs flex justify-between items-center text-emerald-600 font-medium">
                    <span>Applied Coupon: <strong>{viewModalData.couponCode}</strong></span>
                    <span>Discount: -₹{viewModalData.discountAmount || 999}</span>
                  </div>
                )}
              </div>

              {/* Amount Breakdown */}
              <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--color-body)]">Base Amount:</span>
                  <strong>₹{viewModalData.baseAmount || viewModalData.totalAmount}</strong>
                </div>
                {viewModalData.previousDueBalance > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Previous Due Balance:</span>
                    <strong>+₹{viewModalData.previousDueBalance}</strong>
                  </div>
                )}
                {viewModalData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon Discount:</span>
                    <strong>-₹{viewModalData.discountAmount}</strong>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-sm font-bold">
                  <span>Total Amount:</span>
                  <strong>₹{viewModalData.totalAmount}</strong>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Paid Amount:</span>
                  <strong>₹{viewModalData.paidAmount}</strong>
                </div>
                <div className="flex justify-between text-red-500 font-bold">
                  <span>Due Balance:</span>
                  <strong>₹{viewModalData.dueAmount}</strong>
                </div>
              </div>

              <div>
                <span className="text-[var(--color-body)] block text-xs mb-1 font-medium">Terms & Conditions</span>
                <p className="text-[11px] bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)] text-[var(--color-body)] whitespace-pre-line max-h-24 overflow-y-auto shadow-inner">
                  {viewModalData.termsAndConditions}
                </p>
              </div>

              <button
                onClick={() => setViewModalData(null)}
                className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-border)] py-3 rounded-2xl font-semibold text-xs border border-[var(--color-border)] cursor-pointer transition active:scale-95 shadow-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        )}

        {/* --- EDIT DETAILS MODAL --- */}
        {editModalData && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <form
              onSubmit={handleEditSubmit}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-xl w-full p-6 text-[var(--color-heading)] space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-bold text-[var(--color-heading)]">
                  Edit Invoice Request
                </h3>
                <button
                  type="button"
                  onClick={() => setEditModalData(null)}
                  className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer active:scale-90"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Institute Name</label>
                  <input
                    type="text"
                    value={editModalData.instituteName}
                    onChange={(e) => setEditModalData({ ...editModalData, instituteName: e.target.value })}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">App Name</label>
                  <input
                    type="text"
                    value={editModalData.appName}
                    onChange={(e) => setEditModalData({ ...editModalData, appName: e.target.value })}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={editModalData.mobileNo}
                    onChange={(e) => setEditModalData({ ...editModalData, mobileNo: e.target.value })}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editModalData.email}
                    onChange={(e) => setEditModalData({ ...editModalData, email: e.target.value })}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    value={editModalData.baseAmount || editModalData.totalAmount}
                    onChange={(e) => {
                      const updated = { ...editModalData, baseAmount: Number(e.target.value) };
                      setEditModalData(recalculateEditTotal(updated));
                    }}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Previous Due Balance (₹)</label>
                  <input
                    type="number"
                    value={editModalData.previousDueBalance || 0}
                    onChange={(e) => {
                      const updated = { ...editModalData, previousDueBalance: Number(e.target.value) };
                      setEditModalData(recalculateEditTotal(updated));
                    }}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] font-semibold text-amber-600 focus:outline-none focus:border-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Coupon Code</label>
                  <input
                    type="text"
                    value={editModalData.couponCode || ""}
                    placeholder="e.g. CRINZA"
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      const updated = { ...editModalData, couponCode: code };
                      setEditModalData(recalculateEditTotal(updated));
                    }}
                    className="uppercase w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-mono transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Total Amount (₹) [Auto]</label>
                  <input
                    type="number"
                    readOnly
                    value={editModalData.totalAmount}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] font-bold focus:outline-none opacity-80 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Paid Amount (₹)</label>
                  <input
                    type="number"
                    value={editModalData.paidAmount}
                    onChange={(e) => {
                      const paid = Number(e.target.value);
                      const due = Math.max(0, editModalData.totalAmount - paid);
                      setEditModalData({ ...editModalData, paidAmount: paid, dueAmount: due });
                    }}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-body)] block mb-1">Payment Mode</label>
                  <select
                    value={editModalData.paymentMode || 'ONLINE'}
                    onChange={(e) => setEditModalData({ ...editModalData, paymentMode: e.target.value })}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl text-[var(--color-heading)] transition cursor-pointer"
                  >
                    <option value="ONLINE">ONLINE</option>
                    <option value="CASH">CASH</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>
              </div>

              {/* Add-ons Checkboxes */}
              <div className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-2">
                <label className="block text-[10px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                  Modify Add-ons
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2.5 rounded-xl border border-[var(--color-border)] transition hover:border-[var(--color-primary)]">
                    <input
                      type="checkbox"
                      checked={!!editModalData.addons?.testModule}
                      onChange={(e) => {
                        const updatedAddons = { ...editModalData.addons, testModule: e.target.checked };
                        setEditModalData(recalculateEditTotal({ ...editModalData, addons: updatedAddons }));
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    <span>Test Module (+₹5k)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2.5 rounded-xl border border-[var(--color-border)] transition hover:border-[var(--color-primary)]">
                    <input
                      type="checkbox"
                      checked={!!editModalData.addons?.windowApp}
                      onChange={(e) => {
                        const updatedAddons = { ...editModalData.addons, windowApp: e.target.checked };
                        setEditModalData(recalculateEditTotal({ ...editModalData, addons: updatedAddons }));
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    <span>Windows App (+₹5k)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-[var(--color-card)] p-2.5 rounded-xl border border-[var(--color-border)] transition hover:border-[var(--color-primary)]">
                    <input
                      type="checkbox"
                      checked={!!editModalData.addons?.iosApp}
                      onChange={(e) => {
                        const updatedAddons = { ...editModalData.addons, iosApp: e.target.checked };
                        setEditModalData(recalculateEditTotal({ ...editModalData, addons: updatedAddons }));
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
                  className="flex-1 bg-[var(--color-surface)] py-3 rounded-2xl text-xs font-semibold border border-[var(--color-border)] cursor-pointer transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[var(--color-primary)] hover:opacity-90 py-3 rounded-2xl text-xs font-semibold text-white shadow-sm cursor-pointer transition active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- REJECT REASON MODAL --- */}
        {rejectModalId && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-md w-full p-6 text-[var(--color-heading)] space-y-4 shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200">
              <h3 className="text-base font-bold text-red-500">
                Reject Invoice Request
              </h3>
              <p className="text-xs text-[var(--color-body)]">
                Please specify the reason why this invoice is being rejected. This will be shared with the team:
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Payment screenshot is unclear or amount mismatch."
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-red-500 h-28 transition shadow-inner"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setRejectModalId(null)}
                  className="flex-1 bg-[var(--color-surface)] py-3 rounded-2xl text-xs font-semibold border border-[var(--color-border)] cursor-pointer transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-2xl text-xs shadow-sm cursor-pointer transition active:scale-95"
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