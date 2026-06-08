import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
    return;
  }
  next();
};

// Register parent validation
export const registerParentValidation = [
  // Parent Details
  body('parentDetails.parentName')
    .trim()
    .notEmpty()
    .withMessage('Parent name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Parent name must be between 2 and 100 characters'),

  body('parentDetails.mobileNumber')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .matches(/^\d{10}$/)
    .withMessage('Mobile number must be 10 digits'),

  body('parentDetails.email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  // Student Details
  body('studentDetails.studentName')
    .trim()
    .notEmpty()
    .withMessage('Student name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Student name must be between 2 and 100 characters'),

  body('studentDetails.gender')
    .trim()
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other', 'Male', 'Female', 'Other'])
    .withMessage('Gender must be male, female, or other'),

  body('studentDetails.age')
    .trim()
    .notEmpty()
    .withMessage('Age is required')
    .isNumeric()
    .withMessage('Age must be a number')
    .custom((value) => {
      const age = parseInt(value, 10);
      if (age < 3 || age > 25) {
        throw new Error('Age must be between 3 and 25');
      }
      return true;
    }),

  body('studentDetails.className')
    .trim()
    .notEmpty()
    .withMessage('Class is required'),

  body('studentDetails.schoolName')
    .trim()
    .notEmpty()
    .withMessage('School name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('School name must be between 2 and 200 characters'),

  // Tuition Requirement
  body('tuitionRequirement.subjects')
    .isArray({ min: 1 })
    .withMessage('At least one subject is required'),

  body('tuitionRequirement.board')
    .trim()
    .notEmpty()
    .withMessage('Board is required')
    .isIn(['CBSE', 'ICSE', 'State Board', 'IGCSE', 'IB'])
    .withMessage('Invalid board selected'),

  body('tuitionRequirement.tuitionMode')
    .trim()
    .notEmpty()
    .withMessage('Tuition mode is required')
    .isIn(['Home Tuition', 'Online Tuition', 'Group Tuition'])
    .withMessage('Invalid tuition mode selected'),

  // Preferred Timing
  body('preferredTiming.days')
    .isArray({ min: 1 })
    .withMessage('At least one preferred day is required'),

  body('preferredTiming.timeSlots')
    .isArray({ min: 1 })
    .withMessage('At least one preferred time slot is required'),

  // Location
  body('locationDetails.address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Address must be between 10 and 500 characters'),

  body('locationDetails.city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),

  body('locationDetails.pincode')
    .trim()
    .notEmpty()
    .withMessage('Pincode is required')
    .matches(/^\d{6}$/)
    .withMessage('Pincode must be 6 digits'),

  // Budget
  body('budgetDetails.budget')
    .trim()
    .notEmpty()
    .withMessage('Budget is required')
    .isIn(['₹1000 - ₹2000', '₹2000 - ₹5000', '₹5000 - ₹10000', '₹10000+', 'Custom Budget'])
    .withMessage('Invalid budget selected'),

  body('budgetDetails.customBudget')
    .optional()
    .trim()
    .custom((value, { req }) => {
      if (req.body?.budgetDetails?.budget === 'Custom Budget' && !value) {
        throw new Error('Custom budget amount is required when Custom Budget is selected');
      }
      if (value && isNaN(Number(value))) {
        throw new Error('Custom budget must be a number');
      }
      return true;
    }),

  // Tutor Preferences (Optional)
  body('tutorPreferences')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Tutor preferences must not exceed 500 characters'),

  handleValidationErrors,
];

// Update parent validation
export const updateParentValidation = [
  body('profile.parentName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Parent name must be between 2 and 100 characters'),

  body('profile.mobileNumber')
    .optional()
    .trim()
    .matches(/^\d{10}$/)
    .withMessage('Mobile number must be 10 digits'),

  body('profile.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('profile.address')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Address must be between 10 and 500 characters'),

  handleValidationErrors,
];
