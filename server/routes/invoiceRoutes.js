const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const Invoice = require("../models/Invoice");
const TechnicalTask = require("../models/TechnicalTask");
const DaySession = require("../models/DaySession");

const createInvoicePDF = require("../utils/generatePdf");
const sendInvoiceEmail = require("../utils/sendEmail");
const { addSalespersonPoints } = require("../utils/salespersonPoints");
const { calculateDistance } = require("../utils/distanceHelper");
const Tesseract = require("tesseract.js");

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Cloudinary storage for invoice proofs
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "crinza_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
  },
});
const upload = multer({ storage: storage });

// 1. Invoice Submission Handler
const handleInvoiceSubmission = async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const session = await DaySession.findOne({
      salespersonId: req.user.userId,
      date: today,
    });

    if (!session || session.status !== "STARTED") {
      return res.status(403).json({
        message: "Action Blocked: You must start your day first before submitting invoices!",
      });
    }

    const invoiceLatitude = Number(req.body.latitude);
    const invoiceLongitude = Number(req.body.longitude);

    if (!Number.isFinite(invoiceLatitude) || !Number.isFinite(invoiceLongitude)) {
      return res.status(400).json({
        message: "Valid latitude and longitude are required to calculate invoice travel distance.",
      });
    }

    const invoiceId = "CRINZA-" + Date.now().toString().slice(-6);

    let parsedAddons = { testModule: false, windowApp: false, iosApp: false };
    if (req.body.addons) {
      try {
        parsedAddons = typeof req.body.addons === "string" ? JSON.parse(req.body.addons) : req.body.addons;
      } catch (e) {}
    }

    let parsedCategories = [];
    if (req.body.categories) {
      try {
        parsedCategories = typeof req.body.categories === "string" ? JSON.parse(req.body.categories) : req.body.categories;
      } catch (e) {
        parsedCategories = [req.body.categories];
      }
    }

    const paymentProofPath = req.files && req.files["paymentProof"] ? req.files["paymentProof"][0].path : "";
    const logoProofPath = req.files && req.files["logoProof"] ? req.files["logoProof"][0].path : "";

    const { ownerName, validityYears, validityMonths } = req.body;
    const yearsNum = Number(validityYears) || 0;
    const monthsNum = Number(validityMonths) || 0;

    let computedValidity = req.body.packageValidity || "1 Year";
    if (yearsNum > 0 || monthsNum > 0) {
      const yPart = yearsNum > 0 ? `${yearsNum} Year${yearsNum > 1 ? "s" : ""}` : "";
      const mPart = monthsNum > 0 ? `${monthsNum} Month${monthsNum > 1 ? "s" : ""}` : "";
      computedValidity = [yPart, mPart].filter(Boolean).join(" ");
    }

    const paymentMode = req.body.paymentMode || "ONLINE";
    const utrNumber = req.body.utrNumber ? req.body.utrNumber.trim() : "";
    const claimedPaid = Number(req.body.paidAmount) || 0;

    let ocrStatus = "PENDING";
    let ocrMessage = "Manual review required";

    if (paymentMode === "ONLINE" && utrNumber) {
      const existingUtrCheck = await Invoice.findOne({
        utrNumber: utrNumber,
        status: { $in: ["pending", "approved"] },
      });

      if (existingUtrCheck) {
        ocrStatus = "RED";
        ocrMessage = `Fraud Alert: UTR "${utrNumber}" already used in Invoice #${existingUtrCheck.invoiceId}!`;
      }
    }

    if (paymentMode === "ONLINE" && paymentProofPath && utrNumber && ocrStatus !== "RED") {
      try {
        const { data: { text } } = await Tesseract.recognize(paymentProofPath, "eng");
        const cleanedText = text.replace(/[\s,]/g, "");
        const isAmountMatched = cleanedText.includes(claimedPaid.toString());
        const isUtrMatched = cleanedText.includes(utrNumber);

        if (isUtrMatched && isAmountMatched) {
          ocrStatus = "GREEN";
          ocrMessage = "AI Verified: UTR & Amount Matched 100%";
        } else {
          ocrStatus = "YELLOW";
          ocrMessage = "Mismatch Warning: Entered UTR or Amount differs from screenshot!";
        }
      } catch (ocrErr) {
        ocrStatus = "YELLOW";
        ocrMessage = "OCR scan failed to read image clearly.";
      }
    } else if (paymentMode !== "ONLINE") {
      ocrStatus = "GREEN";
      ocrMessage = "Offline Payment Mode";
    }

    const newInvoice = new Invoice({
      ...req.body,
      categories: parsedCategories,
      ownerName: ownerName || "",
      validityYears: yearsNum,
      validityMonths: monthsNum,
      packageValidity: computedValidity,
      baseAmount: Number(req.body.baseAmount) || Number(req.body.totalAmount) || 0,
      totalAmount: Number(req.body.totalAmount) || 0,
      paidAmount: claimedPaid,
      dueAmount: Number(req.body.dueAmount) || 0,
      previousDueBalance: Number(req.body.previousDueBalance) || 0,
      discountAmount: Number(req.body.discountAmount) || 0,
      latitude: invoiceLatitude,
      longitude: invoiceLongitude,
      invoiceId,
      salespersonId: req.user.userId,
      paymentProof: paymentProofPath,
      logoProof: logoProofPath,
      addons: parsedAddons,
      paymentMode,
      utrNumber,
      receiptNo: req.body.receiptNo || "",
      chequeNo: req.body.chequeNo || "",
      bankName: req.body.bankName || "",
      ocrStatus,
      ocrMessage,
      status: "pending",
    });

    await newInvoice.save();

    if (!Array.isArray(session.distancePoints)) {
      session.distancePoints = [];
    }

    const previousPoint = session.distancePoints[session.distancePoints.length - 1];
    let distanceFromPreviousKm = 0;

    if (previousPoint) {
      const rawDist = calculateDistance(
        Number(previousPoint.latitude),
        Number(previousPoint.longitude),
        invoiceLatitude,
        invoiceLongitude
      );
      if (rawDist >= 0.02 && rawDist <= 50) {
        distanceFromPreviousKm = rawDist;
      }
    }

    const previousTotal = Number(session.totalDistanceKm) || 0;
    const newTotalDistance = previousTotal + distanceFromPreviousKm;

    session.distancePoints.push({
      type: "INVOICE",
      referenceId: newInvoice._id.toString(),
      latitude: invoiceLatitude,
      longitude: invoiceLongitude,
      timestamp: new Date(),
      distanceFromPreviousKm: Number(distanceFromPreviousKm.toFixed(3)),
      totalDistanceKm: Number(newTotalDistance.toFixed(3)),
    });

    session.totalDistanceKm = Number(newTotalDistance.toFixed(3));
    await session.save();
    await addSalespersonPoints(req.user.userId, "DEAL_CLOSED");

    return res.status(201).json({
      success: true,
      message: "Invoice request & installment ledger submitted to Accountant!",
      invoiceId,
      distanceAddedKm: Number(distanceFromPreviousKm.toFixed(3)),
      totalDistanceKm: Number(session.totalDistanceKm.toFixed(3)),
    });
  } catch (err) {
    console.error("🔥 INVOICE SUBMISSION FAILED:", err.message);
    return res.status(500).json({ message: "Failed to submit request", error: err.message });
  }
};

const invoiceUploadFields = upload.fields([
  { name: "paymentProof", maxCount: 1 },
  { name: "logoProof", maxCount: 1 }
]);

router.post("/request", verifyToken, invoiceUploadFields, handleInvoiceSubmission);
router.post("/salesperson/invoice-request", verifyToken, invoiceUploadFields, handleInvoiceSubmission);

// 2. Pending Invoices Route
router.get("/pending", verifyToken, async (req, res) => {
  try {
    if (!["accountant", "boss", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    const pendingInvoices = await Invoice.find({ status: "pending" }).sort({ createdAt: -1 });
    res.json(pendingInvoices);
  } catch (err) {
    res.status(500).json({ message: "Error fetching pending list", error: err.message });
  }
});

// 3. Invoice History Route
router.get("/history", verifyToken, async (req, res) => {
  try {
    if (!["accountant", "boss", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }
    const historyInvoices = await Invoice.find({ status: { $ne: "pending" } }).sort({ updatedAt: -1 });
    res.json(historyInvoices);
  } catch (err) {
    res.status(500).json({ message: "Error fetching invoice history", error: err.message });
  }
});

// 4. Approve Invoice Route
router.post("/approve/:id", verifyToken, async (req, res) => {
  try {
    if (!["accountant", "boss", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const pdfBuffer = await createInvoicePDF(invoice);
    await sendInvoiceEmail(invoice.email, pdfBuffer, invoice.invoiceId, invoice.instituteName);

    invoice.status = "approved";
    invoice.approvedBy = req.user.userId;
    await invoice.save();

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

    res.json({ message: `Invoice #${invoice.invoiceId} Approved & Technical Project Queued successfully!` });
  } catch (err) {
    res.status(500).json({ message: "Approval failed", error: err.message || "Internal error" });
  }
});

// 5. Update Invoice Route
router.put("/update/:id", verifyToken, async (req, res) => {
  try {
    if (!["accountant", "boss", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied!" });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: 'after' }
    );
    res.json({ message: "Invoice updated!", invoice: updatedInvoice });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
});

// 6. Reject Invoice Route
router.post("/reject/:id", verifyToken, async (req, res) => {
  try {
    if (!["accountant", "boss", "admin"].includes(req.user.role)) {
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

// 🎟️ Coupon Verification Route
router.post("/verify-coupon", verifyToken, async (req, res) => {
  try {
    const Coupon = require("../models/Coupon");
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
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error verifying coupon", error: err.message });
  }
});

module.exports = router;