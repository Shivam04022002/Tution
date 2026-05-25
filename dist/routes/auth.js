"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const sendOTPValidation = [
    (0, express_validator_1.body)('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Please provide a valid phone number'),
];
const verifyOTPValidation = [
    (0, express_validator_1.body)('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Please provide a valid phone number'),
    (0, express_validator_1.body)('otp')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('OTP must be 6 digits'),
    (0, express_validator_1.body)('role')
        .optional()
        .isIn(['parent', 'teacher', 'admin'])
        .withMessage('Role must be parent, teacher, or admin'),
];
const updateProfileValidation = [
    (0, express_validator_1.body)('profile.firstName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    (0, express_validator_1.body)('profile.lastName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    (0, express_validator_1.body)('profile.dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid date of birth'),
    (0, express_validator_1.body)('profile.gender')
        .optional()
        .isIn(['male', 'female', 'other'])
        .withMessage('Gender must be male, female, or other'),
];
router.post('/send-otp', sendOTPValidation, authController_1.sendOTP);
router.post('/verify-otp', verifyOTPValidation, authController_1.verifyOTP);
router.get('/me', auth_1.authenticate, authController_1.getCurrentUser);
router.put('/profile', auth_1.authenticate, updateProfileValidation, authController_1.updateProfile);
router.post('/logout', auth_1.authenticate, authController_1.logout);
exports.default = router;
//# sourceMappingURL=auth.js.map