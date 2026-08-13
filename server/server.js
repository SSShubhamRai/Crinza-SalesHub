/**
 * =========================================================================
 * 🚀 CRINZA INVOICE & LEAD MANAGEMENT SYSTEM - BACKEND SERVER (`server.js`)
 * =========================================================================
 * Fully Updated with Crinza API Integration, Cloudinary Storage & Firebase FCM Push Notifications
 */
const express = require("express");
const http = require("http"); // 🌟 Socket.io ke liye HTTP server zaroori hai
const { Server } = require("socket.io"); // 🌟 Real-time live tracking ke liye
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto"); // 🌟 Token & OTP hashing ke liye zaroori
const axios = require("axios"); // 🌟 OSRM & Crinza API call ke liye axios zaroori hai
const FormData = require("form-data"); // 🌟 Multipart/form-data attachments ke liye zaroori hai
const Tesseract = require("tesseract.js"); // 🌟 AI OCR Payment Proof Verification ke liye
require("dotenv").config();

// --- Firebase Admin Initialization (Node v24 Compatible) ---
try {
  const { initializeApp, cert, getApps } = require("firebase-admin/app");
  const serviceAccount = require("./firebase-service-account.json");

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  console.log("🔥 Firebase Admin Initialized Successfully");
} catch (e) {
  console.error("🔥 Firebase Admin Initialization Failed with Error:", e.message);
}

const admin = require("firebase-admin");

// --- Cloudinary Package Imports ---
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// --- Security & Validation Package Imports ---
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const xss = require("xss-clean"); // 🛡️ XSS Attack Protection

// --- Model & Middleware Imports ---
const User = require("./models/User");
const Invoice = require("./models/Invoice");
const Lead = require("./models/Lead");
const Coupon = require("./models/Coupon");
const verifyToken = require("./middleware/authMiddleware");

const app = express();
const server = http.createServer(app); // 🌟 Express app ko HTTP server mein wrap kiya

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// --- Security & Proxy Setup ---
app.set("trust proxy", 1);

// 🛡️ FIX: Enabled cross-origin resource policy so frontend can load uploaded images/files from backend
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors());
app.use(express.json());

// 🛡️ Fix for Express 5 read-only req.query getter issue with sanitizers
app.use((req, res, next) => {
  if (req.query) {
    try {
      Object.defineProperty(req, "query", {
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

// --- Cloudinary Storage Engine Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "crinza_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit restriction
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/") || 
                    file.mimetype === "image/heic" || 
                    file.mimetype === "image/heif" || 
                    file.originalname.match(/\.(heic|HEIC|heif|HEIF|jpg|jpeg|png|webp)$/);

    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (including HEIC) are allowed for uploads!"), false);
    }
  },
});

// --- Rate Limiter Configuration (Brute Force Protection for Login) ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: {
    message:
      "Too many login attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// =========================================================================
// --- 📋 TASK / CALL / DEMO TRACKING SCHEMA ---
// =========================================================================
const taskSchema = new mongoose.Schema({
  salespersonId: { type: String, required: true },
  instituteName: { type: String, required: true },
  taskType: {
    type: String,
    enum: ["call", "demo", "followup", "pending"],
    required: true,
  },
  notes: { type: String },
  dueDate: { type: String },
  status: { type: String, default: "pending" }, // 'pending' or 'completed'
  createdAt: { type: Date, default: Date.now },
});
const Task = mongoose.model("Task", taskSchema);

// =========================================================================
// --- 📢 BROADCAST ANNOUNCEMENTS SCHEMA (UPDATED WITH DELETION TRACKER) ---
// =========================================================================
const broadcastSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  priority: { type: String, enum: ["normal", "important", "urgent"], default: "normal" },
  deletedFor: [{ type: String }], // 👈 Track salespersons who cleared this broadcast
  createdAt: { type: Date, default: Date.now }
});
const Broadcast = mongoose.model("Broadcast", broadcastSchema);

// =========================================================================
// --- 📍 LOCATION TRACKING SCHEMA (WITH SECURITY SPOOF FLAG) ---
// =========================================================================
const locationLogSchema = new mongoose.Schema({
  salespersonId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  date: { type: String, required: true, index: true }, // Format: 'YYYY-MM-DD'
  isMocked: { type: Boolean, default: false },         // 👈 Anti-Bypass Security Flag
  timestamp: { type: Date, default: Date.now },
});
const LocationLog = mongoose.model("LocationLog", locationLogSchema);

// =========================================================================
// --- ⏱️ DAY START / END ATTENDANCE & SHIFT SCHEMA ---
// =========================================================================
const daySessionSchema = new mongoose.Schema({
  salespersonId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true }, // Format: 'YYYY-MM-DD'
  status: { type: String, enum: ["STARTED", "ENDED"], default: "STARTED" },
  startTime: { type: Date, default: Date.now },
  startLocation: {
    latitude: Number,
    longitude: Number,
  },
  startAddress: { type: String, default: "" }, // 👈 Storing human-readable start location name
  endTime: { type: Date },
  endLocation: {
    latitude: Number,
    longitude: Number,
  },
  totalDistanceKm: { type: Number, default: 0 },
});
const DaySession = mongoose.model("DaySession", daySessionSchema);

// =========================================================================
// --- 📐 Haversine Formula Helper & Drift Filtering (200m Threshold) ---
// =========================================================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// 🌟 Local Distance Calculation with 200 Meters Threshold
function calculateValidDistance(coordinatesList) {
  let totalDistance = 0;
  const MIN_DISTANCE_THRESHOLD = 0.2; // 0.2 KM = 200 meters threshold to prevent fake indoor/jitter counts

  for (let i = 1; i < coordinatesList.length; i++) {
    const prev = coordinatesList[i - 1];
    const curr = coordinatesList[i];

    const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);

    if (dist >= MIN_DISTANCE_THRESHOLD) {
      totalDistance += dist;
    }
  }

  return Number(totalDistance.toFixed(2));
}

// =========================================================================
// --- 🌐 SOCKET.IO REAL-TIME LOCATION & SINGLE SESSION HANDLER ---
// =========================================================================
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: Token missing"));
  }
  jwt.verify(token, process.env.JWT_SECRET || "secret", (err, decoded) => {
    if (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
    socket.user = decoded;
    next();
  });
});

const activeUserSessions = {};

io.on("connection", (socket) => {
  console.log(`🔌 Authenticated Client Connected: ${socket.id} (${socket.user.userId})`);

  socket.on("register_user", ({ userId }) => {
    if (!userId) return;

    if (activeUserSessions[userId] && activeUserSessions[userId] !== socket.id) {
      io.to(activeUserSessions[userId]).emit("force_logout", {
        message: "Session expired. Logged in on another device.",
      });
    }

    activeUserSessions[userId] = socket.id;
    console.log(`👤 Active Session Registered for: ${userId} (${socket.id})`);
  });

  socket.on("update_location", async (data) => {
    try {
      const { salespersonId, latitude, longitude } = data;
      if (!salespersonId || !latitude || !longitude) return;

      if (socket.user.userId !== salespersonId && socket.user.role !== 'admin' && socket.user.role !== 'boss') {
        return;
      }

      const currentDate = new Date().toISOString().split("T")[0];
      const currentTime = new Date();

      const lastLog = await LocationLog.findOne({ salespersonId, date: currentDate }).sort({ timestamp: -1 });

      let isMockedByTeleport = false;

      if (lastLog) {
        const distanceKm = calculateDistance(lastLog.latitude, lastLog.longitude, latitude, longitude);
        const timeDiffHours = (currentTime - new Date(lastLog.timestamp)) / (1000 * 60 * 60);

        if (distanceKm < 0.2) {
          io.emit("live_location_broadcast", {
            salespersonId,
            latitude,
            longitude,
            isMocked: false,
            timestamp: currentTime,
          });
          return; 
        }

        if (timeDiffHours > 0) {
          const speedKmh = distanceKm / timeDiffHours;
          if (speedKmh > 150) {
            isMockedByTeleport = true;
            console.warn(`🚨 SECURITY ALERT: Possible Fake GPS / Teleportation detected for ${salespersonId}! Calculated Speed: ${speedKmh.toFixed(2)} km/h`);
          }
        }
      }

      await LocationLog.create({
        salespersonId,
        latitude,
        longitude,
        date: currentDate,
        isMocked: isMockedByTeleport,
      });

      io.emit("live_location_broadcast", {
        salespersonId,
        latitude,
        longitude,
        isMocked: isMockedByTeleport,
        timestamp: currentTime,
      });
    } catch (err) {
      console.error("🔥 Socket Location Error:", err);
    }
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of Object.entries(activeUserSessions)) {
      if (socketId === socket.id) {
        delete activeUserSessions[userId];
        break;
      }
    }
    console.log(`🔌 Client Disconnected: ${socket.id}`);
  });
});

// =========================================================================
// --- 📄 PDF GENERATOR HELPER (Updated with Buffer Fix) ---
// =========================================================================

const createInvoicePDF = async (data) => {
  let browser;
  try {
    const logoPngPath = path.join(__dirname, "uploads", "logo.png");
    const logoJpgPath = path.join(__dirname, "uploads", "logo.jpg");
    let logoBase64 = "";

    if (fs.existsSync(logoPngPath)) {
      const logoBuffer = fs.readFileSync(logoPngPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } else if (fs.existsSync(logoJpgPath)) {
      const logoBuffer = fs.readFileSync(logoJpgPath);
      logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString("base64")}`;
    }

    const puppeteer = require("puppeteer-core");
    
    if (process.env.NODE_ENV === "production" || process.env.RENDER) {
      const chromium = require("@sparticuz/chromium");
      chromium.setGraphicsMode = false;

      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const localExecutablePath = process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome';

      browser = await puppeteer.launch({
        executablePath: localExecutablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await browser.newPage();

    // 🌟 Base Price, GST, Discount & Past Due Calculations
    const baseAmt = Number(data.baseAmount || data.totalCode || data.totalAmount || 0);
    const gstAmount = Math.round(baseAmt * 0.18);
    const discountAmt = Number(data.discountAmount || 0);
    const pastDueAmt = Number(data.previousDueBalance || 0);

    // 🌟 Add-ons Rows
    let addonRows = "";
    if (data.addons) {
      if (data.addons.testModule)
        addonRows += `<tr><td>Add-on: Test Series Module</td><td>Included</td><td>₹5,000</td></tr>`;
      if (data.addons.windowApp)
        addonRows += `<tr><td>Add-on: Windows Desktop App</td><td>Included</td><td>₹5,000</td></tr>`;
      if (data.addons.iosApp)
        addonRows += `<tr><td>Add-on: iOS Mobile App</td><td>Included</td><td>₹45,000</td></tr>`;
    }

    // 🌟 Discount Row (STRICTLY CONDITIONAL: Discount > 0 hone par hi dikhega, varna complete HIDE)
    let discountRow = "";
    if (discountAmt > 0) {
      discountRow = `
        <tr style="color: #059669; background-color: #ecfdf5;">
          <td><strong>Discount Applied (Coupon: ${data.couponCode || "PROMO"})</strong></td>
          <td>-</td>
          <td><strong>-₹${discountAmt.toLocaleString("en-IN")}</strong></td>
        </tr>`;
    }

    // 🌟 Previous Due Balance Row
    let pastDueRow = "";
    if (pastDueAmt > 0) {
      pastDueRow = `
        <tr style="color: #d97706; background-color: #fffbeb;">
          <td>Previous Unpaid Due Balance Added</td>
          <td>-</td>
          <td>₹${pastDueAmt.toLocaleString("en-IN")}</td>
        </tr>`;
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
          .total-box { margin-top: 20px; text-align: right; font-size: 14px; line-height: 1.6; }
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
            <h2 style="margin:0; color:#334155;">TAX INVOICE / LEDGER</h2>
            <p style="margin:3px 0;">Invoice #: <strong>${data.invoiceId}</strong></p>
            <p style="margin:3px 0;">Date: ${new Date().toLocaleDateString("en-IN")}</p>
          </div>
        </div>

        <div class="details-grid">
          <div class="box">
            <h4 style="margin-top:0; color:#4f46e5;">Billed To:</h4>
            <p style="margin:3px 0;"><strong>Institute:</strong> ${data.instituteName}</p>
            <p style="margin:3px 0;"><strong>App Name:</strong> ${data.appName}</p>
            <p style="margin:3px 0;"><strong>Mobile:</strong> ${data.mobileNo}</p>
            <p style="margin:3px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin:3px 0;"><strong>Payment Mode:</strong> ${data.paymentMode || 'ONLINE'} (${data.utrNumber || data.receiptNo || data.chequeNo || 'N/A'})</p>
            ${data.gstNo ? `<p style="margin:3px 0;"><strong>GSTIN:</strong> ${data.gstNo}</p>` : ""}
          </div>
          <div class="box">
            <h4 style="margin-top:0; color:#4f46e5;">Address Details:</h4>
            <p style="margin:3px 0;">${data.address || "N/A"}</p>
            <p style="margin:3px 0;"><strong>City:</strong> ${data.city || ""}, <strong>State:</strong> ${data.state || ""}</p>
            <p style="margin:3px 0;"><strong>Pincode:</strong> ${data.pincode || ""}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description / Items</th>
              <th>Validity</th>
              <th>Cost (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${data.appName} License (Base Price)</td>
              <td>${data.packageValidity}</td>
              <td>₹${baseAmt.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td>GST (18% Applicable)</td>
              <td>-</td>
              <td>₹${gstAmount.toLocaleString("en-IN")}</td>
            </tr>
            ${addonRows}
            ${discountRow}
            ${pastDueRow}
          </tbody>
        </table>

        <div class="total-box">
          <p style="font-size: 16px;">Grand Total Cost (Incl. Past Due & GST): <strong>₹${data.totalAmount ? data.totalAmount.toLocaleString("en-IN") : 0}</strong></p>
          <p>Paid Amount: <strong style="color: green;">₹${data.paidAmount ? data.paidAmount.toLocaleString("en-IN") : 0}</strong></p>
          <p>Due Balance: <strong style="color: ${data.dueAmount > 0 ? 'red' : 'green'};">₹${data.dueAmount ? data.dueAmount.toLocaleString("en-IN") : 0} ${data.dueAmount === 0 ? '(Fully Paid & Settled)' : ''}</strong></p>
        </div>

        <div class="terms">
          <h4>Terms & Conditions:</h4>
          <p style="white-space: pre-line;">${data.termsAndConditions}</p>
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
    const rawPdf = await page.pdf({ format: "A4", printBackground: true });
    await page.close();
    
    return Buffer.from(rawPdf);
  } catch (err) {
    console.error("🔥 [PDF Error]:", err);
    throw err;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }
};
// =========================================================================
// --- 📧 EMAIL SENDER HELPER (Updated with Crinza Custom API) ---
// =========================================================================
const sendInvoiceEmail = async (clientEmail, pdfBuffer, invoiceId, instituteName) => {
  try {
    const form = new FormData();

    form.append('sendTo', clientEmail);
    form.append('message', `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <h3 style="color: #4f46e5;">Hello ${instituteName || 'Valued Client'},</h3>
        <p>Please find attached your official invoice and ledger statement (<strong>#${invoiceId}</strong>) for your Crinza subscription.</p>
        <p>Thank you for choosing Crinza Technologies!</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Best Regards,<br><strong>Crinza Technologies Billing Dept</strong></p>
      </div>
    `);

    form.append('attachments', pdfBuffer, {
      filename: `Invoice_${invoiceId}.pdf`,
      contentType: 'application/pdf',
    });

    const response = await axios.post('https://api.crinza.com/api/v1/contact/message', form, {
      headers: {
        ...form.getHeaders(),
        'Origin': 'https://crinza.com',
      },
    });

    console.log(`✅ Invoice email successfully dispatched via Crinza API for #${invoiceId}:`, response.data);
    return true;
  } catch (err) {
    console.error("🔥 [Crinza API Email Error]:", err.response?.data || err.message);
    throw err;
  }
};

// =========================================================================
// --- 🗄️ DATABASE CONNECTION & DEFAULT SEEDING ---
// =========================================================================
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/invoice_db")
  .then(async () => {
    console.log("MongoDB Connected Successfully");

    const sales = await User.findOne({ userId: "EMP101" });
    if (!sales) {
      await User.create({
        userId: "EMP101",
        name: "Default Salesperson",
        email: "sales@crinza.com",
        password: await bcrypt.hash("Sales@123", 10),
        role: "salesperson",
      });
    } else if (!sales.role) {
      sales.role = "salesperson";
      await sales.save();
    }

    const acct = await User.findOne({ userId: "ACCT101" });
    if (!acct) {
      await User.create({
        userId: "ACCT101",
        name: "Default Accountant",
        email: "accountant@crinza.com",
        password: await bcrypt.hash("Acct@123", 10),
        role: "accountant",
      });
    } else if (!acct.role) {
      acct.role = "accountant";
      await acct.save();
    }

    const boss = await User.findOne({
      $or: [{ userId: "BOSS101" }, { userId: "ADMIN101" }],
    });
    if (!boss) {
      await User.create({
        userId: "ADMIN101",
        name: "System Admin",
        email: "admin@crinza.com",
        password: await bcrypt.hash("Admin@123", 10),
        role: "admin",
      });
    } else if (!boss.role) {
      boss.role = "admin";
      await boss.save();
    }
  });

// =========================================================================
// --- 🔐 AUTHENTICATION API ROUTES ---
// =========================================================================
app.post(
  "/api/auth/login",
  loginLimiter,
  [
    body("userId", "User ID is required").notEmpty(),
    body("password", "Password is required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, password } = req.body;
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(400).json({ message: "User ID not found" });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(400).json({ message: "Invalid password" });

      const token = jwt.sign(
        { userId: user.userId, name: user.name, role: user.role },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1d" },
      );
      res.json({ token, userId: user.userId, name: user.name, role: user.role });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// =========================================================================
// --- 🔑 FORGOT PASSWORD & OTP ROUTES ---
// =========================================================================
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res
        .status(400)
        .json({ message: "Please enter your Employee ID or Email!" });
    }

    const query = identifier.includes("@")
      ? { email: identifier.trim().toLowerCase() }
      : { userId: identifier.trim() };

    const user = await User.findOne(query);
    if (!user || !user.email) {
      return res
        .status(404)
        .json({
          message: "No registered account found with this ID or Email!",
        });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      family: 4,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const mailOptions = {
      from: `"Crinza Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset OTP - Crinza",
      html: `
        <h3>Password Reset Verification</h3>
        <p>Aapke account (User ID: <strong>${user.userId}</strong>) ke liye password reset OTP niche diya gaya hai:</p>
        <h2 style="color: #4f46e5; letter-spacing: 3px; font-size: 28px;">${otp}</h2>
        <p>Yeh OTP sirf <strong>10 minutes</strong> ke liye valid hai. Kripya ise kisi ke sath share na karein.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "OTP sent successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.post("/api/auth/reset-password-otp", async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long!" });
    }

    const query = identifier.includes("@")
      ? { email: identifier.trim().toLowerCase() }
      : { userId: identifier.trim() };

    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: "User not found!" });

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    if (
      !user.resetPasswordToken ||
      user.resetPasswordToken !== hashedOtp ||
      user.resetPasswordExpires < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP!" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Password reset successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =========================================================================
// --- 👑 BOSS / ADMIN OPERATIONS API ROUTES ---
// =========================================================================

app.post("/api/boss/broadcast", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied! Admin privileges required." });
    }

    const { title, message, priority } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required!" });
    }

    const newBroadcast = new Broadcast({
      adminId: req.user.userId,
      title,
      message,
      priority: priority || "normal",
      deletedFor: []
    });

    await newBroadcast.save();

    // 🌟 Push Notification Sender Logic
    try {
      const salespersons = await User.find({ role: "salesperson", fcmToken: { $exists: true, $ne: null } });
      for (const sp of salespersons) {
        if (sp.fcmToken) {
          const pushMessage = {
            token: sp.fcmToken,
            notification: {
              title: `📢 ${title}`,
              body: message
            },
            android: { notification: { sound: 'default', priority: 'high' } }
          };
          await admin.messaging().send(pushMessage);
        }
      }
      console.log("✅ Push notifications pushed to all active devices!");
    } catch (pushErr) {
      console.error("🔥 Error pushing notifications:", pushErr);
    }

    io.emit("team_broadcast", {
      _id: newBroadcast._id,
      title,
      message,
      priority: priority || "normal",
      adminId: req.user.userId,
      createdAt: newBroadcast.createdAt
    });

    res.status(201).json({ success: true, message: "Broadcast sent & pushed successfully to all devices!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send broadcast", error: err.message });
  }
});

// =========================================================================
// --- 📢 SALESPERSON PERSISTENT BROADCAST API ROUTES ---
// =========================================================================
app.get("/api/salesperson/broadcasts", verifyToken, async (req, res) => {
  try {
    const broadcasts = await Broadcast.find({
      deletedFor: { $ne: req.user.userId }
    }).sort({ createdAt: -1 });

    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch broadcasts", error: err.message });
  }
});

app.post("/api/salesperson/broadcasts/:id/dismiss", verifyToken, async (req, res) => {
  try {
    const broadcastId = req.params.id;
    await Broadcast.findByIdAndUpdate(broadcastId, {
      $addToSet: { deletedFor: req.user.userId }
    });

    res.json({ success: true, message: "Broadcast dismissed successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to dismiss broadcast", error: err.message });
  }
});

app.get("/api/boss/kpi-summary", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const totalInvoices = await Invoice.aggregate([
      { $match: { status: "approved" } },
      { 
        $group: { 
          _id: null, 
          totalRevenue: { $sum: "$totalAmount" }, 
          totalCollected: { $sum: "$paidAmount" } 
        } 
      }
    ]);

    const activeLeadsCount = await Lead.countDocuments();
    const activeEmployeesCount = await User.countDocuments({ role: "salesperson" });

    res.json({
      totalRevenue: totalInvoices[0]?.totalRevenue || 0,
      totalCollected: totalInvoices[0]?.totalCollected || 0,
      activeLeadsCount,
      activeEmployeesCount
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch KPI summary", error: err.message });
  }
});

app.post("/api/boss/transfer-single-deal", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { dealId, newSalespersonId } = req.body;
    if (!dealId || !newSalespersonId) {
      return res.status(400).json({ message: "Deal ID and Target Salesperson are required!" });
    }

    const updatedDeal = await Invoice.findByIdAndUpdate(
      dealId,
      { $set: { salespersonId: newSalespersonId } },
      { returnDocument: 'after' }
    );

    if (!updatedDeal) return res.status(404).json({ message: "Deal not found" });

    res.json({ success: true, message: `Deal successfully reassigned to ${newSalespersonId}!` });
  } catch (err) {
    res.status(500).json({ message: "Failed to transfer deal", error: err.message });
  }
});

app.get(
  "/api/boss/salesperson-travel/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "boss" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied!" });
      }

      const { salespersonId } = req.params;
      const { date, startDate, endDate } = req.query;

      let queryFilter = { salespersonId };

      if (startDate && endDate) {
        queryFilter.date = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        queryFilter.date = startDate;
      } else if (date) {
        queryFilter.date = date;
      } else {
        queryFilter.date = new Date().toISOString().split("T")[0];
      }

      const logs = await LocationLog.find(queryFilter).sort({ timestamp: 1 });

      const totalDistanceKm = calculateValidDistance(logs);

      res.json({
        success: true,
        salespersonId,
        startDate: startDate || date || new Date().toISOString().split("T")[0],
        endDate: endDate || startDate || date || new Date().toISOString().split("T")[0],
        totalDistanceKm,
        routePoints: logs,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch travel history",
        error: err.message,
      });
    }
  },
);

// 🌟 Admin API to fetch salesperson's day session shift timings & status
app.get("/api/boss/salesperson-shift/:salespersonId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { salespersonId } = req.params;
    const queryDate = req.query.date || new Date().toISOString().split("T")[0];

    const session = await DaySession.findOne({ salespersonId, date: queryDate });
    res.json({ success: true, session: session || null });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shift details", error: err.message });
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.get("/api/boss/reverse-geocode", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ message: "Lat and Lon are required" });
    }

    await delay(1000);

    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      headers: { 'User-Agent': 'CrinzaInvoicePortal/1.0' }
    });
    
    res.json({ displayName: response.data.display_name || "Unknown Location" });
  } catch (err) {
    res.json({ displayName: "Location name unavailable (Rate Limited)" });
  }
});

app.get("/api/boss/employees", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const employees = await User.find({
      role: { $in: ["salesperson", "accountant"] },
    }).select("-password");
    res.json(employees);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch employees", error: err.message });
  }
});

app.get("/api/boss/performance", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const stats = await Invoice.aggregate([
      {
        $match: {
          salespersonId: { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$salespersonId",
          salespersonId: { $first: "$salespersonId" },
          totalDeals: { $sum: 1 },
          approvedDeals: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          pendingDeals: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          rejectedDeals: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          totalBusiness: {
            $sum: {
              $cond: [{ $eq: ["$status", "approved"] }, "$totalAmount", 0],
            },
          },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$status", "approved"] }, "$paidAmount", 0],
            },
          },
        },
      },
    ]);

    res.json(stats);
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Failed to fetch performance stats",
        error: err.message,
      });
  }
});

app.get(
  "/api/boss/employee-details/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "boss" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied!" });
      }
      const queryId =
        req.params.salespersonId === "null"
          ? { $in: [null, ""] }
          : req.params.salespersonId;
      const deals = await Invoice.find({ salespersonId: queryId }).sort({
        createdAt: -1,
      });
      res.json(deals);
    } catch (err) {
      res
        .status(500)
        .json({
          message: "Failed to fetch employee deals",
          error: err.message,
        });
    }
  },
);

// 🌟 ULTRA-ROBUST EMPLOYEE LEADS API (Directly matches custom userId & ObjectId)
app.get(
  "/api/boss/employee-leads/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "boss" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied!" });
      }
      
      let queryId = req.params.salespersonId;
      let queryCondition;

      if (queryId === "null" || !queryId) {
        queryCondition = { $in: [null, ""] };
      } else {
        const targetUser = await User.findOne({
          $or: [
            { userId: queryId },
            { _id: queryId.match(/^[0-9a-fA-F]{24}$/) ? queryId : null }
          ]
        }).catch(() => null);

        if (targetUser) {
          queryCondition = { $in: [targetUser.userId, targetUser._id.toString(), queryId] };
        } else {
          queryCondition = queryId;
        }
      }

      const leads = await Lead.find({ salespersonId: queryCondition }).sort({
        createdAt: -1,
      });
      res.json(leads);
    } catch (err) {
      res
        .status(500)
        .json({
          message: "Failed to fetch employee leads",
          error: err.message,
        });
    }
  },
);

app.get("/api/boss/tasks", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch tasks", error: err.message });
  }
});

app.get("/api/boss/coupons", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch coupons", error: err.message });
  }
});

// =========================================================================
// --- 🎟️ BOSS CREATE COUPON ROUTE ---
// =========================================================================
app.post("/api/boss/create-coupon", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { code, discountType, discountValue, expiryDate } = req.body;
    if (!code || !discountValue || !discountType) {
      return res.status(400).json({ message: "All required coupon fields must be filled!" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: "Coupon code already exists!" });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      expiryDate: expiryDate || null,
      createdBy: req.user.userId, // 👈 Added: Automatically captures the logged-in admin/boss ID
    });

    await newCoupon.save();
    res.status(201).json({ message: "Coupon created successfully!", coupon: newCoupon });
  } catch (err) {
    res.status(500).json({ message: "Failed to create coupon", error: err.message });
  }
});

// =========================================================================
// --- 🎟️ SALESPERSON VERIFY COUPON ROUTE (FIXED PROPERTY MATCH) ---
// =========================================================================
app.post("/api/coupons/verify", verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code required" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code!" });
    }

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ message: "This coupon has expired!" });
    }

    res.json({
      message: "Coupon applied successfully!",
      code: coupon.code,
      discountType: coupon.discountType, // 👈 Fixed: now correctly sends discountType instead of coupon.type
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error verifying coupon", error: err.message });
  }
});

app.delete("/api/boss/coupons/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: "Coupon deleted successfully!" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete coupon", error: err.message });
  }
});

// =========================================================================
// --- ➕ CREATE EMPLOYEE WITH WELCOME EMAIL (VIA CRINZA API) ---
// =========================================================================
app.post("/api/auth/create-employee", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { userId, name, email, phone, password, role } = req.body;
    if (!userId || !name || !email || !password) {
      return res.status(400).json({ message: "All required fields must be filled!" });
    }

    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ message: "User ID already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newEmp = new User({
      userId,
      name,
      email,
      phone: phone || "",
      password: hashedPassword,
      role: role || "salesperson",
    });

    await newEmp.save();

    let emailSent = false;

    // 1️⃣ 📧 Send Professional Welcome Email via Crinza API
    try {
      const loginPortalUrl = process.env.FRONTEND_URL || "https://crinza-saleshub.onrender.com";
      const form = new FormData();

      form.append('sendTo', email);
      form.append('message', `
        <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #f8fafc;">
          <h2 style="color: #4f46e5; text-align: center; margin-bottom: 5px;">Welcome Aboard, ${name}! 🎉</h2>
          <p style="text-align: center; color: #64748b; font-size: 13px; margin-top: 0;">We are thrilled to have you join our growing team.</p>
          
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your official account has been successfully created on the <strong>Crinza One Portal</strong> as a <strong>${(role || 'salesperson').toUpperCase()}</strong>.</p>
          
          <div style="background: #ffffff; padding: 18px; border-radius: 12px; border: 1px solid #cbd5e1; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 8px 0;"><strong>👤 User ID / Code:</strong> <span style="font-family: monospace; color: #4f46e5; font-size: 15px; font-weight: bold;">${userId}</span></p>
            <p style="margin: 8px 0;"><strong>🔑 Temporary Password:</strong> <span style="font-family: monospace; color: #d97706; font-size: 15px; font-weight: bold;">${password}</span></p>
            <p style="margin: 8px 0;"><strong>🌐 Login Portal Link:</strong> <a href="${loginPortalUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">Click here to access portal</a></p>
          </div>

          <p style="color: #475569; font-size: 13px; line-height: 1.5;">Please keep your login credentials secure and confidential. Log in to start your shifts, track your leads, and manage your daily activities.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">Best Regards,<br><strong>Crinza Technologies Administration</strong></p>
        </div>
      `);

      const response = await axios.post('https://api.crinza.com/api/v1/contact/message', form, {
        headers: {
          ...form.getHeaders(),
          'Origin': 'https://crinza.com',
        },
      });

      console.log(`✅ Welcome email dispatched via Crinza API for employee ${userId}:`, response.data);
      emailSent = true;
    } catch (emailErr) {
      console.error("🔥 Welcome Email API Error:", emailErr.response?.data || emailErr.message);
    }

    res.status(201).json({ 
      success: true, 
      message: `Employee ${name} created successfully! ${emailSent ? '📧 Welcome Email Sent via Crinza API.' : ''}`,
      emailSent
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create employee", error: err.message });
  }
});

app.delete("/api/boss/delete-employee/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Employee deleted successfully!" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete employee", error: err.message });
  }
});

// 🌟 FULLY ROBUST TRANSFER LEADS API
app.post("/api/boss/transfer-leads", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { fromSalesperson, toSalesperson } = req.body;
    if (!fromSalesperson || !toSalesperson) {
      return res
        .status(400)
        .json({ message: "Source and Target salespersons are required!" });
    }

    let fromUser = await User.findById(fromSalesperson).catch(() => null);
    if (!fromUser) {
      fromUser = await User.findOne({ userId: fromSalesperson }).catch(() => null);
    }
    const sourceQuery = fromUser ? { $in: [fromUser.userId, fromUser._id.toString(), fromSalesperson] } : fromSalesperson;

    let toUser = await User.findById(toSalesperson).catch(() => null);
    if (!toUser) {
      toUser = await User.findOne({ userId: toSalesperson }).catch(() => null);
    }
    const targetUserId = toUser ? toUser.userId : toSalesperson;

    await Invoice.updateMany(
      { salespersonId: sourceQuery },
      { $set: { salespersonId: targetUserId } },
    );
    await Lead.updateMany(
      { salespersonId: sourceQuery },
      { $set: { salespersonId: targetUserId } },
    );
    await Task.updateMany(
      { salespersonId: sourceQuery },
      { $set: { salespersonId: targetUserId } },
    );

    res.json({
      message: `Successfully transferred leads & invoices to ${targetUserId}!`,
    });
  } catch (err) {
    res.status(500).json({ message: "Transfer failed", error: err.message });
  }
});

// =========================================================================
// --- 🧾 INVOICE & BILLING API ROUTES ---
// =========================================================================
const handleInvoiceSubmission = async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today });
    if (!session || session.status !== "STARTED") {
      return res.status(403).json({ message: "Action Blocked: You must start your day first before submitting invoices!" });
    }

    const invoiceId = "CRINZA-" + Date.now().toString().slice(-6);

    let parsedAddons = { testModule: false, windowApp: false, iosApp: false };
    if (req.body.addons) {
      try {
        parsedAddons =
          typeof req.body.addons === "string"
            ? JSON.parse(req.body.addons)
            : req.body.addons;
      } catch (e) {}
    }

    // 🌟 1. Extract Owner Name & Validity Fields from Request Body
    const { ownerName, validityYears, validityMonths } = req.body;

    // 🌟 2. Build clean package validity string for Invoice/PDF
    const yearsNum = Number(validityYears) || 0;
    const monthsNum = Number(validityMonths) || 0;
    let computedValidity = req.body.packageValidity || "1 Year";
    if (yearsNum > 0 || monthsNum > 0) {
      const yPart = yearsNum > 0 ? `${yearsNum} Year${yearsNum > 1 ? 's' : ''}` : '';
      const mPart = monthsNum > 0 ? `${monthsNum} Month${monthsNum > 1 ? 's' : ''}` : '';
      computedValidity = [yPart, mPart].filter(Boolean).join(' ');
    }

    // 🌟 Cloudinary Direct Secure URL
    const normalizedPath = req.file ? req.file.path : "";
    const paymentMode = req.body.paymentMode || 'ONLINE';
    const utrNumber = req.body.utrNumber ? req.body.utrNumber.trim() : '';
    const claimedPaid = Number(req.body.paidAmount) || 0;

    let ocrStatus = "PENDING";
    let ocrMessage = "Manual review required";

    if (paymentMode === 'ONLINE' && utrNumber) {
      const existingUtrCheck = await Invoice.findOne({ 
        utrNumber: utrNumber, 
        status: { $in: ['pending', 'approved'] } 
      });

      if (existingUtrCheck) {
        ocrStatus = "RED";
        ocrMessage = `Fraud Alert: UTR "${utrNumber}" already used in Invoice #${existingUtrCheck.invoiceId}!`;
      }
    }

    if (paymentMode === 'ONLINE' && req.file && utrNumber && ocrStatus !== "RED") {
      try {
        console.log("🔍 Running AI OCR Scan on payment proof...");
        const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng');
        console.log("📄 OCR Extracted Text:", text);

        const cleanedText = text.replace(/[\s,]/g, '');
        const isAmountMatched = cleanedText.includes(claimedPaid.toString());
        const isUtrMatched = cleanedText.includes(utrNumber);

        if (isUtrMatched && isAmountMatched) {
          ocrStatus = "GREEN";
          ocrMessage = "AI Verified: UTR & Amount Matched 100%";
        } else {
          ocrStatus = "YELLOW";
          ocrMessage = `Mismatch Warning: Entered UTR (${utrNumber}) or Amount (₹${claimedPaid}) differs from screenshot!`;
        }
      } catch (ocrErr) {
        console.error("🔥 OCR Processing Error:", ocrErr);
        ocrStatus = "YELLOW";
        ocrMessage = "OCR scan failed to read image clearly, manual review required.";
      }
    } else if (paymentMode !== 'ONLINE') {
      ocrStatus = "GREEN";
      ocrMessage = "Offline Payment Mode (Cash/Cheque)";
    }

    const newInvoice = new Invoice({
      ...req.body,
      ownerName: ownerName || '', // 🌟 Save owner name
      validityYears: yearsNum,    // 🌟 Save validity years
      validityMonths: monthsNum,  // 🌟 Save validity months
      packageValidity: computedValidity, // 🌟 Save formatted string
      baseAmount:
        Number(req.body.baseAmount) || Number(req.body.totalAmount) || 0,
      totalAmount: Number(req.body.totalAmount) || 0,
      paidAmount: claimedPaid,
      dueAmount: Number(req.body.dueAmount) || 0,
      previousDueBalance: Number(req.body.previousDueBalance) || 0,
      discountAmount: Number(req.body.discountAmount) || 0,
      latitude: req.body.latitude ? Number(req.body.latitude) : null,
      longitude: req.body.longitude ? Number(req.body.longitude) : null,
      invoiceId,
      salespersonId: req.user.userId,
      paymentProof: normalizedPath,
      addons: parsedAddons,
      paymentMode,
      utrNumber,
      receiptNo: req.body.receiptNo || '',
      chequeNo: req.body.chequeNo || '',
      bankName: req.body.bankName || '',
      ocrStatus,
      ocrMessage,
      status: "pending",
    });

    await newInvoice.save();

    res.status(201).json({
      message: "Invoice request & installment ledger submitted to Accountant!",
      invoiceId,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit request", error: err.message });
  }
};

app.post("/api/invoices/request", verifyToken, upload.single("paymentProof"), handleInvoiceSubmission);
app.post("/api/salesperson/invoice-request", verifyToken, upload.single("paymentProof"), handleInvoiceSubmission);

app.get("/api/invoices/pending", verifyToken, async (req, res) => {
  try {
    if (
      req.user.role !== "accountant" &&
      req.user.role !== "boss" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const pendingInvoices = await Invoice.find({ status: "pending" }).sort({
      createdAt: -1,
    });
    res.json(pendingInvoices);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching pending list", error: err.message });
  }
});

app.get("/api/invoices/history", verifyToken, async (req, res) => {
  try {
    if (
      req.user.role !== "accountant" &&
      req.user.role !== "boss" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const historyInvoices = await Invoice.find({
      status: { $ne: "pending" },
    }).sort({ updatedAt: -1 });
    res.json(historyInvoices);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching invoice history", error: err.message });
  }
});

app.post("/api/invoices/approve/:id", verifyToken, async (req, res) => {
  try {
    if (
      req.user.role !== "accountant" &&
      req.user.role !== "boss" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // 1️⃣ Generate PDF Buffer
    const pdfBuffer = await createInvoicePDF(invoice);

    // 2️⃣ Send via Crinza Custom Message/Contact API
    await sendInvoiceEmail(invoice.email, pdfBuffer, invoice.invoiceId, invoice.instituteName);

    // 3️⃣ Update Invoice Status in DB
    invoice.status = "approved";
    invoice.approvedBy = req.user.userId;
    await invoice.save();

    res.json({
      message: `Invoice #${invoice.invoiceId} Approved & Emailed successfully via Crinza API!`,
    });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Approval failed",
        error: err.message || "Internal error",
      });
  }
});

app.put("/api/invoices/update/:id", verifyToken, async (req, res) => {
  try {
    if (
      req.user.role !== "accountant" &&
      req.user.role !== "boss" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: 'after' },
    );
    res.json({ message: "Invoice updated!", invoice: updatedInvoice });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
});

app.post("/api/invoices/reject/:id", verifyToken, async (req, res) => {
  try {
    if (
      req.user.role !== "accountant" &&
      req.user.role !== "boss" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const { rejectionReason } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    invoice.status = "rejected";
    invoice.rejectionReason = rejectionReason || "Verification failed";
    await invoice.save();

    res.json({ message: `Invoice #${invoice.invoiceId} rejected.` });
  } catch (err) {
    res.status(500).json({ message: "Rejection failed", error: err.message });
  }
});

// =========================================================================
// --- 👤 SALESPERSON SPECIFIC ROUTES ---
// =========================================================================

// --- 🌟 SAVE FCM TOKEN ROUTE ---
app.post("/api/salesperson/save-fcm-token", verifyToken, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    await User.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: { fcmToken } }
    );

    res.json({ success: true, message: "FCM Token saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save FCM token", error: err.message });
  }
});

// --- ⏱️ DAY START / END SHIFT API ROUTES ---
app.get("/api/salesperson/day-status", verifyToken, async (req, res) => {
  try {
    // 🌟 Correct IST Date string (YYYY-MM-DD)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today });
    
    if (!session) {
      return res.json({ status: "NOT_STARTED", session: null });
    }
    res.json({ 
      status: session.status, 
      startAddress: session.startAddress || "", 
      session 
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch day status", error: err.message });
  }
});


app.post("/api/salesperson/start-day", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const existing = await DaySession.findOne({ salespersonId: req.user.userId, date: today });

    if (existing && existing.status === "STARTED") {
      return res.status(400).json({ message: "Working day has already been started today!" });
    }
    if (existing && existing.status === "ENDED") {
      return res.status(400).json({ message: "You have already ended your day today. Cannot restart." });
    }

    const { latitude, longitude, startAddress } = req.body;
    const newSession = new DaySession({
      salespersonId: req.user.userId,
      date: today,
      status: "STARTED",
      startTime: new Date(),
      startLocation: { latitude: Number(latitude) || 0, longitude: Number(longitude) || 0 },
      startAddress: startAddress || ""
    });

    await newSession.save();
    res.status(201).json({ success: true, message: "Day started successfully!", startAddress: newSession.startAddress, session: newSession });
  } catch (err) {
    res.status(500).json({ message: "Failed to start day", error: err.message });
  }
});

app.post("/api/salesperson/end-day", verifyToken, async (req, res) => {
  try {
    // 🌟 Forcefully get exact correct IST Date string (YYYY-MM-DD)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });

    if (!session) {
      return res.status(400).json({ message: "No active day session found to end!" });
    }

    const { latitude, longitude } = req.body;

    const routeLogs = await LocationLog.find({ salespersonId: req.user.userId, date: today }).sort({ timestamp: 1 });
    const computedDistance = calculateValidDistance(routeLogs);

    const endTimeDate = new Date();

    session.status = "ENDED";
    session.endTime = endTimeDate;
    session.endLocation = { latitude: Number(latitude) || 0, longitude: Number(longitude) || 0 };
    session.totalDistanceKm = computedDistance;
    await session.save();

    const totalVisitsToday = await Lead.countDocuments({ salespersonId: req.user.userId, leadDate: today });
    const approvedInvoicesToday = await Invoice.find({ salespersonId: req.user.userId, status: "approved" });
    
    const totalCollectedToday = approvedInvoicesToday.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
    const workingMilliseconds = endTimeDate - new Date(session.startTime);
    const workingHours = (workingMilliseconds / (1000 * 60 * 60)).toFixed(1);

    // 🌟 Bulletproof IST Formatter (Bypasses hosting server timezone misconfigurations)
    const formatISTTime = (dateValue) => {
      const d = new Date(dateValue);
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    res.json({
      success: true,
      message: "Day ended successfully. Entries are now locked for today.",
      summary: {
        startTime: formatISTTime(session.startTime), // ✅ Ab ye bilkul sahi Indian Time (IST) dega
        endTime: formatISTTime(session.endTime),     // ✅ Ab ye bhi bilkul sahi Indian Time (IST) dega
        workingHours: `${workingHours} hrs`,
        totalVisits: totalVisitsToday,
        totalCollected: totalCollectedToday,
        totalDistanceKm: computedDistance
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to end day", error: err.message });
  }
});



app.get("/api/salesperson/notifications", verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ 
      salespersonId: req.user.userId, 
      status: "pending" 
    }).sort({ createdAt: -1 });

    const formattedNotifications = tasks.map((t) => ({
      _id: t._id,
      title: `${t.taskType.toUpperCase()} Reminder`,
      message: `Pending task for institute: ${t.instituteName}`,
      isRead: false,
      createdAt: t.createdAt,
    }));

    res.json(formattedNotifications);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications", error: err.message });
  }
});

app.put("/api/salesperson/notifications/:id/dismiss", verifyToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = await Task.findOneAndUpdate(
      { _id: taskId, salespersonId: req.user.userId },
      { $set: { status: "completed" } },
      { returnDocument: 'after' }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found or unauthorized" });
    }

    res.json({ success: true, message: "Notification dismissed successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to dismiss notification", error: err.message });
  }
});

app.get("/api/salesperson/my-deals", verifyToken, async (req, res) => {
  try {
    const rawDeals = await Invoice.find({ 
      salespersonId: req.user.userId,
      status: { $ne: 'rejected' }
    }).sort({
      createdAt: 1, 
    });

    const consolidatedMap = {};

    rawDeals.forEach((deal) => {
      const key = (deal.instituteName || "Unknown").trim().toLowerCase();

      if (!consolidatedMap[key]) {
        consolidatedMap[key] = {
          ...deal.toObject(),
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
        };
      }

      if (deal.baseAmount > 0) {
        consolidatedMap[key].totalAmount = Number(deal.totalAmount) || 0;
      }
      consolidatedMap[key].paidAmount += (Number(deal.paidAmount) || 0);

      consolidatedMap[key].dueAmount = Math.max(
        0,
        consolidatedMap[key].totalAmount - consolidatedMap[key].paidAmount
      );
    });

    const finalConsolidatedDeals = Object.values(consolidatedMap);
    res.json(finalConsolidatedDeals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch deals history", error: err.message });
  }
});

app.get("/api/salesperson/my-leads", verifyToken, async (req, res) => {
  try {
    const leads = await Lead.find({ salespersonId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json(leads);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch leads history", error: err.message });
  }
});

app.post(
  "/api/salesperson/leads",
  verifyToken,
  upload.single("meetingPhoto"),
  async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today });
      if (!session || session.status !== "STARTED") {
        return res.status(403).json({ message: "Action Blocked: You must start your working day first before recording visits or leads!" });
      }

      const {
        instituteName,
        contactPerson,
        mobileNo,
        email,
        address,
        pincode,
        city,
        state,
        notes,
        latitude,
        longitude,
        followUpDate,
        followUpTime,
        followUpAction,
      } = req.body;

      if (!mobileNo || !city || !state) {
        return res
          .status(400)
          .json({
            message: "Mandatory fields (Mobile No, City, State) are missing!",
          });
      }

      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().substring(0, 5);

      // 🌟 Cloudinary Direct Secure URL
      const normalizedPath = req.file ? req.file.path : "";

      const existingLead = await Lead.findOne({
        salespersonId: req.user.userId,
        mobileNo: mobileNo.trim(),
      });

      if (existingLead) {
        existingLead.visitCount = (existingLead.visitCount || 1) + 1;
        existingLead.leadDate = currentDate;
        existingLead.leadTime = currentTime;
        if (instituteName) existingLead.instituteName = instituteName;
        if (contactPerson) existingLead.contactPerson = contactPerson;
        if (notes) {
          existingLead.notes = existingLead.notes
            ? `${existingLead.notes}\n[Visit #${existingLead.visitCount} - ${currentDate} ${currentTime}]: ${notes}`
            : `[Visit #${existingLead.visitCount} - ${currentDate} ${currentTime}]: ${notes}`;
        }
        if (normalizedPath) existingLead.meetingPhoto = normalizedPath;
        if (followUpDate) {
          existingLead.followUpDate = followUpDate;
          existingLead.followUpTime = followUpTime || "";
          existingLead.followUpAction = followUpAction || "Call";
        }

        await existingLead.save();

        if (followUpDate) {
          await Task.create({
            salespersonId: req.user.userId,
            instituteName: existingLead.instituteName,
            taskType: followUpAction?.toLowerCase().includes("demo")
              ? "demo"
              : "call",
            notes:
              notes ||
              `Follow-up scheduled (Visit #${existingLead.visitCount})`,
            dueDate: followUpDate,
          });
        }

        return res.status(200).json({
          success: true,
          message: `Visit #${existingLead.visitCount} logged successfully for existing lead!`,
          lead: existingLead,
        });
      }

      const newLead = new Lead({
        instituteName: instituteName || "Unknown Institute",
        contactPerson: contactPerson || "N/A",
        mobileNo: mobileNo.trim(),
        email: email || "",
        address: address || "",
        pincode: pincode || "",
        city,
        state,
        notes: notes || "",
        meetingPhoto: normalizedPath,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        leadDate: currentDate,
        leadTime: currentTime,
        visitCount: 1,
        followUpDate: followUpDate || null,
        followUpTime: followUpTime || "",
        followUpAction: followUpAction || "Call",
        salespersonId: req.user.userId,
      });

      await newLead.save();

      if (followUpDate) {
        await Task.create({
          salespersonId: req.user.userId,
          instituteName: newLead.instituteName,
          taskType: followUpAction?.toLowerCase().includes("demo")
            ? "demo"
            : "call",
          notes: notes || `Follow-up scheduled: ${followUpAction}`,
          dueDate: followUpDate,
        });
      }

      res
        .status(201)
        .json({
          success: true,
          message: "New lead and visit recorded successfully!",
          lead: newLead,
        });
    } catch (err) {
      console.error("Lead submission error:", err);
      res
        .status(500)
        .json({ message: "Failed to save lead", error: err.message });
    }
  },
);

app.put("/api/salesperson/leads/:id", verifyToken, upload.single("meetingPhoto"), async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today });
    if (!session || session.status !== "STARTED") {
      return res.status(403).json({ message: "Action Blocked: Working day must be active to update leads!" });
    }

    const {
      demoStatus,
      leadStatus,
      notes,
      followUpDate,
      followUpTime,
      followUpAction,
    } = req.body;

    const updateFields = {
      demoStatus,
      leadStatus,
      notes,
      followUpDate,
      followUpTime,
      followUpAction,
    };

    if (req.file) {
      updateFields.meetingPhoto = req.file.path;
    }

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { returnDocument: 'after' },
    );

    if (!updatedLead)
      return res.status(404).json({ message: "Lead not found" });
    
    if (followUpDate) {
      await Task.create({
        salespersonId: req.user.userId,
        instituteName: updatedLead.instituteName,
        taskType: followUpAction?.toLowerCase().includes("demo") ? "demo" : "call",
        notes: notes || `Rescheduled follow-up`,
        dueDate: followUpDate,
      });
    }

    res.json({ message: "Lead updated successfully!", lead: updatedLead });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update lead", error: err.message });
  }
});

app.get("/api/salesperson/tasks", verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ salespersonId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json(tasks);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch tasks", error: err.message });
  }
});

app.post("/api/coupons/verify", verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code required" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon)
      return res.status(404).json({ message: "Invalid coupon code!" });

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ message: "This coupon has expired!" });
    }

    res.json({
      message: "Coupon applied successfully!",
      code: coupon.code,
      discountType: coupon.type,
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Server error verifying coupon", error: err.message });
  }
});

// =========================================================================
// --- 🌐 SERVER LISTENER ---
// =========================================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT} with Socket.io Live Tracking, Day Shift Control, Cloudinary Uploads & FCM Push Enabled`,
  );
});