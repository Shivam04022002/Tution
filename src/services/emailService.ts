import nodemailer from 'nodemailer';
import { SmtpConfig, ISmtpConfig } from '../models/SmtpConfig';
import { decrypt } from '../utils/encryption';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const BRAND = { name: 'HomeTuitionApp', color: '#2D0A7D' };

const emailShell = (title: string, bodyHtml: string): string => `
<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #F8FAFC;">
  <div style="background: ${BRAND.color}; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
    <span style="color: #FFFFFF; font-size: 20px; font-weight: 800;">${BRAND.name}</span>
  </div>
  <div style="background: #FFFFFF; padding: 28px 24px; border-radius: 0 0 16px 16px; border: 1px solid #E2E8F0; border-top: none;">
    <h2 style="color: #0F172A; font-size: 18px; margin: 0 0 12px;">${title}</h2>
    ${bodyHtml}
  </div>
  <p style="text-align: center; color: #94A3B8; font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</p>
</div>`;

export const testEmailTemplate = (): { subject: string; html: string; text: string } => ({
  subject: `Test Email — ${BRAND.name} SMTP Configuration`,
  html: emailShell(
    'SMTP Configuration Test',
    `<p style="color: #475569; font-size: 14px; line-height: 22px;">
      This is a test email confirming that your SMTP server configuration is working correctly.
      If you received this, emails from ${BRAND.name} will be delivered using these settings.
    </p>`
  ),
  text: `This is a test email confirming your ${BRAND.name} SMTP configuration is working correctly.`,
});

export const otpEmailTemplate = (otp: string): { subject: string; html: string; text: string } => ({
  subject: `${otp} is your ${BRAND.name} verification code`,
  html: emailShell(
    'Your Verification Code',
    `<p style="color: #475569; font-size: 14px; line-height: 22px;">Use the code below to verify your account. This code expires in 10 minutes.</p>
     <div style="background: #F1F5F9; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0;">
       <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: ${BRAND.color};">${otp}</span>
     </div>
     <p style="color: #94A3B8; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>`
  ),
  text: `Your ${BRAND.name} verification code is ${otp}. It expires in 10 minutes.`,
});

const buildTransport = (config: ISmtpConfig) => {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.encryption === 'SSL/TLS',
    requireTLS: config.encryption === 'STARTTLS',
    auth: config.authRequired
      ? { user: config.username, pass: decrypt(config.passwordEncrypted) }
      : undefined,
  });
};

// Throws if mail service is off or unconfigured — callers should catch and
// decide whether a failed send should block the calling flow.
export const sendMail = async (options: SendMailOptions): Promise<void> => {
  const config = await SmtpConfig.findOne();
  if (!config || !config.isActive) {
    throw new Error('Mail service is not active. Configure SMTP in Admin Settings first.');
  }

  const transport = buildTransport(config);
  await transport.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    replyTo: config.replyToEmail || undefined,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
};

// Sends using the config passed in directly (used by the "Send Test Email"
// admin action, so unsaved edits can be verified before hitting Save Changes).
export const sendTestMail = async (
  config: Pick<ISmtpConfig, 'host' | 'port' | 'encryption' | 'authRequired' | 'username' | 'passwordEncrypted' | 'fromEmail' | 'fromName' | 'replyToEmail'>,
  to: string
): Promise<void> => {
  const transport = buildTransport(config as ISmtpConfig);
  const template = testEmailTemplate();
  await transport.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    replyTo: config.replyToEmail || undefined,
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

// Checks the master switch AND the per-feature toggle, plus that credentials
// actually exist — used by any feature that wants to know "can I email right
// now?" before attempting to send (e.g. OTP-over-email once that's wired up).
export const isMailServiceEnabled = async (serviceKey: string): Promise<boolean> => {
  const config = await SmtpConfig.findOne();
  if (!config || !config.isActive || !config.host || !config.fromEmail) return false;
  if (config.authRequired && (!config.username || !config.passwordEncrypted)) return false;
  const service = config.services?.find(s => s.key === serviceKey);
  return !!service?.enabled;
};

// Sends a branded OTP code email. Available for any signup/login flow that
// collects an email address — throws if the 'otp_verification' mail service
// is disabled or SMTP isn't configured, so callers should check
// isMailServiceEnabled('otp_verification') first and offer a fallback.
export const sendOtpEmail = async (to: string, otp: string): Promise<void> => {
  const template = otpEmailTemplate(otp);
  await sendMail({ to, subject: template.subject, html: template.html, text: template.text });
};
