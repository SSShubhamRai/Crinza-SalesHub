import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const HrPortal = ({ userId, username, onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [employees, setEmployees] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [leaveList, setLeaveList] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [holidays, setHolidays] = useState([]);
  
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Summary Month/Year Filter States
  const [summaryMonth, setSummaryMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [summaryYear, setSummaryYear] = useState(String(new Date().getFullYear()));

  // New Holiday Form States
  const [holidayTitle, setHolidayTitle] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDesc, setHolidayDesc] = useState("");

  // Modal State for Full Email View
  const [modalContent, setModalContent] = useState(null);

  // Rejection Reason Modal States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // ATS Modal & Form States
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newCandidateEmail, setNewCandidateEmail] = useState("");
  const [newCandidatePhone, setNewCandidatePhone] = useState("");
  const [newCandidateRole, setNewCandidateRole] = useState("");
  const [newCandidateResume, setNewCandidateResume] = useState(null);
  const [addingCandidate, setAddingCandidate] = useState(false);

  // Interview Schedule Modal States
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");

  // Date Range & Filter States
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attendanceDate, setAttendanceDate] = useState("");

  // Policy Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("ALL");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Message Form State
  const [selectedEmp, setSelectedEmp] = useState("");
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const API_BASE = import.meta.env.PROD ? "https://crinza-saleshub.onrender.com" : "http://localhost:5000";

  // Fetch HR Data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoadingPerf(true);
      try {
        const token = localStorage.getItem("token");

        let perfUrl = `${API_BASE}/api/hr/summary-performance?`;
        if (fromDate) perfUrl += `from=${fromDate}&`;
        if (toDate) perfUrl += `to=${toDate}&`;

        const perfRes = await fetch(perfUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const perfData = await perfRes.json();
        if (perfRes.ok && perfData.success) {
          setPerformanceData(perfData.performance);
        }

        const empRes = await fetch(`${API_BASE}/api/hr/employees`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const empData = await empRes.json();
        if (empRes.ok) {
          setEmployees(empData);
        }

        let attUrl = `${API_BASE}/api/hr/attendance?`;
        if (attendanceDate) attUrl += `date=${attendanceDate}`;
        const attRes = await fetch(attUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const attData = await attRes.json();
        if (attRes.ok) {
          // Store entire attendance response object to handle holiday data properly
          setAttendanceList(attData);
        }

        const leaveRes = await fetch(`${API_BASE}/api/hr/leaves`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const leaveData = await leaveRes.json();
        if (leaveRes.ok) {
          setLeaveList(leaveData.leaves || []);
        }

        const candRes = await fetch(`${API_BASE}/api/hr/candidates`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const candData = await candRes.json();
        if (candRes.ok) {
          setCandidates(candData.candidates || []);
        }

        // Fetch Attendance Summary & Holidays
        const summaryRes = await fetch(`${API_BASE}/api/hr/attendance-summary?month=${summaryMonth}&year=${summaryYear}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const summaryData = await summaryRes.json();
        if (summaryRes.ok && summaryData.success) {
          setAttendanceSummary(summaryData.summary || []);
        }

        const holidayRes = await fetch(`${API_BASE}/api/hr/holidays`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const holidayData = await holidayRes.json();
        if (holidayRes.ok && holidayData.success) {
          setHolidays(holidayData.holidays || []);
        }

      } catch (err) {
        console.error("Failed to fetch HR data:", err);
      } finally {
        setLoadingPerf(false);
      }
    };
    fetchAllData();
  }, [API_BASE, fromDate, toDate, attendanceDate, activeTab, summaryMonth, summaryYear]);

  const handleLeaveAction = async (leaveId, status, rejectionReason = "") => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/leaves/${leaveId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, rejectionReason })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Leave request ${status.toLowerCase()} successfully and email sent!`);
        setLeaveList((prev) =>
          prev.map((l) => (l._id === leaveId ? { ...l, status, rejectionReason } : l))
        );
        setRejectModalOpen(false);
        setRejectionReasonInput("");
      } else {
        toast.error(data.message || "Failed to update leave status.");
      }
    } catch (err) {
      toast.error("Network error.");
    }
  };

  const handleCandidateAction = async (candidateId, status, extraData = {}) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/candidates/${candidateId}/action`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, ...extraData })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Candidate status updated to ${status} and email sent!`);
        setCandidates((prev) =>
          prev.map((c) => (c._id === candidateId ? { ...c, status, ...extraData } : c))
        );
        setInterviewModalOpen(false);
        setInterviewDate("");
        setInterviewTime("");
      } else {
        toast.error(data.message || "Failed to update candidate status.");
      }
    } catch (err) {
      toast.error("Network error.");
    }
  };

  const handleAddCandidateSubmit = async (e) => {
    e.preventDefault();
    if (!newCandidateResume) {
      toast.error("Please upload candidate resume PDF.");
      return;
    }
    setAddingCandidate(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("name", newCandidateName);
      formData.append("email", newCandidateEmail);
      formData.append("phone", newCandidatePhone);
      formData.append("appliedFor", newCandidateRole);
      formData.append("resume", newCandidateResume);

      const res = await fetch(`${API_BASE}/api/hr/candidates/add`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Candidate added successfully!");
        setCandidates([data.candidate, ...candidates]);
        setShowAddCandidateModal(false);
        setNewCandidateName("");
        setNewCandidateEmail("");
        setNewCandidatePhone("");
        setNewCandidateRole("");
        setNewCandidateResume(null);
      } else {
        toast.error(data.message || "Failed to add candidate.");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setAddingCandidate(false);
    }
  };

  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/holidays`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: holidayTitle, date: holidayDate, description: holidayDesc })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Holiday added successfully!");
        setHolidays([...holidays, data.holiday]);
        setHolidayTitle("");
        setHolidayDate("");
        setHolidayDesc("");
      } else {
        toast.error(data.message || "Failed to add holiday.");
      }
    } catch (err) {
      toast.error("Network error.");
    }
  };

  const handleSyncGmailLeaves = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/sync-gmail-leaves`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setActiveTab("leaves");
        const leaveRes = await fetch(`${API_BASE}/api/hr/leaves`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const leaveData = await leaveRes.json();
        if (leaveRes.ok) setLeaveList(leaveData.leaves || []);
      } else {
        toast.error(data.message || "Sync failed.");
      }
    } catch (err) {
      toast.error("Network error during sync.");
    }
  };

  const handleSyncGmailCandidates = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/sync-gmail-candidates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        const candRes = await fetch(`${API_BASE}/api/hr/candidates`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const candData = await candRes.json();
        if (candRes.ok) setCandidates(candData.candidates || []);
      } else {
        toast.error(data.message || "Candidate sync failed.");
      }
    } catch (err) {
      toast.error("Network error during candidate sync.");
    }
  };

  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a PDF file.");
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("targetAudience", targetAudience);
      formData.append("policyFile", file);

      const res = await fetch(`${API_BASE}/api/hr/upload-policy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Policy uploaded & broadcasted successfully!");
        setTitle("");
        setDescription("");
        setFile(null);
      } else {
        toast.error(data.message || "Upload failed.");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setUploading(false);
    }
  };

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmp || !msgBody) {
      toast.error("Select employee and write message.");
      return;
    }
    setSendingMsg(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId: selectedEmp, title: msgTitle, message: msgBody })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Direct message sent successfully!");
        setSelectedEmp("");
        setMsgTitle("");
        setMsgBody("");
      } else {
        toast.error(data.message || "Failed to send message.");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setSendingMsg(false);
    }
  };

  // Framer Motion variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0.08 }
    }
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 14, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 26 } }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="min-h-screen w-full bg-[var(--color-background)] px-3 sm:px-6 lg:px-10 py-6 overflow-x-hidden selection:bg-[var(--color-primary)] selection:text-white"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header & Greeting Banner */}
        <motion.div 
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 300, damping: 24 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-gradient-to-r from-[var(--color-card)] via-[var(--color-card)] to-[var(--color-surface)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl shadow-xl shadow-black/5 relative overflow-hidden group"
        >
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-gradient-to-br from-[var(--color-primary)]/15 to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
          
          <div className="relative z-10 space-y-1">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              HR COMMAND CENTER
            </motion.div>
            <h1 className="text-xl sm:text-3xl font-black text-[var(--color-heading)] tracking-tight">
              Welcome, {username || "HR Manager"}! ☀️
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-body)]">
              Manage workforce performance, attendance, leaves, and candidate hiring in real-time.
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.04, boxShadow: "0px 8px 25px rgba(239, 68, 68, 0.2)" }}
            onClick={() => setShowLogoutModal(true)}
            className="relative z-10 w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-red-500/10 text-red-600 border border-red-500/20 cursor-pointer transition-all hover:bg-red-500/20 flex items-center justify-center gap-2"
          >
            <span>🚪</span> Logout
          </motion.button>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: "overview", label: "📊 Performance" },
            { id: "attendance", label: "🕒 Attendance" },
            { id: "summary", label: "📅 Attendance Summary" },
            { id: "leaves", label: "🏖️ Leaves" },
            { id: "ats", label: "👥 Candidate ATS" },
            { id: "policies", label: "📄 Policies" },
            { id: "messages", label: "💬 Messages" }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap transition-colors z-10 ${
                  isActive
                    ? "text-white shadow-lg shadow-[var(--color-primary)]/30"
                    : "bg-[var(--color-card)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-[var(--color-primary)] rounded-2xl -z-10 shadow-md shadow-[var(--color-primary)]/40"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                {tab.label}
              </motion.button>
            );
          })}
        </div>

        {/* Main Workspace Frame */}
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="wait">
            
            {/* Tab 1: Salesperson Performance Overview */}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-8 rounded-3xl space-y-6 shadow-sm"
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">Salesperson Performance Review</h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">Track clean metrics like leads, completed demos, and points for sales staff.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex-1 sm:flex-none">
                      <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">From Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                      />
                    </div>
                    <div className="flex-1 sm:flex-none">
                      <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">To Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                      />
                    </div>
                    {(fromDate || toDate) && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { setFromDate(""); setToDate(""); }}
                        className="self-end px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 cursor-pointer transition-colors"
                      >
                        Clear
                      </motion.button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto w-full pb-2">
                  {loadingPerf ? (
                    <div className="space-y-3 py-4">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="w-full h-14 bg-gray-500/10 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : performanceData.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <div className="text-4xl">📊</div>
                      <h4 className="text-sm font-bold text-[var(--color-heading)]">No Performance Records</h4>
                      <p className="text-xs text-[var(--color-body)] max-w-xs mx-auto">No salespersons or records found for the selected filter period.</p>
                    </div>
                  ) : (
                    <motion.table 
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="w-full text-left border-collapse min-w-[600px]"
                    >
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider">
                          <th className="py-3 px-4 font-semibold">Salesperson</th>
                          <th className="py-3 px-4 font-semibold">Role</th>
                          <th className="py-3 px-4 font-semibold">Leads Created</th>
                          <th className="py-3 px-4 font-semibold">Demos Done</th>
                          <th className="py-3 px-4 font-semibold">Sales Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] text-xs sm:text-sm text-[var(--color-heading)]">
                        {performanceData.map((emp) => (
                          <motion.tr 
                            variants={rowVariants}
                            whileHover={{ backgroundColor: "var(--color-surface)", transition: { duration: 0.15 } }}
                            key={emp.id} 
                            className="group transition-colors"
                          >
                            <td className="py-4 px-4 font-semibold group-hover:text-[var(--color-primary)] transition-colors">
                              {emp.name} <span className="text-xs text-[var(--color-body)] font-normal">({emp.userId})</span>
                            </td>
                            <td className="py-4 px-4 capitalize">
                              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-semibold">
                                {emp.role}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-extrabold text-indigo-600">{emp.leadsCreated}</td>
                            <td className="py-4 px-4 font-extrabold text-emerald-600">{emp.demosDone}</td>
                            <td className="py-4 px-4 font-extrabold text-amber-600">{emp.salesPoints} pts</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </motion.table>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab 2: Daily Attendance & Timings */}
            {activeTab === "attendance" && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-8 rounded-3xl space-y-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">🕒 Daily Attendance & Timings</h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">Monitor login start time, logout end time, and work status.</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">Filter by Date</label>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="w-full sm:w-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                    />
                  </div>
                </div>

                {/* 🌟 HOLIDAY BANNER CHECK */}
                {attendanceList && attendanceList.isHoliday ? (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-20 px-6 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-3xl space-y-4 my-6 shadow-sm"
                  >
                    <div className="text-6xl">🎉</div>
                    <h2 className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
                      Company Holiday: {attendanceList.holidayTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-md mx-auto">
                      {attendanceList.holidayDescription || "No attendance tracking required for this date as it is an official company holiday."}
                    </p>
                    <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-xs font-bold">
                      📅 Date: {attendanceList.date}
                    </div>
                  </motion.div>
                ) : !attendanceList.attendance || attendanceList.attendance.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="text-4xl">🕒</div>
                    <h4 className="text-sm font-bold text-[var(--color-heading)]">No Attendance Logs</h4>
                    <p className="text-xs text-[var(--color-body)] max-w-xs mx-auto">No attendance records found for this specific date.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full pb-2">
                    <motion.table 
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="w-full text-left border-collapse min-w-[650px]"
                    >
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider">
                          <th className="py-3 px-4 font-semibold">Salesperson</th>
                          <th className="py-3 px-4 font-semibold">Date</th>
                          <th className="py-3 px-4 font-semibold">Start Time</th>
                          <th className="py-3 px-4 font-semibold">End Time</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] text-xs sm:text-sm text-[var(--color-heading)]">
                        {attendanceList.attendance.map((att) => (
                          <motion.tr 
                            variants={rowVariants}
                            whileHover={{ backgroundColor: "var(--color-surface)" }}
                            key={att._id} 
                            className="transition-colors"
                          >
                            <td className="py-4 px-4 font-semibold">{att.name} <span className="text-xs text-[var(--color-body)]">({att.userId})</span></td>
                            <td className="py-4 px-4">{att.date}</td>
                            <td className="py-4 px-4 font-mono text-emerald-600 font-bold">{att.startTime || "N/A"}</td>
                            <td className="py-4 px-4 font-mono text-rose-600 font-bold">{att.endTime || "Active"}</td>
                            <td className="py-4 px-4">
                              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
                                {att.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </motion.table>
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab: Attendance Summary & Holidays */}
            {activeTab === "summary" && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-8 rounded-3xl space-y-8 shadow-sm"
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">📅 Monthly Attendance Summary & Holidays</h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">Track present days, leaves, Sundays, holidays, and absent days per employee.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">Month</label>
                      <select
                        value={summaryMonth}
                        onChange={(e) => setSummaryMonth(e.target.value)}
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-heading)] outline-none"
                      >
                        <option value="01">January</option>
                        <option value="02">February</option>
                        <option value="03">March</option>
                        <option value="04">April</option>
                        <option value="05">May</option>
                        <option value="06">June</option>
                        <option value="07">July</option>
                        <option value="08">August</option>
                        <option value="09">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">Year</label>
                      <input
                        type="number"
                        value={summaryYear}
                        onChange={(e) => setSummaryYear(e.target.value)}
                        className="w-24 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-heading)] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary Table */}
                <div className="overflow-x-auto w-full pb-2">
                  {attendanceSummary.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <div className="text-3xl">📅</div>
                      <h4 className="text-sm font-bold text-[var(--color-heading)]">No Summary Data</h4>
                      <p className="text-xs text-[var(--color-body)]">No attendance records found for this month/year.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider">
                          <th className="py-3 px-4 font-semibold">Employee</th>
                          <th className="py-3 px-4 font-semibold text-center">Present</th>
                          <th className="py-3 px-4 font-semibold text-center">Leaves</th>
                          <th className="py-3 px-4 font-semibold text-center">Sundays</th>
                          <th className="py-3 px-4 font-semibold text-center">Holidays</th>
                          <th className="py-3 px-4 font-semibold text-center">Absent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] text-xs sm:text-sm text-[var(--color-heading)]">
                        {attendanceSummary.map((item) => (
                          <tr key={item.userId} className="hover:bg-[var(--color-surface)] transition-colors">
                            <td className="py-4 px-4 font-semibold">{item.name} <span className="text-xs text-[var(--color-body)]">({item.userId})</span></td>
                            <td className="py-4 px-4 text-center font-extrabold text-emerald-600">{item.presentDays}</td>
                            <td className="py-4 px-4 text-center font-extrabold text-blue-600">{item.leaveDays}</td>
                            <td className="py-4 px-4 text-center font-extrabold text-purple-600">{item.sundays}</td>
                            <td className="py-4 px-4 text-center font-extrabold text-amber-600">{item.holidays}</td>
                            <td className="py-4 px-4 text-center font-extrabold text-red-600">{item.absentDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Holiday Management Section */}
                <div className="border-t border-[var(--color-border)] pt-6 space-y-4">
                  <h4 className="text-sm font-bold text-[var(--color-heading)]">🎉 Manage Company Holidays for this Month</h4>
                  <form onSubmit={handleHolidaySubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">Holiday Title *</label>
                      <input
                        type="text"
                        value={holidayTitle}
                        onChange={(e) => setHolidayTitle(e.target.value)}
                        placeholder="e.g. Diwali"
                        className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">Date *</label>
                      <input
                        type="date"
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--color-body)] mb-1">Description</label>
                      <input
                        type="text"
                        value={holidayDesc}
                        onChange={(e) => setHolidayDesc(e.target.value)}
                        placeholder="Optional details"
                        className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)] outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-md"
                    >
                      Add Holiday 🚀
                    </button>
                  </form>

                  {/* Holiday List */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {holidays.length === 0 ? (
                      <p className="text-xs text-[var(--color-body)] italic">No company holidays added yet.</p>
                    ) : (
                      holidays.map((h) => (
                        <div key={h._id} className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-medium flex items-center gap-2">
                          <span>🎉 {h.title}</span>
                          <span className="font-mono text-[10px]">({h.date})</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </motion.div>
            )}

            {/* Tab 3: Leave Management */}
            {activeTab === "leaves" && (
              <motion.div
                key="leaves"
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-8 rounded-3xl space-y-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">🏖️ Leave Management</h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">Review, approve, or reject leave requests.</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.03, boxShadow: "0px 6px 20px rgba(16, 185, 129, 0.25)" }}
                    onClick={handleSyncGmailLeaves}
                    className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                  >
                    <span>🔄</span> Sync Leaves from Gmail
                  </motion.button>
                </div>

                <div className="overflow-x-auto w-full pb-2">
                  {leaveList.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <div className="text-4xl">🏖️</div>
                      <h4 className="text-sm font-bold text-[var(--color-heading)]">No Leave Applications</h4>
                      <p className="text-xs text-[var(--color-body)] max-w-xs mx-auto">All clean! No pending or past leave requests found.</p>
                    </div>
                  ) : (
                    <motion.table 
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="w-full text-left border-collapse min-w-[700px]"
                    >
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider">
                          <th className="py-3 px-4 font-semibold">Employee</th>
                          <th className="py-3 px-4 font-semibold">Duration</th>
                          <th className="py-3 px-4 font-semibold">Reason / Email</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 text-center font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] text-xs sm:text-sm text-[var(--color-heading)]">
                        {leaveList.map((leave) => (
                          <motion.tr 
                            variants={rowVariants}
                            whileHover={{ backgroundColor: "var(--color-surface)" }}
                            key={leave._id} 
                            className="transition-colors"
                          >
                            <td className="py-4 px-4 font-semibold">{leave.name} <span className="text-xs text-[var(--color-body)]">({leave.userId})</span></td>
                            <td className="py-4 px-4 font-medium">{leave.fromDate} to {leave.toDate}</td>
                            <td 
                              onClick={() => setModalContent(leave.reason)}
                              className="py-4 px-4 text-blue-500 underline cursor-pointer max-w-xs truncate hover:text-blue-600 transition-colors"
                              title="Click to view full email content"
                            >
                              {leave.reason}
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                leave.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' :
                                leave.status === 'Rejected' ? 'bg-red-500/10 text-red-600' :
                                'bg-amber-500/10 text-amber-600'
                              }`}>
                                {leave.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center space-x-2">
                              {leave.status === "Pending" ? (
                                <>
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    whileHover={{ scale: 1.06 }}
                                    onClick={() => handleLeaveAction(leave._id, "Approved")}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                                  >
                                    Approve
                                  </motion.button>
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    whileHover={{ scale: 1.06 }}
                                    onClick={() => {
                                      setSelectedLeaveId(leave._id);
                                      setRejectModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs"
                                  >
                                    Reject
                                  </motion.button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Action taken</span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </motion.table>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab 4: Candidate ATS (Applicant Tracking System) */}
            {activeTab === "ats" && (
              <motion.div
                key="ats"
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-8 rounded-3xl space-y-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">👥 Applicant Tracking System (ATS)</h3>
                    <p className="text-xs text-[var(--color-body)] mt-0.5">Manage job applicants, review resumes, schedule interviews, and update statuses.</p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.03 }}
                      onClick={handleSyncGmailCandidates}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                    >
                      <span>🔄</span> Sync Candidates from Gmail
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => setShowAddCandidateModal(true)}
                      className="px-5 py-3 bg-[var(--color-primary)] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[var(--color-primary)]/20"
                    >
                      <span>➕</span> Add Candidate / Upload Resume
                    </motion.button>
                  </div>
                </div>

                <div className="overflow-x-auto w-full pb-2">
                  {candidates.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <div className="text-4xl">👥</div>
                      <h4 className="text-sm font-bold text-[var(--color-heading)]">No Candidates Found</h4>
                      <p className="text-xs text-[var(--color-body)] max-w-xs mx-auto">No job applicants added yet. Click above to add one.</p>
                    </div>
                  ) : (
                    <motion.table 
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="w-full text-left border-collapse min-w-[750px]"
                    >
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider">
                          <th className="py-3 px-4 font-semibold">Candidate</th>
                          <th className="py-3 px-4 font-semibold">Role Applied</th>
                          <th className="py-3 px-4 font-semibold">Resume</th>
                          <th className="py-3 px-4 font-semibold">Status & Details</th>
                          <th className="py-3 px-4 text-center font-semibold">Actions / Schedule</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] text-xs sm:text-sm text-[var(--color-heading)]">
                        {candidates.map((cand) => (
                          <motion.tr 
                            variants={rowVariants}
                            whileHover={{ backgroundColor: "var(--color-surface)" }}
                            key={cand._id} 
                            className="transition-colors"
                          >
                            <td className="py-4 px-4">
                              <div className="font-semibold">{cand.name}</div>
                              <div className="text-[11px] text-[var(--color-body)]">{cand.email} {cand.phone && `• ${cand.phone}`}</div>
                            </td>
                            <td className="py-4 px-4 font-medium">{cand.appliedFor}</td>
                            <td className="py-4 px-4">
                              <a 
                                href={cand.resumeUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-semibold text-xs transition"
                              >
                                <span>📄</span> View PDF
                              </a>
                            </td>
                            <td className="py-4 px-4 space-y-1">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                cand.status === 'Selected' ? 'bg-emerald-500/10 text-emerald-600' :
                                cand.status === 'Rejected' ? 'bg-red-500/10 text-red-600' :
                                cand.status === 'Interview Scheduled' ? 'bg-indigo-500/10 text-indigo-600' :
                                cand.status === 'Shortlisted' ? 'bg-blue-500/10 text-blue-600' :
                                'bg-amber-500/10 text-amber-600'
                              }`}>
                                {cand.status}
                              </span>
                              {cand.interviewDate && (
                                <div className="text-[11px] text-[var(--color-body)] font-mono">
                                  📅 {cand.interviewDate} at {cand.interviewTime}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center space-y-2">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => handleCandidateAction(cand._id, "Shortlisted")}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
                                >
                                  Shortlist
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedCandidateId(cand._id);
                                    setInterviewModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
                                >
                                  {cand.interviewDate ? "Modify Interview" : "Schedule Interview"}
                                </button>
                                <button
                                  onClick={() => handleCandidateAction(cand._id, "Selected")}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                                >
                                  Select
                                </button>
                                <button
                                  onClick={() => handleCandidateAction(cand._id, "Rejected", { hrReview: "Not meeting current requirements." })}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </motion.table>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab 5: Policy Uploader */}
            {activeTab === "policies" && (
              <motion.form
                key="policies"
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handlePolicySubmit} 
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-8 rounded-3xl space-y-5 shadow-sm"
              >
                <div className="border-b border-[var(--color-border)] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">📤 Broadcast Company Policy (PDF)</h3>
                  <p className="text-xs text-[var(--color-body)] mt-0.5">Upload official documents to notify and distribute guidelines.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Document Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Code of Conduct 2026"
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Target Audience</label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                    >
                      <option value="ALL">All Staff (Sales + Telecallers)</option>
                      <option value="salesperson">Sales Team Only</option>
                      <option value="telecaller">Telecallers Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Description</label>
                  <textarea
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief note about this policy..."
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Upload PDF *</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="block w-full text-xs text-[var(--color-body)] cursor-pointer file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 transition-all"
                    required
                  />
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.01 }}
                  type="submit"
                  disabled={uploading}
                  className="w-full sm:w-auto px-8 bg-[var(--color-primary)] text-white py-4 rounded-xl font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-[var(--color-primary)]/25"
                >
                  {uploading ? "Uploading PDF..." : "Publish & Broadcast Policy 🚀"}
                </motion.button>
              </motion.form>
            )}

            {/* Tab 6: Direct Messaging */}
            {activeTab === "messages" && (
              <motion.form
                key="messages"
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={handleMessageSubmit} 
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-8 rounded-3xl space-y-5 shadow-sm"
              >
                <div className="border-b border-[var(--color-border)] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">💬 Send 1-to-1 Direct Message</h3>
                  <p className="text-xs text-[var(--color-body)] mt-0.5">Communicate directly via private notifications.</p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Select Employee *</label>
                  <select
                    value={selectedEmp}
                    onChange={(e) => setSelectedEmp(e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Subject / Title</label>
                  <input
                    type="text"
                    value={msgTitle}
                    onChange={(e) => setMsgTitle(e.target.value)}
                    placeholder="e.g. Urgent Performance Review"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Message *</label>
                  <textarea
                    rows="4"
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                    required
                  ></textarea>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.01 }}
                  type="submit"
                  disabled={sendingMsg}
                  className="w-full sm:w-auto px-8 bg-[var(--color-primary)] text-white py-4 rounded-xl font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-[var(--color-primary)]/25"
                >
                  {sendingMsg ? "Sending..." : "Send Private Message 📨"}
                </motion.button>
              </motion.form>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-[var(--color-heading)] border-b pb-2">Full Email Content</h3>
              <div className="max-h-60 overflow-y-auto text-xs sm:text-sm text-[var(--color-body)] whitespace-pre-wrap bg-[var(--color-surface)] p-4 rounded-xl border">
                {modalContent}
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => setModalContent(null)} className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {rejectModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Reason for Rejection</h3>
              <p className="text-xs text-[var(--color-body)]">Please provide a reason why this leave request is being rejected.</p>
              <textarea rows="3" value={rejectionReasonInput} onChange={(e) => setRejectionReasonInput(e.target.value)} placeholder="e.g. Critical project deadline..." className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"></textarea>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setRejectModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[var(--color-surface)] border text-[var(--color-heading)] cursor-pointer">Cancel</button>
                <button onClick={() => handleLeaveAction(selectedLeaveId, "Rejected", rejectionReasonInput)} className="flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-red-600 text-white cursor-pointer">Confirm & Send</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Add Candidate Modal */}
        {showAddCandidateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Add Job Candidate</h3>
              <form onSubmit={handleAddCandidateSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name *</label>
                  <input type="text" value={newCandidateName} onChange={(e) => setNewCandidateName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email *</label>
                  <input type="email" value={newCandidateEmail} onChange={(e) => setNewCandidateEmail(e.target.value)} placeholder="rahul@gmail.com" className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Phone</label>
                  <input type="text" value={newCandidatePhone} onChange={(e) => setNewCandidatePhone(e.target.value)} placeholder="+91 9876543210" className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Role Applied For *</label>
                  <input type="text" value={newCandidateRole} onChange={(e) => setNewCandidateRole(e.target.value)} placeholder="e.g. Sales Executive" className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Resume (PDF) *</label>
                  <input type="file" accept="application/pdf" onChange={(e) => setNewCandidateResume(e.target.files[0])} className="w-full bg-[var(--color-surface)] border rounded-xl p-2 text-xs" required />
                </div>
                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setShowAddCandidateModal(false)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                  <button type="submit" disabled={addingCandidate} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[var(--color-primary)] text-white cursor-pointer">{addingCandidate ? "Saving..." : "Save Candidate"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Schedule / Modify Interview Modal */}
        {interviewModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Schedule / Modify Interview</h3>
              <p className="text-xs text-[var(--color-body)]">Select the date and time for the candidate interview. An email will be sent automatically.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Interview Date *</label>
                  <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Interview Time *</label>
                  <input type="text" value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} placeholder="e.g. 03:00 PM IST" className="w-full bg-[var(--color-surface)] border rounded-xl p-2.5 text-xs text-[var(--color-heading)]" required />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setInterviewModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                <button onClick={() => handleCandidateAction(selectedCandidateId, "Interview Scheduled", { interviewDate, interviewTime })} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white cursor-pointer">Confirm & Send Email</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showLogoutModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0, y: 20 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl text-center">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Confirm Logout</h3>
              <p className="text-xs sm:text-sm text-[var(--color-body)]">Are you sure you want to log out?</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-[var(--color-surface)] border text-[var(--color-heading)] cursor-pointer">No</button>
                <button onClick={() => { setShowLogoutModal(false); onLogout(); }} className="flex-1 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-red-600 text-white cursor-pointer">Yes Logout</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HrPortal;