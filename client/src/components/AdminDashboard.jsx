/**
 * =========================================================================
 * 👑 ADMIN DASHBOARD COMPONENT (`AdminDashboard.jsx`)
 * =========================================================================
 * Description: Allows admin to track live tasks, live location, total distance,
 * manage team, coupons, advanced lead filters, Excel/CSV data export, real-time 
 * Mock Location / Spoofing Security Alerts, and Live Broadcast Announcements.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

const AdminDashboard = ({ userId, onLogout }) => {
  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  const [activeTab, setActiveTab] = useState("tracker");
  const [employees, setEmployees] = useState([]);
  const [performanceStats, setPerformanceStats] = useState([]);
  const [tasksList, setTasksList] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- 🚪 Logout Confirmation Modal State ---
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // 🔍 Search & Filter States
  const [directorySearch, setDirectorySearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedSalespersonTaskFilter, setSelectedSalespersonTaskFilter] = useState("all");

  // 🌟 Advanced Lead Filter & Export States for Admin
  const [adminLeadFilter, setAdminLeadFilter] = useState("all");
  const [allSystemLeads, setAllSystemLeads] = useState([]);
  const [loadingSystemLeads, setLoadingSystemLeads] = useState(false);

  const [selectedEmpLogs, setSelectedEmpLogs] = useState(null);
  const [loadingLogs, setLoadingLoadingLogs] = useState(false);

  // 🔄 Single Deal Transfer Popup States
  const [transferModalDeal, setTransferModalDeal] = useState(null);
  const [targetSalesperson, setTargetSalesperson] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // 🛰️ LIVE TRACKING & TRAVEL HISTORY STATES
  const [selectedTrackerEmp, setSelectedTrackerEmp] = useState("");
  const [trackerDate, setTrackerDate] = useState(new Date().toISOString().split('T')[0]); // 📅 Date picker state for past days
  const [travelData, setTravelData] = useState({ totalDistanceKm: 0, routePoints: [] });
  const [liveLocations, setLiveLocations] = useState({});
  const [resolvedAddresses, setResolvedAddresses] = useState({}); // 🏷️ Cache for Place Names

  // 🚨 Security & Spoofing Alerts State
  const [spoofingAlerts, setSpoofingAlerts] = useState([]);

  // 📢 Team Broadcast Messaging States
  const [broadcastMsg, setBroadcastMsg] = useState({ title: "", message: "", priority: "normal" });
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const socketRef = useRef(null);

  // New Employee Form State
  const [newEmp, setNewEmp] = useState({
    userId: "",
    name: "",
    email: "",
    password: "",
    role: "salesperson",
  });
  const [empStatus, setEmpStatus] = useState({ success: "", error: "" });

  // 🔄 Granular Transfer States
  const [transferData, setTransferData] = useState({
    fromSalesperson: "",
    toSalesperson: "",
  });
  const [transferStatus, setTransferStatus] = useState({
    success: "",
    error: "",
  });
  const [sourceLeads, setSourceLeads] = useState([]);
  const [loadingSourceLeads, setLoadingSourceLeads] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // 🎫 Coupon Generator State
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    expiryDate: "",
    usageLimit: "",
  });
  const [couponStatus, setCouponStatus] = useState({ success: "", error: "" });

  // --- SOCKET.IO CONNECTION ---
  useEffect(() => {
    socketRef.current = io(API_BASE, {
      auth: { token: localStorage.getItem("token") }
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Admin connected to Live Tracking Socket');
    });

    socketRef.current.on('live_location_broadcast', (data) => {
      setLiveLocations((prev) => ({
        ...prev,
        [data.salespersonId]: {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp
        }
      }));
    });

    // 🌟 Real-time Spoofing Alert Listener
    socketRef.current.on('spoofing_alert', (data) => {
      toast.error(`🚨 Security Alert: ${data.salespersonId} used Mock Location / Fake GPS!`, { duration: 6000 });
      setSpoofingAlerts((prev) => [data, ...prev]);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [API_BASE]);

  // --- FETCH TRAVEL HISTORY WITH DATE SUPPORT ---
  const fetchSalespersonTravelHistory = useCallback(async (empId, dateVal) => {
    if (!empId) return;
    try {
      const token = localStorage.getItem("token");
      const targetDate = dateVal || trackerDate;
      const res = await fetch(`${API_BASE}/api/boss/salesperson-travel/${empId}?date=${targetDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTravelData(data);
      }
    } catch (err) {
      console.error("Failed to fetch travel history:", err);
    }
  }, [API_BASE, trackerDate]);

  const fetchAllSystemLeads = useCallback(async () => {
    setLoadingSystemLeads(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const empRes = await fetch(`${API_BASE}/api/boss/employees`, { headers });
      const empList = await empRes.json();
      
      let collectedLeads = [];
      for (let emp of empList.filter(e => e.role === 'salesperson')) {
        const leadRes = await fetch(`${API_BASE}/api/boss/employee-leads/${emp.userId}`, { headers });
        if (leadRes.ok) {
          const lData = await leadRes.json();
          collectedLeads = [...collectedLeads, ...lData.map(l => ({ ...l, salespersonName: emp.name || emp.userId }))];
        }
      }
      setAllSystemLeads(collectedLeads);
    } catch (err) {
      console.error("Failed to fetch system leads:", err);
      toast.error("Failed to load leads data");
    } finally {
      setLoadingSystemLeads(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    if (activeTab === "live-tracking" && selectedTrackerEmp) {
      fetchSalespersonTravelHistory(selectedTrackerEmp, trackerDate);
    }
    if (activeTab === "leads-export") {
      fetchAllSystemLeads();
    }
  }, [selectedTrackerEmp, trackerDate, activeTab, fetchSalespersonTravelHistory, fetchAllSystemLeads]);

  // 🗺️ Helper to convert Lat/Lng to Place Name with Rate-Limit & Resource Protection
  const resolvePlaceName = async (lat, lon, pointKey) => {
    if (resolvedAddresses[pointKey]) return; 
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      const res = await fetch(`${API_BASE}/api/boss/reverse-geocode?lat=${lat}&lon=${lon}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (res.ok && data.displayName) {
        const shortAddr = data.displayName.split(',').slice(0, 3).join(',');
        setResolvedAddresses((prev) => ({ ...prev, [pointKey]: shortAddr }));
      } else {
        setResolvedAddresses((prev) => ({ ...prev, [pointKey]: `GPS Point (${lat.toFixed(3)}, ${lon.toFixed(3)})` }));
      }
    } catch (err) {
      setResolvedAddresses((prev) => ({ ...prev, [pointKey]: `GPS Point (${lat.toFixed(3)}, ${lon.toFixed(3)})` }));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const empRes = await fetch(`${API_BASE}/api/boss/employees`, { headers });
      const empList = await empRes.json();
      setEmployees(empList);

      const statsRes = await fetch(`${API_BASE}/api/boss/performance`, { headers });
      const stats = await statsRes.json();
      setPerformanceStats(stats);

      const tasksRes = await fetch(`${API_BASE}/api/boss/tasks`, { headers });
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasksList(tasksData);
      }

      const couponRes = await fetch(`${API_BASE}/api/boss/coupons`, { headers });
      if (couponRes.ok) {
        const couponList = await couponRes.json();
        setCoupons(couponList);
      }
    } catch (err) {
      console.error("Failed to fetch Admin Data:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const downloadCSV = (dataToExport, filename = "Leads_Report.csv") => {
    if (!dataToExport || dataToExport.length === 0) {
      toast.error("No data available to export!");
      return;
    }

    const headers = ["Institute Name", "Contact Person", "Mobile No", "Email", "City", "State", "Lead Status", "Demo Status", "Follow-up Action", "Salesperson"];
    const rows = dataToExport.map(l => [
      `"${l.instituteName || ''}"`,
      `"${l.contactPerson || ''}"`,
      `"${l.mobileNo || ''}"`,
      `"${l.email || ''}"`,
      `"${l.city || ''}"`,
      `"${l.state || ''}"`,
      `"${l.leadStatus || 'Active'}"`,
      `"${l.demoStatus || 'Not Given'}"`,
      `"${l.followUpAction || 'N/A'}"`,
      `"${l.salespersonName || l.salespersonId || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel/CSV Report downloaded successfully!");
  };

  const handleViewEmployeeDetails = async (empUserId) => {
    setLoadingLoadingLogs(true);
    setSelectedEmpLogs({ userId: empUserId, deals: [] });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/api/boss/employee-details/${empUserId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const dealsData = await res.json();
      setSelectedEmpLogs({ userId: empUserId, deals: dealsData });
    } catch (err) {
      console.error("Error fetching employee logs:", err);
      toast.error("Failed to fetch activity logs");
    } finally {
      setLoadingLoadingLogs(false);
    }
  };

  const handleExecuteSingleDealTransfer = async () => {
    if (!targetSalesperson) {
      toast.error("Please select a salesperson!");
      return;
    }

    setIsTransferring(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/transfer-single-deal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          dealId: transferModalDeal._id, 
          newSalespersonId: targetSalesperson 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to transfer deal");

      toast.success(data.message || "Deal transferred successfully!");
      setTransferModalDeal(null);
      setTargetSalesperson("");
      handleViewEmployeeDetails(selectedEmpLogs.userId);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Error transferring deal");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setEmpStatus({ success: "", error: "" });

    if (!newEmp.name.trim() || !newEmp.email.trim()) {
      setEmpStatus({ success: "", error: "Name and Email are required!" });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/auth/create-employee`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newEmp),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Creation failed");

      const successMsg = `${newEmp.role === "accountant" ? "Accountant" : "Salesperson"} ${newEmp.name} created successfully!`;
      toast.success(successMsg);
      setEmpStatus({ success: successMsg, error: "" });
      setNewEmp({
        userId: "",
        name: "",
        email: "",
        password: "",
        role: "salesperson",
      });
      fetchData();
    } catch (err) {
      toast.error(err.message);
      setEmpStatus({ success: "", error: err.message });
    }
  };

  const handleDeleteEmployee = async (empUserId) => {
    const targetEmp = employees.find((e) => e.userId === empUserId);
    if (!targetEmp) {
      toast.error("Employee database record not found for deletion!");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove user "${empUserId}"?`))
      return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/delete-employee/${targetEmp._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(`Account ${empUserId} removed!`);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  // 📢 Broadcast Message Handler
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.title.trim() || !broadcastMsg.message.trim()) {
      toast.error("Please provide both a title and message!");
      return;
    }

    setIsBroadcasting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(broadcastMsg),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send broadcast");

      toast.success("Broadcast message sent to all active team members!");
      setBroadcastMsg({ title: "", message: "", priority: "normal" });
    } catch (err) {
      toast.error(err.message || "Error sending broadcast");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const fetchSalespersonLeadsForTransfer = async (empId) => {
    setLoadingSourceLeads(true);
    setSelectedLeadIds([]);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/employee-details/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSourceLeads(data || []);
    } catch (err) {
      console.error("Failed to load leads for transfer:", err);
      toast.error("Failed to load salesperson leads");
    } finally {
      setLoadingSourceLeads(false);
    }
  };

  const handleToggleLeadSelection = (leadId) => {
    if (selectedLeadIds.includes(leadId)) {
      setSelectedLeadIds(selectedLeadIds.filter((id) => id !== leadId));
    } else {
      setSelectedLeadIds([...selectedLeadIds, leadId]);
    }
  };

  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === sourceLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(sourceLeads.map((l) => l._id));
    }
  };

  const handleExecuteGranularTransfer = async (e) => {
    e.preventDefault();
    if (transferData.fromSalesperson === transferData.toSalesperson) {
      setTransferStatus({
        success: "",
        error: "Select two different Salespersons to transfer!",
      });
      return;
    }
    if (!transferData.toSalesperson) {
      setTransferStatus({ success: "", error: "Please select a Target Salesperson!" });
      return;
    }
    if (selectedLeadIds.length === 0) {
      setTransferStatus({ success: "", error: "Please select at least one lead to transfer!" });
      return;
    }

    setTransferStatus({ success: "", error: "" });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/transfer-selected-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          toSalesperson: transferData.toSalesperson,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Transfer failed");

      toast.success(data.message || "Leads transferred successfully!");
      setTransferStatus({ success: data.message || "Leads transferred successfully!", error: "" });
      setSelectedLeadIds([]);
      setSourceLeads([]);
      setTransferData({ fromSalesperson: "", toSalesperson: "" });
      fetchData();
    } catch (err) {
      toast.error(err.message);
      setTransferStatus({ success: "", error: err.message });
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setCouponStatus({ success: "", error: "" });

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/create-coupon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCoupon),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate coupon");

      const successMsg = `Coupon "${newCoupon.code.toUpperCase()}" generated successfully!`;
      toast.success(successMsg);
      setCouponStatus({ success: successMsg, error: "" });
      setNewCoupon({
        code: "",
        discountType: "percentage",
        discountValue: "",
        expiryDate: "",
        usageLimit: "",
      });
      fetchData();
    } catch (err) {
      toast.error(err.message);
      setCouponStatus({ success: "", error: err.message });
    }
  };

  const handleDeleteCoupon = async (couponId, couponCode) => {
    if (
      !window.confirm(`Are you sure you want to delete coupon "${couponCode}"?`)
    )
      return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/coupons/${couponId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete coupon");

      toast.success(`Coupon ${couponCode} deleted successfully!`);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to delete coupon");
    }
  };

  const filteredDirectoryStats = performanceStats.filter((stat) => {
    const query = directorySearch.toLowerCase();
    const id = stat.salespersonId ? stat.salespersonId.toLowerCase() : "unassigned";
    const matchingEmp = employees.find((e) => e.userId?.toLowerCase() === id);
    const name = matchingEmp && matchingEmp.name ? matchingEmp.name.toLowerCase() : "";

    return id.includes(query) || name.includes(query);
  });

  const filteredEmployees = employees.filter((emp) => {
    const query = employeeSearch.toLowerCase();
    const nameMatch = emp.name && emp.name.toLowerCase().includes(query);
    const idMatch = emp.userId && emp.userId.toLowerCase().includes(query);
    const emailMatch = emp.email && emp.email.toLowerCase().includes(query);
    
    const matchesSearch = nameMatch || idMatch || emailMatch;
    const matchesRole = selectedRoleFilter === "all" || emp.role === selectedRoleFilter;

    return matchesSearch && matchesRole;
  });

  const filteredTasksList = tasksList.filter((task) => {
    if (selectedSalespersonTaskFilter === "all") return true;
    return task.salespersonId === selectedSalespersonTaskFilter;
  });

  const filteredSystemLeads = allSystemLeads.filter((lead) => {
    const lStatus = lead.leadStatus?.toLowerCase() || "";
    const fAction = lead.followUpAction?.toLowerCase() || "";

    if (adminLeadFilter === "all") return true;
    if (adminLeadFilter === "call-back") {
      return lStatus.includes("call") || fAction.includes("call");
    }
    if (adminLeadFilter === "next-meeting") {
      return lStatus.includes("meeting") || fAction.includes("meeting") || fAction.includes("next meeting");
    }
    if (adminLeadFilter === "not-interested") {
      return lStatus.includes("not interested");
    }
    if (adminLeadFilter === "deal-closed") {
      return lStatus.includes("deal close") || lStatus.includes("closed");
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 🚪 Logout Confirmation Modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl text-center">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-lg font-extrabold text-[var(--color-heading)]">Confirm Logout</h3>
              <p className="text-xs text-[var(--color-body)]">
                Are you sure you want to log out from the Admin Portal?
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)]/50 text-[var(--color-heading)] py-3 rounded-xl text-xs font-semibold cursor-pointer border border-[var(--color-border)] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutModal(false);
                    onLogout();
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs font-semibold cursor-pointer transition shadow-sm"
                >
                  Confirm Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
              ADMIN PORTAL
            </span>
            <h1 className="text-2xl font-extrabold text-[var(--color-heading)] tracking-tight mt-1">
              CRINZA ONE
            </h1>
            <p className="text-[var(--color-body)] text-xs">
              Logged in as Admin: <strong className="text-[var(--color-primary)]">{userId}</strong>
            </p>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition cursor-pointer flex items-center gap-2"
          >
            Logout
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex gap-2 p-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab("tracker")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "tracker" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            📋 Task Tracker
          </button>
          <button
            onClick={() => setActiveTab("live-tracking")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "live-tracking" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            🛰️ Live Tracking & Travel
          </button>
          <button
            onClick={() => setActiveTab("security-alerts")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap relative ${
              activeTab === "security-alerts" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            🚨 Security & Spoofing {spoofingAlerts.length > 0 && <span className="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-extrabold animate-pulse">{spoofingAlerts.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab("broadcast")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "broadcast" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            📢 Team Broadcast
          </button>
          <button
            onClick={() => setActiveTab("leads-export")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "leads-export" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            📊 Leads Report & Excel Export
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "directory" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            👥 Team Directory & Deals
          </button>
          <button
            onClick={() => setActiveTab("employees")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "employees" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            ➕ Manage Team
          </button>
          <button
            onClick={() => setActiveTab("transfer")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "transfer" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            🔄 Transfer Leads
          </button>
          <button
            onClick={() => setActiveTab("coupons")}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer whitespace-nowrap ${
              activeTab === "coupons" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
            }`}
          >
            🎟️ Discount Coupons
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-[var(--color-card)] rounded-3xl border border-[var(--color-border)]"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-40 bg-[var(--color-card)] rounded-3xl border border-[var(--color-border)]"></div>
              <div className="h-40 bg-[var(--color-card)] rounded-3xl border border-[var(--color-border)]"></div>
              <div className="h-40 bg-[var(--color-card)] rounded-3xl border border-[var(--color-border)]"></div>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: TASK TRACKER */}
            {activeTab === "tracker" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--color-card)] p-5 rounded-3xl border border-[var(--color-border)] shadow-sm gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-heading)]">
                      📞 Salesperson Call, Demo & Follow-up Schedule
                    </h3> 
                    <p className="text-xs text-[var(--color-body)] mt-0.5">
                      Monitor scheduled calls and client software demos across your team.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-[var(--color-surface)] px-3 py-1.5 rounded-2xl border border-[var(--color-border)] w-full sm:w-auto">
                    <span className="text-[11px] text-[var(--color-body)] font-medium">Employee:</span>
                    <select
                      value={selectedSalespersonTaskFilter}
                      onChange={(e) => setSelectedSalespersonTaskFilter(e.target.value)}
                      className="bg-transparent text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Salespersons</option>
                      {employees
                        .filter((emp) => emp.role === "salesperson")
                        .map((emp) => (
                          <option key={emp.userId} value={emp.userId}>
                            {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-bold text-[var(--color-heading)]">
                    Scheduled Calls & Demos ({filteredTasksList.length})
                  </h3>

                  {filteredTasksList.length === 0 ? (
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
                      <div className="w-12 h-12 bg-[var(--color-surface)] rounded-full flex items-center justify-center mx-auto text-xl">📭</div>
                      <h3 className="text-sm font-bold text-[var(--color-heading)]">No Tasks Scheduled</h3>
                      <p className="text-xs text-[var(--color-body)]">There are no active calls or demos scheduled by salespersons yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredTasksList.map((task) => {
                        const empObj = employees.find((e) => e.userId === task.salespersonId);
                        return (
                          <div
                            key={task._id}
                            className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-3 hover:border-[var(--color-primary)]/40 transition"
                          >
                            <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                              <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 px-3 py-1 rounded-xl border border-purple-500/20 uppercase tracking-wider">
                                👤 {empObj?.name ? `${empObj.name} (${task.salespersonId})` : task.salespersonId}
                              </span>
                              <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                                task.taskType === 'demo' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              }`}>
                                {task.taskType}
                              </span>
                            </div>

                            <div className="text-xs space-y-2 text-[var(--color-heading)]">
                              <p>🏛️ Institute: <strong className="text-sm">{task.instituteName}</strong></p>
                              {task.dueDate && (
                                <p className="text-emerald-600 font-semibold">
                                  📅 Scheduled Date: {new Date(task.dueDate).toLocaleDateString('en-IN')}
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
            )}

            {/* TAB 1.5: LIVE TRACKING & TRAVEL HISTORY */}
            {activeTab === "live-tracking" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--color-card)] p-5 rounded-3xl border border-[var(--color-border)] shadow-sm gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-heading)]">
                      🛰️ Salesperson Live Location & Travel History
                    </h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">
                      View live position, select past dates, total distance, and exact place names.
                    </p>
                  </div>

                  {/* Controls: Date Picker & Employee Selector */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                      type="date"
                      value={trackerDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        setTrackerDate(e.target.value);
                        if (selectedTrackerEmp) {
                          fetchSalespersonTravelHistory(selectedTrackerEmp, e.target.value);
                        }
                      }}
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold"
                    />

                    <select
                      value={selectedTrackerEmp}
                      onChange={(e) => {
                        setSelectedTrackerEmp(e.target.value);
                        if (e.target.value) {
                          fetchSalespersonTravelHistory(e.target.value, trackerDate);
                        }
                      }}
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl text-xs text-[var(--color-heading)] focus:outline-none cursor-pointer font-semibold"
                    >
                      <option value="">-- Choose Salesperson --</option>
                      {employees
                        .filter((emp) => emp.role === "salesperson")
                        .map((emp) => (
                          <option key={emp.userId} value={emp.userId}>
                            {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {!selectedTrackerEmp ? (
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-16 text-center space-y-3 shadow-sm">
                    <span className="text-3xl">📍</span>
                    <h3 className="text-sm font-bold text-[var(--color-heading)]">No Salesperson Selected</h3>
                    <p className="text-xs text-[var(--color-body)]">Please choose a salesperson from the dropdown above to view their live GPS status and travel report.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4">
                      <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">🟢 Live GPS Status</h4>
                      {liveLocations[selectedTrackerEmp] ? (
                        <div className="space-y-3 text-xs text-[var(--color-heading)]">
                          <p>Lat/Lng: <strong className="font-mono">{liveLocations[selectedTrackerEmp].latitude.toFixed(4)}, {liveLocations[selectedTrackerEmp].longitude.toFixed(4)}</strong></p>
                          <p className="text-[var(--color-body)]">Last Ping: {new Date(liveLocations[selectedTrackerEmp].timestamp).toLocaleTimeString('en-IN')}</p>
                          <a
                            href={`https://www.google.com/maps?q=${liveLocations[selectedTrackerEmp].latitude},${liveLocations[selectedTrackerEmp].longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition shadow-sm"
                          >
                            🗺️ Open Live Position on Map
                          </a>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                          Waiting for continuous live GPS ping from app...
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                      <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                        <h4 className="text-sm font-bold text-[var(--color-heading)]">🛣️ Travel Summary for {trackerDate}</h4>
                        <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-xl font-extrabold text-xs">
                          Total Distance: {travelData.totalDistanceKm || 0} KM
                        </span>
                      </div>

                      <p className="text-xs text-[var(--color-body)]">
                        Route history logged: <strong>{travelData.routePoints?.length || 0}</strong> coordinate pings recorded.
                      </p>

                      <div className="max-h-64 overflow-y-auto space-y-2 border border-[var(--color-border)] p-3 rounded-2xl bg-[var(--color-surface)] text-xs">
                        {travelData.routePoints?.length === 0 ? (
                          <div className="py-8 text-center text-[var(--color-body)]">No route coordinates logged for this date.</div>
                        ) : (
                          travelData.routePoints?.map((pt, idx) => {
                            const pointKey = pt._id || `${pt.latitude}-${pt.longitude}-${idx}`;
                            if (!resolvedAddresses[pointKey]) {
                              resolvePlaceName(pt.latitude, pt.longitude, pointKey);
                            }
                            return (
                              <div key={pointKey} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] gap-2">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-[var(--color-heading)] flex items-center gap-1">
                                    📍 {resolvedAddresses[pointKey] || `GPS Point (${pt.latitude.toFixed(3)}, ${pt.longitude.toFixed(3)})`}
                                  </span>
                                  <span className="text-[10px] text-[var(--color-body)] font-mono">
                                    Lat: {pt.latitude.toFixed(5)}, Lng: {pt.longitude.toFixed(5)}
                                  </span>
                                </div>
                                <span className="text-[var(--color-body)] whitespace-nowrap">
                                  ⏰ {new Date(pt.timestamp).toLocaleTimeString('en-IN')}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SECURITY ALERTS & SPOOFING LOGS */}
            {activeTab === "security-alerts" && (
              <div className="bg-[var(--color-card)] border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-4 gap-4">
                  <div>
                    <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
                      <span>🚨</span> Live Mock Location / Spoofing Security Logs
                    </h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">Real-time flags triggered when salespersons attempt to bypass location restrictions using fake GPS.</p>
                  </div>
                  <span className="bg-red-500/10 text-red-600 border border-red-500/20 px-3 py-1.5 rounded-xl font-extrabold text-xs">
                    Total Flags: {spoofingAlerts.length}
                  </span>
                </div>

                {spoofingAlerts.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] space-y-2">
                    <span className="text-2xl">🛡️</span>
                    <p>No spoofing or fake GPS attempts detected in the current active session.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {spoofingAlerts.map((alert, idx) => (
                      <div key={idx} className="bg-red-500/5 border border-red-500/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-red-600 font-bold">Salesperson ID: {alert.salespersonId}</strong>
                            <span className="bg-red-500 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">Mock Detected</span>
                          </div>
                          <p className="text-[var(--color-heading)]">📍 Coordinates flagged: <span className="font-mono">{alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}</span></p>
                          <p className="text-[var(--color-body)]">⏰ Timestamp: {new Date(alert.timestamp || Date.now()).toLocaleString('en-IN')}</p>
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold transition shadow-sm text-center"
                        >
                          🗺️ View Flagged Location
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: TEAM BROADCAST ANNOUNCEMENTS */}
            {activeTab === "broadcast" && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-primary)] flex items-center gap-2">
                      <span>📢</span> Send Live Broadcast Announcement
                    </h3>
                    <p className="text-xs text-[var(--color-body)] mt-1">
                      Instantly push real-time alerts, daily goals, or important updates to all active salesperson apps.
                    </p>
                  </div>

                  <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Priority Level *</label>
                      <select
                        value={broadcastMsg.priority}
                        onChange={(e) => setBroadcastMsg({ ...broadcastMsg, priority: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-semibold focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                      >
                        <option value="normal">🟢 Normal Update</option>
                        <option value="important">🟡 Important Notice</option>
                        <option value="urgent">🔴 Urgent / Emergency</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Headline / Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Evening Team Sync-up at 6 PM"
                        value={broadcastMsg.title}
                        onChange={(e) => setBroadcastMsg({ ...broadcastMsg, title: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Message Details *</label>
                      <textarea
                        required
                        rows="4"
                        placeholder="Type your complete announcement here..."
                        value={broadcastMsg.message}
                        onChange={(e) => setBroadcastMsg({ ...broadcastMsg, message: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isBroadcasting}
                      className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition cursor-pointer shadow-sm text-xs disabled:opacity-50"
                    >
                      {isBroadcasting ? "Broadcasting to Team..." : "🚀 Push Broadcast to All Devices"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 1.6: LEADS REPORT & EXCEL EXPORT */}
            {activeTab === "leads-export" && (
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-4 gap-4">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-heading)]">📊 Leads Report & Excel Export</h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">Filter team leads by status and download spreadsheet reports.</p>
                  </div>
                  <button
                    onClick={() => downloadCSV(filteredSystemLeads, `Leads_Report_${adminLeadFilter}.csv`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 py-3 rounded-2xl font-semibold transition cursor-pointer shadow-sm flex items-center gap-2"
                  >
                    📥 Download Excel (.CSV) Report
                  </button>
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setAdminLeadFilter("all")} className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition ${adminLeadFilter === "all" ? "bg-[var(--color-primary)] text-white border-transparent" : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"}`}>
                    All Leads ({allSystemLeads.length})
                  </button>
                  <button onClick={() => setAdminLeadFilter("call-back")} className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition ${adminLeadFilter === "call-back" ? "bg-[var(--color-primary)] text-white border-transparent" : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"}`}>
                    📞 Call Back ({allSystemLeads.filter(l => l.leadStatus?.toLowerCase().includes("call") || l.followUpAction?.toLowerCase().includes("call")).length})
                  </button>
                  <button onClick={() => setAdminLeadFilter("next-meeting")} className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition ${adminLeadFilter === "next-meeting" ? "bg-[var(--color-primary)] text-white border-transparent" : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"}`}>
                    🤝 Next Meeting ({allSystemLeads.filter(l => l.leadStatus?.toLowerCase().includes("meeting") || l.followUpAction?.toLowerCase().includes("meeting")).length})
                  </button>
                  <button onClick={() => setAdminLeadFilter("not-interested")} className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition ${adminLeadFilter === "not-interested" ? "bg-[var(--color-primary)] text-white border-transparent" : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"}`}>
                    ❌ Not Interested ({allSystemLeads.filter(l => l.leadStatus?.toLowerCase().includes("not interested")).length})
                  </button>
                  <button onClick={() => setAdminLeadFilter("deal-closed")} className={`text-xs px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition ${adminLeadFilter === "deal-closed" ? "bg-[var(--color-primary)] text-white border-transparent" : "bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]"}`}>
                    🎉 Deal Closed ({allSystemLeads.filter(l => l.leadStatus?.toLowerCase().includes("deal close") || l.leadStatus?.toLowerCase().includes("closed")).length})
                  </button>
                </div>

                {loadingSystemLeads ? (
                  <div className="py-16 text-center text-xs text-[var(--color-body)]">Loading all team leads...</div>
                ) : filteredSystemLeads.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                    No leads found for this filter category.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSystemLeads.map((lead) => (
                      <div key={lead._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-[var(--color-heading)] font-bold">{lead.instituteName}</strong>
                            <span className="bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold">👤 {lead.salespersonName}</span>
                          </div>
                          <p className="text-[var(--color-body)]">👤 Contact: {lead.contactPerson} | 📞 <a href={`tel:${lead.mobileNo}`} className="text-[var(--color-primary)] font-bold">{lead.mobileNo}</a></p>
                          <p className="text-[var(--color-heading)]">📍 Location: {lead.city || 'N/A'}, {lead.state || 'N/A'}</p>

                          {/* 🌟 MEETING PHOTO PREVIEW IN LEADS REPORT */}
                          {lead.meetingPhoto && (
                            <div className="pt-1 flex items-center gap-3">
                              <img
                                src={`${API_BASE}/${lead.meetingPhoto}`}
                                alt="Meeting Proof"
                                className="w-16 h-16 object-cover rounded-xl border border-[var(--color-border)] shadow-sm bg-black/5"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = "https://placehold.co/100?text=Preview";
                                }}
                              />
                              <div>
                                <p className="text-[10px] text-[var(--color-body)] font-mono mb-1">📸 {lead.meetingPhoto}</p>
                                <a
                                  href={`${API_BASE}/${lead.meetingPhoto}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block bg-[var(--color-primary)] text-white text-[11px] font-semibold px-3 py-1 rounded-lg transition shadow-sm"
                                >
                                  🔍 Open Full Image
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        <span className="bg-blue-500/10 text-blue-600 border border-blue-500/25 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                          {lead.leadStatus || 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TEAM DIRECTORY */}
            {activeTab === "directory" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--color-card)] p-5 rounded-3xl border border-[var(--color-border)] shadow-sm gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-heading)]">
                      Search Salesperson & Deal Records
                    </h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">
                      Look up salesperson performance, revenue history, and deal pipelines.
                    </p>
                  </div>
                  <div className="w-full sm:w-80 relative">
                    <input
                      type="text"
                      placeholder="Search by Salesperson Name or ID..."
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl pl-10 pr-4 py-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition"
                    />
                    <span className="absolute left-3.5 top-3.5 text-xs text-[var(--color-body)]">🔍</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[var(--color-heading)]">
                  Salesperson Cards & Deal Summaries ({filteredDirectoryStats.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDirectoryStats.map((stat) => {
                    const matchedEmp = employees.find((e) => e.userId === stat.salespersonId);
                    return (
                      <div
                        key={stat.salespersonId || "unassigned"}
                        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm space-y-4 hover:border-[var(--color-primary)]/40 transition"
                      >
                        <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                          <div>
                            <h4 className="font-extrabold text-[var(--color-heading)] text-base">
                              {matchedEmp?.name ? `${matchedEmp.name}` : (stat.salespersonId || "Unassigned")}
                            </h4>
                            <span className="text-[10px] text-[var(--color-body)] font-mono">
                              ID: {stat.salespersonId || "N/A"}
                            </span>
                          </div>
                          <span className="text-[10px] bg-[var(--color-surface)] px-3 py-1 rounded-xl border border-[var(--color-border)] font-semibold">
                            {stat.totalDeals} Deals
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[var(--color-surface)] p-3 rounded-2xl border border-[var(--color-border)]">
                          <div>
                            <span className="text-[10px] text-[var(--color-body)] block">Approved</span>
                            <strong className="text-emerald-600 text-sm">{stat.approvedDeals}</strong>
                          </div>
                          <div className="border-x border-[var(--color-border)]">
                            <span className="text-[10px] text-[var(--color-body)] block">Pending</span>
                            <strong className="text-amber-600 text-sm">{stat.pendingDeals}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--color-body)] block">Rejected</span>
                            <strong className="text-red-500 text-sm">{stat.rejectedDeals}</strong>
                          </div>
                        </div>

                        <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] text-xs space-y-1.5 font-medium">
                          <div className="flex justify-between">
                            <span className="text-[var(--color-body)]">Total Revenue:</span>
                            <strong className="text-[var(--color-heading)]">₹{stat.totalBusiness?.toLocaleString("en-IN") || 0}</strong>
                          </div>
                          <div className="flex justify-between text-emerald-600">
                            <span>Collected:</span>
                            <strong>₹{stat.totalPaid?.toLocaleString("en-IN") || 0}</strong>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleViewEmployeeDetails(stat.salespersonId || "null")}
                            className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border border-purple-500/20 text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer text-center"
                          >
                            👁️ View Deals History
                          </button>

                          {stat.salespersonId && stat.salespersonId !== "Unassigned" && stat.salespersonId !== userId && (
                            <button
                              onClick={() => handleDeleteEmployee(stat.salespersonId)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs px-3.5 py-2.5 rounded-xl font-semibold transition cursor-pointer"
                            >
                              ❌
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: MANAGE TEAM */}
            {activeTab === "employees" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
                    ➕ Add Team Member
                  </h3>
                  {empStatus.success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3 rounded-2xl text-xs font-semibold">
                      {empStatus.success}
                    </div>
                  )}
                  {empStatus.error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-2xl text-xs font-semibold">
                      {empStatus.error}
                    </div>
                  )}
                  <form onSubmit={handleAddEmployee} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Account Role *</label>
                      <select
                        value={newEmp.role}
                        onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-semibold focus:outline-none focus:border-[var(--color-primary)]"
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
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
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
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
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
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
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
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white text-xs font-semibold py-3 rounded-2xl transition cursor-pointer shadow-sm"
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
                          className="py-3.5 flex justify-between items-center text-xs"
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
                                {emp.email}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {emp.role === "salesperson" && (
                              <button
                                onClick={() => handleViewEmployeeDetails(emp.userId)}
                                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 text-xs px-3.5 py-2 rounded-xl border border-purple-500/20 transition cursor-pointer font-semibold"
                              >
                                👁️ History
                              </button>
                            )}
                            {emp.userId !== userId && (
                              <button
                                onClick={() => handleDeleteEmployee(emp.userId)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs px-3.5 py-2 rounded-xl transition cursor-pointer font-semibold"
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
            )}

            {/* TAB 5: TRANSFER LEADS */}
            {activeTab === "transfer" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-primary)]">
                      🔄 Transfer Leads
                    </h3>
                    <p className="text-xs text-[var(--color-body)] mt-1">
                      Select a source salesperson to view their active leads, choose specific leads using checkboxes, and reassign them to another salesperson.
                    </p>
                  </div>

                  {transferStatus.success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3.5 rounded-2xl text-xs font-semibold">
                      {transferStatus.success}
                    </div>
                  )}
                  {transferStatus.error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3.5 rounded-2xl text-xs font-semibold">
                      {transferStatus.error}
                    </div>
                  )}

                  <form onSubmit={handleExecuteGranularTransfer} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-medium mb-1.5 text-[var(--color-heading)]">
                          Source Salesperson (From) *
                        </label>
                        <select
                          required
                          value={transferData.fromSalesperson}
                          onChange={(e) => {
                            setTransferData({ ...transferData, fromSalesperson: e.target.value });
                            if (e.target.value) fetchSalespersonLeadsForTransfer(e.target.value);
                          }}
                          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium"
                        >
                          <option value="">Select Salesperson to pick leads from</option>
                          <option value="null">Unassigned / Deleted (null)</option>
                          {employees
                            .filter((emp) => emp.role === "salesperson")
                            .map((emp) => (
                              <option key={emp.userId} value={emp.userId}>
                                {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium mb-1.5 text-[var(--color-heading)]">
                          Target Salesperson (To) *
                        </label>
                        <select
                          required
                          value={transferData.toSalesperson}
                          onChange={(e) => setTransferData({ ...transferData, toSalesperson: e.target.value })}
                          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium"
                        >
                          <option value="">Select Salesperson to assign leads to</option>
                          {employees
                            .filter((emp) => emp.role === "salesperson")
                            .map((emp) => (
                              <option key={emp.userId} value={emp.userId}>
                                {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {transferData.fromSalesperson && (
                      <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-[var(--color-heading)]">
                            Select Leads to Transfer ({selectedLeadIds.length} selected)
                          </h4>
                          {sourceLeads.length > 0 && (
                            <button
                              type="button"
                              onClick={handleSelectAllLeads}
                              className="text-xs text-[var(--color-primary)] font-semibold hover:underline cursor-pointer"
                            >
                              {selectedLeadIds.length === sourceLeads.length ? "Deselect All" : "Select All"}
                            </button>
                          )}
                        </div>

                        {loadingSourceLeads ? (
                          <div className="py-8 text-center text-xs text-[var(--color-body)]">Loading leads...</div>
                        ) : sourceLeads.length === 0 ? (
                          <div className="py-8 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                            No active leads found for this salesperson.
                          </div>
                        ) : (
                          <div className="max-h-60 overflow-y-auto space-y-2 border border-[var(--color-border)] p-3 rounded-2xl bg-[var(--color-surface)]">
                            {sourceLeads.map((lead) => (
                              <label
                                key={lead._id}
                                className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedLeadIds.includes(lead._id)}
                                    onChange={() => handleToggleLeadSelection(lead._id)}
                                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                                  />
                                  <div>
                                    <strong className="text-[var(--color-heading)] font-bold">{lead.instituteName}</strong>
                                    <span className="text-[var(--color-body)] ml-2">({lead.city || "N/A"})</span>
                                  </div>
                                </div>
                                <span className="text-[var(--color-body)] font-medium">📞 {lead.mobileNo || 'N/A'}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition cursor-pointer shadow-sm text-xs"
                    >
                      Transfer Selected Leads ({selectedLeadIds.length})
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 6: COUPONS */}
            {activeTab === "coupons" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
                    🎟️ Generate Coupon
                  </h3>
                  {couponStatus.success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3 rounded-2xl text-xs font-semibold">
                      {couponStatus.success}
                    </div>
                  )}
                  {couponStatus.error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-2xl text-xs font-semibold">
                      {couponStatus.error}
                    </div>
                  )}
                  <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Coupon Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. FESTIVE50"
                        value={newCoupon.code}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full uppercase bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-mono font-bold focus:outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Discount Type *</label>
                      <select
                        value={newCoupon.discountType}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            discountType: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] font-semibold focus:outline-none focus:border-[var(--color-primary)]"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">
                        {newCoupon.discountType === "percentage"
                          ? "Percentage Value (e.g. 10) *"
                          : "Amount in Rupees (e.g. 500) *"}
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder={
                          newCoupon.discountType === "percentage" ? "10" : "500"
                        }
                        value={newCoupon.discountValue}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            discountValue: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Expiry Date (Optional)</label>
                      <input
                        type="date"
                        value={newCoupon.expiryDate}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            expiryDate: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white text-xs font-semibold py-3 rounded-2xl transition cursor-pointer shadow-sm"
                    >
                      Generate & Save Coupon
                    </button>
                  </form>
                </div>

                <div className="md:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-[var(--color-heading)]">
                    Active Discount Coupons ({coupons.length})
                  </h3>
                  {coupons.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                      No active discount coupons generated yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)] max-h-[420px] overflow-y-auto">
                      {coupons.map((coupon) => (
                        <div
                          key={coupon._id}
                          className="py-3.5 flex justify-between items-center text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm bg-purple-500/10 text-purple-600 px-2.5 py-1 rounded-xl border border-purple-500/20">
                                {coupon.code}
                              </span>
                              <span className="text-[var(--color-heading)] font-semibold">
                                {coupon.discountType === "percentage"
                                  ? `${coupon.discountValue}% OFF`
                                  : `₹${coupon.discountValue} OFF`}
                              </span>
                            </div>
                            <p className="text-[var(--color-body)] mt-1">
                              Expires:{" "}
                              {coupon.expiryDate
                                ? new Date(
                                    coupon.expiryDate,
                                  ).toLocaleDateString()
                                : "No Expiry"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-xl font-bold text-[10px] uppercase">
                              Active
                            </span>
                            <button
                              onClick={() =>
                                handleDeleteCoupon(coupon._id, coupon.code)
                              }
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 px-3.5 py-2 rounded-xl transition cursor-pointer font-semibold"
                            >
                              ❌ Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL VIEW FOR EMPLOYEE DEALS & LOCATION LOGS */}
        {selectedEmpLogs && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-3xl w-full p-6 md:p-8 text-[var(--color-heading)] space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <div>
                  <h3 className="text-lg font-extrabold text-[var(--color-primary)]">
                    Salesperson Activity & Location Report
                  </h3>
                  <p className="text-xs text-[var(--color-body)]">
                    Salesperson ID: <strong>{selectedEmpLogs.userId === "null" ? "Unassigned" : selectedEmpLogs.userId}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEmpLogs(null)}
                  className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-xs text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {loadingLogs ? (
                <div className="py-12 text-center text-xs text-[var(--color-body)]">
                  Fetching full activity logs...
                </div>
              ) : selectedEmpLogs.deals.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
                  No deals or visit records submitted by this salesperson yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--color-body)]">
                    Showing all <strong>{selectedEmpLogs.deals.length}</strong> deal(s) created by this salesperson:
                  </p>

                  <div className="space-y-3">
                    {selectedEmpLogs.deals.map((deal) => (
                      <div
                        key={deal._id}
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-3 text-xs"
                      >
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--color-border)] pb-3">
                          <span className="text-sm font-bold text-[var(--color-heading)]">
                            {deal.instituteName} ({deal.appName})
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${deal.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : deal.status === "rejected" ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"}`}
                          >
                            {deal.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-heading)]">
                          <div>📍 <strong>Manual Address:</strong> {deal.address || "N/A"}</div>
                          <div>🏙️ <strong>City & State:</strong> {deal.city || "N/A"}, {deal.state || "N/A"}</div>
                          <div>📮 <strong>Pincode:</strong> {deal.pincode || "N/A"}</div>
                          <div>📞 <strong>Contact:</strong> {deal.mobileNo} | {deal.email}</div>
                        </div>

                        {deal.latitude && deal.longitude ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between text-xs mt-2">
                            <span className="text-emerald-700 font-medium">
                              🛰️ <strong>Verified GPS:</strong> {deal.latitude.toFixed(5)}, {deal.longitude.toFixed(5)}
                            </span>
                            <a
                              href={`https://www.google.com/maps?q=${deal.latitude},${deal.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-xl transition shadow-sm"
                            >
                              🗺️ Map
                            </a>
                          </div>
                        ) : (
                          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-amber-600 text-xs mt-2 font-medium">
                            ⚠️ GPS Coordinates were not captured for this deal submission.
                          </div>
                        )}

                        <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--color-border)] text-xs font-medium">
                          <span>Total: <strong className="text-[var(--color-heading)]">₹{deal.totalAmount}</strong></span>
                          <span className="text-emerald-600">Paid: <strong>₹{deal.paidAmount}</strong></span>
                          <span className="text-red-500">Due: <strong>₹{deal.dueAmount}</strong></span>
                        </div>

                        <div className="pt-2 border-t border-[var(--color-border)] flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setTransferModalDeal(deal);
                              setTargetSalesperson("");
                            }}
                            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 border border-purple-500/20 text-xs px-3.5 py-2 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5"
                          >
                            🔄 Transfer This Deal
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedEmpLogs(null)}
                className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-border)] py-3 rounded-2xl font-semibold text-xs border border-[var(--color-border)] mt-2 cursor-pointer transition"
              >
                Close Report
              </button>
            </div>
          </div>
        )}

        {/* SINGLE DEAL TRANSFER POPUP */}
        {transferModalDeal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-md w-full p-6 md:p-8 text-[var(--color-heading)] space-y-4 shadow-2xl">
              <div>
                <h3 className="text-base font-bold text-[var(--color-primary)]">
                  Reassign Deal
                </h3>
                <p className="text-xs text-[var(--color-body)] mt-1">
                  Transferring deal for <strong>{transferModalDeal.instituteName}</strong>. Select the target salesperson:
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block font-medium text-[var(--color-heading)]">
                  Select Target Salesperson *
                </label>
                <select
                  value={targetSalesperson}
                  onChange={(e) => setTargetSalesperson(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium cursor-pointer"
                >
                  <option value="" disabled>-- Choose Salesperson --</option>
                  {employees
                    .filter((emp) => emp.role === "salesperson" && emp.userId !== transferModalDeal.salespersonId)
                    .map((emp) => (
                      <option key={emp.userId} value={emp.userId}>
                        {emp.name ? `${emp.name} (${emp.userId})` : emp.userId}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalDeal(null)}
                  className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-heading)] py-3 rounded-2xl text-xs font-semibold transition cursor-pointer border border-[var(--color-border)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSingleDealTransfer}
                  disabled={isTransferring || !targetSalesperson}
                  className={`flex-1 py-3 rounded-2xl text-xs font-semibold transition cursor-pointer text-white shadow-sm ${
                    isTransferring || !targetSalesperson 
                      ? "bg-purple-400 opacity-60 cursor-not-allowed" 
                      : "bg-[var(--color-primary)] hover:opacity-90"
                  }`}
                >
                  {isTransferring ? "Transferring..." : "Confirm & Transfer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;