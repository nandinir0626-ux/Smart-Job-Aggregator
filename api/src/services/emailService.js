const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const rabbitmq = require('./rabbitmq');

// Curated list of popular disposable / burner email domains to block
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'yopmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'dispostable.com',
  'getairmail.com',
  'fake.com',
  'test.com',
  'asdf.com',
  'example.com',
]);

/**
 * Validates that the email domain actually exists, has valid MX mail exchanger records,
 * and is not a known disposable burner email service.
 */
async function validateEmailDomain(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const domain = email.split('@')[1].toLowerCase().trim();

  // 1. Check disposable email domain list
  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw new Error('Temporary and disposable email domains are not allowed. Please use your official Gmail, Outlook, or workplace email.');
  }

  // 2. Perform live DNS MX record resolution to verify the domain has active mail servers
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      throw new Error(`The domain '${domain}' has no active mail servers (MX records). Please use an active, genuine email address.`);
    }
    return { valid: true, domain, mx: mxRecords[0].exchange };
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'SERVFAIL') {
      throw new Error(`The domain '${domain}' does not exist or cannot receive emails. Please enter your official Google / registered email address.`);
    }
    // If local network DNS temporarily times out, allow known reliable domains (gmail.com, etc.)
    const trustedDomains = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com'];
    if (trustedDomains.includes(domain)) {
      return { valid: true, domain, trusted: true };
    }
    throw new Error(`Could not verify mail server for '${domain}'. Please check for typos and enter a valid email.`);
  }
}

/**
 * Helper to get a Resend client if API key is provided in .env
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.trim().length > 5) {
    return new Resend(apiKey.trim());
  }
  return null;
}

/**
 * Helper to get a nodemailer transporter if SMTP credentials are provided in .env
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return null;
}

let etherealTransporter = null;
async function getEtherealTransporter() {
  if (etherealTransporter) return etherealTransporter;
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[EmailService] Automated web test inbox ready on Ethereal (${testAccount.user})`);
    return etherealTransporter;
  } catch (e) {
    return null;
  }
}

/**
 * Sends a 6-digit verification code to the candidate's real email address.
 */
async function sendVerificationEmail(toEmail, code, userName = 'Candidate') {
  const emailFrom = process.env.EMAIL_FROM || 'SmartJobs <onboarding@resend.dev>';
  const subject = `Your SmartJobs Verification Code: ${code}`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #059669; font-size: 24px; margin: 0;">SmartJobs</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">AI-Powered Job Aggregator & Real-Time Matching</p>
      </div>
      <p style="color: #1e293b; font-size: 15px;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        Thank you for registering. To confirm that this is your genuine email address and start receiving matched job notifications, please enter the 6-digit verification code below:
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; padding: 14px 28px; font-size: 30px; font-weight: 800; letter-spacing: 8px; color: #0f172a; background-color: #f1f5f9; border-radius: 12px; border: 1px solid #cbd5e1;">
          ${code}
        </span>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire in 15 minutes. If you did not request this, please disregard this email.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">&copy; ${new Date().getFullYear()} SmartJobs Engine. All rights reserved.</p>
    </div>
  `;

  // Always output prominently to terminal console for immediate dev verification
  console.log('================================================================');
  console.log(`[VERIFICATION EMAIL DISPATCHED]`);
  console.log(`To: ${toEmail}`);
  console.log(`Code: ${code}`);
  console.log(`Expires: 15 minutes`);
  console.log('================================================================');

  // 1. Try sending via Resend API (Primary modern provider)
  const resend = getResendClient();
  if (resend) {
    try {
      const data = await resend.emails.send({
        from: emailFrom,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      console.log(`[EmailService] Live verification email successfully delivered via Resend to ${toEmail}`);
      return { success: true, method: 'resend', id: data?.data?.id || data?.id, code };
    } catch (err) {
      console.warn(`[EmailService] Resend delivery notice: ${err.message}. Trying SMTP fallback.`);
    }
  }

  // 2. Try sending via configured SMTP (e.g. Gmail App Password)
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"SmartJobs Security" <${emailFrom}>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      console.log(`[EmailService] Live verification email successfully delivered via SMTP to ${toEmail}`);
      return { success: true, method: 'smtp', code };
    } catch (err) {
      console.warn(`[EmailService] SMTP delivery failed: ${err.message}.`);
    }
  }

  // 3. Automated Web Inbox via Ethereal
  const ethereal = await getEtherealTransporter();
  if (ethereal) {
    try {
      const info = await ethereal.sendMail({
        from: `"SmartJobs Security" <onboarding@smartjobs.local>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EmailService] 🌐 View Live Web Email Preview: ${previewUrl}`);
        return { success: true, method: 'ethereal', previewUrl, code };
      }
    } catch (e) {}
  }

  // 4. Celery worker queue
  try {
    await rabbitmq.sendCeleryTask('tasks.email_tasks.send_email', [toEmail, subject, htmlBody]);
  } catch (err) {}

  return { success: true, method: 'console', code };
}

/**
 * Sends a password reset email containing a cryptographically secure token link.
 */
async function sendPasswordResetEmail(toEmail, resetLink, userName = 'Candidate') {
  const emailFrom = process.env.EMAIL_FROM || 'SmartJobs <onboarding@resend.dev>';
  const subject = 'Password Reset Request for SmartJobs';

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #059669; font-size: 24px; margin: 0;">SmartJobs</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">AI-Powered Job Aggregator & Real-Time Matching</p>
      </div>
      <p style="color: #1e293b; font-size: 15px;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        We received a request to reset your password for your SmartJobs account. Click the button below to choose a new password:
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 700; color: #ffffff; background-color: #059669; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center; line-height: 1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="${resetLink}" style="color: #059669; word-break: break-all;">${resetLink}</a>
      </p>
      <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 16px;">This link will expire in 1 hour. If you did not request this, no action is needed and your account remains safe.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">&copy; ${new Date().getFullYear()} SmartJobs Engine. All rights reserved.</p>
    </div>
  `;

  console.log('================================================================');
  console.log(`[PASSWORD RESET EMAIL DISPATCHED]`);
  console.log(`To: ${toEmail}`);
  console.log(`Reset Link: ${resetLink}`);
  console.log(`Expires: 1 hour`);
  console.log('================================================================');

  // 1. Resend API
  const resend = getResendClient();
  if (resend) {
    try {
      const data = await resend.emails.send({
        from: emailFrom,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      console.log(`[EmailService] Live password reset email delivered via Resend to ${toEmail}`);
      return { success: true, method: 'resend', id: data?.data?.id || data?.id };
    } catch (err) {
      console.warn(`[EmailService] Resend delivery notice: ${err.message}. Trying SMTP.`);
    }
  }

  // 2. SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"SmartJobs Security" <${emailFrom}>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      console.log(`[EmailService] Live password reset email delivered via SMTP to ${toEmail}`);
      return { success: true, method: 'smtp' };
    } catch (err) {}
  }

  // 3. Ethereal
  const ethereal = await getEtherealTransporter();
  if (ethereal) {
    try {
      const info = await ethereal.sendMail({
        from: `"SmartJobs Security" <onboarding@smartjobs.local>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EmailService] 🌐 View Live Web Reset Email Preview: ${previewUrl}`);
        return { success: true, method: 'ethereal', previewUrl };
      }
    } catch (e) {}
  }

  return { success: true, method: 'console', resetLink };
}

/**
 * Sends a real-time 6-digit OTP verification email for password reset.
 */
async function sendPasswordResetOtpEmail(toEmail, code, userName = 'Candidate') {
  const emailFrom = process.env.EMAIL_FROM || 'SmartJobs <onboarding@resend.dev>';
  const subject = 'Your SmartJobs Password Reset Code';

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #059669; font-size: 24px; margin: 0;">SmartJobs</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Account Security & Verification</p>
      </div>
      <p style="color: #1e293b; font-size: 15px;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        We received a request to reset your password for your SmartJobs account. Use the 6-digit verification code below to set up a new password:
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #0f172a; background-color: #f1f5f9; border-radius: 12px; border: 2px dashed #059669;">
          ${code}
        </span>
      </div>
      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; margin: 16px 0; text-align: center;">
        <p style="color: #b91c1c; font-size: 13px; font-weight: 600; margin: 0;">
          ⚠️ This verification code is valid for 15 minutes only.
        </p>
        <p style="color: #7f1d1d; font-size: 11px; margin: 4px 0 0 0;">
          Do not share this code with anyone. SmartJobs staff will never ask for your verification code.
        </p>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 16px;">
        If you did not request this password reset, your account is safe. Please ignore this email or review your security settings.
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">&copy; ${new Date().getFullYear()} SmartJobs Engine. All rights reserved.</p>
    </div>
  `;

  console.log('================================================================');
  console.log(`[PASSWORD RESET OTP DISPATCHED]`);
  console.log(`To: ${toEmail}`);
  console.log(`Code: ${code}`);
  console.log(`Expires: 15 minutes`);
  console.log('================================================================');

  // 1. Resend API
  const resend = getResendClient();
  if (resend) {
    try {
      const data = await resend.emails.send({
        from: emailFrom,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      console.log(`[EmailService] Live password reset OTP delivered via Resend to ${toEmail}`);
      return { success: true, method: 'resend', id: data?.data?.id || data?.id, code };
    } catch (err) {
      console.warn(`[EmailService] Resend delivery notice: ${err.message}. Trying SMTP.`);
    }
  }

  // 2. SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"SmartJobs Security" <${emailFrom}>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      console.log(`[EmailService] Live password reset OTP delivered via SMTP to ${toEmail}`);
      return { success: true, method: 'smtp', code };
    } catch (err) {
      console.warn(`[EmailService] SMTP delivery failed: ${err.message}.`);
    }
  }

  // 3. Ethereal fallback
  const ethereal = await getEtherealTransporter();
  if (ethereal) {
    try {
      const info = await ethereal.sendMail({
        from: `"SmartJobs Security" <onboarding@smartjobs.local>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EmailService] 🌐 View Live Web Email Preview: ${previewUrl}`);
        return { success: true, method: 'ethereal', previewUrl, code };
      }
    } catch (e) {}
  }

  return { success: true, method: 'console', code };
}

/**
 * Sends a real-time job alert email to a verified candidate.
 */
async function sendJobMatchAlertEmail(toEmail, job, score, matchedSkills = []) {
  const emailFrom = process.env.EMAIL_FROM || 'SmartJobs <onboarding@resend.dev>';
  const percentage = Math.round(score * 100);
  const subject = `🔥 New ${percentage}% Job Match: ${job.title} at ${job.company}`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <h2 style="color: #059669; font-size: 20px; margin: 0 0 12px 0;">New Job Match Detected</h2>
      <p style="color: #334155; font-size: 14px;">We crawled a new position that aligns strongly with your verified skills and resume profile:</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 18px 0;">
        <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #0f172a;">${job.title}</h3>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;"><strong>${job.company}</strong> &bull; ${job.location || 'Remote'} &bull; <span style="color: #059669; font-weight: bold;">${percentage}% Match</span></p>
        ${matchedSkills.length ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #475569;">Matched skills: <strong>${matchedSkills.join(', ')}</strong></p>` : ''}
      </div>

      ${job.url ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${job.url}" target="_blank" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">View & Apply to Opening</a>
      </div>` : ''}

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">You are receiving this live email alert because you opted in to alerts on your verified profile.</p>
    </div>
  `;

  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: emailFrom,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      return { success: true, method: 'resend' };
    } catch (e) {}
  }

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"SmartJobs Alerts" <${emailFrom}>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      return { success: true };
    } catch (e) {}
  }

  try {
    await rabbitmq.sendCeleryTask('tasks.email_tasks.send_email', [toEmail, subject, htmlBody]);
  } catch (e) {}

  return { success: true };
}

module.exports = {
  validateEmailDomain,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendJobMatchAlertEmail,
};
