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
    totalAmount: 15000,
    paidAmount: 0,
    couponCode: '',
    discountAmount: 0,
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

  // Recalculate Total whenever baseAmount, addons, or coupon changes
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

  // Auto-calculated Due Amount
  const dueAmount = Math.max(0, formData.totalAmount - formData.paidAmount);

  // Apply Coupon Handler via API (Database Connected)
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setCouponError('');
    try {
      const token = localStorage.getItem('token');
      const API_BASE = process.env.NODE_ENV === "production"
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
      [name]: name === 'baseAmount' || name === 'paidAmount' ? Number(value) : value,
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
      <div className="max-w-4xl mx-auto">
        {/* Top Header */}
        <div className="flex justify-between items-center mb-8 border-b border-[var(--color-border)] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-heading)]">Invoice Generator</h1>
            <p className="text-[var(--color-body)] text-sm">Create and dispatch automated PDF invoice via email</p>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Logout
          </button>
        </div>

        {/* Status Alerts */}
        {status.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-4 rounded-xl mb-6 flex justify-between items-center">
            <span>{status.success}</span>
          </div>
        )}
        {status.error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl mb-6">
            {status.error}
          </div>
        )}

        {/* Invoice Form */}
        <form onSubmit={handleSubmit} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          
          {/* Section 1: Client Information */}
          <div>
            <h3 className="text-md font-semibold text-[var(--color-primary)] uppercase tracking-wider mb-4">1. Client Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Institute Name *</label>
                <input
                  type="text"
                  name="instituteName"
                  required
                  value={formData.instituteName}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="Apex Academy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">App Name *</label>
                <input
                  type="text"
                  name="appName"
                  required
                  value={formData.appName}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="Apex Learning App"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Mobile Number *</label>
                <input
                  type="tel"
                  name="mobileNo"
                  required
                  value={formData.mobileNo}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Client Email (Invoice Recipient) *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="client@gmail.com"
                />
              </div>

              {/* Full Street Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Street Address / Landmark *</label>
                <textarea 
                  name="address" 
                  rows="2" 
                  required 
                  value={formData.address} 
                  onChange={handleChange} 
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]" 
                  placeholder="Office No. 101, ABC Commercial Complex, Main Road"
                />
              </div>

              {/* State Select Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">State *</label>
                <select 
                  name="state" 
                  required 
                  value={selectedStateCode} 
                  onChange={handleStateChange} 
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">Select State</option>
                  {indianStates.map((st) => (
                    <option key={st.isoCode} value={st.isoCode}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* City Select Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">City / District *</label>
                <select 
                  name="city" 
                  required 
                  disabled={!selectedStateCode}
                  value={formData.city} 
                  onChange={handleCityChange} 
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                >
                  <option value="">Select City</option>
                  {citiesOfSelectedState.map((ct) => (
                    <option key={ct.name} value={ct.name}>
                      {ct.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pincode Input / Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">
                  Pincode * {fetchingDetails && <span className="text-xs text-amber-500 ml-1">(Fetching details...)</span>}
                </label>
                {availablePincodes.length > 0 ? (
                  <select
                    name="pincode"
                    required
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)]"
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
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]" 
                    placeholder="Enter 6-digit Pincode" 
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">GST Number</label>
                <input
                  type="text"
                  name="gstNo"
                  value={formData.gstNo}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                  placeholder="27AAAAA0000A1Z5 (Optional)"
                />
              </div>
            </div>
          </div>

          <hr className="border-[var(--color-border)]" />

          {/* Section 2: Package & Pricing */}
          <div>
            <h3 className="text-md font-semibold text-[var(--color-primary)] uppercase tracking-wider mb-4">2. Billing & Package</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Validity Package</label>
                <select
                  name="packageValidity"
                  value={formData.packageValidity}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)] cursor-pointer"
                >
                  <option value="6 Months">6 Months</option>
                  <option value="1 Year">1 Year</option>
                  <option value="2 Years">2 Years</option>
                  <option value="Lifetime">Lifetime</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Base Price (₹)</label>
                <input
                  type="number"
                  name="baseAmount"
                  value={formData.baseAmount}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Total Price (₹)</label>
                <input
                  type="number"
                  readOnly
                  name="totalAmount"
                  value={formData.totalAmount}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-[var(--color-heading)] font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Paid Amount (₹)</label>
                <input
                  type="number"
                  name="paidAmount"
                  value={formData.paidAmount}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)]"
                />
              </div>
            </div>

            {/* Addon Checkboxes */}
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-4">
              <label className="block text-xs font-semibold mb-3 text-[var(--color-primary)] uppercase tracking-wider">
                🎁 Select Add-on Packages
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-[var(--color-heading)]">
                <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-light)] transition">
                  <input
                    type="checkbox"
                    name="testModule"
                    checked={addons.testModule}
                    onChange={handleAddonChange}
                    className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer"
                  />
                  <span>Test Series Module <strong className="text-[var(--color-primary)] font-semibold">(+₹5,000)</strong></span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-light)] transition">
                  <input
                    type="checkbox"
                    name="windowApp"
                    checked={addons.windowApp}
                    onChange={handleAddonChange}
                    className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer"
                  />
                  <span>Windows Desktop App <strong className="text-[var(--color-primary)] font-semibold">(+₹5,000)</strong></span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--color-card)] p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-light)] transition">
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
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-4">
              <label className="block text-xs font-semibold mb-2 text-[var(--color-primary)] uppercase tracking-wider">
                🏷️ Apply Promo / Coupon Code
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={couponInput}
                  disabled={isCouponApplied}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter Coupon (e.g. FLAT50)" 
                  className="uppercase flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
                />
                {!isCouponApplied ? (
                  <button 
                    type="button" 
                    onClick={handleApplyCoupon}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm px-4 py-2.5 rounded-xl transition font-medium cursor-pointer"
                  >
                    Apply
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleRemoveCoupon}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 text-sm px-4 py-2.5 rounded-xl transition font-medium cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              {couponError && <p className="text-xs text-red-500 mt-1.5">{couponError}</p>}
              {isCouponApplied && couponDetails && (
                <p className="text-xs text-emerald-600 font-medium mt-1.5">
                  🎉 Coupon "{couponDetails.code}" applied! {couponDetails.discountType === 'percentage' ? `${couponDetails.discountValue}%` : `₹${couponDetails.discountValue}`} discount added.
                </p>
              )}
            </div>

            {/* Payment Proof File Upload */}
            <div className="p-4 bg-[var(--color-surface)] border border-dashed border-[var(--color-primary)]/40 rounded-xl">
              <label className="block text-sm font-medium mb-2 text-[var(--color-heading)]">
                📸 Payment Proof / Screenshot *
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleFileChange}
                className="block w-full text-sm text-[var(--color-body)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90 cursor-pointer"
              />
            </div>

            {/* Auto Calculated Balance Banner */}
            <div className="mt-4 bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] flex justify-between items-center">
              <span className="text-[var(--color-body)] text-sm">Calculated Due Amount:</span>
              <span className={`text-xl font-bold ${dueAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                ₹{dueAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <hr className="border-[var(--color-border)]" />

          {/* Section 3: T&C */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-heading)]">Terms and Conditions</label>
            <textarea
              name="termsAndConditions"
              rows="3"
              value={formData.termsAndConditions}
              onChange={handleChange}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 outline-none focus:border-[var(--color-primary)] text-[var(--color-heading)] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={status.loading}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3.5 rounded-xl transition duration-200 cursor-pointer disabled:opacity-50 shadow-md shadow-[var(--color-primary)]/20"
          >
            {status.loading ? 'Submitting Request...' : 'Generate & Send Invoice Request'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InvoiceForm;