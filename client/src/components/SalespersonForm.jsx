/**
 * =========================================================================
 * 👤 SALESPERSON PORTAL COMPONENT (`SalespersonForm.jsx`)
 * =========================================================================
 * Description: Allows salesperson to manage performance, track deals, create/update 
 * leads with live GPS coordinates, schedule follow-ups, and submit invoices with 
 * database-verified coupon discounts and payment proofs.
 */

import React, { useState, useEffect } from 'react';
import { State, City } from 'country-state-city';
import { submitInvoiceRequest } from '../api/api';

const SalespersonForm = ({ userId, onLogout }) => {
  // --- Navigation & View States ---
  const [activeView, setActiveView] = useState('dashboard');

  // --- Deals & Leads Data States ---
  const [myDeals, setMyDeals] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  const [myLeads, setMyLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // --- 🔍 Leads Filter State ---
  const [leadFilter, setLeadFilter] = useState('all');

  // --- Modal & Reminder States ---
  const [selectedLead, setSelectedLead] = useState(null);
  const [followUpModalAction, setFollowUpModalAction] = useState(null);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');

  // --- Add-on Package Pricing Constants ---
  const ADDON_PRICES = {
    testModule: 5000,
    windowApp: 5000,
    iosApp: 45000,
  };

  // --- API Base URL Configuration ---
  const API_BASE = process.env.NODE_ENV === "production"
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

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
    totalAmount: 15000,
    paidAmount: 0,
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
  const fetchMyDeals = async () => {
    setLoadingDeals(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/my-deals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setMyDeals(data);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
    } finally {
      setLoadingDeals(false);
    }
  };

  // --- Fetch Logged-in Salesperson's Generated Leads ---
  const fetchMyLeads = async () => {
    setLoadingLeads(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/salesperson/my-leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setMyLeads(data);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  };

  // --- Initial Data Load on Component Mount ---
  useEffect(() => {
    fetchMyDeals();
    fetchMyLeads();
  }, []);

  // --- Location Utility Constants ---
  const indianStates = State.getStatesOfCountry('IN');
  const citiesOfSelectedState = selectedStateCode ? City.getCitiesOfState('IN', selectedStateCode) : [];
  const citiesOfLeadState = leadStateCode ? City.getCitiesOfState('IN', leadStateCode) : [];

  // --- Dynamic Invoice Total Calculation (Base + Addons - Discount) ---
  useEffect(() => {
    let totalAddonCost = 0;
    if (addons.testModule) totalAddonCost += ADDON_PRICES.testModule;
    if (addons.windowApp) totalAddonCost += ADDON_PRICES.windowApp;
    if (addons.iosApp) totalAddonCost += ADDON_PRICES.iosApp;

    const subtotal = formData.baseAmount + totalAddonCost;
    let discount = 0;

    if (isCouponApplied && couponDetails) {
      if (couponDetails.discountType === 'percentage') {
        discount = (subtotal * couponDetails.discountValue) / 100;
      } else {
        discount = couponDetails.discountValue;
      }
    }

    const calculatedTotal = Math.max(0, subtotal - discount);

    setFormData((prev) => ({
      ...prev,
      totalAmount: calculatedTotal,
      discountAmount: discount
    }));
  }, [addons, formData.baseAmount, isCouponApplied, couponDetails]);

  // --- Auto-calculated Due Amount ---
  const dueAmount = Math.max(0, formData.totalAmount - formData.paidAmount);

  // --- Performance Dashboard Metrics Calculations ---
  const totalDealsCount = myDeals.length;
  const activeLeadsList = myLeads.filter(lead => lead.leadStatus !== 'Not Interested' && lead.leadStatus !== 'Deal Close');
  const totalLeadsCount = activeLeadsList.length;
  const approvedDealsCount = myDeals.filter(d => d.status === 'approved').length;
  const pendingDealsCount = myDeals.filter(d => d.status === 'pending').length;
  const totalPaidCollected = myDeals.reduce((sum, d) => sum + (d.paidAmount || 0), 0);

  // --- 🔍 Filter Leads based on Selected Filter Button ---
  const filteredLeads = activeLeadsList.filter(lead => {
    if (leadFilter === 'all') return true;
    if (leadFilter === 'call') return lead.followUpAction === 'Call' || lead.leadStatus === 'Call Back';
    if (leadFilter === 'meeting') return lead.followUpAction === 'Next Meeting';
    if (leadFilter === 'demo-done') return lead.demoStatus === 'Completed';
    if (leadFilter === 'demo-pending') return lead.demoStatus === 'Not Given' || lead.demoStatus === 'Scheduled';
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

  // --- Handle State Selection Change for Leads ---
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

  // --- Handle City Selection Change & Fetch Pincodes for Leads ---
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

  // --- Handle Input Changes in Lead Form ---
  const handleLeadChange = (e) => {
    const { name, value } = e.target;
    setLeadFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'pincode') {
      fetchLeadByPincode(value);
    }
  };

  // --- Handle State Selection Change for Invoice Form ---
  const handleInvoiceStateChange = (e) => {
    const iso = e.target.value;
    const stObj = indianStates.find(s => s.isoCode === iso);
    setSelectedStateCode(iso);
    setAvailablePincodes([]);
    setFormData(prev => ({ ...prev, state: stObj ? stObj.name : '', city: '', pincode: '' }));
  };

  // --- Handle City Selection Change & Fetch Pincodes for Invoice Form ---
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

  // --- Handle Input Changes in Invoice Form & Auto-fill from Existing Leads ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'baseAmount' || name === 'paidAmount' ? Number(value) : value,
    }));

    if (name === 'instituteName') {
      const matchedLead = activeLeadsList.find(
        (l) => l.instituteName.toLowerCase() === value.toLowerCase()
      );
      if (matchedLead) {
        const matchedState = indianStates.find(
          (s) => s.name.toLowerCase() === (matchedLead.state || '').toLowerCase()
        );
        if (matchedState) {
          setSelectedStateCode(matchedState.isoCode);
        }
        setFormData((prev) => ({
          ...prev,
          instituteName: matchedLead.instituteName,
          mobileNo: matchedLead.mobileNo || '',
          email: matchedLead.email || '',
          address: matchedLead.address || '',
          city: matchedLead.city || '',
          state: matchedState ? matchedState.name : matchedLead.state || '',
          pincode: matchedLead.pincode || ''
        }));
      }
    }

    if (name === 'pincode') {
      fetchByPincode(value);
    }
  };

  // --- Handle Add-on Package Selection ---
  const handleAddonChange = (e) => {
    const { name, checked } = e.target;
    setAddons((prev) => ({ ...prev, [name]: checked }));
  };

  // --- File Upload Handlers ---
  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleMeetingPhotoChange = (e) => setMeetingPhotoFile(e.target.files[0]);

  // --- Auto-detect GPS Location for Lead Form ---
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
            if (matchedState) {
              setLeadStateCode(matchedState.isoCode);
            }

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
          console.error("Reverse geocoding error:", err);
          setStatus({ loading: false, success: '', error: 'Failed to fetch address from coordinates.' });
        }
      },
      () => {
        setStatus({ loading: false, success: '', error: 'GPS permission denied or failed.' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // --- Auto-detect GPS Location for Invoice Form ---
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
            if (matchedState) {
              setSelectedStateCode(matchedState.isoCode);
            }

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
          console.error("Invoice reverse geocoding error:", err);
          setStatus({ loading: false, success: '', error: 'Failed to fetch invoice address.' });
        }
      },
      () => {
        setStatus({ loading: false, success: '', error: 'GPS permission denied or failed.' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // --- Update Lead Stage, Demo Status, and Follow-up Schedule ---
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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

  // --- Submit New Prospect Lead ---
  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!meetingPhotoFile) {
      setStatus({ loading: false, success: '', error: 'Please upload the meeting photo!' });
      return;
    }

    setStatus({ loading: true, success: 'Saving lead with follow-up...', error: '' });

    const processLeadSubmission = async (lat = null, lng = null) => {
      const data = new FormData();
      Object.keys(leadFormData).forEach((key) => {
        if (leadFormData[key] !== undefined && leadFormData[key] !== null) {
          data.append(key, leadFormData[key]);
        }
      });
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

        setStatus({ loading: false, success: 'Lead & Follow-up scheduled successfully!', error: '' });
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

  // --- Submit Invoice Request with GPS Verification ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatus({ loading: false, success: '', error: 'Please upload payment proof!' });
      return;
    }

    setStatus({ loading: true, success: 'Fetching live GPS verification & submitting...', error: '' });

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
        setStatus({
          loading: false,
          success: `Invoice Request #${resData.invoiceId} submitted with Live GPS Verification!`,
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
          setActiveView('dashboard');
          setStatus({ loading: false, success: '', error: '' });
        }, 2000);
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
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-5 gap-4">
          <div>
            <span className="text-xs bg-[var(--color-primary-light)]/20 text-[var(--color-primary-dark)] px-3 py-1 rounded-full font-semibold">
              👤 SALESPERSON PORTAL
            </span>
            <h1 className="text-2xl font-bold text-[var(--color-heading)] mt-1">
              {activeView === 'dashboard' && 'My Dashboard & Performance'}
              {activeView === 'leads' && 'My Generated Leads'}
              {activeView === 'calendar' && '📅 Follow-up & Meeting Calendar'}
              {activeView === 'lead-form' && 'Create New Lead & Schedule Follow-up'}
              {activeView === 'invoice-form' && 'Create Invoice Request'}
            </h1>
            <p className="text-[var(--color-body)] text-xs">Logged in as: <strong className="text-[var(--color-primary)]">{userId}</strong></p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeView !== 'dashboard' && (
              <button onClick={() => setActiveView('dashboard')} className="bg-[var(--color-surface)] text-[var(--color-heading)] text-xs px-3 py-2 rounded-xl font-medium border border-[var(--color-border)] cursor-pointer">
                📊 Dashboard
              </button>
            )}
            <button onClick={() => setActiveView('leads')} className={`text-xs px-3 py-2 rounded-xl font-medium border cursor-pointer ${activeView === 'leads' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
              📋 My Leads ({totalLeadsCount})
            </button>
            <button onClick={() => setActiveView('calendar')} className={`text-xs px-3 py-2 rounded-xl font-medium border cursor-pointer ${activeView === 'calendar' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
              📅 Calendar / Follow-ups
            </button>
            <button onClick={() => setActiveView('lead-form')} className={`text-xs px-3 py-2 rounded-xl font-medium border cursor-pointer ${activeView === 'lead-form' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
              ➕ New Lead
            </button>
            <button onClick={() => setActiveView('invoice-form')} className={`text-xs px-3 py-2 rounded-xl font-medium border cursor-pointer ${activeView === 'invoice-form' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}>
              🧾 New Invoice
            </button>
            <button onClick={onLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer">
              Logout
            </button>
          </div>
        </div>

        {/* VIEW 1: DASHBOARD */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div onClick={() => setActiveView('lead-form')} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-5 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between group">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">➕ Create Lead & Follow-up</h3>
                  <p className="text-xs text-[var(--color-body)] mt-0.5">Record details, photo & schedule meetings.</p>
                </div>
                <span className="text-2xl">🎯</span>
              </div>
              <div onClick={() => setActiveView('calendar')} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-5 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between group">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">📅 View Calendar</h3>
                  <p className="text-xs text-[var(--color-body)] mt-0.5">Check upcoming calls & meetings schedule.</p>
                </div>
                <span className="text-2xl">🗓️</span>
              </div>
              <div onClick={() => setActiveView('invoice-form')} className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-5 rounded-2xl shadow-sm cursor-pointer transition flex items-center justify-between group">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-heading)] group-hover:text-[var(--color-primary)] transition">🧾 Create Invoice</h3>
                  <p className="text-xs text-[var(--color-body)] mt-0.5">Submit payment proof & package details.</p>
                </div>
                <span className="text-2xl">💳</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[var(--color-body)] block font-medium">Total Invoices / Deals</span>
                <strong className="text-2xl font-extrabold text-[var(--color-primary)]">{totalDealsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[var(--color-body)] block font-medium">Total Leads Generated</span>
                <strong className="text-2xl font-extrabold text-blue-600">{totalLeadsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[var(--color-body)] block font-medium">Approved Invoices</span>
                <strong className="text-2xl font-extrabold text-emerald-600">{approvedDealsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[var(--color-body)] block font-medium">Pending Invoices</span>
                <strong className="text-2xl font-extrabold text-amber-600">{pendingDealsCount}</strong>
              </div>
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm sm:col-span-2 md:col-span-1">
                <span className="text-xs text-[var(--color-body)] block font-medium">Payment Collected</span>
                <strong className="text-2xl font-extrabold text-emerald-600">₹{totalPaidCollected.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* My Submitted Invoices History List */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-lg font-bold text-[var(--color-heading)]">📋 My Invoice Requests History</h3>
                <span className="text-xs bg-[var(--color-surface)] px-3 py-1 rounded-lg border border-[var(--color-border)] font-medium">
                  {myDeals.length} Record(s)
                </span>
              </div>

              {loadingDeals ? (
                <div className="text-center py-8 text-sm text-[var(--color-body)]">Loading your deals...</div>
              ) : myDeals.length === 0 ? (
                <div className="text-center py-10 bg-[var(--color-surface)] rounded-xl text-sm text-[var(--color-body)] space-y-3">
                  <p>You haven't submitted any invoice requests yet.</p>
                  <button onClick={() => setActiveView('invoice-form')} className="bg-[var(--color-primary)] text-white text-xs px-4 py-2 rounded-xl font-medium cursor-pointer">
                    Create Your First Invoice Request
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myDeals.map((deal) => (
                    <div key={deal._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-xl space-y-2 text-xs">
                      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--color-border)] pb-2">
                        <div>
                          <strong className="text-sm text-[var(--color-heading)]">{deal.instituteName}</strong>
                          <span className="ml-2 text-xs text-[var(--color-body)]">({deal.appName})</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full font-semibold uppercase ${deal.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-300' : deal.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-200' : 'bg-amber-500/10 text-amber-600 border border-amber-200'}`}>
                          {deal.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-heading)]">
                        <div>📍 <strong>Address:</strong> {deal.address || 'N/A'}, {deal.city || ''}, {deal.state || ''} ({deal.pincode || ''})</div>
                        <div>📞 <strong>Client Contact:</strong> {deal.mobileNo} | {deal.email}</div>
                      </div>
                      <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--color-border)]/60">
                        <span>Total Amount: <strong>₹{deal.totalAmount?.toLocaleString('en-IN')}</strong></span>
                        <span className="text-emerald-600">Paid: <strong>₹{deal.paidAmount?.toLocaleString('en-IN')}</strong></span>
                        <span className="text-red-500">Due: <strong>₹{deal.dueAmount?.toLocaleString('en-IN')}</strong></span>
                        {deal.invoiceId && <span className="text-[var(--color-primary)]">Invoice ID: #{deal.invoiceId}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW 2: LEADS LIST */}
        {activeView === 'leads' && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-3 gap-3">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">📋 My Generated Leads Directory</h3>
              <button onClick={() => setActiveView('lead-form')} className="bg-[var(--color-primary)] text-white text-xs px-4 py-2.5 rounded-xl font-semibold cursor-pointer">
                ➕ Add New Lead
              </button>
            </div>

            {/* 🔍 Leads Filter Action Bar */}
            <div className="flex gap-2 flex-wrap pt-2">
              <button
                onClick={() => setLeadFilter('all')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium border cursor-pointer ${leadFilter === 'all' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}
              >
                All Active ({activeLeadsList.length})
              </button>
              <button
                onClick={() => setLeadFilter('call')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium border cursor-pointer ${leadFilter === 'call' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}
              >
                📞 To Call / Call Back
              </button>
              <button
                onClick={() => setLeadFilter('meeting')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium border cursor-pointer ${leadFilter === 'meeting' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}
              >
                🤝 Meetings
              </button>
              <button
                onClick={() => setLeadFilter('demo-done')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium border cursor-pointer ${leadFilter === 'demo-done' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}
              >
                ✅ Demo Done
              </button>
              <button
                onClick={() => setLeadFilter('demo-pending')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium border cursor-pointer ${leadFilter === 'demo-pending' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] text-[var(--color-heading)] border-[var(--color-border)]'}`}
              >
                ⏳ Demo Pending
              </button>
            </div>

            {loadingLeads ? (
              <div className="text-center py-8 text-sm text-[var(--color-body)]">Loading your leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-10 bg-[var(--color-surface)] rounded-xl text-sm text-[var(--color-body)] space-y-3">
                <p>No leads found matching this filter.</p>
                <button onClick={() => setLeadFilter('all')} className="bg-[var(--color-primary)] text-white text-xs px-4 py-2 rounded-xl">View All Leads</button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLeads.map((lead) => (
                  <div 
                    key={lead._id} 
                    onClick={() => setSelectedLead(lead)}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] p-4 rounded-xl space-y-2 text-xs cursor-pointer transition shadow-sm"
                  >
                    <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-2">
                      <strong className="text-sm text-[var(--color-heading)]">{lead.instituteName}</strong>
                      <span className="bg-blue-500/10 text-blue-600 border border-blue-200 px-2.5 py-0.5 rounded-full font-semibold">
                        {lead.leadStatus || 'Active Lead'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-heading)]">
                      <div>👤 <strong>Contact:</strong> {lead.contactPerson} | 📞 {lead.mobileNo}</div>
                      <div>📍 <strong>Location:</strong> {lead.address || 'N/A'}, {lead.city}, {lead.state} ({lead.pincode})</div>
                      <div>🎯 <strong>Demo Status:</strong> <span className="text-amber-600 font-semibold">{lead.demoStatus || 'Not Given'}</span></div>
                      {lead.followUpDate && (
                        <div className="sm:col-span-2 text-amber-600 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-200">
                          🔔 <strong>Follow-up Reminder:</strong> {lead.followUpAction} on {new Date(lead.followUpDate).toLocaleDateString('en-IN')} {lead.followUpTime ? `at ${lead.followUpTime}` : ''}
                        </div>
                      )}
                      {lead.notes && <div className="sm:col-span-2">📝 <strong>Notes:</strong> {lead.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedLead && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                    <h3 className="text-lg font-bold text-[var(--color-heading)]">{selectedLead.instituteName}</h3>
                    <button onClick={() => { setSelectedLead(null); setFollowUpModalAction(null); }} className="text-xs bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-lg cursor-pointer">✕ Close</button>
                  </div>

                  <div className="space-y-2 text-xs text-[var(--color-heading)]">
                    <p>👤 <strong>Contact Person:</strong> {selectedLead.contactPerson} ({selectedLead.mobileNo})</p>
                    <p>✉️ <strong>Email:</strong> {selectedLead.email || 'N/A'}</p>
                    <p>📍 <strong>Address:</strong> {selectedLead.address || 'N/A'}, {selectedLead.city}, {selectedLead.state} - {selectedLead.pincode}</p>
                    <p>🎯 <strong>Current Demo Status:</strong> <span className="text-[var(--color-primary)] font-bold">{selectedLead.demoStatus || 'Not Given'}</span></p>
                    <p>📌 <strong>Pipeline Status:</strong> <span className="text-emerald-600 font-bold">{selectedLead.leadStatus || 'Active'}</span></p>
                    {selectedLead.meetingPhoto && (
                      <div>
                        <strong className="block mb-1">Meeting Photo:</strong>
                        <img src={`${API_BASE}/${selectedLead.meetingPhoto}`} alt="Meeting" className="h-32 rounded-lg object-cover border" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[var(--color-border)]">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-[var(--color-primary)] uppercase">1. Demo Status</label>
                      <div className="flex gap-2 flex-wrap">
                        {['Not Given', 'Scheduled', 'Completed', 'Interested'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateLeadStatus(selectedLead._id, null, st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${selectedLead.demoStatus === st ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}
                          >
                            {st === 'Completed' ? '✅ Completed (Auto Timestamp)' : st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={async () => {
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
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer shadow"
                      >
                        🚀 Sales Punch (Generate Invoice & Close Lead)
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-[var(--color-primary)] uppercase">3. Update Lead Stage / Response</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setFollowUpModalAction('Call Back')} className="bg-amber-500/10 text-amber-600 border border-amber-200 py-2 rounded-xl font-semibold cursor-pointer hover:bg-amber-500/20">
                          📞 Call Back (Select Date)
                        </button>
                        <button onClick={() => setFollowUpModalAction('Follow Up')} className="bg-blue-500/10 text-blue-600 border border-blue-200 py-2 rounded-xl font-semibold cursor-pointer hover:bg-blue-500/20">
                          🔔 Follow Up (Select Date)
                        </button>
                        <button onClick={() => handleUpdateLeadStatus(selectedLead._id, 'Not Interested', null)} className="bg-red-500/10 text-red-500 border border-red-200 py-2 rounded-xl font-semibold cursor-pointer hover:bg-red-500/20">
                          ❌ Not Interested
                        </button>
                        <button onClick={() => handleUpdateLeadStatus(selectedLead._id, 'Deal Close', null)} className="bg-emerald-500/10 text-emerald-600 border border-emerald-200 py-2 rounded-xl font-semibold cursor-pointer hover:bg-emerald-500/20">
                          🎉 Deal Close
                        </button>
                      </div>

                      {followUpModalAction && (
                        <div className="mt-3 p-3 bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl space-y-3">
                          <p className="text-xs font-bold text-[var(--color-primary)]">Select Date & Time for {followUpModalAction}:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="date" 
                              value={modalDate} 
                              onChange={(e) => setModalDate(e.target.value)} 
                              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-2 text-xs" 
                            />
                            <input 
                              type="time" 
                              value={modalTime} 
                              onChange={(e) => setModalTime(e.target.value)} 
                              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-2 text-xs" 
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              if (!modalDate) {
                                alert('Please select a date!');
                                return;
                              }
                              handleUpdateLeadStatus(selectedLead._id, followUpModalAction, null, modalDate, modalTime);
                            }}
                            className="w-full bg-[var(--color-primary)] text-white text-xs py-2 rounded-lg font-semibold cursor-pointer"
                          >
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

        {/* VIEW: CALENDAR */}
        {activeView === 'calendar' && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-[var(--color-border)] pb-3">
              <h3 className="text-lg font-bold text-[var(--color-heading)]">📅 Upcoming Follow-ups & Meetings Schedule</h3>
              <p className="text-xs text-[var(--color-body)]">Keep track of all client callbacks and meetings scheduled for upcoming dates.</p>
            </div>

            {myLeads.filter(l => l.followUpDate && l.leadStatus !== 'Not Interested' && l.leadStatus !== 'Deal Close').length === 0 ? (
              <div className="text-center py-10 bg-[var(--color-surface)] rounded-xl text-sm text-[var(--color-body)] space-y-3">
                <p>No active follow-up reminders scheduled yet.</p>
                <button onClick={() => setActiveView('lead-form')} className="bg-[var(--color-primary)] text-white text-xs px-4 py-2 rounded-xl">Schedule a Follow-up</button>
              </div>
            ) : (
              <div className="space-y-3">
                {myLeads
                  .filter(l => l.followUpDate && l.leadStatus !== 'Not Interested' && l.leadStatus !== 'Deal Close')
                  .sort((a,b) => new Date(a.followUpDate) - new Date(b.followUpDate))
                  .map((lead) => (
                  <div key={lead._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--color-primary)] text-white px-2.5 py-0.5 rounded-full font-bold uppercase">{lead.followUpAction || 'Call'}</span>
                        <strong className="text-sm text-[var(--color-heading)]">{lead.instituteName}</strong>
                      </div>
                      <p className="text-[var(--color-body)]">👤 Contact: {lead.contactPerson} | 📞 {lead.mobileNo}</p>
                      {lead.notes && <p className="text-[var(--color-heading)]">📝 Note: {lead.notes}</p>}
                    </div>
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3 rounded-xl text-right sm:min-w-[180px]">
                      <span className="text-[var(--color-body)] block font-medium">Scheduled For:</span>
                      <strong className="text-emerald-600 text-sm">📅 {new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                      {lead.followUpTime && <span className="block text-[var(--color-heading)] font-semibold mt-0.5">⏰ {lead.followUpTime}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: NEW LEAD FORM */}
        {activeView === 'lead-form' && (
          <div>
            {status.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-xl mb-6 text-sm">{status.success}</div>}
            {status.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl mb-6 text-sm">{status.error}</div>}

            <form onSubmit={handleLeadSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-border)] pb-4">
                <h3 className="text-md font-semibold text-[var(--color-primary)] uppercase tracking-wider">New Lead & Follow-up Schedule</h3>
                <button 
                  type="button" 
                  onClick={handleAutoDetectLocation}
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-200 text-xs px-4 py-2.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-2"
                >
                  📍 Auto-Detect Current GPS Location & Address
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Institute Name *</label>
                  <input type="text" name="instituteName" required value={leadFormData.instituteName} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="Global Public School" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Contact Person Name *</label>
                  <input type="text" name="contactPerson" required value={leadFormData.contactPerson} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="Mr. Rajesh Kumar" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Mobile Number *</label>
                  <input type="tel" name="mobileNo" required value={leadFormData.mobileNo} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="9876543210" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Email Address (Optional)</label>
                  <input type="email" name="email" value={leadFormData.email} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="director@school.com" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Street Address (Optional)</label>
                  <textarea name="address" rows="2" value={leadFormData.address} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="Office No, Landmark"></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">State *</label>
                  <select name="state" required value={leadStateCode} onChange={handleLeadStateChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] font-medium">
                    <option value="">Select State</option>
                    {indianStates.map((st) => (
                      <option key={st.isoCode} value={st.isoCode}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">City / District *</label>
                  <select name="city" required disabled={!leadStateCode} value={leadFormData.city} onChange={handleLeadCityChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] disabled:opacity-50 font-medium">
                    <option value="">Select City</option>
                    {citiesOfLeadState.map((ct) => (
                      <option key={ct.name} value={ct.name}>{ct.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Pincode *</label>
                  {leadAvailablePincodes.length > 0 ? (
                    <select name="pincode" required value={leadFormData.pincode} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] font-medium">
                      <option value="">Select Pincode</option>
                      {leadAvailablePincodes.map((pin) => <option key={pin} value={pin}>{pin}</option>)}
                    </select>
                  ) : (
                    <input type="text" name="pincode" maxLength={6} required value={leadFormData.pincode} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="6-digit Pincode" />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-primary-dark)]">📸 Upload Meeting Photo *</label>
                  <input type="file" accept="image/*" required onChange={handleMeetingPhotoChange} className="block w-full text-sm text-[var(--color-body)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white cursor-pointer" />
                </div>

                <div className="md:col-span-2 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl space-y-4">
                  <h4 className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider">📅 Schedule Next Follow-up / Meeting</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Follow-up Action</label>
                      <select name="followUpAction" value={leadFormData.followUpAction} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs font-medium">
                        <option value="Call">Phone Call</option>
                        <option value="Next Meeting">Next Meeting</option>
                        <option value="Demo">Software Demo</option>
                        <option value="Closed">Deal Closing</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Follow-up Date</label>
                      <input type="date" name="followUpDate" value={leadFormData.followUpDate} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Follow-up Time</label>
                      <input type="time" name="followUpTime" value={leadFormData.followUpTime} onChange={handleLeadChange} className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Prospect Notes</label>
                  <textarea name="notes" rows="3" value={leadFormData.notes} onChange={handleLeadChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="Discussion summary..."></textarea>
                </div>
              </div>

              <button type="submit" disabled={status.loading} className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3.5 rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md">
                {status.loading ? 'Detecting Live GPS & Saving...' : 'Save Lead & Schedule Follow-up'}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 4: INVOICE FORM */}
        {activeView === 'invoice-form' && (
          <div>
            {status.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-xl mb-6 text-sm">{status.success}</div>}
            {status.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl mb-6 text-sm">{status.error}</div>}

            <form onSubmit={handleSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--color-border)] pb-4">
                <h3 className="text-md font-semibold text-[var(--color-primary)] uppercase tracking-wider">1. Client Details for Invoice</h3>
                <button 
                  type="button" 
                  onClick={handleInvoiceAutoDetectLocation}
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-200 text-xs px-4 py-2.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-2"
                >
                  📍 Auto-Detect Current GPS Location & Address
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Institute Name *</label>
                  <input type="text" name="instituteName" required value={formData.instituteName} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" placeholder="Type or select existing lead institute" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">App Name *</label>
                  <input type="text" name="appName" required value={formData.appName} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Mobile Number *</label>
                  <input type="tel" name="mobileNo" required value={formData.mobileNo} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Client Email *</label>
                  <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Street Address *</label>
                  <textarea name="address" rows="2" required value={formData.address} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)]"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">State *</label>
                  <select name="state" required value={selectedStateCode} onChange={handleInvoiceStateChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 font-medium">
                    <option value="">Select State</option>
                    {indianStates.map((st) => <option key={st.isoCode} value={st.isoCode}>{st.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">City *</label>
                  <select name="city" required disabled={!selectedStateCode} value={formData.city} onChange={handleInvoiceCityChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 disabled:opacity-50 font-medium">
                    <option value="">Select City</option>
                    {citiesOfSelectedState.map((ct) => <option key={ct.name} value={ct.name}>{ct.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Pincode *</label>
                  {availablePincodes.length > 0 ? (
                    <select name="pincode" required value={formData.pincode} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 font-medium">
                      <option value="">Select Pincode</option>
                      {availablePincodes.map(pin => <option key={pin} value={pin}>{pin}</option>)}
                    </select>
                  ) : (
                    <input type="text" name="pincode" maxLength={6} required value={formData.pincode} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3" placeholder="Pincode" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">GST Number</label>
                  <input type="text" name="gstNo" value={formData.gstNo} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3" placeholder="Optional" />
                </div>
              </div>

              <hr className="border-[var(--color-border)]" />

              <div>
                <h3 className="text-md font-semibold text-[var(--color-primary)] uppercase tracking-wider mb-4">2. Billing & Add-on Packages</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Validity</label>
                    <select name="packageValidity" value={formData.packageValidity} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 font-medium">
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="2 Years">2 Years</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Base Price (₹)</label>
                    <input type="number" name="baseAmount" value={formData.baseAmount} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Total Price (₹)</label>
                    <input type="number" readOnly name="totalAmount" value={formData.totalAmount} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 font-bold" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">Payment Paid (₹)</label>
                    <input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleChange} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3" />
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-4">
                  <label className="block text-xs font-semibold mb-3 text-[var(--color-primary)] uppercase tracking-wider">🎁 Select Add-on Packages</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-[var(--color-heading)]">
                    <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)]">
                      <input type="checkbox" name="testModule" checked={addons.testModule} onChange={handleAddonChange} className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer" />
                      <span>Test Series Module (+₹5,000)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)]">
                      <input type="checkbox" name="windowApp" checked={addons.windowApp} onChange={handleAddonChange} className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer" />
                      <span>Windows App (+₹5,000)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] border border-[var(--color-border)]">
                      <input type="checkbox" name="iosApp" checked={addons.iosApp} onChange={handleAddonChange} className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer" />
                      <span>iOS Mobile App (+₹45,000)</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
                  <label className="block text-xs font-semibold mb-2 text-[var(--color-primary)] uppercase tracking-wider">🏷️ Apply Coupon Code</label>
                  <div className="flex gap-2">
                    <input type="text" value={couponInput} disabled={isCouponApplied} onChange={(e) => setCouponInput(e.target.value)} placeholder="FLAT50" className="uppercase flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm" />
                    {!isCouponApplied ? (
                      <button type="button" onClick={handleApplyCoupon} className="bg-[var(--color-primary)] text-white text-sm px-4 py-2.5 rounded-xl cursor-pointer">Apply</button>
                    ) : (
                      <button type="button" onClick={handleRemoveCoupon} className="bg-red-500/10 text-red-600 border border-red-200 text-sm px-4 py-2.5 rounded-xl cursor-pointer">Remove</button>
                    )}
                  </div>
                  {couponError && <p className="text-xs text-red-500 mt-1.5">{couponError}</p>}
                  {isCouponApplied && couponDetails && (
                    <p className="text-xs text-emerald-600 font-medium mt-1.5">
                      🎉 Coupon "{couponDetails.code}" applied! {couponDetails.discountType === 'percentage' ? `${couponDetails.discountValue}%` : `₹${couponDetails.discountValue}`} discount added.
                    </p>
                  )}
                </div>

                <div className="mt-5 p-4 bg-[var(--color-surface)] border border-dashed border-[var(--color-primary-light)] rounded-xl">
                  <label className="block text-sm font-medium mb-2 text-[var(--color-primary-dark)]">📸 Upload Payment Screenshot / Receipt Proof *</label>
                  <input type="file" accept="image/*" required onChange={handleFileChange} className="block w-full text-sm text-[var(--color-body)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white cursor-pointer" />
                </div>
              </div>

              <button type="submit" disabled={status.loading} className="w-full bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl transition cursor-pointer disabled:opacity-50 shadow-md">
                {status.loading ? 'Fetching Live GPS & Submitting...' : 'Submit Request to Accountant'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default SalespersonForm;