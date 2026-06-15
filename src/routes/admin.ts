import express from 'express';
import multer from 'multer';
import {
  getPlatformStats,
  getAllUsers,
  getAllParents,
  getParentDetails,
  updateParent,
  deleteParent,
  getAllTeachers,
  getTeacherDetails,
  approveTeacher,
  rejectTeacher,
  blockTeacher,
  unblockTeacher,
} from '../controllers/adminController';
import {
  importParentsExcel,
  importTeachersExcel,
  getImportHistory,
} from '../controllers/importController';
import {
  getOverviewAnalytics,
  getDemandAnalytics,
  getTeacherSupplyAnalytics,
  getRevenueAnalytics,
  getFinancialAnalytics,
  getGeographyAnalytics,
  getCityAnalytics,
  getSubjectAnalytics,
  getSupplyDemandAnalytics,
} from '../controllers/analyticsController';
import { approveRefund, rejectRefund, listRefunds } from '../controllers/refundController';
import {
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deactivatePromoCode,
} from '../controllers/promoController';
import {
  getRevenueOverview,
  getSubscriptionMetrics,
  getCreditMetrics,
  getPaymentMetrics,
  getInvoiceMetrics,
  getRevenueCharts,
} from '../controllers/adminRevenueController';
import {
  getKycQueue,
  getKycDetailAdmin,
  approveKyc,
  rejectKyc,
  requestReupload,
} from '../controllers/kycController';
import {
  getAllSubscriptions,
  getTeacherSubscription,
  upgradeSubscription,
  downgradeSubscription,
  extendSubscription,
  suspendSubscription,
  reactivateSubscription,
  cancelSubscription,
  getAuditLogsHandler as getSubscriptionAuditLogs,
  getSubscriptionSummary,
} from '../controllers/adminSubscriptionController';
import {
  getAllCredits,
  getTeacherCredits,
  grantCredits,
  deductCredits,
  grantBonusCredits,
  correctCredits,
  getCreditAuditLogsHandler,
  getCreditsSummary,
  getAllTransactions,
} from '../controllers/adminCreditsController';
import { authenticate, authorize } from '../middleware/auth';

// Memory storage — no temp files on disk; xlsx reads from buffer
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx / .xls files are allowed'));
    }
  },
});

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/stats', getPlatformStats);

router.get('/users', getAllUsers);

router.get('/parents', getAllParents);
router.get('/parents/:id', getParentDetails);
router.put('/parents/:id', updateParent);
router.delete('/parents/:id', deleteParent);

router.get('/teachers', getAllTeachers);
router.get('/teachers/:id', getTeacherDetails);
router.patch('/teachers/:id/approve', approveTeacher);
router.patch('/teachers/:id/reject', rejectTeacher);
router.patch('/teachers/:id/block', blockTeacher);
router.patch('/teachers/:id/unblock', unblockTeacher);

router.post('/import/parents', excelUpload.single('file'), importParentsExcel);
router.post('/import/teachers', excelUpload.single('file'), importTeachersExcel);
router.get('/import/history', getImportHistory);

router.get('/analytics/overview', getOverviewAnalytics);
router.get('/analytics/demand', getDemandAnalytics);
router.get('/analytics/supply', getTeacherSupplyAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/financial', getFinancialAnalytics);
router.get('/analytics/geography', getGeographyAnalytics);
router.get('/analytics/cities', getCityAnalytics);
router.get('/analytics/subjects', getSubjectAnalytics);
router.get('/analytics/supply-demand', getSupplyDemandAnalytics);

// Refund management
router.get('/refunds', listRefunds);
router.patch('/refunds/:id/approve', approveRefund);
router.patch('/refunds/:id/reject', rejectRefund);

// Revenue dashboard
router.get('/revenue/overview',       getRevenueOverview);
router.get('/revenue/subscriptions',  getSubscriptionMetrics);
router.get('/revenue/credits',        getCreditMetrics);
router.get('/revenue/payments',       getPaymentMetrics);
router.get('/revenue/invoices',       getInvoiceMetrics);
router.get('/revenue/charts',         getRevenueCharts);

// Promo code management
router.get('/promos', listPromoCodes);
router.post('/promos', createPromoCode);
router.patch('/promos/:id', updatePromoCode);
router.delete('/promos/:id', deactivatePromoCode);

// KYC verification management
router.get('/kyc', getKycQueue);
router.get('/kyc/:id', getKycDetailAdmin);
router.post('/kyc/:id/approve', approveKyc);
router.post('/kyc/:id/reject', rejectKyc);
router.post('/kyc/:id/request-reupload', requestReupload);

// Subscription management
router.get('/subscriptions', getAllSubscriptions);
router.get('/subscriptions/summary', getSubscriptionSummary);
router.get('/subscriptions/audit-logs', getSubscriptionAuditLogs);
router.get('/subscriptions/:teacherId', getTeacherSubscription);
router.post('/subscriptions/upgrade', upgradeSubscription);
router.post('/subscriptions/downgrade', downgradeSubscription);
router.post('/subscriptions/extend', extendSubscription);
router.post('/subscriptions/suspend', suspendSubscription);
router.post('/subscriptions/reactivate', reactivateSubscription);
router.post('/subscriptions/cancel', cancelSubscription);

// Credit management
router.get('/credits', getAllCredits);
router.get('/credits/summary', getCreditsSummary);
router.get('/credits/audit-logs', getCreditAuditLogsHandler);
router.get('/credits/transactions', getAllTransactions);
router.get('/credits/:teacherId', getTeacherCredits);
router.post('/credits/grant', grantCredits);
router.post('/credits/deduct', deductCredits);
router.post('/credits/bonus', grantBonusCredits);
router.post('/credits/correct', correctCredits);

export default router;
