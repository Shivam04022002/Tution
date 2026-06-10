import express from 'express';
import { body } from 'express-validator';
import {
  sendOTP,
  verifyOTP,
  getCurrentUser,
  updateProfile,
  logout,
  login,
  signup,
  registerComplete,
  checkDuplicate,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Validation middleware
const sendOTPValidation = [
  body('phoneNumber')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
];

const verifyOTPValidation = [
  body('phoneNumber')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 6 digits'),
  body('role')
    .optional()
    .isIn(['parent', 'teacher', 'admin'])
    .withMessage('Role must be parent, teacher, or admin'),
];

const updateProfileValidation = [
  body('profile.firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('profile.lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('profile.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('profile.gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
];

const loginValidation = [
  body('emailOrMobile')
    .notEmpty()
    .withMessage('Email or mobile number is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const signupValidation = [
  body('role')
    .isIn(['parent', 'teacher'])
    .withMessage('Role must be parent or teacher'),
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('mobileNumber')
    .isMobilePhone('any')
    .withMessage('Please provide a valid mobile number'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const registerCompleteValidation = [
  body('role')
    .isIn(['parent', 'teacher'])
    .withMessage('Role must be parent or teacher'),
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('mobileNumber')
    .isMobilePhone('any')
    .withMessage('Please provide a valid mobile number'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

// Routes
router.post('/send-otp', sendOTPValidation, sendOTP);
router.post('/verify-otp', verifyOTPValidation, verifyOTP);
router.post('/login', loginValidation, login);
router.post('/signup', signupValidation, signup);
router.post('/register-complete', registerCompleteValidation, registerComplete);
router.get('/me', authenticate, getCurrentUser);
router.put('/profile', authenticate, updateProfileValidation, updateProfile);
router.post('/logout', authenticate, logout);
router.post('/check-duplicate', checkDuplicate);

export default router;
