/**
 * =========================================================================
 * 🚀 CRINZA INVOICE & LEAD MANAGEMENT SYSTEM - BACKEND SERVER (`server.js`)
 * =========================================================================
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// --- Security & Validation Package Imports ---
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet'); 
const xss = require('xss-clean'); // 🛡️ XSS Attack Protection

// --- Model & Middleware Imports ---
const User = require('./models/User');
const Invoice = require('./models/Invoice');
const Lead = require('./models/Lead');
const Coupon = require('./models/Coupon'); 
const verifyToken = require('./middleware/authMiddleware');

const app = express();

// --- Security & Proxy Setup ---
app.set('trust proxy', 1); // 🌟 Fixes Render proxy rate limit error
app.use(helmet()); 
app.use(cors());
app.use(express.json());

// 🛡️ Fix for Express 5 read-only req.query getter issue with sanitizers
app.use((req, res, next) => {
  if (req.query) {
    try {
      Object.defineProperty(req, 'query', {
        value: { ...req.query },
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (e) {}
  }
  next();
});

app.use(xss()); // Cleans malicious HTML/Script injections from request data

// --- File Uploads Directory Setup ---
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Multer Storage Engine Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// --- Rate Limiter Configuration (Brute Force Protection for Login) ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// =========================================================================
// --- 📋 TASK / CALL / DEMO TRACKING SCHEMA ---
// =========================================================================
const taskSchema = new mongoose.Schema({
  salespersonId: { type: String, required: true },
  instituteName: { type: String, required: true },
  taskType: { type: String, enum: ['call', 'demo', 'followup', 'pending'], required: true },
  notes: { type: String },
  dueDate: { type: String },
  status: { type: String, default: 'pending' }, // 'pending' or 'completed'
  createdAt: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', taskSchema);

// =========================================================================
// --- 📄 PDF GENERATOR HELPER (Smart Dual Mode: Local & Cloud) ---
// =========================================================================
const createInvoicePDF = async (data) => {
  let browser;
  try {
    const logoPngPath = path.join(__dirname, 'uploads', 'logo.png');
    const logoJpgPath = path.join(__dirname, 'uploads', 'logo.jpg');
    let logoBase64 = '';

    if (fs.existsSync(logoPngPath)) {
      const logoBuffer = fs.readFileSync(logoPngPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } else if (fs.existsSync(logoJpgPath)) {
      const logoBuffer = fs.readFileSync(logoJpgPath);
      logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
    }

    const isLocal = process.env.NODE_ENV !== 'production' && !process.env.RENDER;

    if (isLocal) {
      // 💻 Localhost / Development Mode
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });
    } else {
      // ☁️ Render / Production Cloud Mode (Fixed property access for chromium executablePath)
      const chromium = require('@sparticuz/chromium');
      const puppeteerCore = require('puppeteer-core');
      
      chromium.setHeadlessMode = true;
      chromium.setGraphicsMode = false;

      const execPath = await chromium.executablePath();

      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: execPath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    }

    const page = await browser.newPage();

    let addonRows = '';
    if (data.addons) {
      if (data.addons.testModule) addonRows += `<tr><td>Add-on: Test Series Module</td><td>Included</td><td>₹5,000</td></tr>`;
      if (data.addons.windowApp) addonRows += `<tr><td>Add-on: Windows Desktop App</td><td>Included</td><td>₹5,000</td></tr>`;
      if (data.addons.iosApp) addonRows += `<tr><td>Add-on: iOS Mobile App</td><td>Included</td><td>₹45,000</td></tr>`;
    }

    let discountRow = '';
    if (data.discountAmount && data.discountAmount > 0) {
      discountRow = `<tr style="color: #059669;"><td>Discount (Coupon: ${data.couponCode || 'PROMO'})</td><td>-</td><td>-₹${data.discountAmount.toLocaleString('en-IN')}</td></tr>`;
    }

    const headerLogoHtml = logoBase64 
      ? `<img src="${logoBase64}" style="max-height: 60px; width: auto; max-width: 220px; display: block;" alt="Crinza Logo" />`
      : `<h2 style="color:#4f46e5; margin:0;">Crinza Technologies</h2>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; }
          .invoice-details { text-align: right; }
          .details-grid { display: flex; justify-content: space-between; margin-top: 25px; }
          .box { width: 48%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; margin-top: 25px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          th { background-color: #4f46e5; color: white; }
          .total-box { margin-top: 20px; text-align: right; }
          .terms { margin-top: 30px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            ${headerLogoHtml}
            <p style="margin:4px 0 0 0; font-size: 11px; color: #64748b;">Crinza Technologies Pvt Ltd</p>
          </div>
          <div class="invoice-details">
            <h2 style="margin:0; color:#334155;">TAX INVOICE</h2>
            <p style="margin:3px 0;">Invoice #: <strong>${data.invoiceId}</strong></p>
            <p style="margin:3px 0;">Date: ${new Date().toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <div class="details-grid">
          <div class="box">
            <h4 style="margin-top:0; color:#4f46e5;">Billed To:</h4>
            <p style="margin:3px 0;"><strong>Institute:</strong> ${data.instituteName}</p>
            <p style="margin:3px 0;"><strong>App Name:</strong> ${data.appName}</p>
            <p style="margin:3px 0;"><strong>Mobile:</strong> ${data.mobileNo}</p>
            <p style="margin:3px 0;"><strong>Email:</strong> ${data.email}</p>
            ${data.gstNo ? `<p style="margin:3px 0;"><strong>GSTIN:</strong> ${data.gstNo}</p>` : ''}
          </div>
          <div class="box">
            <h4 style="margin-top:0; color:#4f46e5;">Address Details:</h4>
            <p style="margin:3px 0;">${data.address || 'N/A'}</p>
            <p style="margin:3px 0;"><strong>City:</strong> ${data.city || ''}, <strong>State:</strong> ${data.state || ''}</p>
            <p style="margin:3px 0;"><strong>Pincode:</strong> ${data.pincode || ''}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description / Items</th>
              <th>Validity</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${data.appName} License (Base Price)</td>
              <td>${data.packageValidity}</td>
              <td>₹${(data.baseAmount || data.totalAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
            ${addonRows}
            ${discountRow}
          </tbody>
        </table>

        <div class="total-box">
          <p>Total Amount: <strong>₹${data.totalAmount ? data.totalAmount.toLocaleString('en-IN') : 0}</strong></p>
          <p>Paid Amount: <strong style="color: green;">₹${data.paidAmount ? data.paidAmount.toLocaleString('en-IN') : 0}</strong></p>
          <p>Due Amount: <strong style="color: red;">₹${data.dueAmount ? data.dueAmount.toLocaleString('en-IN') : 0}</strong></p>
        </div>

        <div class="terms">
          <h4>Terms & Conditions:</h4>
          <p style="white-space: pre-line;">${data.termsAndConditions}</p>
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    return pdfBuffer;
  } catch (err) {
    console.error("🔥 [PDF Error]:", err);
    throw err;
  } finally {
    if (browser) {
      try { await browser.close(); } catch(e) {}
    }
  }
};

// =========================================================================
// --- 📧 EMAIL SENDER HELPER (Brevo SMTP) ---
// =========================================================================
const sendInvoiceEmail = async (clientEmail, pdfBuffer, invoiceId) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Crinza Billing Dept" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: `Crinza Invoice #${invoiceId} for Your Service`,
      text: `Hello,\n\nPlease find attached the official invoice (#${invoiceId}) for your subscription.\n\nThank you!\nCrinza Technologies`,
      attachments: [{ filename: `Invoice_${invoiceId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("🔥 [Email Error]:", err);
    throw err;
  }
};

// =========================================================================
// --- 🗄️ DATABASE CONNECTION & DEFAULT SEEDING ---
// =========================================================================
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/invoice_db')
  .then(async () => {
    console.log('MongoDB Connected Successfully');

    const sales = await User.findOne({ userId: 'EMP101' });
    if (!sales) {
      await User.create({
        userId: 'EMP101',
        name: 'Default Salesperson',
        email: 'sales@crinza.com',
        password: await bcrypt.hash('Sales@123', 10),
        role: 'salesperson'
      });
    } else if (!sales.role) {
      sales.role = 'salesperson';
      await sales.save();
    }

    const acct = await User.findOne({ userId: 'ACCT101' });
    if (!acct) {
      await User.create({
        userId: 'ACCT101',
        name: 'Default Accountant',
        email: 'accountant@crinza.com',
        password: await bcrypt.hash('Acct@123', 10),
        role: 'accountant'
      });
    } else if (!acct.role) {
      acct.role = 'accountant';
      await acct.save();
    }

    const boss = await User.findOne({ $or: [{ userId: 'BOSS101' }, { userId: 'ADMIN101' }] });
    if (!boss) {
      await User.create({
        userId: 'ADMIN101',
        name: 'System Admin',
        email: 'admin@crinza.com',
        password: await bcrypt.hash('Admin@123', 10),
        role: 'admin'
      });
    } else if (!boss.role) {
      boss.role = 'admin';
      await boss.save();
    }
  });

// =========================================================================
// --- 🔐 AUTHENTICATION API ROUTES ---
// =========================================================================
app.post('/api/auth/login', loginLimiter, [
  body('userId', 'User ID is required').notEmpty(),
  body('password', 'Password is required').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId, password } = req.body;
  try {
    const user = await User.findOne({ userId });
    if (!user) return res.status(400).json({ message: 'User ID not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ userId: user.userId, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, userId: user.userId, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// =========================================================================
// --- 👑 BOSS / ADMIN OPERATIONS API ROUTES ---
// =========================================================================

app.get('/api/boss/employees', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    const employees = await User.find({ role: { $in: ['salesperson', 'accountant'] } }).select('-password');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch employees', error: err.message });
  }
});

app.get('/api/boss/performance', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const stats = await Invoice.aggregate([
      {
        $match: {
          salespersonId: { $exists: true, $ne: null, $ne: "" }
        }
      },
      {
        $group: {
          _id: '$salespersonId',
          salespersonId: { $first: '$salespersonId' },
          totalDeals: { $sum: 1 },
          approvedDeals: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          pendingDeals: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          rejectedDeals: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          totalBusiness: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$totalAmount', 0] }
          },
          totalPaid: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$paidAmount', 0] }
          }
        }
      }
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch performance stats', error: err.message });
  }
});

app.get('/api/boss/employee-details/:salespersonId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    const deals = await Invoice.find({ salespersonId: req.params.salespersonId }).sort({ createdAt: -1 });
    res.json(deals);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch employee details', error: err.message });
  }
});

// 🌟 Admin Endpoint to view all Tasks / Calls / Demos assigned or created by Salespersons
app.get('/api/boss/tasks', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: err.message });
  }
});

app.get('/api/boss/coupons', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coupons', error: err.message });
  }
});

app.post('/api/boss/create-coupon', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    const { code, discountType, discountValue, expiryDate } = req.body;
    if (!code || !discountValue) {
      return res.status(400).json({ message: 'Coupon code and value are required!' });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists!' });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      expiryDate: expiryDate || null
    });

    await newCoupon.save();
    res.status(201).json({ message: 'Coupon created successfully!', coupon: newCoupon });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create coupon', error: err.message });
  }
});

app.delete('/api/boss/coupons/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete coupon', error: err.message });
  }
});

app.post('/api/auth/create-employee', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    const { userId, name, email, password, role } = req.body;
    if (!userId || !name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ message: 'User ID already exists!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newEmp = new User({
      userId,
      name,
      email,
      password: hashedPassword,
      role: role || 'salesperson'
    });

    await newEmp.save();
    res.status(201).json({ message: 'Employee created successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create employee', error: err.message });
  }
});

app.delete('/api/boss/delete-employee/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee deleted successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete employee', error: err.message });
  }
});

app.post('/api/boss/transfer-leads', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }
    const { fromSalesperson, toSalesperson } = req.body;
    if (!fromSalesperson || !toSalesperson) {
      return res.status(400).json({ message: 'Source and Target salespersons are required!' });
    }

    await Invoice.updateMany({ salespersonId: fromSalesperson }, { $set: { salespersonId: toSalesperson } });
    await Lead.updateMany({ salespersonId: fromSalesperson }, { $set: { salespersonId: toSalesperson } });
    await Task.updateMany({ salespersonId: fromSalesperson }, { $set: { salespersonId: toSalesperson } });

    res.json({ message: `Successfully transferred leads & invoices from ${fromSalesperson} to ${toSalesperson}!` });
  } catch (err) {
    res.status(500).json({ message: 'Transfer failed', error: err.message });
  }
});

// =========================================================================
// --- 🧾 INVOICE & BILLING API ROUTES ---
// =========================================================================
app.post('/api/invoices/request', verifyToken, upload.single('paymentProof'), async (req, res) => {
  try {
    const invoiceId = 'CRINZA-' + Date.now().toString().slice(-6);

    let parsedAddons = { testModule: false, windowApp: false, iosApp: false };
    if (req.body.addons) {
      try {
        parsedAddons = typeof req.body.addons === 'string' ? JSON.parse(req.body.addons) : req.body.addons;
      } catch (e) {}
    }

    const normalizedPath = req.file ? req.file.path.replace(/\\/g, '/') : '';

    const newInvoice = new Invoice({
      ...req.body,
      baseAmount: Number(req.body.baseAmount) || Number(req.body.totalAmount) || 0,
      totalAmount: Number(req.body.totalAmount) || 0,
      paidAmount: Number(req.body.paidAmount) || 0,
      dueAmount: Number(req.body.dueAmount) || 0,
      discountAmount: Number(req.body.discountAmount) || 0,
      latitude: req.body.latitude ? Number(req.body.latitude) : null,
      longitude: req.body.longitude ? Number(req.body.longitude) : null,
      invoiceId,
      salespersonId: req.user.userId,
      paymentProof: normalizedPath,
      addons: parsedAddons,
      status: 'pending',
    });

    await newInvoice.save();
    res.status(201).json({ message: 'Invoice request submitted to Accountant!', invoiceId });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit request', error: err.message });
  }
});

app.get('/api/invoices/pending', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'accountant' && req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const pendingInvoices = await Invoice.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(pendingInvoices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching pending list', error: err.message });
  }
});

app.get('/api/invoices/history', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'accountant' && req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const historyInvoices = await Invoice.find({ status: { $ne: 'pending' } }).sort({ updatedAt: -1 });
    res.json(historyInvoices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching invoice history', error: err.message });
  }
});

app.post('/api/invoices/approve/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'accountant' && req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const pdfBuffer = await createInvoicePDF(invoice);
    await sendInvoiceEmail(invoice.email, pdfBuffer, invoice.invoiceId);

    invoice.status = 'approved';
    invoice.approvedBy = req.user.userId;
    await invoice.save();

    res.json({ message: `Invoice #${invoice.invoiceId} Approved & Emailed successfully!` });
  } catch (err) {
    res.status(500).json({ message: 'Approval failed', error: err.message || 'Internal error' });
  }
});

app.put('/api/invoices/update/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'accountant' && req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.json({ message: 'Invoice updated!', invoice: updatedInvoice });
  } catch (err) {
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
});

app.post('/api/invoices/reject/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'accountant' && req.user.role !== 'boss' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const { rejectionReason } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    invoice.status = 'rejected';
    invoice.rejectionReason = rejectionReason || 'Verification failed';
    await invoice.save();

    res.json({ message: `Invoice #${invoice.invoiceId} rejected.` });
  } catch (err) {
    res.status(500).json({ message: 'Rejection failed', error: err.message });
  }
});

// =========================================================================
// --- 👤 SALESPERSON SPECIFIC ROUTES ---
// =========================================================================
app.get('/api/salesperson/my-deals', verifyToken, async (req, res) => {
  try {
    const deals = await Invoice.find({ salespersonId: req.user.userId }).sort({ createdAt: -1 });
    res.json(deals);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch deals history', error: err.message });
  }
});

app.get('/api/salesperson/my-leads', verifyToken, async (req, res) => {
  try {
    const leads = await Lead.find({ salespersonId: req.user.userId }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch leads history', error: err.message });
  }
});

app.post('/api/salesperson/leads', verifyToken, upload.single('meetingPhoto'), async (req, res) => {
  try {
    const { 
      instituteName, contactPerson, mobileNo, email, address, pincode, 
      city, state, notes, latitude, longitude, followUpDate, followUpTime, followUpAction 
    } = req.body;

    if (!instituteName || !contactPerson || !mobileNo || !city || !state) {
      return res.status(400).json({ message: 'Mandatory fields are missing!' });
    }

    const normalizedPath = req.file ? req.file.path.replace(/\\/g, '/') : '';

    const newLead = new Lead({
      instituteName,
      contactPerson,
      mobileNo,
      email: email || '',
      address: address || '',
      pincode: pincode || '',
      city,
      state,
      notes: notes || '',
      meetingPhoto: normalizedPath,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      followUpDate: followUpDate || null,
      followUpTime: followUpTime || '',
      followUpAction: followUpAction || 'Call',
      salespersonId: req.user.userId,
    });

    await newLead.save();

    // Automatically create a tracking task when a lead follow-up is scheduled
    if (followUpDate) {
      await Task.create({
        salespersonId: req.user.userId,
        instituteName,
        taskType: followUpAction?.toLowerCase().includes('demo') ? 'demo' : 'call',
        notes: notes || `Follow-up scheduled: ${followUpAction}`,
        dueDate: followUpDate
      });
    }

    res.status(201).json({ message: 'Lead & Follow-up saved successfully!', lead: newLead });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save lead', error: err.message });
  }
});

app.put('/api/salesperson/leads/:id', verifyToken, async (req, res) => {
  try {
    const { demoStatus, leadStatus, notes, followUpDate, followUpTime, followUpAction } = req.body;
    
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: { demoStatus, leadStatus, notes, followUpDate, followUpTime, followUpAction } },
      { new: true }
    );

    if (!updatedLead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead updated successfully!', lead: updatedLead });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update lead', error: err.message });
  }
});

// 🌟 Salesperson Tasks API (Create/View tasks like calls & demos)
app.get('/api/salesperson/tasks', verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ salespersonId: req.user.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: err.message });
  }
});

app.post('/api/salesperson/tasks', verifyToken, async (req, res) => {
  try {
    const { instituteName, taskType, notes, dueDate } = req.body;
    if (!instituteName || !taskType) {
      return res.status(400).json({ message: 'Institute name and task type are required!' });
    }

    const newTask = new Task({
      salespersonId: req.user.userId,
      instituteName,
      taskType,
      notes: notes || '',
      dueDate: dueDate || ''
    });

    await newTask.save();
    res.status(201).json({ message: 'Task created successfully!', task: newTask });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create task', error: err.message });
  }
});

// --- 🏷️ PUBLIC / SALESPERSON COUPON VERIFICATION ROUTE ---
app.post('/api/coupons/verify', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code required' });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code!' });

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ message: 'This coupon has expired!' });
    }

    res.json({
      message: 'Coupon applied successfully!',
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error verifying coupon', error: err.message });
  }
});

// =========================================================================
// --- 🌐 SERVER LISTENER ---
// =========================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));