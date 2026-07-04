import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SmtpConfig, IMailService, DEFAULT_MAIL_SERVICES } from '../models/SmtpConfig';
import { encrypt } from '../utils/encryption';
import { sendTestMail } from '../services/emailService';

// Backfills any service keys that don't exist yet on an older saved doc
// (e.g. a new mail-sending feature was added to DEFAULT_MAIL_SERVICES after
// this config was first created), and applies any `enabled` toggles the
// admin submitted for keys that do exist. Labels stay server-defined.
const mergeServices = (
  existing: IMailService[] | undefined,
  updates?: Array<{ key: string; enabled: boolean }>
): IMailService[] => {
  const updateMap = new Map((updates || []).map(u => [u.key, u.enabled]));
  const existingMap = new Map((existing || []).map(s => [s.key, s]));

  return DEFAULT_MAIL_SERVICES.map(def => {
    const current = existingMap.get(def.key);
    const enabled = updateMap.has(def.key) ? !!updateMap.get(def.key) : current?.enabled ?? def.enabled;
    return { key: def.key, label: def.label, enabled };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/smtp-config
// Returns the singleton SMTP config. The password is never sent back —
// only a `hasPassword` flag so the UI can show a masked placeholder.
// ─────────────────────────────────────────────────────────────────────────────
export const getSmtpConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = await SmtpConfig.findOne();

    if (!config) {
      return res.status(200).json({
        success: true,
        data: {
          isActive: false,
          fromEmail: '',
          fromName: '',
          replyToEmail: '',
          host: '',
          port: 587,
          encryption: 'STARTTLS',
          authRequired: true,
          username: '',
          hasPassword: false,
          services: DEFAULT_MAIL_SERVICES,
          updatedAt: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        isActive: config.isActive,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyToEmail: config.replyToEmail || '',
        host: config.host,
        port: config.port,
        encryption: config.encryption,
        authRequired: config.authRequired,
        username: config.username,
        hasPassword: !!config.passwordEncrypted,
        services: mergeServices(config.services),
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('getSmtpConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load SMTP configuration' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/smtp-config
// Upserts the singleton config. `password` is optional — omit/blank to keep
// the currently saved password unchanged.
// ─────────────────────────────────────────────────────────────────────────────
export const updateSmtpConfig = async (req: AuthRequest, res: Response) => {
  try {
    const {
      isActive,
      fromEmail,
      fromName,
      replyToEmail,
      host,
      port,
      encryption,
      authRequired,
      username,
      password,
      services,
      clear,
    } = req.body;

    // Explicit "Clear Keys" + Save — wipe the saved config back to the
    // unconfigured state instead of validating as a normal edit.
    if (clear) {
      await SmtpConfig.deleteMany({});
      return res.status(200).json({
        success: true,
        message: 'SMTP configuration cleared',
        data: {
          isActive: false,
          fromEmail: '',
          fromName: '',
          replyToEmail: '',
          host: '',
          port: 587,
          encryption: 'STARTTLS',
          authRequired: true,
          username: '',
          hasPassword: false,
          services: DEFAULT_MAIL_SERVICES,
          updatedAt: null,
        },
      });
    }

    if (!fromEmail || !fromName || !host || !port) {
      return res.status(400).json({
        success: false,
        message: 'fromEmail, fromName, host, and port are required',
      });
    }

    let config = await SmtpConfig.findOne();
    if (!config) {
      config = new SmtpConfig({ fromEmail, fromName, host, port });
    }

    config.isActive = !!isActive;
    config.fromEmail = fromEmail.trim();
    config.fromName = fromName.trim();
    config.replyToEmail = (replyToEmail || '').trim();
    config.host = host.trim();
    config.port = Number(port);
    config.encryption = encryption || 'STARTTLS';
    config.authRequired = authRequired !== false;
    config.username = (username || '').trim();

    if (password && password.trim()) {
      config.passwordEncrypted = encrypt(password.trim());
    }

    config.services = mergeServices(config.services, services);
    config.updatedBy = req.user?._id as any;
    await config.save();

    return res.status(200).json({
      success: true,
      message: 'SMTP configuration saved successfully',
      data: {
        isActive: config.isActive,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyToEmail: config.replyToEmail,
        host: config.host,
        port: config.port,
        encryption: config.encryption,
        authRequired: config.authRequired,
        username: config.username,
        hasPassword: !!config.passwordEncrypted,
        services: config.services,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('updateSmtpConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save SMTP configuration' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/smtp-config/test
// Sends a test email using the values currently in the admin's edit form
// (which may not be saved yet). If `password` is omitted, falls back to the
// already-saved encrypted password.
// ─────────────────────────────────────────────────────────────────────────────
export const testSmtpConfig = async (req: AuthRequest, res: Response) => {
  try {
    const {
      to,
      host,
      port,
      encryption,
      authRequired,
      username,
      password,
      fromEmail,
      fromName,
      replyToEmail,
    } = req.body;

    if (!to || !host || !port) {
      return res.status(400).json({ success: false, message: 'to, host, and port are required' });
    }

    let passwordEncrypted = '';
    if (password && password.trim()) {
      passwordEncrypted = encrypt(password.trim());
    } else {
      const saved = await SmtpConfig.findOne();
      if (!saved?.passwordEncrypted) {
        return res.status(400).json({ success: false, message: 'No password provided and none saved yet' });
      }
      passwordEncrypted = saved.passwordEncrypted;
    }

    await sendTestMail(
      {
        host,
        port: Number(port),
        encryption: encryption || 'STARTTLS',
        authRequired: authRequired !== false,
        username: username || '',
        passwordEncrypted,
        fromEmail: fromEmail || '',
        fromName: fromName || '',
        replyToEmail: replyToEmail || '',
      },
      to
    );

    return res.status(200).json({ success: true, message: `Test email sent to ${to}` });
  } catch (error) {
    console.error('testSmtpConfig error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
