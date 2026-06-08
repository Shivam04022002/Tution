import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validatePromoCode } from '../controllers/promoController';

const router = express.Router();

// POST /api/promos/validate  — authenticated user validates a code before paying
router.post('/validate', authenticate, authorize('teacher', 'parent'), validatePromoCode);

export default router;
