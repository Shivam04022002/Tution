import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getCompleteAudit,
  getIndexAudit,
  getPerformanceMetrics,
  getSecurityAudit,
  getApiAudit
} from '../controllers/auditController';

const router = express.Router();

// All audit routes require authentication and admin/staff role
router.use(authenticate, authorize('admin', 'staff'));

// Complete system audit
router.get('/complete', getCompleteAudit);

// Individual audit endpoints
router.get('/indexes', getIndexAudit);
router.get('/performance', getPerformanceMetrics);
router.get('/security', getSecurityAudit);
router.get('/api', getApiAudit);

export default router;
