import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  uploadKycDocument,
  submitKyc,
  getKycStatus,
  getKycDetails,
  updateKycDocument,
  deleteKycDocument,
} from '../controllers/kycController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Configure multer for KYC file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'kyc-' + uniqueSuffix + path.extname(file.originalname));
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
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

// All routes require teacher auth
router.use(authenticate, authorize('teacher'));

router.post('/upload', upload.single('file'), uploadKycDocument);
router.post('/submit', submitKyc);
router.get('/status', getKycStatus);
router.get('/details', getKycDetails);
router.put('/document/:documentId', upload.single('file'), updateKycDocument);
router.delete('/document/:documentId', deleteKycDocument);

export default router;
