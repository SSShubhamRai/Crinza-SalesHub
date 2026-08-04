/**
 * =========================================================================
 * 🚀 CRINZA INVOICE & LEAD MANAGEMENT SYSTEM - BACKEND SERVER (`server.js`)
 * =========================================================================
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
require("dotenv").config();

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
    methods: ["GET", "POST"],
  },
});

// --- Security & Proxy Setup ---
app.set("trust proxy", 1);
app.use(helmet());
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

// --- File Uploads Directory Setup ---
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Multer Storage Engine Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

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
// --- 📍 LOCATION TRACKING SCHEMA (NEW) ---
// =========================================================================
const locationLogSchema = new mongoose.Schema({
  salespersonId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  date: { type: String, required: true, index: true }, // Format: 'YYYY-MM-DD'
  timestamp: { type: Date, default: Date.now },
});
const LocationLog = mongoose.model("LocationLog", locationLogSchema);

// =========================================================================
// --- 📐 DISTANCE CALCULATION HELPER (Haversine Formula) (NEW) ---
// =========================================================================
function calculateTotalDistance(coords) {
  let totalDistance = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = coords[i].latitude;
    const lon1 = coords[i].longitude;
    const lat2 = coords[i + 1].latitude;
    const lon2 = coords[i + 1].longitude;

    const R = 6371; // Radius of Earth in KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDistance += R * c;
  }
  return Number(totalDistance.toFixed(2)); // Returns distance in Kilometers
}

// =========================================================================
// --- 🌐 SOCKET.IO REAL-TIME LOCATION HANDLER (NEW) ---
// =========================================================================
io.on("connection", (socket) => {
  console.log(`🔌 Client Connected: ${socket.id}`);

  // Salesperson sends live location update
  socket.on("update_location", async (data) => {
    try {
      const { salespersonId, latitude, longitude } = data;
      if (!salespersonId || !latitude || !longitude) return;

      const currentDate = new Date().toISOString().split("T")[0];

      // 1. Save coordinate to database for history & distance calculation
      await LocationLog.create({
        salespersonId,
        latitude,
        longitude,
        date: currentDate,
      });

      // 2. Broadcast live location instantly to Admins / Boss dashboard
      io.emit("live_location_broadcast", {
        salespersonId,
        latitude,
        longitude,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("🔥 Socket Location Error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client Disconnected: ${socket.id}`);
  });
});

// =========================================================================
// --- 📄 PDF GENERATOR HELPER (Universal Stable Mode) ---
// =========================================================================
const PDFDocument = require('pdfkit');

const createInvoicePDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      let buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        let pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // --- PDF Design & Content ---
      doc.fontSize(20).fillColor('#4f46e5').text('CRINZA TECHNOLOGIES', { align: 'left' });
      doc.fontSize(10.5).fillColor('#64748b').text('Tax Invoice / Bill of Supply');
      doc.moveDown();

      doc.fontSize(12).fillColor('#1e293b').text(`Invoice #: ${data.invoiceId}`);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
      doc.moveDown();

      // Billed To Box
      doc.fontSize(12).fillColor('#4f46e5').text('Billed To:');
      doc.fontSize(10).fillColor('#1e293b')
         .text(`Institute: ${data.instituteName || 'N/A'}`)
         .text(`App Name: ${data.appName || 'N/A'}`)
         .text(`Mobile: ${data.mobileNo || 'N/A'}`)
         .text(`Email: ${data.email || 'N/A'}`);
      doc.moveDown();

      // Table / Items
      doc.fontSize(10).fillColor('#4f46e5').text('Description', { continued: true });
      doc.text('Validity', { align: 'right', continued: true });
      doc.text('Cost', { align: 'right' });
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fillColor('#1e293b').text(`${data.appName} License`, { continued: true });
      doc.text(`${data.packageValidity || '1 Year'}`, { align: 'right', continued: true });
      doc.text(`Rs. ${(data.baseAmount || data.totalAmount || 0).toLocaleString('en-IN')}`, { align: 'right' });

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Totals
      doc.fontSize(11).text(`Total Amount: Rs. ${data.totalAmount ? data.totalAmount.toLocaleString('en-IN') : 0}`, { align: 'right' });
      doc.text(`Paid Amount: Rs. ${data.paidAmount ? data.paidAmount.toLocaleString('en-IN') : 0}`, { align: 'right' });
      doc.text(`Due Amount: Rs. ${data.dueAmount ? data.dueAmount.toLocaleString('en-IN') : 0}`, { align: 'right' });

      doc.moveDown(2);
      doc.fontSize(9).fillColor('#64748b').text('Terms & Conditions: Software once sold will not be refunded. Support valid as per package agreement.');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// =========================================================================
// --- 📧 EMAIL SENDER HELPER ---
// =========================================================================
const sendInvoiceEmail = async (clientEmail, pdfBuffer, invoiceId) => {
  try {
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
      from: `"Crinza Billing Dept" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: `Crinza Invoice #${invoiceId} for Your Service`,
      text: `Hello,\n\nPlease find attached the official invoice (#${invoiceId}) for your subscription.\n\nThank you!\nCrinza Technologies`,
      attachments: [
        {
          filename: `Invoice_${invoiceId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
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
        { userId: user.userId, role: user.role },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1d" },
      );
      res.json({ token, userId: user.userId, role: user.role });
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

// 🌟 NEW: Admin gets today's route history & total distance traveled by a salesperson
app.get(
  "/api/boss/salesperson-travel/:salespersonId",
  verifyToken,
  async (req, res) => {
    try {
      if (req.user.role !== "boss" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied!" });
      }

      const { salespersonId } = req.params;
      const queryDate =
        req.query.date || new Date().toISOString().split("T")[0];

      const logs = await LocationLog.find({
        salespersonId,
        date: queryDate,
      }).sort({ timestamp: 1 });

      const totalDistanceKm = calculateTotalDistance(logs);

      res.json({
        salespersonId,
        date: queryDate,
        totalDistanceKm,
        routePoints: logs,
      });
    } catch (err) {
      res
        .status(500)
        .json({
          message: "Failed to fetch travel history",
          error: err.message,
        });
    }
  },
);

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

app.get(
  "/api/boss/employee-leads/:salespersonId",
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
      const leads = await Lead.find({ salespersonId: queryId }).sort({
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

app.post("/api/boss/create-coupon", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { code, discountType, discountValue, expiryDate } = req.body;
    if (!code || !discountValue) {
      return res
        .status(400)
        .json({ message: "Coupon code and value are required!" });
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
    });

    await newCoupon.save();
    res
      .status(201)
      .json({ message: "Coupon created successfully!", coupon: newCoupon });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create coupon", error: err.message });
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

app.post("/api/auth/create-employee", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "boss" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied!" });
    }
    const { userId, name, email, password, role } = req.body;
    if (!userId || !name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
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
      password: hashedPassword,
      role: role || "salesperson",
    });

    await newEmp.save();
    res.status(201).json({ message: "Employee created successfully!" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create employee", error: err.message });
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

    await Invoice.updateMany(
      { salespersonId: fromSalesperson },
      { $set: { salespersonId: toSalesperson } },
    );
    await Lead.updateMany(
      { salespersonId: fromSalesperson },
      { $set: { salespersonId: toSalesperson } },
    );
    await Task.updateMany(
      { salespersonId: fromSalesperson },
      { $set: { salespersonId: toSalesperson } },
    );

    res.json({
      message: `Successfully transferred leads & invoices from ${fromSalesperson} to ${toSalesperson}!`,
    });
  } catch (err) {
    res.status(500).json({ message: "Transfer failed", error: err.message });
  }
});

// =========================================================================
// --- 🧾 INVOICE & BILLING API ROUTES ---
// =========================================================================
app.post(
  "/api/invoices/request",
  verifyToken,
  upload.single("paymentProof"),
  async (req, res) => {
    try {
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

      const normalizedPath = req.file ? req.file.path.replace(/\\/g, "/") : "";

      const newInvoice = new Invoice({
        ...req.body,
        baseAmount:
          Number(req.body.baseAmount) || Number(req.body.totalAmount) || 0,
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
        status: "pending",
      });

      await newInvoice.save();
      res
        .status(201)
        .json({
          message: "Invoice request submitted to Accountant!",
          invoiceId,
        });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to submit request", error: err.message });
    }
  },
);

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

    const pdfBuffer = await createInvoicePDF(invoice);
    await sendInvoiceEmail(invoice.email, pdfBuffer, invoice.invoiceId);

    invoice.status = "approved";
    invoice.approvedBy = req.user.userId;
    await invoice.save();

    res.json({
      message: `Invoice #${invoice.invoiceId} Approved & Emailed successfully!`,
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
      { new: true },
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
// --- 👤 SALESPERSON SPECIFIC ROUTES (WITH MULTI-VISIT & AUTO TIMESTAMP) ---
// =========================================================================
app.get("/api/salesperson/my-deals", verifyToken, async (req, res) => {
  try {
    const deals = await Invoice.find({ salespersonId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json(deals);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch deals history", error: err.message });
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

      const normalizedPath = req.file ? req.file.path.replace(/\\/g, "/") : "";

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

app.put("/api/salesperson/leads/:id", verifyToken, async (req, res) => {
  try {
    const {
      demoStatus,
      leadStatus,
      notes,
      followUpDate,
      followUpTime,
      followUpAction,
    } = req.body;

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          demoStatus,
          leadStatus,
          notes,
          followUpDate,
          followUpTime,
          followUpAction,
        },
      },
      { new: true },
    );

    if (!updatedLead)
      return res.status(404).json({ message: "Lead not found" });
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
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Server error verifying coupon", error: err.message });
  }
});

// =========================================================================
// --- 🌐 SERVER LISTENER (Using HTTP Server for Socket.io) ---
// =========================================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT} with Socket.io Live Tracking Enabled`,
  );
});
