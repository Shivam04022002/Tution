import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getBackupStatus,
  cleanupOldData,
  getRetentionPolicy
} from '../controllers/backupController';

const router = express.Router();

// All backup routes require authentication
router.use(authenticate);

// Get backup status (admin only)
router.get('/status', authorize('admin'), getBackupStatus);

// Get retention policy (admin/staff)
router.get('/retention-policy', authorize('admin', 'staff'), getRetentionPolicy);

// Cleanup old data (admin only)
router.post('/cleanup', authorize('admin'), cleanupOldData);

export default router;
