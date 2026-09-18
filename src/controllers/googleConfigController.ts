import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GoogleOAuthConfig } from '../models/GoogleOAuthConfig';
import { encrypt } from '../utils/encryption';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/google-config
// The client secret is never sent back — only a `hasWebClientSecret` flag so
// the UI can show a masked placeholder.
// ─────────────────────────────────────────────────────────────────────────────
export const getGoogleConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = await GoogleOAuthConfig.findOne();

    return res.status(200).json({
      success: true,
      data: {
        isActive: config?.isActive || false,
        webClientId: config?.webClientId || '',
        hasWebClientSecret: !!config?.webClientSecretEncrypted,
        androidClientId: config?.androidClientId || '',
        iosClientId: config?.iosClientId || '',
        updatedAt: config?.updatedAt || null,
      },
    });
  } catch (error) {
    console.error('getGoogleConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load Google OAuth configuration' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/google-config
// `webClientSecret` is optional — omit/blank to keep the currently saved
// secret. `clear: true` wipes the saved config back to unconfigured.
// ─────────────────────────────────────────────────────────────────────────────
export const updateGoogleConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { isActive, webClientId, webClientSecret, androidClientId, iosClientId, clear } = req.body;

    if (clear) {
      await GoogleOAuthConfig.deleteMany({});
      return res.status(200).json({
        success: true,
        message: 'Google OAuth configuration cleared',
        data: {
          isActive: false,
          webClientId: '',
          hasWebClientSecret: false,
          androidClientId: '',
          iosClientId: '',
          updatedAt: null,
        },
      });
    }

    let config = await GoogleOAuthConfig.findOne();
    if (!config) {
      config = new GoogleOAuthConfig();
    }

    if (webClientId !== undefined) config.webClientId = webClientId.trim();
    if (androidClientId !== undefined) config.androidClientId = androidClientId.trim();
    if (iosClientId !== undefined) config.iosClientId = iosClientId.trim();
    if (webClientSecret && webClientSecret.trim()) {
      config.webClientSecretEncrypted = encrypt(webClientSecret.trim());
    }

    config.isActive = !!isActive;

    if (config.isActive && (!config.webClientId || !config.webClientSecretEncrypted)) {
      return res.status(400).json({
        success: false,
        message: 'A Web Client ID and Client Secret are required to activate Google sign-in',
      });
    }

    config.updatedBy = req.user?._id as any;
    await config.save();

    return res.status(200).json({
      success: true,
      message: 'Google OAuth configuration saved successfully',
      data: {
        isActive: config.isActive,
        webClientId: config.webClientId,
        hasWebClientSecret: !!config.webClientSecretEncrypted,
        androidClientId: config.androidClientId,
        iosClientId: config.iosClientId,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('updateGoogleConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save Google OAuth configuration' });
  }
};
