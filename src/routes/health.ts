import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getHealth,
  getDatabaseHealth,
  getServicesHealth,
  getSystemMetrics,
  getVersion,
  getMonitoringDashboard
} from '../controllers/healthController';

const router = express.Router();

// Public health checks (no auth required)
router.get('/', getHealth);
router.get('/db', getDatabaseHealth);
router.get('/services', getServicesHealth);
router.get('/version', getVersion);

// Protected monitoring endpoints (admin/staff only)
router.get('/metrics', authenticate, authorize('admin', 'staff'), getSystemMetrics);
router.get('/dashboard', authenticate, authorize('admin', 'staff'), getMonitoringDashboard);

export default router;
