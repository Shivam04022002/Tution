"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateParentValidation = exports.registerParentValidation = void 0;
const express_validator_1 = require("express-validator");
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
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
exports.registerParentValidation = [
    (0, express_validator_1.body)('parentDetails.parentName')
        .trim()
        .notEmpty()
        .withMessage('Parent name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Parent name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('parentDetails.mobileNumber')
        .trim()
        .notEmpty()
        .withMessage('Mobile number is required')
        .matches(/^\d{10}$/)
        .withMessage('Mobile number must be 10 digits'),
    (0, express_validator_1.body)('parentDetails.email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail(),
    (0, express_validator_1.body)('studentDetails.studentName')
        .trim()
        .notEmpty()
        .withMessage('Student name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Student name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('studentDetails.gender')
        .trim()
        .notEmpty()
        .withMessage('Gender is required')
        .isIn(['male', 'female', 'other', 'Male', 'Female', 'Other'])
        .withMessage('Gender must be male, female, or other'),
    (0, express_validator_1.body)('studentDetails.age')
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
    (0, express_validator_1.body)('studentDetails.className')
        .trim()
        .notEmpty()
        .withMessage('Class is required'),
    (0, express_validator_1.body)('studentDetails.schoolName')
        .trim()
        .notEmpty()
        .withMessage('School name is required')
        .isLength({ min: 2, max: 200 })
        .withMessage('School name must be between 2 and 200 characters'),
    (0, express_validator_1.body)('tuitionRequirement.subjects')
        .isArray({ min: 1 })
        .withMessage('At least one subject is required'),
    (0, express_validator_1.body)('tuitionRequirement.board')
        .trim()
        .notEmpty()
        .withMessage('Board is required')
        .isIn(['CBSE', 'ICSE', 'State Board', 'IGCSE', 'IB'])
        .withMessage('Invalid board selected'),
    (0, express_validator_1.body)('tuitionRequirement.tuitionMode')
        .trim()
        .notEmpty()
        .withMessage('Tuition mode is required')
        .isIn(['Home Tuition', 'Online Tuition', 'Group Tuition'])
        .withMessage('Invalid tuition mode selected'),
    (0, express_validator_1.body)('preferredTiming.days')
        .isArray({ min: 1 })
        .withMessage('At least one preferred day is required'),
    (0, express_validator_1.body)('preferredTiming.timeSlots')
        .isArray({ min: 1 })
        .withMessage('At least one preferred time slot is required'),
    (0, express_validator_1.body)('locationDetails.address')
        .trim()
        .notEmpty()
        .withMessage('Address is required')
        .isLength({ min: 10, max: 500 })
        .withMessage('Address must be between 10 and 500 characters'),
    (0, express_validator_1.body)('locationDetails.city')
        .trim()
        .notEmpty()
        .withMessage('City is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('City must be between 2 and 100 characters'),
    (0, express_validator_1.body)('locationDetails.pincode')
        .trim()
        .notEmpty()
        .withMessage('Pincode is required')
        .matches(/^\d{6}$/)
        .withMessage('Pincode must be 6 digits'),
    (0, express_validator_1.body)('budgetDetails.budget')
        .trim()
        .notEmpty()
        .withMessage('Budget is required')
        .isIn(['₹1000 - ₹2000', '₹2000 - ₹5000', '₹5000 - ₹10000', '₹10000+', 'Custom Budget'])
        .withMessage('Invalid budget selected'),
    (0, express_validator_1.body)('budgetDetails.customBudget')
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
    (0, express_validator_1.body)('tutorPreferences')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Tutor preferences must not exceed 500 characters'),
    handleValidationErrors,
];
exports.updateParentValidation = [
    (0, express_validator_1.body)('profile.parentName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Parent name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('profile.mobileNumber')
        .optional()
        .trim()
        .matches(/^\d{10}$/)
        .withMessage('Mobile number must be 10 digits'),
    (0, express_validator_1.body)('profile.email')
        .optional()
        .trim()
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail(),
    (0, express_validator_1.body)('profile.address')
        .optional()
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage('Address must be between 10 and 500 characters'),
    handleValidationErrors,
];
//# sourceMappingURL=parentValidation.js.map