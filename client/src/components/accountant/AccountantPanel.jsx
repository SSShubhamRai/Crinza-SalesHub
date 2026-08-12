import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

import AccountantHeader from "./AccountantHeader";
import FinancialMetrics from "./FinancialMetrics";
import AccountantFilters from "./AccountantFilters";
import AccountantSkeleton from "./AccountantSkeleton";

// Tabs Import
import PendingInvoicesTab from "./tabs/PendingInvoicesTab";
import HistoryTab from "./tabs/HistoryTab";

// Modals Import
import LogoutModal from "./modals/LogoutModal";
import LightboxModal from "./modals/LightboxModal";
import ViewDetailsModal from "./modals/ViewDetailsModal";
import EditInvoiceModal from "./modals/EditInvoiceModal";
import RejectModal from "./modals/RejectModal";

const AccountantPanel = ({ userId, onLogout }) => {
  const [activeTab, setActiveTab] = useState("pending");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const ADDON_PRICES = {
    testModule: 5000,
    windowApp: 5000,
    iosApp: 45000,
  };

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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    socketRef.current = io(API_BASE, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      if (userId) {
        socketRef.current.emit("register_user", { userId });
      }
    });

    socketRef.current.on("force_logout", (data) => {
      toast.error(data?.message || "Logged in from another device. Logging out...", {
        duration: 6000,
      });
      localStorage.clear();
      if (typeof onLogout === "function") {
        onLogout();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId, API_BASE, onLogout]);

  const fetchPendingInvoices = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const items = Array.isArray(data) ? data : data.invoices || [];
        setPendingList(items);
      } else {
        setPendingList([]);
      }
    } catch (err) {
      setPendingList([]);
    }
  };

  const fetchInvoiceHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/invoices/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const items = Array.isArray(data) ? data : data.invoices || [];
        setHistoryList(items);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
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

  const allSalespersons = Array.from(
    new Set([
      ...pendingList.map((item) => item.salespersonId),
      ...historyList.map((item) => item.salespersonId),
    ])
  ).filter(Boolean);

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

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSalesperson =
      salespersonFilter === "all" || item.salespersonId === salespersonFilter;

    return matchesSearch && matchesStatus && matchesSalesperson;
  });

  const totalPendingValue = pendingList.reduce((acc, item) => acc + Number(item.totalAmount || 0), 0);
  const aiFlaggedCount = pendingList.filter((item) => item.ocrStatus === "YELLOW" || item.ocrStatus === "RED").length;
  const totalApprovedCount = historyList.filter((item) => item.status === "approved").length;

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

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <AccountantHeader userId={userId} onLogoutClick={() => setShowLogoutModal(true)} />

        <FinancialMetrics
          totalPendingValue={totalPendingValue}
          aiFlaggedCount={aiFlaggedCount}
          totalApprovedCount={totalApprovedCount}
        />

        <AccountantFilters
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingList.length}
          historyCount={historyList.length}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          salespersonFilter={salespersonFilter}
          setSalespersonFilter={setSalespersonFilter}
          allSalespersons={allSalespersons}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onExportCSV={exportHistoryToCSV}
        />

        {loading ? (
          <AccountantSkeleton />
        ) : (
          <>
            {activeTab === "pending" && (
              <PendingInvoicesTab
                list={filteredPendingList}
                API_BASE={API_BASE}
                actionMessage={actionMessage}
                onViewDetails={setViewModalData}
                onEditDetails={setEditModalData}
                onOpenLightbox={setLightboxUrl}
                onApprove={handleApprove}
                onRejectPrompt={setRejectModalId}
              />
            )}

            {activeTab === "history" && (
              <HistoryTab list={filteredHistoryList} onViewDetails={setViewModalData} />
            )}
          </>
        )}

        {/* Modals */}
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={() => {
            setShowLogoutModal(false);
            onLogout();
          }}
        />

        <LightboxModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

        <ViewDetailsModal data={viewModalData} onClose={() => setViewModalData(null)} />

        <EditInvoiceModal
          data={editModalData}
          onChange={setEditModalData}
          onSubmit={handleEditSubmit}
          onClose={() => setEditModalData(null)}
          recalculateEditTotal={recalculateEditTotal}
        />

        <RejectModal
          isOpen={!!rejectModalId}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onClose={() => setRejectModalId(null)}
          onSubmit={handleRejectSubmit}
        />
      </div>
    </div>
  );
};

export default AccountantPanel;