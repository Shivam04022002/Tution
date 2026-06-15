"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const applicationController_1 = require("../controllers/applicationController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/apply/:requirementId', auth_1.authenticate, (0, auth_1.authorize)('teacher'), applicationController_1.applyToRequirement);
router.get('/parent', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.getParentApplications);
router.get('/teacher', auth_1.authenticate, (0, auth_1.authorize)('teacher'), applicationController_1.getTeacherApplications);
router.get('/:applicationId', auth_1.authenticate, (0, auth_1.authorize)('parent', 'teacher', 'admin'), applicationController_1.getApplicationById);
router.post('/:applicationId/shortlist', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.shortlistApplication);
router.post('/:applicationId/reject', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.rejectApplication);
router.post('/:applicationId/view', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.viewApplication);
router.post('/:applicationId/select', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.selectTeacher);
router.post('/:applicationId/hire', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.hireTeacher);
router.post('/:applicationId/withdraw', auth_1.authenticate, (0, auth_1.authorize)('teacher'), applicationController_1.withdrawApplication);
router.post('/:applicationId/demo', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.scheduleDemo);
router.get('/stats/parent', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.getParentDashboardStats);
router.get('/stats/teacher', auth_1.authenticate, (0, auth_1.authorize)('teacher'), applicationController_1.getTeacherDashboardStats);
exports.default = router;
//# sourceMappingURL=applications.js.map