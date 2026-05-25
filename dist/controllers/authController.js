"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.updateProfile = exports.getCurrentUser = exports.verifyOTP = exports.sendOTP = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebase_1 = require("../config/firebase");
const User_1 = require("../models/User");
const generateToken = (firebaseUid) => {
    return jsonwebtoken_1.default.sign({ firebaseUid }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};
const sendOTP = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
        }
        const existingUser = await User_1.User.findOne({ phoneNumber });
        try {
            await firebase_1.auth.createUser({
                phoneNumber,
            });
        }
        catch (error) {
            if (error.code === 'auth/user-already-exists') {
                return res.status(200).json({
                    success: true,
                    message: 'OTP sent successfully',
                    userExists: true,
                });
            }
        }
        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            userExists: !!existingUser,
        });
    }
    catch (error) {
        console.error('Send OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
        });
    }
};
exports.sendOTP = sendOTP;
const verifyOTP = async (req, res) => {
    try {
        const { phoneNumber, otp, role } = req.body;
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP are required',
            });
        }
        let firebaseUser;
        try {
            firebaseUser = await firebase_1.auth.getUserByPhoneNumber(phoneNumber);
        }
        catch (error) {
            firebaseUser = await firebase_1.auth.createUser({ phoneNumber });
        }
        let user = await User_1.User.findOne({ firebaseUid: firebaseUser.uid });
        if (!user) {
            if (!role) {
                return res.status(400).json({
                    success: false,
                    message: 'Role is required for new users',
                });
            }
            user = new User_1.User({
                firebaseUid: firebaseUser.uid,
                phoneNumber,
                email: `${phoneNumber}@tuition.app`,
                role,
                profile: {
                    firstName: '',
                    lastName: '',
                },
            });
            await user.save();
        }
        const token = generateToken(user.firebaseUid);
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
            },
        });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
        });
    }
};
exports.verifyOTP = verifyOTP;
const getCurrentUser = async (req, res) => {
    try {
        const user = req.user;
        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
                preferences: user.preferences,
                isVerified: user.isVerified,
            },
        });
    }
    catch (error) {
        console.error('Get current user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get user information',
        });
    }
};
exports.getCurrentUser = getCurrentUser;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const updates = req.body;
        const allowedUpdates = [
            'profile.firstName',
            'profile.lastName',
            'profile.dateOfBirth',
            'profile.gender',
            'profile.profileImage',
            'preferences',
        ];
        const updateData = {};
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key) || allowedUpdates.some(allowed => key.startsWith(allowed + '.'))) {
                updateData[key] = updates[key];
            }
        });
        const user = await User_1.User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
                preferences: user.preferences,
            },
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
        });
    }
};
exports.updateProfile = updateProfile;
const logout = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: 'Logout successful',
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to logout',
        });
    }
};
exports.logout = logout;
//# sourceMappingURL=authController.js.map