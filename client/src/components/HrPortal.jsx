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

  // Role Filter State for Employees Tab
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("ALL");

  // Add Employee Modal States
  const [addEmpModalOpen, setAddEmpModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("salesperson");
  const [newJoiningDate, setNewJoiningDate] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [addingEmp, setAddingEmp] = useState(false);

  // Edit Employee Modal States
  const [editEmpModalOpen, setEditEmpModalOpen] = useState(false);
  const [selectedEmpForEdit, setSelectedEmpForEdit] = useState(null);
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  // Document Dispatch Modal States
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [selectedEmpForDoc, setSelectedEmpForDoc] = useState(null);
  const [docType, setDocType] = useState("OfferLetter"); 
  const [monthYearInput, setMonthYearInput] = useState("September 2026");
  const [customMsgInput, setCustomMsgInput] = useState("");
  const [docPdfFile, setDocPdfFile] = useState(null);
  const [sendingDoc, setSendingDoc] = useState(false);

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

  // Google Sheet Sync Modal States Added with JD PDF Support
  const [syncSheetModalOpen, setSyncSheetModalOpen] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [sheetRoleInput, setSheetRoleInput] = useState("");
  const [jdPdfFile, setJdPdfFile] = useState(null); 
  const [syncingSheet, setSyncingSheet] = useState(false);

  // Job Description Upload States for HR
  const [jdUploadModalOpen, setJdUploadModalOpen] = useState(false);
  const [jdRoleInput, setJdRoleInput] = useState("");
  const [jdTitleInput, setJdTitleInput] = useState("");
  const [jdFilePdf, setJdFilePdf] = useState(null);
  const [uploadingJd, setUploadingJd] = useState(false);

  // Candidate Details Modal States
  const [candidateDetailModalOpen, setCandidateDetailModalOpen] = useState(false);
  const [selectedCandidateForDetail, setSelectedCandidateForDetail] = useState(null);

  // Interview Schedule Modal States
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");

  // 🌟 Real HR Name store karne ke liye state
  const [hrName, setHrName] = useState(username);

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

  const [atsRoleFilter, setAtsRoleFilter] = useState("ALL");

  // 🌟 Active candidates count excluding "Rejected" status
const activeCandidatesCount = candidates.filter(c => c.status?.toLowerCase() !== 'rejected').length;

// 🌟 Dynamic Role Filtered Candidates List for ATS Tab
const uniqueRoles = ["ALL", ...new Set(candidates.map(c => c.appliedFor).filter(Boolean))];
const filteredCandidates = candidates.filter(cand => {
  if (atsRoleFilter === "ALL") return true;
  return cand.appliedFor?.toLowerCase().trim() === atsRoleFilter.toLowerCase().trim();
});

// 🌟 Filter current month leaves for Leaves Tab
const filteredLeaveList = leaveList.filter(leave => {
  if (!leave.fromDate) return false;
  return leave.fromDate.startsWith(`${summaryYear}-${summaryMonth}`);
});

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

  // 🌟 Yahan logged-in userId (jaise CRZ-HR-01) ko employee list se match karke uska Name nikal rahe hain
  const loggedInHr = empData.find(emp => emp.userId === userId || emp._id === userId);
  if (loggedInHr && loggedInHr.name) {
    setHrName(loggedInHr.name);
  }
}

        let attUrl = `${API_BASE}/api/hr/attendance?`;
        if (attendanceDate) attUrl += `date=${attendanceDate}`;
        const attRes = await fetch(attUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const attData = await attRes.json();
        if (attRes.ok) {
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

  const handleAddEmployeeSubmit = async (e) => {
    e.preventDefault();
    setAddingEmp(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/manage-employees/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          password: newPassword,
          role: newRole,
          joiningDate: newJoiningDate,
          salary: Number(newSalary)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Employee added successfully!");
        setEmployees([data.employee, ...employees]);
        setAddEmpModalOpen(false);
        setNewName("");
        setNewEmail("");
        setNewPhone("");
        setNewPassword("");
        setNewJoiningDate("");
        setNewSalary("");
      } else {
        toast.error(data.message || "Failed to add employee.");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setAddingEmp(false);
    }
  };

  const handleUpdateEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/manage-employees/${selectedEmpForEdit._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: editRole,
          joiningDate: editJoiningDate,
          salary: Number(editSalary),
          status: editStatus
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Employee details updated successfully!");
        setEmployees(employees.map(emp => emp._id === selectedEmpForEdit._id ? data.employee : emp));
        setEditEmpModalOpen(false);
      } else {
        toast.error(data.message || "Failed to update employee.");
      }
    } catch (err) {
      toast.error("Network error.");
    }
  };

  const handleSendDocumentSubmit = async (e) => {
    e.preventDefault();
    setSendingDoc(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("employeeId", selectedEmpForDoc._id);
      formData.append("docType", docType);
      formData.append("monthYear", monthYearInput);
      formData.append("customMessage", customMsgInput);
      if (docPdfFile) {
        formData.append("pdfFile", docPdfFile);
      }

      const res = await fetch(`${API_BASE}/api/hr/manage-employees/send-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setDocModalOpen(false);
        setCustomMsgInput("");
        setDocPdfFile(null);
      } else {
        toast.error(data.message || "Failed to dispatch document.");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setSendingDoc(false);
    }
  };

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

  const handleSyncSheetSubmit = async (e) => {
    e.preventDefault();
    if (!sheetUrlInput || !sheetRoleInput) {
      toast.error("Please provide Google Sheet URL and Job Role.");
      return;
    }

    setSyncingSheet(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("sheetUrl", sheetUrlInput);
      formData.append("role", sheetRoleInput);
      if (jdPdfFile) {
        formData.append("jdPdf", jdPdfFile);
      }

      const res = await fetch(`${API_BASE}/api/hr/sync-sheet`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message);
        setSyncSheetModalOpen(false);
        setSheetUrlInput("");
        setSheetRoleInput("");
        setJdPdfFile(null);

        const candRes = await fetch(`${API_BASE}/api/hr/candidates`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const candData = await candRes.json();
        if (candRes.ok) setCandidates(candData.candidates || []);
      } else {
        toast.error(data.message || "Failed to sync Google Sheet.");
      }
    } catch (err) {
      toast.error("Network error during sheet sync.");
    } finally {
      setSyncingSheet(false);
    }
  };

  const handleJdUploadSubmit = async (e) => {
    e.preventDefault();
    if (!jdRoleInput || !jdTitleInput || !jdFilePdf) {
      toast.error("Please fill all fields and select a JD PDF.");
      return;
    }

    setUploadingJd(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("role", jdRoleInput);
      formData.append("title", jdTitleInput);
      formData.append("jdPdf", jdFilePdf);

      const res = await fetch(`${API_BASE}/api/hr/upload-jd`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message);
        setJdUploadModalOpen(false);
        setJdRoleInput("");
        setJdTitleInput("");
        setJdFilePdf(null);
      } else {
        toast.error(data.message || "Failed to upload JD.");
      }
    } catch (err) {
      toast.error("Network error while uploading JD.");
    } finally {
      setUploadingJd(false);
    }
  };

  const handleReevaluateAi = async () => {
    const toastId = toast.loading("Running AI evaluation for N/A candidates...");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/hr/candidates/re-evaluate-ai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message, { id: toastId });
        const candRes = await fetch(`${API_BASE}/api/hr/candidates`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const candData = await candRes.json();
        if (candRes.ok) setCandidates(candData.candidates || []);
      } else {
        toast.error(data.message || "Failed.", { id: toastId });
      }
    } catch (e) {
      toast.error("Network error.", { id: toastId });
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.03, delayChildren: 0.05 }
    }
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] px-3 sm:px-6 lg:px-10 py-6 overflow-x-hidden selection:bg-[var(--color-primary)] selection:text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header & Greeting Banner */}
        <motion.div 
          initial={{ y: -15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r from-[var(--color-card)] via-[var(--color-card)] to-[var(--color-surface)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden backdrop-blur-xl"
        >
          <div className="absolute -right-20 -top-20 w-72 h-72 bg-gradient-to-br from-[var(--color-primary)]/20 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black tracking-wider bg-blue-500/15 text-blue-500 border border-blue-500/30 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              HR COMMAND CENTER
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--color-heading)] tracking-tight">
  Welcome back, {hrName || username || "HR Manager"}! 👋
</h1>

            <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-xl">
              Monitor workforce performance, approve daily leaves, track active candidates, and manage enterprise policies securely.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowLogoutModal(true)}
            className="relative z-10 w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-red-500/10 text-red-500 border border-red-500/25 cursor-pointer transition-all hover:bg-red-500/20 flex items-center justify-center gap-2.5 shadow-md"
          >
            <span>🚪</span> Logout Session
          </motion.button>
        </motion.div>

        {/* Quick Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Employees", count: employees.length, icon: "👥", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
            { label: "Pending Leaves", count: leaveList.filter(l => l.status === 'Pending').length, icon: "🏖️", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
            { label: "Active Candidates", count: activeCandidatesCount, icon: "🎯", color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20" },
            { label: "Holidays Set", count: holidays.length, icon: "🎉", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
          ].map((stat, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -3 }}
              className={`p-4 sm:p-5 rounded-2xl border ${stat.bg} backdrop-blur-md shadow-sm flex items-center justify-between`}
            >
              <div>
                <p className="text-[11px] font-bold text-[var(--color-body)] uppercase tracking-wide">{stat.label}</p>
                <h3 className={`text-xl sm:text-2xl font-black mt-1 ${stat.color}`}>{stat.count}</h3>
              </div>
              <span className="text-2xl sm:text-3xl p-2.5 rounded-xl bg-[var(--color-card)] shadow-xs">{stat.icon}</span>
            </motion.div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { id: "overview", label: "📊 Performance" },
            { id: "employees", label: "👔 Employees" },
            { id: "attendance", label: "🕒 Attendance" },
            { id: "summary", label: "📅 Summary" },
            { id: "leaves", label: "🏖️ Leaves" },
            { id: "ats", label: "👥 ATS" },
            { id: "policies", label: "📄 Policies" },
            { id: "messages", label: "💬 Messages" }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap transition-all duration-200 shrink-0 ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30"
                    : "bg-[var(--color-card)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40"
                }`}
              >
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">Salesperson Performance Review</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Track clean metrics like leads, completed demos, and points for sales staff.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex-1 sm:flex-none">
                      <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">From Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                      />
                    </div>
                    <div className="flex-1 sm:flex-none">
                      <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">To Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none transition-all"
                      />
                    </div>
                    {(fromDate || toDate) && (
                      <button
                        onClick={() => { setFromDate(""); setToDate(""); }}
                        className="self-end px-4 py-3 rounded-2xl text-xs font-semibold bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 cursor-pointer transition-colors"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                </div>

                {loadingPerf ? (
                  <div className="space-y-3 py-6">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="w-full h-16 bg-gray-500/10 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : performanceData.length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <div className="text-5xl">📊</div>
                    <h4 className="text-base font-bold text-[var(--color-heading)]">No Performance Records</h4>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-sm mx-auto">No salespersons or records found for the selected filter period.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto w-full pb-2">
                      <motion.table 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="w-full text-left border-collapse"
                      >
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider bg-[var(--color-surface)]/50">
                            <th className="py-4 px-5 font-bold rounded-l-2xl">Salesperson</th>
                            <th className="py-4 px-5 font-bold">Role</th>
                            <th className="py-4 px-5 font-bold">Leads Created</th>
                            <th className="py-4 px-5 font-bold">Demos Done</th>
                            <th className="py-4 px-5 font-bold rounded-r-2xl">Sales Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-sm text-[var(--color-heading)]">
                          {performanceData.map((emp) => (
                            <motion.tr 
                              variants={rowVariants}
                              key={emp.id} 
                              className="group hover:bg-[var(--color-surface)] transition-colors"
                            >
                              <td className="py-4 px-5 font-bold group-hover:text-[var(--color-primary)] transition-colors">
                                {emp.name} <span className="text-xs text-[var(--color-body)] font-normal block sm:inline">({emp.userId})</span>
                              </td>
                              <td className="py-4 px-5 capitalize">
                                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold border border-blue-500/20">
                                  {emp.role}
                                </span>
                              </td>
                              <td className="py-4 px-5 font-black text-indigo-500 text-base">{emp.leadsCreated}</td>
                              <td className="py-4 px-5 font-black text-emerald-500 text-base">{emp.demosDone}</td>
                              <td className="py-4 px-5 font-black text-amber-500 text-base">{emp.salesPoints} pts</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </motion.table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {performanceData.map((emp) => (
                        <div key={emp.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-sm text-[var(--color-heading)]">{emp.name}</h4>
                              <p className="text-[11px] text-[var(--color-body)] font-mono">{emp.userId}</p>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase border border-blue-500/20">
                              {emp.role}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)] text-center">
                            <div className="bg-[var(--color-card)] p-2 rounded-xl border border-[var(--color-border)]">
                              <span className="block text-[10px] text-[var(--color-body)]">Leads</span>
                              <span className="font-black text-indigo-500 text-sm">{emp.leadsCreated}</span>
                            </div>
                            <div className="bg-[var(--color-card)] p-2 rounded-xl border border-[var(--color-border)]">
                              <span className="block text-[10px] text-[var(--color-body)]">Demos</span>
                              <span className="font-black text-emerald-500 text-sm">{emp.demosDone}</span>
                            </div>
                            <div className="bg-[var(--color-card)] p-2 rounded-xl border border-[var(--color-border)]">
                              <span className="block text-[10px] text-[var(--color-body)]">Points</span>
                              <span className="font-black text-amber-500 text-sm">{emp.salesPoints}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Tab: Employee Management */}
            {activeTab === "employees" && (
              <motion.div
                key="employees"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">👔 Employee Directory & Control</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Manage staff profiles, joining dates, salaries, and dispatch documents.</p>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setAddEmpModalOpen(true)}
                      className="flex-1 sm:flex-none px-5 py-3 bg-[var(--color-primary)] text-white rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                    >
                      <span>➕</span> Add Employee
                    </motion.button>

                    <div className="flex-1 sm:flex-none">
                      <select
                        value={selectedRoleFilter}
                        onChange={(e) => setSelectedRoleFilter(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      >
                        <option value="ALL">All Roles</option>
                        <option value="salesperson">Salesperson</option>
                        <option value="accountant">Accountant</option>
                        <option value="technical">Technical</option>
                        <option value="telecaller">Telecaller</option>
                        <option value="hr">HR</option>
                      </select>
                    </div>
                  </div>
                </div>

                {employees.filter(emp => selectedRoleFilter === "ALL" || emp.role === selectedRoleFilter).length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <div className="text-5xl">👔</div>
                    <h4 className="text-base font-bold text-[var(--color-heading)]">No Employees Found</h4>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-sm mx-auto">No staff records found for the selected role filter.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto w-full pb-2">
                      <motion.table 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="w-full text-left border-collapse"
                      >
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider bg-[var(--color-surface)]/50">
                            <th className="py-4 px-5 font-bold rounded-l-2xl">Employee</th>
                            <th className="py-4 px-5 font-bold">Role</th>
                            <th className="py-4 px-5 font-bold">Joining Date</th>
                            <th className="py-4 px-5 font-bold">Salary (INR)</th>
                            <th className="py-4 px-5 font-bold">Status</th>
                            <th className="py-4 px-5 text-center font-bold rounded-r-2xl">Actions & Documents</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-sm text-[var(--color-heading)]">
                          {employees
                            .filter(emp => selectedRoleFilter === "ALL" || emp.role === selectedRoleFilter)
                            .map((emp) => (
                              <motion.tr 
                                variants={rowVariants}
                                key={emp._id} 
                                className="hover:bg-[var(--color-surface)] transition-colors"
                              >
                                <td className="py-4 px-5">
                                  <div className="font-bold">{emp.name}</div>
                                  <div className="text-xs text-[var(--color-body)]">{emp.email} {emp.phone && `• ${emp.phone}`}</div>
                                </td>
                                <td className="py-4 px-5 capitalize">
                                  <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold border border-blue-500/20">
                                    {emp.role}
                                  </span>
                                </td>
                                <td className="py-4 px-5 font-mono text-xs">{emp.joiningDate || "Not Set"}</td>
                                <td className="py-4 px-5 font-black text-emerald-500">₹{emp.salary ? emp.salary.toLocaleString('en-IN') : "0"}</td>
                                <td className="py-4 px-5">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    emp.status === 'inactive' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  }`}>
                                    {emp.status || "active"}
                                  </span>
                                </td>
                                <td className="py-4 px-5 text-center">
                                  <div className="flex items-center justify-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => {
                                        setSelectedEmpForEdit(emp);
                                        setEditRole(emp.role);
                                        setEditJoiningDate(emp.joiningDate || "");
                                        setEditSalary(emp.salary || "");
                                        setEditStatus(emp.status || "active");
                                        setEditEmpModalOpen(true);
                                      }}
                                      className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-sm active:scale-95"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedEmpForDoc(emp);
                                        setDocType("OfferLetter");
                                        setDocModalOpen(true);
                                      }}
                                      className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-sm active:scale-95"
                                    >
                                      Offer Letter
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedEmpForDoc(emp);
                                        setDocType("SalarySlip");
                                        setDocModalOpen(true);
                                      }}
                                      className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shadow-sm active:scale-95"
                                    >
                                      Salary Slip
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                        </tbody>
                      </motion.table>
                    </div>

                    <div className="md:hidden space-y-4">
                      {employees
                        .filter(emp => selectedRoleFilter === "ALL" || emp.role === selectedRoleFilter)
                        .map((emp) => (
                          <div key={emp._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-sm text-[var(--color-heading)]">{emp.name}</h4>
                                <p className="text-xs text-[var(--color-body)]">{emp.email}</p>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                emp.status === 'inactive' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                              }`}>
                                {emp.status || "active"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[var(--color-border)]">
                              <div>
                                <span className="text-[var(--color-body)]">Role:</span> <span className="font-bold capitalize">{emp.role}</span>
                              </div>
                              <div>
                                <span className="text-[var(--color-body)]">Salary:</span> <span className="font-bold text-emerald-500">₹{emp.salary ? emp.salary.toLocaleString('en-IN') : "0"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                              <button
                                onClick={() => {
                                  setSelectedEmpForEdit(emp);
                                  setEditRole(emp.role);
                                  setEditJoiningDate(emp.joiningDate || "");
                                  setEditSalary(emp.salary || "");
                                  setEditStatus(emp.status || "active");
                                  setEditEmpModalOpen(true);
                                }}
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white active:scale-95 transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedEmpForDoc(emp);
                                  setDocType("OfferLetter");
                                  setDocModalOpen(true);
                                }}
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white active:scale-95 transition"
                              >
                                Offer
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedEmpForDoc(emp);
                                  setDocType("SalarySlip");
                                  setDocModalOpen(true);
                                }}
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white active:scale-95 transition"
                              >
                                Slip
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Tab 2: Daily Attendance & Timings */}
            {activeTab === "attendance" && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">🕒 Daily Attendance & Timings</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Monitor login start time, logout end time, and active workforce status.</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">Filter by Date</label>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="w-full sm:w-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                    />
                  </div>
                </div>

                {attendanceList && attendanceList.isHoliday ? (
                  <motion.div 
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-20 px-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-3xl space-y-4 my-4 shadow-sm"
                  >
                    <div className="text-6xl">🎉</div>
                    <h2 className="text-xl sm:text-3xl font-black text-amber-500">
                      {attendanceList.holidayTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-md mx-auto">
                      {attendanceList.holidayDescription || attendanceList.message}
                    </p>
                    <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-500 font-mono text-xs font-bold">
                      📅 Date: {attendanceList.date}
                    </div>
                  </motion.div>
                ) : !attendanceList.attendance || attendanceList.attendance.length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <div className="text-5xl">🕒</div>
                    <h4 className="text-base font-bold text-[var(--color-heading)]">No Attendance Logs</h4>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-sm mx-auto">No attendance records found for this specific date.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto w-full pb-2">
                      <motion.table 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="w-full text-left border-collapse"
                      >
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider bg-[var(--color-surface)]/50">
                            <th className="py-4 px-5 font-bold rounded-l-2xl">Salesperson</th>
                            <th className="py-4 px-5 font-bold">Date</th>
                            <th className="py-4 px-5 font-bold">Start Time</th>
                            <th className="py-4 px-5 font-bold">End Time</th>
                            <th className="py-4 px-5 font-bold rounded-r-2xl">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-sm text-[var(--color-heading)]">
                          {attendanceList.attendance.map((att) => (
                            <motion.tr 
                              variants={rowVariants}
                              key={att._id} 
                              className="hover:bg-[var(--color-surface)] transition-colors"
                            >
                              <td className="py-4 px-5 font-bold">{att.name} <span className="text-xs text-[var(--color-body)] font-normal block sm:inline">({att.userId})</span></td>
                              <td className="py-4 px-5">{att.date}</td>
                              <td className="py-4 px-5 font-mono text-emerald-500 font-bold">{att.startTime || "N/A"}</td>
                              <td className="py-4 px-5 font-mono text-rose-500 font-bold">{att.endTime || "Active"}</td>
                              <td className="py-4 px-5">
                                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
                                  {att.status}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </motion.table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {attendanceList.attendance.map((att) => (
                        <div key={att._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-sm text-[var(--color-heading)]">{att.name}</h4>
                              <p className="text-[11px] text-[var(--color-body)] font-mono">{att.userId} • {att.date}</p>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                              {att.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono border-t border-[var(--color-border)]">
                            <div>In: <span className="text-emerald-500 font-bold">{att.startTime || "N/A"}</span></div>
                            <div>Out: <span className="text-rose-500 font-bold">{att.endTime || "Active"}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Tab: Attendance Summary & Holidays */}
            {activeTab === "summary" && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-8 shadow-xl backdrop-blur-md"
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">📅 Monthly Attendance Summary & Holidays</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Track present days, leaves, Sundays, holidays, and absent days per employee.</p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-none">
                      <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">Month</label>
                      <select
                        value={summaryMonth}
                        onChange={(e) => setSummaryMonth(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
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
                      <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">Year</label>
                      <input
                        type="number"
                        value={summaryYear}
                        onChange={(e) => setSummaryYear(e.target.value)}
                        className="w-24 sm:w-28 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {attendanceSummary.length === 0 ? (
                  <div className="text-center py-16 space-y-2">
                    <div className="text-4xl">📅</div>
                    <h4 className="text-base font-bold text-[var(--color-heading)]">No Summary Data</h4>
                    <p className="text-xs text-[var(--color-body)]">No attendance records found for this month/year.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto w-full pb-2">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider bg-[var(--color-surface)]/50">
                            <th className="py-4 px-5 font-bold rounded-l-2xl">Employee</th>
                            <th className="py-4 px-5 font-bold text-center">Present</th>
                            <th className="py-4 px-5 font-bold text-center">Leaves</th>
                            <th className="py-4 px-5 font-bold text-center">Sundays</th>
                            <th className="py-4 px-5 font-bold text-center">Holidays</th>
                            <th className="py-4 px-5 font-bold text-center rounded-r-2xl">Absent</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-sm text-[var(--color-heading)]">
                          {attendanceSummary.map((item) => (
                            <tr key={item.userId} className="hover:bg-[var(--color-surface)] transition-colors">
                              <td className="py-4 px-5 font-bold">{item.name} <span className="text-xs text-[var(--color-body)] font-normal block sm:inline">({item.userId})</span></td>
                              <td className="py-4 px-5 text-center font-black text-emerald-500 text-base">{item.presentDays}</td>
                              <td className="py-4 px-5 text-center font-black text-blue-500 text-base">{item.leaveDays}</td>
                              <td className="py-4 px-5 text-center font-black text-purple-500 text-base">{item.sundays}</td>
                              <td className="py-4 px-5 text-center font-black text-amber-500 text-base">{item.holidays}</td>
                              <td className="py-4 px-5 text-center font-black text-red-500 text-base">{item.absentDays}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {attendanceSummary.map((item) => (
                        <div key={item.userId} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-2">
                          <h4 className="font-bold text-sm text-[var(--color-heading)]">{item.name} <span className="text-xs text-[var(--color-body)] font-normal">({item.userId})</span></h4>
                          <div className="grid grid-cols-5 gap-1 text-center pt-2 border-t border-[var(--color-border)]">
                            <div className="bg-[var(--color-card)] p-1.5 rounded-xl border">
                              <span className="block text-[9px] text-[var(--color-body)]">Present</span>
                              <span className="font-black text-emerald-500 text-xs">{item.presentDays}</span>
                            </div>
                            <div className="bg-[var(--color-card)] p-1.5 rounded-xl border">
                              <span className="block text-[9px] text-[var(--color-body)]">Leave</span>
                              <span className="font-black text-blue-500 text-xs">{item.leaveDays}</span>
                            </div>
                            <div className="bg-[var(--color-card)] p-1.5 rounded-xl border">
                              <span className="block text-[9px] text-[var(--color-body)]">Sunday</span>
                              <span className="font-black text-purple-500 text-xs">{item.sundays}</span>
                            </div>
                            <div className="bg-[var(--color-card)] p-1.5 rounded-xl border">
                              <span className="block text-[9px] text-[var(--color-body)]">Holiday</span>
                              <span className="font-black text-amber-500 text-xs">{item.holidays}</span>
                            </div>
                            <div className="bg-[var(--color-card)] p-1.5 rounded-xl border">
                              <span className="block text-[9px] text-[var(--color-body)]">Absent</span>
                              <span className="font-black text-red-500 text-xs">{item.absentDays}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Holiday Management Section */}
                <div className="border-t border-[var(--color-border)] pt-6 space-y-4">
                  <h4 className="text-sm font-extrabold text-[var(--color-heading)]">🎉 Manage Company Holidays</h4>
                  <form onSubmit={handleHolidaySubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">Holiday Title *</label>
                      <input
                        type="text"
                        value={holidayTitle}
                        onChange={(e) => setHolidayTitle(e.target.value)}
                        placeholder="e.g. Diwali"
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">Date *</label>
                      <input
                        type="date"
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1">Description</label>
                      <input
                        type="text"
                        value={holidayDesc}
                        onChange={(e) => setHolidayDesc(e.target.value)}
                        placeholder="Optional details"
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      type="submit"
                      className="w-full py-3 bg-[var(--color-primary)] text-white rounded-2xl text-xs font-bold cursor-pointer transition shadow-md"
                    >
                      Add Holiday 🚀
                    </motion.button>
                  </form>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {holidays.length === 0 ? (
                      <p className="text-xs text-[var(--color-body)] italic">No company holidays added yet.</p>
                    ) : (
                      holidays.map((h) => (
                        <div key={h._id} className="px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold flex items-center gap-2">
                          <span>🎉 {h.title}</span>
                          <span className="font-mono text-[11px] opacity-85">({h.date})</span>
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">🏖️ Leave Management</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Review, approve, or reject staff leave requests.</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleSyncGmailLeaves}
                    className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    <span>🔄</span> Sync Leaves from Gmail
                  </motion.button>
                </div>

                {leaveList.length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <div className="text-5xl">🏖️</div>
                    <h4 className="text-base font-bold text-[var(--color-heading)]">No Leave Applications</h4>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-sm mx-auto">All clean! No pending or past leave requests found.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto w-full pb-2">
                      <motion.table 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="w-full text-left border-collapse"
                      >
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider bg-[var(--color-surface)]/50">
                            <th className="py-4 px-5 font-bold rounded-l-2xl">Employee</th>
                            <th className="py-4 px-5 font-bold">Duration</th>
                            <th className="py-4 px-5 font-bold">Reason / Email</th>
                            <th className="py-4 px-5 font-bold">Status</th>
                            <th className="py-4 px-5 text-center font-bold rounded-r-2xl">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-sm text-[var(--color-heading)]">
                          {leaveList.map((leave) => (
                            <motion.tr 
                              variants={rowVariants}
                              key={leave._id} 
                              className="hover:bg-[var(--color-surface)] transition-colors"
                            >
                              <td className="py-4 px-5 font-bold">{leave.name} <span className="text-xs text-[var(--color-body)] font-normal block sm:inline">({leave.userId})</span></td>
                              <td className="py-4 px-5 font-medium">{leave.fromDate} to {leave.toDate}</td>
                              <td 
                                onClick={() => setModalContent(leave.reason)}
                                className="py-4 px-5 text-blue-500 underline cursor-pointer max-w-xs truncate hover:text-blue-600 transition-colors"
                                title="Click to view full email content"
                              >
                                {leave.reason}
                              </td>
                              <td className="py-4 px-5">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  leave.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                  leave.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                  'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                  {leave.status}
                                </span>
                              </td>
                              <td className="py-4 px-5 text-center">
                                {leave.status === "Pending" ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleLeaveAction(leave._id, "Approved")}
                                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm active:scale-95 transition"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedLeaveId(leave._id);
                                        setRejectModalOpen(true);
                                      }}
                                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-sm active:scale-95 transition"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Action taken</span>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </motion.table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {leaveList.map((leave) => (
                        <div key={leave._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-sm text-[var(--color-heading)]">{leave.name}</h4>
                              <p className="text-[11px] text-[var(--color-body)] font-mono">{leave.fromDate} → {leave.toDate}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              leave.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' :
                              leave.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                              'bg-amber-500/10 text-amber-500'
                            }`}>
                              {leave.status}
                            </span>
                          </div>
                          
                          <p onClick={() => setModalContent(leave.reason)} className="text-xs text-blue-500 underline truncate cursor-pointer">
                            Reason: {leave.reason}
                          </p>

                          {leave.status === "Pending" && (
                            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                              <button
                                onClick={() => handleLeaveAction(leave._id, "Approved")}
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white active:scale-95 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedLeaveId(leave._id);
                                  setRejectModalOpen(true);
                                }}
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-600 text-white active:scale-95 transition"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Tab 4: Candidate ATS */}
            {/* Tab 4: Candidate ATS */}
            {activeTab === "ats" && (
              <motion.div
                key="ats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-5">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">👥 Applicant Tracking System (ATS)</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Manage job applicants, review resumes, AI match scores, and schedule interviews.</p>
                  </div>
                  
                  {/* Action & Dynamic Role Filter Controls */}
                  <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                    {/* 🌟 Dynamic Role Filter Dropdown */}
                    <select
                      value={atsRoleFilter}
                      onChange={(e) => setAtsRoleFilter(e.target.value)}
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-3 py-3 text-xs font-bold text-[var(--color-heading)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                    >
                      {uniqueRoles.map((role, idx) => (
                        <option key={idx} value={role}>
                          {role === "ALL" ? "Filter: All Roles" : `Role: ${role}`}
                        </option>
                      ))}
                    </select>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleReevaluateAi}
                      className="px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                      title="Calculate AI Scores for N/A candidates using database JDs"
                    >
                      <span>✨</span> Re-run AI
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setJdUploadModalOpen(true)}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      <span>📁</span> Upload JD
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSyncSheetModalOpen(true)}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
                    >
                      <span>📊</span> Sync Sheet
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleSyncGmailCandidates}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      <span>🔄</span> Sync Gmail
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowAddCandidateModal(true)}
                      className="px-5 py-3 bg-[var(--color-primary)] text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                    >
                      <span>➕</span> Add Candidate
                    </motion.button>
                  </div>
                </div>

                {filteredCandidates.length === 0 ? (
                  <div className="text-center py-20 space-y-3">
                    <div className="text-5xl">👥</div>
                    <h4 className="text-base font-bold text-[var(--color-heading)]">No Candidates Found</h4>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] max-w-sm mx-auto">No job applicants found for the selected role filter.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto w-full pb-2">
                      <motion.table 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="w-full text-left border-collapse"
                      >
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-body)] uppercase tracking-wider bg-[var(--color-surface)]/50">
                            <th className="py-4 px-4 font-bold rounded-l-2xl">Candidate</th>
                            <th className="py-4 px-4 font-bold">Role</th>
                            <th className="py-4 px-4 font-bold">AI Score</th>
                            <th className="py-4 px-4 font-bold">Resume</th>
                            <th className="py-4 px-4 font-bold">Status</th>
                            <th className="py-4 px-4 text-center font-bold rounded-r-2xl">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-sm text-[var(--color-heading)]">
                          {filteredCandidates.map((cand) => (
                            <motion.tr 
                              variants={rowVariants}
                              key={cand._id} 
                              className="hover:bg-[var(--color-surface)] transition-colors align-middle"
                            >
                              <td className="py-4 px-4">
                                <div className="font-bold text-sm">{cand.name}</div>
                                <div className="text-[11px] text-[var(--color-body)]">{cand.email} {cand.phone && `• ${cand.phone}`}</div>
                              </td>

                              <td className="py-4 px-4 font-semibold text-xs">{cand.appliedFor}</td>
                              
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                                  cand.aiMatchScore && parseInt(cand.aiMatchScore) >= 75 ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                                  cand.aiMatchScore && parseInt(cand.aiMatchScore) >= 50 ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
                                  'bg-gray-500/15 text-gray-500 border border-gray-500/30'
                                }`}>
                                  ✨ {cand.aiMatchScore || "N/A"}
                                </span>
                              </td>

                              <td className="py-4 px-4">
                                {cand.resumeUrl ? (
                                  <a 
                                    href={cand.resumeUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 font-bold text-xs transition"
                                  >
                                    <span>📄</span> PDF
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">No PDF</span>
                                )}
                              </td>

                              <td className="py-4 px-4">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                  cand.status === 'Selected' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                  cand.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                  cand.status === 'Interview Scheduled' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                                  cand.status === 'Shortlisted' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                  'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                  {cand.status}
                                </span>
                              </td>

                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setSelectedCandidateForDetail(cand);
                                      setCandidateDetailModalOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer shadow-sm"
                                    title="View Details"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleCandidateAction(cand._id, "Shortlisted")}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-sm"
                                    title="Shortlist"
                                  >
                                    Shortlist
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedCandidateId(cand._id);
                                      setInterviewModalOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-sm"
                                    title="Schedule Interview"
                                  >
                                    Schedule
                                  </button>
                                  <button
                                    onClick={() => handleCandidateAction(cand._id, "Selected")}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-sm"
                                    title="Select Candidate"
                                  >
                                    Select
                                  </button>
                                  <button
                                    onClick={() => handleCandidateAction(cand._id, "Rejected", { hrReview: "Not meeting requirements." })}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white transition cursor-pointer shadow-sm"
                                    title="Reject Candidate"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </motion.table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {filteredCandidates.map((cand) => (
                        <div key={cand._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-sm text-[var(--color-heading)]">{cand.name}</h4>
                              <p className="text-xs text-[var(--color-body)]">{cand.appliedFor}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              cand.status === 'Selected' ? 'bg-emerald-500/10 text-emerald-500' :
                              cand.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                              cand.status === 'Interview Scheduled' ? 'bg-indigo-500/10 text-indigo-500' :
                              'bg-blue-500/10 text-blue-500'
                            }`}>
                              {cand.status}
                            </span>
                          </div>

                          <div className="bg-[var(--color-card)] p-2.5 rounded-xl border border-[var(--color-border)] flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--color-body)]">AI Match Score:</span>
                            <span className="font-black text-emerald-500">✨ {cand.aiMatchScore || "N/A"}</span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            {cand.resumeUrl ? (
                              <a href={cand.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-semibold underline">
                                📄 View Resume PDF
                              </a>
                            ) : <span>No PDF</span>}
                            <button
                              onClick={() => {
                                setSelectedCandidateForDetail(cand);
                                setCandidateDetailModalOpen(true);
                              }}
                              className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-600 text-white"
                            >
                              View Details
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border)]">
                            <button onClick={() => handleCandidateAction(cand._id, "Shortlisted")} className="py-2 rounded-xl text-xs font-bold bg-blue-600 text-white active:scale-95 transition">Shortlist</button>
                            <button onClick={() => { setSelectedCandidateId(cand._id); setInterviewModalOpen(true); }} className="py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white active:scale-95 transition">Schedule</button>
                            <button onClick={() => handleCandidateAction(cand._id, "Selected")} className="py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white active:scale-95 transition">Select</button>
                            <button onClick={() => handleCandidateAction(cand._id, "Rejected", { hrReview: "Not meeting requirements." })} className="py-2 rounded-xl text-xs font-bold bg-red-600 text-white active:scale-95 transition">Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}


            {/* Tab 5: Policy Uploader */}
            {activeTab === "policies" && (
              <motion.form
                key="policies"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handlePolicySubmit} 
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-5 shadow-xl backdrop-blur-md"
              >
                <div className="border-b border-[var(--color-border)] pb-4">
                  <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">📤 Broadcast Company Policy (PDF)</h3>
                  <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Upload official documents to notify and distribute guidelines across teams.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">Document Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Code of Conduct 2026"
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">Target Audience</label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                    >
                      <option value="ALL">All Staff (Sales + Telecallers)</option>
                      <option value="salesperson">Sales Team Only</option>
                      <option value="telecaller">Telecallers Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5">Description</label>
                  <textarea
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief note about this policy..."
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5">Upload PDF Document *</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="block w-full text-xs text-[var(--color-body)] cursor-pointer file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-2 transition-all"
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={uploading}
                  className="w-full sm:w-auto px-8 bg-[var(--color-primary)] text-white py-4 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-[var(--color-primary)]/25"
                >
                  {uploading ? "Uploading PDF..." : "Publish & Broadcast Policy 🚀"}
                </motion.button>
              </motion.form>
            )}

            {/* Tab 6: Direct Messaging */}
            {activeTab === "messages" && (
              <motion.form
                key="messages"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleMessageSubmit} 
                className="bg-[var(--color-card)] border border-[var(--color-border)] p-5 sm:p-8 rounded-3xl space-y-5 shadow-xl backdrop-blur-md"
              >
                <div className="border-b border-[var(--color-border)] pb-4">
                  <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">💬 Send 1-to-1 Direct Message</h3>
                  <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Communicate directly via private secure notifications.</p>
                </div>
                
                <div>
                  <label className="block text-xs font-bold mb-1.5">Select Employee *</label>
                  <select
                    value={selectedEmp}
                    onChange={(e) => setSelectedEmp(e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
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
                  <label className="block text-xs font-bold mb-1.5">Subject / Title</label>
                  <input
                    type="text"
                    value={msgTitle}
                    onChange={(e) => setMsgTitle(e.target.value)}
                    placeholder="e.g. Urgent Performance Review"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5">Message Content *</label>
                  <textarea
                    rows="4"
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                    required
                  ></textarea>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={sendingMsg}
                  className="w-full sm:w-auto px-8 bg-[var(--color-primary)] text-white py-4 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-[var(--color-primary)]/25"
                >
                  {sendingMsg ? "Sending Message..." : "Send Private Message 📨"}
                </motion.button>
              </motion.form>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Modals with Enhanced Backdrop Blur & Animations */}
      <AnimatePresence>
        {modalContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl backdrop-blur-xl">
              <h3 className="text-lg font-bold text-[var(--color-heading)] border-b border-[var(--color-border)] pb-3">Full Email Content</h3>
              <div className="max-h-60 overflow-y-auto text-xs sm:text-sm text-[var(--color-body)] whitespace-pre-wrap bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)]">
                {modalContent}
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => setModalContent(null)} className="px-6 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer active:scale-95">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Sync Google Sheet & JD PDF Modal */}
        {syncSheetModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-lg font-bold text-[var(--color-heading)]">Sync Google Sheet & AI Screen</h3>
                <button onClick={() => setSyncSheetModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleSyncSheetSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Google Sheet Public URL *</label>
                  <input
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Job Role for these Candidates *</label>
                  <input
                    type="text"
                    value={sheetRoleInput}
                    onChange={(e) => setSheetRoleInput(e.target.value)}
                    placeholder="e.g. Sales Executive"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Upload Job Description (JD) PDF (Optional)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setJdPdfFile(e.target.files[0])}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-2.5 text-xs text-[var(--color-heading)] cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setSyncSheetModalOpen(false)} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                  <button type="submit" disabled={syncingSheet} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-md">{syncingSheet ? "Syncing..." : "Import & Sync 📊"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Upload Role JD Modal */}
        {jdUploadModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-lg font-bold text-[var(--color-heading)]">Upload Job Description</h3>
                <button onClick={() => setJdUploadModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleJdUploadSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Job Role Name *</label>
                  <input
                    type="text"
                    value={jdRoleInput}
                    onChange={(e) => setJdRoleInput(e.target.value)}
                    placeholder="e.g. BDM, Sales Executive"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Job Title / Heading *</label>
                  <input
                    type="text"
                    value={jdTitleInput}
                    onChange={(e) => setJdTitleInput(e.target.value)}
                    placeholder="e.g. Business Development Manager"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Upload JD PDF *</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setJdFilePdf(e.target.files[0])}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-2.5 text-xs text-[var(--color-heading)] cursor-pointer"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setJdUploadModalOpen(false)} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                  <button type="submit" disabled={uploadingJd} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-md">{uploadingJd ? "Saving..." : "Save JD 📁"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Candidate Complete Details Modal */}
        {candidateDetailModalOpen && selectedCandidateForDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-lg font-bold text-[var(--color-heading)]">Candidate Profile Details</h3>
                <button onClick={() => setCandidateDetailModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold cursor-pointer">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-[var(--color-body)] block font-semibold">Full Name</span>
                  <span className="font-bold text-[var(--color-heading)]">{selectedCandidateForDetail.name}</span>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block font-semibold">Role Applied</span>
                  <span className="font-bold text-blue-500">{selectedCandidateForDetail.appliedFor}</span>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block font-semibold">Email Address</span>
                  <span className="font-medium">{selectedCandidateForDetail.email}</span>
                </div>
                <div>
                  <span className="text-[var(--color-body)] block font-semibold">Phone Number</span>
                  <span className="font-medium">{selectedCandidateForDetail.phone || "N/A"}</span>
                </div>
              </div>

              <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[var(--color-heading)]">✨ AI Match Score:</span>
                  <span className="font-black text-emerald-500 text-sm">{selectedCandidateForDetail.aiMatchScore || "N/A"}</span>
                </div>
                <p className="text-xs text-[var(--color-body)]">
                  <span className="font-bold">AI Review:</span> {selectedCandidateForDetail.aiInsights || "No insights generated yet."}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <span className="text-xs font-extrabold text-[var(--color-heading)] block uppercase tracking-wider">Form Q & A:</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedCandidateForDetail.formResponses && Object.keys(selectedCandidateForDetail.formResponses).length > 0 ? (
                    Object.entries(selectedCandidateForDetail.formResponses).map(([question, answer], idx) => (
                      <div key={idx} className="text-xs flex flex-col sm:flex-row justify-between bg-[var(--color-surface)] p-2.5 rounded-xl border border-[var(--color-border)] gap-1">
                        <span className="font-semibold text-[var(--color-body)]">{question}:</span>
                        <span className="font-bold text-[var(--color-heading)]">{answer || "N/A"}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--color-body)] italic">No additional form responses available.</p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--color-border)] flex justify-end gap-3 flex-wrap">
                {selectedCandidateForDetail.resumeUrl && (
                  <a href={selectedCandidateForDetail.resumeUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-blue-600 text-white">
                    View Resume PDF
                  </a>
                )}
                <button onClick={() => setCandidateDetailModalOpen(false)} className="px-5 py-2.5 rounded-2xl text-xs font-semibold bg-gray-500/20 text-[var(--color-heading)]">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Add New Employee Modal */}
        {addEmpModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Add New Employee</h3>
              <form onSubmit={handleAddEmployeeSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Full Name *</label>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Aman Verma" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Email Address *</label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="aman@crinza.com" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Phone Number</label>
                  <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+91 9876543210" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Temporary Password *</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Role *</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none">
                    <option value="salesperson">Salesperson</option>
                    <option value="accountant">Accountant</option>
                    <option value="technical">Technical</option>
                    <option value="telecaller">Telecaller</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Joining Date</label>
                  <input type="date" value={newJoiningDate} onChange={(e) => setNewJoiningDate(e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Monthly Salary (INR)</label>
                  <input type="number" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="e.g. 30000" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" />
                </div>
                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setAddEmpModalOpen(false)} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                  <button type="submit" disabled={addingEmp} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-[var(--color-primary)] text-white cursor-pointer shadow-md">{addingEmp ? "Creating..." : "Create Employee"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Employee Details Modal */}
        {editEmpModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Edit Employee Details</h3>
              <form onSubmit={handleUpdateEmployeeSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Role *</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none">
                    <option value="salesperson">Salesperson</option>
                    <option value="accountant">Accountant</option>
                    <option value="technical">Technical</option>
                    <option value="telecaller">Telecaller</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Joining Date</label>
                  <input type="date" value={editJoiningDate} onChange={(e) => setEditJoiningDate(e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Monthly Salary (INR)</label>
                  <input type="number" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} placeholder="e.g. 35000" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Account Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setEditEmpModalOpen(false)} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-2xl text-xs font-bold bg-[var(--color-primary)] text-white cursor-pointer shadow-md">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Document Dispatch Modal */}
        {docModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Dispatch {docType === 'OfferLetter' ? 'Offer Letter' : 'Salary Slip'}</h3>
              <p className="text-xs text-[var(--color-body)] truncate">Sending to: <span className="font-bold text-[var(--color-heading)]">{selectedEmpForDoc?.email}</span></p>
              
              <form onSubmit={handleSendDocumentSubmit} className="space-y-3.5">
                {docType === 'SalarySlip' && (
                  <div>
                    <label className="block text-xs font-bold mb-1">Month & Year *</label>
                    <input type="text" value={monthYearInput} onChange={(e) => setMonthYearInput(e.target.value)} placeholder="e.g. September 2026" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1">Attach PDF *</label>
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={(e) => setDocPdfFile(e.target.files[0])} 
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-2.5 text-xs text-[var(--color-heading)] cursor-pointer" 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Custom Note / Message (Optional)</label>
                  <textarea rows="3" value={customMsgInput} onChange={(e) => setCustomMsgInput(e.target.value)} placeholder="Add remarks or instructions..." className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none"></textarea>
                </div>
                
                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setDocModalOpen(false)} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                  <button type="submit" disabled={sendingDoc} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-emerald-600 text-white cursor-pointer shadow-md">{sendingDoc ? "Sending..." : "Send Email Now ✉️"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {rejectModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Reason for Rejection</h3>
              <p className="text-xs text-[var(--color-body)]">Please provide a reason why this leave request is being rejected.</p>
              <textarea rows="3" value={rejectionReasonInput} onChange={(e) => setRejectionReasonInput(e.target.value)} placeholder="e.g. Critical project deadline..." className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-xs sm:text-sm text-[var(--color-heading)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"></textarea>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setRejectModalOpen(false)} className="flex-1 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] cursor-pointer">Cancel</button>
                <button onClick={() => handleLeaveAction(selectedLeaveId, "Rejected", rejectionReasonInput)} className="flex-1 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-red-600 text-white cursor-pointer shadow-md">Confirm & Send</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Add Candidate Modal */}
        {showAddCandidateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Add Job Candidate</h3>
              <form onSubmit={handleAddCandidateSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Full Name *</label>
                  <input type="text" value={newCandidateName} onChange={(e) => setNewCandidateName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Email *</label>
                  <input type="email" value={newCandidateEmail} onChange={(e) => setNewCandidateEmail(e.target.value)} placeholder="rahul@gmail.com" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Phone</label>
                  <input type="text" value={newCandidatePhone} onChange={(e) => setNewCandidatePhone(e.target.value)} placeholder="+91 9876543210" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Role Applied For *</label>
                  <input type="text" value={newCandidateRole} onChange={(e) => setNewCandidateRole(e.target.value)} placeholder="e.g. Sales Executive" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Resume (PDF) *</label>
                  <input type="file" accept="application/pdf" onChange={(e) => setNewCandidateResume(e.target.files[0])} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-2 text-xs cursor-pointer" required />
                </div>
                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setShowAddCandidateModal(false)} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                  <button type="submit" disabled={addingCandidate} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-[var(--color-primary)] text-white cursor-pointer shadow-md">{addingCandidate ? "Saving..." : "Save Candidate"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Schedule / Modify Interview Modal */}
        {interviewModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-4 shadow-2xl backdrop-blur-xl">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">Schedule / Modify Interview</h3>
              <p className="text-xs text-[var(--color-body)]">Select the date and time for the candidate interview. An automated email notification will be sent.</p>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Interview Date *</label>
                  <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Interview Time *</label>
                  <input type="text" value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} placeholder="e.g. 03:00 PM IST" className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-xs text-[var(--color-heading)] outline-none" required />
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button onClick={() => setInterviewModalOpen(false)} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-gray-500/20 text-[var(--color-heading)] cursor-pointer">Cancel</button>
                <button onClick={() => handleCandidateAction(selectedCandidateId, "Interview Scheduled", { interviewDate, interviewTime })} className="flex-1 py-3 rounded-2xl text-xs font-bold bg-indigo-600 text-white cursor-pointer shadow-md">Confirm & Send Email</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showLogoutModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[var(--color-card)] border border-[var(--color-border)] p-6 sm:p-8 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl text-center backdrop-blur-xl">
              <h3 className="text-xl font-bold text-[var(--color-heading)]">Confirm Logout</h3>
              <p className="text-xs sm:text-sm text-[var(--color-body)]">Are you sure you want to log out of your HR session?</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] cursor-pointer">No</button>
                <button onClick={() => { setShowLogoutModal(false); onLogout(); }} className="flex-1 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-red-600 text-white cursor-pointer shadow-md">Yes, Logout</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HrPortal;