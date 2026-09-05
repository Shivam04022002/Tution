import { Response } from 'express';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { AuthRequest } from '../middleware/auth';
import { AwsS3Config } from '../models/AwsS3Config';
import { encrypt, decrypt } from '../utils/encryption';
import { refreshAwsConfigFromDb } from '../config/awsConfig';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/aws-config
// Returns the singleton AWS S3 config. The secret key is never sent back —
// only a `hasSecretKey` flag so the UI can show a masked placeholder.
// ─────────────────────────────────────────────────────────────────────────────
export const getAwsConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = await AwsS3Config.findOne();

    if (!config) {
      return res.status(200).json({
        success: true,
        data: {
          isActive: false,
          region: 'ap-south-1',
          bucket: '',
          accessKeyId: '',
          hasSecretKey: false,
          updatedAt: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        isActive: config.isActive,
        region: config.region,
        bucket: config.bucket,
        accessKeyId: config.accessKeyId,
        hasSecretKey: !!config.secretAccessKeyEncrypted,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('getAwsConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load AWS S3 configuration' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/aws-config
// Upserts the singleton config. `secretAccessKey` is optional — omit/blank to
// keep the currently saved secret unchanged. Applies immediately (no restart
// needed) via refreshAwsConfigFromDb().
// ─────────────────────────────────────────────────────────────────────────────
export const updateAwsConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { isActive, region, bucket, accessKeyId, secretAccessKey, clear } = req.body;

    // Explicit "Clear Keys" + Save — wipe the saved config back to the
    // unconfigured state (falls back to AWS_* env vars, if any) instead of
    // validating as a normal edit.
    if (clear) {
      await AwsS3Config.deleteMany({});
      await refreshAwsConfigFromDb();
      return res.status(200).json({
        success: true,
        message: 'AWS S3 configuration cleared',
        data: {
          isActive: false,
          region: 'ap-south-1',
          bucket: '',
          accessKeyId: '',
          hasSecretKey: false,
          updatedAt: null,
        },
      });
    }

    if (!bucket || !accessKeyId) {
      return res.status(400).json({
        success: false,
        message: 'bucket and accessKeyId are required',
      });
    }

    let config = await AwsS3Config.findOne();
    if (!config) {
      config = new AwsS3Config({ bucket, accessKeyId });
    }

    config.isActive = !!isActive;
    config.region = (region || 'ap-south-1').trim();
    config.bucket = bucket.trim();
    config.accessKeyId = accessKeyId.trim();

    if (secretAccessKey && secretAccessKey.trim()) {
      config.secretAccessKeyEncrypted = encrypt(secretAccessKey.trim());
    }

    if (!config.secretAccessKeyEncrypted) {
      return res.status(400).json({
        success: false,
        message: 'secretAccessKey is required the first time this is configured',
      });
    }

    config.updatedBy = req.user?._id as any;
    await config.save();
    await refreshAwsConfigFromDb();

    return res.status(200).json({
      success: true,
      message: 'AWS S3 configuration saved successfully',
      data: {
        isActive: config.isActive,
        region: config.region,
        bucket: config.bucket,
        accessKeyId: config.accessKeyId,
        hasSecretKey: !!config.secretAccessKeyEncrypted,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('updateAwsConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save AWS S3 configuration' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/aws-config/test
// Verifies the values currently in the admin's edit form (which may not be
// saved yet) by issuing a HeadBucket call. If `secretAccessKey` is omitted,
// falls back to the already-saved encrypted secret.
// ─────────────────────────────────────────────────────────────────────────────
export const testAwsConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { region, bucket, accessKeyId, secretAccessKey } = req.body;

    if (!bucket || !accessKeyId) {
      return res.status(400).json({ success: false, message: 'bucket and accessKeyId are required' });
    }

    let resolvedSecret = secretAccessKey && secretAccessKey.trim() ? secretAccessKey.trim() : '';
    if (!resolvedSecret) {
      const saved = await AwsS3Config.findOne();
      if (!saved?.secretAccessKeyEncrypted) {
        return res.status(400).json({ success: false, message: 'No secret key provided and none saved yet' });
      }
      resolvedSecret = decrypt(saved.secretAccessKeyEncrypted);
    }

    const client = new S3Client({
      region: region || 'ap-south-1',
      credentials: { accessKeyId, secretAccessKey: resolvedSecret },
    });

    await client.send(new HeadBucketCommand({ Bucket: bucket }));

    return res.status(200).json({ success: true, message: `Connected to bucket "${bucket}" successfully` });
  } catch (error: any) {
    console.error('testAwsConfig error:', error);
    return res.status(400).json({
      success: false,
      message: 'Could not connect to that bucket with the given credentials',
      error: error?.message || 'Unknown error',
    });
  }
};
