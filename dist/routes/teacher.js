"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const teacherController_1 = require("../controllers/teacherController");
const auth_1 = require("../middleware/auth");
const teacherValidation_1 = require("../middleware/teacherValidation");
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
router.get('/:id', teacherController_1.getTeacherById);
router.post('/register', auth_1.authenticate, (0, auth_1.authorize)('teacher'), uploadFields, teacherValidation_1.registerTeacherValidation, teacherController_1.registerTeacher);
router.get('/profile/me', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.getTeacherProfile);
router.put('/profile', auth_1.authenticate, (0, auth_1.authorize)('teacher'), upload.single('profilePicture'), teacherValidation_1.updateTeacherValidation, teacherController_1.updateTeacherProfile);
router.post('/vacation-toggle', auth_1.authenticate, (0, auth_1.authorize)('teacher'), teacherController_1.toggleVacationMode);
router.post('/upload-documents', auth_1.authenticate, (0, auth_1.authorize)('teacher'), documentUploadFields, teacherController_1.uploadDocuments);
exports.default = router;
//# sourceMappingURL=teacher.js.map