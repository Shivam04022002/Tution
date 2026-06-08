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

// Teacher registration validation
export const registerTeacherValidation = [
  // Personal Details
  body('personalDetails.fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .notEmpty()
    .withMessage('Full name is required'),

  body('personalDetails.mobileNumber')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile number must be exactly 10 digits')
    .notEmpty()
    .withMessage('Mobile number is required'),

  body('personalDetails.email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .notEmpty()
    .withMessage('Email is required'),

  body('personalDetails.gender')
    .trim()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other')
    .notEmpty()
    .withMessage('Gender is required'),

  body('personalDetails.address')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Address must be between 5 and 500 characters')
    .notEmpty()
    .withMessage('Address is required'),

  body('personalDetails.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters')
    .notEmpty()
    .withMessage('City is required'),

  body('personalDetails.pincode')
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('Pincode must be exactly 6 digits')
    .notEmpty()
    .withMessage('Pincode is required'),

  body('personalDetails.dob')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),

  // Education Details
  body('educationDetails.qualification')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Qualification must be between 2 and 100 characters')
    .notEmpty()
    .withMessage('Qualification is required'),

  body('educationDetails.collegeUniversity')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('College/University name must not exceed 200 characters'),

  // Professional Details
  body('professionalDetails.bio')
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage('Bio must be between 20 and 1000 characters')
    .notEmpty()
    .withMessage('Bio is required'),

  body('professionalDetails.teachingExperience')
    .trim()
    .isIn(['Fresher', '0-1 Years', '1-3 Years', '3-5 Years', '5-10 Years', '10+ Years'])
    .withMessage('Please select a valid teaching experience option')
    .notEmpty()
    .withMessage('Teaching experience is required'),

  // Teaching Details
  body('teachingDetails.subjects')
    .isArray({ min: 1 })
    .withMessage('At least one subject must be selected')
    .notEmpty()
    .withMessage('Subjects are required'),

  body('teachingDetails.subjects.*')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each subject must be between 2 and 50 characters'),

  body('teachingDetails.classes')
    .isArray({ min: 1 })
    .withMessage('At least one class must be selected')
    .notEmpty()
    .withMessage('Classes are required'),

  body('teachingDetails.boards')
    .isArray({ min: 1 })
    .withMessage('At least one board must be selected')
    .notEmpty()
    .withMessage('Boards are required'),

  // Teaching Mode
  body('teachingMode')
    .isArray({ min: 1 })
    .withMessage('At least one teaching mode must be selected')
    .notEmpty()
    .withMessage('Teaching mode is required'),

  body('teachingMode.*')
    .trim()
    .isIn(['Home Tuition', 'Online Tuition', 'Group Tuition', 'Institute Tuition'])
    .withMessage('Invalid teaching mode selected'),

  // Availability
  body('availability.days')
    .isArray({ min: 1 })
    .withMessage('At least one available day must be selected')
    .notEmpty()
    .withMessage('Available days are required'),

  body('availability.days.*')
    .trim()
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Invalid day selected'),

  body('availability.timeSlots')
    .isArray({ min: 1 })
    .withMessage('At least one time slot must be selected')
    .notEmpty()
    .withMessage('Available time slots are required'),

  body('availability.timeSlots.*')
    .trim()
    .isIn(['Morning', 'Afternoon', 'Evening', 'Night'])
    .withMessage('Invalid time slot selected'),

  // Location Preferences
  body('locationPreferences')
    .isArray({ min: 1 })
    .withMessage('At least one preferred location is required')
    .notEmpty()
    .withMessage('Preferred locations are required'),

  body('locationPreferences.*')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Each location must be between 2 and 100 characters'),

  // Pricing
  body('pricingDetails.pricing')
    .trim()
    .isIn(['₹1000-₹2000', '₹2000-₹5000', '₹5000-₹10000', '₹10000+', 'Custom Amount'])
    .withMessage('Please select a valid pricing option')
    .notEmpty()
    .withMessage('Pricing is required'),

  body('pricingDetails.customAmount')
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage('Custom amount must be a number')
    .custom((value, { req }) => {
      if (req.body.pricingDetails?.pricing === 'Custom Amount' && !value) {
        throw new Error('Custom amount is required when Custom Amount is selected');
      }
      return true;
    }),

  handleValidationErrors,
];

// Update teacher profile validation
export const updateTeacherValidation = [
  body('basicDetails.fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),

  body('basicDetails.gender')
    .optional()
    .trim()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('basicDetails.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),

  body('basicDetails.languages')
    .optional()
    .isArray()
    .withMessage('Languages must be an array'),

  body('education.highestQualification')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Qualification must be between 2 and 100 characters'),

  body('education.university')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('University name must not exceed 200 characters'),

  body('teachingDetails.subjects')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one subject must be selected'),

  body('teachingDetails.classes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one class must be selected'),

  body('teachingDetails.boards')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one board must be selected'),

  body('teachingDetails.teachingModes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one teaching mode must be selected'),

  body('teachingDetails.teachingModes.*')
    .optional()
    .trim()
    .isIn(['online', 'student_home', 'own_home', 'group'])
    .withMessage('Invalid teaching mode'),

  body('locationAvailability.preferredAreas')
    .optional()
    .isArray()
    .withMessage('Preferred areas must be an array'),

  body('locationAvailability.preferredLocations')
    .optional()
    .isArray()
    .withMessage('Preferred locations must be an array'),

  body('locationAvailability.preferredLocations.*.area')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),

  body('locationAvailability.preferredLocations.*.city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),

  body('locationAvailability.preferredLocations.*.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('locationAvailability.preferredLocations.*.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),

  body('locationAvailability.preferredLocations.*.radiusKm')
    .optional()
    .isFloat({ min: 1, max: 50 })
    .withMessage('Radius must be between 1 and 50 km'),

  body('locationAvailability.coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('locationAvailability.coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),

  body('locationAvailability.availableDays')
    .optional()
    .isArray()
    .withMessage('Available days must be an array'),

  body('locationAvailability.availableDays.*')
    .optional()
    .trim()
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Invalid day selected'),

  body('locationAvailability.availableTimeSlots')
    .optional()
    .isArray()
    .withMessage('Available time slots must be an array'),

  body('pricingRevenue.hourlyRate')
    .optional()
    .isNumeric()
    .withMessage('Hourly rate must be a number')
    .isInt({ min: 50, max: 10000 })
    .withMessage('Hourly rate must be between 50 and 10000'),

  body('pricingRevenue.monthlyRate')
    .optional()
    .isNumeric()
    .withMessage('Monthly rate must be a number')
    .isInt({ min: 1000, max: 100000 })
    .withMessage('Monthly rate must be between 1000 and 100000'),

  body('pricingRevenue.negotiationAllowed')
    .optional()
    .isBoolean()
    .withMessage('Negotiation allowed must be a boolean'),

  body('locationAvailability.vacationMode')
    .optional()
    .isBoolean()
    .withMessage('Vacation mode must be a boolean'),

  handleValidationErrors,
];

// File upload validation
export const validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).json({
      success: false,
      message: 'No files uploaded',
    });
    return;
  }
  next();
};
