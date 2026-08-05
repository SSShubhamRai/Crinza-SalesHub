/**
 * =========================================================================
 * 👤 SALESPERSON PORTAL COMPONENT (`SalespersonForm.jsx`)
 * =========================================================================
 * Description: Allows salesperson to manage performance, track deals, create/update 
 * leads with live GPS coordinates, schedule follow-ups, submit invoices with 
 * database-verified coupon discounts, 18% GST calculation, add-on packages, 
 * multi-visit tracking, and true partial installment due ledger system.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { State, City } from 'country-state-city';
import { io } from 'socket.io-client'; // 🌟 Socket.io client for real-time live tracking
import { submitInvoiceRequest } from '../api/api';

const SalespersonForm = ({ userId, onLogout }) => {
  // --- Navigation & View States ---
  const [activeView, setActiveView] = useState('dashboard');

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
  const [followUpModalAction, setFollowUpModalAction] = useState(null);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');

  // --- 🌟 Settlement Success Popup State ---
  const [settledAlert, setSettledAlert] = useState(null);

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

  // --- 🌟 CONTINUOUS SOCKET.IO LIVE LOCATION TRACKING WITH BACKGROUND INTERVAL ---
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    socketRef.current = io(API_BASE, {
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Connected to Live Tracking Server');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    let watchId = null;
    let intervalId = null;

    if (navigator.geolocation && userId) {
      // 1. Continuous WatchPosition for instant movement tracking
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          socketRef.current?.emit('update_location', {
            salespersonId: userId,
            latitude,
            longitude
          });
        },
        (err) => console.error('Live tracking geolocation error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );

      // 2. Fallback / Active Background Interval (Har 30 seconds mein ensure karne ke liye ki pings ja rahe hain)
      intervalId = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            socketRef.current?.emit('update_location', {
              salespersonId: userId,
              latitude,
              longitude
            });
          },
          (err) => console.error('Background interval GPS error:', err),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }, 30000);
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId, API_BASE]);

  // --- Initial Form States ---
  const initialFormData = {
    instituteName: '',
    appName: '',
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

  // --- Component Form & UI Hooks ---
  const [formData, setFormData] = useState(initialFormData);
  const [leadFormData, setLeadFormData] = useState(initialLeadFormData);
  
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [leadStateCode, setLeadStateCode] = useState('');
  
  const [addons, setAddons] = useState(initialAddons);
  const [file, setFile] = useState(null);
  const [meetingPhotoFile, setMeetingPhotoFile] = useState(null);
  const [status, setStatus] = useState({ loading: false, success: '', error: '' });
  
  // --- Coupon Verification States ---
  const [couponInput, setCouponInput] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponDetails, setCouponDetails] = useState(null);

  // --- Postal / Pincode Lookup States ---
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [availablePincodes, setAvailablePincodes] = useState([]);
  const [leadAvailablePincodes, setLeadAvailablePincodes] = useState([]);

  // --- Fetch Logged-in Salesperson's Deals History ---
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

  // --- Fetch Logged-in Salesperson's Generated Leads ---
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

  // --- Initial Data Load on Component Mount ---
  useEffect(() => {
    fetchMyDeals();
    fetchMyLeads();
  }, [fetchMyDeals, fetchMyLeads]);

  // --- Location Utility Constants ---
  const indianStates = State.getStatesOfCountry('IN');
  const citiesOfSelectedState = selectedStateCode ? City.getCitiesOfState('IN', selectedStateCode) : [];
  const citiesOfLeadState = leadStateCode ? City.getCitiesOfState('IN', leadStateCode) : [];

  // --- Dynamic Subtotal, 18% GST, Grand Total, & Due Balance Calculation ---
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
    
    // Grand Total = Current Package Calculation + Past Unpaid Due Balance
    const calculatedTotal = discountedSubtotal + gst + (formData.previousDueBalance || 0);

    setFormData((prev) => ({
      ...prev,
      subtotalAmount: discountedSubtotal,
      gstAmount: Math.round(gst * 100) / 100,
      totalAmount: Math.round(calculatedTotal * 100) / 100,
      discountAmount: discount
    }));
  }, [addons, formData.baseAmount, formData.previousDueBalance, isCouponApplied, couponDetails]);

  // --- Auto-calculated Remaining Due Amount After This Payment ---
  const dueAmount = Math.max(0, formData.totalAmount - formData.paidAmount);

  // --- Performance Dashboard Metrics Calculations ---
  const totalDealsCount = myDeals.length;
  const activeLeadsList = myLeads.filter(lead => lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close');
  const totalLeadsCount = activeLeadsList.length;
  const approvedDealsCount = myDeals.filter(d => d.status === 'approved').length;
  const pendingDealsCount = myDeals.filter(d => d.status === 'pending').length;
  const totalPaidCollected = myDeals.reduce((sum, d) => sum + (d.paidAmount || 0), 0);

  // --- 🔍 Filter & Search Leads (Updated & Robust) ---
  const filteredLeads = activeLeadsList.filter(lead => {
    const query = leadSearchQuery.toLowerCase().trim();
    
    const matchesSearch = query === '' || 
      lead.instituteName?.toLowerCase().includes(query) ||
      lead.contactPerson?.toLowerCase().includes(query) ||
      lead.mobileNo?.includes(query) ||
      lead.city?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (leadFilter === 'all') return true;
    
    if (leadFilter === 'call') {
      return (
        lead.followUpAction?.toLowerCase() === 'call' || 
        lead.followUpAction?.toLowerCase() === 'call back' || 
        lead.leadStatus?.toLowerCase() === 'call back'
      );
    }
    
    if (leadFilter === 'meeting') {
      return (
        lead.followUpAction?.toLowerCase() === 'next meeting' || 
        lead.followUpAction?.toLowerCase() === 'meeting'
      );
    }
    
    if (leadFilter === 'demo-done') {
      return lead.demoStatus?.toLowerCase() === 'completed';
    }
    
    if (leadFilter === 'demo-pending') {
      return (
        !lead.demoStatus || 
        lead.demoStatus?.toLowerCase() === 'not given' || 
        lead.demoStatus?.toLowerCase() === 'scheduled'
      );
    }

    return true;
  });

  // --- Verify & Apply Discount Coupon via Database API ---
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

  // --- Remove Applied Coupon ---
  const handleRemoveCoupon = () => {
    setIsCouponApplied(false);
    setCouponInput('');
    setCouponError('');
    setCouponDetails(null);
    setFormData((prev) => ({ ...prev, couponCode: '', discountAmount: 0 }));
  };

  // --- Auto-fetch State & City from Pincode for Invoice Form ---
  const fetchByPincode = async (pincodeValue) => {
    if (pincodeValue.length === 6 && /^\d+$/.test(pincodeValue)) {
      setFetchingDetails(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincodeValue}`);
        const data = await response.json();
        if (data[0] && data[0].Status === 'Success') {
          const details = data[0].PostOffice[0];
          const matchedState = indianStates.find((s) => s.name.toLowerCase() === details.State.toLowerCase());
          
          if (matchedState) setSelectedStateCode(matchedState.isoCode);
          
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

  // --- Auto-fetch State & City from Pincode for Lead Form ---
  const fetchLeadByPincode = async (pincodeValue) => {
    if (pincodeValue.length === 6 && /^\d+$/.test(pincodeValue)) {
      setFetchingDetails(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincodeValue}`);
        const data = await response.json();
        if (data[0] && data[0].Status === 'Success') {
          const details = data[0].PostOffice[0];
          const matchedState = indianStates.find((s) => s.name.toLowerCase() === details.State.toLowerCase());
          
          if (matchedState) setLeadStateCode(matchedState.isoCode);

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

  const handleLeadCityChange = async (e) => {
    const cityName = e.target.value;
    setLeadFormData((prev) => ({ ...prev, city: cityName, pincode: '' }));
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

  const handleInvoiceCityChange = async (e) => {
    const cName = e.target.value;
    setFormData(prev => ({ ...prev, city: cName, pincode: '' }));
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

  // --- 🌟 SMART AUTO-FILL & INSTALLMENT DUE BALANCE LOOKUP ---
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

    setActiveView('invoice-form');
  };

  const handleAddonChange = (e) => {
    const { name, checked } = e.target;
    setAddons((prev) => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleMeetingPhotoChange = (e) => setMeetingPhotoFile(e.target.files[0]);

  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setStatus({ loading: true, success: '', error: '' });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
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

            setStatus({ loading: false, success: 'Location auto-detected and address filled successfully!', error: '' });
          }
        } catch (err) {
          setStatus({ loading: false, success: '', error: 'Failed to fetch address from coordinates.' });
        }
      },
      () => setStatus({ loading: false, success: '', error: 'GPS permission denied or failed.' }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleInvoiceAutoDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setStatus({ loading: true, success: '', error: '' });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
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

            setStatus({ loading: false, success: 'Location auto-detected and invoice address filled!', error: '' });
          }
        } catch (err) {
          setStatus({ loading: false, success: '', error: 'Failed to fetch invoice address.' });
        }
      },
      () => setStatus({ loading: false, success: '', error: 'GPS permission denied or failed.' }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleUpdateLeadStatus = async (leadId, newLeadStatus, newDemoStatus, followUpDateVal = null, followUpTimeVal = null) => {
    try {
      const token = localStorage.getItem('token');
      const payload = { 
        leadStatus: newLeadStatus || selectedLead.leadStatus, 
        demoStatus: newDemoStatus || selectedLead.demoStatus 
      };

      if (newDemoStatus === 'Completed') {
        const timestampStr = `[Demo Completed on: ${new Date().toLocaleString('en-IN')}]`;
        payload.notes = selectedLead.notes ? `${selectedLead.notes}\n${timestampStr}` : timestampStr;
      }

      if (followUpDateVal) {
        payload.followUpDate = followUpDateVal;
        payload.followUpTime = followUpTimeVal || '';
        payload.followUpAction = newLeadStatus;
      }

      const res = await fetch(`${API_BASE}/api/salesperson/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Lead status updated successfully!');
        fetchMyLeads();
        setSelectedLead(null);
        setFollowUpModalAction(null);
        setModalDate('');
        setModalTime('');
      } else {
        alert(data.message || 'Failed to update');
      }
    } catch (err) {
      console.error('Error updating lead:', err);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!meetingPhotoFile) {
      setStatus({ loading: false, success: '', error: 'Please upload the meeting photo!' });
      return;
    }

    setStatus({ loading: true, success: 'Saving lead visit & follow-up...', error: '' });

    const processLeadSubmission = async (lat = null, lng = null) => {
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
      if (lat && lng) {
        data.append('latitude', lat);
        data.append('longitude', lng);
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
        fetchMyLeads();

        setTimeout(() => {
          setActiveView('leads');
          setStatus({ loading: false, success: '', error: '' });
        }, 1500);
      } catch (err) {
        setStatus({ loading: false, success: '', error: err.message });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => processLeadSubmission(position.coords.latitude, position.coords.longitude),
        () => processLeadSubmission(null, null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      processLeadSubmission(null, null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatus({ loading: false, success: '', error: 'Please upload payment proof!' });
      return;
    }

    setStatus({ loading: true, success: 'Fetching live GPS verification & submitting installment...', error: '' });

    const processSubmission = async (lat = null, lng = null) => {
      const data = new FormData();
      Object.keys(formData).forEach((key) => data.append(key, formData[key]));
      data.append('dueAmount', dueAmount);
      data.append('paymentProof', file);
      data.append('addons', JSON.stringify(addons));

      if (lat && lng) {
        data.append('latitude', lat);
        data.append('longitude', lng);
      }

      try {
        const resData = await submitInvoiceRequest(data);
        
        if (dueAmount === 0) {
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
        setIsCouponApplied(false);
        setCouponInput('');
        setCouponDetails(null);
        fetchMyDeals();

        setTimeout(() => {
          if (dueAmount > 0) {
            setActiveView('dashboard');
          }
          setStatus({ loading: false, success: '', error: '' });
        }, 2500);
      } catch (err) {
        setStatus({ loading: false, success: '', error: err.response?.data?.message || 'Submission failed' });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => processSubmission(position.coords.latitude, position.coords.longitude),
        () => processSubmission(null, null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      processSubmission(null, null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {settledAlert && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-card)] border border-emerald-500/50 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-4 shadow-2xl text-center">
              <span className="text-4xl">🎉</span>
              <h3 className="text-lg font-extrabold text-emerald-600">Deal Fully Settled & Cleared!</h3>
              <p className="text-xs text-[var(--color-heading)]">
                All outstanding dues for <strong>{settledAlert.institute}</strong> have been paid in full. Balance is now <strong>₹0 (Zero Due)</strong>. Both salesperson and account team have been notified successfully.
              </p>
              <button
                onClick={() => { setSettledAlert(null); setActiveView('dashboard'); }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
              >
                Okay, Return to Dashboard
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SALESPERSON PORTAL WITH INSTALLMENT LEDGER
            </span>
            <h1 className="text-2xl font-extrabold text-[var(--color-heading)] tracking-tight mt-1">
              {activeView === 'dashboard' && 'My Dashboard & Performance'}
              {activeView === 'leads' && 'My Generated Leads'}
              {activeView === 'calendar' && '📅 Follow-up & Meeting Calendar'}
              {activeView === 'lead-form' && 'Create New Lead / Record Client Visit'}
              {activeView === 'invoice-form' && 'Create Invoice Request & Installment Ledger'}
            </h1>
            <p className="text-[var(--color-body)] text-xs">Signed in as <strong className="text-[var(--color-primary)]">{userId}</strong></p>
          </div>

          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition cursor-pointer flex items-center gap-2"
          >
            Logout
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-sm">
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeView === 'dashboard' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-heading)] hover:bg-[var(--color-surface)]'
              }`}
            >
              📊 Dashboard & Dues
            </button>
            <button
              onClick={() => setActiveView('leads')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeView === 'leads' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-heading)] hover:bg-[var(--color-surface)]'
              }`}
            >
              📋 My Leads ({totalLeadsCount})
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeView === 'calendar' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-heading)] hover:bg-[var(--color-surface)]'
              }`}
            >
              📅 Calendar
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setActiveView('lead-form')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeView === 'lead-form' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/50'
              }`}
            >
              ➕ Record Visit / New Lead
            </button>
            <button
              onClick={() => setActiveView('invoice-form')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeView === 'invoice-form' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/50'
              }`}
            >
              🧾 New Invoice / Installment
            </button>
          </div>
        </div>

        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div onClick={() => setActiveView('lead-form')} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-6 rounded-3xl shadow-sm cursor-pointer transition flex items-center justify-between group">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">➕ Create / Visit Lead</h3>
                  <p className="text-xs text-[var(--color-body)] mt-1">Record client visit & meeting photo.</p>
                </div>
                <span className="text-2xl p-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">🎯</span>
              </div>
              <div onClick={() => setActiveView('calendar')} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-6 rounded-3xl shadow-sm cursor-pointer transition flex items-center justify-between group">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">📅 View Calendar</h3>
                  <p className="text-xs text-[var(--color-body)] mt-1">Check upcoming calls & meetings.</p>
                </div>
                <span className="text-2xl p-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">🗓️</span>
              </div>
              <div onClick={() => setActiveView('invoice-form')} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-6 rounded-3xl shadow-sm cursor-pointer transition flex items-center justify-between group">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">🧾 Submit Installment</h3>
                  <p className="text-xs text-[var(--color-body)] mt-1">Pay due amount & clear balance.</p>
                </div>
                <span className="text-2xl p-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">💳</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm space-y-1">
                <span className="text-xs text-[var(--color-body)] block font-medium">Total Deals</span>
                <strong className="text-2xl font-extrabold text-[var(--color-primary)]">{totalDealsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm space-y-1">
                <span className="text-xs text-[var(--color-body)] block font-medium">Active Leads</span>
                <strong className="text-2xl font-extrabold text-blue-600">{totalLeadsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm space-y-1">
                <span className="text-xs text-[var(--color-body)] block font-medium">Approved Invoices</span>
                <strong className="text-2xl font-extrabold text-emerald-600">{approvedDealsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm space-y-1">
                <span className="text-xs text-[var(--color-body)] block font-medium">Pending Invoices</span>
                <strong className="text-2xl font-extrabold text-amber-600">{pendingDealsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-5 shadow-sm sm:col-span-2 md:col-span-1 space-y-1">
                <span className="text-xs text-[var(--color-body)] block font-medium">Collected</span>
                <strong className="text-2xl font-extrabold text-emerald-600">₹{totalPaidCollected.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-heading)]">📊 Institute Due Ledger (Installment Tracker)</h3>
                  <p className="text-xs text-[var(--color-body)] mt-0.5">See exact pending dues per institute. Click "Pay Due" to instantly jump to invoice page with pre-filled balance.</p>
                </div>
                <span className="text-xs bg-[var(--color-surface)] px-3 py-1.5 rounded-xl border border-[var(--color-border)] font-semibold">
                  {myDeals.length} Deal(s)
                </span>
              </div>

              {loadingDeals ? (
                <div className="text-center py-12 text-xs text-[var(--color-body)]">Loading institute dues...</div>
              ) : myDeals.length === 0 ? (
                <div className="text-center py-16 bg-[var(--color-surface)] rounded-3xl text-xs text-[var(--color-body)] space-y-3 border border-[var(--color-border)]">
                  <p>No institute deals found yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myDeals.map((deal) => (
                    <div key={deal._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-[var(--color-heading)] font-bold">{deal.instituteName}</strong>
                          <span className="text-[var(--color-body)]">({deal.appName})</span>
                        </div>
                        <p>👤 Contact: <a href={`tel:${deal.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{deal.mobileNo}</a> | 📍 {deal.city || 'N/A'}, {deal.state || ''}</p>
                        <div className="flex flex-wrap gap-4 pt-1 font-medium text-[var(--color-body)]">
                          <span>Total Bill: <strong>₹{deal.totalAmount?.toLocaleString('en-IN')}</strong></span>
                          <span>Paid So Far: <strong className="text-emerald-600">₹{deal.paidAmount?.toLocaleString('en-IN')}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[var(--color-border)]">
                        <div className="text-left md:text-right">
                          <span className="text-[10px] uppercase font-bold text-[var(--color-body)] block">Due Amount</span>
                          <span className={`text-base font-extrabold ${deal.dueAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            ₹{deal.dueAmount?.toLocaleString('en-IN')} {deal.dueAmount === 0 ? '✨ (Cleared)' : ''}
                          </span>
                        </div>

                        {deal.dueAmount > 0 ? (
                          <button
                            onClick={() => handlePayDueFromLedger(deal)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold cursor-pointer transition shadow-sm"
                          >
                            Pay Due / Installment ➔
                          </button>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-4 py-2 rounded-xl font-bold">
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
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-4 gap-3">
              <h3 className="text-base font-bold text-[var(--color-heading)]">📋 My Generated Leads & Visit Records</h3>
              <button onClick={() => setActiveView('lead-form')} className="bg-[var(--color-primary)] text-white text-xs px-5 py-2.5 rounded-2xl font-semibold cursor-pointer shadow-sm">
                ➕ Record Visit / Add Lead
              </button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--color-body)]">🔍</span>
                <input
                  type="text"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  placeholder="Search by institute name, contact person, mobile number, or city..."
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl py-3 pl-10 pr-4 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium"
                />
                {leadSearchQuery && (
                  <button onClick={() => setLeadSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs text-[var(--color-body)] hover:text-[var(--color-heading)]">
                    ✕ Clear
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap pt-1">
                <button onClick={() => setLeadFilter('all')} className={`text-xs px-4 py-2 rounded-xl font-medium border cursor-pointer transition ${leadFilter === 'all' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                  All Active ({activeLeadsList.length})
                </button>
                <button onClick={() => setLeadFilter('call')} className={`text-xs px-4 py-2 rounded-xl font-medium border cursor-pointer transition ${leadFilter === 'call' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                  📞 To Call / Call Back
                </button>
                <button onClick={() => setLeadFilter('meeting')} className={`text-xs px-4 py-2 rounded-xl font-medium border cursor-pointer transition ${leadFilter === 'meeting' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                  🤝 Meetings
                </button>
                <button onClick={() => setLeadFilter('demo-done')} className={`text-xs px-4 py-2 rounded-xl font-medium border cursor-pointer transition ${leadFilter === 'demo-done' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                  ✅ Demo Done
                </button>
                <button onClick={() => setLeadFilter('demo-pending')} className={`text-xs px-4 py-2 rounded-xl font-medium border cursor-pointer transition ${leadFilter === 'demo-pending' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
                  ⏳ Demo Pending
                </button>
              </div>
            </div>

            {loadingLeads ? (
              <div className="text-center py-12 text-xs text-[var(--color-body)]">Loading your leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-16 bg-[var(--color-surface)] rounded-3xl text-xs text-[var(--color-body)] space-y-3 border border-[var(--color-border)]">
                <p>No leads found matching your search or filter.</p>
                <button onClick={() => { setLeadFilter('all'); setLeadSearchQuery(''); }} className="bg-[var(--color-primary)] text-white text-xs px-4 py-2 rounded-xl">Reset Search & Filters</button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLeads.map((lead) => (
                  <div key={lead._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 p-5 rounded-2xl space-y-2.5 text-xs transition shadow-sm">
                    <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                      <div className="flex items-center gap-2">
                        <strong onClick={() => setSelectedLead(lead)} className="text-sm text-[var(--color-heading)] font-bold cursor-pointer hover:text-[var(--color-primary)]">{lead.instituteName}</strong>
                        {lead.visitCount > 1 && (
                          <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            🔄 {lead.visitCount} Visits
                          </span>
                        )}
                      </div>
                      <span className="bg-blue-500/10 text-blue-600 border border-blue-500/20 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        {lead.leadStatus || 'Active Lead'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-heading)]">
                      <div>
                        👤 <strong>Contact:</strong> {lead.contactPerson} | 📞 <a href={`tel:${lead.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{lead.mobileNo}</a>
                      </div>
                      <div onClick={() => setSelectedLead(lead)} className="cursor-pointer">📍 <strong>Location:</strong> {lead.address || 'N/A'}, {lead.city}, {lead.state}</div>
                      <div onClick={() => setSelectedLead(lead)} className="cursor-pointer">🎯 <strong>Demo Status:</strong> <span className="text-amber-600 font-semibold">{lead.demoStatus || 'Not Given'}</span></div>
                      {lead.followUpDate && (
                        <div onClick={() => setSelectedLead(lead)} className="sm:col-span-2 text-amber-600 font-semibold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 cursor-pointer">
                          🔔 <strong>Follow-up Reminder:</strong> {lead.followUpAction} on {new Date(lead.followUpDate).toLocaleDateString('en-IN')} {lead.followUpTime ? `at ${lead.followUpTime}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedLead && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[var(--color-heading)]">{selectedLead.instituteName}</h3>
                      {selectedLead.visitCount > 1 && (
                        <span className="text-[11px] text-emerald-600 font-semibold">Total Visits / Interactions: {selectedLead.visitCount}</span>
                      )}
                    </div>
                    <button onClick={() => { setSelectedLead(null); setFollowUpModalAction(null); }} className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-xs cursor-pointer">✕</button>
                  </div>

                  <div className="space-y-2 text-xs text-[var(--color-heading)]">
                    <p>👤 <strong>Contact Person:</strong> {selectedLead.contactPerson} | 📞 <a href={`tel:${selectedLead.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{selectedLead.mobileNo}</a></p>
                    <p>✉️ <strong>Email:</strong> {selectedLead.email || 'N/A'}</p>
                    <p>📍 <strong>Address:</strong> {selectedLead.address || 'N/A'}, {selectedLead.city}, {selectedLead.state} - {selectedLead.pincode}</p>
                    <p>🎯 <strong>Current Demo Status:</strong> <span className="text-[var(--color-primary)] font-bold">{selectedLead.demoStatus || 'Not Given'}</span></p>
                    {selectedLead.meetingPhoto && (
                      <div className="pt-1">
                        <strong className="block mb-1 text-[var(--color-body)]">Meeting Photo:</strong>
                        <img src={`${API_BASE}/${selectedLead.meetingPhoto}`} alt="Meeting" className="h-36 w-full rounded-2xl object-cover border border-[var(--color-border)]" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[var(--color-border)]">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-[var(--color-primary)] uppercase">1. Demo Status</label>
                      <div className="flex gap-2 flex-wrap">
                        {['Not Given', 'Scheduled', 'Completed', 'Interested'].map((st) => (
                          <button key={st} type="button" onClick={() => handleUpdateLeadStatus(selectedLead._id, null, st)} className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition ${selectedLead.demoStatus === st ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}>
                            {st === 'Completed' ? '✅ Completed' : st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <button type="button" onClick={async () => {
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
                        setActiveView('invoice-form');
                      }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-2xl text-xs transition cursor-pointer shadow-sm">
                        🚀 Sales Punch (Generate Invoice & Close Lead)
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-[var(--color-primary)] uppercase">3. Update Lead Stage / Response</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setFollowUpModalAction('Call Back')} className="bg-amber-500/10 text-amber-600 border border-amber-500/20 py-2.5 rounded-xl font-semibold cursor-pointer hover:bg-amber-500/20 transition">📞 Call Back</button>
                        <button onClick={() => setFollowUpModalAction('Follow Up')} className="bg-blue-500/10 text-blue-600 border border-blue-500/20 py-2.5 rounded-xl font-semibold cursor-pointer hover:bg-blue-500/20 transition">🔔 Follow Up</button>
                        <button onClick={() => handleUpdateLeadStatus(selectedLead._id, 'Not Interested', null)} className="bg-red-500/10 text-red-500 border border-red-500/20 py-2.5 rounded-xl font-semibold cursor-pointer hover:bg-red-500/20 transition">❌ Not Interested</button>
                        <button onClick={() => handleUpdateLeadStatus(selectedLead._id, 'Deal Close', null)} className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 py-2.5 rounded-xl font-semibold cursor-pointer hover:bg-emerald-500/20 transition">🎉 Deal Close</button>
                      </div>

                      {followUpModalAction && (
                        <div className="mt-3 p-4 bg-[var(--color-surface)] border border-[var(--color-primary)]/40 rounded-2xl space-y-3">
                          <p className="text-xs font-bold text-[var(--color-primary)]">Select Date & Time for {followUpModalAction}:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs" />
                            <input type="time" value={modalTime} onChange={(e) => setModalTime(e.target.value)} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs" />
                          </div>
                          <button type="button" onClick={() => {
                            if (!modalDate) { alert('Please select a date!'); return; }
                            handleUpdateLeadStatus(selectedLead._id, followUpModalAction, null, modalDate, modalTime);
                          }} className="w-full bg-[var(--color-primary)] text-white text-xs py-2.5 rounded-xl font-semibold cursor-pointer transition">
                            Save Reminder Date & Time
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'calendar' && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="border-b border-[var(--color-border)] pb-4">
              <h3 className="text-base font-bold text-[var(--color-heading)]">📅 Upcoming Follow-ups & Meetings Schedule</h3>
              <p className="text-xs text-[var(--color-body)] mt-1">Keep track of all client callbacks and meetings scheduled for upcoming dates.</p>
            </div>

            {myLeads.filter(l => l.followUpDate && l.leadStatus !== 'Not Interested' && l.leadStatus !== 'Deal Close').length === 0 ? (
              <div className="text-center py-16 bg-[var(--color-surface)] rounded-3xl text-xs text-[var(--color-body)] space-y-3 border border-[var(--color-border)]">
                <p>No active follow-up reminders scheduled yet.</p>
                <button onClick={() => setActiveView('lead-form')} className="bg-[var(--color-primary)] text-white text-xs px-4 py-2.5 rounded-xl">Schedule a Follow-up</button>
              </div>
            ) : (
              <div className="space-y-3">
                {myLeads
                  .filter(l => l.followUpDate && l.leadStatus !== 'Not Interested' && l.leadStatus !== 'Deal Close')
                  .sort((a,b) => new Date(a.followUpDate) - new Date(b.followUpDate))
                  .map((lead) => (
                  <div key={lead._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--color-primary)] text-white px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">{lead.followUpAction || 'Call'}</span>
                        <strong className="text-sm text-[var(--color-heading)] font-bold">{lead.instituteName}</strong>
                      </div>
                      <p className="text-[var(--color-body)]">👤 Contact: {lead.contactPerson} | 📞 <a href={`tel:${lead.mobileNo}`} className="text-[var(--color-primary)] font-bold hover:underline">{lead.mobileNo}</a></p>
                    </div>
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-2xl text-right sm:min-w-[200px]">
                      <span className="text-[var(--color-body)] block text-[10px] font-medium uppercase">Scheduled For:</span>
                      <strong className="text-emerald-600 text-xs font-bold">📅 {new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                      {lead.followUpTime && <span className="block text-[var(--color-heading)] font-semibold mt-0.5">⏰ {lead.followUpTime}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'lead-form' && (
          <div>
            {status.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-2xl mb-6 text-xs font-semibold">{status.success}</div>}
            {status.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl mb-6 text-xs font-semibold">{status.error}</div>}

            <form onSubmit={handleLeadSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-border)] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider">Record Visit / New Lead</h3>
                  <p className="text-[11px] text-[var(--color-body)] mt-0.5">Date and time are automatically recorded upon submission.</p>
                </div>
                <button type="button" onClick={handleAutoDetectLocation} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/25 text-xs px-4 py-2.5 rounded-2xl font-bold transition cursor-pointer flex items-center gap-2">
                  📍 Auto-Detect Current GPS Location & Address
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Mobile Number (Auto-detects previous lead) *</label>
                  <input type="tel" name="mobileNo" required value={leadFormData.mobileNo} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-semibold" placeholder="9876543210" />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Institute Name *</label>
                  <input type="text" name="instituteName" required value={leadFormData.instituteName} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="Global Public School" />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Contact Person Name *</label>
                  <input type="text" name="contactPerson" required value={leadFormData.contactPerson} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="Mr. Rajesh Kumar" />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Email Address (Optional)</label>
                  <input type="email" name="email" value={leadFormData.email} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="director@school.com" />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Street Address (Optional)</label>
                  <textarea name="address" rows="2" value={leadFormData.address} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="Office No, Landmark"></textarea>
                </div>

                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">State *</label>
                  <select name="state" required value={leadStateCode} onChange={handleLeadStateChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] font-medium">
                    <option value="">Select State</option>
                    {indianStates.map((st) => (
                      <option key={st.isoCode} value={st.isoCode}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">City / District *</label>
                  <select name="city" required disabled={!leadStateCode} value={leadFormData.city} onChange={handleLeadCityChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] disabled:opacity-50 font-medium">
                    <option value="">Select City</option>
                    {citiesOfLeadState.map((ct) => (
                      <option key={ct.name} value={ct.name}>{ct.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Pincode *</label>
                  {leadAvailablePincodes.length > 0 ? (
                    <select name="pincode" required value={leadFormData.pincode} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] font-medium">
                      <option value="">Select Pincode</option>
                      {leadAvailablePincodes.map((pin) => <option key={pin} value={pin}>{pin}</option>)}
                    </select>
                  ) : (
                    <input type="text" name="pincode" maxLength={6} required value={leadFormData.pincode} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="6-digit Pincode" />
                  )}
                </div>

                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-primary-dark)]">📸 Upload Meeting Photo *</label>
                  <input type="file" accept="image/*" required onChange={handleMeetingPhotoChange} className="block w-full text-xs text-[var(--color-body)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white cursor-pointer" />
                </div>

                <div className="md:col-span-2 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
                  <h4 className="text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-wider">📅 Schedule Next Follow-up / Meeting</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Follow-up Action</label>
                      <select name="followUpAction" value={leadFormData.followUpAction} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs font-medium">
                        <option value="Call">Call Back</option>
                        <option value="Next Meeting">Meeting Reschedule</option>
                        <option value="Demo">Demo</option>
                        <option value="Closed">Deal Closed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Follow-up Date</label>
                      <input type="date" name="followUpDate" value={leadFormData.followUpDate} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Follow-up Time</label>
                      <input type="time" name="followUpTime" value={leadFormData.followUpTime} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Visit / Discussion Notes</label>
                  <textarea name="notes" rows="3" value={leadFormData.notes} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" placeholder="Summary of this visit..."></textarea>
                </div>
              </div>

              <button type="submit" disabled={status.loading} className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition cursor-pointer disabled:opacity-50 shadow-sm text-xs">
                {status.loading ? 'Detecting Live GPS & Saving Visit...' : 'Save Lead Visit & Follow-up'}
              </button>
            </form>
          </div>
        )}

        {activeView === 'invoice-form' && (
          <div>
            {status.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-2xl mb-6 text-xs font-semibold">{status.success}</div>}
            {status.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl mb-6 text-xs font-semibold">{status.error}</div>}

            <form onSubmit={handleSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-border)] pb-4">
                <h3 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider">1. Client Details & Installment Ledger Lookup</h3>
                <button type="button" onClick={handleInvoiceAutoDetectLocation} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/25 text-xs px-4 py-2.5 rounded-2xl font-bold transition cursor-pointer flex items-center gap-2">
                  📍 Auto-Detect Current GPS Location & Address
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Institute Name (Type or select to auto-load due) *</label>
                  <input 
                    type="text" 
                    name="instituteName" 
                    list="existingInstitutes"
                    required 
                    value={formData.instituteName} 
                    onChange={handleChange} 
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-semibold" 
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
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">App Name *</label>
                  <input type="text" name="appName" required value={formData.appName} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Mobile Number *</label>
                  <input type="tel" name="mobileNo" required value={formData.mobileNo} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Client Email *</label>
                  <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Street Address *</label>
                  <textarea name="address" rows="2" required value={formData.address} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"></textarea>
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">State *</label>
                  <select name="state" required value={selectedStateCode} onChange={handleInvoiceStateChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 font-medium">
                    <option value="">Select State</option>
                    {indianStates.map((st) => <option key={st.isoCode} value={st.isoCode}>{st.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">City *</label>
                  <select name="city" required disabled={!selectedStateCode} value={formData.city} onChange={handleInvoiceCityChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 disabled:opacity-50 font-medium">
                    <option value="">Select City</option>
                    {citiesOfSelectedState.map((ct) => <option key={ct.name} value={ct.name}>{ct.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Pincode *</label>
                  {availablePincodes.length > 0 ? (
                    <select name="pincode" required value={formData.pincode} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 font-medium">
                      <option value="">Select Pincode</option>
                      {availablePincodes.map(pin => <option key={pin} value={pin}>{pin}</option>)}
                    </select>
                  ) : (
                    <input type="text" name="pincode" maxLength={6} required value={formData.pincode} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 focus:outline-none focus:border-[var(--color-primary)]" placeholder="Pincode" />
                  )}
                </div>
                <div>
                  <label className="block font-medium mb-1.5 text-[var(--color-heading)]">GST Number</label>
                  <input type="text" name="gstNo" value={formData.gstNo} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 focus:outline-none focus:border-[var(--color-primary)]" placeholder="Optional" />
                </div>
              </div>

              <hr className="border-[var(--color-border)]" />

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider">2. Installment & Due Payment Ledger</h3>
                 
                {formData.previousDueBalance > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-amber-600 block font-bold">⚠️ Outstanding Due Balance Automatically Loaded:</strong>
                      <span className="text-[var(--color-body)]">This institute has a pending due balance that this payment will clear against.</span>
                    </div>
                    <span className="text-amber-600 font-extrabold text-sm">₹{formData.previousDueBalance.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Base Package Price (₹)</label>
                    <input type="number" name="baseAmount" value={formData.baseAmount} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 focus:outline-none focus:border-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1.5 text-emerald-600 font-bold">Installment Paid Now (₹) *</label>
                    <input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-emerald-500/50 rounded-2xl p-3 font-bold text-emerald-600 focus:outline-none" />
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
                  <label className="block text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">🎁 Select Add-on Packages</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[var(--color-heading)]">
                    <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)]">
                      <input type="checkbox" name="testModule" checked={addons.testModule} onChange={handleAddonChange} className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer" />
                      <span>Test Series Module (+₹5,000)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)]">
                      <input type="checkbox" name="windowApp" checked={addons.windowApp} onChange={handleAddonChange} className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer" />
                      <span>Windows App (+₹5,000)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)]">
                      <input type="checkbox" name="iosApp" checked={addons.iosApp} onChange={handleAddonChange} className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer" />
                      <span>iOS Mobile App (+₹45,000)</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-2">
                  <label className="block text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">🏷️ Apply Coupon Code</label>
                  <div className="flex gap-2">
                    <input type="text" value={couponInput} disabled={isCouponApplied} onChange={(e) => setCouponInput(e.target.value)} placeholder="FLAT50" className="uppercase flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs font-mono" />
                    {!isCouponApplied ? (
                      <button type="button" onClick={handleApplyCoupon} className="bg-[var(--color-primary)] text-white text-xs px-5 py-2.5 rounded-xl cursor-pointer font-semibold">Apply</button>
                    ) : (
                      <button type="button" onClick={handleRemoveCoupon} className="bg-red-500/10 text-red-600 border border-red-500/20 text-xs px-5 py-2.5 rounded-xl cursor-pointer font-semibold">Remove</button>
                    )}
                  </div>
                  {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                  {isCouponApplied && couponDetails && (
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      🎉 Coupon "{couponDetails.code}" applied! Discount added.
                    </p>
                  )}
                </div>

                <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] space-y-2 text-xs text-[var(--color-heading)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-body)]">Current Package Subtotal + 18% GST:</span>
                    <span className="font-medium">₹{(formData.subtotalAmount + formData.gstAmount).toLocaleString('en-IN')}</span>
                  </div>
                  {formData.previousDueBalance > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Pending Due Balance Carried Forward:</span>
                      <span>+ ₹{formData.previousDueBalance.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)] text-sm">
                    <span className="font-bold text-[var(--color-heading)]">Grand Total (Bill + Past Dues):</span>
                    <span className="text-base font-extrabold text-[var(--color-primary)]">
                      ₹{formData.totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-surface)] border border-dashed border-[var(--color-primary)]/40 rounded-2xl space-y-2">
                  <label className="block text-xs font-semibold text-[var(--color-primary-dark)]">📸 Upload Payment Screenshot / Receipt Proof *</label>
                  <input type="file" accept="image/*" required onChange={handleFileChange} className="block w-full text-xs text-[var(--color-body)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white cursor-pointer" />
                </div>

                <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] flex justify-between items-center text-xs">
                  <span className="text-[var(--color-heading)] font-bold">Rest Due Balance After This Payment:</span>
                  <span className={`text-sm font-extrabold ${dueAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    ₹{dueAmount.toLocaleString('en-IN')} {dueAmount === 0 ? '🎉 (Zero Due - Fully Settled)' : ''}
                  </span>
                </div>
              </div>

              <button type="submit" disabled={status.loading} className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition cursor-pointer disabled:opacity-50 shadow-sm text-xs">
                {status.loading ? 'Submitting Installment & Updating Ledger...' : 'Submit Installment Payment & Update Due Balance'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default SalespersonForm;