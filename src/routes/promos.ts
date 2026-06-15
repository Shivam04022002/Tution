import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validatePromoCode, applyPromoCode } from '../controllers/promoController';

const router = express.Router();

// POST /api/promos/validate  — authenticated user validates a code before paying
router.post('/validate', authenticate, authorize('teacher', 'parent'), validatePromoCode);

// POST /api/promos/apply  — apply promo code during checkout (tracks analytics)
router.post('/apply', authenticate, authorize('teacher', 'parent'), applyPromoCode);

export default router;
