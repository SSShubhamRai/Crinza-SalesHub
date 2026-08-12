/**
 * =========================================================================
 * 👤 SALESPERSON PORTAL COMPONENT (`SalespersonForm.jsx`)
 * =========================================================================
 * Description: Allows salesperson to manage performance, track deals, create/update 
 * leads with live GPS coordinates, schedule follow-ups, submit invoices with 
 * database-verified coupon discounts, 18% GST calculation, add-on packages, 
 * multi-visit tracking, true partial installment due ledger system, 
 * Capacitor native Mock Location / Anti-Bypass security, Kanban Pipeline View, 
 * WhatsApp Quick Reminders with Logo, 🔔 Real-time In-App Notifications, 
 * 📢 Live Team Broadcast Announcement Listener, and ⏱️ Day Start/End Shift Control.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { State, City } from 'country-state-city';
import { io } from 'socket.io-client'; // 🌟 Socket.io client for real-time live tracking
import { Geolocation } from '@capacitor/geolocation'; // 🌟 Capacitor Geolocation for Native Mock Detection
import { PushNotifications } from '@capacitor/push-notifications'; // 🌟 Capacitor Push Notifications
import { FCM } from '@capacitor-community/fcm'; // 🌟 FCM Plugin
import ReactPhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { submitInvoiceRequest } from '../api/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion'; // 🌟 Smooth Layout & View Animations
import confetti from 'canvas-confetti'; // 🌟 Positive Reinforcement Celebration

// 🌟 Safe fallback for Vite CommonJS interop
const PhoneInput = ReactPhoneInput.default || ReactPhoneInput;

// --- 🌟 CATEGORY LIST CONFIGURATION ---
const CATEGORY_OPTIONS = [
  "NEET",
  "JEE Mains",
  "Law & Judiciary Exams",
  "Other Courses",
  "Test Series & Mock Tests",
  "Abacus & Mental Maths",
  "Stock Market & Trading",
  "Skill Development Courses",
  "Fitness, Yoga & Wellness",
  "Entrance Exam Preparation",
  "Pharmacy Exams",
  "Agriculture Exams",
  "Computer & Technical Skills",
  "Designing & Digital Marketing",
  "Coding & Programming",
  "College Courses",
  "School & Academics Courses",
  "CA, CS & CMA Courses",
  "Teaching Exams",
  "Railway, Police & Defence Exams",
  "SSC & Government Job Exams",
  "UPSC Exams",
  "PSC Exams",
  "Engineering Entrance Exams",
  "Study Abroad & English Tests",
  "UGC NET Exams",
  "MBA Entrance Exams",
  "Banking Exams",
  "Software Development"
];

// --- 🌟 REUSABLE WHATSAPP SVG COMPONENT ---
const WhatsAppIcon = ({ className = "w-4 h-4 fill-current" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

// --- 🌟 SKELETON LOADER COMPONENT ---
const SkeletonLoader = ({ rows = 3 }) => (
  <div className="space-y-3 animate-pulse">
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 sm:p-5 rounded-2xl h-24 flex items-center justify-between gap-4">
        <div className="space-y-2.5 w-3/4">
          <div className="h-4 bg-[var(--color-border)] rounded-md w-1/2"></div>
          <div className="h-3 bg-[var(--color-border)] rounded-md w-3/4"></div>
        </div>
        <div className="h-10 w-20 bg-[var(--color-border)] rounded-xl shrink-0"></div>
      </div>
    ))}
  </div>
);

// --- 🌟 MODAL COMPONENTS ---
const SettlementModal = ({ settledAlert, onClose }) => {
  if (!settledAlert) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[var(--color-card)] border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl text-center"
      >
        <span className="text-5xl animate-bounce inline-block">🎉</span>
        <h3 className="text-lg sm:text-xl font-extrabold text-emerald-600">Deal Fully Settled & Cleared!</h3>
        <p className="text-xs sm:text-sm text-[var(--color-body)] leading-relaxed">
          All outstanding dues for <strong className="text-[var(--color-heading)]">{settledAlert.institute}</strong> have been paid in full. Balance is now <strong className="text-emerald-600">₹0 (Zero Due)</strong>. Both salesperson and account team have been notified successfully.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer shadow-sm active:scale-95 transition min-h-[46px]"
        >
          Okay, Return to Dashboard
        </button>
      </motion.div>
    </motion.div>
  );
};

const LogoutModal = ({ show, onClose, onConfirm }) => {
  if (!show) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl text-center"
      >
        <span className="text-5xl animate-bounce inline-block">⚠️</span>
        <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">Confirm Logout</h3>
        <p className="text-xs sm:text-sm text-[var(--color-body)] leading-relaxed">
          Are you sure you want to log out from the Salesperson Portal?
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)]/60 text-[var(--color-heading)] py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer border border-[var(--color-border)] transition active:scale-95 min-h-[46px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition shadow-sm active:scale-95 min-h-[46px]"
          >
            Confirm Logout
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const EndDayConfirmModal = ({ show, onClose, onConfirm }) => {
  if (!show) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl text-center"
      >
        <span className="text-5xl animate-bounce inline-block">🛑</span>
        <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">End Day Confirmation</h3>
        <p className="text-xs sm:text-sm text-[var(--color-body)] leading-relaxed">
          Are you sure you want to end your working day? Once ended, no further entries are allowed today.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)]/60 text-[var(--color-heading)] py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer border border-[var(--color-border)] transition active:scale-95 min-h-[46px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition shadow-sm active:scale-95 min-h-[46px]"
          >
            Confirm End Day
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SalespersonForm = ({ userId, username, onLogout }) => {
  // --- Navigation & View States ---
  const [activeView, setActiveView] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  // --- ⏱️ Day Shift Attendance States ---
  const [dayStatus, setDayStatus] = useState('LOADING'); // 'LOADING' | 'NOT_STARTED' | 'ACTIVE' | 'ENDED'
  const [startLocationName, setStartLocationName] = useState('');
  const [daySummaryModal, setDaySummaryModal] = useState(null);
  const [showEndDayModal, setShowEndDayModal] = useState(false);

  // --- Deals & Leads Data States ---
  const [myDeals, setMyDeals] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  const [myLeads, setMyLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // --- 🔍 Leads Filter & Search States ---
  const [leadFilter, setLeadFilter] = useState('all');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');

  // --- Modal & Reminder States ---
  const [selectedLead, setSelectedLead] = useState(null);
  
  // 🌟 Interactive Sub-action States for Lead Details Modal
  const [activeModalAction, setActiveModalAction] = useState(null); // 'reschedule' | 'completed' | null
  const [followUpModalAction, setFollowUpModalAction] = useState(null); 
  const [demoReviewNotes, setDemoReviewNotes] = useState('');
  const [demoProofFile, setDemoProofFile] = useState(null);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');

  // --- 🌟 Invoice Multi-Step Wizard State ---
  const [invoiceStep, setInvoiceStep] = useState(1);

  // --- 🌟 Settlement Success Popup State ---
  const [settledAlert, setSettledAlert] = useState(null);

  // --- 🚪 Logout Confirmation Modal State ---
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // --- 🔔 In-App Notifications States ---
  const [notifications, setNotifications] = useState([]);
  const [broadcastNotifications, setBroadcastNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // 🌟 Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('.relative')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // --- Add-on Package Pricing Constants ---
  const ADDON_PRICES = {
    testModule: 5000,
    windowApp: 5000,
    iosApp: 45000,
  };

  // --- API Base URL Configuration ---
  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  // --- 🌟 PUSH NOTIFICATIONS SETUP ---
  useEffect(() => {
    const initPushNotifications = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        }

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
          toast(notification.title || 'New Notification', { icon: '🔔' });
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed:', notification);
        });

        const result = await FCM.getToken();
        console.log('FCM Token:', result.token);
        
        const token = localStorage.getItem('token');
        if (token && result.token) {
          await fetch(`${API_BASE}/api/salesperson/save-fcm-token`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ fcmToken: result.token })
          });
        }
      } catch (err) {
        console.error('Push Notification Error:', err);
      }
    };

    initPushNotifications();
  }, [API_BASE]);

  // --- 🔔 LOGIC: PERSISTENT BROADCASTS ---
  const fetchBroadcastNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/broadcasts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setBroadcastNotifications(data);
    } catch (err) {
      console.error("Failed to fetch broadcasts:", err);
    }
  }, [API_BASE]);

  const handleClearBroadcast = async (broadcastId, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/broadcasts/${broadcastId}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBroadcastNotifications(prev => prev.filter(b => b._id !== broadcastId));
        toast.success("Broadcast cleared");
      }
    } catch (err) {
      toast.error("Failed to clear broadcast");
    }
  };

  // --- ⏱️ CHECK DAY SHIFT STATUS ---
  const checkDayStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/day-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'STARTED') {
          setDayStatus('ACTIVE');
          setStartLocationName(data.startAddress || data.locationName || '');
        } else if (data.status === 'ENDED') {
          setDayStatus('ENDED');
          setStartLocationName(data.startAddress || data.locationName || '');
        } else {
          setDayStatus('NOT_STARTED');
          setStartLocationName('');
        }
      }
    } catch (err) {
      console.error("Failed to check day status:", err);
    }
  }, [API_BASE]);

  // --- ⏱️ START DAY HANDLER ---
  const handleStartDay = async () => {
    setStatus({ loading: true, success: '', error: '' });
    const { lat, lng, isMocked } = await getSecureLocation();
    
    if (isMocked) {
      setStatus({ loading: false, success: '', error: 'Mock location detected! Day start blocked.' });
      return;
    }

    try {
      let addressName = '';
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const geoData = await geoRes.json();
        if (geoData && geoData.display_name) {
          addressName = geoData.display_name;
        }
      } catch (geoErr) {
        console.warn("Reverse geocode warning:", geoErr);
      }

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/start-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude: lat, longitude: lng, startAddress: addressName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start day');

      toast.success("🚀 Working day started successfully!");
      setDayStatus('ACTIVE');
      setStartLocationName(data.startAddress || addressName || 'GPS Location Recorded');
      setStatus({ loading: false, success: '', error: '' });
    } catch (err) {
      setStatus({ loading: false, success: '', error: err.message });
      toast.error(err.message);
    }
  };

  // --- ⏱️ EXECUTE END DAY API CALL ---
  const executeEndDay = async () => {
    setShowEndDayModal(false);
    setStatus({ loading: true, success: '', error: '' });
    const { lat, lng, isMocked } = await getSecureLocation();

    if (isMocked) {
      setStatus({ loading: false, success: '', error: 'Mock location detected! Action blocked.' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/end-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to end day');

      setDayStatus('ENDED');
      setDaySummaryModal(data.summary);
      setStatus({ loading: false, success: '', error: '' });
      toast.success("Day ended successfully. Entries are now locked for today.");
    } catch (err) {
      setStatus({ loading: false, success: '', error: err.message });
      toast.error(err.message);
    }
  };

  // --- 🌟 FETCH NOTIFICATIONS HOOK ---
  const fetchSalespersonNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, [API_BASE]);

  // --- 🌟 WHATSAPP QUICK REMINDER HELPER ---
  const handleWhatsAppReminder = (lead, type = 'followup') => {
    if (!lead.mobileNo) {
      toast.error('Mobile number not available!');
      return;
    }
    let phone = lead.mobileNo.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    let message = '';
    if (type === 'followup') {
      message = `Hello *${lead.contactPerson || 'Sir/Ma\'am'}*, greetings from Crinza Technologies! This is a quick reminder regarding our scheduled ${lead.followUpAction || 'discussion'} for *${lead.instituteName}*. Looking forward to connecting with you.`;
    } else {
      message = `Hello *${lead.contactPerson || 'Sir/Ma\'am'}*, greetings from Crinza Technologies regarding *${lead.instituteName}*.`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // --- 🌟 SECURE NATIVE LOCATION FETCH WITH MOCK DETECTION ---
  const getSecureLocation = async () => {
    try {
      await Geolocation.requestPermissions();
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      const isMocked = position.coords.mocked || position.coords.isFromMockProvider;
      if (isMocked) {
        toast.error("⚠️ Security Warning: Mock Location (Fake GPS) app detected! Please disable fake GPS tools to record visits or submit invoices.");
        return { lat: null, lng: null, isMocked: true };
      }

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        isMocked: false
      };
    } catch (err) {
      console.warn("Capacitor geolocation fallback to browser navigator:", err.message);
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

  // --- 🌟 OPTIMIZED BATTERY-FRIENDLY LOCATION TRACKING & SOCKET LISTENERS ---
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socketRef.current = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Salesperson Connected to Socket Server, ID:', socketRef.current.id);
      if (userId) {
        socketRef.current.emit('register_user', { userId });
      }
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socketRef.current.on('force_logout', (data) => {
      toast.error(data?.message || "Logged in from another device. Logging out...", { duration: 6000 });
      localStorage.clear();
      if (typeof onLogout === 'function') onLogout();
    });

    socketRef.current.on('new_notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      toast.success(notif.message, { icon: '🔔', duration: 5000 });
    });

    socketRef.current.on('team_broadcast', (data) => {
      setBroadcastNotifications((prev) => [data, ...prev]);
      const title = data?.title || "Announcement";
      const message = data?.message || "";
      const priority = (data?.priority || "normal").toUpperCase();

      toast(`📢 [${priority}] ${title}\n${message}`, {
        duration: 12000,
        position: 'top-right',
        icon: '📢',
        style: {
          background: data?.priority === 'urgent' ? '#fee2e2' : '#f3f4f6',
          color: data?.priority === 'urgent' ? '#991b1b' : '#1f2937',
          fontWeight: '500',
          padding: '16px',
        },
      });
    });

    fetchBroadcastNotifications();

    let intervalId = null;

    const emitLocation = () => {
      if (document.hidden || !navigator.geolocation || !userId) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          socketRef.current?.emit('update_location', { salespersonId: userId, latitude, longitude });
        },
        (err) => console.error('Background GPS error:', err),
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 }
      );
    };

    if (navigator.geolocation && userId) {
      emitLocation();
      intervalId = setInterval(emitLocation, 45000);
    }

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [userId, API_BASE, onLogout, fetchBroadcastNotifications]);

  // --- Initial Form States ---
  const initialFormData = {
    instituteName: '',
    appName: '',
    categories: [], 
    youtubeLink: '', 
    instagramLink: '', 
    mobileNo: '',
    email: '',
    pincode: '',
    city: '',
    state: '',
    address: '',
    gstNo: '',
    packageValidity: '1 Year',
    baseAmount: 15000,
    subtotalAmount: 15000,
    gstAmount: 2700,
    totalAmount: 17700,
    paidAmount: 0,
    previousDueBalance: 0, 
    couponCode: '',
    discountAmount: 0,
    termsAndConditions: '1. Payment once made is non-refundable.\n2. Validity counts from application activation date.',
    paymentMode: 'ONLINE',
    utrNumber: '',
    receiptNo: '',
    chequeNo: '',
    bankName: '',
  };

  const initialLeadFormData = {
    instituteName: '',
    contactPerson: '',
    mobileNo: '',
    email: '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    notes: '',
    followUpDate: '',
    followUpTime: '',
    followUpAction: 'Call',
  };

  const initialAddons = {
    testModule: false,
    windowApp: false,
    iosApp: false,
  };

  const [formData, setFormData] = useState(initialFormData);
  const [leadFormData, setLeadFormData] = useState(initialLeadFormData);
  
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [leadStateCode, setLeadStateCode] = useState('');
  
  const [addons, setAddons] = useState(initialAddons);
  const [file, setFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null); 
  const [meetingPhotoFile, setMeetingPhotoFile] = useState(null);
  const [meetingPhotoPreview, setMeetingPhotoPreview] = useState(null);

  const [status, setStatus] = useState({ loading: false, success: '', error: '' });
  
  const [couponInput, setCouponInput] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponDetails, setCouponDetails] = useState(null);

  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [availablePincodes, setAvailablePincodes] = useState([]);
  const [leadAvailablePincodes, setLeadAvailablePincodes] = useState([]);

 
// --- 🌟 ALL FORMATS ALLOWED ---
  const validateImageFile = (uploadedFile) => {
    if (!uploadedFile) return false;
    // Ab koi restriction nahi hai, koi bhi file format (PDF, Doc, Image, Zip, etc.) allow ho jayega
    return true; 
  };

  const fetchMyDeals = useCallback(async () => {
    setLoadingDeals(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/my-deals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = await res.json();
      if (res.ok) setMyDeals(data);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
    } finally {
      setLoadingDeals(false);
    }
  }, [API_BASE, onLogout]);

  const fetchMyLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/my-leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = await res.json();
      if (res.ok) setMyLeads(data);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  }, [API_BASE, onLogout]);

  useEffect(() => {
    fetchMyDeals();
    fetchMyLeads();
    fetchSalespersonNotifications();
    checkDayStatus();
  }, [fetchMyDeals, fetchMyLeads, fetchSalespersonNotifications, checkDayStatus]);

  const indianStates = State.getStatesOfCountry('IN');
  const citiesOfSelectedState = selectedStateCode ? City.getCitiesOfState('IN', selectedStateCode) : [];
  const citiesOfLeadState = leadStateCode ? City.getCitiesOfState('IN', leadStateCode) : [];

  useEffect(() => {
    let totalAddonCost = 0;
    if (addons.testModule) totalAddonCost += ADDON_PRICES.testModule;
    if (addons.windowApp) totalAddonCost += ADDON_PRICES.windowApp;
    if (addons.iosApp) totalAddonCost += ADDON_PRICES.iosApp;

    const baseSubtotal = formData.baseAmount + totalAddonCost;
    let discount = 0;

    if (isCouponApplied && couponDetails) {
      if (couponDetails.discountType === 'percentage') {
        discount = (baseSubtotal * couponDetails.discountValue) / 100;
      } else {
        discount = couponDetails.discountValue;
      }
    }

    const discountedSubtotal = Math.max(0, baseSubtotal - discount);
    const gst = discountedSubtotal * 0.18;
    
    const calculatedTotal = discountedSubtotal + gst + (formData.previousDueBalance || 0);

    setFormData((prev) => ({
      ...prev,
      subtotalAmount: discountedSubtotal,
      gstAmount: Math.round(gst * 100) / 100,
      totalAmount: Math.round(calculatedTotal * 100) / 100,
      discountAmount: discount
    }));
  }, [addons, formData.baseAmount, formData.previousDueBalance, isCouponApplied, couponDetails]);

  const dueAmount = Math.max(0, formData.totalAmount - formData.paidAmount);
  const unreadTaskCount = notifications.filter(n => !n.isRead).length;
  const totalUnreadCount = unreadTaskCount + broadcastNotifications.length;

  const totalDealsCount = myDeals.length;
  const activeLeadsList = myLeads.filter(lead => lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close');
  const totalLeadsCount = activeLeadsList.length;
  const approvedDealsCount = myDeals.filter(d => d.status === 'approved').length;
  const pendingDealsCount = myDeals.filter(d => d.status === 'pending').length;
  const totalPaidCollected = myDeals.reduce((sum, d) => sum + (d.paidAmount || 0), 0);

  const filteredLeads = myLeads.filter(lead => {
    const query = leadSearchQuery.toLowerCase().trim();
    
    const matchesSearch = query === '' || 
      lead.instituteName?.toLowerCase().includes(query) ||
      lead.contactPerson?.toLowerCase().includes(query) ||
      lead.mobileNo?.includes(query) ||
      lead.city?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (leadFilter === 'all') {
      return lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close';
    }
    
    if (leadFilter === 'not-interested') {
      return lead.leadStatus === 'Not Interested';
    }
    
    if (leadFilter === 'call') {
      return (
        lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close' && (
          lead.followUpAction?.toLowerCase() === 'call' || 
          lead.followUpAction?.toLowerCase() === 'call back' || 
          lead.leadStatus?.toLowerCase() === 'call back'
        )
      );
    }
    
    if (leadFilter === 'meeting') {
      return (
        lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close' && (
          lead.followUpAction?.toLowerCase() === 'next meeting' || 
          lead.followUpAction?.toLowerCase() === 'meeting'
        )
      );
    }
    
    if (leadFilter === 'demo-done') {
      return lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close' && lead.demoStatus?.toLowerCase() === 'completed';
    }
    
    if (leadFilter === 'demo-pending') {
      return (
        lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close' && (
          !lead.demoStatus || 
          lead.demoStatus?.toLowerCase() === 'not given' || 
          lead.demoStatus?.toLowerCase() === 'scheduled'
        )
      );
    }

    return true;
  });

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setCouponError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/coupons/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: couponInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid coupon');

      setIsCouponApplied(true);
      setCouponDetails(data);
      setFormData((prev) => ({ ...prev, couponCode: data.code }));
    } catch (err) {
      setCouponError(err.message || 'Invalid coupon code!');
    }
  };

  const handleRemoveCoupon = () => {
    setIsCouponApplied(false);
    setCouponInput('');
    setCouponError('');
    setCouponDetails(null);
    setFormData((prev) => ({ ...prev, couponCode: '', discountAmount: 0 }));
  };

  const fetchByPincode = async (pincodeValue) => {
    if (pincodeValue.length === 6 && /^\d+$/.test(pincodeValue)) {
      setFetchingDetails(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincodeValue}`);
        const data = await response.json();
        if (data[0] && data[0].Status === 'Success') {
          const details = data[0].PostOffice[0];
          const matchedState = indianStates.find((s) => s.name.toLowerCase() === details.State.toLowerCase());
          
          if (matchedState) {
            setSelectedStateCode(matchedState.isoCode);
          }
          
          if (details.District) {
            const poRes = await fetch(`https://api.postalpincode.in/postoffice/${details.District}`);
            const poData = await poRes.json();
            if (poData[0] && poData[0].Status === 'Success') {
              const pincodes = Array.from(new Set(poData[0].PostOffice.map((po) => po.Pincode)));
              setAvailablePincodes(pincodes);
            }
          }

          setFormData((prev) => ({
            ...prev,
            state: matchedState ? matchedState.name : details.State,
            city: details.District,
          }));
        }
      } catch (err) {
        console.error('Pincode fetch error:', err);
      } finally {
        setFetchingDetails(false);
      }
    }
  };

  const fetchLeadByPincode = async (pincodeValue) => {
    if (pincodeValue.length === 6 && /^\d+$/.test(pincodeValue)) {
      setFetchingDetails(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincodeValue}`);
        const data = await response.json();
        if (data[0] && data[0].Status === 'Success') {
          const details = data[0].PostOffice[0];
          const matchedState = indianStates.find((s) => s.name.toLowerCase() === details.State.toLowerCase());
          
          if (matchedState) {
            setLeadStateCode(matchedState.isoCode);
          }

          if (details.District) {
            const poRes = await fetch(`https://api.postalpincode.in/postoffice/${details.District}`);
            const poData = await poRes.json();
            if (poData[0] && poData[0].Status === 'Success') {
              const pincodes = Array.from(new Set(poData[0].PostOffice.map((po) => po.Pincode)));
              setLeadAvailablePincodes(pincodes);
            }
          }

          setLeadFormData((prev) => ({
            ...prev,
            state: matchedState ? matchedState.name : details.State,
            city: details.District,
          }));
        }
      } catch (err) {
        console.error('Lead Pincode fetch error:', err);
      } finally {
        setFetchingDetails(false);
      }
    }
  };

  const handleLeadStateChange = (e) => {
    const isoCode = e.target.value;
    const stateObj = indianStates.find((s) => s.isoCode === isoCode);
    setLeadStateCode(isoCode);
    setLeadAvailablePincodes([]);
    setLeadFormData((prev) => ({
      ...prev,
      state: stateObj ? stateObj.name : '',
      city: '',
      pincode: '',
    }));
  };

  const handleLeadCityChange = async (cityName) => {
    setLeadFormData((prev) => ({ ...prev, city: cityName }));
    if (!cityName) return;
    try {
      const response = await fetch(`https://api.postalpincode.in/postoffice/${cityName}`);
      const data = await response.json();
      if (data[0] && data[0].Status === 'Success') {
        const pincodes = Array.from(new Set(data[0].PostOffice.map((po) => po.Pincode)));
        setLeadAvailablePincodes(pincodes);
      }
    } catch (err) {
      console.error('Lead City pincodes error:', err);
    }
  };

  const handleLeadChange = (e) => {
    const { name, value } = e.target;
    setLeadFormData((prev) => ({ ...prev, [name]: value }));
    
    if (name === 'mobileNo' && value.length >= 10) {
      const existingLead = myDeals.find(l => l.mobileNo.trim() === value.trim()) || myLeads.find(l => l.mobileNo.trim() === value.trim());
      if (existingLead) {
        const matchedState = indianStates.find(s => s.name.toLowerCase() === (existingLead.state || '').toLowerCase());
        if (matchedState) setLeadStateCode(matchedState.isoCode);
        setLeadFormData(prev => ({
          ...prev,
          instituteName: existingLead.instituteName || '',
          contactPerson: existingLead.contactPerson || '',
          email: existingLead.email || '',
          address: existingLead.address || '',
          city: existingLead.city || '',
          state: matchedState ? matchedState.name : existingLead.state || '',
          pincode: existingLead.pincode || '',
        }));
      }
    }

    if (name === 'pincode') fetchLeadByPincode(value);
  };

  const handleInvoiceStateChange = (e) => {
    const iso = e.target.value;
    const stObj = indianStates.find(s => s.isoCode === iso);
    setSelectedStateCode(iso);
    setAvailablePincodes([]);
    setFormData(prev => ({ ...prev, state: stObj ? stObj.name : '', city: '', pincode: '' }));
  };

  const handleInvoiceCityChange = async (cName) => {
    setFormData(prev => ({ ...prev, city: cName }));
    if (!cName) return;
    try {
      const response = await fetch(`https://api.postalpincode.in/postoffice/${cName}`);
      const data = await response.json();
      if (data[0]?.Status === 'Success') {
        setAvailablePincodes(Array.from(new Set(data[0].PostOffice.map(po => po.Pincode))));
      }
    } catch (err) {
      console.error('Invoice City pincodes error:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'baseAmount' || name === 'paidAmount' || name === 'previousDueBalance' ? Number(value) : value,
    }));

    if (name === 'instituteName') {
      const searchVal = value.trim().toLowerCase();

      const matchingDeal = myDeals.find(
        (d) => d.instituteName && d.instituteName.trim().toLowerCase() === searchVal
      );

      let pastDue = 0;
      if (matchingDeal) {
        pastDue = matchingDeal.dueAmount || 0; 
      }

      const matchedLead = activeLeadsList.find(
        (l) => l.instituteName && l.instituteName.trim().toLowerCase() === searchVal
      );

      const targetData = matchingDeal || matchedLead;
      if (targetData) {
        const matchedState = indianStates.find(
          (s) => s.name.toLowerCase() === (targetData.state || '').toLowerCase()
        );
        if (matchedState) setSelectedStateCode(matchedState.isoCode);
        
        const isExistingDealWithDue = Boolean(matchingDeal && matchingDeal.dueAmount > 0);

        setFormData((prev) => ({
          ...prev,
          instituteName: targetData.instituteName,
          appName: targetData.appName || prev.appName,
          categories: targetData.categories || (targetData.category ? [targetData.category] : prev.categories),
          youtubeLink: targetData.youtubeLink || prev.youtubeLink,
          instagramLink: targetData.instagramLink || prev.instagramLink,
          mobileNo: targetData.mobileNo || '',
          email: targetData.email || '',
          address: targetData.address || '',
          city: targetData.city || '',
          state: matchedState ? matchedState.name : targetData.state || '',
          pincode: targetData.pincode || '',
          previousDueBalance: pastDue,
          baseAmount: isExistingDealWithDue ? 0 : 15000
        }));
      }
    }

    if (name === 'pincode') fetchByPincode(value);
  };

  const handlePayDueFromLedger = (deal) => {
    const matchedState = indianStates.find(
      (s) => s.name.toLowerCase() === (deal.state || '').toLowerCase()
    );
    if (matchedState) setSelectedStateCode(matchedState.isoCode);

    setFormData({
      ...initialFormData,
      instituteName: deal.instituteName || '',
      appName: deal.appName || '',
      categories: deal.categories || (deal.category ? [deal.category] : []),
      youtubeLink: deal.youtubeLink || '',
      instagramLink: deal.instagramLink || '',
      mobileNo: deal.mobileNo || '',
      email: deal.email || '',
      address: deal.address || '',
      city: deal.city || '',
      state: matchedState ? matchedState.name : deal.state || '',
      pincode: deal.pincode || '',
      gstNo: deal.gstNo || '',
      packageValidity: deal.packageValidity || '1 Year',
      baseAmount: 0, 
      previousDueBalance: deal.dueAmount || 0, 
      paidAmount: deal.dueAmount || 0, 
    });

    setInvoiceStep(1);
    setActiveView('invoice-form');
  };

  const handleAddonChange = (e) => {
    const { name, checked } = e.target;
    setAddons((prev) => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      if (!validateImageFile(uploadedFile)) {
        e.target.value = ''; // Reset input selection
        return;
      }
      setFile(uploadedFile);
    }
  };

  const handleLogoFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      if (!validateImageFile(uploadedFile)) {
        e.target.value = '';
        return;
      }
      setLogoFile(uploadedFile);
    }
  };
  
  const handleMeetingPhotoChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      if (!validateImageFile(uploadedFile)) {
        e.target.value = '';
        return;
      }
      setMeetingPhotoFile(uploadedFile);
      setMeetingPhotoPreview(URL.createObjectURL(uploadedFile));
    }
  };

  const handleAutoDetectLocation = async () => {
    setStatus({ loading: true, success: '', error: '' });
    const { lat, lng, isMocked } = await getSecureLocation();
    
    if (isMocked) {
      setStatus({ loading: false, success: '', error: 'Mock location detected! Operation blocked.' });
      return;
    }

    if (!lat || !lng) {
      setStatus({ loading: false, success: '', error: 'Failed to retrieve GPS location or permission denied.' });
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const fetchedStateName = addr.state || '';
        const fetchedCityName = addr.city || addr.town || addr.village || addr.district || '';
        const fetchedPincode = addr.postcode || '';
        const fullRoadAddress = data.display_name || '';

        const matchedState = indianStates.find((s) => s.name.toLowerCase() === fetchedStateName.toLowerCase());
        if (matchedState) setLeadStateCode(matchedState.isoCode);

        if (fetchedCityName) {
          const poRes = await fetch(`https://api.postalpincode.in/postoffice/${fetchedCityName}`);
          const poData = await poRes.json();
          if (poData[0] && poData[0].Status === 'Success') {
            const pincodes = Array.from(new Set(poData[0].PostOffice.map((po) => po.Pincode)));
            setLeadAvailablePincodes(pincodes);
          }
        }

        setLeadFormData((prev) => ({
          ...prev,
          address: fullRoadAddress,
          state: matchedState ? matchedState.name : fetchedStateName,
          city: fetchedCityName,
          pincode: fetchedPincode
        }));

        setStatus({ loading: false, success: 'Location auto-detected securely and address filled!', error: '' });
      }
    } catch (err) {
      setStatus({ loading: false, success: '', error: 'Failed to fetch address from coordinates.' });
    }
  };

  const handleInvoiceAutoDetectLocation = async () => {
    setStatus({ loading: true, success: '', error: '' });
    const { lat, lng, isMocked } = await getSecureLocation();

    if (isMocked) {
      setStatus({ loading: false, success: '', error: 'Mock location detected! Operation blocked.' });
      return;
    }

    if (!lat || !lng) {
      setStatus({ loading: false, success: '', error: 'Failed to retrieve GPS location or permission denied.' });
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const fetchedStateName = addr.state || '';
        const fetchedCityName = addr.city || addr.town || addr.village || addr.district || '';
        const fetchedPincode = addr.postcode || '';
        const fullRoadAddress = data.display_name || '';

        const matchedState = indianStates.find((s) => s.name.toLowerCase() === fetchedStateName.toLowerCase());
        if (matchedState) setSelectedStateCode(matchedState.isoCode);

        if (fetchedCityName) {
          const poRes = await fetch(`https://api.postalpincode.in/postoffice/${fetchedCityName}`);
          const poData = await poRes.json();
          if (poData[0] && poData[0].Status === 'Success') {
            const pincodes = Array.from(new Set(poData[0].PostOffice.map((po) => po.Pincode)));
            setAvailablePincodes(pincodes);
          }
        }

        setFormData((prev) => ({
          ...prev,
          address: fullRoadAddress,
          state: matchedState ? matchedState.name : fetchedStateName,
          city: fetchedCityName,
          pincode: fetchedPincode
        }));

        setStatus({ loading: false, success: 'Location auto-detected securely and invoice address filled!', error: '' });
      }
    } catch (err) {
      setStatus({ loading: false, success: '', error: 'Failed to fetch invoice address.' });
    }
  };

  const handleUpdateLeadStatus = async (leadId, newLeadStatus, newDemoStatus, extraPayload = {}) => {
    try {
      const token = localStorage.getItem('token');
      const formDataObj = new FormData();
      
      formDataObj.append('leadStatus', newLeadStatus || selectedLead?.leadStatus || 'Active');
      formDataObj.append('demoStatus', newDemoStatus || selectedLead?.demoStatus || 'Not Given');

      if (extraPayload.followUpDate) {
        formDataObj.append('followUpDate', extraPayload.followUpDate);
        formDataObj.append('followUpTime', extraPayload.followUpTime || '');
        formDataObj.append('followUpAction', newLeadStatus);
      }

      if (newDemoStatus === 'Completed') {
        const timeStamp = new Date().toLocaleString('en-IN');
        const reviewText = extraPayload.reviewNotes ? ` | Review: "${extraPayload.reviewNotes}"` : '';
        const timestampStr = `[Demo Completed & Verified on: ${timeStamp}${reviewText}]`;
        
        const finalNotes = selectedLead?.notes 
          ? `${selectedLead.notes}\n${timestampStr}` 
          : timestampStr;
        
        formDataObj.append('notes', finalNotes);
        if (extraPayload.proofFile) {
          formDataObj.append('meetingPhoto', extraPayload.proofFile);
        }
      } else if (extraPayload.reviewNotes) {
        const finalNotes = selectedLead?.notes 
          ? `${selectedLead.notes}\n[Update]: ${extraPayload.reviewNotes}` 
          : `[Update]: ${extraPayload.reviewNotes}`;
        formDataObj.append('notes', finalNotes);
      }

      const res = await fetch(`${API_BASE}/api/salesperson/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataObj
      });
      const data = await res.json();
      if (res.ok) {
        fetchMyLeads();
        if (selectedLead) setSelectedLead(null);
        setActiveModalAction(null);
        setFollowUpModalAction(null);
        setModalDate('');
        setModalTime('');
        setDemoReviewNotes('');
        setDemoProofFile(null);
        toast.success('Lead updated successfully!');
      } else {
        toast.error(data.message || 'Failed to update');
      }
    } catch (err) {
      console.error('Error updating lead:', err);
      toast.error('Network error during lead update.');
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (dayStatus !== 'ACTIVE') {
      toast.error('Action Blocked: You must start your working day first!');
      return;
    }
    if (!meetingPhotoFile) {
      setStatus({ loading: false, success: '', error: 'Please upload the meeting photo!' });
      return;
    }

    setStatus({ loading: true, success: 'Validating secure GPS & saving lead visit...', error: '' });

    const { lat, lng, isMocked } = await getSecureLocation();
    if (isMocked) {
      setStatus({ loading: false, success: '', error: 'Action Blocked: Mock Location / Fake GPS detected!' });
      return;
    }

    const processLeadSubmission = async (latitude = null, longitude = null) => {
      const data = new FormData();
      Object.keys(leadFormData).forEach((key) => {
        if (leadFormData[key] !== undefined && leadFormData[key] !== null) {
          data.append(key, leadFormData[key]);
        }
      });
      
      const now = new Date();
      data.append('leadDate', now.toISOString().split('T')[0]);
      data.append('leadTime', now.toTimeString().substring(0, 5));

      data.append('meetingPhoto', meetingPhotoFile);
      if (latitude && longitude) {
        data.append('latitude', latitude);
        data.append('longitude', longitude);
      }

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/salesperson/leads`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: data
        });
        const resData = await res.json();

        if (!res.ok) throw new Error(resData.message || 'Failed to save lead');

        setStatus({ loading: false, success: resData.message || 'Lead visit saved successfully!', error: '' });
        setLeadFormData(initialLeadFormData);
        setLeadStateCode('');
        setMeetingPhotoFile(null);
        setMeetingPhotoPreview(null);
        fetchMyLeads();

        setTimeout(() => {
          setActiveView('leads');
          setStatus({ loading: false, success: '', error: '' });
        }, 1500);
      } catch (err) {
        setStatus({ loading: false, success: '', error: err.message });
      }
    };

    await processLeadSubmission(lat, lng);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dayStatus !== 'ACTIVE') {
      toast.error('Action Blocked: You must start your working day first!');
      return;
    }
    if (!file) {
      setStatus({ loading: false, success: '', error: 'Please upload payment proof!' });
      return;
    }
    if (!formData.categories || formData.categories.length === 0) {
      toast.error('Please select at least one category!');
      return;
    }

    setStatus({ loading: true, success: 'Verifying secure GPS & submitting installment...', error: '' });

    const { lat, lng, isMocked } = await getSecureLocation();
    if (isMocked) {
      setStatus({ loading: false, success: '', error: 'Action Blocked: Mock Location / Fake GPS detected!' });
      return;
    }

    const processSubmission = async (latitude = null, longitude = null) => {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'categories') {
          data.append('categories', JSON.stringify(formData.categories));
        } else {
          data.append(key, formData[key]);
        }
      });
      data.append('dueAmount', dueAmount);
      data.append('paymentProof', file);
      if (logoFile) {
        data.append('logoProof', logoFile);
      }
      data.append('addons', JSON.stringify(addons));

      if (latitude && longitude) {
        data.append('latitude', latitude);
        data.append('longitude', longitude);
      }

      try {
        const resData = await submitInvoiceRequest(data);
        
        if (dueAmount === 0) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          setSettledAlert({
            institute: formData.instituteName,
            invoiceId: resData.invoiceId || 'New'
          });
        }

        setStatus({
          loading: false,
          success: `Installment submitted successfully! Remaining Due Balance: ₹${dueAmount}`,
          error: '',
        });

        setFormData(initialFormData);
        setSelectedStateCode('');
        setAddons(initialAddons);
        setFile(null);
        setLogoFile(null);
        setIsCouponApplied(false);
        setCouponInput('');
        setCouponDetails(null);
        setInvoiceStep(1);
        fetchMyDeals();

        setTimeout(() => {
          if (dueAmount > 0) {
            setActiveView('dashboard');
          }
          setStatus({ loading: false, success: '', error: '' });
        }, 2500);
      } catch (err) {
        setStatus({ loading: false, success: '', error: err.response?.data?.message || err.message || 'Submission failed' });
      }
    };

    await processSubmission(lat, lng);
  };

  return (
    <div className="min-h-dvh bg-[var(--color-background)] p-3 sm:p-5 md:p-8 pb-24 md:pb-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        
        <AnimatePresence>
          {settledAlert && <SettlementModal settledAlert={settledAlert} onClose={() => { setSettledAlert(null); setActiveView('dashboard'); }} />}
          {showLogoutModal && <LogoutModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={() => { setShowLogoutModal(false); onLogout(); }} />}
          {showEndDayModal && <EndDayConfirmModal show={showEndDayModal} onClose={() => setShowEndDayModal(false)} onConfirm={executeEndDay} />}
        </AnimatePresence>

        {/* --- ⏱️ DAILY PERFORMANCE SUMMARY FLASH REPORT MODAL --- */}
        {daySummaryModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[99999]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[var(--color-card)] border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl text-center"
            >
              <span className="text-5xl animate-bounce inline-block">📋</span>
              <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-heading)]">Daily Performance Summary</h3>
              
              <div className="grid grid-cols-2 gap-3 text-left text-xs sm:text-sm bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] text-[var(--color-heading)]">
                <p>⏱️ Start Time: <strong>{daySummaryModal.startTime}</strong></p>
                <p>🏁 End Time: <strong>{daySummaryModal.endTime}</strong></p>
                <p>⏳ Working Hours: <strong>{daySummaryModal.workingHours}</strong></p>
                <p>📍 Total Visits: <strong className="text-blue-600">{daySummaryModal.totalVisits}</strong></p>
                <p>💰 Collections: <strong className="text-emerald-600">₹{daySummaryModal.totalCollected?.toLocaleString('en-IN')}</strong></p>
                <p>🛣️ Distance: <strong className="text-purple-600">{daySummaryModal.totalDistanceKm} KM</strong></p>
              </div>

              <button
                onClick={() => setDaySummaryModal(null)}
                className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition shadow-sm active:scale-95"
              >
                Close Report & Return
              </button>
            </motion.div>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-6 rounded-3xl shadow-sm gap-4 transition-all duration-300 hover:shadow-md">
          <div className="space-y-1 min-w-0 w-full sm:w-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              SALESPERSON PORTAL 
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--color-heading)] tracking-tight mt-1 truncate">
              {activeView === 'dashboard' && 'My Dashboard'}
              {activeView === 'leads' && 'My Generated Leads'}
              {activeView === 'kanban' && '📌 Manage Lead'}
              {activeView === 'calendar' && '📅 Follow-up & Meeting Calendar'}
              {activeView === 'lead-form' && 'New Lead & Client Visit'}
              {activeView === 'invoice-form' && 'Invoices & Installments'}
            </h1>
            <p className="text-[var(--color-body)] text-xs truncate">Signed in as <strong className="text-[var(--color-primary)]">{username || userId}</strong></p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] relative cursor-pointer hover:bg-[var(--color-border)]/50 transition flex items-center justify-center text-base shadow-sm active:scale-95 min-h-[46px] min-w-[46px]"
                aria-label="View Follow-up & Demo Alerts"
              >
                🔔
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                    {totalUnreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl shadow-2xl p-4 z-50 space-y-4 max-h-[450px] overflow-y-auto text-xs"
                  >
                    <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-2.5">
                      <strong className="text-[var(--color-heading)] font-bold">🔔 Notifications & Broadcasts</strong>
                      <button 
                        onClick={() => setShowNotifications(false)} 
                        className="w-7 h-7 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-xs text-[var(--color-heading)] hover:bg-[var(--color-border)] transition cursor-pointer"
                        title="Hide notifications"
                      >
                        ✕
                      </button>
                    </div>

                    {/* --- SECTION 1: PERSISTENT ADMIN BROADCASTS --- */}
                    {broadcastNotifications.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block px-1">
                          📢 Admin Announcements ({broadcastNotifications.length})
                        </span>
                        {broadcastNotifications.map((b) => (
                          <div 
                            key={b._id} 
                            className={`p-3.5 rounded-2xl border space-y-1.5 transition ${
                              b.priority === 'urgent' ? 'bg-red-500/10 border-red-500/30 text-red-600' : 
                              b.priority === 'important' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' : 
                              'bg-purple-500/10 border-purple-500/20 text-[var(--color-heading)]'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <strong className="font-bold">📢 {b.title}</strong>
                              <button
                                onClick={(e) => handleClearBroadcast(b._id, e)}
                                className="bg-[var(--color-card)] hover:bg-red-500 hover:text-white text-[var(--color-body)] border px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition"
                                title="Clear Announcement"
                              >
                                ✕ Clear
                              </button>
                            </div>
                            <p className="text-[var(--color-body)] leading-relaxed">{b.message}</p>
                            <span className="text-[9px] text-[var(--color-body)] block pt-0.5">
                              {new Date(b.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* --- SECTION 2: TASK REMINDERS --- */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block px-1">
                        📋 Task Reminders ({notifications.length})
                      </span>
                      {notifications.length === 0 && broadcastNotifications.length === 0 ? (
                        <div className="py-8 text-center text-[var(--color-body)] space-y-1">
                          <p className="text-sm">☕ All caught up!</p>
                          <p className="text-xs">No pending reminders or broadcasts.</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n._id || Math.random()} 
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('token');
                                await fetch(`${API_BASE}/api/salesperson/notifications/${n._id}/dismiss`, {
                                  method: 'PUT',
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                setNotifications(prev => prev.filter(item => item._id !== n._id));
                              } catch (err) {
                                console.error("Failed to dismiss notification:", err);
                              }
                            }}
                            className="p-3.5 rounded-2xl border space-y-1.5 transition bg-emerald-500/10 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 active:scale-98"
                            title="Click to dismiss notification"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <strong className="text-[var(--color-heading)] font-bold truncate">{n.title}</strong>
                              <span className="text-[10px] text-[var(--color-body)] shrink-0">
                                {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[var(--color-body)] font-medium break-words leading-relaxed">{n.message}</p>
                            <span className="text-[10px] text-emerald-600 block pt-1 font-semibold">Tap to dismiss ➔</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-600 border border-red-500/20 transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-sm shrink-0 active:scale-95 min-h-[46px]"
            >
              Logout
            </button>
          </div>
        </div>

        {/* --- ⏱️ DAY START / END ATTENDANCE & SHIFT CONTROL BAR --- */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 sm:p-6 md:p-7 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div className="flex items-start sm:items-center gap-3.5 w-full sm:w-auto min-w-0 flex-1">
            <span className="text-3xl p-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shrink-0">⏰</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-[var(--color-heading)] uppercase tracking-wider">Shift & Attendance Status</h3>
              <p className="text-xs text-[var(--color-body)] mt-0.5 leading-relaxed">
                {dayStatus === 'LOADING' && 'Checking day status...'}
                {dayStatus === 'NOT_STARTED' && '⏳ Day not started. Click "Start Day" to capture GPS location and unlock leads & invoices.'}
                {dayStatus === 'ACTIVE' && '🟢 Shift Active. GPS active and system entries are fully enabled.'}
                {dayStatus === 'ENDED' && '🔒 Shift Ended for today. Entries are locked until tomorrow.'}
              </p>
              {startLocationName && (
                <p className="text-xs font-semibold text-[var(--color-primary)] mt-1.5 flex items-center gap-1.5 truncate">
                  📍 <span className="shrink-0">Start Location:</span> <strong className="text-[var(--color-heading)] truncate">{startLocationName}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="w-full sm:w-auto flex justify-end sm:pr-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--color-border)]">
            {dayStatus === 'NOT_STARTED' && (
              <button
                onClick={handleStartDay}
                disabled={status.loading}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition shadow-sm active:scale-95 min-h-[46px] disabled:opacity-50 text-center"
              >
                {status.loading ? 'Capturing GPS...' : '🚀 Start Day'}
              </button>
            )}
            {dayStatus === 'ACTIVE' && (
              <button
                onClick={() => setShowEndDayModal(true)}
                disabled={status.loading}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition shadow-sm active:scale-95 min-h-[46px] disabled:opacity-50 text-center"
              >
                {status.loading ? 'Processing...' : '🛑 End Day'}
              </button>
            )}
            {dayStatus === 'ENDED' && (
              <span className="w-full sm:w-auto text-center bg-gray-500/10 text-gray-500 border border-gray-500/20 px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm">
                Day Completed 🏁
              </span>
            )}
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden sm:flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto scrollbar-thin">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 min-h-[44px] ${
                activeView === 'dashboard' ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20' : 'text-[var(--color-heading)] hover:bg-[var(--color-surface)]'
              }`}
            >
              📊 Dashboard & Dues
            </button>
            <button
              onClick={() => setActiveView('leads')}
              className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 min-h-[44px] ${
                activeView === 'leads' ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20' : 'text-[var(--color-heading)] hover:bg-[var(--color-surface)]'
              }`}
            >
              📋 My Leads ({totalLeadsCount})
            </button>
            <button
              onClick={() => setActiveView('kanban')}
              className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 min-h-[44px] ${
                activeView === 'kanban' ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20' : 'text-[var(--color-heading)] hover:bg-[var(--color-surface)]'
              }`}
            >
              Manage Lead
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 min-h-[44px] ${
                activeView === 'calendar' ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20' : 'text-[var(--color-heading)] hover:bg-[var(--color-surface)]'
              }`}
            >
              📅 Calendar
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-stretch sm:justify-end">
            <button
              onClick={() => {
                if (dayStatus !== 'ACTIVE') {
                  toast.error('Please start your day first!');
                  return;
                }
                setActiveView('lead-form');
              }}
              className={`flex-1 sm:flex-initial px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 min-h-[44px] ${
                activeView === 'lead-form' ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/50'
              }`}
            >
              ➕ Record Visit / New Lead
            </button>
            <button
              onClick={() => {
                if (dayStatus !== 'ACTIVE') {
                  toast.error('Please start your day first!');
                  return;
                }
                setInvoiceStep(1); 
                setActiveView('invoice-form'); 
              }}
              className={`flex-1 sm:flex-initial px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 min-h-[44px] ${
                activeView === 'invoice-form' ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/50'
              }`}
            >
              🧾 New Invoice / Installment
            </button>
          </div>
        </div>

        {/* --- MOBILE THUMB-FRIENDLY BOTTOM NAVIGATION BAR (FIXED OVERLAP & DYNAMIC THEME) --- */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-card)] border-t border-[var(--color-border)] z-40 px-2 py-2 flex justify-between items-center shadow-2xl backdrop-blur-lg bg-opacity-95">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition w-1/5 ${activeView === 'dashboard' ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-body)]'}`}
          >
            <span className="text-lg">📊</span>
            <span className="text-[9px]">Dash</span>
          </button>
          <button
            onClick={() => setActiveView('leads')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition w-1/5 ${activeView === 'leads' ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-body)]'}`}
          >
            <span className="text-lg">📋</span>
            <span className="text-[9px]">Leads</span>
          </button>
          <div className="w-1/5 flex justify-center">
            <button
              onClick={() => {
                if (dayStatus !== 'ACTIVE') { toast.error('Start day first!'); return; }
                setActiveView('lead-form');
              }}
              className="flex flex-col items-center justify-center -mt-8 bg-[var(--color-primary)] text-white w-12 h-12 rounded-full shadow-lg border-4 border-[var(--color-background)] active:scale-90 transition"
            >
              <span className="text-2xl font-bold leading-none">＋</span>
            </button>
          </div>
          <button
            onClick={() => setActiveView('kanban')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition w-1/5 ${activeView === 'kanban' ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-body)]'}`}
          >
            <span className="text-lg">📌</span>
            <span className="text-[9px]">Pipeline</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-[var(--color-body)] w-1/5 transition hover:text-[var(--color-primary)]"
          >
            <span className="text-lg">{isDarkMode ? '☀️' : '🌙'}</span>
            <span className="text-[9px]">{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {/* --- VIEW CONTAINER WITH SMOOTH FRAMER MOTION TRANSITION --- */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div onClick={() => { if (dayStatus !== 'ACTIVE') { toast.error('Start day first!'); return; } setActiveView('lead-form'); }} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-5 sm:p-6 rounded-3xl shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-1 flex items-center justify-between group">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">➕ Create / Visit Lead</h3>
                      <p className="text-xs sm:text-sm text-[var(--color-body)] mt-1">Record client visit & meeting photo.</p>
                    </div>
                    <span className="text-3xl p-3.5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shrink-0 transition group-hover:scale-110">🎯</span>
                  </div>
                  <div onClick={() => setActiveView('kanban')} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-5 sm:p-6 rounded-3xl shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-1 flex items-center justify-between group">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">📌 Manage Lead</h3>
                      <p className="text-xs sm:text-sm text-[var(--color-body)] mt-1">Manage leads across sales stages.</p>
                    </div>
                    <span className="text-3xl p-3.5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shrink-0 transition group-hover:scale-110">📋</span>
                  </div>
                  <div onClick={() => { if (dayStatus !== 'ACTIVE') { toast.error('Start day first!'); return; } setInvoiceStep(1); setActiveView('invoice-form'); }} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-5 sm:p-6 rounded-3xl shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-1 flex items-center justify-between group">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">🧾 Submit Installment</h3>
                      <p className="text-xs sm:text-sm text-[var(--color-body)] mt-1">Pay due amount & clear balance.</p>
                    </div>
                    <span className="text-3xl p-3.5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shrink-0 transition group-hover:scale-110">💳</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 shadow-sm space-y-1.5 transition hover:shadow-md hover:-translate-y-0.5">
                    <span className="text-xs sm:text-sm text-[var(--color-body)] block font-medium">Total Deals</span>
                    <strong className="text-xl sm:text-2xl font-extrabold text-[var(--color-primary)]">{totalDealsCount}</strong>
                  </div>
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 shadow-sm space-y-1.5 transition hover:shadow-md hover:-translate-y-0.5">
                    <span className="text-xs sm:text-sm text-[var(--color-body)] block font-medium">Active Leads</span>
                    <strong className="text-xl sm:text-2xl font-extrabold text-blue-600">{totalLeadsCount}</strong>
                  </div>
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 shadow-sm space-y-1.5 transition hover:shadow-md hover:-translate-y-0.5">
                    <span className="text-xs sm:text-sm text-[var(--color-body)] block font-medium">Approved Invoices</span>
                    <strong className="text-xl sm:text-2xl font-extrabold text-emerald-600">{approvedDealsCount}</strong>
                  </div>
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 shadow-sm space-y-1.5 transition hover:shadow-md hover:-translate-y-0.5">
                    <span className="text-xs sm:text-sm text-[var(--color-body)] block font-medium">Pending Invoices</span>
                    <strong className="text-xl sm:text-2xl font-extrabold text-amber-600">{pendingDealsCount}</strong>
                  </div>
                  <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 shadow-sm col-span-2 sm:col-span-3 md:col-span-1 space-y-1.5 transition hover:shadow-md hover:-translate-y-0.5">
                    <span className="text-xs sm:text-sm text-[var(--color-body)] block font-medium">Collected</span>
                    <strong className="text-xl sm:text-2xl font-extrabold text-emerald-600">₹{totalPaidCollected.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 md:p-8 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-4 gap-2">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">📊 Institute Due Ledger</h3>
                      <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">See exact pending dues per institute. Click "Pay Due" to instantly jump to invoice page with pre-filled balance.</p>
                    </div>
                    <span className="text-xs sm:text-sm bg-[var(--color-surface)] px-3.5 py-2 rounded-xl border border-[var(--color-border)] font-semibold shrink-0">
                      {myDeals.length} Deal(s)
                    </span>
                  </div>

                  {loadingDeals ? (
                    <SkeletonLoader rows={3} />
                  ) : myDeals.length === 0 ? (
                    <div className="text-center py-16 bg-[var(--color-surface)] rounded-3xl text-xs sm:text-sm text-[var(--color-body)] space-y-3 border border-[var(--color-border)]">
                      <p>No institute deals found yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {myDeals.map((deal) => (
                        <div key={deal._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs sm:text-sm transition hover:border-[var(--color-primary)]/40">
                          <div className="space-y-1.5 min-w-0 w-full md:w-auto">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="text-sm sm:text-base text-[var(--color-heading)] font-bold break-words">{deal.instituteName}</strong>
                              <span className="text-[var(--color-body)]">({deal.appName})</span>
                            </div>
                            <p className="break-words">👤 Contact: <a href={`tel:${deal.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{deal.mobileNo}</a> | 📍 {deal.city || 'N/A'}, {deal.state || ''}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-medium text-[var(--color-body)]">
                              <span>Total Bill: <strong>₹{deal.totalAmount?.toLocaleString('en-IN')}</strong></span>
                              <span>Paid So Far: <strong className="text-emerald-600">₹{deal.paidAmount?.toLocaleString('en-IN')}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-[var(--color-border)]">
                            <div className="text-left md:text-right">
                              <span className="text-[10px] sm:text-xs uppercase font-bold text-[var(--color-body)] block">Due Amount</span>
                              <span className={`text-sm sm:text-base font-extrabold ${deal.dueAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ₹{deal.dueAmount?.toLocaleString('en-IN')} {deal.dueAmount === 0 ? '✨ (Cleared)' : ''}
                              </span>
                            </div>

                            {deal.dueAmount > 0 ? (
                              <button
                                onClick={() => {
                                  if (dayStatus !== 'ACTIVE') {
                                    toast.error('Start day first!');
                                    return;
                                  }
                                  handlePayDueFromLedger(deal);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold cursor-pointer transition shadow-sm shrink-0 active:scale-95 min-h-[44px]"
                              >
                                Pay Due ➔
                              </button>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-4 py-3 rounded-xl font-bold shrink-0">
                                Fully Settled
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'leads' && (
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 md:p-8 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-4 gap-3">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">📋 My Generated Leads & Visit Records</h3>
                  <button onClick={() => { if (dayStatus !== 'ACTIVE') { toast.error('Start day first!'); return; } setActiveView('lead-form'); }} className="bg-[var(--color-primary)] text-white text-xs sm:text-sm px-5 py-3 rounded-2xl font-semibold cursor-pointer shadow-sm w-full sm:w-auto text-center active:scale-95 transition min-h-[44px]">
                    ➕ Record Visit / New Lead
                  </button>
                </div>

                <div className="space-y-3.5">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--color-body)]">🔍</span>
                    <input
                      type="text"
                      value={leadSearchQuery}
                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                      placeholder="Search by institute name, contact person, mobile number..."
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl py-3.5 pl-11 pr-16 text-xs sm:text-sm text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium transition"
                    />
                    {leadSearchQuery && (
                      <button onClick={() => setLeadSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs sm:text-sm text-[var(--color-body)] hover:text-[var(--color-heading)]">
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                    <button onClick={() => setLeadFilter('all')} className={`text-xs sm:text-sm px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition shrink-0 active:scale-95 ${leadFilter === 'all' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                      All Active ({activeLeadsList.length})
                    </button>
                    <button onClick={() => setLeadFilter('call')} className={`text-xs sm:text-sm px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition shrink-0 active:scale-95 ${leadFilter === 'call' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                      📞 To Call / Call Back
                    </button>
                    <button onClick={() => setLeadFilter('meeting')} className={`text-xs sm:text-sm px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition shrink-0 active:scale-95 ${leadFilter === 'meeting' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                      🤝 Meetings
                    </button>
                    <button onClick={() => setLeadFilter('demo-done')} className={`text-xs sm:text-sm px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition shrink-0 active:scale-95 ${leadFilter === 'demo-done' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                      ✅ Demo Done
                    </button>
                    <button onClick={() => setLeadFilter('demo-pending')} className={`text-xs sm:text-sm px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition shrink-0 active:scale-95 ${leadFilter === 'demo-pending' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                      ⏳ Demo Pending
                    </button>
                    <button onClick={() => setLeadFilter('not-interested')} className={`text-xs sm:text-sm px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition shrink-0 active:scale-95 ${leadFilter === 'not-interested' ? 'bg-red-600 text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                      ❌ Not Interested
                    </button>
                  </div>
                </div>

                {loadingLeads ? (
                  <SkeletonLoader rows={3} />
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-16 bg-[var(--color-surface)] rounded-3xl text-xs sm:text-sm text-[var(--color-body)] space-y-3 border border-[var(--color-border)]">
                    <p>No leads found matching your search or filter.</p>
                    <button onClick={() => { setLeadFilter('all'); setLeadSearchQuery(''); }} className="bg-[var(--color-primary)] text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl active:scale-95 transition">Reset Search & Filters</button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {filteredLeads.map((lead) => (
                      <div key={lead._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 p-4 sm:p-5 rounded-2xl space-y-3 text-xs sm:text-sm transition shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-3 gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong onClick={() => setSelectedLead(lead)} className="text-sm sm:text-base text-[var(--color-heading)] font-bold cursor-pointer hover:text-[var(--color-primary)] break-words">{lead.instituteName}</strong>
                            {lead.visitCount > 1 && (
                              <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-full font-bold text-[11px]">
                                🔄 {lead.visitCount} Visits
                              </span>
                            )}
                          </div>
                          <span className={`px-3.5 py-1.5 rounded-full font-bold text-[11px] uppercase tracking-wider ${lead.leadStatus === 'Not Interested' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>
                            {lead.leadStatus || 'Active Lead'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[var(--color-heading)]">
                          <div className="break-words">
                            👤 <strong>Contact:</strong> {lead.contactPerson} | 📞 <a href={`tel:${lead.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{lead.mobileNo}</a>
                          </div>
                          <div onClick={() => setSelectedLead(lead)} className="cursor-pointer break-words">📍 <strong>Location:</strong> {lead.address || 'N/A'}, {lead.city}, {lead.state}</div>
                          <div onClick={() => setSelectedLead(lead)} className="cursor-pointer">🎯 <strong>Demo Status:</strong> <span className="text-amber-600 font-semibold">{lead.demoStatus || 'Not Given'}</span></div>
                          {lead.followUpDate && (
                            <div onClick={() => setSelectedLead(lead)} className="sm:col-span-2 text-amber-600 font-semibold bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <span className="break-words">🔔 <strong>Follow-up Reminder:</strong> {lead.followUpAction} on {new Date(lead.followUpDate).toLocaleDateString('en-IN')} {lead.followUpTime ? `at ${lead.followUpTime}` : ''}</span>
                              <button onClick={(e) => { e.stopPropagation(); handleWhatsAppReminder(lead, 'followup'); }} className="bg-[#25D366] text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 cursor-pointer flex items-center gap-2 shadow-sm shrink-0 active:scale-95 transition min-h-[40px]">
                                <WhatsAppIcon />
                                WhatsApp
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 🌟 ENHANCED LEAD DETAILS & STATUS UPDATE MODAL */}
                {selectedLead && (
                  <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50" onClick={() => { setSelectedLead(null); setActiveModalAction(null); }}>
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 md:p-8 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3 gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)] break-words">{selectedLead.instituteName}</h3>
                          {selectedLead.visitCount > 1 && (
                            <span className="text-xs text-emerald-600 font-semibold">Total Visits : {selectedLead.visitCount}</span>
                          )}
                        </div>
                        <button onClick={() => { setSelectedLead(null); setActiveModalAction(null); }} className="w-9 h-9 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-sm cursor-pointer shrink-0 active:scale-90 transition" aria-label="Close modal">✕</button>
                      </div>

                      <div className="space-y-2.5 text-xs sm:text-sm text-[var(--color-heading)] break-words">
                        <p>👤 <strong>Contact Person:</strong> {selectedLead.contactPerson} | 📞 <a href={`tel:${selectedLead.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{selectedLead.mobileNo}</a></p>
                        <p>✉️ <strong>Email:</strong> {selectedLead.email || 'N/A'}</p>
                        <p>📍 <strong>Address:</strong> {selectedLead.address || 'N/A'}, {selectedLead.city}, {selectedLead.state} - {selectedLead.pincode}</p>
                        <p>🎯 <strong>Current Demo Status:</strong> <span className="text-[var(--color-primary)] font-bold">{selectedLead.demoStatus || 'Not Given'}</span></p>
                        {selectedLead.notes && (
                          <div className="bg-[var(--color-surface)] p-3.5 rounded-2xl border border-[var(--color-border)] mt-2">
                            <strong className="block text-[var(--color-body)] mb-1">📝 Visit & History Notes:</strong>
                            <p className="whitespace-pre-line text-xs">{selectedLead.notes}</p>
                          </div>
                        )}
                        {selectedLead.meetingPhoto && (
                          <div className="pt-1">
                            <strong className="block mb-1 text-[var(--color-body)]">Meeting Photo:</strong>
                            <img src={`${API_BASE}/${selectedLead.meetingPhoto}`} alt="Meeting" className="h-40 w-full rounded-2xl object-cover border border-[var(--color-border)]" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3.5 pt-3.5 border-t border-[var(--color-border)]">
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 text-[var(--color-primary)] uppercase">1. Update Demo & Follow-up Status</label>
                          <div className="flex gap-2 flex-wrap">
                            <button type="button" onClick={() => handleUpdateLeadStatus(selectedLead._id, selectedLead.leadStatus, 'Not Given')} className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border cursor-pointer transition ${selectedLead.demoStatus === 'Not Given' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}>
                              ⏳ Not Given
                            </button>
                            <button type="button" onClick={() => setActiveModalAction('reschedule')} className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border cursor-pointer transition ${activeModalAction === 'reschedule' ? 'bg-amber-600 text-white border-transparent' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-amber-600'}`}>
                              📅 Reschedule / Call Back
                            </button>
                            <button type="button" onClick={() => setActiveModalAction('completed')} className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border cursor-pointer transition ${activeModalAction === 'completed' ? 'bg-emerald-600 text-white border-transparent' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-emerald-600'}`}>
                              ✅ Completed (Add Review & Photo)
                            </button>
                          </div>
                        </div>

                        {/* 🌟 RESCHEDULE SUB-FORM */}
                        {activeModalAction === 'reschedule' && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                            <p className="text-xs sm:text-sm font-bold text-amber-700">Select Reschedule Date & Time:</p>
                            <div className="grid grid-cols-2 gap-2.5">
                              <input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm" />
                              <input type="time" value={modalTime} onChange={(e) => setModalTime(e.target.value)} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm" />
                            </div>
                            <button type="button" onClick={() => {
                              if (!modalDate) { toast.error('Please pick a reschedule date!'); return; }
                              handleUpdateLeadStatus(selectedLead._id, 'Call Back', 'Scheduled', { followUpDate: modalDate, followUpTime: modalTime });
                            }} className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm py-3 rounded-xl font-semibold cursor-pointer min-h-[44px]">
                              Confirm Reschedule Date
                            </button>
                          </div>
                        )}

                        {/* 🌟 DEMO COMPLETED SUB-FORM WITH PHOTO & REVIEW */}
                        {activeModalAction === 'completed' && (
                          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                            <p className="text-xs sm:text-sm font-bold text-emerald-700">Demo Completion Details:</p>
                            <div>
                              <label className="block text-xs font-medium mb-1">Client Feedback / Review Notes:</label>
                              <textarea 
                                rows="2" 
                                value={demoReviewNotes} 
                                onChange={(e) => setDemoReviewNotes(e.target.value)} 
                                placeholder="e.g. Client loved the test series feature, requested price quote..." 
                                className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm"
                              ></textarea>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">📸 Upload Demo Verification Photo / Screenshot (.jpg, .png):</label>
                              <input 
                                type="file" 
                                accept="image/jpeg, image/jpg, image/png" 
                                onChange={(e) => {
                                  const fileItem = e.target.files[0];
                                  if (fileItem && validateImageFile(fileItem)) {
                                    setDemoProofFile(fileItem);
                                  } else {
                                    e.target.value = '';
                                  }
                                }} 
                                className="block w-full text-xs text-[var(--color-body)] cursor-pointer" 
                              />
                            </div>
                            <button type="button" onClick={() => {
                              handleUpdateLeadStatus(selectedLead._id, selectedLead.leadStatus, 'Completed', { reviewNotes: demoReviewNotes, proofFile: demoProofFile });
                            }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm py-3 rounded-xl font-semibold cursor-pointer min-h-[44px]">
                              Save Completed Demo & Upload
                            </button>
                          </div>
                        )}

                        <div>
                          <button type="button" onClick={async () => {
                            if (dayStatus !== 'ACTIVE') {
                              toast.error('Start day first!');
                              return;
                            }
                            await handleUpdateLeadStatus(selectedLead._id, 'Deal Close', null);
                            setFormData((prev) => ({
                              ...prev,
                              instituteName: selectedLead.instituteName,
                              mobileNo: selectedLead.mobileNo,
                              email: selectedLead.email || '',
                              address: selectedLead.address || '',
                              city: selectedLead.city,
                              state: selectedLead.state,
                              pincode: selectedLead.pincode
                            }));
                            setSelectedLead(null);
                            setInvoiceStep(1);
                            setActiveView('invoice-form');
                          }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-2xl text-xs sm:text-sm transition cursor-pointer shadow-sm active:scale-95 min-h-[46px]">
                            🚀 Sales Punch (Generate Invoice & Close Lead)
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold mb-1.5 text-[var(--color-primary)] uppercase">3. Update Lead Stage / Response</label>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button onClick={() => setFollowUpModalAction('Call Back')} className="bg-amber-500/10 text-amber-600 border border-amber-500/20 py-3 rounded-xl font-semibold cursor-pointer hover:bg-amber-500/20 transition active:scale-95 min-h-[44px]">📞 Call Back</button>
                            <button onClick={() => setFollowUpModalAction('Follow Up')} className="bg-blue-500/10 text-blue-600 border border-blue-500/20 py-3 rounded-xl font-semibold cursor-pointer hover:bg-blue-500/20 transition active:scale-95 min-h-[44px]">🔔 Follow Up</button>
                            <button onClick={() => handleUpdateLeadStatus(selectedLead._id, 'Not Interested', null)} className="bg-red-500/10 text-red-500 border border-red-500/20 py-3 rounded-xl font-semibold cursor-pointer hover:bg-red-500/20 transition active:scale-95 min-h-[44px]">❌ Not Interested</button>
                            <button onClick={() => handleUpdateLeadStatus(selectedLead._id, 'Deal Close', null)} className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 py-3 rounded-xl font-semibold cursor-pointer hover:bg-emerald-500/20 transition active:scale-95 min-h-[44px]">🎉 Deal Close</button>
                          </div>

                          {followUpModalAction && (
                            <div className="mt-3.5 p-4 bg-[var(--color-surface)] border border-[var(--color-primary)]/40 rounded-2xl space-y-3">
                              <p className="text-xs sm:text-sm font-bold text-[var(--color-primary)]">Select Date & Time for {followUpModalAction}:</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm" />
                                <input type="time" value={modalTime} onChange={(e) => setModalTime(e.target.value)} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm" />
                              </div>
                              <button type="button" onClick={() => {
                                if (!modalDate) { toast.error('Please select a date!'); return; }
                                handleUpdateLeadStatus(selectedLead._id, followUpModalAction, null, { followUpDate: modalDate, followUpTime: modalTime });
                              }} className="w-full bg-[var(--color-primary)] text-white text-xs sm:text-sm py-3 rounded-xl font-semibold cursor-pointer transition active:scale-95 min-h-[44px]">
                                Save Reminder Date & Time
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            )}

            {activeView === 'kanban' && (
              <div className="space-y-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 md:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">Manage Lead</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">Visualize and move your leads smoothly across different stages of conversion.</p>
                  </div>
                  <button onClick={() => { if (dayStatus !== 'ACTIVE') { toast.error('Start day first!'); return; } setActiveView('lead-form'); }} className="bg-[var(--color-primary)] text-white text-xs sm:text-sm px-5 py-3 rounded-2xl font-semibold cursor-pointer shadow-sm w-full sm:w-auto text-center active:scale-95 transition min-h-[44px]">
                    ➕ Record Visit / Add Lead
                  </button>
                </div>

                <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 space-y-3.5 min-w-[280px] sm:min-w-0 snap-start shrink-0 sm:shrink">
                    <div className="flex justify-between items-center pb-2.5 border-b border-[var(--color-border)]">
                      <span className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider">📥 New Leads</span>
                      <span className="text-xs bg-[var(--color-card)] px-3 py-1 rounded-full border border-[var(--color-border)] font-semibold">
                        {activeLeadsList.filter(l => l.leadStatus === 'Active').length}
                      </span>
                    </div>
                    <div className="space-y-3 min-h-[280px]">
                      {activeLeadsList.filter(l => l.leadStatus === 'Active').length === 0 ? (
                        <p className="text-xs sm:text-sm text-[var(--color-body)] text-center py-12">No new leads</p>
                      ) : (
                        activeLeadsList
                          .filter(l => l.leadStatus === 'Active')
                          .map(lead => (
                            <div key={lead._id} className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl space-y-2.5 text-xs sm:text-sm shadow-sm break-words transition hover:border-[var(--color-primary)]/40">
                              <strong className="text-sm sm:text-base text-[var(--color-heading)] block">{lead.instituteName}</strong>
                              <p className="text-[var(--color-body)]">👤 {lead.contactPerson} | 📞 {lead.mobileNo}</p>
                              <p className="text-[var(--color-body)]">📍 {lead.city}, {lead.state}</p>
                              <div className="pt-2.5 flex justify-between items-center border-t border-[var(--color-border)] gap-2">
                                <button onClick={() => handleWhatsAppReminder(lead, 'followup')} className="text-xs bg-[#25D366]/10 text-[#25D366] px-3.5 py-2 rounded-xl font-bold hover:bg-[#25D366]/20 cursor-pointer flex items-center gap-1.5 transition active:scale-95 min-h-[40px]">
                                  <WhatsAppIcon />
                                  WhatsApp
                                </button>
                                <button onClick={() => handleUpdateLeadStatus(lead._id, 'Call Back', null)} className="text-xs bg-amber-500/10 text-amber-600 px-3 py-2 rounded-xl font-semibold hover:bg-amber-500/20 cursor-pointer min-h-[40px]">
                                  Move ➔
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 space-y-3.5 min-w-[280px] sm:min-w-0 snap-start shrink-0 sm:shrink">
                    <div className="flex justify-between items-center pb-2.5 border-b border-[var(--color-border)]">
                      <span className="text-xs sm:text-sm font-bold text-amber-600 uppercase tracking-wider">📞 Call Back / Follow Up</span>
                      <span className="text-xs bg-[var(--color-card)] px-3 py-1 rounded-full border border-[var(--color-border)] font-semibold">
                        {activeLeadsList.filter(l => l.leadStatus === 'Call Back' || l.leadStatus === 'Follow Up').length}
                      </span>
                    </div>
                    <div className="space-y-3 min-h-[280px]">
                      {activeLeadsList.filter(l => l.leadStatus === 'Call Back' || l.leadStatus === 'Follow Up').length === 0 ? (
                        <p className="text-xs sm:text-sm text-[var(--color-body)] text-center py-12">No follow-ups</p>
                      ) : (
                        activeLeadsList
                          .filter(l => l.leadStatus === 'Call Back' || l.leadStatus === 'Follow Up')
                          .map(lead => (
                            <div key={lead._id} className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl space-y-2.5 text-xs sm:text-sm shadow-sm break-words transition hover:border-[var(--color-primary)]/40">
                              <strong className="text-sm sm:text-base text-[var(--color-heading)] block">{lead.instituteName}</strong>
                              <p className="text-[var(--color-body)]">📞 {lead.mobileNo}</p>
                              {lead.followUpDate && (
                                <p className="text-amber-600 font-semibold bg-amber-500/10 p-2 rounded-xl">
                                  📅 {new Date(lead.followUpDate).toLocaleDateString('en-IN')} {lead.followUpTime ? `@ ${lead.followUpTime}` : ''}
                                </p>
                              )}
                              <div className="pt-2.5 flex justify-between items-center border-t border-[var(--color-border)] gap-2">
                                <button onClick={() => handleWhatsAppReminder(lead, 'followup')} className="text-xs bg-[#25D366]/10 text-[#25D366] px-3.5 py-2 rounded-xl font-bold hover:bg-[#25D366]/20 cursor-pointer flex items-center gap-1.5 transition active:scale-95 min-h-[40px]">
                                  <WhatsAppIcon />
                                  WhatsApp
                                </button>
                                <button onClick={() => handleUpdateLeadStatus(lead._id, lead.leadStatus, 'Completed')} className="text-xs bg-blue-500/10 text-blue-600 px-3 py-2 rounded-xl font-semibold hover:bg-blue-500/20 cursor-pointer min-h-[40px]">
                                  Demo Done ➔
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 space-y-3.5 min-w-[280px] sm:min-w-0 snap-start shrink-0 sm:shrink">
                    <div className="flex justify-between items-center pb-2.5 border-b border-[var(--color-border)]">
                      <span className="text-xs sm:text-sm font-bold text-indigo-600 uppercase tracking-wider">💻 Demo Completed</span>
                      <span className="text-xs bg-[var(--color-card)] px-3 py-1 rounded-full border border-[var(--color-border)] font-semibold">
                        {activeLeadsList.filter(l => l.demoStatus === 'Completed').length}
                      </span>
                    </div>
                    <div className="space-y-3 min-h-[280px]">
                      {activeLeadsList.filter(l => l.demoStatus === 'Completed').length === 0 ? (
                        <p className="text-xs sm:text-sm text-[var(--color-body)] text-center py-12">No completed demos</p>
                      ) : (
                        activeLeadsList
                          .filter(l => l.demoStatus === 'Completed')
                          .map(lead => (
                            <div key={lead._id} className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl space-y-2.5 text-xs sm:text-sm shadow-sm break-words transition hover:border-[var(--color-primary)]/40">
                              <strong className="text-sm sm:text-base text-[var(--color-heading)] block">{lead.instituteName}</strong>
                              <p className="text-[var(--color-body)]">📞 {lead.mobileNo}</p>
                              <span className="inline-block bg-indigo-500/10 text-indigo-600 px-2.5 py-1 rounded-lg font-semibold text-xs">Demo Successful</span>
                              <div className="pt-2.5 flex flex-col gap-2.5 border-t border-[var(--color-border)]">
                                <button onClick={() => handleWhatsAppReminder(lead, 'followup')} className="text-xs bg-[#25D366]/10 text-[#25D366] px-3.5 py-2.5 rounded-xl font-bold hover:bg-[#25D366]/20 cursor-pointer text-center flex items-center justify-center gap-1.5 transition active:scale-95 min-h-[40px]">
                                  <WhatsAppIcon />
                                  WhatsApp Remind
                                </button>
                                <button onClick={async () => {
                                  if (dayStatus !== 'ACTIVE') {
                                    toast.error('Start day first!');
                                    return;
                                  }
                                  await handleUpdateLeadStatus(lead._id, 'Deal Close', null);
                                  setFormData((prev) => ({
                                    ...prev,
                                    instituteName: lead.instituteName,
                                    mobileNo: lead.mobileNo,
                                    email: lead.email || '',
                                    address: lead.address || '',
                                    city: lead.city,
                                    state: lead.state,
                                    pincode: lead.pincode
                                  }));
                                  setInvoiceStep(1);
                                  setActiveView('invoice-form');
                                }} className="w-full text-center text-xs bg-emerald-600 text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-700 cursor-pointer shadow-sm active:scale-95 transition min-h-[40px]">
                                  Convert to Deal (Invoice)
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-5 space-y-3.5 min-w-[280px] sm:min-w-0 snap-start shrink-0 sm:shrink sm:col-span-2 lg:col-span-1">
                    <div className="flex justify-between items-center pb-2.5 border-b border-[var(--color-border)]">
                      <span className="text-xs sm:text-sm font-bold text-emerald-600 uppercase tracking-wider">🎉 Deal Closed</span>
                      <span className="text-xs bg-[var(--color-card)] px-3 py-1 rounded-full border border-[var(--color-border)] font-semibold">
                        {myDeals.length}
                      </span>
                    </div>
                    <div className="space-y-3 min-h-[280px]">
                      {myDeals.length === 0 ? (
                        <p className="text-xs sm:text-sm text-[var(--color-body)] text-center py-12">No closed deals yet</p>
                      ) : (
                        myDeals.map(deal => (
                          <div key={deal._id} className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-2xl space-y-2.5 text-xs sm:text-sm shadow-sm break-words transition hover:border-[var(--color-primary)]/40">
                            <strong className="text-sm sm:text-base text-[var(--color-heading)] block">{deal.instituteName}</strong>
                            <p className="text-[var(--color-body)]">📱 {deal.appName}</p>
                            <p className="text-emerald-600 font-extrabold text-sm">₹{deal.totalAmount?.toLocaleString('en-IN')}</p>
                            <span className={`inline-block px-3 py-1 rounded-full font-bold text-xs ${deal.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                              Status: {deal.status.toUpperCase()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'calendar' && (
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 md:p-8 shadow-sm space-y-4">
                <div className="border-b border-[var(--color-border)] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-heading)]">📅 Upcoming Follow-ups & Meetings Schedule</h3>
                  <p className="text-xs sm:text-sm text-[var(--color-body)] mt-1">Keep track of all client callbacks and meetings scheduled for upcoming dates.</p>
                </div>

                {myLeads.filter(l => l.followUpDate && l.leadStatus !== 'Not Interested' && l.leadStatus !== 'Deal Close').length === 0 ? (
                  <div className="text-center py-16 bg-[var(--color-surface)] rounded-3xl text-xs sm:text-sm text-[var(--color-body)] space-y-3 border border-[var(--color-border)]">
                    <p>No active follow-up reminders scheduled yet.</p>
                    <button onClick={() => { if (dayStatus !== 'ACTIVE') { toast.error('Start day first!'); return; } setActiveView('lead-form'); }} className="bg-[var(--color-primary)] text-white text-xs sm:text-sm px-5 py-3 rounded-xl active:scale-95 transition">Schedule a Follow-up</button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {myLeads
                      .filter(l => l.followUpDate && l.leadStatus !== 'Not Interested' && l.leadStatus !== 'Deal Close')
                      .sort((a,b) => new Date(a.followUpDate) - new Date(b.followUpDate))
                      .map((lead) => (
                      <div key={lead._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 text-xs sm:text-sm transition hover:border-[var(--color-primary)]/40">
                        <div className="space-y-1.5 min-w-0 w-full sm:w-auto">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-[var(--color-primary)] text-white px-3 py-1 rounded-full font-bold text-[11px] uppercase tracking-wider">{lead.followUpAction || 'Call'}</span>
                            <strong className="text-sm sm:text-base text-[var(--color-heading)] font-bold break-words">{lead.instituteName}</strong>
                          </div>
                          <p className="text-[var(--color-body)] break-words">👤 Contact: {lead.contactPerson} | 📞 <a href={`tel:${lead.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{lead.mobileNo}</a></p>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--color-border)]">
                          <button
                            onClick={() => handleWhatsAppReminder(lead, 'followup')}
                            className="bg-[#25D366] hover:opacity-90 text-white px-5 py-3 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition shadow-sm flex items-center gap-2 shrink-0 active:scale-95 min-h-[44px]"
                          >
                            <WhatsAppIcon />
                            WhatsApp Remind
                          </button>
                          <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-2xl text-right sm:min-w-[190px] shrink-0">
                            <span className="text-[var(--color-body)] block text-[11px] font-medium uppercase">Scheduled For:</span>
                            <strong className="text-emerald-600 text-xs sm:text-sm font-bold">📅 {new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                            {lead.followUpTime && <span className="block text-[var(--color-heading)] font-semibold mt-0.5 text-xs">⏰ {lead.followUpTime}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeView === 'lead-form' && (
              <div>
                {status.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-2xl mb-6 text-xs sm:text-sm font-semibold">{status.success}</div>}
                {status.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl mb-6 text-xs sm:text-sm font-semibold">{status.error}</div>}

                <form onSubmit={handleLeadSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 md:p-8 space-y-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-border)] pb-4">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider">Record Visit / New Lead</h3>
                      <p className="text-xs text-[var(--color-body)] mt-0.5">Date and time are automatically recorded upon submission.</p>
                    </div>
                    <button type="button" onClick={handleAutoDetectLocation} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/25 text-xs sm:text-sm px-5 py-3 rounded-2xl font-bold transition cursor-pointer flex items-center gap-2 shrink-0 active:scale-95 min-h-[44px]">
                      📍 Locate Me
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 text-xs sm:text-sm">
                    <div>
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">Mobile Number (Auto-detects previous lead) *</label>
                      <PhoneInput
                        country={'in'}
                        value={leadFormData.mobileNo}
                        onChange={(phone) => {
                          const cleanPhone = phone.replace(/\D/g, '').slice(0, 12);
                          handleLeadChange({ target: { name: 'mobileNo', value: cleanPhone } });
                        }}
                        inputProps={{
                          name: 'mobileNo',
                          required: true,
                          autoFocus: false,
                        }}
                        containerClass="!w-full"
                        inputClass="!w-full !bg-[var(--color-surface)] !border !border-[var(--color-border)] !rounded-2xl !py-3.5 !pl-14 !pr-3 !text-xs sm:!text-sm !text-[var(--color-heading)] !h-auto focus:!outline-none focus:!border-[var(--color-primary)] !font-semibold"
                        buttonClass="!bg-[var(--color-surface)] !border !border-[var(--color-border)] !rounded-l-2xl !px-2"
                        dropdownClass="!bg-[var(--color-card)] !text-[var(--color-heading)] !border !border-[var(--color-border)] !rounded-xl !shadow-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">Institute Name *</label>
                      <input type="text" name="instituteName" required value={leadFormData.instituteName} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" placeholder="Global Public School" />
                    </div>
                    <div>
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">Contact Person Name *</label>
                      <input type="text" name="contactPerson" required value={leadFormData.contactPerson} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" placeholder="Mr. Rajesh Kumar" />
                    </div>
                    <div>
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">Email Address (Optional)</label>
                      <input type="email" name="email" value={leadFormData.email} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" placeholder="director@school.com" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">Street Address (Optional)</label>
                      <textarea name="address" rows="2" value={leadFormData.address} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" placeholder="Office No, Landmark"></textarea>
                    </div>

                    <div>
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">State *</label>
                      <select name="state" required value={leadStateCode} onChange={handleLeadStateChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] font-medium cursor-pointer">
                        <option value="">Select State</option>
                        {indianStates.map((st) => (
                          <option key={st.isoCode} value={st.isoCode}>{st.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">City / District (Type or Select) *</label>
                      <input
                        type="text"
                        name="city"
                        list="leadCityList"
                        required
                        value={leadFormData.city}
                        onChange={(e) => handleLeadCityChange(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium transition"
                        placeholder="Type or select city..."
                      />
                      <datalist id="leadCityList">
                        {citiesOfLeadState.map((ct) => (
                          <option key={ct.name} value={ct.name} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="font-medium text-[var(--color-heading)]">Pincode (Type or Search) *</label>
                        {fetchingDetails && <span className="text-xs text-[var(--color-primary)] animate-pulse">Loading location info...</span>}
                      </div>
                      <input
                        type="text"
                        name="pincode"
                        list="leadPincodeList"
                        maxLength={6}
                        required
                        value={leadFormData.pincode}
                        onChange={handleLeadChange}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium transition"
                        placeholder="Type or search pincode..."
                      />
                      <datalist id="leadPincodeList">
                        {leadAvailablePincodes.map((pin) => (
                          <option key={pin} value={pin} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block font-medium mb-2 text-[var(--color-primary-dark)]">📸 Upload Meeting Photo </label>
                      <input 
                        type="file" 
                        accept="*" 
                        required 
                        onChange={handleMeetingPhotoChange} 
                        className="block w-full text-xs sm:text-sm text-[var(--color-body)] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white cursor-pointer" 
                      />
                      {meetingPhotoPreview && (
                        <div className="mt-3">
                          <img src={meetingPhotoPreview} alt="Preview" className="h-24 w-24 object-cover rounded-2xl border border-[var(--color-border)] shadow-sm" />
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 p-4 sm:p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3.5">
                      <h4 className="text-xs sm:text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider">📅 Schedule Next Follow-up / Meeting</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div>
                          <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Follow-up Action</label>
                          <select name="followUpAction" value={leadFormData.followUpAction} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm font-medium cursor-pointer">
                            <option value="Call">Call Back</option>
                            <option value="Next Meeting">Meeting Reschedule</option>
                            <option value="Demo">Demo</option>
                            <option value="Closed">Deal Closed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Follow-up Date</label>
                          <input type="date" name="followUpDate" value={leadFormData.followUpDate} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm cursor-pointer" />
                        </div>
                        <div>
                          <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Follow-up Time</label>
                          <input type="time" name="followUpTime" value={leadFormData.followUpTime} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm cursor-pointer" />
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-medium mb-2 text-[var(--color-heading)]">Visit / Discussion Notes</label>
                      <textarea name="notes" rows="3" value={leadFormData.notes} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" placeholder="Summary of this visit..."></textarea>
                    </div>
                  </div>

                  <button type="submit" disabled={status.loading} className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-4 rounded-2xl transition cursor-pointer disabled:opacity-50 shadow-sm text-xs sm:text-sm active:scale-95 min-h-[48px]">
                    {status.loading ? 'Detecting Secure GPS & Saving Visit...' : 'Save Lead Visit & Follow-up'}
                  </button>
                </form>
              </div>
            )}

            {activeView === 'invoice-form' && (
              <div>
                {status.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-2xl mb-6 text-xs sm:text-sm font-semibold">{status.success}</div>}
                {status.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl mb-6 text-xs sm:text-sm font-semibold">{status.error}</div>}

                <form onSubmit={handleSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 md:p-8 space-y-6 shadow-sm">
                  
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider">Step {invoiceStep} of 3</h3>
                      <p className="text-xs sm:text-sm text-[var(--color-body)] mt-0.5">
                        {invoiceStep === 1 && 'Client Information & Ledger Lookup'}
                        {invoiceStep === 2 && 'Package Pricing, Add-ons & Coupons'}
                        {invoiceStep === 3 && 'Payment Mode & Proof Submission'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(step => (
                        <span key={step} className={`w-10 h-2.5 rounded-full transition-colors ${invoiceStep >= step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
                      ))}
                    </div>
                  </div>

                  {invoiceStep === 1 && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs sm:text-sm font-bold text-[var(--color-heading)] uppercase">1. Client Details & Installment Ledger Lookup</h4>
                        <button type="button" onClick={handleInvoiceAutoDetectLocation} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/25 text-xs sm:text-sm px-5 py-2.5 rounded-2xl font-bold transition cursor-pointer flex items-center gap-2 min-h-[44px]">
                          📍 Locate Me
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 text-xs sm:text-sm">
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Institute Name (Type or select) *</label>
                          <input 
                            type="text" 
                            name="instituteName" 
                            list="existingInstitutes"
                            required 
                            value={formData.instituteName} 
                            onChange={handleChange} 
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-semibold transition" 
                            placeholder="Type institute name..." 
                          />
                          <datalist id="existingInstitutes">
                            {myDeals.map((deal) => (
                              <option key={deal._id} value={deal.instituteName}>
                                {deal.instituteName} (Pending Due: ₹{deal.dueAmount})
                              </option>
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">App Name *</label>
                          <input type="text" name="appName" required value={formData.appName} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" />
                        </div>

                        {/* 🌟 Multi-Select Categories Section (Compulsory) */}
                        <div className="md:col-span-2 p-4 sm:p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="block font-bold text-[var(--color-heading)] uppercase text-xs sm:text-sm">
                              Categories (Select one or multiple) <span className="text-red-500">*</span>
                            </label>
                            <span className="text-xs text-[var(--color-primary)] font-medium">
                              {formData.categories.length} Selected
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl scrollbar-thin">
                            {CATEGORY_OPTIONS.map((cat) => {
                              const isChecked = formData.categories.includes(cat);
                              return (
                                <label 
                                  key={cat} 
                                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                                    isChecked 
                                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-heading)] font-semibold' 
                                      : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-body)] hover:border-[var(--color-primary)]/40'
                                  }`}
                                >
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setFormData(prev => {
                                        const current = prev.categories || [];
                                        if (checked) {
                                          return { ...prev, categories: [...current, cat] };
                                        } else {
                                          return { ...prev, categories: current.filter(item => item !== cat) };
                                        }
                                      });
                                    }}
                                    className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer" 
                                  />
                                  <span className="truncate">{cat}</span>
                                </label>
                              );
                            })}
                          </div>
                          {formData.categories.length === 0 && (
                            <p className="text-[11px] text-amber-600 font-medium">⚠️ Please select at least one category.</p>
                          )}
                        </div>

                        {/* 🌟 Optional Logo Upload */}
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Logo (.jpg, .png - Optional)</label>
                          <input 
                            type="file" 
                            accept="image/jpeg, image/jpg, image/png" 
                            onChange={handleLogoFileChange} 
                            className="block w-full text-xs sm:text-sm text-[var(--color-body)] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface)] file:text-[var(--color-heading)] file:border file:border-[var(--color-border)] cursor-pointer" 
                          />
                        </div>

                        {/* 🌟 Optional Social Media Links */}
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">YouTube Link (Optional)</label>
                          <input 
                            type="url" 
                            name="youtubeLink" 
                            value={formData.youtubeLink} 
                            onChange={handleChange} 
                            placeholder="https://youtube.com/@channel" 
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" 
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Instagram Link (Optional)</label>
                          <input 
                            type="url" 
                            name="instagramLink" 
                            value={formData.instagramLink} 
                            onChange={handleChange} 
                            placeholder="https://instagram.com/profile" 
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] transition" 
                          />
                        </div>

                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Mobile Number *</label>
                          <PhoneInput
                            country={'in'}
                            value={formData.mobileNo}
                            onChange={(phone) => {
                              const cleanPhone = phone.replace(/\D/g, '').slice(0, 12);
                              handleChange({ target: { name: 'mobileNo', value: cleanPhone } });
                            }}
                            inputProps={{ name: 'mobileNo', required: true }}
                            containerClass="!w-full"
                            inputClass="!w-full !bg-[var(--color-surface)] !border !border-[var(--color-border)] !rounded-2xl !py-3.5 !pl-14 !pr-3 !text-xs sm:!text-sm !text-[var(--color-heading)] !h-auto"
                            buttonClass="!bg-[var(--color-surface)] !border !border-[var(--color-border)] !rounded-l-2xl !px-2"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Client Email *</label>
                          <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)]" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Street Address *</label>
                          <textarea name="address" rows="2" required value={formData.address} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)]"></textarea>
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">State *</label>
                          <select name="state" required value={selectedStateCode} onChange={handleInvoiceStateChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 font-medium cursor-pointer">
                            <option value="">Select State</option>
                            {indianStates.map((st) => <option key={st.isoCode} value={st.isoCode}>{st.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">City (Type or Select) *</label>
                          <input
                            type="text"
                            name="city"
                            list="invoiceCityList"
                            required
                            value={formData.city}
                            onChange={(e) => handleInvoiceCityChange(e.target.value)}
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)] font-medium"
                            placeholder="Type city..."
                          />
                          <datalist id="invoiceCityList">
                            {citiesOfSelectedState.map((ct) => (<option key={ct.name} value={ct.name} />))}
                          </datalist>
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Pincode *</label>
                          <input type="text" name="pincode" list="invoicePincodeList" maxLength={6} required value={formData.pincode} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-[var(--color-heading)]" placeholder="Pincode..." />
                          <datalist id="invoicePincodeList">{availablePincodes.map((pin) => (<option key={pin} value={pin} />))}</datalist>
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">GST Number</label>
                          <input type="text" name="gstNo" value={formData.gstNo} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5" placeholder="Optional" />
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <button 
                          type="button" 
                          onClick={() => {
                            if (!formData.categories || formData.categories.length === 0) {
                              toast.error('Please select at least one category before proceeding.');
                              return;
                            }
                            setInvoiceStep(2);
                          }} 
                          className="bg-[var(--color-primary)] text-white px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer shadow-sm active:scale-95 transition min-h-[46px]"
                        >
                          Next: Financials & Add-ons ➔
                        </button>
                      </div>
                    </div>
                  )}

                  {invoiceStep === 2 && (
                    <div className="space-y-4 sm:space-y-5">
                      <h4 className="text-xs sm:text-sm font-bold text-[var(--color-heading)] uppercase">2. Installment, Due Payment Ledger & Add-ons</h4>

                      {formData.previousDueBalance > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-4 sm:p-5 rounded-2xl flex justify-between items-center text-xs sm:text-sm gap-3">
                          <div>
                            <strong className="text-amber-600 block font-bold">⚠️ Outstanding Due Balance Carried Forward:</strong>
                            <span className="text-[var(--color-body)]">This institute has a pending due balance.</span>
                          </div>
                          <span className="text-amber-600 font-extrabold text-base shrink-0">₹{formData.previousDueBalance.toLocaleString('en-IN')}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 text-xs sm:text-sm">
                        <div>
                          <label className="block font-medium mb-2 text-[var(--color-heading)]">Base Package Price (₹)</label>
                          <input type="number" name="baseAmount" value={formData.baseAmount} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5" />
                        </div>
                        <div>
                          <label className="block font-medium mb-2 text-emerald-600 font-bold">Installment Paid Now (₹) *</label>
                          <input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-emerald-500/50 rounded-2xl p-3.5 font-bold text-emerald-600" />
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3.5">
                        <label className="block text-xs sm:text-sm font-semibold text-[var(--color-primary)] uppercase">🎁 Select Add-on Packages</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs sm:text-sm text-[var(--color-heading)]">
                          <label className="flex items-center gap-3 cursor-pointer bg-[var(--color-card)] p-3.5 rounded-xl border border-[var(--color-border)]">
                            <input type="checkbox" name="testModule" checked={addons.testModule} onChange={handleAddonChange} className="w-5 h-5 accent-[var(--color-primary)] rounded" />
                            <span>Test Series Module (+₹5,000)</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer bg-[var(--color-card)] p-3.5 rounded-xl border border-[var(--color-border)]">
                            <input type="checkbox" name="windowApp" checked={addons.windowApp} onChange={handleAddonChange} className="w-5 h-5 accent-[var(--color-primary)] rounded" />
                            <span>Windows App (+₹5,000)</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer bg-[var(--color-card)] p-3.5 rounded-xl border border-[var(--color-border)]">
                            <input type="checkbox" name="iosApp" checked={addons.iosApp} onChange={handleAddonChange} className="w-5 h-5 accent-[var(--color-primary)] rounded" />
                            <span>iOS Mobile App (+₹45,000)</span>
                          </label>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
                        <label className="block text-xs sm:text-sm font-semibold text-[var(--color-primary)] uppercase">🏷️ Apply Coupon Code</label>
                        <div className="flex gap-2.5">
                          <input type="text" value={couponInput} disabled={isCouponApplied} onChange={(e) => setCouponInput(e.target.value)} placeholder="FLAT50" className="uppercase flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-xs sm:text-sm font-mono" />
                          {!isCouponApplied ? (
                            <button type="button" onClick={handleApplyCoupon} className="bg-[var(--color-primary)] text-white text-xs sm:text-sm px-6 py-3 rounded-xl font-semibold min-h-[44px]">Apply</button>
                          ) : (
                            <button type="button" onClick={handleRemoveCoupon} className="bg-red-500/15 text-red-600 border border-red-500/20 text-xs sm:text-sm px-6 py-3 rounded-xl font-semibold min-h-[44px]">Remove</button>
                          )}
                        </div>
                        {couponError && <p className="text-xs sm:text-sm text-red-500">{couponError}</p>}
                        {isCouponApplied && <p className="text-xs sm:text-sm text-emerald-600 font-medium">🎉 Coupon applied!</p>}
                      </div>

                      <div className="flex justify-between pt-4">
                        <button type="button" onClick={() => setInvoiceStep(1)} className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[46px]">
                          ← Back
                        </button>
                        <button type="button" onClick={() => setInvoiceStep(3)} className="bg-[var(--color-primary)] text-white px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer shadow-sm active:scale-95 transition min-h-[46px]">
                          Next: Payment Mode ➔
                        </button>
                      </div>
                    </div>
                  )}

                  {invoiceStep === 3 && (
                    <div className="space-y-4 sm:space-y-5">
                      <h4 className="text-xs sm:text-sm font-bold text-[var(--color-heading)] uppercase">3. Payment Mode & Proof Submission</h4>

                      <div className="p-4 sm:p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3.5">
                        <label className="block text-xs sm:text-sm font-semibold text-[var(--color-primary)] uppercase">💳 Select Payment Mode *</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
                          {['ONLINE', 'NEFT', 'CASH', 'CHEQUE'].map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setFormData({ ...formData, paymentMode: mode })}
                              className={`p-3.5 rounded-xl font-bold border transition cursor-pointer text-center min-h-[46px] ${formData.paymentMode === mode ? 'bg-[var(--color-primary)] text-white border-transparent shadow-sm' : 'bg-[var(--color-card)] text-[var(--color-heading)] border-[var(--color-border)]'}`}
                            >
                              {mode === 'ONLINE' ? '📱 Online / UPI' : mode === 'NEFT' ? '🌐 NEFT / Txn' : mode === 'CASH' ? '💵 Cash' : '🏦 Cheque'}
                            </button>
                          ))}
                        </div>

                        {(formData.paymentMode === 'ONLINE' || formData.paymentMode === 'NEFT') && (
                          <input 
                            type="text" 
                            name="utrNumber" 
                            maxLength={16} 
                            required 
                            value={formData.utrNumber} 
                            onChange={handleChange} 
                            placeholder={formData.paymentMode === 'NEFT' ? "Enter NEFT / Bank Reference Number..." : "Enter 12-digit UTR ID..."} 
                            className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3.5 font-mono text-xs sm:text-sm mt-3" 
                          />
                        )}
                        {formData.paymentMode === 'CASH' && (
                          <input type="text" name="receiptNo" required value={formData.receiptNo} onChange={handleChange} placeholder="Cash Receipt / Voucher Number..." className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm mt-3" />
                        )}
                        {formData.paymentMode === 'CHEQUE' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3">
                            <input type="text" name="chequeNo" maxLength={6} required value={formData.chequeNo} onChange={handleChange} placeholder="Cheque No (6 digits)" className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3.5 font-mono text-xs sm:text-sm" />
                            <input type="text" name="bankName" required value={formData.bankName} onChange={handleChange} placeholder="Bank Name & Branch" className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3.5 text-xs sm:text-sm" />
                          </div>
                        )}
                      </div>

                      <div className="p-4 sm:p-5 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] space-y-2.5 text-xs sm:text-sm">
                        <div className="flex justify-between"><span>Grand Total (Bill + Past Dues):</span><strong>₹{formData.totalAmount.toLocaleString('en-IN')}</strong></div>
                        <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
                          <span>Rest Due Balance After Payment:</span>
                          <strong className={dueAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}>₹{dueAmount.toLocaleString('en-IN')} {dueAmount === 0 ? '🎉 (Zero Due)' : ''}</strong>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 bg-[var(--color-surface)] border border-dashed border-[var(--color-primary)]/40 rounded-2xl space-y-2.5">
                        <label className="block text-xs sm:text-sm font-semibold text-[var(--color-primary)]">📸 Upload Payment Screenshot / Receipt Proof (.jpg, .png) *</label>
                        <input type="file" accept="*" required onChange={handleFileChange} className="block w-full text-xs sm:text-sm text-[var(--color-body)] cursor-pointer" />
                      </div>

                      <div className="flex justify-between pt-4">
                        <button type="button" onClick={() => setInvoiceStep(2)} className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[46px]">
                          ← Back
                        </button>
                        <button type="submit" disabled={status.loading} className="bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold px-8 py-3.5 rounded-2xl transition cursor-pointer disabled:opacity-50 shadow-sm text-xs sm:text-sm active:scale-95 min-h-[46px]">
                          {status.loading ? 'Submitting & Updating Ledger...' : 'Submit Installment Payment 🚀'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
};

export default SalespersonForm;