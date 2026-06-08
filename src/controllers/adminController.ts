import { Response } from 'express';
import { User } from '../models/User';
import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import { TutorApplication } from '../models/TutorApplication';
import { DemoClass } from '../models/DemoClass';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

// ─────────────────────────────────────────────
// Helper: write audit log entry
// ─────────────────────────────────────────────
async function writeAuditLog(
  adminId: any,
  action: import('../models/AuditLog').AuditAction,
  entityType: import('../models/AuditLog').AuditEntityType,
  entityId: any,
  oldValue: Record<string, any> | undefined,
  newValue: Record<string, any> | undefined,
  req: AuthRequest
) {
  try {
    await AuditLog.create({
      adminId,
      action,
      entityType,
      entityId,
      ...(oldValue !== undefined && { oldValue }),
      ...(newValue !== undefined && { newValue }),
      ipAddress:
        req.headers['x-forwarded-for']?.toString() ||
        req.socket?.remoteAddress ||
        '',
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (err) {
    console.error('AuditLog write error:', err);
  }
}

// ─────────────────────────────────────────────
// GET /api/admin/stats
// ─────────────────────────────────────────────
export const getPlatformStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalParents,
      totalTeachers,
      pendingTeachers,
      activeRequirements,
      totalApplications,
      totalDemoClasses,
    ] = await Promise.all([
      User.countDocuments({ role: 'parent', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      TeacherProfile.countDocuments({ verificationStatus: 'pending' }),
      ParentRequirement.countDocuments({ status: 'active', isActive: true }),
      TutorApplication.countDocuments({ isActive: true }),
      DemoClass.countDocuments({ isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalParents,
        totalTeachers,
        pendingTeachers,
        activeRequirements,
        totalApplications,
        totalDemoClasses,
      },
    });
  } catch (error) {
    console.error('getPlatformStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/users
// Query: role, search, isActive, page, limit
// ─────────────────────────────────────────────
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      role,
      search,
      isActive,
      page = '1',
      limit = '20',
    } = req.query;

    const filter: Record<string, any> = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -firebaseUid -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/teachers
// Query: verificationStatus, city, search, page, limit
// ─────────────────────────────────────────────
export const getAllTeachers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      verificationStatus,
      city,
      search,
      page = '1',
      limit = '20',
    } = req.query;

    const filter: Record<string, any> = {};

    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (city) filter['locationAvailability.city'] = { $regex: city, $options: 'i' };

    if (search) {
      filter.$or = [
        { 'basicDetails.fullName': { $regex: search, $options: 'i' } },
        { 'basicDetails.email': { $regex: search, $options: 'i' } },
        { 'basicDetails.mobileNumber': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [teachers, total] = await Promise.all([
      TeacherProfile.find(filter)
        .select(
          'basicDetails.fullName basicDetails.email basicDetails.mobileNumber basicDetails.profilePhoto ' +
          'teachingDetails.subjects teachingDetails.classes locationAvailability.city ' +
          'verificationStatus isActive isBlocked blockReason stats.averageRating ' +
          'pricingRevenue.hourlyRate createdAt updatedAt'
        )
        .populate('userId', 'email phoneNumber isActive isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      TeacherProfile.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: teachers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getAllTeachers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/teachers/:id
// ─────────────────────────────────────────────
export const getTeacherDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const teacher = await TeacherProfile.findById(id)
      .populate('userId', 'email phoneNumber role isActive isVerified createdAt')
      .lean();

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: teacher,
    });
  } catch (error) {
    console.error('getTeacherDetails error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher details',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/admin/teachers/:id/approve
// ─────────────────────────────────────────────
export const approveTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;

    const teacher = await TeacherProfile.findById(id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const oldValue = {
      verificationStatus: teacher.verificationStatus,
      isVerified: teacher.isVerified,
    };

    teacher.verificationStatus = 'verified';
    teacher.isVerified = true;
    teacher.verificationDate = new Date();
    teacher.rejectionReason = undefined;
    await teacher.save();

    await User.findByIdAndUpdate(teacher.userId, { isVerified: true });

    await writeAuditLog(
      adminId,
      'APPROVE_TEACHER',
      'TeacherProfile',
      id,
      oldValue,
      { verificationStatus: 'verified', isVerified: true },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Teacher approved successfully',
      data: {
        _id: teacher._id,
        verificationStatus: teacher.verificationStatus,
        isVerified: teacher.isVerified,
      },
    });
  } catch (error) {
    console.error('approveTeacher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve teacher',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/admin/teachers/:id/reject
// Body: { reason }
// ─────────────────────────────────────────────
export const rejectTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const teacher = await TeacherProfile.findById(id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const oldValue = {
      verificationStatus: teacher.verificationStatus,
      isVerified: teacher.isVerified,
    };

    teacher.verificationStatus = 'rejected';
    teacher.isVerified = false;
    teacher.rejectionReason = reason.trim();
    await teacher.save();

    await User.findByIdAndUpdate(teacher.userId, { isVerified: false });

    await writeAuditLog(
      adminId,
      'REJECT_TEACHER',
      'TeacherProfile',
      id,
      oldValue,
      { verificationStatus: 'rejected', rejectionReason: reason.trim() },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Teacher rejected',
      data: {
        _id: teacher._id,
        verificationStatus: teacher.verificationStatus,
        rejectionReason: teacher.rejectionReason,
      },
    });
  } catch (error) {
    console.error('rejectTeacher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject teacher',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/admin/teachers/:id/block
// Body: { reason }
// ─────────────────────────────────────────────
export const blockTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Block reason is required',
      });
    }

    const teacher = await TeacherProfile.findById(id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    if (teacher.isBlocked) {
      return res.status(400).json({ success: false, message: 'Teacher is already blocked' });
    }

    const oldValue = { isBlocked: teacher.isBlocked, blockReason: teacher.blockReason };

    teacher.isBlocked = true;
    teacher.blockReason = reason.trim();
    teacher.isActive = false;
    await teacher.save();

    await User.findByIdAndUpdate(teacher.userId, { isActive: false });

    await writeAuditLog(
      adminId,
      'BLOCK_TEACHER',
      'TeacherProfile',
      id,
      oldValue,
      { isBlocked: true, blockReason: reason.trim(), isActive: false },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Teacher blocked',
      data: {
        _id: teacher._id,
        isBlocked: teacher.isBlocked,
        blockReason: teacher.blockReason,
      },
    });
  } catch (error) {
    console.error('blockTeacher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to block teacher',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/parents
// Query: search, isActive, page, limit
// ─────────────────────────────────────────────
export const getAllParents = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      isActive,
      page = '1',
      limit = '20',
    } = req.query;

    const filter: Record<string, any> = { role: 'parent' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -firebaseUid -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Attach requirement count for each parent
    const parentIds = users.map((u: any) => u._id);
    const reqCounts = await ParentRequirement.aggregate([
      { $match: { parentId: { $in: parentIds } } },
      { $group: { _id: '$parentId', count: { $sum: 1 } } },
    ]);
    const reqCountMap: Record<string, number> = {};
    reqCounts.forEach((r: any) => {
      reqCountMap[r._id.toString()] = r.count;
    });

    const enriched = users.map((u: any) => ({
      ...u,
      requirementsCount: reqCountMap[u._id.toString()] ?? 0,
    }));

    return res.status(200).json({
      success: true,
      data: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getAllParents error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch parents',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/parents/:id
// ─────────────────────────────────────────────
export const getParentDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: 'parent' })
      .select('-password -firebaseUid -__v')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    const requirements = await ParentRequirement.find({ parentId: id })
      .select('requirementId subjects studentDetails.grade status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { ...user, requirements },
    });
  } catch (error) {
    console.error('getParentDetails error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch parent details',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// PUT /api/admin/parents/:id
// Body: { profile, isActive }
// ─────────────────────────────────────────────
export const updateParent = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: 'parent' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    const updates: Record<string, any> = {};
    const oldValue: Record<string, any> = {};

    if (req.body.profile) {
      if (req.body.profile.firstName !== undefined) {
        oldValue['profile.firstName'] = user.profile?.firstName;
        updates['profile.firstName'] = req.body.profile.firstName;
      }
      if (req.body.profile.lastName !== undefined) {
        oldValue['profile.lastName'] = user.profile?.lastName;
        updates['profile.lastName'] = req.body.profile.lastName;
      }
    }
    if (req.body.isActive !== undefined) {
      oldValue.isActive = user.isActive;
      updates.isActive = req.body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -firebaseUid -__v');

    await writeAuditLog(
      adminId,
      'UPDATE_USER',
      'User',
      id,
      oldValue,
      updates,
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Parent updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('updateParent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update parent',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/admin/parents/:id
// Soft-delete: sets isActive = false
// ─────────────────────────────────────────────
export const deleteParent = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: 'parent' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    const oldValue = { isActive: user.isActive };

    await User.findByIdAndUpdate(id, { isActive: false });
    await ParentRequirement.updateMany(
      { parentId: id },
      { isActive: false, status: 'closed' }
    );

    await writeAuditLog(
      adminId,
      'DELETE_USER',
      'User',
      id,
      oldValue,
      { isActive: false },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Parent deactivated successfully',
    });
  } catch (error) {
    console.error('deleteParent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate parent',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/admin/teachers/:id/unblock
// ─────────────────────────────────────────────
export const unblockTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?._id;
    const { id } = req.params;

    const teacher = await TeacherProfile.findById(id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    if (!teacher.isBlocked) {
      return res.status(400).json({ success: false, message: 'Teacher is not blocked' });
    }

    const oldValue = { isBlocked: teacher.isBlocked, blockReason: teacher.blockReason };

    teacher.isBlocked = false;
    teacher.blockReason = undefined;
    teacher.isActive = true;
    await teacher.save();

    await User.findByIdAndUpdate(teacher.userId, { isActive: true });

    await writeAuditLog(
      adminId,
      'UNBLOCK_TEACHER',
      'TeacherProfile',
      id,
      oldValue,
      { isBlocked: false, isActive: true },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Teacher unblocked',
      data: {
        _id: teacher._id,
        isBlocked: teacher.isBlocked,
      },
    });
  } catch (error) {
    console.error('unblockTeacher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unblock teacher',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
