import { Express } from 'express';

type ValidationType = 'profile-image' | 'document' | 'certificate' | 'course-video';

// Resolved lazily so that env-driven limits are read after dotenv has loaded.
const getMaxSizeBytes = (type: ValidationType): number => {
  switch (type) {
    case 'profile-image':
      return 5 * 1024 * 1024;
    case 'document':
    case 'certificate':
      return 10 * 1024 * 1024;
    case 'course-video':
      return getMaxCourseVideoBytes();
  }
};

const ALLOWED_MIME_TYPES: Record<ValidationType, string[]> = {
  'profile-image': ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  'document': ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'],
  'certificate': ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'],
  // Kept deliberately narrow: formats that play natively on both Android
  // (ExoPlayer) and iOS (AVPlayer). MP4 / H.264 / AAC is the recommended encode.
  'course-video': ['video/mp4', 'video/quicktime', 'video/x-m4v'],
};

/** Max lesson video size in bytes. Configurable via MAX_COURSE_VIDEO_MB (default 500MB). */
export function getMaxCourseVideoBytes(): number {
  const parsed = Number(process.env.MAX_COURSE_VIDEO_MB);
  const megabytes = Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
  return megabytes * 1024 * 1024;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateFile = (
  file: Express.Multer.File,
  type: ValidationType
): FileValidationResult => {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  const allowedTypes = ALLOWED_MIME_TYPES[type];
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  const maxSize = getMaxSizeBytes(type);
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
    };
  }

  return { isValid: true };
};
