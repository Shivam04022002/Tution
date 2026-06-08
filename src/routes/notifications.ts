import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  bulkDeleteOld,
} from '../controllers/notificationController';

const router = express.Router();

// GET  /api/notifications/unread-count  — lightweight badge poll
router.get('/unread-count', authenticate, getUnreadCount);

// GET  /api/notifications                — paginated list
router.get('/', authenticate, listNotifications);

// PATCH /api/notifications/read-all      — mark all as read (must be before /:id)
router.patch('/read-all', authenticate, markAllAsRead);

// PATCH /api/notifications/:id/read      — mark one as read
router.patch('/:id/read', authenticate, markAsRead);

// DELETE /api/notifications              — admin bulk cleanup
router.delete('/', authenticate, authorize('admin'), bulkDeleteOld);

// DELETE /api/notifications/:id          — delete one
router.delete('/:id', authenticate, deleteNotification);

export default router;
