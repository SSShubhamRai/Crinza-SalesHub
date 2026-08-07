import React, { useState, useEffect } from 'react';
import { State, City } from 'country-state-city';
import { submitInvoiceRequest } from '../api/api';

const InvoiceForm = ({ onLogout }) => {
  // Individual Add-on Prices
  const ADDON_PRICES = {
    testModule: 5000,
    windowApp: 5000,
    iosApp: 45000,
  };

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
    previousDueBalance: 0,  // 🌟 Ledger Support
    totalAmount: 17700,    
    paidAmount: 0,
    couponCode: '',
    discountAmount: 0,
    paymentMode: 'ONLINE', // 🌟 Payment Mode Support
    utrNumber: '',
    receiptNo: '',
    chequeNo: '',
    bankName: '',
    termsAndConditions: '1. Payment once made is non-refundable.\n2. Validity counts from application activation date.\n3. Taxes calculated as applicable.',
  };

  const initialAddons = {
    testModule: false,
    windowApp: false,
    iosApp: false,
  };

  const [formData, setFormData] = useState(initialFormData);
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [addons, setAddons] = useState(initialAddons);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ loading: false, success: '', error: '' });
  const [lastSubmittedInvoiceId, setLastSubmittedInvoiceId] = useState('');

  // Modal Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponDetails, setCouponDetails] = useState(null);

  // Pincode and API states
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [availablePincodes, setAvailablePincodes] = useState([]);

  // Fetch all Indian States from library
  const indianStates = State.getStatesOfCountry('IN');

  // Get cities based on selected state ISO code
  const citiesOfSelectedState = selectedStateCode 
    ? City.getCitiesOfState('IN', selectedStateCode) 
    : [];

  // Recalculate Subtotal, Discount, GST (18%), Previous Due, and Grand Total
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
    
    // Calculate 18% GST on the discounted subtotal
    const gst = discountedSubtotal * 0.18;
    
    // Include previous due balance
    const prevDue = Number(formData.previousDueBalance) || 0;
    
    // Final Grand Total
    const calculatedTotal = discountedSubtotal + gst + prevDue;

    setFormData((prev) => ({
      ...prev,
      subtotalAmount: discountedSubtotal,
      gstAmount: Math.round(gst * 100) / 100,
      totalAmount: Math.round(calculatedTotal * 100) / 100,
      discountAmount: discount
    }));
  }, [addons, formData.baseAmount, formData.previousDueBalance, isCouponApplied, couponDetails]);

  // Auto-calculated Due Amount
  const dueAmount = Math.max(0, formData.totalAmount - formData.paidAmount);

  // Apply Coupon Handler via API
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setCouponError('');
    try {
      const token = localStorage.getItem('token');
      const API_BASE = import.meta.env.PROD
        ? "https://crinza-saleshub.onrender.com"
        : "http://localhost:5000";

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

  // Fetch State & City when 6-Digit Pincode is typed
  const fetchByPincode = async (pincodeValue) => {
    if (pincodeValue.length === 6 && /^\d+$/.test(pincodeValue)) {
      setFetchingDetails(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincodeValue}`);
        const data = await response.json();

        if (data[0] && data[0].Status === 'Success') {
          const details = data[0].PostOffice[0];
          const fetchedStateName = details.State;
          const fetchedCityName = details.District;

          const matchedState = indianStates.find(
            (s) => s.name.toLowerCase() === fetchedStateName.toLowerCase()
          );

          setSelectedStateCode(matchedState ? matchedState.isoCode : '');
          setFormData((prev) => ({
            ...prev,
            state: matchedState ? matchedState.name : fetchedStateName,
            city: fetchedCityName,
          }));
        }
      } catch (err) {
        console.error('Pincode fetch error:', err);
      } finally {
        setFetchingDetails(false);
      }
    }
  };

  // Fetch Pincodes when City is selected
  const fetchPincodesByCity = async (cityName) => {
    if (!cityName) return;
    setFetchingDetails(true);
    try {
      const response = await fetch(`https://api.postalpincode.in/postoffice/${cityName}`);
      const data = await response.json();

      if (data[0] && data[0].Status === 'Success') {
        const pincodes = Array.from(
          new Set(data[0].PostOffice.map((po) => po.Pincode))
        );
        setAvailablePincodes(pincodes);

        if (pincodes.length > 0) {
          setFormData((prev) => ({ ...prev, pincode: pincodes[0] }));
        }
      } else {
        setAvailablePincodes([]);
      }
    } catch (err) {
      console.error('City pincodes fetch error:', err);
      setAvailablePincodes([]);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleStateChange = (e) => {
    const isoCode = e.target.value;
    const stateObj = indianStates.find((s) => s.isoCode === isoCode);

    setSelectedStateCode(isoCode);
    setAvailablePincodes([]);
    setFormData((prev) => ({
      ...prev,
      state: stateObj ? stateObj.name : '',
      city: '',
      pincode: '',
    }));
  };

  const handleCityChange = (e) => {
    const cityName = e.target.value;
    setFormData((prev) => ({ ...prev, city: cityName, pincode: '' }));
    fetchPincodesByCity(cityName);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: ['baseAmount', 'paidAmount', 'previousDueBalance'].includes(name) ? Number(value) : value,
    }));

    if (name === 'pincode') {
      fetchByPincode(value);
    }
  };

  const handleAddonChange = (e) => {
    const { name, checked } = e.target;
    setAddons((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatus({ loading: false, success: '', error: 'Please select a payment proof image!' });
      return;
    }

    setStatus({ loading: true, success: '', error: '' });

    const payload = new FormData();
    Object.keys(formData).forEach((key) => payload.append(key, formData[key]));
    payload.append('dueAmount', dueAmount);
    payload.append('paymentProof', file);
    payload.append('addons', JSON.stringify(addons));

    try {
      const data = await submitInvoiceRequest(payload);

      setLastSubmittedInvoiceId(data.invoiceId || 'CRINZA');
      setStatus({
        loading: false,
        success: `Invoice Request #${data.invoiceId || ''} submitted successfully!`,
        error: '',
      });
      setFormData(initialFormData);
      setSelectedStateCode('');
      setAddons(initialAddons);
      setFile(null);
      setAvailablePincodes([]);
      setIsCouponApplied(false);
      setCouponInput('');
      setCouponDetails(null);
      e.target.reset();
    } catch (err) {
      setStatus({ 
        loading: false, 
        success: '', 
        error: err.response?.data?.message || 'Invoice request failed.' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex justify-between items-center bg-[var(--color-card)] border border-[var(--color-border)] p-6 rounded-3xl shadow-sm">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 mb-1">
              INVOICE GENERATOR
            </span>
            <h1 className="text-2xl font-extrabold text-[var(--color-heading)] tracking-tight">Create Invoice</h1>
            <p className="text-[var(--color-body)] text-xs mt-0.5">Create and dispatch automated PDF invoice via email</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition cursor-pointer"
          >
            Logout
          </button>
        </div>

        {/* Status Alerts & WhatsApp Quick Share */}
        {status.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-2xl text-xs font-semibold space-y-3">
            <p>{status.success}</p>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hello! Your subscription invoice #${lastSubmittedInvoiceId} for ${formData.instituteName} has been generated successfully. Grand Total: ₹${formData.totalAmount}. Thank you for choosing Crinza Technologies!`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition shadow-sm font-bold"
            >
              📱 Share Summary via WhatsApp
            </a>
          </div>
        )}
        {status.error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl text-xs font-semibold">
            {status.error}
          </div>
        )}

        {/* Invoice Form */}
        <form onSubmit={handleSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 md:p-10 space-y-8 shadow-sm">
          
          {/* Section 1: Client Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">1. Client Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Institute Name *</label>
                <input
                  type="text"
                  name="instituteName"
                  required
                  value={formData.instituteName}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="Apex Academy"
                />
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">App Name *</label>
                <input
                  type="text"
                  name="appName"
                  required
                  value={formData.appName}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="Apex Learning App"
                />
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Mobile Number *</label>
                <input
                  type="tel"
                  name="mobileNo"
                  required
                  value={formData.mobileNo}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Client Email (Invoice Recipient) *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="client@gmail.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Street Address / Landmark *</label>
                <textarea 
                  name="address" 
                  rows="2" 
                  required 
                  value={formData.address} 
                  onChange={handleChange} 
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" 
                  placeholder="Office No. 101, ABC Commercial Complex, Main Road"
                />
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">State *</label>
                <select 
                  name="state" 
                  required 
                  value={selectedStateCode} 
                  onChange={handleStateChange} 
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium"
                >
                  <option value="">Select State</option>
                  {indianStates.map((st) => (
                    <option key={st.isoCode} value={st.isoCode}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">City / District *</label>
                <select 
                  name="city" 
                  required 
                  disabled={!selectedStateCode}
                  value={formData.city} 
                  onChange={handleCityChange} 
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 font-medium"
                >
                  <option value="">Select City</option>
                  {citiesOfSelectedState.map((ct) => (
                    <option key={ct.name} value={ct.name}>
                      {ct.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">
                  Pincode * {fetchingDetails && <span className="text-amber-500 ml-1">(Fetching details...)</span>}
                </label>
                {availablePincodes.length > 0 ? (
                  <select
                    name="pincode"
                    required
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] font-medium"
                  >
                    <option value="">Select Area Pincode</option>
                    {availablePincodes.map((pin) => (
                      <option key={pin} value={pin}>{pin}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    name="pincode" 
                    maxLength={6} 
                    required 
                    value={formData.pincode} 
                    onChange={handleChange} 
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]" 
                    placeholder="Enter 6-digit Pincode" 
                  />
                )}
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">GST Number</label>
                <input
                  type="text"
                  name="gstNo"
                  value={formData.gstNo}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)] font-mono"
                  placeholder="27AAAAA0000A1Z5 (Optional)"
                />
              </div>
            </div>
          </div>

          <hr className="border-[var(--color-border)]" />

          {/* Section 2: Package & Pricing */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">2. Billing & Package</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Validity Package</label>
                <select
                  name="packageValidity"
                  value={formData.packageValidity}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)] cursor-pointer font-medium"
                >
                  <option value="6 Months">6 Months</option>
                  <option value="1 Year">1 Year</option>
                  <option value="2 Years">2 Years</option>
                  <option value="Lifetime">Lifetime</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Base Price (₹)</label>
                <input
                  type="number"
                  name="baseAmount"
                  value={formData.baseAmount}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                />
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Previous Due Balance (₹)</label>
                <input
                  type="number"
                  name="previousDueBalance"
                  value={formData.previousDueBalance}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)] font-semibold text-amber-600"
                  placeholder="0"
                />
              </div>
            </div>

            {/* 🌟 Payment Mode Selector & Details */}
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
              <label className="block text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                💳 Payment Mode & Reference
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium mb-1 text-[var(--color-heading)]">Payment Mode *</label>
                  <select
                    name="paymentMode"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 outline-none text-[var(--color-heading)] font-medium cursor-pointer"
                  >
                    <option value="ONLINE">📱 Online UPI / Bank Transfer (UTR)</option>
                    <option value="CASH">💵 Cash (Receipt Voucher)</option>
                    <option value="CHEQUE">🏦 Cheque</option>
                  </select>
                </div>

                {formData.paymentMode === 'ONLINE' && (
                  <div>
                    <label className="block font-medium mb-1 text-[var(--color-heading)]">UPI UTR / Ref Number *</label>
                    <input
                      type="text"
                      name="utrNumber"
                      required
                      value={formData.utrNumber}
                      onChange={handleChange}
                      placeholder="Enter UTR transaction ID"
                      className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 outline-none text-[var(--color-heading)] font-mono"
                    />
                  </div>
                )}

                {formData.paymentMode === 'CASH' && (
                  <div>
                    <label className="block font-medium mb-1 text-[var(--color-heading)]">Cash Receipt Voucher No *</label>
                    <input
                      type="text"
                      name="receiptNo"
                      required
                      value={formData.receiptNo}
                      onChange={handleChange}
                      placeholder="Voucher #102"
                      className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 outline-none text-[var(--color-heading)]"
                    />
                  </div>
                )}

                {formData.paymentMode === 'CHEQUE' && (
                  <>
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Cheque Number *</label>
                      <input
                        type="text"
                        name="chequeNo"
                        required
                        value={formData.chequeNo}
                        onChange={handleChange}
                        placeholder="Cheque No"
                        className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 outline-none text-[var(--color-heading)]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-[var(--color-heading)]">Bank Name *</label>
                      <input
                        type="text"
                        name="bankName"
                        required
                        value={formData.bankName}
                        onChange={handleChange}
                        placeholder="HDFC Bank"
                        className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 outline-none text-[var(--color-heading)]"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Addon Checkboxes */}
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-3">
              <label className="block text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                🎁 Select Add-on Packages
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[var(--color-heading)]">
                <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition">
                  <input
                    type="checkbox"
                    name="testModule"
                    checked={addons.testModule}
                    onChange={handleAddonChange}
                    className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer"
                  />
                  <span>Test Series Module <strong className="text-[var(--color-primary)] font-semibold">(+₹5,000)</strong></span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition">
                  <input
                    type="checkbox"
                    name="windowApp"
                    checked={addons.windowApp}
                    onChange={handleAddonChange}
                    className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer"
                  />
                  <span>Windows Desktop App <strong className="text-[var(--color-primary)] font-semibold">(+₹5,000)</strong></span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition">
                  <input
                    type="checkbox"
                    name="iosApp"
                    checked={addons.iosApp}
                    onChange={handleAddonChange}
                    className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer"
                  />
                  <span>iOS Mobile App <strong className="text-[var(--color-primary)] font-semibold">(+₹45,000)</strong></span>
                </label>
              </div>
            </div>

            {/* Coupon Code Section */}
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl space-y-2">
              <label className="block text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                🏷️ Apply Promo / Coupon Code
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={couponInput}
                  disabled={isCouponApplied}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter Coupon (e.g. CRINZA)" 
                  className="uppercase flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-60 font-mono font-bold"
                />
                {!isCouponApplied ? (
                  <button 
                    type="button" 
                    onClick={handleApplyCoupon}
                    className="bg-[var(--color-primary)] hover:opacity-90 text-white text-xs px-5 py-2.5 rounded-xl transition font-semibold cursor-pointer shadow-sm"
                  >
                    Apply
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleRemoveCoupon}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs px-5 py-2.5 rounded-xl transition font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
              {isCouponApplied && couponDetails && (
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  🎉 Coupon "{couponDetails.code}" applied! {couponDetails.discountType === 'percentage' ? `${couponDetails.discountValue}%` : `₹${couponDetails.discountValue}`} discount added.
                </p>
              )}
            </div>

            {/* Price Breakdown Banner */}
            <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] space-y-2 text-xs text-[var(--color-heading)]">
              <div className="flex justify-between">
                <span className="text-[var(--color-body)]">Subtotal (Base + Add-ons {isCouponApplied ? '- Discount' : ''}):</span>
                <span className="font-medium">₹{formData.subtotalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-body)]">GST (18%):</span>
                <span className="font-medium">₹{formData.gstAmount.toLocaleString('en-IN')}</span>
              </div>
              {formData.previousDueBalance > 0 && (
                <div className="flex justify-between text-amber-600 font-semibold">
                  <span>Previous Due Balance Added:</span>
                  <span>+₹{formData.previousDueBalance.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)] text-sm">
                <span className="font-bold text-[var(--color-heading)]">Grand Total:</span>
                <span className="text-base font-extrabold text-[var(--color-primary)]">
                  ₹{formData.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Payment Proof File Upload */}
            <div className="p-4 bg-[var(--color-surface)] border border-dashed border-[var(--color-primary)]/40 rounded-2xl space-y-2">
              <label className="block text-xs font-semibold text-[var(--color-heading)]">
                📸 Payment Proof / Screenshot *
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleFileChange}
                className="block w-full text-xs text-[var(--color-body)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90 cursor-pointer"
              />
            </div>

            {/* Paid & Due Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Paid Amount (₹) *</label>
                <input
                  type="number"
                  name="paidAmount"
                  required
                  value={formData.paidAmount}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-emerald-600 font-bold"
                />
              </div>
              <div>
                <label className="block font-medium mb-1.5 text-[var(--color-heading)]">Calculated Due Balance (₹)</label>
                <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 font-bold text-red-500">
                  ₹{dueAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          <hr className="border-[var(--color-border)]" />

          {/* Section 3: T&C */}
          <div className="space-y-2 text-xs">
            <label className="block font-medium text-[var(--color-heading)]">Terms and Conditions</label>
            <textarea
              name="termsAndConditions"
              rows="3"
              value={formData.termsAndConditions}
              onChange={handleChange}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)] text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-heading)] font-semibold py-3.5 rounded-2xl transition cursor-pointer border border-[var(--color-border)] text-xs"
            >
              👁️ Preview Invoice Summary
            </button>
            <button
              type="submit"
              disabled={status.loading}
              className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition duration-200 cursor-pointer disabled:opacity-50 shadow-sm text-xs"
            >
              {status.loading ? 'Submitting Request...' : 'Generate & Send Invoice'}
            </button>
          </div>
        </form>

        {/* 🌟 LIVE INVOICE PREVIEW MODAL */}
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl max-w-lg w-full p-6 md:p-8 text-[var(--color-heading)] space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-extrabold text-[var(--color-primary)]">
                  📄 Live Invoice Preview
                </h3>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-xs text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)]">
                <div className="flex justify-between">
                  <span className="text-[var(--color-body)]">Institute:</span>
                  <strong className="text-[var(--color-heading)]">{formData.instituteName || 'Not entered'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-body)]">App Name:</span>
                  <strong className="text-[var(--color-heading)]">{formData.appName || 'Not entered'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-body)]">Client Email:</span>
                  <strong className="text-[var(--color-heading)]">{formData.email || 'Not entered'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-body)]">Validity:</span>
                  <strong>{formData.packageValidity}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-body)]">Payment Mode:</span>
                  <strong>{formData.paymentMode}</strong>
                </div>
              </div>

              <div className="space-y-2 text-xs bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)]">
                <div className="flex justify-between">
                  <span>Base Amount:</span>
                  <span>₹{formData.baseAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal (After Discount):</span>
                  <span>₹{formData.subtotalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (18%):</span>
                  <span>₹{formData.gstAmount.toLocaleString('en-IN')}</span>
                </div>
                {formData.previousDueBalance > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Previous Due Balance:</span>
                    <span>+₹{formData.previousDueBalance.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-sm font-extrabold text-[var(--color-primary)]">
                  <span>Grand Total:</span>
                  <span>₹{formData.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Paid Amount:</span>
                  <span>₹{formData.paidAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-red-500 font-bold">
                  <span>Due Balance:</span>
                  <span>₹{dueAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                onClick={() => setShowPreviewModal(false)}
                className="w-full bg-[var(--color-primary)] text-white py-3 rounded-2xl font-semibold text-xs cursor-pointer shadow-sm transition"
              >
                Close Preview & Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceForm;