import { Express } from 'express';

type ValidationType = 'profile-image' | 'document' | 'certificate';

const MAX_SIZE_BYTES: Record<ValidationType, number> = {
  'profile-image': 5 * 1024 * 1024,
  'document': 10 * 1024 * 1024,
  'certificate': 10 * 1024 * 1024,
};

const ALLOWED_MIME_TYPES: Record<ValidationType, string[]> = {
  'profile-image': ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  'document': ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'],
  'certificate': ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'],
};

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

  const maxSize = MAX_SIZE_BYTES[type];
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
    };
  }

  return { isValid: true };
};
