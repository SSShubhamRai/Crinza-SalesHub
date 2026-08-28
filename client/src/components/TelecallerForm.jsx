import React, { useState, useEffect, useCallback } from "react";
import { State, City } from "country-state-city";
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

const TelecallerForm = ({ userId, username, onLogout }) => {
  const [activeTab, setActiveTab] = useState("my-leads");
  const [leads, setLeads] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Filter state for assigned / unassigned leads view
  const [telecallerLeadFilter, setTelecallerLeadFilter] = useState("all");

  // Track requirement type, date, and time per lead assignment cleanly
  const [assignmentData, setAssignmentData] = useState({});

  const [leadForm, setLeadForm] = useState({
    instituteName: "", contactPerson: "", mobileNo: "", email: "", address: "", city: "", state: "", pincode: "", notes: "",
  });

  const [selectedStateCode, setSelectedStateCode] = useState("");
  const indianStates = State.getStatesOfCountry("IN");
  const citiesOfState = selectedStateCode ? City.getCitiesOfState("IN", selectedStateCode) : [];

  const API_BASE = import.meta.env.PROD ? "https://crinza-saleshub.onrender.com" : "http://localhost:5000";

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
        const myCreatedLeads = leadsData.filter(l => l.createdBy === userId || l.telecallerId === userId || (l.notes && l.notes.includes(`[Telecaller Entry - ${userId}]`)));
        setLeads(myCreatedLeads);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
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

  // 🌟 Assign Lead with Requirement, Schedule Date/Time & Telecaller Name
  const handleAssignLead = async (leadId, salespersonId) => {
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

  // Filter logic for My Created Leads list
  const filteredTelecallerLeads = leads.filter(lead => {
    if (telecallerLeadFilter === "assigned") {
      return Boolean(lead.salespersonId);
    }
    if (telecallerLeadFilter === "unassigned") {
      return !lead.salespersonId;
    }
    return true;
  });

  const countAssigned = leads.filter(l => Boolean(l.salespersonId)).length;
  const countUnassigned = leads.filter(l => !l.salespersonId).length;

  return (
    <div className="min-h-dvh bg-[var(--color-background)] p-4 sm:p-6 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <AnimatePresence>
          {showLogoutModal && <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={() => { setShowLogoutModal(false); onLogout(); }} />}
        </AnimatePresence>

        <div className="flex justify-between items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">TELECALLER PORTAL</span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--color-heading)] mt-1">Leads & Dispatch</h1>
            <p className="text-xs text-[var(--color-body)]">Welcome, {username || userId}</p>
          </div>
          <button onClick={() => setShowLogoutModal(true)} className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-red-500/15 text-red-600 border border-red-500/20 cursor-pointer">Logout</button>
        </div>

        <div className="flex gap-2 bg-[var(--color-card)] p-2 rounded-2xl border border-[var(--color-border)]">
          <button onClick={() => setActiveTab("my-leads")} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === "my-leads" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-heading)]"}`}>📋 My Created Leads ({leads.length})</button>
          <button onClick={() => setActiveTab("create-lead")} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === "create-lead" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-heading)]"}`}>➕ Create New Lead</button>
          <button onClick={() => setActiveTab("analytics")} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === "analytics" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-heading)]"}`}>📊 Assignment Tracking</button>
        </div>

        {activeTab === "my-leads" && (
          <div className="space-y-4">
            
            {/* Filter Tabs for Telecaller (All / Assigned / Unassigned) */}
            <div className="flex gap-2 bg-[var(--color-card)] p-2.5 rounded-2xl border border-[var(--color-border)] overflow-x-auto">
              <button
                onClick={() => setTelecallerLeadFilter("all")}
                className={`text-xs px-4 py-2 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                  telecallerLeadFilter === "all" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)] border"
                }`}
              >
                All Leads ({leads.length})
              </button>
              <button
                onClick={() => setTelecallerLeadFilter("assigned")}
                className={`text-xs px-4 py-2 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                  telecallerLeadFilter === "assigned" ? "bg-emerald-600 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)] border"
                }`}
              >
                ✅ Assigned ({countAssigned})
              </button>
              <button
                onClick={() => setTelecallerLeadFilter("unassigned")}
                className={`text-xs px-4 py-2 rounded-xl font-bold transition cursor-pointer shrink-0 ${
                  telecallerLeadFilter === "unassigned" ? "bg-amber-600 text-white" : "bg-[var(--color-surface)] text-[var(--color-heading)] border"
                }`}
              >
                ⏳ Unassigned / Pending ({countUnassigned})
              </button>
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
                      
                      {/* Status Badge */}
                      {lead.salespersonId ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Assigned
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse">
                          Unassigned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-body)]">
                      👤 <strong>{lead.contactPerson}</strong> | 📞{" "}
                      <a 
                        href={`tel:+91${String(lead.mobileNo || "").replace(/\D/g, "").slice(-10)}`} 
                        className="text-[var(--color-primary)] font-bold hover:underline"
                        title="Click to Call"
                      >
                        {lead.mobileNo}
                      </a>
                    </p>
                    <p className="text-xs text-[var(--color-body)]">📍 {lead.address}, {lead.city}, {lead.state} - {lead.pincode}</p>
                    <p className="text-xs text-[var(--color-body)]">💬 Notes: {lead.notes}</p>
                  </div>

                  {/* 🌟 Perfectly contained layout width with padding to ensure Assign button stays safely inside */}
                  <div className="flex flex-col gap-3 w-full xl:w-80 border-t xl:border-t-0 pt-4 xl:pt-0 shrink-0">
                    
                    <div className="grid grid-cols-2 gap-2 w-full">
                      {/* Requirement Type */}
                      <div className="text-xs space-y-1">
                        <label className="block text-[var(--color-body)] font-semibold">Requirement:</label>
                        <select
                          value={assignmentData[lead._id]?.requirementType || lead.requirementType || "Demo"}
                          onChange={(e) => handleAssignmentChange(lead._id, "requirementType", e.target.value)}
                          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 text-xs font-semibold text-[var(--color-heading)] w-full cursor-pointer"
                        >
                          <option value="Demo">🎥 Demo</option>
                          <option value="Meeting">🤝 Meeting</option>
                        </select>
                      </div>

                      {/* Assign Salesperson */}
                      <div className="text-xs space-y-1">
                        <label className="block text-[var(--color-body)] font-semibold">Salesperson:</label>
                        <select
                          id={`sp-select-${lead._id}`}
                          defaultValue={lead.salespersonId || ""}
                          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 font-medium text-xs cursor-pointer text-[var(--color-heading)] w-full"
                        >
                          <option value="" disabled>-- Select --</option>
                          {salespersons.map(sp => (
                            <option key={sp._id} value={sp.userId}>{sp.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      {/* Schedule Date & Time */}
                      <div className="text-xs space-y-1 w-full">
                        <label className="block text-[var(--color-body)] font-semibold">Schedule (Date & Time):</label>
                        <div className="flex gap-1">
                          <input
                            type="date"
                            defaultValue={lead.followUpDate ? lead.followUpDate.split('T')[0] : ""}
                            value={assignmentData[lead._id]?.scheduledDate ?? (lead.followUpDate ? lead.followUpDate.split('T')[0] : "")}
                            onChange={(e) => handleAssignmentChange(lead._id, "scheduledDate", e.target.value)}
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 text-[11px] text-[var(--color-heading)] w-full"
                          />
                          <input
                            type="time"
                            defaultValue={lead.followUpTime || ""}
                            value={assignmentData[lead._id]?.scheduledTime ?? (lead.followUpTime || "")}
                            onChange={(e) => handleAssignmentChange(lead._id, "scheduledTime", e.target.value)}
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 text-[11px] text-[var(--color-heading)] w-24"
                          />
                        </div>
                      </div>

                      {/* Assign Button */}
                      <div className="w-full">
                        <button
                          type="button"
                          onClick={() => {
                            const spId = document.getElementById(`sp-select-${lead._id}`).value;
                            handleAssignLead(lead._id, spId);
                          }}
                          className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer transition active:scale-95 shadow-sm min-h-[38px]"
                        >
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