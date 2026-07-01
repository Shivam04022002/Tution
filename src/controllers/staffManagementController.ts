import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';

// Allowed staff roles
const STAFF_ROLES = [
  'Operations',
  'Verification',
  'Customer Support',
  'Finance',
  'Marketing',
  'Content',
  'Academic Coordinator',
  'Sales',
  'Technical Support',
  'Super Staff',
];

// Generate the next sequential employee ID (STF000001, STF000002, ...)
const generateEmployeeId = async (): Promise<string> => {
  const prefix = 'STF';
  const lastStaff = await User.findOne({ employeeId: { $regex: '^STF' } })
    .sort({ employeeId: -1 })
    .select('employeeId')
    .lean();

  let nextNumber = 1;
  if (lastStaff?.employeeId) {
    const match = lastStaff.employeeId.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(6, '0')}`;
};

// Parse full name into first/last parts
const parseName = (name: string): { firstName: string; lastName: string } => {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
};

// Build a consistent staff response object
const buildStaffResponse = (user: any, includeAll = false) => {
  const base = {
    id: user._id,
    name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
    email: user.email,
    phoneNumber: user.phoneNumber,
    username: user.username || null,
    employeeId: user.employeeId || null,
    role: user.role,
    staffRole: user.staffRole || null,
    department: user.department || user.profile?.department || null,
    designation: user.designation || null,
    joiningDate: user.joiningDate || null,
    dateOfBirth: user.dateOfBirth || user.profile?.dateOfBirth || null,
    gender: user.gender || user.profile?.gender || null,
    permissions: user.permissions || [],
    permissionsCount: (user.permissions || []).length,
    isActive: user.isActive,
    isVerified: user.isVerified,
    isBlocked: user.isBlocked,
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (includeAll) {
    return {
      ...base,
      createdBy: user.createdBy || null,
      updatedBy: user.updatedBy || null,
      profileCompleted: user.profileCompleted,
      onboardingCompleted: user.onboardingCompleted,
    };
  }

  return base;
};

// Create new staff user (admin only)
export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      password,
      username,
      staffRole,
      department,
      designation,
      joiningDate,
      dateOfBirth,
      gender,
      permissions,
      isActive,
    } = req.body;

    const adminId = req.user?._id;

    // Validation
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone number, and password are required',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    if (!/^\+?[\d\s\-\(\)]+$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    if (staffRole && !STAFF_ROLES.includes(staffRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid staff role. Allowed roles: ${STAFF_ROLES.join(', ')}`,
      });
    }

    // Check email/phone uniqueness
    const orConditions: any[] = [
      { email: email.toLowerCase() },
      { phoneNumber },
    ];
    if (username) orConditions.push({ username: username.toLowerCase() });

    const existingUser = await User.findOne({ $or: orConditions });

    if (existingUser) {
      let message = 'User with this email or phone number already exists';
      if (existingUser.email === email.toLowerCase()) message = 'Email address already in use';
      else if (existingUser.phoneNumber === phoneNumber) message = 'Phone number already in use';
      else if (username && existingUser.username === username.toLowerCase()) message = 'Username already in use';

      return res.status(409).json({ success: false, message });
    }

    // Generate employee ID
    const employeeId = await generateEmployeeId();

    // Verify uniqueness of generated employee ID (edge case race condition)
    const employeeIdExists = await User.findOne({ employeeId });
    if (employeeIdExists) {
      return res.status(409).json({
        success: false,
        message: 'Employee ID collision. Please retry.',
      });
    }

    const { firstName, lastName } = parseName(name);

    const staffUser = new User({
      email: email.toLowerCase(),
      phoneNumber,
      password,
      username: username ? username.toLowerCase() : undefined,
      role: 'staff',
      staffRole: staffRole || null,
      employeeId,
      designation: designation || null,
      department: department || null,
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender || null,
      permissions: Array.isArray(permissions) ? permissions : [],
      isActive: isActive !== undefined ? isActive : true,
      isVerified: true,
      isBlocked: false,
      profile: {
        firstName,
        lastName,
        department: department || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
      },
      profileCompleted: true,
      onboardingCompleted: true,
      createdBy: adminId || null,
      updatedBy: adminId || null,
    });

    await staffUser.save();

    return res.status(201).json({
      success: true,
      message: 'Staff user created successfully',
      data: buildStaffResponse(staffUser, true),
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
    const { page = 1, limit = 10, search, department, staffRole, isActive } = req.query;

    const andConditions: any[] = [{ role: 'staff' }];

    if (search) {
      const searchTerm = search as string;
      const searchRegex = { $regex: searchTerm, $options: 'i' };
      andConditions.push({
        $or: [
          { 'profile.firstName': searchRegex },
          { 'profile.lastName': searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { employeeId: searchRegex },
          { username: searchRegex },
        ],
      });
    }

    if (department) {
      andConditions.push({
        $or: [
          { department },
          { 'profile.department': department },
        ],
      });
    }

    if (staffRole) {
      andConditions.push({ staffRole });
    }

    if (isActive !== undefined) {
      andConditions.push({ isActive: isActive === 'true' });
    }

    const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

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

    const staffResponse = staff.map(user => buildStaffResponse(user, false));

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
    const adminId = req.user?._id;

    // Block protected fields
    const protectedFields = ['_id', 'employeeId', 'createdAt', 'role'];
    for (const field of protectedFields) {
      if (req.body[field] !== undefined) {
        return res.status(400).json({
          success: false,
          message: `${field} cannot be updated through this endpoint`,
        });
      }
    }

    const {
      name,
      email,
      phoneNumber,
      username,
      staffRole,
      department,
      designation,
      joiningDate,
      dateOfBirth,
      gender,
      permissions,
      isActive,
      isVerified,
    } = req.body;

    const staffUser = await User.findOne({ _id: id, role: 'staff' });

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    if (staffRole && !STAFF_ROLES.includes(staffRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid staff role. Allowed roles: ${STAFF_ROLES.join(', ')}`,
      });
    }

    // Check email/phone/username uniqueness against other users
    if (email || phoneNumber || username) {
      const orConditions: any[] = [];
      if (email) orConditions.push({ email: email.toLowerCase() });
      if (phoneNumber) orConditions.push({ phoneNumber });
      if (username) orConditions.push({ username: username.toLowerCase() });

      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: orConditions,
      });

      if (existingUser) {
        let message = 'Email or phone number already exists';
        if (email && existingUser.email === email.toLowerCase()) message = 'Email address already in use';
        else if (phoneNumber && existingUser.phoneNumber === phoneNumber) message = 'Phone number already in use';
        else if (username && existingUser.username === username.toLowerCase()) message = 'Username already in use';

        return res.status(409).json({ success: false, message });
      }
    }

    // Update fields
    if (name !== undefined) {
      const { firstName, lastName } = parseName(name);
      staffUser.profile!.firstName = firstName;
      staffUser.profile!.lastName = lastName;
    }

    if (email !== undefined) staffUser.email = email.toLowerCase();
    if (phoneNumber !== undefined) staffUser.phoneNumber = phoneNumber;
    if (username !== undefined) staffUser.username = username ? username.toLowerCase() : null;
    if (staffRole !== undefined) staffUser.staffRole = staffRole || null;
    if (department !== undefined) {
      staffUser.department = department || null;
      staffUser.profile!.department = department || null;
    }
    if (designation !== undefined) staffUser.designation = designation || null;
    if (joiningDate !== undefined) staffUser.joiningDate = joiningDate ? new Date(joiningDate) : null;
    if (dateOfBirth !== undefined) {
      const dob = dateOfBirth ? new Date(dateOfBirth) : null;
      staffUser.dateOfBirth = dob;
      staffUser.profile!.dateOfBirth = dob;
    }
    if (gender !== undefined) {
      staffUser.gender = gender || null;
      staffUser.profile!.gender = gender || null;
    }
    if (permissions !== undefined) staffUser.permissions = Array.isArray(permissions) ? permissions : [];
    if (isActive !== undefined) staffUser.isActive = isActive;
    if (isVerified !== undefined) staffUser.isVerified = isVerified;

    staffUser.updatedBy = adminId || null;

    await staffUser.save();

    return res.status(200).json({
      success: true,
      message: 'Staff user updated successfully',
      data: buildStaffResponse(staffUser, true),
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
      data: buildStaffResponse(staffUser, false),
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

    return res.status(200).json({
      success: true,
      data: buildStaffResponse(staffUser, true),
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

// Reset staff password (admin only)
export const resetStaffPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const adminId = req.user?._id;

    const staffUser = await User.findOne({ _id: id, role: 'staff' }).select('+password');

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    let newPassword = password;
    if (!newPassword) {
      newPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    staffUser.password = newPassword;
    staffUser.updatedBy = adminId || null;
    await staffUser.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        id: staffUser._id,
        employeeId: staffUser.employeeId,
        name: `${staffUser.profile?.firstName || ''} ${staffUser.profile?.lastName || ''}`.trim(),
        password: newPassword,
      },
    });

  } catch (error: any) {
    console.error('Reset staff password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset staff password',
      error: error.message,
    });
  }
};
