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

async function sendAdminRequestNotification(admins, media, requester, season = null, episode = null) {
  const appDomain = process.env.APP_DOMAIN || '';
  let mediaTitle = media.title;
  if (typeof season === 'number' && !isNaN(season) && typeof episode === 'number' && !isNaN(episode)) mediaTitle += ` (S${season}E${episode})`;
  else if (typeof season === 'number' && !isNaN(season)) mediaTitle += ` (Season ${season})`;
  else if (media.type === 'tv') mediaTitle += ` (Series)`;

  const mediaTypeName = media.type === 'movie' ? 'a Movie' : 'a TV Show';
  const subject = `${requester.username} has requested ${mediaTypeName}`;
  const posterUrl = media.posterPath ? `https://image.tmdb.org/t/p/w500${media.posterPath}` : '';
  const mediaLink = `${appDomain}/${media.type}/${media.tmdbId}`;
  const requestsLink = `${appDomain}/requests`;
  const avatarUrl = requester.avatarPath ? `${appDomain}${requester.avatarPath}` : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(requester.username) + '&background=random';
  const releaseYear = media.releaseDate ? new Date(media.releaseDate).getFullYear() : '';

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Media Request</title>
    </head>
    <body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; -webkit-font-smoothing: antialiased;">
      
      <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
        
        <!-- Header Section -->
        <div style="padding: 32px 32px 16px 32px; text-align: center;">
          <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #f8fafc; text-transform: uppercase; letter-spacing: 1px;">New Request</h2>
          
          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="padding-right: 12px;">
                <img src="${avatarUrl}" alt="${requester.username}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #3b82f6; display: block;" />
              </td>
              <td style="font-size: 16px; color: #cbd5e1; text-align: left;">
                <strong style="color: #ffffff;">${requester.username}</strong> requested ${mediaTypeName}
              </td>
            </tr>
          </table>
        </div>

        <!-- Nested Media Card -->
        <div style="padding: 16px 32px;">
          <div style="background-color: #020617; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            <a href="${mediaLink}" style="display: block; text-decoration: none;">
              ${posterUrl ? 
                `<img src="${posterUrl}" alt="${mediaTitle}" style="width: 100%; height: auto; display: block;" />` : 
                `<div style="width: 100%; padding-top: 150%; background-color: #334155;"></div>`
              }
            </a>
            <div style="padding: 24px; text-align: left;">
              <h3 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">${mediaTitle}</h3>
              ${releaseYear ? `<p style="margin: 0; font-size: 15px; color: #94a3b8; font-weight: 600;">${releaseYear}</p>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Action Button -->
        <div style="padding: 16px 32px 32px 32px;">
          <a href="${requestsLink}" style="display: block; background-color: #3b82f6; color: #ffffff; text-align: center; padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 700; text-decoration: none;">
            Review Request
          </a>
        </div>
        
      </div>
    </body>
    </html>
  `;
  const textBody = `New Request: ${requester.username} has requested ${mediaTitle}.`;

  for (const admin of admins) {
    if (!admin.email) continue;
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `TVTracker <${from}>`,
          to: admin.email,
          subject,
          text: textBody,
          html: htmlBody
        });
      } catch (err) {
        console.error(`[Mailer] Failed to send admin notification to ${admin.email}:`, err.message);
      }
    } else {
      console.log(`[Mailer MOCK] Admin Notification to ${admin.email}: ${subject}`);
    }
  }
}

async function sendUserRequestUpdateNotification(user, media, actionType, reason = null, season = null, episode = null) {
  if (!user.email) return;

  const appDomain = process.env.APP_DOMAIN || '';
  let mediaTitle = media.title;
  if (typeof season === 'number' && !isNaN(season) && typeof episode === 'number' && !isNaN(episode)) mediaTitle += ` (S${season}E${episode})`;
  else if (typeof season === 'number' && !isNaN(season)) mediaTitle += ` (Season ${season})`;
  else if (media.type === 'tv') mediaTitle += ` (Series)`;

  const actionText = actionType === 'confirmed' ? 'has been confirmed' 
                   : actionType === 'collected' ? 'has been completed'
                   : actionType === 'rejected' ? 'has been rejected' 
                   : actionType === 'cancelled' ? 'has been cancelled' : 'has been updated';

  const subject = `Update on your request: ${mediaTitle}`;
  const posterUrl = media.posterPath ? `https://image.tmdb.org/t/p/w500${media.posterPath}` : '';
  const mediaLink = `${appDomain}/${media.type}/${media.tmdbId}`;
  const releaseYear = media.releaseDate ? new Date(media.releaseDate).getFullYear() : '';

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Request Update</title>
    </head>
    <body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; -webkit-font-smoothing: antialiased;">
      
      <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
        
        <!-- Header Section -->
        <div style="padding: 32px 32px 16px 32px; text-align: center;">
          <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #f8fafc; text-transform: uppercase; letter-spacing: 1px;">Request Update</h2>
          
          <p style="margin: 0 0 8px 0; font-size: 18px; color: #ffffff;">
            Hello <strong>${user.username}</strong>,
          </p>
          <p style="margin: 0; font-size: 16px; color: #cbd5e1; line-height: 1.5;">
            Your request for <strong style="color: #ffffff;">${mediaTitle}</strong> ${actionText}.
          </p>
          ${reason && (actionType === 'rejected' || actionType === 'cancelled') ? 
            `<div style="margin-top: 16px; padding: 16px; background-color: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); text-align: left;">
              <p style="margin: 0; color: #fca5a5; font-size: 15px;"><strong>Reason:</strong> ${reason}</p>
             </div>` : ''}
        </div>

        <!-- Nested Media Card -->
        <div style="padding: 16px 32px;">
          <div style="background-color: #020617; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            <a href="${mediaLink}" style="display: block; text-decoration: none;">
              ${posterUrl ? 
                `<img src="${posterUrl}" alt="${mediaTitle}" style="width: 100%; height: auto; display: block;" />` : 
                `<div style="width: 100%; padding-top: 150%; background-color: #334155;"></div>`
              }
            </a>
            <div style="padding: 24px; text-align: left;">
              <h3 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">${mediaTitle}</h3>
              ${releaseYear ? `<p style="margin: 0; font-size: 15px; color: #94a3b8; font-weight: 600;">${releaseYear}</p>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Action Button -->
        <div style="padding: 16px 32px 32px 32px;">
          <a href="${mediaLink}" style="display: block; background-color: #3b82f6; color: #ffffff; text-align: center; padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 700; text-decoration: none;">
            View Media
          </a>
        </div>
        
      </div>
    </body>
    </html>
  `;
  const textBody = `Update: Your request for ${mediaTitle} ${actionText}.${reason ? ' Reason: ' + reason : ''}`;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `TVTracker <${from}>`,
        to: user.email,
        subject,
        text: textBody,
        html: htmlBody
      });
    } catch (err) {
      console.error(`[Mailer] Failed to send user update notification to ${user.email}:`, err.message);
    }
  } else {
    console.log(`[Mailer MOCK] User Update Notification to ${user.email}: ${subject}`);
  }
}

module.exports = {
  sendInvitationEmail,
  sendAdminRequestNotification,
  sendUserRequestUpdateNotification
};
