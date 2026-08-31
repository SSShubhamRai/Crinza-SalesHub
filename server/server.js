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


const SalespersonPoint = require("./models/SalespersonPoint");

const {
  addSalespersonPoints,
} = require("./utils/salespersonPoints");



const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require("@simplewebauthn/server");


// --- Firebase Admin Initialization (Node v24 Compatible) ---
try {
  const { initializeApp, cert, getApps } = require("firebase-admin/app");
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

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

const callRecordingStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "crinza_call_recordings",
    resource_type: "video",
  },
});

const uploadCallRecording = multer({
  storage: callRecordingStorage,
  limits: {
    fileSize: 50 * 1024 * 1024,
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
// --- 📞 CALL TRACKING SCHEMA ---
// =========================================================================

const callLogSchema = new mongoose.Schema(
  {
    salespersonId: {
      type: String,
      required: true,
      index: true,
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },

    customerName: {
      type: String,
      default: "",
    },

    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },

    // CALL INITIATED / CONNECTED / NOT_CONNECTED / MISSED / REJECTED
    status: {
      type: String,
      enum: [
        "INITIATED",
        "CONNECTED",
         "ENDED",
        "NOT_CONNECTED",
        "MISSED",
        "REJECTED",
        "FAILED",
      ],
      default: "INITIATED",
      index: true,
    },

    dialedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    connectedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    durationSeconds: {
      type: Number,
      default: 0,
    },

    // Future audio-recording support
    recordingUrl: {
      type: String,
      default: "",
    },

    recordingConsent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Faster analytics queries
callLogSchema.index({
  salespersonId: 1,
  dialedAt: -1,
});

callLogSchema.index({
  salespersonId: 1,
  phoneNumber: 1,
  dialedAt: -1,
});

const CallLog = mongoose.model("CallLog", callLogSchema);

const reportLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Weekly", "Monthly"],
      required: true,
    },

    period: {
      type: String,
      required: true,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Same report ko duplicate send hone se rokega
reportLogSchema.index(
  { type: 1, period: 1 },
  { unique: true }
);

const ReportLog = mongoose.model("ReportLog", reportLogSchema);

// =========================================================================
// --- 🛠️ TECHNICAL / APP PRODUCTION PROJECT SCHEMA ---
// =========================================================================
const technicalTaskSchema = new mongoose.Schema({
  projectId: { type: String, unique: true },
  invoiceId: { type: String, required: true },
  instituteName: { type: String, required: true },
  appName: { type: String, required: true },
  packageValidity: { type: String, default: "1 Year" },
  addons: { type: Object, default: {} },
  logoProof: { type: String, default: "" },
  assignedTechId: { type: String, default: "" },   // Developer ka userId (e.g. TECH101)
  assignedTechName: { type: String, default: "" }, // Developer ka naam
  status: {
    type: String,
    enum: ["Unassigned", "Assigned", "In Progress", "Testing", "Delivered"],
    default: "Unassigned"
  },
  assignedAt: { type: Date },                      // Kab assign hua
  deliveredAt: { type: Date },                     // Kab deliver hua
  createdAt: { type: Date, default: Date.now }
});
const TechnicalTask = mongoose.model("TechnicalTask", technicalTaskSchema);

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

  salespersonId: {
    type: String,
    required: true,
    index: true
  },

  date: {
    type: String,
    required: true,
    index: true
  }, // YYYY-MM-DD

  status: {
    type: String,
    enum: ["STARTED", "ENDED"],
    default: "STARTED"
  },

  startTime: {
    type: Date,
    default: Date.now
  },

  // 📍 Start Day Location - Point A
  startLocation: {
    latitude: Number,
    longitude: Number,
  },

  startAddress: {
    type: String,
    default: ""
  },

  // 📍 All important activity locations
  // A = Start Day
  // B = Lead
  // C = Invoice
  // D = Lead
  // E = End Day
  distancePoints: [
    {
      type: {
        type: String,
        enum: ["START", "LEAD", "INVOICE", "END"],
        required: true
      },

      referenceId: {
        type: String,
        default: null
      },

      latitude: {
        type: Number,
        required: true
      },

      longitude: {
        type: Number,
        required: true
      },

      timestamp: {
        type: Date,
        default: Date.now
      },

      distanceFromPreviousKm: {
        type: Number,
        default: 0
      },

      totalDistanceKm: {
        type: Number,
        default: 0
      }
    }
  ],

  // 📍 End Day Location - final point
  endTime: {
    type: Date
  },

  endLocation: {
    latitude: Number,
    longitude: Number,
  },

  // 🔢 Final/Current total distance
  totalDistanceKm: {
    type: Number,
    default: 0
  },

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

// 🌟 Local Distance Calculation with 200 Meters Threshold & Road Factor
function calculateValidDistance(coordinatesList) {
  let straightDistance = 0;

  const MIN_DISTANCE_THRESHOLD = 0.03; // 30 meters
  const ROAD_FACTOR = 1.8; // compulsory road adjustment factor

  for (let i = 1; i < coordinatesList.length; i++) {
    const prev = coordinatesList[i - 1];
    const curr = coordinatesList[i];

    if (
      !Number.isFinite(Number(prev.latitude)) ||
      !Number.isFinite(Number(prev.longitude)) ||
      !Number.isFinite(Number(curr.latitude)) ||
      !Number.isFinite(Number(curr.longitude))
    ) {
      continue;
    }

    const dist = calculateDistance(
      Number(prev.latitude),
      Number(prev.longitude),
      Number(curr.latitude),
      Number(curr.longitude)
    );

    // Ignore movements smaller than 30 meters
    if (dist >= MIN_DISTANCE_THRESHOLD) {
      straightDistance += dist;
    }
  }

  // Apply compulsory road factor
  const totalRoadwayDistance = straightDistance * ROAD_FACTOR;

  return Number(totalRoadwayDistance.toFixed(2));
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

    // ============================================================
    // 📍 1. VALIDATE LOCATION
    // ============================================================

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !salespersonId ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return;
    }

    // ============================================================
    // 🔐 2. AUTHORIZATION
    // ============================================================

    if (
      socket.user.userId !== salespersonId &&
      socket.user.role !== "admin" &&
      socket.user.role !== "boss"
    ) {
      return;
    }

    // ============================================================
    // 🇮🇳 3. CURRENT IST DATE
    // ============================================================

    const currentDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const currentTime = new Date();

    // ============================================================
    // 🟢 4. ONLY TRACK DURING ACTIVE DAY
    // ============================================================

    const activeSession = await DaySession.findOne({
      salespersonId,
      date: currentDate,
      status: "STARTED",
    });

    if (!activeSession) {
      return;
    }

    // ============================================================
    // 📍 5. GET LAST SAVED GPS LOCATION
    // ============================================================

    const lastLog = await LocationLog.findOne({
      salespersonId,
      date: currentDate,
      timestamp: {
        $gte: new Date(activeSession.startTime),
      },
    }).sort({
      timestamp: -1,
    });

    let isMockedByTeleport = false;
    let distanceKm = 0;
    let timeDiffHours = 0;

    // ============================================================
    // 🚨 6. TELEPORT / FAKE GPS DETECTION
    // ============================================================

    if (lastLog) {
      distanceKm = calculateDistance(
        Number(lastLog.latitude),
        Number(lastLog.longitude),
        lat,
        lng
      );

      timeDiffHours =
        (currentTime - new Date(lastLog.timestamp)) /
        (1000 * 60 * 60);

      if (timeDiffHours > 0) {
        const speedKmh = distanceKm / timeDiffHours;

        if (speedKmh > 150) {
          isMockedByTeleport = true;

          console.warn(
            `🚨 SECURITY ALERT: Possible Fake GPS / Teleportation detected for ${salespersonId}! Speed: ${speedKmh.toFixed(
              2
            )} km/h`
          );
        }
      }
    }

    // ============================================================
    // ⏰ 7. 20-MINUTE INTERVAL DISTANCE CALCULATION
    // ============================================================
    if (!Array.isArray(activeSession.distancePoints)) {
      activeSession.distancePoints = [];
    }

    const lastPoint = activeSession.distancePoints[activeSession.distancePoints.length - 1];
    let shouldAddDistance = false;
    let incrementalDist = 0;

    if (!isMockedByTeleport) {
      if (lastPoint) {
        const timeDiffMinutes = (currentTime - new Date(lastPoint.timestamp)) / (1000 * 60);

        // Check if 20 minutes have elapsed since the last recorded checkpoint
        if (timeDiffMinutes >= 20) {
          const rawDist = calculateDistance(
            Number(lastPoint.latitude),
            Number(lastPoint.longitude),
            lat,
            lng
          );

          // Minimum 50 meters movement threshold to avoid stationary noise
          if (rawDist >= 0.05) {
            incrementalDist = rawDist * 1.3; // Road factor adjustment
            shouldAddDistance = true;
          }
        }
      } else {
        // First checkpoint after starting the day
        shouldAddDistance = true;
      }
    }

    if (shouldAddDistance && incrementalDist > 0) {
      const newTotal = (Number(activeSession.totalDistanceKm) || 0) + incrementalDist;
      activeSession.totalDistanceKm = Number(newTotal.toFixed(3));

      activeSession.distancePoints.push({
        type: "INTERVAL_CHECKPOINT",
        latitude: lat,
        longitude: lng,
        timestamp: currentTime,
        distanceFromPreviousKm: Number(incrementalDist.toFixed(3)),
        totalDistanceKm: activeSession.totalDistanceKm,
      });

      await activeSession.save();
    }

    // ============================================================
    // 💾 8. SAVE LOCATION LOG
    // ============================================================

    const newLocationLog = await LocationLog.create({
      salespersonId,
      latitude: lat,
      longitude: lng,
      date: currentDate,
      timestamp: currentTime,
      isMocked: isMockedByTeleport,
    });

    // ============================================================
    // 📡 9. BROADCAST LIVE LOCATION & CURRENT SESSION DISTANCE
    // ============================================================

    io.emit("live_location_broadcast", {
      salespersonId,
      latitude: lat,
      longitude: lng,
      isMocked: isMockedByTeleport,
      timestamp: currentTime,
      totalDistanceKm: activeSession.totalDistanceKm,
      locationLogId: newLocationLog._id,
    });

  } catch (err) {
    console.error(
      "🔥 Socket Location Error:",
      err
    );
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

// ============================================================
// 📞 ADMIN / BOSS — SALESPERSON CALL ANALYTICS
// ============================================================

app.get(
  "/api/boss/salesperson-call-analytics/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      if (
        req.user.role !== "admin" &&
        req.user.role !== "boss"
      ) {
        return res.status(403).json({
          message: "Access denied!",
        });
      }

      const { salespersonId } = req.params;
      const { from, to } = req.query;

      const match = {
        salespersonId,
      };

      if (from || to) {
        match.dialedAt = {};

        if (from) {
          const fromDate = new Date(`${from}T00:00:00`);
          match.dialedAt.$gte = fromDate;
        }

        if (to) {
          const toDate = new Date(`${to}T23:59:59.999`);
          match.dialedAt.$lte = toDate;
        }
      }

      const logs = await CallLog.find(match)
        .sort({ dialedAt: -1 });

      const totalDials = logs.length;

      const uniquePhones = new Set(
        logs.map((call) => call.phoneNumber)
      );

      const connectedCalls = logs.filter(
        (call) =>
          call.status === "CONNECTED" ||
          call.status === "ENDED"
      ).length;

      const notConnectedCalls = logs.filter(
        (call) =>
          call.status === "NOT_CONNECTED" ||
          call.status === "MISSED" ||
          call.status === "REJECTED" ||
          call.status === "FAILED"
      ).length;

      const totalDurationSeconds = logs.reduce(
        (sum, call) =>
          sum + (Number(call.durationSeconds) || 0),
        0
      );

      const averageDurationSeconds =
        connectedCalls > 0
          ? Math.floor(
              totalDurationSeconds / connectedCalls
            )
          : 0;

      const duplicateDials =
        totalDials - uniquePhones.size;

      return res.json({
        success: true,
        salespersonId,

        analytics: {
          totalDials,
          uniqueDials: uniquePhones.size,
          duplicateDials,
          connectedCalls,
          notConnectedCalls,
          totalDurationSeconds,
          averageDurationSeconds,
        },
      });
    } catch (err) {
      console.error(
        "Admin salesperson call analytics error:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to fetch salesperson call analytics",
        error: err.message,
      });
    }
  }
);

app.get(
  "/api/boss/salesperson-points/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      // Only admin/boss can access
      if (
        req.user.role !== "admin" &&
        req.user.role !== "boss"
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied!",
        });
      }

      const { salespersonId } = req.params;
      const { from, to } = req.query;

      // -----------------------------
      // Date validation
      // -----------------------------
      if (!from || !to) {
        return res.status(400).json({
          success: false,
          message: "from and to dates are required",
        });
      }

      const fromDate = new Date(`${from}T00:00:00+05:30`);
      const toDate = new Date(`${to}T23:59:59.999+05:30`);

      if (
        Number.isNaN(fromDate.getTime()) ||
        Number.isNaN(toDate.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid date range",
        });
      }

      if (fromDate > toDate) {
        return res.status(400).json({
          success: false,
          message: "From date cannot be after To date",
        });
      }

      // -----------------------------
      // Get points for selected range
      // -----------------------------
      const pointRecords = await SalespersonPoint.find({
        salespersonId,
        date: {
          $gte: from,
          $lte: to,
        },
      })
        .sort({ date: 1 })
        .lean();

      // -----------------------------
      // Get actual Start Day records
      // -----------------------------
      const workingDayRecords = await DaySession.find({
        salespersonId,
        date: {
          $gte: from,
          $lte: to,
        },
        status: "STARTED",
      })
        .sort({ date: 1 })
        .lean();

      // -----------------------------
      // Unique working days
      // -----------------------------
      const workingDates = [
        ...new Set(
          workingDayRecords.map((session) => session.date)
        ),
      ];

      const workingDays = workingDates.length;

      // -----------------------------
      // Total points
      // -----------------------------
      const totalPoints = pointRecords.reduce(
        (sum, record) =>
          sum + (Number(record.totalPoints) || 0),
        0
      );

      // -----------------------------
      // Average points
      // -----------------------------
      const averagePoints =
        workingDays > 0
          ? Number((totalPoints / workingDays).toFixed(2))
          : 0;

      // -----------------------------
      // Daily breakdown
      // -----------------------------
      const pointsByDate = {};

      pointRecords.forEach((record) => {
        pointsByDate[record.date] =
          (pointsByDate[record.date] || 0) +
          (Number(record.totalPoints) || 0);
      });

      const dailyBreakdown = workingDates.map((date) => {
        const pointRecord = pointRecords.find(
          (record) => record.date === date
        );

        return {
          date,

          startedDay: true,

          totalPoints:
            pointsByDate[date] || 0,

          breakdown: {
            leadsCreated:
              pointRecord?.leadsCreated || 0,

            revisits:
              pointRecord?.revisits || 0,

            demosDone:
              pointRecord?.demosDone || 0,

            dealsClosed:
              pointRecord?.dealsClosed || 0,

            callsConnected:
              pointRecord?.callsConnected || 0,

            dialCalls:
              pointRecord?.dialCalls || 0,
          },
        };
      });

      return res.json({
        success: true,

        salespersonId,

        dateRange: {
          from,
          to,
        },

        summary: {
          totalPoints,
          workingDays,
          averagePoints,
          targetPerDay: 100,

          targetAchievement:
            workingDays > 0
              ? Number(
                  (
                    (totalPoints /
                      (workingDays * 100)) *
                    100
                  ).toFixed(2)
                )
              : 0,
        },

        dailyBreakdown,
      });
    } catch (err) {
      console.error(
        "❌ Salesperson points analytics error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch salesperson points analytics",
        error: err.message,
      });
    }
  }
);

// ============================================================
// 📞 ADMIN / BOSS — SALESPERSON CALL HISTORY
// ============================================================

app.get(
  "/api/boss/salesperson-call-history/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      if (
        req.user.role !== "admin" &&
        req.user.role !== "boss"
      ) {
        return res.status(403).json({
          message: "Access denied!",
        });
      }

      const { salespersonId } = req.params;
      const { from, to } = req.query;

      const query = {
        salespersonId,
      };

      if (from || to) {
        query.dialedAt = {};

        if (from) {
          query.dialedAt.$gte =
            new Date(`${from}T00:00:00`);
        }

        if (to) {
          query.dialedAt.$lte =
            new Date(`${to}T23:59:59.999`);
        }
      }

      const calls = await CallLog.find(query)
        .sort({ dialedAt: -1 })
        .limit(500);

      return res.json({
        success: true,
        salespersonId,
        calls,
      });
    } catch (err) {
      console.error(
        "Admin salesperson call history error:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to fetch salesperson call history",
        error: err.message,
      });
    }
  }
);

// --- 👑 ADMIN: Get All Technical Projects ---
app.get("/api/boss/technical-projects", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const projects = await TechnicalTask.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch technical projects", error: err.message });
  }
});

// --- 👑 ADMIN: Assign Project to Developer ---
app.put("/api/boss/technical-projects/assign/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { techId, techName } = req.body;

    const updated = await TechnicalTask.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          assignedTechId: techId,
          assignedTechName: techName,
          status: "Assigned",
          assignedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    res.json({ success: true, message: `Project successfully assigned to ${techName}!`, project: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign project", error: err.message });
  }
});

// --- 💻 TECHNICAL TEAM: Get My Assigned Projects ---
app.get("/api/technical/my-projects", verifyToken, async (req, res) => {
  try {
    const projects = await TechnicalTask.find({ assignedTechId: req.user.userId }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your projects", error: err.message });
  }
});

// --- 💻 TECHNICAL TEAM: Update Project Status ---
app.put("/api/technical/projects/status/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body; // 'In Progress', 'Testing', 'Delivered'
    const updateData = { status };

    if (status === "Delivered") {
      updateData.deliveredAt = new Date();
    }

    const updated = await TechnicalTask.findOneAndUpdate(
      { _id: req.params.id, assignedTechId: req.user.userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({ message: "Project not found or not assigned to you" });
    }

    res.json({ success: true, message: `Project status updated to ${status}!`, project: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update status", error: err.message });
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
      { $match: { status: { $ne: "rejected" } } }, // 👈 Yahan bhi approved ki jagah non-rejected kar diya
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

// =========================================================================
// --- 📍 ADMIN / BOSS: SALESPERSON TRAVEL HISTORY & TOTAL DISTANCE ---
// =========================================================================
app.get(
  "/api/boss/salesperson-travel/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "boss" && req.user.role !== "admin") {
        return res.status(403).json({
          message: "Access denied!",
        });
      }

      const { salespersonId } = req.params;
      const { date, startDate, endDate } = req.query;

      const todayIST = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      let selectedStartDate;
      let selectedEndDate;

      if (startDate && endDate) {
        selectedStartDate = startDate;
        selectedEndDate = endDate;
      } else if (startDate) {
        selectedStartDate = startDate;
        selectedEndDate = startDate;
      } else if (date) {
        selectedStartDate = date;
        selectedEndDate = date;
      } else {
        selectedStartDate = todayIST;
        selectedEndDate = todayIST;
      }

      // 1️⃣ GPS Location Logs (Range ke mutabiq)
      const logs = await LocationLog.find({
        salespersonId,
        date: {
          $gte: selectedStartDate,
          $lte: selectedEndDate,
        },
      })
        .sort({ timestamp: 1 })
        .lean();

      // 2️⃣ Last Live Location
      const lastLiveLog = await LocationLog.findOne({
        salespersonId,
        date: selectedEndDate,
      })
        .sort({ timestamp: -1 })
        .lean();

      let lastLiveLocation = null;
      if (lastLiveLog) {
        lastLiveLocation = {
          latitude: Number(lastLiveLog.latitude),
          longitude: Number(lastLiveLog.longitude),
          timestamp: lastLiveLog.timestamp,
        };
      }

      // 3️⃣ 🌟 FIX: Date Range ke saare DaySessions fetch karo aur total distance sum karo!
      const sessions = await DaySession.find({
        salespersonId,
        date: {
          $gte: selectedStartDate,
          $lte: selectedEndDate,
        },
      }).lean();

      let totalDistanceKm = 0;
      let allDistancePoints = [];
      let latestSession = sessions[sessions.length - 1] || null;

      sessions.forEach((sess) => {
        totalDistanceKm += Number(sess.totalDistanceKm) || 0;
        if (sess.distancePoints && Array.isArray(sess.distancePoints)) {
          allDistancePoints = allDistancePoints.concat(sess.distancePoints);
        }
      });

      // Response return karein
      return res.json({
        success: true,
        salespersonId,
        startDate: selectedStartDate,
        endDate: selectedEndDate,
        totalDistanceKm: Number(totalDistanceKm.toFixed(3)),
        lastLiveLocation,
        sessionStatus: latestSession?.status || null,
        startTime: latestSession?.startTime || null,
        endTime: latestSession?.endTime || null,
        startLocation: latestSession?.startLocation || null,
        endLocation: latestSession?.endLocation || null,
        distancePoints: allDistancePoints,
        routePoints: logs,
      });
    } catch (err) {
      console.error("❌ Failed to fetch salesperson travel:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch travel history",
        error: err.message,
      });
    }
  }
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
    if (req.user.role !== "boss" && req.user.role !== "admin" && req.user.role !== "telecaller") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const employees = await User.find({
      role: { $in: ["salesperson", "accountant", "technical", "telecaller"] },
    }).select("-password");
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employees", error: err.message });
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
          status: { $ne: "rejected" }
        },
      },
      {
        $group: {
          _id: "$salespersonId",
          salespersonId: { $first: "$salespersonId" },
          totalDeals: { $sum: 1 },
          approvedDeals: {
            $sum: { $cond: [{ $ne: ["$status", "rejected"] }, 1, 0] },
          },
          pendingDeals: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          rejectedDeals: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          totalBusiness: {
            $sum: {
              $cond: [{ $ne: ["$status", "rejected"] }, "$totalAmount", 0],
            },
          },
          totalPaid: {
            $sum: {
              $cond: [{ $ne: ["$status", "rejected"] }, "$paidAmount", 0],
            },
          },
        },
      },
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({
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
    // ============================================================
    // 🇮🇳 TODAY'S DATE - IST
    // ============================================================

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    // ============================================================
    // 🔐 GET ACTIVE DAY SESSION
    // ============================================================

    const session = await DaySession.findOne({
      salespersonId: req.user.userId,
      date: today,
    });

    if (!session || session.status !== "STARTED") {
      return res.status(403).json({
        message:
          "Action Blocked: You must start your day first before submitting invoices!",
      });
    }

    // ============================================================
    // 📍 VALIDATE INVOICE LOCATION
    // ============================================================

    const invoiceLatitude = Number(req.body.latitude);
    const invoiceLongitude = Number(req.body.longitude);

    if (
      !Number.isFinite(invoiceLatitude) ||
      !Number.isFinite(invoiceLongitude)
    ) {
      return res.status(400).json({
        message:
          "Valid latitude and longitude are required to calculate invoice travel distance.",
      });
    }

    // ============================================================
    // 🧾 GENERATE INVOICE ID
    // ============================================================

    const invoiceId =
      "CRINZA-" + Date.now().toString().slice(-6);

    // ============================================================
    // 📦 PARSE ADDONS
    // ============================================================

    let parsedAddons = {
      testModule: false,
      windowApp: false,
      iosApp: false,
    };

    if (req.body.addons) {
      try {
        parsedAddons =
          typeof req.body.addons === "string"
            ? JSON.parse(req.body.addons)
            : req.body.addons;
      } catch (e) {
        console.log("⚠️ Failed to parse addons:", e.message);
      }
    }

    // ============================================================
    // 📦 PARSE CATEGORIES
    // ============================================================

    let parsedCategories = [];

    if (req.body.categories) {
      try {
        parsedCategories =
          typeof req.body.categories === "string"
            ? JSON.parse(req.body.categories)
            : req.body.categories;
      } catch (e) {
        parsedCategories = [req.body.categories];
      }
    }

    // ============================================================
    // ☁️ CLOUDINARY FILES
    // ============================================================

    const paymentProofPath =
      req.files &&
      req.files["paymentProof"]
        ? req.files["paymentProof"][0].path
        : "";

    const logoProofPath =
      req.files &&
      req.files["logoProof"]
        ? req.files["logoProof"][0].path
        : "";

    // ============================================================
    // 👤 OWNER / VALIDITY
    // ============================================================

    const {
      ownerName,
      validityYears,
      validityMonths,
    } = req.body;

    const yearsNum = Number(validityYears) || 0;
    const monthsNum = Number(validityMonths) || 0;

    let computedValidity =
      req.body.packageValidity || "1 Year";

    if (yearsNum > 0 || monthsNum > 0) {
      const yPart =
        yearsNum > 0
          ? `${yearsNum} Year${yearsNum > 1 ? "s" : ""}`
          : "";

      const mPart =
        monthsNum > 0
          ? `${monthsNum} Month${monthsNum > 1 ? "s" : ""}`
          : "";

      computedValidity = [yPart, mPart]
        .filter(Boolean)
        .join(" ");
    }

    // ============================================================
    // 💳 PAYMENT INFORMATION
    // ============================================================

    const paymentMode =
      req.body.paymentMode || "ONLINE";

    const utrNumber = req.body.utrNumber
      ? req.body.utrNumber.trim()
      : "";

    const claimedPaid =
      Number(req.body.paidAmount) || 0;

    // ============================================================
    // 🤖 OCR STATUS
    // ============================================================

    let ocrStatus = "PENDING";
    let ocrMessage = "Manual review required";

    // ============================================================
    // 🔍 UTR DUPLICATE CHECK
    // ============================================================

    if (paymentMode === "ONLINE" && utrNumber) {
      const existingUtrCheck =
        await Invoice.findOne({
          utrNumber: utrNumber,
          status: {
            $in: ["pending", "approved"],
          },
        });

      if (existingUtrCheck) {
        ocrStatus = "RED";

        ocrMessage =
          `Fraud Alert: UTR "${utrNumber}" already used in Invoice #${existingUtrCheck.invoiceId}!`;
      }
    }

    // ============================================================
    // 🤖 OCR PAYMENT PROOF
    // ============================================================

    if (
      paymentMode === "ONLINE" &&
      paymentProofPath &&
      utrNumber &&
      ocrStatus !== "RED"
    ) {
      try {
        console.log(
          "🔍 Running AI OCR Scan on payment proof..."
        );

        const {
          data: { text },
        } = await Tesseract.recognize(
          paymentProofPath,
          "eng"
        );

        const cleanedText =
          text.replace(/[\s,]/g, "");

        const isAmountMatched =
          cleanedText.includes(
            claimedPaid.toString()
          );

        const isUtrMatched =
          cleanedText.includes(utrNumber);

        if (isUtrMatched && isAmountMatched) {
          ocrStatus = "GREEN";
          ocrMessage =
            "AI Verified: UTR & Amount Matched 100%";
        } else {
          ocrStatus = "YELLOW";
          ocrMessage =
            "Mismatch Warning: Entered UTR or Amount differs from screenshot!";
        }
      } catch (ocrErr) {
        ocrStatus = "YELLOW";
        ocrMessage =
          "OCR scan failed to read image clearly.";
      }
    } else if (paymentMode !== "ONLINE") {
      ocrStatus = "GREEN";
      ocrMessage = "Offline Payment Mode";
    }

    // ============================================================
    // 🧾 CREATE INVOICE
    // ============================================================

    const newInvoice = new Invoice({
      ...req.body,

      categories: parsedCategories,

      ownerName: ownerName || "",

      validityYears: yearsNum,

      validityMonths: monthsNum,

      packageValidity: computedValidity,

      baseAmount:
        Number(req.body.baseAmount) ||
        Number(req.body.totalAmount) ||
        0,

      totalAmount:
        Number(req.body.totalAmount) || 0,

      paidAmount: claimedPaid,

      dueAmount:
        Number(req.body.dueAmount) || 0,

      previousDueBalance:
        Number(req.body.previousDueBalance) || 0,

      discountAmount:
        Number(req.body.discountAmount) || 0,

      // 📍 Invoice location
      latitude: invoiceLatitude,
      longitude: invoiceLongitude,

      invoiceId,

      salespersonId: req.user.userId,

      paymentProof: paymentProofPath,

      logoProof: logoProofPath,

      addons: parsedAddons,

      paymentMode,

      utrNumber,

      receiptNo:
        req.body.receiptNo || "",

      chequeNo:
        req.body.chequeNo || "",

      bankName:
        req.body.bankName || "",

      ocrStatus,

      ocrMessage,

      status: "pending",
    });

    // ============================================================
    // 💾 SAVE INVOICE
    // ============================================================

    await newInvoice.save();

    // ============================================================
    // 📍 INVOICE DISTANCE CALCULATION
    // ============================================================

    // Make sure distancePoints exists
    if (!Array.isArray(session.distancePoints)) {
      session.distancePoints = [];
    }

    // ------------------------------------------------------------
    // 📍 GET PREVIOUS DISTANCE POINT
    // ------------------------------------------------------------

    const previousPoint =
      session.distancePoints[
        session.distancePoints.length - 1
      ];

    let distanceFromPreviousKm = 0;

    // ------------------------------------------------------------
    // 📏 PREVIOUS POINT → INVOICE
    // ------------------------------------------------------------

    if (previousPoint) {
      distanceFromPreviousKm = calculateDistance(
        Number(previousPoint.latitude),
        Number(previousPoint.longitude),
        invoiceLatitude,
        invoiceLongitude
      );
    }

    // ------------------------------------------------------------
    // 📊 PREVIOUS TOTAL DISTANCE
    // ------------------------------------------------------------

    const previousTotal =
      Number(session.totalDistanceKm) || 0;

    // ------------------------------------------------------------
    // 📊 NEW TOTAL DISTANCE
    // ------------------------------------------------------------

    const newTotalDistance =
      previousTotal + distanceFromPreviousKm;

    // ============================================================
    // 📍 ADD INVOICE TO DISTANCE POINTS
    // ============================================================

    session.distancePoints.push({
      type: "INVOICE",

      // Link distance point to invoice
      referenceId: newInvoice._id.toString(),

      latitude: invoiceLatitude,

      longitude: invoiceLongitude,

      timestamp: new Date(),

      // Previous activity → Invoice
      distanceFromPreviousKm: Number(
        distanceFromPreviousKm.toFixed(3)
      ),

      // Total distance till Invoice
      totalDistanceKm: Number(
        newTotalDistance.toFixed(3)
      ),
    });

    // ============================================================
    // 📊 UPDATE DAY TOTAL
    // ============================================================

    session.totalDistanceKm = Number(
      newTotalDistance.toFixed(3)
    );

    // ============================================================
    // 💾 SAVE UPDATED SESSION
    // ============================================================

    await session.save();

    // ============================================================
    // ⭐ EXISTING SALESPERSON POINTS
    // ============================================================

    await addSalespersonPoints(
      req.user.userId,
      "DEAL_CLOSED"
    );

    // ============================================================
    // ✅ RESPONSE
    // ============================================================

    return res.status(201).json({
      success: true,

      message:
        "Invoice request & installment ledger submitted to Accountant!",

      invoiceId,

      // 📏 Distance from previous activity to Invoice
      distanceAddedKm: Number(
        distanceFromPreviousKm.toFixed(3)
      ),

      // 📏 Today's total distance
      totalDistanceKm: Number(
        session.totalDistanceKm.toFixed(3)
      ),
    });
  } catch (err) {
    console.error(
      "🔥 [FATAL] INVOICE SUBMISSION FAILED:",
      err.message
    );

    return res.status(500).json({
      message: "Failed to submit request",
      error: err.message,
    });
  }
};

// 🌟 FIX: Updated multer route handlers with upload.fields to handle multiple files (paymentProof and logoProof)
const invoiceUploadFields = upload.fields([
  { name: "paymentProof", maxCount: 1 },
  { name: "logoProof", maxCount: 1 }
]);

app.post("/api/invoices/request", verifyToken, invoiceUploadFields, handleInvoiceSubmission);
app.post("/api/salesperson/invoice-request", verifyToken, invoiceUploadFields, handleInvoiceSubmission);

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

    // 🌟 4️⃣ AUTOMATION: Create Technical Production Project agar pehle se nahi hai
    const existingProject = await TechnicalTask.findOne({ invoiceId: invoice.invoiceId });
    if (!existingProject) {
      const projectId = "PRJ-" + Date.now().toString().slice(-6);
      await TechnicalTask.create({
        projectId,
        invoiceId: invoice.invoiceId,
        instituteName: invoice.instituteName,
        appName: invoice.appName || "Custom App",
        packageValidity: invoice.packageValidity || "1 Year",
        addons: invoice.addons || {},
        logoProof: invoice.logoProof || "",
        status: "Unassigned"
      });
    }

    res.json({
      message: `Invoice #${invoice.invoiceId} Approved & Technical Project Queued successfully!`,
    });
  } catch (err) {
    res.status(500).json({
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

// =========================================================================
// --- 📞 START CALL TRACKING ---
// =========================================================================

app.post("/api/salesperson/calls/start", verifyToken, async (req, res) => {
  try {
    const {
      leadId,
      customerName,
      phoneNumber,
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required",
      });
    }

    const normalizedPhone = String(phoneNumber)
      .replace(/\D/g, "")
      .slice(-10);

    if (!normalizedPhone) {
      return res.status(400).json({
        message: "Invalid phone number",
      });
    }

    const call = await CallLog.create({
      salespersonId: req.user.userId,

      leadId: leadId || null,

      customerName: customerName || "",

      phoneNumber: normalizedPhone,

      status: "INITIATED",

      dialedAt: new Date(),
    });

    await addSalespersonPoints(
  req.user.userId,
  "DIAL_CALL"
);

    res.status(201).json({
      success: true,
      message: "Call initiated and tracked",
      call,
    });
  } catch (err) {
    console.error("Start call tracking error:", err);

    res.status(500).json({
      message: "Failed to track call",
      error: err.message,
    });
  }
});



app.patch(
  "/api/salesperson/calls/:callId/connected",
  verifyToken,
  async (req, res) => {
    try {
      const { callId } = req.params;

      const call = await CallLog.findOne({
        _id: callId,
        salespersonId: req.user.userId,
      });

      if (!call) {
        return res.status(404).json({
          message: "Call record not found",
        });
      }

      // Prevent overwriting an already connected call
      if (call.status === "CONNECTED") {
        return res.json({
          success: true,
          message: "Call already marked as connected",
          call,
        });
      }

      call.status = "CONNECTED";
      call.connectedAt = new Date();

      await call.save();

      await addSalespersonPoints(
  req.user.userId,
  "CALL_CONNECTED"
);

      return res.json({
        success: true,
        message: "Call marked as connected",
        call,
      });
    } catch (err) {
      console.error(
        "Connected call update error:",
        err
      );

      return res.status(500).json({
        message: "Failed to update connected call",
        error: err.message,
      });
    }
  }
);

app.patch(
  "/api/salesperson/calls/:callId/end",
  verifyToken,
  async (req, res) => {
    try {
      const { callId } = req.params;
      const { durationSeconds } = req.body; // 🌟 Frontend/Native se aane wali duration capture karein

      const call = await CallLog.findOne({
        _id: callId,
        salespersonId: req.user.userId,
      });

      if (!call) {
        return res.status(404).json({
          message: "Call record not found",
        });
      }

      // Check karo ki call pehle se connected/ended thi ya nahi (duplicate points rokne ke liye)
      const wasAlreadyConnected = call.status === "CONNECTED" || call.status === "ENDED";
      const endedAt = new Date();

      call.endedAt = endedAt;
      call.status = "ENDED";

      // Agar pehle connectedAt set nahi hua tha aur call end hui hai, toh current time ko connected man sakte hain agar call chali ho
      if (!call.connectedAt && (Number(durationSeconds) > 0)) {
        call.connectedAt = new Date(endedAt.getTime() - (durationSeconds * 1000));
      }

      // 🌟 Smart Duration Priority: Native/Frontend duration -> Timestamp difference -> 0
      if (Number(durationSeconds) > 0) {
        call.durationSeconds = Number(durationSeconds);
      } else if (call.connectedAt) {
        const durationMs =
          endedAt.getTime() -
          new Date(call.connectedAt).getTime();

        call.durationSeconds = Math.max(
          0,
          Math.floor(durationMs / 1000)
        );
      } else {
        call.durationSeconds = 0;
      }

      await call.save();

      // 🌟 FIX: Agar call valid thi aur pehle points nahi mile the, toh points add karo
      if (!wasAlreadyConnected) {
        try {
          await addSalespersonPoints(req.user.userId, "CALL_CONNECTED");
          console.log(`✅ Call Connected points added successfully for: ${req.user.userId}`);
        } catch (ptErr) {
          console.error("🔥 Error adding call connected points:", ptErr.message);
        }
      }

      return res.json({
        success: true,
        message: "Call ended and duration saved successfully",
        call,
      });
    } catch (err) {
      console.error(
        "End call update error:",
        err
      );

      return res.status(500).json({
        message: "Failed to end call",
        error: err.message,
      });
    }
  }
);
// =========================================================================
// 🎙️ UPLOAD SALESPERSON CALL RECORDING
// =========================================================================

// ============================================================
// 🎙️ UPLOAD CALL RECORDING
// ============================================================

app.patch(
  "/api/salesperson/calls/:callId/recording",
  verifyToken,
  uploadCallRecording.single("recording"),
  async (req, res) => {
    try {
      const { callId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          message: "Recording file is required",
        });
      }

      const call = await CallLog.findOne({
        _id: callId,
        salespersonId: req.user.userId,
      });

      if (!call) {
        return res.status(404).json({
          message: "Call record not found",
        });
      }

      // Cloudinary URL returned by multer-storage-cloudinary
      const recordingUrl =
        req.file.path || req.file.secure_url;

      if (!recordingUrl) {
        return res.status(500).json({
          message: "Cloudinary recording URL not available",
        });
      }

      call.recordingUrl = recordingUrl;

      // Recording has been uploaded successfully
      call.recordingConsent = true;

      await call.save();

      return res.json({
        success: true,
        message: "Call recording uploaded successfully",
        recordingUrl,
        call,
      });
    } catch (err) {
      console.error(
        "Call recording upload error:",
        err
      );

      return res.status(500).json({
        message: "Failed to upload call recording",
        error: err.message,
      });
    }
  }
);

const { parseBuffer } = require('music-metadata');
// const axios = require('axios');

app.post(
  "/api/salesperson/calls/:callId/recording",
  verifyToken,
  uploadCallRecording.single("recording"),
  async (req, res) => {
    try {
      const { callId } = req.params;

      // ---------------------------------------------------------
      // 1. Check recording file
      // ---------------------------------------------------------
      if (!req.file) {
        return res.status(400).json({
          message: "Recording file is required.",
        });
      }

      // ---------------------------------------------------------
      // 2. Find CallLog
      // ---------------------------------------------------------
      const call = await CallLog.findById(callId);

      if (!call) {
        return res.status(404).json({
          message: "Call record not found.",
        });
      }

      // ---------------------------------------------------------
      // 3. Security: salesperson can update own call only
      // ---------------------------------------------------------
      // Note: req.user.userId custom string id hai ya req.user._id ObjectId hai, 
      // uske hisab se match check karein (aapke codebase mein req.user.userId use hota hai)
      if (
        String(call.salespersonId) !== String(req.user.userId) &&
        String(call.salespersonId) !== String(req.user._id)
      ) {
        return res.status(403).json({
          message: "You are not allowed to update this call.",
        });
      }

      // ---------------------------------------------------------
      // 4. Cloudinary URL save
      // ---------------------------------------------------------
      const recordingUrl = req.file.path || req.file.secure_url;
      call.recordingUrl = recordingUrl;
      call.recordingConsent = true;

      // ---------------------------------------------------------
      // 🌟 5. EXTRACT EXACT AUDIO DURATION USING music-metadata
      // ---------------------------------------------------------
      try {
        // Cloudinary se audio file ka buffer download karein
        const audioResponse = await axios.get(recordingUrl, { responseType: 'arraybuffer' });
        const audioBuffer = Buffer.from(audioResponse.data);

        // Buffer ko parse karke exact duration nikalein
        const metadata = await parseBuffer(audioBuffer, req.file.mimetype);

        if (metadata && metadata.format && metadata.format.duration) {
          const exactSeconds = Math.round(metadata.format.duration);
          call.durationSeconds = exactSeconds;
          call.status = "CONNECTED"; // Automatic connected mark ho jayega

          // Agar connectedAt pehle set nahi tha, toh duration ke hisab se set kar do
          if (!call.connectedAt) {
            const endedTime = call.endedAt || new Date();
            call.connectedAt = new Date(new Date(endedTime).getTime() - (exactSeconds * 1000));
          }

          console.log(`🎙️ Audio duration extracted successfully: ${exactSeconds} seconds for call ${callId}`);
        }
      } catch (parseErr) {
        console.warn("⚠️ Could not extract audio duration from metadata, keeping default duration:", parseErr.message);
      }

      const wasAlreadyConnected = call.status === "CONNECTED";
      await call.save();

      // Agar call pehle connected count nahi hui thi, toh points add kar do
      if (!wasAlreadyConnected && call.status === "CONNECTED") {
        try {
          await addSalespersonPoints(req.user.userId, "CALL_CONNECTED");
        } catch (ptErr) {
          console.error("🔥 Error adding points from recording upload:", ptErr.message);
        }
      }

      // ---------------------------------------------------------
      // 6. Response
      // ---------------------------------------------------------
      return res.status(200).json({
        success: true,
        message: "Call recording uploaded and duration calculated successfully.",
        recordingUrl: call.recordingUrl,
        durationSeconds: call.durationSeconds,
        callId: call._id,
      });

    } catch (error) {
      console.error(
        "❌ Call recording upload error:",
        error
      );

      return res.status(500).json({
        message: "Failed to upload call recording.",
        error: error.message,
      });
    }
  }
);
// =========================================================================
// --- 📞 END CALL TRACKING ---
// =========================================================================

app.put("/api/salesperson/calls/:id/end", verifyToken, async (req, res) => {
  try {
    const {
      status,
      durationSeconds,
      connectedAt,
    } = req.body;

    const allowedStatuses = [
      "CONNECTED",
      "ENDED",
      "NOT_CONNECTED",
      "MISSED",
      "REJECTED",
      "FAILED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid call status",
      });
    }

    const call = await CallLog.findOne({
      _id: req.params.id,
      salespersonId: req.user.userId,
    });

    if (!call) {
      return res.status(404).json({
        message: "Call record not found",
      });
    }

    // Check karo ki call pehle se connected thi ya nahi (duplicate points rokne ke liye)
    const wasAlreadyConnected = call.status === "CONNECTED" || call.status === "ENDED";
    const endedAt = new Date();
    
    call.status = status;
    call.endedAt = endedAt;

    if (connectedAt) {
      call.connectedAt = new Date(connectedAt);
    } else if ((status === "CONNECTED" || status === "ENDED") && !call.connectedAt) {
      call.connectedAt = new Date();
    }

    // Smart Duration Calculation
    if (status === "CONNECTED" || status === "ENDED") {
      if (Number(durationSeconds) > 0) {
        call.durationSeconds = Number(durationSeconds);
      } else if (call.connectedAt) {
        const durationMs = endedAt.getTime() - new Date(call.connectedAt).getTime();
        call.durationSeconds = Math.max(0, Math.floor(durationMs / 1000));
      } else {
        call.durationSeconds = 0;
      }
    } else {
      call.durationSeconds = 0;
    }

    await call.save();

    // 🌟 FIX: Agar call connect/end hui hai aur pehle count nahi hui thi, toh points add karo!
    if ((status === "CONNECTED" || status === "ENDED") && !wasAlreadyConnected) {
      try {
        await addSalespersonPoints(req.user.userId, "CALL_CONNECTED");
        console.log(`✅ Call Connected points added successfully for: ${req.user.userId}`);
      } catch (ptErr) {
        console.error("🔥 Error adding call connected points:", ptErr.message);
      }
    }

    res.json({
      success: true,
      message: "Call updated successfully",
      call,
    });
  } catch (err) { // 👈 Yahan pehle 'graph (err)' tha jo error de raha tha
    console.error("End call tracking error:", err);

    res.status(500).json({
      message: "Failed to update call",
      error: err.message,
    });
  }
});

// =========================================================================
// --- 📞 SALESPERSON CALL HISTORY ---
// =========================================================================

app.get("/api/salesperson/calls", verifyToken, async (req, res) => {
  try {
    const limit = Math.min(
      Number(req.query.limit) || 100,
      500
    );

    const calls = await CallLog.find({
      salespersonId: req.user.userId,
    })
      .sort({ dialedAt: -1 })
      .limit(limit)
      .lean();

    res.json(calls);
  } catch (err) {
    console.error("Fetch call history error:", err);

    res.status(500).json({
      message: "Failed to fetch call history",
      error: err.message,
    });
  }
});

// =========================================================================
// --- 📊 SALESPERSON CALL ANALYTICS ---
// =========================================================================
app.get("/api/salesperson/call-analytics", verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;

    const now = new Date();

    let startDate;
    let endDate;

    // ---------------------------------------------------------
    // CUSTOM DATE RANGE
    // ---------------------------------------------------------
    if (from || to) {
      if (!from || !to) {
        return res.status(400).json({
          message: "Both 'from' and 'to' dates are required.",
        });
      }

      startDate = new Date(`${from}T00:00:00`);
      endDate = new Date(`${to}T23:59:59.999`);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return res.status(400).json({
          message: "Invalid date format. Use YYYY-MM-DD.",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          message: "'from' date cannot be after 'to' date.",
        });
      }
    }

    // ---------------------------------------------------------
    // DEFAULT = TODAY
    // ---------------------------------------------------------
    else {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(now);
    }

    // ---------------------------------------------------------
    // FETCH CALLS
    // ---------------------------------------------------------
    const calls = await CallLog.find({
      salespersonId: req.user.userId,
      dialedAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .sort({ dialedAt: -1 })
      .lean();

    // ---------------------------------------------------------
    // TOTAL DIALS
    // ---------------------------------------------------------
    const totalDials = calls.length;

    // ---------------------------------------------------------
    // UNIQUE + DUPLICATE
    // ---------------------------------------------------------
    const uniqueNumbers = new Set(
      calls.map((call) => call.phoneNumber)
    );

    const uniqueDials = uniqueNumbers.size;

    const duplicateDials = Math.max(
      0,
      totalDials - uniqueDials
    );

    // ---------------------------------------------------------
    // CONNECTED
    // ---------------------------------------------------------
    const connectedCalls = calls.filter(
      (call) => call.status === "CONNECTED"
    ).length;

    // ---------------------------------------------------------
    // NOT CONNECTED
    // ---------------------------------------------------------
    const notConnectedCalls = calls.filter(
      (call) =>
        call.status !== "CONNECTED"
    ).length;

    // ---------------------------------------------------------
    // TOTAL DURATION
    // ---------------------------------------------------------
    const totalDurationSeconds = calls.reduce(
      (total, call) =>
        total + (Number(call.durationSeconds) || 0),
      0
    );

    // ---------------------------------------------------------
    // AVERAGE DURATION
    // ---------------------------------------------------------
    const averageDurationSeconds =
      connectedCalls > 0
        ? Math.round(
            totalDurationSeconds / connectedCalls
          )
        : 0;

    // ---------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------
    res.json({
      success: true,

      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },

      analytics: {
        totalDials,
        uniqueDials,
        duplicateDials,
        connectedCalls,
        notConnectedCalls,
        totalDurationSeconds,
        averageDurationSeconds,
      },
    });
  } catch (err) {
    console.error(
      "Call analytics error:",
      err
    );

    res.status(500).json({
      message: "Failed to calculate call analytics",
      error: err.message,
    });
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

  // 📍 Point A — Start Day location
  startLocation: {
    latitude: Number(latitude) || 0,
    longitude: Number(longitude) || 0
  },

  startAddress: startAddress || "",

  // 📍 Distance calculation ka first point
  distancePoints: [
    {
      type: "START",
      referenceId: null,
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      timestamp: new Date(),
      distanceFromPreviousKm: 0,
      totalDistanceKm: 0
    }
  ],

  totalDistanceKm: 0
});

    await newSession.save();
    res.status(201).json({ success: true, message: "Day started successfully!", startAddress: newSession.startAddress, session: newSession });
  } catch (err) {
    res.status(500).json({ message: "Failed to start day", error: err.message });
  }
});

app.post("/api/salesperson/end-day", verifyToken, async (req, res) => {
  try {
    // ============================================================
    // 🇮🇳 TODAY - IST
    // ============================================================

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    // ============================================================
    // 🔐 GET ACTIVE SESSION
    // ============================================================

    const session = await DaySession.findOne({
      salespersonId: req.user.userId,
      date: today,
      status: "STARTED",
    });

    if (!session) {
      return res.status(400).json({
        message: "No active day session found to end!",
      });
    }

    // ============================================================
    // 📍 GET END LOCATION
    // ============================================================

    const { latitude, longitude } = req.body;

    const endLatitude = Number(latitude);
    const endLongitude = Number(longitude);

    if (
      !Number.isFinite(endLatitude) ||
      !Number.isFinite(endLongitude)
    ) {
      return res.status(400).json({
        message:
          "Valid latitude and longitude are required to end the day and calculate final distance.",
      });
    }

    const endTimeDate = new Date();

    // ============================================================
    // 📍 MAKE SURE DISTANCE POINTS EXISTS
    // ============================================================

    if (!Array.isArray(session.distancePoints)) {
      session.distancePoints = [];
    }

    // ============================================================
    // 📍 GET LAST ACTIVITY POINT
    // ============================================================

    const lastPoint =
      session.distancePoints[
        session.distancePoints.length - 1
      ];

    let distanceFromPreviousKm = 0;

    // ============================================================
    // 📏 LAST ACTIVITY → DAY END
    // ============================================================

    if (lastPoint) {
      const previousLatitude = Number(
        lastPoint.latitude
      );

      const previousLongitude = Number(
        lastPoint.longitude
      );

      if (
        Number.isFinite(previousLatitude) &&
        Number.isFinite(previousLongitude)
      ) {
        distanceFromPreviousKm = calculateDistance(
          previousLatitude,
          previousLongitude,
          endLatitude,
          endLongitude
        );
      }
    }

    // ============================================================
    // 📊 EXISTING TOTAL
    // ============================================================

    const previousTotalDistance =
      Number(session.totalDistanceKm) || 0;

    // ============================================================
    // 📊 FINAL TOTAL
    // ============================================================

    const finalTotalDistance =
      previousTotalDistance + distanceFromPreviousKm;

    // ============================================================
    // 📍 SAVE DAY END AS FINAL DISTANCE POINT
    // ============================================================

    session.distancePoints.push({
      type: "END",

      referenceId: null,

      latitude: endLatitude,

      longitude: endLongitude,

      timestamp: endTimeDate,

      // Last activity → Day End
      distanceFromPreviousKm: Number(
        distanceFromPreviousKm.toFixed(3)
      ),

      // Complete distance till Day End
      totalDistanceKm: Number(
        finalTotalDistance.toFixed(3)
      ),
    });

    // ============================================================
    // 🔒 END SESSION
    // ============================================================

    session.status = "ENDED";

    session.endTime = endTimeDate;

    session.endLocation = {
      latitude: endLatitude,
      longitude: endLongitude,
    };

    session.totalDistanceKm = Number(
      finalTotalDistance.toFixed(3)
    );

    await session.save();

    // ============================================================
    // 📊 TODAY'S VISITS
    // ============================================================

    const totalVisitsToday =
      await Lead.countDocuments({
        salespersonId: req.user.userId,
        leadDate: today,
      });

    // ============================================================
    // 💰 TODAY'S APPROVED INVOICES
    // ============================================================

    const approvedInvoicesToday =
      await Invoice.find({
        salespersonId: req.user.userId,
        status: "approved",
      });

    const totalCollectedToday =
      approvedInvoicesToday.reduce(
        (acc, inv) =>
          acc + (Number(inv.paidAmount) || 0),
        0
      );

    // ============================================================
    // ⏱️ WORKING HOURS
    // ============================================================

    const workingMilliseconds =
      endTimeDate -
      new Date(session.startTime);

    const workingHours = (
      workingMilliseconds /
      (1000 * 60 * 60)
    ).toFixed(1);

    // ============================================================
    // 🕐 FORMAT IST TIME
    // ============================================================

    const formatISTTime = (dateValue) => {
      const d = new Date(dateValue);

      return d.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };

    // ============================================================
    // ✅ RESPONSE
    // ============================================================

    return res.json({
      success: true,

      message:
        "Day ended successfully. Entries are now locked for today.",

      summary: {
        startTime: formatISTTime(
          session.startTime
        ),

        endTime: formatISTTime(
          session.endTime
        ),

        workingHours: `${workingHours} hrs`,

        totalVisits: totalVisitsToday,

        totalCollected:
          totalCollectedToday,

        // 📏 Final complete distance
        totalDistanceKm:
          Number(
            session.totalDistanceKm.toFixed(3)
          ),

        // 📏 Only last segment
        distanceAddedKm:
          Number(
            distanceFromPreviousKm.toFixed(3)
          ),
      },
    });
  } catch (err) {
    console.error(
      "❌ End Day Error:",
      err
    );

    return res.status(500).json({
      message: "Failed to end day",
      error: err.message,
    });
  }
});

app.get(
  "/api/salesperson/points/today",
  verifyToken,
  async (req, res) => {
    try {
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      const points = await SalespersonPoint.findOne({
        salespersonId: req.user.userId,
        date: today,
      }).lean();

      const totalPoints = points?.totalPoints || 0;

      return res.json({
        success: true,
        date: today,
        totalPoints,
        target: 100,
        targetAchieved: totalPoints >= 100,

        breakdown: {
          leadsCreated: points?.leadsCreated || 0,
          revisits: points?.revisits || 0,
          demosDone: points?.demosDone || 0,
          dealsClosed: points?.dealsClosed || 0,
          callsConnected: points?.callsConnected || 0,
          dialCalls: points?.dialCalls || 0,
        },
      });
    } catch (err) {
      console.error("❌ Fetch today's salesperson points error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch today's points",
        error: err.message,
      });
    }
  }
);




app.get("/api/salesperson/notifications", verifyToken, async (req, res) => {
  try {

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const tasks = await Task.find({
      salespersonId: req.user.userId,
      status: "pending",
      $or: [
        { dueDate: { $exists: false } },
        { dueDate: null },
        { dueDate: "" },
        { dueDate: { $lte: today } } //
      ]
    }).sort({ createdAt: -1 });

    const formattedNotifications = tasks.map((t) => ({
      _id: t._id,
      title: `${t.taskType.toUpperCase()} Reminder`,
      message: `Pending task for institute: ${t.instituteName} (Due: ${t.dueDate || 'N/A'})`,
      isRead: false,
      createdAt: t.createdAt,
      dueDate: t.dueDate,
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
      // 🇮🇳 Today's date in IST
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      // 🔐 Get today's active Day Session
      const session = await DaySession.findOne({
        salespersonId: req.user.userId,
        date: today,
      });

      if (!session || session.status !== "STARTED") {
        return res.status(403).json({
          message:
            "Action Blocked: You must start your working day first before recording visits or leads!",
        });
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

      // 🔴 Mandatory fields
      if (!mobileNo || !city || !state) {
        return res.status(400).json({
          message:
            "Mandatory fields (Mobile No, City, State) are missing!",
        });
      }

      // ============================================================
      // 📍 VALIDATE LOCATION
      // ============================================================

      const leadLatitude = Number(latitude);
      const leadLongitude = Number(longitude);

      if (
        latitude === undefined ||
        longitude === undefined ||
        latitude === null ||
        longitude === null ||
        !Number.isFinite(leadLatitude) ||
        !Number.isFinite(leadLongitude)
      ) {
        return res.status(400).json({
          message:
            "Valid latitude and longitude are required to calculate travel distance.",
        });
      }

      const now = new Date();

      // 🇮🇳 Current date/time in IST
      const currentDate = now.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      const currentTime = now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // ☁️ Cloudinary image
      const normalizedPath = req.file ? req.file.path : "";

      // ============================================================
      // 🔎 CHECK EXISTING LEAD
      // ============================================================

      const existingLead = await Lead.findOne({
        salespersonId: req.user.userId,
        mobileNo: mobileNo.trim(),
      });

      // ============================================================
      // 🔄 EXISTING LEAD = REVISIT
      // ============================================================

      if (existingLead) {
        existingLead.visitCount =
          (existingLead.visitCount || 1) + 1;

        existingLead.leadDate = currentDate;
        existingLead.leadTime = currentTime;

        if (instituteName) {
          existingLead.instituteName = instituteName;
        }

        if (contactPerson) {
          existingLead.contactPerson = contactPerson;
        }

        if (notes) {
          existingLead.notes = existingLead.notes
            ? `${existingLead.notes}\n[Visit #${existingLead.visitCount} - ${currentDate} ${currentTime}]: ${notes}`
            : `[Visit #${existingLead.visitCount} - ${currentDate} ${currentTime}]: ${notes}`;
        }

        if (normalizedPath) {
          existingLead.meetingPhoto = normalizedPath;
        }

        if (followUpDate) {
          existingLead.followUpDate = followUpDate;
          existingLead.followUpTime = followUpTime || "";
          existingLead.followUpAction =
            followUpAction || "Call";
        }

        await existingLead.save();

        // ⭐ Existing points/reward system
        await addSalespersonPoints(
          req.user.userId,
          "REVISIT"
        );

        // ============================================================
        // 📍 REVISIT DISTANCE CALCULATION
        // ============================================================

        // Make sure distancePoints exists
        if (!Array.isArray(session.distancePoints)) {
          session.distancePoints = [];
        }

        // Previous activity point
        const previousPoint =
          session.distancePoints[
            session.distancePoints.length - 1
          ];

        let distanceFromPreviousKm = 0;

        // Calculate previous activity → Revisit
        if (previousPoint) {
          distanceFromPreviousKm = calculateDistance(
            Number(previousPoint.latitude),
            Number(previousPoint.longitude),
            leadLatitude,
            leadLongitude
          );
        }

        // Existing total distance
        const previousTotal =
          Number(session.totalDistanceKm) || 0;

        // New total distance
        const newTotalDistance =
          previousTotal + distanceFromPreviousKm;

        // ============================================================
        // 📍 SAVE REVISIT AS DISTANCE POINT
        // ============================================================

        session.distancePoints.push({
          type: "REVISIT",

          // Link point to existing Lead
          referenceId: existingLead._id.toString(),

          latitude: leadLatitude,
          longitude: leadLongitude,

          timestamp: now,

          // Previous activity → Revisit
          distanceFromPreviousKm: Number(
            distanceFromPreviousKm.toFixed(3)
          ),

          // Total distance till Revisit
          totalDistanceKm: Number(
            newTotalDistance.toFixed(3)
          ),
        });

        // Update total distance
        session.totalDistanceKm = Number(
          newTotalDistance.toFixed(3)
        );

        await session.save();

        // ============================================================
        // 📅 FOLLOW-UP TASK
        // ============================================================

        if (followUpDate) {
          await Task.findOneAndUpdate(
            {
              salespersonId: req.user.userId,
              instituteName: existingLead.instituteName,
              status: "pending",
            },
            {
              $set: {
                dueDate: followUpDate,
                notes:
                  notes ||
                  `Follow-up scheduled (Visit #${existingLead.visitCount})`,
                taskType: followUpAction
                  ?.toLowerCase()
                  .includes("demo")
                  ? "demo"
                  : "call",
              },
            },
            {
              upsert: true,
              sort: { createdAt: -1 },
            }
          );
        }

        // ============================================================
        // ✅ REVISIT RESPONSE
        // ============================================================

        return res.status(200).json({
          success: true,

          message: `Visit #${existingLead.visitCount} logged successfully for existing lead!`,

          lead: existingLead,

          // Distance added by this Revisit
          distanceAddedKm: Number(
            distanceFromPreviousKm.toFixed(3)
          ),

          // Total distance today
          totalDistanceKm: Number(
            session.totalDistanceKm.toFixed(3)
          ),
        });
      }

      // ============================================================
      // 🆕 CREATE NEW LEAD
      // ============================================================

      const newLead = new Lead({
        instituteName:
          instituteName || "Unknown Institute",

        contactPerson:
          contactPerson || "N/A",

        mobileNo: mobileNo.trim(),

        email: email || "",

        address: address || "",

        pincode: pincode || "",

        city,

        state,

        notes: notes || "",

        meetingPhoto: normalizedPath,

        // 📍 Lead location
        latitude: leadLatitude,
        longitude: leadLongitude,

        leadDate: currentDate,
        leadTime: currentTime,

        visitCount: 1,

        followUpDate: followUpDate || null,

        followUpTime:
          followUpTime || "",

        followUpAction:
          followUpAction || "Call",

        salespersonId: req.user.userId,
      });

      await newLead.save();

      // ============================================================
      // 📍 NEW LEAD DISTANCE CALCULATION
      // ============================================================

      // Make sure distancePoints exists
      if (!Array.isArray(session.distancePoints)) {
        session.distancePoints = [];
      }

      // Previous activity point
      const previousPoint =
        session.distancePoints[
          session.distancePoints.length - 1
        ];

      let distanceFromPreviousKm = 0;

      // Calculate previous activity → New Lead
      if (previousPoint) {
        distanceFromPreviousKm = calculateDistance(
          Number(previousPoint.latitude),
          Number(previousPoint.longitude),
          leadLatitude,
          leadLongitude
        );
      }

      // Existing total
      const previousTotal =
        Number(session.totalDistanceKm) || 0;

      // New total
      const newTotalDistance =
        previousTotal + distanceFromPreviousKm;

      // ============================================================
      // 📍 SAVE NEW LEAD AS DISTANCE POINT
      // ============================================================

      session.distancePoints.push({
        type: "LEAD",

        // Link point to Lead
        referenceId: newLead._id.toString(),

        latitude: leadLatitude,
        longitude: leadLongitude,

        timestamp: now,

        // Previous activity → Lead
        distanceFromPreviousKm: Number(
          distanceFromPreviousKm.toFixed(3)
        ),

        // Total distance till Lead
        totalDistanceKm: Number(
          newTotalDistance.toFixed(3)
        ),
      });

      // Update session total
      session.totalDistanceKm = Number(
        newTotalDistance.toFixed(3)
      );

      await session.save();

      // ⭐ Existing points/reward system
      await addSalespersonPoints(
        req.user.userId,
        "LEAD_CREATED"
      );

      // ============================================================
      // 📅 FOLLOW-UP TASK
      // ============================================================

      if (followUpDate) {
        await Task.findOneAndUpdate(
          {
            salespersonId: req.user.userId,
            instituteName: newLead.instituteName,
            status: "pending",
          },
          {
            $set: {
              dueDate: followUpDate,

              notes:
                notes ||
                `Follow-up scheduled: ${followUpAction}`,

              taskType: followUpAction
                ?.toLowerCase()
                .includes("demo")
                ? "demo"
                : "call",
            },
          },
          {
            upsert: true,
            sort: { createdAt: -1 },
          }
        );
      }

      // ============================================================
      // ✅ NEW LEAD RESPONSE
      // ============================================================

      return res.status(201).json({
        success: true,

        message:
          "New lead and visit recorded successfully!",

        lead: newLead,

        // Distance added by this Lead
        distanceAddedKm: Number(
          distanceFromPreviousKm.toFixed(3)
        ),

        // Total distance today
        totalDistanceKm: Number(
          session.totalDistanceKm.toFixed(3)
        ),
      });
    } catch (err) {
      console.error(
        "Lead submission error:",
        err
      );

      return res.status(500).json({
        message: "Failed to save lead",
        error: err.message,
      });
    }
  }
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

const existingLead = await Lead.findById(req.params.id);

if (!existingLead) {
  return res.status(404).json({ message: "Lead not found" });
}

// Check whether demo was already completed
const oldDemoStatus = String(
  existingLead.demoStatus || ""
).trim().toLowerCase();

const incomingDemoStatus = String(
  updateFields.demoStatus || ""
).trim().toLowerCase();

console.log("🎯 DEMO STATUS CHECK:", {
  leadId: req.params.id,
  oldDemoStatus,
  incomingDemoStatus,
  rawOldStatus: existingLead.demoStatus,
  rawIncomingStatus: updateFields.demoStatus,
});

const updatedLead = await Lead.findByIdAndUpdate(
  req.params.id,
  { $set: updateFields },
  { returnDocument: "after" }
);

if (!updatedLead) {
  return res.status(404).json({
    message: "Lead not found",
  });
}

const newDemoStatus = String(
  updatedLead.demoStatus || ""
).trim().toLowerCase();

console.log("🎯 DEMO STATUS AFTER UPDATE:", {
  oldDemoStatus,
  newDemoStatus,
  rawNewStatus: updatedLead.demoStatus,
});

// ⭐ First time demo becomes Completed → +25
if (
  oldDemoStatus !== "completed" &&
  newDemoStatus === "completed"
) {
  console.log("🏆 ADDING DEMO POINTS +25");

  await addSalespersonPoints(
    req.user.userId,
    "DEMO_DONE"
  );

  console.log("✅ DEMO POINTS +25 ADDED");
}

    if (!updatedLead)
      return res.status(404).json({ message: "Lead not found" });

    if (followUpDate) {
      // 🌟 FIX: Purana pending task update karein, naya task create mat karein
      await Task.findOneAndUpdate(
        {
          salespersonId: req.user.userId,
          instituteName: updatedLead.instituteName,
          status: "pending"
        },
        {
          $set: {
            dueDate: followUpDate,
            notes: notes || `Rescheduled follow-up`,
            taskType: followUpAction?.toLowerCase().includes("demo") ? "demo" : "call"
          }
        },
        { upsert: true, sort: { createdAt: -1 } }
      );
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
    const tasks = await Task.main({ salespersonId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json(tasks);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch tasks", error: err.message });
  }
});


// =========================================================================
// --- 🧬 BIOMETRIC / WEBAUTHN API ROUTES ---
// =========================================================================

const rpName = "Crinza SalesHub";
const rpID = process.env.NODE_ENV === "production" ? "crinza-saleshub.onrender.com" : "localhost";
const expectedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const challengeStore = {};

// 1. Register Challenge Generate (Device link karne ke liye)
app.post("/api/auth/webauthn/register-options", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    let excludeCredentials = [];
    if (user.devices && Array.isArray(user.devices)) {
      excludeCredentials = user.devices.map(dev => {
        let credId = dev.credentialID;
        if (Buffer.isBuffer(credId)) {
          credId = credId.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        }
        return {
          id: credId,
          type: 'public-key',
        };
      }).filter(d => d.id);
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user._id.toString()),
      userName: user.userId,
      excludeCredentials,
      // 🌟 Yahan "platform" lagane se Google Cloud ki jagah direct laptop ka Windows Hello / Fingerprint khulega
      authenticatorSelection: {
        userVerification: "preferred",
        authenticatorAttachment: "platform",
        residentKey: "preferred"
      }
    });

    challengeStore[user.userId] = options.challenge;
    res.json(options);
  } catch (err) {
    console.error("🔥 WebAuthn Register Options Crash Error:", err);
    res.status(500).json({ message: "Failed to generate registration options", error: err.message });
  }
});

// 2. Register Verify & Save Device
app.post("/api/auth/webauthn/register-verify", verifyToken, async (req, res) => {
  try {
    const { credential } = req.body;
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const expectedChallenge = challengeStore[user.userId];
    delete challengeStore[user.userId];

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      if (!user.devices) user.devices = [];

      // 🌟 Safe conversion to avoid undefined Buffer crash
      const credIdBuffer = credentialID ? Buffer.from(credentialID) : Buffer.from(credential.id, 'base64');
      const credPubKeyBuffer = credentialPublicKey ? Buffer.from(credentialPublicKey) : Buffer.alloc(0);

      const existingDevice = user.devices.find(d => {
        if (!d.credentialID || !credIdBuffer) return false;
        try {
          return Buffer.compare(d.credentialID, credIdBuffer) === 0;
        } catch (e) {
          return false;
        }
      });

      if (!existingDevice) {
        user.devices.push({
          credentialID: credIdBuffer,
          credentialPublicKey: credPubKeyBuffer,
          counter: counter || 0,
          transports: credential.transports || []
        });
        await user.save();
      }
      return res.json({ success: true, message: "Biometric device registered successfully!" });
    }
    res.status(400).json({ success: false, message: "Verification failed" });
  } catch (err) {
    console.error("🔥 Detailed Register Verify Crash Error:", err);
    res.status(500).json({ message: "Registration error", error: err.message });
  }
});



// 3. Login Challenge Generate (Bina password ke login ke liye)
app.post("/api/auth/webauthn/login-options", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ userId: userId?.trim() });
    if (!user) return res.status(404).json({ message: "User ID not found" });

    if (!user.devices || user.devices.length === 0) {
      return res.status(400).json({ message: "No fingerprint registered. Please login with password first." });
    }

    // 🌟 Convert Buffer to Base64URL string safely for @simplewebauthn
    const allowCredentials = user.devices.map(dev => {
      let credId = dev.credentialID;
      if (!credId) return null;

      let idString = credId;
      if (Buffer.isBuffer(credId)) {
        idString = credId.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      } else if (typeof credId === 'object' && credId.buffer) {
        // Handle MongoDB binary buffer objects
        idString = Buffer.from(credId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      }

      return {
        id: idString,
        type: 'public-key',
        transports: dev.transports || [],
      };
    }).filter(Boolean);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    });

    challengeStore[user.userId] = options.challenge;
    res.json(options);
  } catch (err) {
    console.error("🔥 Login Options Crash Error:", err);
    res.status(500).json({ message: "Failed to generate login options", error: err.message });
  }
});

app.post("/api/auth/webauthn/login-verify", async (req, res) => {
  try {
    const { userId, credential } = req.body;
    const user = await User.findOne({ userId: userId?.trim() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const expectedChallenge = challengeStore[user.userId];
    delete challengeStore[user.userId];

    if (!user.devices || user.devices.length === 0) {
      return res.status(400).json({ message: "No devices found. Please login with password to re-register fingerprint." });
    }

    // 🌟 Find matching device safely using string comparison of credential IDs
    const deviceIndex = user.devices.findIndex(d => {
      if (!d || !d.credentialID) return false;
      try {
        const dbIdStr = Buffer.isBuffer(d.credentialID)
          ? d.credentialID.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
          : String(d.credentialID);
        return dbIdStr === credential.id;
      } catch (e) {
        return false;
      }
    });

    if (deviceIndex === -1) {
      return res.status(400).json({ message: "Biometric device not recognized. Please login with password." });
    }

    const device = user.devices[deviceIndex];

    // 🌟 Forcefully extract buffers and counter as pure primitive values to prevent Mongoose subdocument schema corruption
    const rawPubKey = device.credentialPublicKey;
    const rawCredId = device.credentialID;
    const rawCounter = device.counter;

    const pubKeyBuffer = Buffer.isBuffer(rawPubKey) ? rawPubKey : Buffer.from(rawPubKey || []);
    const credIdBuffer = Buffer.isBuffer(rawCredId) ? rawCredId : Buffer.from(rawCredId || []);
    const safeCounter = (typeof rawCounter === 'number' && !isNaN(rawCounter)) ? rawCounter : 0;

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialPublicKey: pubKeyBuffer,
        credentialID: credIdBuffer,
        counter: safeCounter,
      },
    });

    if (verification.verified) {
      // Safely update counter using Mongoose subdocument set or direct assignment
      user.devices[deviceIndex].counter = verification.authenticationInfo?.newCounter || (safeCounter + 1);
      await user.save();

      const token = jwt.sign(
        { userId: user.userId, name: user.name, role: user.role },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1d" }
      );

      return res.json({
        success: true,
        token,
        role: user.role,
        userId: user.userId,
        name: user.name,
        message: "Biometric login successful!"
      });
    }
    res.status(400).json({ success: false, message: "Authentication failed" });
  } catch (err) {
    console.error("🔥 Login Verify Crash Error:", err);
    res.status(500).json({ message: "Login verification error", error: err.message });
  }
});


// =========================================================================
// --- 🌙 AUTOMATIC SHIFT END (Har raat 11:00 PM par chalega) ---
// =========================================================================
const cron = require('node-cron'); // Optional: Agar node-cron package use karna chahein, ya phir simple setInterval

// Simple & Reliable Hourly/Minute Checker for 11:00 PM IST
setInterval(async () => {
  try {
    const now = new Date();
    // Get current IST hours and minutes
    const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
    const [currentHour, currentMinute] = istTimeStr.split(':').map(Number);

    // Agar raat ke 11:00 PM (23:00) se lekar 11:05 PM ke beech ka samay hai
    if (currentHour === 23 && currentMinute <= 5) {
      const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      // Sare active STARTED sessions dhoondho jo aaj ya usse pehle ke hain
      const activeSessions = await DaySession.find({
        status: "STARTED",
        date: { $lte: today }
      });

      for (const session of activeSessions) {
        const endTimeDate = new Date(); // Auto end time (11:00 PM approx)

        // Session ke start hone se lekar 11:00 PM tak ke logs fetch karein
        const routeLogs = await LocationLog.find({
          salespersonId: session.salespersonId,
          date: session.date,
          timestamp: {
            $gte: new Date(session.startTime),
            $lte: endTimeDate
          }
        }).sort({ timestamp: 1 });

        // Distance calculate karein
        const computedDistance = calculateValidDistance(routeLogs);

        // Session ko ENDED mark kar do
        session.status = "ENDED";
        session.endTime = endTimeDate;
        session.totalDistanceKm = computedDistance;
        await session.save();

        console.log(`🌙 Auto-Ended Shift at 11:00 PM for Salesperson: ${session.salespersonId} | Total Distance: ${computedDistance} km`);
      }
    }
  } catch (err) {
    console.error("🔥 Auto-End Day Job Error:", err.message);
  }
}, 5 * 60 * 1000); // Har 5 minute mein ek baar check karega taaki 11:00 PM miss na ho


// =========================================================================
// --- 📊 AUTOMATED MONTHLY & WEEKLY EXCEL REPORT CRON JOB ---
// =========================================================================
const { Parser } = require('json2csv');

// Helper to generate CSV buffer from performance data
const generateExcelReportBuffer = async (startDateStr, endDateStr) => {
  const performanceData = await generatePerformanceData(startDateStr, endDateStr);

  const fields = [
    { label: 'Employee ID', value: 'employeeId' },
    { label: 'Salesperson Name', value: 'name' },
    { label: 'Active Working Days', value: 'activeDays' },
    { label: 'Total Visits/Leads', value: 'totalLeads' },
    { label: 'Total Demos Conducted', value: 'totalDemos' },
    { label: 'Total Calls Made', value: 'totalCalls' },
    { label: 'Deals Closed', value: 'dealsClosed' },
    { label: 'Total Revenue', value: 'totalRevenue' },
    { label: 'Total Collected', value: 'totalCollected' },
    { label: 'Travel Distance', value: 'distanceKm' }
  ];

  const json2csvParser = new Parser({ fields });
  const csvString = json2csvParser.parse(performanceData);
  return Buffer.from(csvString, 'utf-8');
};

// =========================================================================
// --- 📧 SEND WEEKLY / MONTHLY PERFORMANCE REPORT ---
// =========================================================================

const sendPerformanceReport = async (
  reportType,
  startDateStr,
  endDateStr,
  periodKey
) => {
  try {
    // Check whether this report was already sent
    const alreadySent = await ReportLog.findOne({
      type: reportType,
      period: periodKey,
    });

    if (alreadySent) {
      console.log(
        `ℹ️ ${reportType} report already sent for ${periodKey}`
      );
      return;
    }

    // Find Admin / Boss
    const bossUser = await User.findOne({
      role: { $in: ["boss", "admin"] },
    });

    if (!bossUser || !bossUser.email) {
      console.log("❌ Admin/Boss email not found");
      return;
    }

    // Generate CSV report
    const excelBuffer = await generateExcelReportBuffer(
      startDateStr,
      endDateStr
    );

    const form = new FormData();

    form.append("sendTo", bossUser.email);

    form.append(
      "message",
      `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">

        <h3 style="color: #4f46e5;">
          Crinza ${reportType} Performance Excel Report
        </h3>

        <p>Hello Boss,</p>

        <p>
          Attached is the automated
          <strong>${reportType.toLowerCase()} performance report</strong>.
        </p>

        <p>
          <strong>Period:</strong>
          ${startDateStr} to ${endDateStr}
        </p>

        <p>
          It contains complete details of every salesperson including
          demo counts, lead visits, deals closed, revenue generated,
          collection and travel distance.
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />

        <p style="font-size:12px;color:#64748b;">
          Generated automatically by Crinza Backend Server.
        </p>

      </div>
      `
    );

    form.append("attachments", excelBuffer, {
      filename:
        `Crinza_${reportType}_Report_${startDateStr}_to_${endDateStr}.csv`,
      contentType: "text/csv",
    });

    // Send email
    await axios.post(
      "https://api.crinza.com/api/v1/contact/message",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Origin: "https://crinza.com",
        },
      }
    );

    // IMPORTANT:
    // Save log ONLY after successful email
    await ReportLog.create({
      type: reportType,
      period: periodKey,
      sentAt: new Date(),
    });

    console.log(
      `✅ ${reportType} report successfully sent to ${bossUser.email}`
    );

  } catch (err) {
    console.error(
      `🔥 ${reportType} Performance Report Error:`,
      err.response?.data || err.message
    );
  }
};

// =========================================================================
// --- ⏰ RELIABLE WEEKLY & MONTHLY PERFORMANCE REPORT SCHEDULER ---
// =========================================================================

const checkPerformanceReports = async () => {
  try {
    const now = new Date();

    // Current date in IST
    const istDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    // Current weekday in IST
    const dayOfWeek = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
    }).format(now);

    const [year, month, day] = istDate.split("-");

    // =========================================================
    // 1️⃣ WEEKLY REPORT — EVERY MONDAY
    // =========================================================

    if (dayOfWeek === "Mon") {

      const currentDate = new Date(
        `${year}-${month}-${day}T00:00:00`
      );

      // Previous Monday
      const previousMonday = new Date(currentDate);
      previousMonday.setDate(
        previousMonday.getDate() - 7
      );

      // Previous Sunday
      const previousSunday = new Date(currentDate);
      previousSunday.setDate(
        previousSunday.getDate() - 1
      );

      const startDateStr =
        previousMonday.toISOString().split("T")[0];

      const endDateStr =
        previousSunday.toISOString().split("T")[0];

      const periodKey = `Weekly_${istDate}`;

      await sendPerformanceReport(
        "Weekly",
        startDateStr,
        endDateStr,
        periodKey
      );
    }


    // =========================================================
    // 2️⃣ MONTHLY REPORT — EVERY 1ST DAY
    // =========================================================

    if (day === "01") {

      const currentDate = new Date(
        `${year}-${month}-${day}T00:00:00`
      );

      // Previous month's last day
      const previousMonthEnd = new Date(currentDate);
      previousMonthEnd.setDate(0);

      // Previous month's first day
      const previousMonthStart = new Date(
        previousMonthEnd.getFullYear(),
        previousMonthEnd.getMonth(),
        1
      );

      const startDateStr =
        previousMonthStart.toISOString().split("T")[0];

      const endDateStr =
        previousMonthEnd.toISOString().split("T")[0];

      const periodKey = `Monthly_${istDate}`;

      await sendPerformanceReport(
        "Monthly",
        startDateStr,
        endDateStr,
        periodKey
      );
    }

  } catch (err) {
    console.error(
      "🔥 Performance Scheduler Error:",
      err.message
    );
  }
};


// =========================================================
// 🚀 CHECK IMMEDIATELY WHEN SERVER STARTS
// =========================================================

checkPerformanceReports();


// =========================================================
// 🔄 CHECK EVERY 5 MINUTES
// =========================================================

setInterval(
  checkPerformanceReports,
  5 * 60 * 1000
);

// ⏰ Automated Scheduler (Har 5 minute mein check karega ki 11:00 AM hua hai ya nahi)
// setInterval(async () => {
//   try {
//     const now = new Date();
//     const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' }); // e.g. "11:00"
//     const dayOfWeek = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }); // e.g. "Mon"
//     const dayOfMonth = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric' }); // e.g. "1"

//     // Sirf jab 11:00 AM se 11:05 AM ke beech ka samay ho
//     if (istTimeStr.startsWith('11:')) {
//       const bossUser = await User.findOne({ role: { $in: ["boss", "admin"] } });
//       if (!bossUser || !bossUser.email) return;

//       let reportType = "";
//       let startDateStr = "";
//       let endDateStr = "";

//       // 1️⃣ Monthly Report: Har mahine ki 1st date ko subah 11 baje
//       if (dayOfMonth === "1") {
//         reportType = "Monthly";
//         const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Pichle mahine ki akhri tareek
//         const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Pichle mahine ki pehli tareek

//         startDateStr = lastMonthStart.toISOString().split("T")[0];
//         endDateStr = lastMonthEnd.toISOString().split("T")[0];
//       }
//       // 2️⃣ Weekly Report: Har Monday subah 11 baje
//       else if (dayOfWeek === "Mon") {
//         reportType = "Weekly";
//         const endDateObj = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday (Sunday)
//         const startDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last Monday

//         startDateStr = startDateObj.toISOString().split("T")[0];
//         endDateStr = endDateObj.toISOString().split("T")[0];
//       }

//       if (reportType) {
//         // Excel/CSV Buffer generate karein
//         const excelBuffer = await generateExcelReportBuffer(startDateStr, endDateStr);

//         const form = new FormData();
//         form.append('sendTo', bossUser.email);
//         form.append('message', `
//           <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
//             <h3 style="color: #4f46e5;">Crinza ${reportType} Performance Excel Report</h3>
//             <p>Hello Boss,</p>
//             <p>Attached is the automated <strong>${reportType.toLowerCase()} performance report</strong> (Period: ${startDateStr} to ${endDateStr}) in Excel (CSV) format.</p>
//             <p>It contains complete details of every salesperson including demo counts, lead visits, deals closed, revenue generated, and travel distance.</p>
//             <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
//             <p style="font-size: 12px; color: #64748b;">Generated automatically by Crinza Backend Server</p>
//           </div>
//         `);

//         form.append('attachments', excelBuffer, {
//           filename: `Crinza_${reportType}_Report_${startDateStr}_to_${endDateStr}.csv`,
//           contentType: 'text/csv',
//         });

//         await axios.post('https://api.crinza.com/api/v1/contact/message', form, {
//           headers: { ...form.getHeaders(), 'Origin': 'https://crinza.com' },
//         });

//         console.log(`✅ Automated ${reportType} Excel Report successfully emailed to Boss (${bossUser.email})`);
//       }
//     }
//   } catch (err) {
//     console.error("🔥 Automated Excel Report Cron Error:", err.message);
//   }
// }, 5 * 60 * 1000); // Har 5 minute mein check karega taaki 11:00 AM miss na ho

// =========================================================================
// --- 🧪 POSTMAN / MANUAL TEST ROUTE FOR EXCEL REPORT ---
// =========================================================================
// app.get("/api/test/send-excel-report", verifyToken, async (req, res) => {
//   try {
//     // Sirf Admin ya Boss hi yeh test trigger kar sakein
//     if (req.user.role !== "boss" && req.user.role !== "admin") {
//       return res.status(403).json({ message: "Access denied! Admin/Boss privileges required." });
//     }

//     const bossEmail = req.user.email || process.env.BOSS_EMAIL || "sshubhamkumar776@gmail.com";

//     // Pichle 7 dino ka date range
//     const now = new Date();
//     const endDateObj = new Date(now.getTime() - 24 * 60 * 60 * 1000);
//     const startDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

//     const startDateStr = startDateObj.toISOString().split("T")[0];
//     const endDateStr = endDateObj.toISOString().split("T")[0];

//     // Excel Buffer generate karein
//     const excelBuffer = await generateExcelReportBuffer(startDateStr, endDateStr);

//     const form = new FormData();
//     form.append('sendTo', bossEmail);
//     form.append('message', `
//       <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
//         <h3 style="color: #4f46e5;">Crinza Weekly Performance Excel Report (Manual Test)</h3>
//         <p>Hello Boss,</p>
//         <p>This is your manually triggered test report for period: ${startDateStr} to ${endDateStr}.</p>
//       </div>
//     `);

//     form.append('attachments', excelBuffer, {
//       filename: `Crinza_Weekly_Report_${startDateStr}_to_${endDateStr}.csv`,
//       contentType: 'text/csv',
//     });

//     const response = await axios.post('https://api.crinza.com/api/v1/contact/message', form, {
//       headers: { ...form.getHeaders(), 'Origin': 'https://crinza.com' },
//     });

//     console.log(`✅ Manual Test Excel Report successfully emailed to Boss (${bossEmail})`);
//     res.json({ success: true, message: `Excel report successfully sent to ${bossEmail}!` });
//   } catch (err) {
//     console.error("🔥 Manual Test Report Error:", err.response?.data || err.message);
//     res.status(500).json({ message: "Failed to send test report", error: err.response?.data || err.message });
//   }
// });



// =========================================================================
// --- 📊 HELPER: GENERATE PERFORMANCE DATA FOR REPORT ---
// =========================================================================
async function generatePerformanceData(startDateStr, endDateStr) {
  const salespersons = await User.find({ role: "salesperson" });
  const reportSummary = [];

  for (const emp of salespersons) {
    const empId = emp.userId;

    // 1. Total Demos & Calls count
    const totalDemos = await Task.countDocuments({
      salespersonId: empId,
      taskType: "demo",
      createdAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    const totalCalls = await Task.countDocuments({
      salespersonId: empId,
      taskType: "call",
      createdAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    // 2. Total Leads / Visits recorded
    const totalLeads = await Lead.countDocuments({
      salespersonId: empId,
      createdAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    // 3. Deals Closed (Approved Invoices) & Revenue
    const approvedDeals = await Invoice.find({
      salespersonId: empId,
      status: "approved",
      updatedAt: { $gte: new Date(startDateStr), $lte: new Date(endDateStr + "T23:59:59.999Z") }
    });

    const dealsClosedCount = approvedDeals.length;
    const totalRevenue = approvedDeals.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const totalCollected = approvedDeals.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);

    // 4. Total Distance Traveled
    const locationLogs = await LocationLog.find({
      salespersonId: empId,
      date: { $gte: startDateStr, $lte: endDateStr }
    }).sort({ timestamp: 1 });

    const distanceKm = calculateValidDistance(locationLogs);

    // 5. Total Active Working Days
    const activeDays = await DaySession.countDocuments({
      salespersonId: empId,
      date: { $gte: startDateStr, $lte: endDateStr }
    });

    reportSummary.push({
      employeeId: empId,
      name: emp.name,
      activeDays,
      totalLeads,
      totalDemos,
      totalCalls,
      dealsClosed: dealsClosedCount,
      totalRevenue: `₹${totalRevenue.toLocaleString("en-IN")}`,
      totalCollected: `₹${totalCollected.toLocaleString("en-IN")}`,
      distanceKm: `${distanceKm} km`
    });
  }

  return reportSummary;
}

// =========================================================================
// --- ☎️ TELECALLER API ROUTES ---
// =========================================================================


app.get("/api/telecaller/leads", verifyToken, async (req, res) => {
  try {
    const leads = await Lead.find({
      $or: [
        { telecallerId: req.user.userId },
        { createdBy: req.user.userId }
      ]
    }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leads", error: err.message });
  }
});

// 2. Create a new lead from Telecaller Portal (Guarded by active shift check)
app.post("/api/telecaller/leads", verifyToken, async (req, res) => {
  try {
    // 🌟 Shift enforcement check
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });
    
    if (!session) {
      return res.status(403).json({ message: "Action Blocked: You must start your working day first!" });
    }

    const { instituteName, contactPerson, mobileNo, email, address, city, state, pincode, notes } = req.body;
    
    if (!mobileNo || !instituteName || !city || !state) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' });

    const newLead = new Lead({
      instituteName,
      contactPerson: contactPerson || "N/A",
      mobileNo: mobileNo.trim(),
      email: email || "",
      address: address || "",
      city,
      state,
      pincode: pincode || "",
      notes: `[Telecaller Entry - ${req.user.userId}]: ${notes || 'New Lead Created'}`,
      leadDate: today,
      leadTime: timeStr,
      telecallerId: req.user.userId,
      createdBy: req.user.userId,
      salespersonId: null,
      leadStatus: "Active",
      demoStatus: "Not Given",
      latitude: 0,
      longitude: 0
    });

    const savedLead = await newLead.save();
    return res.status(201).json({ success: true, message: "Lead created successfully!", lead: savedLead });
  } catch (err) {
    console.error("🔥 Telecaller Lead Creation Error:", err);
    return res.status(500).json({ message: "Failed to create lead", error: err.message });
  }
});

// 3. Assign Lead to Specific Salesperson (Guarded by active shift check)
app.put("/api/telecaller/leads/:id/assign", verifyToken, async (req, res) => {
  try {
    // 🌟 Shift enforcement check
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });
    
    if (!session) {
      return res.status(403).json({ message: "Action Blocked: You must start your working day first!" });
    }

    const { salespersonId, requirementType, followUpDate, followUpTime, followUpAction } = req.body;
    if (!salespersonId) {
      return res.status(400).json({ message: "Salesperson ID is required!" });
    }

    const updateFields = { 
      salespersonId: salespersonId,
      assignedBy: req.user.name || req.user.userId, 
      requirementType: requirementType || "Demo"
    };

    if (followUpDate) updateFields.followUpDate = followUpDate;
    if (followUpTime) updateFields.followUpTime = followUpTime;
    if (followUpAction) updateFields.followUpAction = followUpAction;

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!updatedLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json({ success: true, message: `Lead successfully assigned!`, lead: updatedLead });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign lead", error: err.message });
  }
});


// 🌟 Admin/Boss Route: Track all telecaller activities and metrics
app.get("/api/admin/telecaller-activity", verifyToken, async (req, res) => {
  try {
    // Fetch all leads from the database
    const allLeads = await Lead.find({});

    // Group or map activities per telecaller
    const telecallerMap = {};

    allLeads.forEach(lead => {
      // 🌟 Check if lead was explicitly created by a telecaller
      const isTelecallerLead = lead.createdBy || lead.telecallerId || (lead.notes && lead.notes.includes("[Telecaller Entry"));

      // Agar yeh telecaller ki banayi hui lead nahi hai, toh ise skip kar dein
      if (!isTelecallerLead) return;

      // Extract accurate telecaller identifier
      let telecallerKey = lead.createdBy || lead.telecallerId;
      if (!telecallerKey && lead.notes) {
        const match = lead.notes.match(/\[Telecaller Entry - (.*?)\]/);
        if (match && match[1]) telecallerKey = match[1];
      }

      const finalTelecallerId = telecallerKey || "Unknown Telecaller";
      
      if (!telecallerMap[finalTelecallerId]) {
        telecallerMap[finalTelecallerId] = {
          telecallerId: finalTelecallerId,
          totalCreated: 0,
          totalAssigned: 0,
          totalPending: 0,
          assignedDetails: []
        };
      }

      telecallerMap[finalTelecallerId].totalCreated += 1;

      if (lead.salespersonId) {
        telecallerMap[finalTelecallerId].totalAssigned += 1;
        telecallerMap[finalTelecallerId].assignedDetails.push({
          leadId: lead._id,
          instituteName: lead.instituteName,
          salespersonId: lead.salespersonId,
          assignedBy: lead.assignedBy,
          requirementType: lead.requirementType,
          followUpDate: lead.followUpDate,
          followUpTime: lead.followUpTime,
          updatedAt: lead.updatedAt
        });
      } else {
        telecallerMap[finalTelecallerId].totalPending += 1;
      }
    });

    const activityReport = Object.values(telecallerMap);

    res.json({
      success: true,
      totalLeadsCount: allLeads.length,
      telecallerActivity: activityReport
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch telecaller activity logs", 
      error: err.message 
    });
  }
});


app.get("/api/telecaller/day-status", verifyToken, async (req, res) => {
  try {
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


// --- ⏱️ TELECALLER START DAY ROUTE ---
app.post("/api/telecaller/start-day", verifyToken, async (req, res) => {
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
      startLocation: {
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0
      },
      startAddress: startAddress || "",
      distancePoints: [
        {
          type: "START",
          referenceId: null,
          latitude: Number(latitude) || 0,
          longitude: Number(longitude) || 0,
          timestamp: new Date(),
          distanceFromPreviousKm: 0,
          totalDistanceKm: 0
        }
      ],
      totalDistanceKm: 0
    });

    await newSession.save();
    res.status(201).json({ success: true, message: "Day started successfully!", startAddress: newSession.startAddress, session: newSession });
  } catch (err) {
    res.status(500).json({ message: "Failed to start day", error: err.message });
  }
});

// --- ⏱️ TELECALLER END DAY ROUTE ---
app.post("/api/telecaller/end-day", verifyToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const session = await DaySession.findOne({ salespersonId: req.user.userId, date: today, status: "STARTED" });

    if (!session) {
      return res.status(400).json({ message: "No active day session found to end!" });
    }

    const { latitude, longitude } = req.body;
    const endTimeDate = new Date();

    session.status = "ENDED";
    session.endTime = endTimeDate;
    session.endLocation = {
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
    };
    await session.save();

    const workingMilliseconds = endTimeDate - new Date(session.startTime);
    const workingHours = (workingMilliseconds / (1000 * 60 * 60)).toFixed(1);

    res.json({
      success: true,
      message: "Day ended successfully.",
      summary: {
        startTime: new Date(session.startTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit', hour12: true }),
        endTime: endTimeDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit', hour12: true }),
        workingHours: `${workingHours} hrs`,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to end day", error: err.message });
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