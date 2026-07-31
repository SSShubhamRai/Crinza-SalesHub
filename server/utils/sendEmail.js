const nodemailer = require('nodemailer');

const sendInvoiceEmail = async (clientEmail, pdfBuffer, invoiceId) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: `"Crinza Billing Dept" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: `Crinza Invoice #${invoiceId} for Your App Service`,
      text: `Hello,\n\nPlease find attached the official invoice (#${invoiceId}) from Crinza Technologies.\n\nThank you!`,
      attachments: [
        {
          filename: `Invoice_${invoiceId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${clientEmail} | Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('🔥 Error in sendEmail.js:', error.message);
    throw error;
  }
};

module.exports = sendInvoiceEmail;