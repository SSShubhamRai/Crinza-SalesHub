const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const axios = require("axios");
const FormData = require("form-data");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");
const verifyToken = require("../middleware/authMiddleware");

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// 1. Login Route
router.post("/login", loginLimiter, [
  body("userId", "User ID is required").notEmpty(),
  body("password", "Password is required").notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId, password } = req.body;
  try {
    const user = await User.findOne({ userId });
    if (!user) return res.status(400).json({ message: "User ID not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { userId: user.userId, name: user.name, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );
    res.json({ token, userId: user.userId, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 2. Forgot Password OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: "Please enter your Employee ID or Email!" });
    }

    const query = identifier.includes("@")
      ? { email: identifier.trim().toLowerCase() }
      : { userId: identifier.trim() };

    const user = await User.findOne(query);
    if (!user || !user.email) {
      return res.status(404).json({ message: "No registered account found with this ID or Email!" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = crypto.createHash("sha256").update(otp).digest("hex");
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

// 3. Reset Password OTP Verify
router.post("/reset-password-otp", async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long!" });
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

// 4. Create Employee Route
// 4. Create Employee Route
router.post("/create-employee", verifyToken, async (req, res) => {
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
    const assignedRole = role ? role.toLowerCase() : "salesperson";

    const newEmp = new User({
      userId,
      name,
      email,
      phone: phone || "",
      password: hashedPassword,
      role: assignedRole,
    });

    await newEmp.save();
    let emailSent = false;

    try {
      const loginPortalUrl = process.env.FRONTEND_URL || "https://crinza-saleshub.onrender.com";
      const form = new FormData();
      form.append('sendTo', email);
      form.append('message', `
        <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #f8fafc;">
          <h2 style="color: #4f46e5; text-align: center; margin-bottom: 5px;">Welcome Aboard, ${name}! 🎉</h2>
          <p style="text-align: center; color: #64748b; font-size: 13px; margin-top: 0;">We are thrilled to have you join our growing team.</p>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your official account has been successfully created on the <strong>Crinza One Portal</strong> as a <strong>${assignedRole.toUpperCase()}</strong>.</p>
          <div style="background: #ffffff; padding: 18px; border-radius: 12px; border: 1px solid #cbd5e1; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>👤 User ID:</strong> ${userId}</p>
            <p style="margin: 8px 0;"><strong>🔑 Password:</strong> ${password}</p>
            <p style="margin: 8px 0;"><strong>🌐 Portal:</strong> <a href="${loginPortalUrl}" target="_blank">Access Portal</a></p>
          </div>
        </div>
      `);

      await axios.post('https://api.crinza.com/api/v1/contact/message', form, {
        headers: { ...form.getHeaders(), 'Origin': 'https://crinza.com' },
      });
      emailSent = true;
    } catch (emailErr) {
      console.error("🔥 Welcome Email API Error:", emailErr.response?.data || emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Employee ${name} created successfully! ${emailSent ? '📧 Welcome Email Sent.' : ''}`,
      emailSent,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create employee", error: err.message });
  }
});

// WebAuthn configuration & routes
const rpName = "Crinza SalesHub";
const rpID = process.env.NODE_ENV === "production" ? "crinza-saleshub.onrender.com" : "localhost";
const expectedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const challengeStore = {};

router.post("/webauthn/register-options", verifyToken, async (req, res) => {
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
        return { id: credId, type: 'public-key' };
      }).filter(d => d.id);
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user._id.toString()),
      userName: user.userId,
      excludeCredentials,
      authenticatorSelection: { userVerification: "preferred", authenticatorAttachment: "platform", residentKey: "preferred" }
    });

    challengeStore[user.userId] = options.challenge;
    res.json(options);
  } catch (err) {
    res.status(500).json({ message: "Failed to generate registration options", error: err.message });
  }
});

router.post("/webauthn/register-verify", verifyToken, async (req, res) => {
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

      const credIdBuffer = credentialID ? Buffer.from(credentialID) : Buffer.from(credential.id, 'base64');
      const credPubKeyBuffer = credentialPublicKey ? Buffer.from(credentialPublicKey) : Buffer.alloc(0);

      const existingDevice = user.devices.find(d => {
        if (!d.credentialID || !credIdBuffer) return false;
        try { return Buffer.compare(d.credentialID, credIdBuffer) === 0; } catch (e) { return false; }
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
    res.status(500).json({ message: "Registration error", error: err.message });
  }
});

router.post("/webauthn/login-options", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ userId: userId?.trim() });
    if (!user) return res.status(404).json({ message: "User ID not found" });

    if (!user.devices || user.devices.length === 0) {
      return res.status(400).json({ message: "No fingerprint registered. Please login with password first." });
    }

    const allowCredentials = user.devices.map(dev => {
      let credId = dev.credentialID;
      if (!credId) return null;
      let idString = credId;
      if (Buffer.isBuffer(credId)) {
        idString = credId.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      } else if (typeof credId === 'object' && credId.buffer) {
        idString = Buffer.from(credId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      }
      return { id: idString, type: 'public-key', transports: dev.transports || [] };
    }).filter(Boolean);

    const options = await generateAuthenticationOptions({ rpID, allowCredentials, userVerification: "preferred" });
    challengeStore[user.userId] = options.challenge;
    res.json(options);
  } catch (err) {
    res.status(500).json({ message: "Failed to generate login options", error: err.message });
  }
});

router.post("/webauthn/login-verify", async (req, res) => {
  try {
    const { userId, credential } = req.body;
    const user = await User.findOne({ userId: userId?.trim() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const expectedChallenge = challengeStore[user.userId];
    delete challengeStore[user.userId];

    if (!user.devices || user.devices.length === 0) {
      return res.status(400).json({ message: "No devices found." });
    }

    const deviceIndex = user.devices.findIndex(d => {
      if (!d || !d.credentialID) return false;
      try {
        const dbIdStr = Buffer.isBuffer(d.credentialID)
          ? d.credentialID.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
          : String(d.credentialID);
        return dbIdStr === credential.id;
      } catch (e) { return false; }
    });

    if (deviceIndex === -1) {
      return res.status(400).json({ message: "Biometric device not recognized." });
    }

    const device = user.devices[deviceIndex];
    const pubKeyBuffer = Buffer.isBuffer(device.credentialPublicKey) ? device.credentialPublicKey : Buffer.from(device.credentialPublicKey || []);
    const credIdBuffer = Buffer.isBuffer(device.credentialID) ? device.credentialID : Buffer.from(device.credentialID || []);
    const safeCounter = (typeof device.counter === 'number' && !isNaN(device.counter)) ? device.counter : 0;

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: { credentialPublicKey: pubKeyBuffer, credentialID: credIdBuffer, counter: safeCounter },
    });

    if (verification.verified) {
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
    res.status(500).json({ message: "Login verification error", error: err.message });
  }
});

// 5. Update FCM Token Route (For Push Notifications)
router.put("/update-fcm-token", verifyToken, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ message: "FCM Token is required!" });
    }

    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    user.fcmToken = fcmToken;
    await user.save();

    res.json({ success: true, message: "FCM Token updated successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;