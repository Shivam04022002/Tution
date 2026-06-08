import express from 'express';
import {
  registerParent,
  getParentProfile,
  updateParentProfile,
  getAllRequirements,
  getRequirementById,
  closeRequirement,
  extendRequirement,
  getMyRequirements,
  deleteRequirement,
} from '../controllers/parentController';
import { authenticate, authorize } from '../middleware/auth';
import {
  registerParentValidation,
  updateParentValidation,
} from '../middleware/parentValidation';

const router = express.Router();

// Public routes
router.get('/requirements', getAllRequirements);
router.get('/requirements/:id', getRequirementById);

// Registration route - any authenticated user can register as parent
router.post(
  '/register',
  authenticate,
  registerParentValidation,
  registerParent
);

// Protected routes - Parent only (must have parent role)

router.get('/profile/me', authenticate, authorize('parent', 'admin'), getParentProfile);

router.put(
  '/profile',
  authenticate,
  authorize('parent', 'admin'),
  updateParentValidation,
  updateParentProfile
);

// Get authenticated parent's own requirements
router.get(
  '/my-requirements',
  authenticate,
  authorize('parent', 'admin'),
  getMyRequirements
);

// Delete (soft-delete) a requirement
router.delete(
  '/requirements/:id',
  authenticate,
  authorize('parent', 'admin'),
  deleteRequirement
);

router.post(
  '/requirements/:id/close',
  authenticate,
  authorize('parent', 'admin'),
  closeRequirement
);

router.post(
  '/requirements/:id/extend',
  authenticate,
  authorize('parent', 'admin'),
  extendRequirement
);

export default router;
