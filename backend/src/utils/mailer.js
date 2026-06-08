const nodemailer = require('nodemailer');

// Initialize transporter optionally
let transporter = null;
const host = process.env.SMTP_HOST || '';
const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const from = process.env.SMTP_FROM || 'no-reply@tvtracker.local';

if (host && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass
    }
  });
  console.log(`[Mailer] Mailer initialized with SMTP host: ${host}`);
} else {
  console.log('[Mailer] SMTP credentials missing. Using MOCK terminal logger fallback.');
}

/**
 * Send an invitation email to a newly created user.
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} inviteLink - Setup link
 */
async function sendInvitationEmail(email, name, inviteLink) {
  const subject = 'Welcome to TVTracker - Complete Your Account Setup';
  const textBody = `Hello ${name || 'Watcher'},\n\nYou have been invited to join TVTracker!\n\nClick the link below to set up your password and access your account:\n${inviteLink}\n\nBest regards,\nTVTracker Team`;
  
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #3b82f6;">Welcome to TVTracker!</h2>
      <p>Hello ${name || 'Watcher'},</p>
      <p>You have been invited to join TVTracker to track your shows, movies, collections, and watch history.</p>
      <p style="margin: 24px 0;">
        <a href="${inviteLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Your Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="font-family: monospace; word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 0.9rem;">
        ${inviteLink}
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 0.8rem; color: #64748b;">This invite was generated automatically. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `TVTracker <${from}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody
      });
      console.log(`[Mailer] Invitation email successfully sent to ${email}`);
    } catch (err) {
      console.error(`[Mailer] Failed to send email to ${email}:`, err.message);
      // Fallback log to terminal so setup link isn't lost
      logMockEmail(email, name, inviteLink);
    }
  } else {
    logMockEmail(email, name, inviteLink);
  }
}

function logMockEmail(email, name, inviteLink) {
  console.log('\n================== MOCK INVITATION EMAIL ==================');
  console.log(`TO: ${email}`);
  console.log(`NAME: ${name || 'Watcher'}`);
  console.log('SUBJECT: Welcome to TVTracker - Complete Your Account Setup');
  console.log('SETUP LINK:');
  console.log(inviteLink);
  console.log('===========================================================\n');
}

module.exports = {
  sendInvitationEmail
};
