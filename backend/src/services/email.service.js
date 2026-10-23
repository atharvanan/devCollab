const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporterInstance = null;
let etherealPreviewBase = null;

/**
 * Creates (and caches) the appropriate transporter.
 * - In development with no real SMTP configured: auto-provisions a free Ethereal test account.
 *   Emails are captured at https://ethereal.email — no setup needed.
 * - In production (or when real SMTP env vars are set): uses the configured SMTP credentials.
 */
const getTransporter = async () => {
  if (transporterInstance) return transporterInstance;

  const isRealSMTP =
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    !process.env.SMTP_USER.includes('your_email') &&
    !process.env.SMTP_PASS.includes('your_app_password');

  if (isRealSMTP) {
    transporterInstance = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });
    logger.info(`[EMAIL] Using real SMTP via ${process.env.SMTP_USER}`);
  } else {
    // Auto-provision a free Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    etherealPreviewBase = 'https://ethereal.email';
    transporterInstance = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(`[EMAIL] No real SMTP configured. Using Ethereal test email.`);
    logger.info(`[EMAIL] View sent emails at: ${etherealPreviewBase}/messages`);
    logger.info(`[EMAIL] Ethereal login → user: ${testAccount.user}  pass: ${testAccount.pass}`);
  }

  return transporterInstance;
};

/**
 * Verifies SMTP connection on startup. Call once from server.js.
 */
const verifySMTPConnection = async () => {
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    logger.info('[EMAIL] SMTP connection verified ✓');
    return true;
  } catch (err) {
    logger.error('[EMAIL] SMTP connection FAILED:', err.message);
    return false;
  }
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = await getTransporter();
    const from = process.env.EMAIL_FROM ||
      (process.env.SMTP_USER ? `DevCollab <${process.env.SMTP_USER}>` : 'DevCollab <noreply@devcollab.app>');

    const info = await transporter.sendMail({ from, to, subject, html, text });
    logger.info(`[EMAIL] Delivered to ${to}: ${info.messageId}`);

    // When using Ethereal, log a direct preview link
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`[EMAIL] 📬 Preview OTP email here → ${previewUrl}`);
    }

    return info;
  } catch (err) {
    logger.error(`[EMAIL] Failed to deliver to ${to}:`, err.message);
    throw err;
  }
};

const sendOTPEmail = async (to, otp, name) => {
  logger.info(`[AUTH] Verification OTP for ${to}: ${otp}`);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">DevCollab - Verify Your Email</h2>
      <p>Hi ${name},</p>
      <p>Your verification code is:</p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${otp}</span>
      </div>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #64748b; font-size: 12px;">DevCollab — Collaborative Code Review Platform</p>
    </div>
  `;
  return sendEmail({ to, subject: 'Verify your DevCollab account', html });
};

const sendNotificationEmail = async (to, { title, message, link }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">DevCollab Notification</h2>
      <h3>${title}</h3>
      <p>${message}</p>
      ${link ? `<a href="${link}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">View in DevCollab</a>` : ''}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #64748b; font-size: 12px;">You can manage notifications in your DevCollab settings.</p>
    </div>
  `;
  return sendEmail({ to, subject: title, html });
};

module.exports = { sendEmail, sendOTPEmail, sendNotificationEmail, verifySMTPConnection };


