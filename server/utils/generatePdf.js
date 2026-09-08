const path = require("path");
const fs = require("fs");

const createInvoicePDF = async (data) => {
  let browser;
  try {
    const logoPngPath = path.join(__dirname, "..", "uploads", "logo.png");
    const logoJpgPath = path.join(__dirname, "..", "uploads", "logo.jpg");
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

    const baseAmt = Number(data.baseAmount || data.totalCode || data.totalAmount || 0);
    const gstAmount = Math.round(baseAmt * 0.18);
    const discountAmt = Number(data.discountAmount || 0);
    const pastDueAmt = Number(data.previousDueBalance || 0);

    let addonRows = "";
    if (data.addons) {
      if (data.addons.testModule)
        addonRows += `<tr><td>Add-on: Test Series Module</td><td>Included</td><td>₹5,000</td></tr>`;
      if (data.addons.windowApp)
        addonRows += `<tr><td>Add-on: Windows Desktop App</td><td>Included</td><td>₹5,000</td></tr>`;
      if (data.addons.iosApp)
        addonRows += `<tr><td>Add-on: iOS Mobile App</td><td>Included</td><td>₹45,000</td></tr>`;
    }

    let discountRow = "";
    if (discountAmt > 0) {
      discountRow = `
        <tr style="color: #059669; background-color: #ecfdf5;">
          <td><strong>Discount Applied (Coupon: ${data.couponCode || "PROMO"})</strong></td>
          <td>-</td>
          <td><strong>-₹${discountAmt.toLocaleString("en-IN")}</strong></td>
        </tr>`;
    }

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

module.exports = createInvoicePDF;