const puppeteer = require('puppeteer');

const createInvoicePDF = async (data) => {
  let browser;

  try {
    // 1. FIX: Render compatible browser launch args
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
  } catch (err) {
    console.error("Puppeteer Launch Error:", err);
    throw err;
  }

  const page = await browser.newPage();
  
  // Live server ya local URL for logo
  const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://rapidbill-f143.onrender.com';

  // 2. FIX: Addons display logic
  let addonRows = '';
  if (data.addons) {
    if (data.addons.testModule) {
      addonRows += `<tr><td>Add-on: Test Series Module</td><td>Included</td><td>₹0</td></tr>`;
    }
    if (data.addons.windowApp) {
      addonRows += `<tr><td>Add-on: Windows Desktop App</td><td>Included</td><td>₹0</td></tr>`;
    }
    if (data.addons.iosApp) {
      addonRows += `<tr><td>Add-on: iOS Mobile App</td><td>Included</td><td>₹0</td></tr>`;
    }
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; }
        .logo-img { max-height: 55px; width: auto; display: block; margin-bottom: 4px; }
        .invoice-details { text-align: right; }
        .details-grid { display: flex; justify-content: space-between; margin-top: 25px; }
        .box { width: 48%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin-top: 25px; }
        th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
        th { background-color: #4f46e5; color: white; }
        .total-box { margin-top: 20px; text-align: right; font-size: 14px; }
        .emp-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 12px; margin-top: 5px; }
        .terms { margin-top: 35px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <!-- Logo Loaded from Server Uploads -->
          <img src="${baseUrl}/uploads/logo.png" class="logo-img" alt="Crinza Logo" />
          <p style="margin:2px 0; font-size: 12px; color: #64748b;">Crinza Technologies Pvt Ltd</p>
        </div>
        <div class="invoice-details">
          <h2 style="margin:0; color:#334155;">TAX INVOICE</h2>
          <p style="margin:3px 0;">Invoice #: <strong>${data.invoiceId}</strong></p>
          <p style="margin:3px 0;">Date: ${new Date().toLocaleDateString('en-IN')}</p>
          <!-- FIX: salespersonId matched with Mongoose Schema -->
          <div class="emp-badge">Salesperson ID: ${data.salespersonId || data.createdBy || 'N/A'}</div>
        </div>
      </div>

      <div class="details-grid">
        <div class="box">
          <h4 style="margin-top:0; color:#4f46e5;">Client / Billed To:</h4>
          <p style="margin:3px 0;"><strong>Institute:</strong> ${data.instituteName}</p>
          <p style="margin:3px 0;"><strong>App Name:</strong> ${data.appName}</p>
          <p style="margin:3px 0;"><strong>Mobile:</strong> ${data.mobileNo}</p>
          <p style="margin:3px 0;"><strong>Email:</strong> ${data.email}</p>
          <p style="margin:3px 0;"><strong>Pincode:</strong> ${data.pincode}</p>
          ${data.gstNo ? `<p style="margin:3px 0;"><strong>GSTIN:</strong> ${data.gstNo}</p>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description / Package Items</th>
            <th>Validity</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${data.appName} - Crinza Main Android App License</td>
            <td>${data.packageValidity}</td>
            <td>₹${data.totalAmount ? data.totalAmount.toLocaleString('en-IN') : 0}</td>
          </tr>
          ${addonRows}
        </tbody>
      </table>

      <div class="total-box">
        <p>Total Price: <strong>₹${data.totalAmount ? data.totalAmount.toLocaleString('en-IN') : 0}</strong></p>
        <p>Payment Received: <strong style="color: #16a34a;">₹${data.paidAmount ? data.paidAmount.toLocaleString('en-IN') : 0}</strong></p>
        <p>Due Balance: <strong style="color: #dc2626;">₹${data.dueAmount ? data.dueAmount.toLocaleString('en-IN') : 0}</strong></p>
      </div>

      <div class="terms">
        <h4>Terms & Conditions:</h4>
        <p style="white-space: pre-line;">${data.termsAndConditions}</p>
      </div>
    </body>
    </html>
  `;

  // 3. FIX: Networkidle0 waits for images to load before rendering PDF
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return pdfBuffer;
};

module.exports = createInvoicePDF;