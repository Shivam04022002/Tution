import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cache mapping generated keys to the Cloudinary secure URLs produced by uploadMulterFile.
// This allows generateCloudFrontUrl(key) to return the real URL without changing the controller code.
const uploadedUrlCache = new Map<string, string>();

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
  const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
  const resourceType = ext === 'pdf' ? 'raw' : 'image';

  const result = await cloudinary.uploader.upload(file.path, {
    public_id: options.key,
    resource_type: resourceType,
  });

  uploadedUrlCache.set(options.key, result.secure_url);
};

export const generateCloudFrontUrl = (key: string): string => {
  return uploadedUrlCache.get(key) || '';
};
