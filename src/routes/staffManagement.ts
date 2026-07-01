import express from 'express';
import { body } from 'express-validator';
import {
  createStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
  getStaffById,
  resetStaffPassword,
} from '../controllers/staffManagementController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate, authorize('admin'));

// Validation middleware
const createStaffValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('phoneNumber')
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('department')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Department must be between 2 and 50 characters'),
  body('staffRole')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Staff role must be between 2 and 50 characters'),
  body('designation')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Designation must be between 2 and 100 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array of strings'),
];

const updateStaffValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('phoneNumber')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  body('department')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Department must be between 2 and 50 characters'),
  body('staffRole')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Staff role must be between 2 and 50 characters'),
  body('designation')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Designation must be between 2 and 100 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array of strings'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const resetPasswordValidation = [
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
];

// Routes
/**
 * @route   POST /api/admin/staff
 * @desc    Create new staff user
 * @access  Admin only
 */
router.post('/', createStaffValidation, createStaff);

/**
 * @route   GET /api/admin/staff
 * @desc    Get all staff users with pagination and filtering
 * @access  Admin only
 */
router.get('/', getAllStaff);

/**
 * @route   GET /api/admin/staff/:id
 * @desc    Get staff user by ID
 * @access  Admin only
 */
router.get('/:id', getStaffById);

/**
 * @route   PUT /api/admin/staff/:id
 * @desc    Update staff user
 * @access  Admin only
 */
router.put('/:id', updateStaffValidation, updateStaff);

/**
 * @route   DELETE /api/admin/staff/:id
 * @desc    Delete staff user
 * @access  Admin only
 */
router.delete('/:id', deleteStaff);

/**
 * @route   POST /api/admin/staff/:id/reset-password
 * @desc    Reset staff user password
 * @access  Admin only
 */
router.post('/:id/reset-password', resetPasswordValidation, resetStaffPassword);

export default router;
