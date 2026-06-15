"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const teacherController_1 = require("../controllers/teacherController");
const teacherAnalyticsController_1 = require("../controllers/teacherAnalyticsController");
const tutorSearchController_1 = require("../controllers/tutorSearchController");
const tutorFilterController_1 = require("../controllers/tutorFilterController");
const auth_1 = require("../middleware/auth");
const teacherValidation_1 = require("../middleware/teacherValidation");
const reviewController_1 = require("../controllers/reviewController");
const router = express_1.default.Router();
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/temp/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/pdf',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and PDF files are allowed.'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5,
    },
});
const uploadFields = upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarDocument', maxCount: 1 },
    { name: 'certificates', maxCount: 5 },
]);
const documentUploadFields = upload.fields([
    { name: 'certificates', maxCount: 5 },
    { name: 'portfolio', maxCount: 5 },
]);
router.get('/', teacherController_1.getAllTeachers);
router.get('/search', tutorSearchController_1.searchTutors);
router.get('/search/suggestions', tutorSearchController_1.getSearchSuggestions);
router.get('/search/popular', tutorSearchController_1.getPopularSearches);
router.get('/filter', tutorFilterController_1.filterTutors);
router.get('/filter/options', tutorFilterController_1.getFilterOptions);
router.get('/subjects', teacherController_1.getSubjects);
router.get('/classes', teacherController_1.getClasses);
router.get('/:id', teacherController_1.getTeacherById);
router.get('/:id/gallery', teacherController_1.getTeacherGallery);
router.get('/:id/stats', teacherController_1.getTeacherStats);
router.get('/:id/reviews', auth_1.optionalAuth, reviewController_1.getTutorReviews);
router.get('/:id/ratings', auth_1.optionalAuth, reviewController_1.getTutorRatings);
router.post('/:id/reviews', auth_1.authenticate, (0, auth_1.authorize)('parent'), reviewController_1.createReview);
router.post('/register', auth_1.authenticate, (0, auth_1.authorize)('teacher'), uploadFields, teacherValidation_1.registerTeacherValidation, teacherController_1.registerTeacher);
router.get('/profile/me', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getTeacherProfile);
router.put('/profile', auth_1.authenticate, (0, auth_1.authorize)('teacher'), upload.single('profilePicture'), teacherValidation_1.updateTeacherValidation, teacherController_1.updateTeacherProfile);
router.post('/vacation-toggle', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.toggleVacationMode);
router.post('/upload-documents', auth_1.authenticate, (0, auth_1.authorize)('teacher'), documentUploadFields, teacherController_1.uploadDocuments);
router.get('/completion', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getProfileCompletion);
router.get('/preferences', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getPreferences);
router.put('/preferences', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.updatePreferences);
router.get('/availability', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getAvailability);
router.put('/availability', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.updateAvailability);
router.get('/discoverability', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getDiscoverability);
router.put('/discoverability', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.updateDiscoverability);
router.get('/matching-eligibility', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getMatchingEligibility);
router.get('/requirements/recommended', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getRecommendedRequirements);
router.get('/requirements', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getAvailableRequirements);
router.get('/requirements/:id/match-analysis', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getRequirementMatchAnalysis);
router.post('/requirements/:id/save', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.saveRequirement);
router.delete('/requirements/:id/save', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.unsaveRequirement);
router.post('/requirements/:id/hide', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.hideRequirement);
router.get('/requirements/:id', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getRequirementById);
router.get('/analytics', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherAnalyticsController_1.getTeacherAnalytics);
router.get('/analytics/funnel', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherAnalyticsController_1.getTeacherFunnelAnalytics);
router.get('/analytics/trends', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherAnalyticsController_1.getTeacherTrendsAnalytics);
router.get('/analytics/performance', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherAnalyticsController_1.getTeacherPerformanceAnalytics);
router.get('/earnings', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherAnalyticsController_1.getTeacherEarningsAnalytics);
exports.default = router;
//# sourceMappingURL=teacher.js.map