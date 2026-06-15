import express from 'express';
import {
  createContactRequest,
  createDemoRequest,
  getParentContactHistory,
  getTeacherContactRequests,
  getContactRequestById,
  updateContactRequestStatus,
  rescheduleDemoRequest,
  getContactStats,
  getTeacherCalendar,
  blockTime,
  unblockTime,
  checkAvailabilityConflicts,
} from '../controllers/contactController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Create contact request (call, whatsapp, message)
router.post(
  '/request',
  authenticate,
  authorize('parent', 'admin'),
  createContactRequest
);

// Create demo request
router.post(
  '/demo',
  authenticate,
  authorize('parent', 'admin'),
  createDemoRequest
);

// Get parent's contact history
router.get(
  '/history',
  authenticate,
  authorize('parent', 'admin'),
  getParentContactHistory
);

// Get teacher's contact requests
router.get(
  '/teacher-requests',
  authenticate,
  authorize('teacher', 'admin'),
  getTeacherContactRequests
);

// Get single contact request
router.get(
  '/:id',
  authenticate,
  getContactRequestById
);

// Update contact request status (accept/reject/complete)
router.patch(
  '/:id/status',
  authenticate,
  updateContactRequestStatus
);

// Reschedule demo request
router.patch(
  '/demo/:id',
  authenticate,
  rescheduleDemoRequest
);

// Get contact stats (admin only)
router.get(
  '/stats',
  authenticate,
  authorize('admin', 'staff'),
  getContactStats
);

// ─────────────────────────────────────────────
// Calendar Routes
// ─────────────────────────────────────────────

// Get teacher's calendar data (demos + blocked time)
router.get(
  '/calendar',
  authenticate,
  authorize('teacher', 'admin', 'staff'),
  getTeacherCalendar
);

// Block a date/time slot
router.post(
  '/calendar/block',
  authenticate,
  authorize('teacher', 'admin'),
  blockTime
);

// Remove a blocked time entry
router.delete(
  '/calendar/block/:id',
  authenticate,
  authorize('teacher', 'admin'),
  unblockTime
);

// Check for availability conflicts
router.get(
  '/calendar/conflicts',
  authenticate,
  authorize('teacher', 'admin'),
  checkAvailabilityConflicts
);

export default router;
