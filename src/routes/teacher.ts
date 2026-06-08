import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  registerTeacher,
  getTeacherProfile,
  updateTeacherProfile,
  getAllTeachers,
  getTeacherById,
  toggleVacationMode,
  uploadDocuments,
} from '../controllers/teacherController';
import { authenticate, authorize } from '../middleware/auth';
import {
  registerTeacherValidation,
  updateTeacherValidation,
} from '../middleware/teacherValidation';

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
    files: 5, // Max 5 files per upload
  },
});

// File upload fields configuration
const uploadFields = upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'aadhaarDocument', maxCount: 1 },
  { name: 'certificates', maxCount: 5 },
]);

const documentUploadFields = upload.fields([
  { name: 'certificates', maxCount: 5 },
  { name: 'portfolio', maxCount: 5 },
]);

// Public routes
router.get('/', getAllTeachers);
router.get('/:id', getTeacherById);

// Protected routes - Teacher only
router.post(
  '/register',
  authenticate,
  authorize('teacher'),
  uploadFields,
  registerTeacherValidation,
  registerTeacher
);

router.get('/profile/me', authenticate, authorize('teacher'), getTeacherProfile);

router.put(
  '/profile',
  authenticate,
  authorize('teacher'),
  upload.single('profilePicture'),
  updateTeacherValidation,
  updateTeacherProfile
);

router.post(
  '/vacation-toggle',
  authenticate,
  authorize('teacher'),
  toggleVacationMode
);

router.post(
  '/upload-documents',
  authenticate,
  authorize('teacher'),
  documentUploadFields,
  uploadDocuments
);

export default router;
