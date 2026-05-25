import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { auth, firestore } from '../config/firebase';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';

// Generate JWT Token
const generateToken = (firebaseUid: string): string => {
  return jwt.sign({ firebaseUid }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  } as jwt.SignOptions);
};

// Send OTP
export const sendOTP = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    
    // Send OTP via Firebase (simulated for demo)
    // In production, you would use Firebase Auth to send OTP
    try {
      await auth.createUser({
        phoneNumber,
      });
    } catch (error: any) {
      if (error.code === 'auth/user-already-exists') {
        // User already exists, proceed with verification
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
  } catch (error: any) {
    console.error('Send OTP error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
};

// Verify OTP and Login/Register
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, otp, role } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required',
      });
    }

    // Verify OTP with Firebase (this would need Firebase client SDK in production)
    // For now, we'll simulate the verification
    let firebaseUser;
    try {
      // In production, you would verify the OTP with Firebase Auth
      // firebaseUser = await auth.verifyPhoneNumber(phoneNumber, otp);
      
      // For demo purposes, we'll find or create a user
      firebaseUser = await auth.getUserByPhoneNumber(phoneNumber);
    } catch (error: any) {
      // If user doesn't exist, create one
      firebaseUser = await auth.createUser({ phoneNumber });
    }

    // Find or create user in our database
    let user = await User.findOne({ firebaseUid: firebaseUser.uid });
    
    if (!user) {
      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required for new users',
        });
      }

      user = new User({
        firebaseUid: firebaseUser.uid,
        phoneNumber,
        email: `${phoneNumber}@tuition.app`, // Placeholder email
        role,
        profile: {
          firstName: '',
          lastName: '',
        },
      });
      
      await user.save();
    }

    // Generate JWT token
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
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  }
};

// Get current user
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user information',
    });
  }
};

// Update user profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    // Don't allow updating sensitive fields directly
    const allowedUpdates = [
      'profile.firstName',
      'profile.lastName',
      'profile.dateOfBirth',
      'profile.gender',
      'profile.profileImage',
      'preferences',
    ];

    const updateData: any = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key) || allowedUpdates.some(allowed => key.startsWith(allowed + '.'))) {
        updateData[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

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
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

// Logout (client-side token removal)
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    // In a real implementation, you might want to invalidate the token
    // For JWT, this is typically handled client-side by removing the token
    
    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
    });
  }
};
