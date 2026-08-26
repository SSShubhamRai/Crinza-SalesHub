import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

// Import Modals
import { LogoutModal } from "./modals/LogoutModal";
import { EmployeeDetailsModal } from "./modals/EmployeeDetailsModal";
import { TransferDealModal } from "./modals/TransferDealModal";

// Import Tabs
import { TaskTrackerTab } from "./tabs/TaskTrackerTab";
import { ManageTeamTab } from "./tabs/ManageTeamTab";
import { LeadsExportTab } from "./tabs/LeadsExportTab";
import { TeamDirectoryTab } from "./tabs/TeamDirectoryTab";
import { CouponsTab } from "./tabs/CouponsTab";
import { TransferLeadsTab } from "./tabs/TransferLeadsTab";
import { TeamBroadcastTab } from "./tabs/TeamBroadcastTab";
import { LiveTrackingTab } from "./tabs/LiveTrackingTab";
import { SecurityAlertsTab } from "./tabs/SecurityAlertsTab";
import { TechnicalProjectsTab } from "./tabs/TechnicalProjectsTab";
import { CallMonitoringTab } from "./tabs/CallMonitoringTab";
import SalespersonPointsTab from "./tabs/SalespersonPointsTab";

const AdminDashboard = ({ userId, onLogout }) => {
  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  const [activeTab, setActiveTab] = useState("tracker");
  const [employees, setEmployees] = useState([]);
  const [performanceStats, setPerformanceStats] = useState([]);
  const [tasksList, setTasksList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [directorySearch, setDirectorySearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedSalespersonTaskFilter, setSelectedSalespersonTaskFilter] = useState("all");
  const [selectedTaskDateFilter, setSelectedTaskDateFilter] = useState("");

  const [adminLeadFilter, setAdminLeadFilter] = useState("all");
  const [allSystemLeads, setAllSystemLeads] = useState([]);
  const [loadingSystemLeads, setLoadingSystemLeads] = useState(false);

  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [selectedLeadDateFilter, setSelectedLeadDateFilter] = useState("");
  const [selectedLeadEmpFilter, setSelectedLeadEmpFilter] = useState("all");

  const [selectedEmpLogs, setSelectedEmpLogs] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [transferModalDeal, setTransferModalDeal] = useState(null);
  const [targetSalesperson, setTargetSalesperson] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const [selectedTrackerEmp, setSelectedTrackerEmp] = useState("");
  const [trackerDate, setTrackerDate] = useState(new Date().toISOString().split('T')[0]);
  const [trackerEndDate, setTrackerEndDate] = useState(""); 
  const [travelData, setTravelData] = useState({ totalDistanceKm: 0, routePoints: [] });
  const [liveLocations, setLiveLocations] = useState({});
  const [resolvedAddresses, setResolvedAddresses] = useState({});

  const [shiftData, setShiftData] = useState(null);
  const [spoofingAlerts, setSpoofingAlerts] = useState([]);

  const [broadcastMsg, setBroadcastMsg] = useState({ title: "", message: "", priority: "normal" });
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const [kpiSummary, setKpiSummary] = useState({ totalRevenue: 0, totalCollected: 0, activeLeadsCount: 0 });

  const socketRef = useRef(null);

  const [newEmp, setNewEmp] = useState({
    userId: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "salesperson",
  });
  const [empStatus, setEmpStatus] = useState({ success: "", error: "" });

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

  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    expiryDate: "",
    usageLimit: "",
  });
  const [couponStatus, setCouponStatus] = useState({ success: "", error: "" });

  useEffect(() => {
    if (showLogoutModal || selectedEmpLogs || transferModalDeal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showLogoutModal, selectedEmpLogs, transferModalDeal]);

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

    socketRef.current.on('spoofing_alert', (data) => {
      toast.error(`🚨 Security Alert: ${data.salespersonId} used Mock Location / Fake GPS!`, { duration: 6000 });
      setSpoofingAlerts((prev) => [data, ...prev]);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [API_BASE]);

  const fetchSalespersonTravelHistory = useCallback(async (empId, startDate, endDate) => {
    if (!empId) return;
    try {
      const token = localStorage.getItem("token");
      const targetStart = startDate || trackerDate;
      const targetEnd = endDate || trackerEndDate || targetStart;

      let url = `${API_BASE}/api/boss/salesperson-travel/${empId}?date=${targetStart}`;
      if (targetEnd && targetEnd !== targetStart) {
        url = `${API_BASE}/api/boss/salesperson-travel/${empId}?startDate=${targetStart}&endDate=${targetEnd}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTravelData(data);
      }
    } catch (err) {
      console.error("Failed to fetch travel history:", err);
    }
  }, [API_BASE, trackerDate, trackerEndDate]);

  const fetchSalespersonShiftInfo = useCallback(async (empId, dateVal) => {
    if (!empId) return;
    try {
      const token = localStorage.getItem("token");
      const targetDate = dateVal || trackerDate;
      const res = await fetch(`${API_BASE}/api/boss/salesperson-shift/${empId}?date=${targetDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setShiftData(data.session);
      }
    } catch (err) {
      console.error("Failed to fetch shift info:", err);
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
          collectedLeads = [...collectedLeads, ...lData.map(l => ({ ...l, salespersonId: emp.userId, salespersonName: emp.name || emp.userId }))];
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
      fetchSalespersonTravelHistory(selectedTrackerEmp, trackerDate, trackerEndDate);
      fetchSalespersonShiftInfo(selectedTrackerEmp, trackerDate);
    }
    if (activeTab === "leads-export") {
      fetchAllSystemLeads();
    }
  }, [selectedTrackerEmp, trackerDate, trackerEndDate, activeTab, fetchSalespersonTravelHistory, fetchSalespersonShiftInfo, fetchAllSystemLeads]);

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

      const kpiRes = await fetch(`${API_BASE}/api/boss/kpi-summary`, { headers });
      if (kpiRes.ok) {
        const kpiData = await kpiRes.json();
        setKpiSummary(kpiData);
      } else {
        let totalRev = 0;
        let totalColl = 0;
        stats.forEach(s => {
          totalRev += s.totalBusiness || 0;
          totalColl += s.totalPaid || 0;
        });
        setKpiSummary({ totalRevenue: totalRev, totalCollected: totalColl });
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
    setLoadingLogs(true);
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
      setLoadingLogs(false);
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

      const successMsg = data.message || `Employee ${newEmp.name} created successfully!`;
      toast.success(successMsg);
      setEmpStatus({ success: successMsg, error: "" });
      setNewEmp({
        userId: "",
        name: "",
        email: "",
        phone: "",
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

  // 🌟 FIXED: Corrected API endpoint to fetch leads instead of details/invoices
  const fetchSalespersonLeadsForTransfer = async (empId) => {
    setLoadingSourceLeads(true);
    setSelectedLeadIds([]);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/boss/employee-leads/${empId}`, {
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
      const res = await fetch(`${API_BASE}/api/boss/transfer-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromSalesperson: transferData.fromSalesperson,
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

const filteredSystemLeads = allSystemLeads.filter((lead) => {
    const lStatus = lead.leadStatus?.toLowerCase() || "";
    const fAction = lead.followUpAction?.toLowerCase() || "";
    const dStatus = lead.demoStatus?.toLowerCase() || "";

    let matchesStatus = true;
    if (adminLeadFilter === "call-back") {
      matchesStatus = lStatus.includes("call") || fAction.includes("call");
    } else if (adminLeadFilter === "next-meeting") {
      matchesStatus = lStatus.includes("meeting") || fAction.includes("meeting") || fAction.includes("next meeting");
    } else if (adminLeadFilter === "demo-done") {
      matchesStatus = dStatus === "completed";
    } else if (adminLeadFilter === "demo-pending") {
      matchesStatus = !lead.demoStatus || dStatus === "not given" || dStatus === "scheduled";
    } else if (adminLeadFilter === "not-interested") {
      matchesStatus = lStatus.includes("not interested");
    } else if (adminLeadFilter === "deal-closed") {
      matchesStatus = lStatus.includes("deal close") || lStatus.includes("closed");
    }

    let matchesDateRange = true;
    const leadDateStr = lead.leadDate || (lead.createdAt ? lead.createdAt.split('T')[0] : "");
    
    if (exportStartDate && leadDateStr) {
      matchesDateRange = matchesDateRange && (leadDateStr >= exportStartDate);
    }
    if (exportEndDate && leadDateStr) {
      matchesDateRange = matchesDateRange && (leadDateStr <= exportEndDate);
    }

    let matchesSpecificDate = true;
    if (selectedLeadDateFilter && leadDateStr) {
      matchesSpecificDate = leadDateStr === selectedLeadDateFilter;
    }

    let matchesSpecificEmployee = true;
    if (selectedLeadEmpFilter !== "all") {
      matchesSpecificEmployee = lead.salespersonId === selectedLeadEmpFilter;
    }

    return matchesStatus && matchesDateRange && matchesSpecificDate && matchesSpecificEmployee;
  });

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        
        <LogoutModal 
          show={showLogoutModal} 
          onClose={() => setShowLogoutModal(false)} 
          onConfirm={() => { setShowLogoutModal(false); onLogout(); }} 
        />

        <EmployeeDetailsModal 
          selectedEmpLogs={selectedEmpLogs}
          setSelectedEmpLogs={setSelectedEmpLogs}
          loadingLogs={loadingLogs}
          API_BASE={API_BASE}
          setTransferModalDeal={setTransferModalDeal}
        />

        <TransferDealModal 
          transferModalDeal={transferModalDeal}
          setTransferModalDeal={setTransferModalDeal}
          targetSalesperson={targetSalesperson}
          setTargetSalesperson={setTargetSalesperson}
          employees={employees}
          isTransferring={isTransferring}
          handleExecuteSingleDealTransfer={handleExecuteSingleDealTransfer}
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm gap-4 transition-all duration-300 hover:shadow-md">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
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
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition-all duration-200 cursor-pointer flex items-center gap-2 active:scale-95"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">Total Revenue Generated</span>
              <h3 className="text-lg font-extrabold text-[var(--color-heading)] mt-0.5">₹{kpiSummary.totalRevenue?.toLocaleString("en-IN") || 0}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">📈</div>
          </div>

          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">Total Collections (Paid)</span>
              <h3 className="text-lg font-extrabold text-[var(--color-primary)] mt-0.5">₹{kpiSummary.totalCollected?.toLocaleString("en-IN") || 0}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">💰</div>
          </div>

          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div>
              <span className="text-[11px] text-[var(--color-body)] font-medium block">Active Sales Team</span>
              <h3 className="text-lg font-extrabold text-purple-600 mt-0.5">{employees.filter(e => e.role === 'salesperson').length} Members</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-sm transition-transform duration-300 hover:rotate-12">👥</div>
          </div>
        </div>

        {/* Desktop Navbar Tabs */}
        <div className="hidden md:flex gap-2 p-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-sm overflow-x-auto">
          <button onClick={() => setActiveTab("tracker")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "tracker" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            📋 Task Tracker
          </button>
          <button onClick={() => setActiveTab("employees")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "employees" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            ➕ Manage Team
          </button>
          <button onClick={() => setActiveTab("leads-export")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "leads-export" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            📊 Leads Report & Excel Export
          </button>
          <button onClick={() => setActiveTab("directory")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "directory" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            👥 Team Directory & Deals
          </button>
          <button onClick={() => setActiveTab("coupons")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "coupons" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            🎟️ Discount Coupons
          </button>
          <button onClick={() => setActiveTab("transfer")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "transfer" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            🔄 Transfer Leads
          </button>
          <button onClick={() => setActiveTab("broadcast")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "broadcast" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            📢 Team Broadcast
          </button>
          <button
  onClick={() => setActiveTab("call-monitoring")}
  className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
    activeTab === "call-monitoring"
      ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
      : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
  }`}
>
  📞 Call Monitoring
</button>

<button
  onClick={() => setActiveTab("salesperson-points")}
  className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${
    activeTab === "salesperson-points"
      ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
      : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"
  }`}
>
  🎯 Salesperson Points
</button>
          <button onClick={() => setActiveTab("live-tracking")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "live-tracking" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            🛰️ Live Tracking & Travel
          </button>
          <button onClick={() => setActiveTab("tech-projects")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 ${activeTab === "tech-projects" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            🛠️ App Production Queue
          </button>
          <button onClick={() => setActiveTab("security-alerts")} className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer whitespace-nowrap relative active:scale-95 ${activeTab === "security-alerts" ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20" : "text-[var(--color-heading)] hover:bg-[var(--color-surface)]"}`}>
            🚨 Security & Spoofing {spoofingAlerts.length > 0 && <span className="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-extrabold animate-pulse">{spoofingAlerts.length}</span>}
          </button>
        </div>

        {/* Mobile Dropdown Tabs */}
        <div className="block md:hidden w-full">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs text-[var(--color-heading)] font-bold focus:outline-none focus:border-[var(--color-primary)] shadow-sm cursor-pointer"
          >
            <option value="tracker">📋 Task Tracker</option>
            <option value="employees">➕ Manage Team</option>
            <option value="leads-export">📊 Leads Report & Excel Export</option>
            <option value="directory">👥 Team Directory & Deals</option>
            <option value="coupons">🎟️ Discount Coupons</option>
            <option value="transfer">🔄 Transfer Leads</option>

            <option value="broadcast">📢 Team Broadcast</option>
                <option value="call-monitoring">
  📞 Call Monitoring
</option>
<option value="salesperson-points">
  🎯 Salesperson Points
</option>
            <option value="live-tracking">🛰️ Live Tracking & Travel</option>
            <option value="tech-projects">🛠️ App Production Queue</option>
            <option value="security-alerts">🚨 Security & Spoofing ({spoofingAlerts.length})</option>
          </select>
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
            {activeTab === "tracker" && (
              <TaskTrackerTab
                tasksList={tasksList}
                employees={employees}
                selectedSalespersonTaskFilter={selectedSalespersonTaskFilter}
                setSelectedSalespersonTaskFilter={setSelectedSalespersonTaskFilter}
                selectedTaskDateFilter={selectedTaskDateFilter}
                setSelectedTaskDateFilter={setSelectedTaskDateFilter}
              />
            )}

            {activeTab === "employees" && (
              <ManageTeamTab
                newEmp={newEmp}
                setNewEmp={setNewEmp}
                empStatus={empStatus}
                handleAddEmployee={handleAddEmployee}
                filteredEmployees={filteredEmployees}
                employees={employees}
                selectedRoleFilter={selectedRoleFilter}
                setSelectedRoleFilter={setSelectedRoleFilter}
                employeeSearch={employeeSearch}
                setEmployeeSearch={setEmployeeSearch}
                handleViewEmployeeDetails={handleViewEmployeeDetails}
                handleDeleteEmployee={handleDeleteEmployee}
                userId={userId}
              />
            )}

            {activeTab === "leads-export" && (
              <LeadsExportTab
                filteredSystemLeads={filteredSystemLeads}
                allSystemLeads={allSystemLeads}
                adminLeadFilter={adminLeadFilter}
                setAdminLeadFilter={setAdminLeadFilter}
                downloadCSV={downloadCSV}
                exportStartDate={exportStartDate}
                exportEndDate={exportEndDate}
                selectedLeadDateFilter={selectedLeadDateFilter}
                setSelectedLeadDateFilter={setSelectedLeadDateFilter}
                selectedLeadEmpFilter={selectedLeadEmpFilter}
                setSelectedLeadEmpFilter={setSelectedLeadEmpFilter}
                employees={employees}
                loadingSystemLeads={loadingSystemLeads}
                API_BASE={API_BASE}
              />
            )}

            {activeTab === "directory" && (
              <TeamDirectoryTab
                directorySearch={directorySearch}
                setDirectorySearch={setDirectorySearch}
                filteredDirectoryStats={filteredDirectoryStats}
                employees={employees}
                userId={userId}
                handleViewEmployeeDetails={handleViewEmployeeDetails}
                handleDeleteEmployee={handleDeleteEmployee}
              />
            )}

            {activeTab === "coupons" && (
              <CouponsTab
                newCoupon={newCoupon}
                setNewCoupon={setNewCoupon}
                couponStatus={couponStatus}
                handleCreateCoupon={handleCreateCoupon}
                coupons={coupons}
                handleDeleteCoupon={handleDeleteCoupon}
              />
            )}

            {activeTab === "transfer" && (
              <TransferLeadsTab
                transferStatus={transferStatus}
                transferData={transferData}
                setTransferData={setTransferData}
                employees={employees}
                fetchSalespersonLeadsForTransfer={fetchSalespersonLeadsForTransfer}
                selectedLeadIds={selectedLeadIds}
                loadingSourceLeads={loadingSourceLeads}
                sourceLeads={sourceLeads}
                handleSelectAllLeads={handleSelectAllLeads}
                handleToggleLeadSelection={handleToggleLeadSelection}
                handleExecuteGranularTransfer={handleExecuteGranularTransfer}
              />
            )}

            {activeTab === "broadcast" && (
              <TeamBroadcastTab
                broadcastMsg={broadcastMsg}
                setBroadcastMsg={setBroadcastMsg}
                handleSendBroadcast={handleSendBroadcast}
                isBroadcasting={isBroadcasting}
              />
            )}

            {activeTab === "call-monitoring" && (
  <CallMonitoringTab
    API_BASE={API_BASE}
    employees={employees}
  />
)}

{activeTab === "salesperson-points" && (
  <SalespersonPointsTab employees={employees} />
)}

            {activeTab === "live-tracking" && (
              <LiveTrackingTab
                trackerDate={trackerDate}
                setTrackerDate={setTrackerDate}
                trackerEndDate={trackerEndDate}
                setTrackerEndDate={setTrackerEndDate}
                selectedTrackerEmp={selectedTrackerEmp}
                setSelectedTrackerEmp={setSelectedTrackerEmp}
                employees={employees}
                fetchSalespersonTravelHistory={fetchSalespersonTravelHistory}
                fetchSalespersonShiftInfo={fetchSalespersonShiftInfo}
                liveLocations={liveLocations}
                shiftData={shiftData}
                travelData={travelData}
                resolvedAddresses={resolvedAddresses}
                resolvePlaceName={resolvePlaceName}
              />
            )}

            {activeTab === "tech-projects" && (
              <TechnicalProjectsTab API_BASE={API_BASE} employees={employees} />
            )}

            {activeTab === "security-alerts" && (
              <SecurityAlertsTab spoofingAlerts={spoofingAlerts} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;