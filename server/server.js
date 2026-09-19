
const express = require("express");
const http = require("http"); 
const { Server } = require("socket.io"); 
const mongoose = require("mongoose");
const cors = require("cors");
const connectDB = require("./config/db");
const jwt = require("jsonwebtoken");  
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios"); 
const FormData = require("form-data"); 
const Tesseract = require("tesseract.js");
require("dotenv").config();


const {
  addSalespersonPoints,
} = require("./utils/salespersonPoints");

const {
  calculateDistance,
  getActualRoadDistance,
  calculateValidDistance,
} = require("./utils/distanceHelper");

const createInvoicePDF = require("./utils/generatePdf");
const sendInvoiceEmail = require("./utils/sendEmail");

const { scanGmailForLeaves } = require("./controllers/gmailSyncController");

require("./utils/scheduler")




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
const xss = require("xss-clean"); 

// --- Model & Middleware Imports ---
const User = require("./models/User");
const Invoice = require("./models/Invoice");
const Lead = require("./models/Lead");
const Coupon = require("./models/Coupon");
const verifyToken = require("./middleware/authMiddleware");
const SalespersonPoint = require("./models/SalespersonPoint");
const Task = require("./models/Task");
const CallLog = require("./models/CallLog");
const ReportLog = require("./models/ReportLog");
const TechnicalTask = require("./models/TechnicalTask");
const Broadcast = require("./models/Broadcast");
const DaySession = require("./models/DaySession");
const LocationLog = require("./models/LocationLog");

const app = express();
const server = http.createServer(app); 

app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const bossRoutes = require("./routes/bossRoutes");
app.use("/api/boss", bossRoutes);

const salespersonRoutes = require("./routes/salespersonRoutes");
app.use("/api/salesperson", salespersonRoutes);

const invoiceRoutes = require("./routes/invoiceRoutes");
app.use("/api/invoices", invoiceRoutes);

const telecallerRoutes = require("./routes/telecallerRoutes");
app.use("/api/telecaller", telecallerRoutes);

// server.js ke andar jahan baaki routes hain wahan yeh add karein:
const hrRoutes = require("./routes/hrRoutes");
app.use("/api/hr", hrRoutes);

connectDB()

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
app.set("io", io);

// --- Security & Proxy Setup ---
app.set("trust proxy", 1);


app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

app.use(xss()); 

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

setInterval(() => {
  console.log("Scanning Gmail for incoming leave requests...");
  scanGmailForLeaves();
}, 15 * 60 * 1000);



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
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!salespersonId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const currentDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const currentTime = new Date();

    const activeSession = await DaySession.findOne({
      salespersonId,
      date: currentDate,
      status: "STARTED",
    });

    if (!activeSession) return;

    const lastLocationLog = await LocationLog.findOne({
      salespersonId,
      date: currentDate,
    }).sort({ timestamp: -1 });

    let incrementalDist = 0;
    const MIN_MOVEMENT_THRESHOLD = 0.015;
    const MAX_JUMP_THRESHOLD = 3.0;       

    if (lastLocationLog) {
      const prevLat = Number(lastLocationLog.latitude);
      const prevLng = Number(lastLocationLog.longitude);

      const straightLineDist = calculateDistance(prevLat, prevLng, lat, lng);

      if (straightLineDist >= MIN_MOVEMENT_THRESHOLD) {
        incrementalDist = await getActualRoadDistance(prevLat, prevLng, lat, lng);
      }
    }

    // Safe increment check
    if (incrementalDist > 0 && incrementalDist <= MAX_JUMP_THRESHOLD) {
      activeSession.totalDistanceKm = Number(((activeSession.totalDistanceKm || 0) + incrementalDist).toFixed(3));

      if (!Array.isArray(activeSession.distancePoints)) {
        activeSession.distancePoints = [];
      }

      activeSession.distancePoints.push({
        type: "GPS_PING",
        latitude: lat,
        longitude: lng,
        timestamp: currentTime,
        distanceFromPreviousKm: incrementalDist,
        totalDistanceKm: activeSession.totalDistanceKm
      });

      await activeSession.save();
    }

    // Save location log
    await LocationLog.create({
      salespersonId,
      latitude: lat,
      longitude: lng,
      date: currentDate,
      timestamp: currentTime,
    });

    // Broadcast live location to admin dashboard
    io.emit("live_location_broadcast", {
      salespersonId,
      latitude: lat,
      longitude: lng,
      totalDistanceKm: activeSession.totalDistanceKm,
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

// --- 🎟️ COUPON VERIFICATION ROUTE ---
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
      success: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error verifying coupon", error: err.message });
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