import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  updateDocument,
  submitForVerification,
  getVerificationStatus,
} from '../controllers/teacherDocumentController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and PDF files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1, // Single file per upload
  },
});

// Document routes
router.get(
  '/',
  authenticate,
  authorize('teacher'),
  getDocuments
);

router.post(
  '/',
  authenticate,
  authorize('teacher'),
  upload.single('file'),
  uploadDocument
);

router.put(
  '/:id',
  authenticate,
  authorize('teacher'),
  upload.single('file'),
  updateDocument
);

router.delete(
  '/:id',
  authenticate,
  authorize('teacher'),
  deleteDocument
);

// Verification routes
router.post(
  '/verification/submit',
  authenticate,
  authorize('teacher'),
  submitForVerification
);

router.get(
  '/verification/status',
  authenticate,
  authorize('teacher'),
  getVerificationStatus
);

export default router;
