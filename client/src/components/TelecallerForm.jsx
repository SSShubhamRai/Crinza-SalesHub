import React, { useState, useEffect, useCallback, useRef } from "react";
import { State, City } from "country-state-city";
import { io } from "socket.io-client";
import { Geolocation } from "@capacitor/geolocation";
import ReactPhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const PhoneInput = ReactPhoneInput.default || ReactPhoneInput;

const LogoutModal = ({ show, onClose, onConfirm }) => {
  if (!show) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl text-center">
        <span className="text-5xl animate-bounce inline-block">⚠️</span>
        <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">Confirm Logout</h3>
        <p className="text-xs sm:text-sm text-[var(--color-body)] leading-relaxed">Are you sure you want to log out from the Telecaller Portal?</p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 bg-[var(--color-surface)] text-[var(--color-heading)] py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer border border-[var(--color-border)]">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer">Confirm Logout</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const EndDayConfirmModal = ({ show, onClose, onConfirm }) => {
  if (!show) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl text-center">
        <span className="text-5xl animate-bounce inline-block">🛑</span>
        <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">End Day Confirmation</h3>
        <p className="text-xs sm:text-sm text-[var(--color-body)] leading-relaxed">Are you sure you want to end your working day? Once ended, no further activities are allowed today.</p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 bg-[var(--color-surface)] text-[var(--color-heading)] py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer border border-[var(--color-border)]">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer">Confirm End Day</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const TelecallerForm = ({ userId, username, onLogout }) => {
  const [activeTab, setActiveTab] = useState("my-leads");
  const [leads, setLeads] = useState([]);
  const [transferredLeads, setTransferredLeads] = useState([]); // 👈 NEW: Admin dwara transfer ki gayi leads ke liye state
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // --- ⏱️ Day Shift Attendance States ---
  const [dayStatus, setDayStatus] = useState("LOADING"); // 'LOADING' | 'NOT_STARTED' | 'ACTIVE' | 'ENDED'
  const [startLocationName, setStartLocationName] = useState("");
  const [daySummaryModal, setDaySummaryModal] = useState(null);
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [status, setStatus] = useState({ loading: false, success: "", error: "" });

  const [telecallerLeadFilter, setTelecallerLeadFilter] = useState("all");
  const [assignmentData, setAssignmentData] = useState({});

  const [leadForm, setLeadForm] = useState({
    instituteName: "", contactPerson: "", mobileNo: "", email: "", address: "", city: "", state: "", pincode: "", notes: "",
  });

  const [selectedStateCode, setSelectedStateCode] = useState("");
  const indianStates = State.getStatesOfCountry("IN");
  const citiesOfState = selectedStateCode ? City.getCitiesOfState("IN", selectedStateCode) : [];

  const API_BASE = import.meta.env.PROD ? "https://crinza-saleshub.onrender.com" : "http://localhost:5000";

  const getSecureLocation = async () => {
    try {
      await Geolocation.requestPermissions();
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const isMocked = position.coords.mocked || position.coords.isFromMockProvider;
      if (isMocked) {
        toast.error("⚠️ Security Warning: Mock Location detected!");
        return { lat: null, lng: null, isMocked: true };
      }
      return { lat: position.coords.latitude, lng: position.coords.longitude, isMocked: false };
    } catch (err) {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({ lat: null, lng: null, isMocked: false });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, isMocked: false }),
          () => resolve({ lat: null, lng: null, isMocked: false }),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }
  };

  const checkDayStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/telecaller/day-status`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "STARTED") {
          setDayStatus("ACTIVE");
          setStartLocationName(data.startAddress || data.locationName || "");
        } else if (data.status === "ENDED") {
          setDayStatus("ENDED");
          setStartLocationName(data.startAddress || data.locationName || "");
        } else {
          setDayStatus("NOT_STARTED");
          setStartLocationName("");
        }
      }
    } catch (err) {
      console.error("Failed to check day status:", err);
    }
  }, [API_BASE]);

  const handleStartDay = async () => {
    setStatus({ loading: true, success: "", error: "" });
    const { lat, lng, isMocked } = await getSecureLocation();
    if (isMocked) return;

    try {
      let addressName = "";
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const geoData = await geoRes.json();
        if (geoData?.display_name) addressName = geoData.display_name;
      } catch (e) {}

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/telecaller/start-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude: lat, longitude: lng, startAddress: addressName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start day");

      toast.success("🚀 Working day started successfully!");
      setDayStatus("ACTIVE");
      setStartLocationName(data.startAddress || addressName);
      setStatus({ loading: false, success: "", error: "" });
    } catch (err) {
      setStatus({ loading: false, success: "", error: err.message });
      toast.error(err.message);
    }
  };

  const executeEndDay = async () => {
    setShowEndDayModal(false);
    setStatus({ loading: true, success: "", error: "" });
    const { lat, lng, isMocked } = await getSecureLocation();
    if (isMocked) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/telecaller/end-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to end day");

      setDayStatus("ENDED");
      setDaySummaryModal(data.summary);
      setStatus({ loading: false, success: "", error: "" });
      toast.success("Day ended successfully.");
    } catch (err) {
      setStatus({ loading: false, success: "", error: err.message });
      toast.error(err.message);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [leadsRes, spRes] = await Promise.all([
        fetch(`${API_BASE}/api/telecaller/leads`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/boss/employees`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const leadsData = await leadsRes.json();
      const spData = await spRes.json();

      if (leadsRes.ok) {
        // Apni banayi hui leads
        const myCreatedLeads = leadsData.filter(l => l.createdBy === userId || l.telecallerId === userId || (l.notes && l.notes.includes(`[Telecaller Entry - ${userId}]`)));
        setLeads(myCreatedLeads);

        // 🌟 Admin/Boss dwara is telecaller ko transfer ki gayi leads (jinka salespersonId ya assigned telecaller ye user hai par createdBy koi aur hai)
        const incomingTransferred = leadsData.filter(l => (l.salespersonId === userId || l.telecallerId === userId) && l.createdBy !== userId);
        setTransferredLeads(incomingTransferred);
      }
      if (spRes.ok) {
        setSalespersons(spData.filter(emp => emp.role === "salesperson"));
      }
    } catch (err) {
      toast.error("Failed to load telecaller dashboard data");
    } finally {
      setLoading(false);
    }
  }, [API_BASE, userId]);

  useEffect(() => { 
    fetchData(); 
    checkDayStatus();
  }, [fetchData, checkDayStatus]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (dayStatus !== "ACTIVE") {
      toast.error("🚫 Action Blocked: Start your working day first!");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/telecaller/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(leadForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create lead");

      toast.success("✨ New Lead created successfully!");
      setLeadForm({ instituteName: "", contactPerson: "", mobileNo: "", email: "", address: "", city: "", state: "", pincode: "", notes: "" });
      setSelectedStateCode("");
      setActiveTab("my-leads");
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAssignmentChange = (leadId, field, value) => {
    setAssignmentData((prev) => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || { requirementType: "Demo", scheduledDate: "", scheduledTime: "" }),
        [field]: value
      }
    }));
  };

  const handleAssignLead = async (leadId, salespersonId) => {
    if (dayStatus !== "ACTIVE") {
      toast.error("🚫 Action Blocked: Start your working day first!");
      return;
    }
    if (!salespersonId) {
      toast.error("Please select a salesperson first!");
      return;
    }

    const currentData = assignmentData[leadId] || {};
    const requirementType = currentData.requirementType || "Demo";
    const followUpDate = currentData.scheduledDate || "";
    const followUpTime = currentData.scheduledTime || "";

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/telecaller/leads/${leadId}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          salespersonId, 
          requirementType, 
          assignedBy: username || userId,
          followUpDate,
          followUpTime,
          followUpAction: requirementType
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign lead");

      toast.success(`🤝 Lead assigned successfully for ${requirementType}!`);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const assignmentStats = salespersons.map(sp => {
    const assignedLeads = leads.filter(l => l.salespersonId === sp.userId || l.salespersonId === sp._id);
    return {
      name: sp.name, userId: sp.userId,
      totalAssigned: assignedLeads.length,
      dealsClosed: assignedLeads.filter(l => l.leadStatus === "Deal Close").length,
      pending: assignedLeads.filter(l => l.leadStatus !== "Deal Close" && l.leadStatus !== "Not Interested").length
    };
  });

  const filteredTelecallerLeads = leads.filter(lead => {
    if (telecallerLeadFilter === "assigned") return Boolean(lead.salespersonId);
    if (telecallerLeadFilter === "unassigned") return !lead.salespersonId;
    return true;
  });

  const countAssigned = leads.filter(l => Boolean(l.salespersonId)).length;
  const countUnassigned = leads.filter(l => !l.salespersonId).length;

  return (
    <div className="min-h-dvh bg-[var(--color-background)] p-4 sm:p-6 md:p-8 pb-24 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <AnimatePresence>
          {showLogoutModal && <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={() => { setShowLogoutModal(false); onLogout(); }} />}
          {showEndDayModal && <EndDayConfirmModal show={showEndDayModal} onClose={() => setShowEndDayModal(false)} onConfirm={executeEndDay} />}
        </AnimatePresence>

        {daySummaryModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[99999]">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[var(--color-card)] border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl text-center">
              <span className="text-5xl animate-bounce inline-block">📋</span>
              <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">Daily Telecaller Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-left text-xs sm:text-sm bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] text-[var(--color-heading)]">
                <p>⏱️ Start Time: <strong>{daySummaryModal.startTime}</strong></p>
                <p>🏁 End Time: <strong>{daySummaryModal.endTime}</strong></p>
                <p>⏳ Working Hours: <strong>{daySummaryModal.workingHours}</strong></p>
              </div>
              <button onClick={() => setDaySummaryModal(null)} className="w-full bg-[var(--color-primary)] text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer">Close Report</button>
            </motion.div>
          </div>
        )}

        <div className="flex justify-between items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">TELECALLER PORTAL</span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--color-heading)] mt-1">Leads & Dispatch</h1>
            <p className="text-xs text-[var(--color-body)]">Welcome, {username || userId}</p>
          </div>
          <button onClick={() => setShowLogoutModal(true)} className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-red-500/15 text-red-600 border border-red-500/20 cursor-pointer">Logout</button>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <span className="text-3xl p-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">⏰</span>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--color-heading)] uppercase">Shift Attendance Control</h3>
              <p className="text-xs text-[var(--color-body)] mt-0.5">
                {dayStatus === "LOADING" && "Checking status..."}
                {dayStatus === "NOT_STARTED" && '⏳ Day not started. Click "Start Day" to capture location and unlock portal activities.'}
                {dayStatus === "ACTIVE" && "🟢 Shift Active. GPS tracking enabled & features unlocked."}
                {dayStatus === "ENDED" && "🔒 Shift Ended for today. Activities are locked."}
              </p>
              {startLocationName && <p className="text-xs font-semibold text-[var(--color-primary)] mt-1">📍 Start Location: {startLocationName}</p>}
            </div>
          </div>
          <div>
            {dayStatus === "NOT_STARTED" && (
              <button onClick={handleStartDay} disabled={status.loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition">
                {status.loading ? "Capturing GPS..." : "🚀 Start Day"}
              </button>
            )}
            {dayStatus === "ACTIVE" && (
              <button onClick={() => setShowEndDayModal(true)} disabled={status.loading} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition">
                🛑 End Day
              </button>
            )}
            {dayStatus === "ENDED" && (
              <span className="text-center bg-gray-500/10 text-gray-500 border border-gray-500/20 px-6 py-3.5 rounded-2xl font-bold text-xs">Day Completed 🏁</span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-[var(--color-card)] p-2 rounded-2xl border border-[var(--color-border)] overflow-x-auto">
          <button onClick={() => setActiveTab("my-leads")} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === "my-leads" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-heading)]"}`}>📋 My Created Leads ({leads.length})</button>
          <button onClick={() => setActiveTab("transferred-leads")} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === "transferred-leads" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-heading)]"}`}>🔄 Transferred Leads ({transferredLeads.length})</button>
          <button onClick={() => { if (dayStatus !== "ACTIVE") { toast.error("Start day first!"); return; } setActiveTab("create-lead"); }} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === "create-lead" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-heading)]"}`}>➕ Create New Lead</button>
          <button onClick={() => setActiveTab("analytics")} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === "analytics" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-heading)]"}`}>📊 Assignment Tracking</button>
        </div>

        {/* Tab 1: My Created Leads */}
        {activeTab === "my-leads" && (
          <div className="space-y-4">
            <div className="flex gap-2 bg-[var(--color-card)] p-2.5 rounded-2xl border border-[var(--color-border)] overflow-x-auto">
              <button onClick={() => setTelecallerLeadFilter("all")} className={`text-xs px-4 py-2 rounded-xl font-bold transition cursor-pointer shrink-0 ${telecallerLeadFilter === "all" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)] border"}`}>All Leads ({leads.length})</button>
              <button onClick={() => setTelecallerLeadFilter("assigned")} className={`text-xs px-4 py-2 rounded-xl font-bold transition cursor-pointer shrink-0 ${telecallerLeadFilter === "assigned" ? "bg-emerald-600 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)] border"}`}>✅ Assigned ({countAssigned})</button>
              <button onClick={() => setTelecallerLeadFilter("unassigned")} className={`text-xs px-4 py-2 rounded-xl font-bold transition cursor-pointer shrink-0 ${telecallerLeadFilter === "unassigned" ? "bg-amber-600 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)] border"}`}>⏳ Unassigned ({countUnassigned})</button>
            </div>

            {loading ? <p className="text-center py-10">Loading your leads...</p> : filteredTelecallerLeads.length === 0 ? (
              <div className="text-center py-16 bg-[var(--color-card)] rounded-3xl border text-xs text-[var(--color-body)]">No leads found matching this filter.</div>
            ) : (
              filteredTelecallerLeads.map(lead => (
                <div key={lead._id} className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-base text-[var(--color-heading)]">{lead.instituteName}</strong>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600">{lead.leadStatus || "Active"}</span>
                      {lead.salespersonId ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Assigned</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse">Unassigned</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-body)]">👤 <strong>{lead.contactPerson}</strong> | 📞 <a href={`tel:+91${String(lead.mobileNo || "").replace(/\D/g, "").slice(-10)}`} className="text-[var(--color-primary)] font-bold hover:underline">{lead.mobileNo}</a></p>
                    <p className="text-xs text-[var(--color-body)]">📍 {lead.address}, {lead.city}, {lead.state} - {lead.pincode}</p>
                    <p className="text-xs text-[var(--color-body)]">💬 Notes: {lead.notes}</p>
                  </div>

                  <div className="flex flex-col gap-3 w-full xl:w-80 border-t xl:border-t-0 pt-4 xl:pt-0 shrink-0">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <div className="text-xs space-y-1">
                        <label className="block text-[var(--color-body)] font-semibold">Requirement:</label>
                        <select value={assignmentData[lead._id]?.requirementType || lead.requirementType || "Demo"} onChange={(e) => handleAssignmentChange(lead._id, "requirementType", e.target.value)} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 text-xs font-semibold text-[var(--color-heading)] w-full cursor-pointer">
                          <option value="Demo">🎥 Demo</option>
                          <option value="Meeting">🤝 Meeting</option>
                        </select>
                      </div>
                      <div className="text-xs space-y-1">
                        <label className="block text-[var(--color-body)] font-semibold">Salesperson:</label>
                        <select id={`sp-select-${lead._id}`} defaultValue={lead.salespersonId || ""} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 font-medium text-xs cursor-pointer text-[var(--color-heading)] w-full">
                          <option value="" disabled>-- Select --</option>
                          {salespersons.map(sp => (<option key={sp._id} value={sp.userId}>{sp.name}</option>))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="text-xs space-y-1 w-full">
                        <label className="block text-[var(--color-body)] font-semibold">Schedule (Date & Time):</label>
                        <div className="flex gap-1">
                          <input type="date" defaultValue={lead.followUpDate ? lead.followUpDate.split('T')[0] : ""} value={assignmentData[lead._id]?.scheduledDate ?? (lead.followUpDate ? lead.followUpDate.split('T')[0] : "")} onChange={(e) => handleAssignmentChange(lead._id, "scheduledDate", e.target.value)} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 text-[11px] text-[var(--color-heading)] w-full" />
                          <input type="time" defaultValue={lead.followUpTime || ""} value={assignmentData[lead._id]?.scheduledTime ?? (lead.followUpTime || "")} onChange={(e) => handleAssignmentChange(lead._id, "scheduledTime", e.target.value)} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 text-[11px] text-[var(--color-heading)] w-24" />
                        </div>
                      </div>
                      <div className="w-full">
                        <button type="button" onClick={() => { const spId = document.getElementById(`sp-select-${lead._id}`).value; handleAssignLead(lead._id, spId); }} className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer transition active:scale-95 shadow-sm min-h-[38px]">
                          Assign 🚀
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 🌟 Tab 1.5: Transferred Leads View */}
        {activeTab === "transferred-leads" && (
          <div className="space-y-4">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl">
              <h3 className="text-sm font-bold text-[var(--color-heading)]">🔄 Leads Transferred To You</h3>
              <p className="text-xs text-[var(--color-body)]">These are leads reassigned to your account by administration / management.</p>
            </div>

            {loading ? <p className="text-center py-10">Loading transferred leads...</p> : transferredLeads.length === 0 ? (
              <div className="text-center py-16 bg-[var(--color-card)] rounded-3xl border text-xs text-[var(--color-body)]">No transferred leads found in your account.</div>
            ) : (
              transferredLeads.map(lead => (
                <div key={lead._id} className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-base text-[var(--color-heading)]">{lead.instituteName}</strong>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600">Transferred</span>
                    </div>
                    <p className="text-xs text-[var(--color-body)]">👤 <strong>{lead.contactPerson}</strong> | 📞 <a href={`tel:+91${String(lead.mobileNo || "").replace(/\D/g, "").slice(-10)}`} className="text-[var(--color-primary)] font-bold hover:underline">{lead.mobileNo}</a></p>
                    <p className="text-xs text-[var(--color-body)]">📍 {lead.address}, {lead.city}, {lead.state} - {lead.pincode}</p>
                    <p className="text-xs text-[var(--color-body)]">💬 Notes: {lead.notes}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Create Lead Form */}
        {activeTab === "create-lead" && (
          <form onSubmit={handleCreateLead} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 space-y-5">
            <h3 className="text-base font-bold text-[var(--color-heading)] uppercase">Create New Lead</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div><label className="block font-medium mb-1.5 text-[var(--color-heading)]">Institute Name *</label><input type="text" required value={leadForm.instituteName} onChange={e => setLeadForm({...leadForm, instituteName: e.target.value})} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 text-[var(--color-heading)]" placeholder="Apex Coaching" /></div>
              <div><label className="block font-medium mb-1.5 text-[var(--color-heading)]">Contact Person *</label><input type="text" required value={leadForm.contactPerson} onChange={e => setLeadForm({...leadForm, contactPerson: e.target.value})} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 text-[var(--color-heading)]" placeholder="Mr. Rajesh" /></div>
              <div><label className="block font-medium mb-1.5 text-[var(--color-heading)]">Mobile Number *</label><PhoneInput country={"in"} value={leadForm.mobileNo} onChange={phone => setLeadForm({...leadForm, mobileNo: phone})} containerClass="!w-full" inputClass="!w-full !bg-[var(--color-surface)] !border !rounded-xl !py-3 !pl-14" /></div>
              <div><label className="block font-medium mb-1.5 text-[var(--color-heading)]">Email</label><input type="email" value={leadForm.email} onChange={e => setLeadForm({...leadForm, email: e.target.value})} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 text-[var(--color-heading)]" placeholder="email@inst.com" /></div>
              <div className="md:col-span-2"><label className="block font-medium mb-1.5 text-[var(--color-heading)]">Street Address *</label><textarea rows="2" required value={leadForm.address} onChange={e => setLeadForm({...leadForm, address: e.target.value})} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 text-[var(--color-heading)]" placeholder="Street, Landmark..." /></div>
              <div><label className="block font-medium mb-1.5 text-[var(--color-heading)]">State *</label><select required value={selectedStateCode} onChange={e => { setSelectedStateCode(e.target.value); const st = indianStates.find(s => s.isoCode === e.target.value); setLeadForm({...leadForm, state: st ? st.name : "", city: ""}); }} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 cursor-pointer text-[var(--color-heading)]"><option value="">Select State</option>{indianStates.map(st => <option key={st.isoCode} value={st.isoCode}>{st.name}</option>)}</select></div>
              <div><label className="block font-medium mb-1.5 text-[var(--color-heading)]">City *</label><input type="text" list="cityList" required value={leadForm.city} onChange={e => setLeadForm({...leadForm, city: e.target.value})} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 text-[var(--color-heading)]" /><datalist id="cityList">{citiesOfState.map(c => <option key={c.name} value={c.name} />)}</datalist></div>
              <div><label className="block font-medium mb-1.5 text-[var(--color-heading)]">Pincode *</label><input type="text" maxLength={6} required value={leadForm.pincode} onChange={e => setLeadForm({...leadForm, pincode: e.target.value})} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 text-[var(--color-heading)]" /></div>
              <div className="md:col-span-2"><label className="block font-medium mb-1.5 text-[var(--color-heading)]">Discussion Notes *</label><textarea rows="3" required value={leadForm.notes} onChange={e => setLeadForm({...leadForm, notes: e.target.value})} className="w-full bg-[var(--color-surface)] border rounded-xl p-3 text-[var(--color-heading)]" /></div>
            </div>
            <button type="submit" className="w-full bg-[var(--color-primary)] text-white py-3.5 rounded-xl font-bold text-sm cursor-pointer shadow-sm">Save Lead 🚀</button>
          </form>
        )}

        {activeTab === "analytics" && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 space-y-4">
            <h3 className="text-base font-bold text-[var(--color-heading)] uppercase">Assignment Tracking</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assignmentStats.map(stat => (
                <div key={stat.userId} className="p-5 rounded-2xl bg-[var(--color-surface)] border space-y-2">
                  <h4 className="font-bold text-sm text-[var(--color-heading)]">{stat.name}</h4>
                  <div className="flex justify-between text-xs"><span>Assigned:</span><strong className="text-blue-600">{stat.totalAssigned}</strong></div>
                  <div className="flex justify-between text-xs"><span>Pending:</span><strong className="text-amber-600">{stat.pending}</strong></div>
                  <div className="flex justify-between text-xs"><span>Closed:</span><strong className="text-emerald-600">{stat.dealsClosed}</strong></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelecallerForm;