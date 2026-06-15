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
const adminRevenueController_1 = require("../controllers/adminRevenueController");
const kycController_1 = require("../controllers/kycController");
const adminSubscriptionController_1 = require("../controllers/adminSubscriptionController");
const adminCreditsController_1 = require("../controllers/adminCreditsController");
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
router.get('/analytics/geography', analyticsController_1.getGeographyAnalytics);
router.get('/analytics/cities', analyticsController_1.getCityAnalytics);
router.get('/analytics/subjects', analyticsController_1.getSubjectAnalytics);
router.get('/analytics/supply-demand', analyticsController_1.getSupplyDemandAnalytics);
router.get('/refunds', refundController_1.listRefunds);
router.patch('/refunds/:id/approve', refundController_1.approveRefund);
router.patch('/refunds/:id/reject', refundController_1.rejectRefund);
router.get('/revenue/overview', adminRevenueController_1.getRevenueOverview);
router.get('/revenue/subscriptions', adminRevenueController_1.getSubscriptionMetrics);
router.get('/revenue/credits', adminRevenueController_1.getCreditMetrics);
router.get('/revenue/payments', adminRevenueController_1.getPaymentMetrics);
router.get('/revenue/invoices', adminRevenueController_1.getInvoiceMetrics);
router.get('/revenue/charts', adminRevenueController_1.getRevenueCharts);
router.get('/promos', promoController_1.listPromoCodes);
router.post('/promos', promoController_1.createPromoCode);
router.patch('/promos/:id', promoController_1.updatePromoCode);
router.delete('/promos/:id', promoController_1.deactivatePromoCode);
router.get('/kyc', kycController_1.getKycQueue);
router.get('/kyc/:id', kycController_1.getKycDetailAdmin);
router.post('/kyc/:id/approve', kycController_1.approveKyc);
router.post('/kyc/:id/reject', kycController_1.rejectKyc);
router.post('/kyc/:id/request-reupload', kycController_1.requestReupload);
router.get('/subscriptions', adminSubscriptionController_1.getAllSubscriptions);
router.get('/subscriptions/summary', adminSubscriptionController_1.getSubscriptionSummary);
router.get('/subscriptions/audit-logs', adminSubscriptionController_1.getAuditLogsHandler);
router.get('/subscriptions/:teacherId', adminSubscriptionController_1.getTeacherSubscription);
router.post('/subscriptions/upgrade', adminSubscriptionController_1.upgradeSubscription);
router.post('/subscriptions/downgrade', adminSubscriptionController_1.downgradeSubscription);
router.post('/subscriptions/extend', adminSubscriptionController_1.extendSubscription);
router.post('/subscriptions/suspend', adminSubscriptionController_1.suspendSubscription);
router.post('/subscriptions/reactivate', adminSubscriptionController_1.reactivateSubscription);
router.post('/subscriptions/cancel', adminSubscriptionController_1.cancelSubscription);
router.get('/credits', adminCreditsController_1.getAllCredits);
router.get('/credits/summary', adminCreditsController_1.getCreditsSummary);
router.get('/credits/audit-logs', adminCreditsController_1.getCreditAuditLogsHandler);
router.get('/credits/transactions', adminCreditsController_1.getAllTransactions);
router.get('/credits/:teacherId', adminCreditsController_1.getTeacherCredits);
router.post('/credits/grant', adminCreditsController_1.grantCredits);
router.post('/credits/deduct', adminCreditsController_1.deductCredits);
router.post('/credits/bonus', adminCreditsController_1.grantBonusCredits);
router.post('/credits/correct', adminCreditsController_1.correctCredits);
exports.default = router;
//# sourceMappingURL=admin.js.map