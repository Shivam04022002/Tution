"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const adminController_1 = require("../controllers/adminController");
const importController_1 = require("../controllers/importController");
const analyticsController_1 = require("../controllers/analyticsController");
const refundController_1 = require("../controllers/refundController");
const promoController_1 = require("../controllers/promoController");
const auth_1 = require("../middleware/auth");
const excelUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream',
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only .xlsx / .xls files are allowed'));
        }
    },
});
const router = express_1.default.Router();
router.use(auth_1.authenticate, (0, auth_1.authorize)('admin'));
router.get('/stats', adminController_1.getPlatformStats);
router.get('/users', adminController_1.getAllUsers);
router.get('/parents', adminController_1.getAllParents);
router.get('/parents/:id', adminController_1.getParentDetails);
router.put('/parents/:id', adminController_1.updateParent);
router.delete('/parents/:id', adminController_1.deleteParent);
router.get('/teachers', adminController_1.getAllTeachers);
router.get('/teachers/:id', adminController_1.getTeacherDetails);
router.patch('/teachers/:id/approve', adminController_1.approveTeacher);
router.patch('/teachers/:id/reject', adminController_1.rejectTeacher);
router.patch('/teachers/:id/block', adminController_1.blockTeacher);
router.patch('/teachers/:id/unblock', adminController_1.unblockTeacher);
router.post('/import/parents', excelUpload.single('file'), importController_1.importParentsExcel);
router.post('/import/teachers', excelUpload.single('file'), importController_1.importTeachersExcel);
router.get('/import/history', importController_1.getImportHistory);
router.get('/analytics/overview', analyticsController_1.getOverviewAnalytics);
router.get('/analytics/demand', analyticsController_1.getDemandAnalytics);
router.get('/analytics/supply', analyticsController_1.getTeacherSupplyAnalytics);
router.get('/analytics/revenue', analyticsController_1.getRevenueAnalytics);
router.get('/analytics/financial', analyticsController_1.getFinancialAnalytics);
router.get('/refunds', refundController_1.listRefunds);
router.patch('/refunds/:id/approve', refundController_1.approveRefund);
router.patch('/refunds/:id/reject', refundController_1.rejectRefund);
router.get('/promos', promoController_1.listPromoCodes);
router.post('/promos', promoController_1.createPromoCode);
router.patch('/promos/:id', promoController_1.updatePromoCode);
router.delete('/promos/:id', promoController_1.deactivatePromoCode);
exports.default = router;
//# sourceMappingURL=admin.js.map