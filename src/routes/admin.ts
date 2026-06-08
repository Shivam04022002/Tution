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

// Promo code management
router.get('/promos', listPromoCodes);
router.post('/promos', createPromoCode);
router.patch('/promos/:id', updatePromoCode);
router.delete('/promos/:id', deactivatePromoCode);

export default router;
