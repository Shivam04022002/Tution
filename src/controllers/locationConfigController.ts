import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { LocationConfig } from '../models/LocationConfig';
import { encrypt, decrypt } from '../utils/encryption';
import { testApiKey } from '../services/geocodingService';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/location-config
// The API key is never sent back — only a `hasApiKey` flag so the UI can
// show a masked placeholder.
// ─────────────────────────────────────────────────────────────────────────────
export const getLocationConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = await LocationConfig.findOne();

    return res.status(200).json({
      success: true,
      data: {
        isActive: config?.isActive || false,
        hasApiKey: !!config?.apiKeyEncrypted,
        updatedAt: config?.updatedAt || null,
      },
    });
  } catch (error) {
    console.error('getLocationConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load location configuration' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/location-config
// `apiKey` is optional — omit/blank to keep the currently saved key.
// `clear: true` wipes the saved config back to unconfigured.
// ─────────────────────────────────────────────────────────────────────────────
export const updateLocationConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { isActive, apiKey, clear } = req.body;

    if (clear) {
      await LocationConfig.deleteMany({});
      return res.status(200).json({
        success: true,
        message: 'Location configuration cleared',
        data: { isActive: false, hasApiKey: false, updatedAt: null },
      });
    }

    let config = await LocationConfig.findOne();
    if (!config) {
      config = new LocationConfig();
    }

    config.isActive = !!isActive;
    if (apiKey && apiKey.trim()) {
      config.apiKeyEncrypted = encrypt(apiKey.trim());
    }

    if (config.isActive && !config.apiKeyEncrypted) {
      return res.status(400).json({
        success: false,
        message: 'An API key is required to activate location services',
      });
    }

    config.updatedBy = req.user?._id as any;
    await config.save();

    return res.status(200).json({
      success: true,
      message: 'Location configuration saved successfully',
      data: {
        isActive: config.isActive,
        hasApiKey: !!config.apiKeyEncrypted,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('updateLocationConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save location configuration' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/location-config/test
// Verifies the saved (or currently-being-edited) key actually works by
// geocoding a known address.
// ─────────────────────────────────────────────────────────────────────────────
export const testLocationConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { apiKey } = req.body;

    let keyToTest = apiKey && apiKey.trim() ? apiKey.trim() : '';
    if (!keyToTest) {
      const saved = await LocationConfig.findOne();
      if (!saved?.apiKeyEncrypted) {
        return res.status(400).json({ success: false, message: 'No API key provided and none saved yet' });
      }
      keyToTest = decrypt(saved.apiKeyEncrypted);
    }

    const result = await testApiKey(keyToTest);

    if (!result) {
      return res.status(400).json({ success: false, message: 'Test geocode failed — check the API key and enabled APIs' });
    }

    return res.status(200).json({ success: true, message: `Test succeeded — resolved to ${result.formattedAddress}` });
  } catch (error) {
    console.error('testLocationConfig error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to test location configuration',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
