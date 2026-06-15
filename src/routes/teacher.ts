import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  registerTeacher,
  getTeacherProfile,
  updateTeacherProfile,
  getAllTeachers,
  getTeacherById,
  getTeacherGallery,
  getTeacherStats,
  toggleVacationMode,
  uploadDocuments,
  getProfileCompletion,
  getPreferences,
  updatePreferences,
  getSubjects,
  getClasses,
  getAvailability,
  updateAvailability,
  getDiscoverability,
  updateDiscoverability,
  getMatchingEligibility,
  getAvailableRequirements,
  getRequirementById,
  getRecommendedRequirements,
  getRequirementMatchAnalysis,
  saveRequirement,
  unsaveRequirement,
  hideRequirement,
} from '../controllers/teacherController';
import {
  getTeacherAnalytics,
  getTeacherFunnelAnalytics,
  getTeacherTrendsAnalytics,
  getTeacherPerformanceAnalytics,
  getTeacherEarningsAnalytics,
} from '../controllers/teacherAnalyticsController';
import {
  searchTutors,
  getSearchSuggestions,
  getPopularSearches,
} from '../controllers/tutorSearchController';
import {
  filterTutors,
  getFilterOptions,
} from '../controllers/tutorFilterController';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import {
  registerTeacherValidation,
  updateTeacherValidation,
} from '../middleware/teacherValidation';
import {
  getTutorReviews,
  getTutorRatings,
  createReview,
} from '../controllers/reviewController';

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

// Public routes — static paths BEFORE dynamic /:id
router.get('/', getAllTeachers);
router.get('/search', searchTutors);
router.get('/search/suggestions', getSearchSuggestions);
router.get('/search/popular', getPopularSearches);
router.get('/filter', filterTutors);
router.get('/filter/options', getFilterOptions);
router.get('/subjects', getSubjects);
router.get('/classes', getClasses);

// Dynamic tutor routes
router.get('/:id', getTeacherById);
router.get('/:id/gallery', getTeacherGallery);
router.get('/:id/stats', getTeacherStats);
router.get('/:id/reviews', optionalAuth, getTutorReviews);
router.get('/:id/ratings', optionalAuth, getTutorRatings);
router.post('/:id/reviews', authenticate, authorize('parent'), createReview);

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

router.get('/completion', authenticate, authorize('teacher'), getProfileCompletion);
router.get('/preferences', authenticate, authorize('teacher'), getPreferences);
router.put('/preferences', authenticate, authorize('teacher'), updatePreferences);

// Availability and Discoverability routes
router.get('/availability', authenticate, authorize('teacher'), getAvailability);
router.put('/availability', authenticate, authorize('teacher'), updateAvailability);
router.get('/discoverability', authenticate, authorize('teacher'), getDiscoverability);
router.put('/discoverability', authenticate, authorize('teacher'), updateDiscoverability);
router.get('/matching-eligibility', authenticate, authorize('teacher'), getMatchingEligibility);

// Requirements Marketplace routes
router.get('/requirements/recommended', authenticate, authorize('teacher'), getRecommendedRequirements);
router.get('/requirements', authenticate, authorize('teacher'), getAvailableRequirements);
router.get('/requirements/:id/match-analysis', authenticate, authorize('teacher'), getRequirementMatchAnalysis);
router.post('/requirements/:id/save', authenticate, authorize('teacher'), saveRequirement);
router.delete('/requirements/:id/save', authenticate, authorize('teacher'), unsaveRequirement);
router.post('/requirements/:id/hide', authenticate, authorize('teacher'), hideRequirement);
router.get('/requirements/:id', authenticate, authorize('teacher'), getRequirementById);

// Analytics routes
router.get('/analytics', authenticate, authorize('teacher'), getTeacherAnalytics);
router.get('/analytics/funnel', authenticate, authorize('teacher'), getTeacherFunnelAnalytics);
router.get('/analytics/trends', authenticate, authorize('teacher'), getTeacherTrendsAnalytics);
router.get('/analytics/performance', authenticate, authorize('teacher'), getTeacherPerformanceAnalytics);
router.get('/earnings', authenticate, authorize('teacher'), getTeacherEarningsAnalytics);

export default router;
