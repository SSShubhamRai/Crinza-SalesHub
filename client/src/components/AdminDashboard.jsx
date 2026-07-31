import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const AdminDashboard = ({ userId, onLogout }) => {
  const API_BASE = process.env.NODE_ENV === "production"
    ? "https://rapidbill-f143.onrender.com"
    : "http://localhost:5000";

  const [activeTab, setActiveTab] = useState('performance');
  const [employees, setEmployees] = useState([]);
  const [performanceStats, setPerformanceStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedEmpLogs, setSelectedEmpLogs] = useState(null);
  const [loadingLogs, setLoadingLoadingLogs] = useState(false);

  // New Employee Form State
  const [newEmp, setNewEmp] = useState({ userId: '', name: '', email: '', password: '', role: 'salesperson' });
  const [empStatus, setEmpStatus] = useState({ success: '', error: '' });

  const [transferData, setTransferData] = useState({ fromSalesperson: '', toSalesperson: '' });
  const [transferStatus, setTransferStatus] = useState({ success: '', error: '' });

  // 🎫 New Coupon Generator State
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage', // 'percentage' or 'flat'
    discountValue: '',
    expiryDate: '',
    usageLimit: ''
  });
  const [couponStatus, setCouponStatus] = useState({ success: '', error: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const empRes = await fetch(`${API_BASE}/api/boss/employees`, { headers });
      const empList = await empRes.json();
      setEmployees(empList);

      const statsRes = await fetch(`${API_BASE}/api/boss/performance`, { headers });
      const stats = await statsRes.json();
      setPerformanceStats(stats);

      // Fetch existing coupons
      const couponRes = await fetch(`${API_BASE}/api/boss/coupons`, { headers });
      if (couponRes.ok) {
        const couponList = await couponRes.json();
        setCoupons(couponList);
      }
    } catch (err) {
      console.error('Failed to fetch Admin Data:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleViewEmployeeDetails = async (empUserId) => {
    setLoadingLoadingLogs(true);
    setSelectedEmpLogs({ userId: empUserId, deals: [] });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/boss/employee-details/${empUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dealsData = await res.json();
      setSelectedEmpLogs({ userId: empUserId, deals: dealsData });
    } catch (err) {
      console.error('Error fetching employee logs:', err);
      toast.error('Failed to fetch activity logs');
    } finally {
      setLoadingLoadingLogs(false);
    }
  };

  // Handle Add Salesperson / Accountant
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setEmpStatus({ success: '', error: '' });

    if (!newEmp.name.trim() || !newEmp.email.trim()) {
      setEmpStatus({ success: '', error: 'Name and Email are required!' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/auth/create-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newEmp),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Creation failed');

      const successMsg = `${newEmp.role === 'accountant' ? 'Accountant' : 'Salesperson'} ${newEmp.name} created successfully!`;
      toast.success(successMsg);
      setEmpStatus({ success: successMsg, error: '' });
      setNewEmp({ userId: '', name: '', email: '', password: '', role: 'salesperson' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
      setEmpStatus({ success: '', error: err.message });
    }
  };

  const handleDeleteEmployee = async (empId, empUserId) => {
    if (!window.confirm(`Are you sure you want to remove user "${empUserId}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/boss/delete-employee/${empId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(`Account ${empUserId} removed!`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const handleTransferLeads = async (e) => {
    e.preventDefault();
    if (transferData.fromSalesperson === transferData.toSalesperson) {
      setTransferStatus({ success: '', error: 'Select two different Salespersons to transfer!' });
      return;
    }

    setTransferStatus({ success: '', error: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/boss/transfer-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(transferData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(data.message);
      setTransferStatus({ success: data.message, error: '' });
      setTransferData({ fromSalesperson: '', toSalesperson: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
      setTransferStatus({ success: '', error: err.message });
    }
  };

  // 🎫 Handle Create Coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setCouponStatus({ success: '', error: '' });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/boss/create-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newCoupon),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate coupon');

      const successMsg = `Coupon "${newCoupon.code.toUpperCase()}" generated successfully!`;
      toast.success(successMsg);
      setCouponStatus({ success: successMsg, error: '' });
      setNewCoupon({ code: '', discountType: 'percentage', discountValue: '', expiryDate: '', usageLimit: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
      setCouponStatus({ success: '', error: err.message });
    }
  };

  // 🗑️ Handle Delete Coupon
  const handleDeleteCoupon = async (couponId, couponCode) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${couponCode}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/boss/coupons/${couponId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete coupon');

      toast.success(`Coupon ${couponCode} deleted successfully!`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete coupon');
    }
  };

  // Calculate maximum business value for visual chart scaling
  const maxBusiness = performanceStats.length > 0 
    ? Math.max(...performanceStats.map(s => s.totalBusiness || 1), 1000) 
    : 1000;

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-border)] pb-5 gap-4">
          <div>
            <span className="text-xs bg-purple-500/10 text-purple-600 px-3 py-1 rounded-full font-semibold border border-purple-200">
              👑 ADMIN PORTAL
            </span>
            <h1 className="text-2xl font-bold text-[var(--color-heading)] mt-1">Company Operations Dashboard</h1>
            <p className="text-[var(--color-body)] text-xs">Logged in as Admin: <strong className="text-[var(--color-primary)]">{userId}</strong></p>
          </div>
          <button onClick={onLogout} className="bg-red-500/15 hover:bg-red-500/20 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer">
            Logout
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${activeTab === 'performance' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-[var(--color-card)] text-[var(--color-heading)] hover:bg-[var(--color-surface)]'}`}
          >
            📊 Salesperson Performance & Charts
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${activeTab === 'employees' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-[var(--color-card)] text-[var(--color-heading)] hover:bg-[var(--color-surface)]'}`}
          >
            👥 Manage Team (Add/Remove)
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${activeTab === 'transfer' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-[var(--color-card)] text-[var(--color-heading)] hover:bg-[var(--color-surface)]'}`}
          >
            🔄 Transfer Leads / Invoices
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${activeTab === 'coupons' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-[var(--color-card)] text-[var(--color-heading)] hover:bg-[var(--color-surface)]'}`}
          >
            🎟️ Discount Coupons
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-48 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-40 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]"></div>
              <div className="h-40 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]"></div>
              <div className="h-40 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]"></div>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: PERFORMANCE & VISUAL ANALYTICS */}
            {activeTab === 'performance' && (
              <div className="space-y-6">
                
                {/* 📈 Visual Analytics Revenue Chart Section */}
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--color-heading)]">📈 Revenue & Sales Analytics</h3>
                      <p className="text-xs text-[var(--color-body)]">Visual comparison of total generated business across salespersons</p>
                    </div>
                    <span className="text-xs bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full font-semibold border border-emerald-200">
                      Live Stats
                    </span>
                  </div>

                  {performanceStats.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--color-body)]">No sales analytics data available.</div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      {performanceStats.map((stat) => {
                        const percentage = Math.min(100, Math.max(8, ((stat.totalBusiness || 0) / maxBusiness) * 100));
                        return (
                          <div key={stat.salespersonId} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-[var(--color-heading)]">
                              <span>👤 {stat.salespersonId} ({stat.approvedDeals} Approved Deals)</span>
                              <span className="text-[var(--color-primary)]">₹{(stat.totalBusiness || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="w-full bg-[var(--color-surface)] h-4 rounded-full overflow-hidden border border-[var(--color-border)] p-0.5">
                              <div 
                                className="bg-gradient-to-r from-[var(--color-primary)] to-purple-600 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-bold text-[var(--color-heading)]">Salesperson Detailed Cards</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performanceStats.map((stat) => (
                    <div key={stat.salespersonId} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-3">
                      <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-2">
                        <h4 className="font-bold text-[var(--color-primary)] text-lg">{stat.salespersonId}</h4>
                        <span className="text-xs bg-[var(--color-surface)] px-2.5 py-1 rounded-md border border-[var(--color-border)] font-medium">
                          {stat.totalDeals} Deals Created
                        </span>
                      </div>
                      <div className="text-xs space-y-1.5 text-[var(--color-heading)]">
                        <div className="flex justify-between"><span>Approved Deals:</span> <strong className="text-emerald-600">{stat.approvedDeals}</strong></div>
                        <div className="flex justify-between"><span>Pending Approval:</span> <strong className="text-amber-600">{stat.pendingDeals}</strong></div>
                        <div className="flex justify-between"><span>Rejected Deals:</span> <strong className="text-red-500">{stat.rejectedDeals}</strong></div>
                      </div>
                      <div className="bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)] text-xs space-y-1">
                        <div className="flex justify-between"><span>Total Revenue:</span> <strong>₹{stat.totalBusiness?.toLocaleString('en-IN') || 0}</strong></div>
                        <div className="flex justify-between text-emerald-600"><span>Collected:</span> <strong>₹{stat.totalPaid?.toLocaleString('en-IN') || 0}</strong></div>
                      </div>
                      <button
                        onClick={() => handleViewEmployeeDetails(stat.salespersonId)}
                        className="w-full bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 border border-purple-200 text-xs py-2 rounded-xl font-semibold transition cursor-pointer"
                      >
                        🔍 View Full Activity & Location Logs
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: MANAGE TEAM */}
            {activeTab === 'employees' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-md font-bold text-[var(--color-primary)] uppercase tracking-wider">➕ Add Team Member</h3>
                  {empStatus.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3 rounded-xl text-xs">{empStatus.success}</div>}
                  {empStatus.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-xs">{empStatus.error}</div>}
                  <form onSubmit={handleAddEmployee} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Account Type / Role *</label>
                      <select
                        value={newEmp.role}
                        onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)] font-semibold"
                      >
                        <option value="salesperson">👤 Salesperson</option>
                        <option value="accountant">📑 Accountant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={newEmp.name}
                        onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. rahul@crinza.com"
                        value={newEmp.email}
                        onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">User ID / Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. EMP105"
                        value={newEmp.userId}
                        onChange={(e) => setNewEmp({ ...newEmp, userId: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Password *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Pass@123"
                        value={newEmp.password}
                        onChange={(e) => setNewEmp({ ...newEmp, password: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)]"
                      />
                    </div>
                    <button type="submit" className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold py-2.5 rounded-xl transition cursor-pointer shadow-md">
                      Create Account
                    </button>
                  </form>
                </div>

                <div className="md:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-md font-bold text-[var(--color-heading)]">Active Team Members ({employees.length})</h3>
                  <div className="divide-y divide-[var(--color-border)]">
                    {employees.map((emp) => (
                      <div key={emp._id} className="py-3 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-[var(--color-heading)] text-sm">{emp.name || emp.userId}</strong>
                            <span className="text-xs text-[var(--color-body)]">({emp.userId})</span>
                            <span className={`text-xs px-2 py-0.5 rounded-md uppercase font-semibold ${emp.role === 'accountant' ? 'bg-amber-500/10 text-amber-600 border border-amber-200' : 'bg-blue-500/10 text-blue-600 border border-blue-200'}`}>
                              {emp.role}
                            </span>
                          </div>
                          {emp.email && <p className="text-xs text-[var(--color-body)] mt-0.5">{emp.email}</p>}
                        </div>
                        <div className="flex gap-2">
                          {emp.role === 'salesperson' && (
                            <button
                              onClick={() => handleViewEmployeeDetails(emp.userId)}
                              className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 text-xs px-3 py-1.5 rounded-lg border border-purple-200 transition cursor-pointer font-medium"
                            >
                              👁️ History
                            </button>
                          )}
                          {emp.userId !== userId && (
                            <button
                              onClick={() => handleDeleteEmployee(emp._id, emp.userId)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 text-xs px-3 py-1.5 rounded-lg transition cursor-pointer font-medium"
                            >
                              ❌ Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TRANSFER LEADS */}
            {activeTab === 'transfer' && (
              <div className="max-w-2xl mx-auto bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-primary)]">🔄 Transfer Leads & Invoices</h3>
                  <p className="text-xs text-[var(--color-body)] mt-1">Reassign all deal records created by one salesperson to another salesperson.</p>
                </div>
                {transferStatus.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3 rounded-xl text-xs">{transferStatus.success}</div>}
                {transferStatus.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-xs">{transferStatus.error}</div>}
                <form onSubmit={handleTransferLeads} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">From Salesperson (Source) *</label>
                    <select
                      required
                      value={transferData.fromSalesperson}
                      onChange={(e) => setTransferData({ ...transferData, fromSalesperson: e.target.value })}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-sm text-[var(--color-heading)]"
                    >
                      <option value="">Select Salesperson to take leads from</option>
                      {employees.filter(emp => emp.role === 'salesperson').map((emp) => (
                        <option key={emp.userId} value={emp.userId}>{emp.name ? `${emp.name} (${emp.userId})` : emp.userId}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--color-heading)]">To Salesperson (Target) *</label>
                    <select
                      required
                      value={transferData.toSalesperson}
                      onChange={(e) => setTransferData({ ...transferData, toSalesperson: e.target.value })}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 text-sm text-[var(--color-heading)]"
                    >
                      <option value="">Select Salesperson to assign leads to</option>
                      {employees.filter(emp => emp.role === 'salesperson').map((emp) => (
                        <option key={emp.userId} value={emp.userId}>{emp.name ? `${emp.name} (${emp.userId})` : emp.userId}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3 rounded-xl transition cursor-pointer shadow-md">
                    Execute Lead Transfer
                  </button>
                </form>
              </div>
            )}

            {/* TAB 4: COUPON MANAGEMENT */}
            {activeTab === 'coupons' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-md font-bold text-[var(--color-primary)] uppercase tracking-wider">🎟️ Generate Coupon</h3>
                  {couponStatus.success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 p-3 rounded-xl text-xs">{couponStatus.success}</div>}
                  {couponStatus.error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-xs">{couponStatus.error}</div>}
                  <form onSubmit={handleCreateCoupon} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Coupon Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. FESTIVE50"
                        value={newCoupon.code}
                        onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                        className="w-full uppercase bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Discount Type *</label>
                      <select
                        value={newCoupon.discountType}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)]"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">
                        {newCoupon.discountType === 'percentage' ? 'Percentage Value (e.g. 10) *' : 'Amount in Rupees (e.g. 500) *'}
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder={newCoupon.discountType === 'percentage' ? '10' : '500'}
                        value={newCoupon.discountValue}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--color-heading)]">Expiry Date (Optional)</label>
                      <input
                        type="date"
                        value={newCoupon.expiryDate}
                        onChange={(e) => setNewCoupon({ ...newCoupon, expiryDate: e.target.value })}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2.5 text-sm text-[var(--color-heading)]"
                      />
                    </div>
                    <button type="submit" className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold py-2.5 rounded-xl transition cursor-pointer shadow-md">
                      Generate & Save Coupon
                    </button>
                  </form>
                </div>

                <div className="md:col-span-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-md font-bold text-[var(--color-heading)]">Active Discount Coupons ({coupons.length})</h3>
                  {coupons.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--color-body)] bg-[var(--color-surface)] rounded-xl">
                      No active discount coupons generated yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)]">
                      {coupons.map((coupon) => (
                        <div key={coupon._id} className="py-3 flex justify-between items-center text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded border border-purple-200">
                                {coupon.code}
                              </span>
                              <span className="text-[var(--color-heading)] font-semibold">
                                {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                              </span>
                            </div>
                            <p className="text-[var(--color-body)] mt-1">
                              Expires: {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString() : 'No Expiry'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-md font-medium">
                              Active
                            </span>
                            <button
                              onClick={() => handleDeleteCoupon(coupon._id, coupon.code)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg transition cursor-pointer font-medium"
                            >
                              ❌ Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL VIEW WITH LIVE GPS VERIFICATION */}
        {selectedEmpLogs && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-3xl w-full p-6 text-[var(--color-heading)] space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <div>
                  <h3 className="text-xl font-bold text-[var(--color-primary)]">
                    Salesperson Activity & Location Report
                  </h3>
                  <p className="text-xs text-[var(--color-body)]">Salesperson ID: <strong>{selectedEmpLogs.userId}</strong></p>
                </div>
                <button onClick={() => setSelectedEmpLogs(null)} className="text-[var(--color-body)] hover:text-[var(--color-heading)] text-lg cursor-pointer">✕</button>
              </div>

              {loadingLogs ? (
                <div className="py-8 text-center text-sm text-[var(--color-body)]">Fetching full activity logs...</div>
              ) : selectedEmpLogs.deals.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--color-body)] bg-[var(--color-surface)] rounded-xl">
                  No deals or visit records submitted by this salesperson yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--color-body)]">Showing all <strong>{selectedEmpLogs.deals.length}</strong> deal(s) created by this salesperson:</p>
                  
                  <div className="space-y-3">
                    {selectedEmpLogs.deals.map((deal) => (
                      <div key={deal._id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-xl space-y-2 text-xs">
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--color-border)] pb-2">
                          <span className="text-sm font-bold text-[var(--color-heading)]">{deal.instituteName} ({deal.appName})</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold uppercase ${deal.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-300' : deal.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-200' : 'bg-amber-500/10 text-amber-600 border border-amber-200'}`}>
                            {deal.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-heading)]">
                          <div>📍 <strong>Manual Address:</strong> {deal.address || 'N/A'}</div>
                          <div>🏙️ <strong>City & State:</strong> {deal.city || 'N/A'}, {deal.state || 'N/A'}</div>
                          <div>📮 <strong>Pincode:</strong> {deal.pincode || 'N/A'}</div>
                          <div>📞 <strong>Contact:</strong> {deal.mobileNo} | {deal.email}</div>
                        </div>

                        {/* GPS Location Google Maps Direct Link */}
                        {deal.latitude && deal.longitude ? (
                          <div className="bg-emerald-500/10 border border-emerald-300 p-3 rounded-xl flex items-center justify-between text-xs mt-2">
                            <span className="text-emerald-800 font-medium">
                              🛰️ <strong>Verified GPS Location:</strong> {deal.latitude.toFixed(5)}, {deal.longitude.toFixed(5)}
                            </span>
                            <a
                              href={`https://www.google.com/maps?q=${deal.latitude},${deal.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-sm"
                            >
                              🗺️ Open in Google Maps
                            </a>
                          </div>
                        ) : (
                          <div className="bg-amber-500/10 border border-amber-200 p-2.5 rounded-xl text-amber-700 text-xs mt-2 font-medium">
                            ⚠️ GPS Coordinates were not captured for this deal submission.
                          </div>
                        )}

                        <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--color-border)]/60 text-xs">
                          <span>Total: <strong>₹{deal.totalAmount}</strong></span>
                          <span className="text-emerald-600">Paid: <strong>₹{deal.paidAmount}</strong></span>
                          <span className="text-red-500">Due: <strong>₹{deal.dueAmount}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setSelectedEmpLogs(null)} className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-border)] py-2.5 rounded-xl font-medium text-sm border border-[var(--color-border)] mt-2 cursor-pointer">
                Close Report
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;