import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';

// Create new staff user (admin only)
export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phoneNumber, password, department } = req.body;

    // Validation
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone number, and password are required',
      });
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // Phone validation
    if (!/^\+?[\d\s\-\(\)]+$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number',
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phoneNumber }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or phone number already exists',
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create staff user
    const staffUser = new User({
      email: email.toLowerCase(),
      phoneNumber,
      password: hashedPassword,
      role: 'staff',
      isActive: true,
      isVerified: true,
      isBlocked: false,
      profile: {
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
        department: department || 'Operations',
      },
      profileCompleted: true,
      onboardingCompleted: true,
    });

    await staffUser.save();

    // Return staff user without password
    const staffResponse = {
      id: staffUser._id,
      name: `${staffUser.profile?.firstName} ${staffUser.profile?.lastName}`.trim(),
      email: staffUser.email,
      phoneNumber: staffUser.phoneNumber,
      role: staffUser.role,
      department: staffUser.profile?.department,
      isActive: staffUser.isActive,
      isVerified: staffUser.isVerified,
      createdAt: staffUser.createdAt,
    };

    return res.status(201).json({
      success: true,
      message: 'Staff user created successfully',
      data: staffResponse,
    });

  } catch (error: any) {
    console.error('Create staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create staff user',
      error: error.message,
    });
  }
};

// Get all staff users (admin only)
export const getAllStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search, department, isActive } = req.query;

    // Build query
    const query: any = { role: 'staff' };

    if (search) {
      query.$or = [
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (department) {
      query['profile.department'] = department;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Execute query with pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [staff, total] = await Promise.all([
      User.find(query)
        .select('-password -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

    const staffResponse = staff.map(user => ({
      id: user._id,
      name: `${user.profile?.firstName} ${user.profile?.lastName}`.trim(),
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      department: user.profile?.department,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isBlocked: user.isBlocked,
      profileCompleted: user.profileCompleted,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: staffResponse,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });

  } catch (error: any) {
    console.error('Get all staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff users',
      error: error.message,
    });
  }
};

// Update staff user (admin only)
export const updateStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phoneNumber, department, isActive } = req.body;

    // Find staff user
    const staffUser = await User.findOne({ _id: id, role: 'staff' });

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    // Check if email/phone is being updated and if it conflicts with existing users
    if (email || phoneNumber) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(email ? [{ email: email.toLowerCase() }] : []),
          ...(phoneNumber ? [{ phoneNumber }] : []),
        ]
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email or phone number already exists',
        });
      }
    }

    // Update fields
    if (name) {
      const nameParts = name.split(' ');
      staffUser.profile!.firstName = nameParts[0];
      staffUser.profile!.lastName = nameParts.slice(1).join(' ') || '';
    }

    if (email) {
      staffUser.email = email.toLowerCase();
    }

    if (phoneNumber) {
      staffUser.phoneNumber = phoneNumber;
    }

    if (department !== undefined) {
      staffUser.profile!.department = department;
    }

    if (isActive !== undefined) {
      staffUser.isActive = isActive;
    }

    await staffUser.save();

    // Return updated staff user
    const staffResponse = {
      id: staffUser._id,
      name: `${staffUser.profile?.firstName} ${staffUser.profile?.lastName}`.trim(),
      email: staffUser.email,
      phoneNumber: staffUser.phoneNumber,
      role: staffUser.role,
      department: staffUser.profile?.department,
      isActive: staffUser.isActive,
      isVerified: staffUser.isVerified,
      isBlocked: staffUser.isBlocked,
      profileCompleted: staffUser.profileCompleted,
      onboardingCompleted: staffUser.onboardingCompleted,
      updatedAt: staffUser.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: 'Staff user updated successfully',
      data: staffResponse,
    });

  } catch (error: any) {
    console.error('Update staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update staff user',
      error: error.message,
    });
  }
};

// Delete staff user (admin only)
export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Find and delete staff user
    const staffUser = await User.findOneAndDelete({ _id: id, role: 'staff' });

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Staff user deleted successfully',
      data: {
        id: staffUser._id,
        name: `${staffUser.profile?.firstName} ${staffUser.profile?.lastName}`.trim(),
        email: staffUser.email,
      },
    });

  } catch (error: any) {
    console.error('Delete staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete staff user',
      error: error.message,
    });
  }
};

// Get staff user by ID (admin only)
export const getStaffById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffUser = await User.findOne({ _id: id, role: 'staff' }).select('-password -__v');

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    const staffResponse = {
      id: staffUser._id,
      name: `${staffUser.profile?.firstName} ${staffUser.profile?.lastName}`.trim(),
      email: staffUser.email,
      phoneNumber: staffUser.phoneNumber,
      role: staffUser.role,
      department: staffUser.profile?.department,
      isActive: staffUser.isActive,
      isVerified: staffUser.isVerified,
      isBlocked: staffUser.isBlocked,
      profileCompleted: staffUser.profileCompleted,
      onboardingCompleted: staffUser.onboardingCompleted,
      createdAt: staffUser.createdAt,
      updatedAt: staffUser.updatedAt,
    };

    return res.status(200).json({
      success: true,
      data: staffResponse,
    });

  } catch (error: any) {
    console.error('Get staff by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff user',
      error: error.message,
    });
  }
};
