const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

// Send OTP (Mock for development)
router.post('/send-otp', async (req, res) => {
  try {
    const { mobileNumber, email } = req.body;
    
    if (!mobileNumber && !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Mobile number or email is required'
      });
    }

    // In development, generate a mock OTP
    const otp = process.env.NODE_ENV === 'development' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`🔢 OTP for ${mobileNumber || email}: ${otp}`);
    
    // Check if user exists, if not create one
    let user = await User.findByEmailOrMobile(mobileNumber || email);
    
    if (!user) {
      // Create new user with pending role
      user = new User({
        email: email || `${mobileNumber}@temp.com`,
        mobileNumber: mobileNumber || '0000000000',
        role: 'parent', // Default role, will be updated during profile completion
        isEmailVerified: false,
        isMobileVerified: false,
      });
      
      await user.save();
    }

    // Store OTP in user document (in production, use Redis)
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully',
      data: {
        userId: user._id,
        // In development, return OTP for testing
        ...(process.env.NODE_ENV === 'development' && { otp })
      }
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send OTP'
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobileNumber, email, otp, role } = req.body;
    
    if (!otp) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP is required'
      });
    }

    if (!mobileNumber && !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Mobile number or email is required'
      });
    }

    // Find user
    const user = await User.findByEmailOrMobile(mobileNumber || email);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify OTP
    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired OTP'
      });
    }

    // Update user verification status
    if (mobileNumber) {
      user.isMobileVerified = true;
    }
    if (email) {
      user.isEmailVerified = true;
    }

    // Update role if provided
    if (role && ['parent', 'teacher', 'admin'].includes(role)) {
      user.role = role;
    }

    user.lastLogin = new Date();
    user.otp = undefined;
    user.otpExpires = undefined;
    
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify OTP'
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated.'
      });
    }

    if (user.isBlocked) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is blocked.'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get Current User Error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid token.'
    });
  }
});

// Update profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.'
      });
    }

    const { profile } = req.body;
    
    if (profile) {
      // Update profile fields
      if (profile.firstName) user.profile.firstName = profile.firstName;
      if (profile.lastName) user.profile.lastName = profile.lastName;
      if (profile.dateOfBirth) user.profile.dateOfBirth = profile.dateOfBirth;
      if (profile.gender) user.profile.gender = profile.gender;
      if (profile.profilePhoto) user.profile.profilePhoto = profile.profilePhoto;
    }

    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile'
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    // In a real implementation, you might want to blacklist the token
    // For now, we'll just return success
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to logout'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.'
      });
    }

    // Generate new token
    const newToken = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        token: newToken
      }
    });
  } catch (error) {
    console.error('Refresh Token Error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid token.'
    });
  }
});

module.exports = router;
