import express, { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  unlockTeacherLead,
  unlockTutorContact,
  getUnlockHistory,
  createPaymentIntent,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} from '../controllers/unlockController';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Webhook — MUST use express.raw() to preserve rawBody for HMAC check.
// This route is unauthenticated (Razorpay calls it server-to-server).
// Mount BEFORE express.json() parsing applies to this route.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, _res: Response, next: NextFunction) => {
    // Stash the raw buffer as string so the controller can verify HMAC
    (req as any).rawBody = req.body.toString('utf8');
    // Re-parse body as JSON for the controller to consume
    try {
      req.body = JSON.parse((req as any).rawBody);
    } catch {
      req.body = {};
    }
    next();
  },
  handleRazorpayWebhook as any,
);

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay checkout flow
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/unlock/order  — Step 1: Create Razorpay order, return orderId + keyId to client
router.post(
  '/order',
  authenticate,
  authorize('teacher', 'parent'),
  createRazorpayOrder,
);

// POST /api/unlock/verify  — Step 2: Client sends signature after checkout; verify + unlock
router.post(
  '/verify',
  authenticate,
  authorize('teacher', 'parent'),
  verifyRazorpayPayment,
);

// ─────────────────────────────────────────────────────────────────────────────
// Legacy simulation routes (kept for test mode / fallback)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/unlock/teacher/:leadId  — Teacher pays to view parent contact (simulation)
router.post(
  '/teacher/:leadId',
  authenticate,
  authorize('teacher'),
  unlockTeacherLead,
);

// POST /api/unlock/parent/:teacherId  — Parent pays to view teacher contact (simulation)
router.post(
  '/parent/:teacherId',
  authenticate,
  authorize('parent'),
  unlockTutorContact,
);

// GET /api/unlock/history  — Unlock history (teacher, parent, admin)
router.get(
  '/history',
  authenticate,
  authorize('teacher', 'parent', 'admin'),
  getUnlockHistory,
);

// POST /api/unlock/payment-intent  — Simulated payment intent
router.post(
  '/payment-intent',
  authenticate,
  authorize('teacher', 'parent'),
  createPaymentIntent,
);

export default router;
