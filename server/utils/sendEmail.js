const axios = require("axios");
const FormData = require("form-data");

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

module.exports = sendInvoiceEmail;