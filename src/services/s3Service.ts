import fs from 'fs';
import { Upload } from '@aws-sdk/lib-storage';
import { awsConfig, getS3Client } from '../config/awsConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher-facing uploads (profile photo, aadhaar/PAN, certificates, portfolio
// docs) — despite the filename, this used to go through Cloudinary with
// credentials that were never actually configured (CLOUDINARY_API_KEY was
// still the literal placeholder value), so every one of these uploads failed.
// Now routed through the same admin-managed AWS S3 config as course videos
// (see ../config/awsConfig.ts), which is already set up and working.
//
// Unlike course videos, these objects are served as plain, permanent URLs
// (matching how Cloudinary's secure_url behaved before) rather than
// short-lived signed links — the bucket needs a policy allowing public
// GetObject on these prefixes for the URLs below to actually load. Course
// video objects are untouched and stay private/signed-URL-only.
// ─────────────────────────────────────────────────────────────────────────────

export const generateS3Key = (folder: string, uid: string, filename: string): string => {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.[^/.]+$/, '');
  return `${folder}/${uid}_${Date.now()}_${sanitized}`;
};

export const uploadMulterFile = async (
  file: Express.Multer.File,
  options: { key: string; contentType: string }
): Promise<void> => {
  const client = getS3Client();
  const body = fs.createReadStream(file.path);

  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: awsConfig.s3Bucket,
        Key: options.key,
        Body: body,
        ContentType: options.contentType,
      },
    });

    await upload.done();
  } finally {
    body.destroy();
  }
};

export const generateCloudFrontUrl = (key: string): string => {
  return `https://${awsConfig.s3Bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`;
};
