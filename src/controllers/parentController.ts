import { Request, Response } from 'express';
import { ParentRequirement } from '../models/ParentRequirement';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { MatchingService } from '../services/MatchingService';

// Register new parent and create requirement
export const registerParent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const firebaseUid = req.user?.firebaseUid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user already has a parent profile (duplicate check)
    const existingRequirement = await ParentRequirement.findOne({ parentId: userId });
    if (existingRequirement) {
      return res.status(409).json({
        success: false,
        message: 'Parent profile already exists. Use update endpoint to modify your profile.',
        data: {
          requirementId: existingRequirement.requirementId,
          requirement: existingRequirement,
        },
      });
    }

    const {
      parentDetails,
      studentDetails,
      tuitionRequirement,
      preferredTiming,
      locationDetails,
      budgetDetails,
      tutorPreferences,
    } = req.body;

    // Parse budget
    let minAmount = 0;
    let maxAmount = 0;
    
    if (budgetDetails?.budget === 'Custom Budget' && budgetDetails?.customBudget) {
      minAmount = 0;
      maxAmount = parseInt(budgetDetails.customBudget, 10) || 0;
    } else {
      const budgetMap: { [key: string]: { min: number; max: number } } = {
        '₹1000 - ₹2000': { min: 1000, max: 2000 },
        '₹2000 - ₹5000': { min: 2000, max: 5000 },
        '₹5000 - ₹10000': { min: 5000, max: 10000 },
        '₹10000+': { min: 10000, max: 50000 },
      };
      const budget = budgetMap[budgetDetails?.budget] || { min: 0, max: 0 };
      minAmount = budget.min;
      maxAmount = budget.max;
    }

    // Parse teaching mode
    const modeMap: { [key: string]: string } = {
      'Home Tuition': 'home',
      'Online Tuition': 'online',
      'Group Tuition': 'group',
    };
    const tuitionType = modeMap[tuitionRequirement?.tuitionMode] || 'home';

    // Generate unique requirement ID
    const requirementId = generateRequirementId();

    // Create parent requirement
    const parentRequirement = new ParentRequirement({
      parentId: userId,
      requirementId,
      studentDetails: {
        studentName: studentDetails?.studentName,
        age: parseInt(studentDetails?.age, 10) || 0,
        grade: studentDetails?.className,
        board: tuitionRequirement?.board,
        schoolName: studentDetails?.schoolName,
        genderPreference: studentDetails?.gender || 'any',
        multipleChildren: false,
      },
      subjects: tuitionRequirement?.subjects || [],
      languagePreference: ['English'], // Default, can be extended
      tuitionType,
      location: {
        address: locationDetails?.address,
        city: locationDetails?.city,
        pincode: locationDetails?.pincode,
        coordinates: {
          latitude: 0,
          longitude: 0,
        },
        teachingRadius: 5,
      },
      schedule: {
        daysPerWeek: preferredTiming?.days?.length?.toString() || '3',
        preferredTimings: preferredTiming?.timeSlots || [],
        startDate: new Date().toISOString().split('T')[0],
      },
      budget: {
        minAmount,
        maxAmount,
        negotiationAllowed: true,
      },
      status: 'active',
      priority: 'medium',
      matchedTutors: [],
      totalMatches: 0,
      views: 0,
      unlocks: 0,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      tutorPreferences: tutorPreferences || '',
    });

    // Ensure tutorPreferences is saved to the correct field
    if (tutorPreferences && tutorPreferences.trim()) {
      (parentRequirement as any).tutorPreferences = tutorPreferences.trim();
    }

    await parentRequirement.save();

    // Auto-trigger match generation for the new requirement (non-blocking)
    MatchingService.generateAndSaveForRequirement(parentRequirement).then(count => {
      console.log(`[Matching] Auto-generated ${count} matches for new requirement ${requirementId}`);
    }).catch(err => {
      console.error(`[Matching] Auto-match failed for requirement ${requirementId}:`, err);
    });

    // Update user with parent role and profile info
    await User.findByIdAndUpdate(userId, {
      role: 'parent',
      profile: {
        ...((req.user as any)?.profile || {}),
        parentName: parentDetails?.parentName,
        mobileNumber: parentDetails?.mobileNumber,
        email: parentDetails?.email,
      },
      isProfileComplete: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Parent registration successful. Your requirement has been posted.',
      data: {
        requirementId,
        requirement: parentRequirement,
      },
    });
  } catch (error) {
    console.error('Parent registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register parent',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get parent profile with requirements
export const getParentProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get user details
    const user = await User.findById(userId).select('-password -firebaseUid');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get all requirements for this parent
    const requirements = await ParentRequirement.find({ parentId: userId })
      .sort({ createdAt: -1 })
      .populate('matchedTutors.tutorId', 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects');

    return res.status(200).json({
      success: true,
      data: {
        user,
        requirements,
        totalRequirements: requirements.length,
        activeRequirements: requirements.filter(r => r.status === 'active').length,
      },
    });
  } catch (error) {
    console.error('Get parent profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch parent profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Update parent profile
export const updateParentProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const allowedUpdates = [
      'profile.parentName',
      'profile.mobileNumber',
      'profile.email',
      'profile.address',
    ];

    const updates = req.body;
    const updateData: any = {};

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key) || allowedUpdates.some((allowed) => key.startsWith(allowed + '.'))) {
        updateData[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -firebaseUid');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Update parent profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get all parent requirements (for admin/tutor matching)
export const getAllRequirements = async (req: Request, res: Response) => {
  try {
    const {
      city,
      subjects,
      minBudget,
      maxBudget,
      status = 'active',
      page = 1,
      limit = 20,
    } = req.query;

    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (city) {
      filter['location.city'] = { $regex: city, $options: 'i' };
    }

    if (subjects) {
      const subjectArray = Array.isArray(subjects) ? subjects : [subjects];
      filter.subjects = { $in: subjectArray };
    }

    if (minBudget || maxBudget) {
      filter['budget.maxAmount'] = {};
      if (minBudget) {
        filter['budget.maxAmount'].$gte = parseInt(minBudget as string, 10);
      }
      if (maxBudget) {
        filter['budget.maxAmount'].$lte = parseInt(maxBudget as string, 10);
      }
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    // Public-safe projection - exclude sensitive fields
    const publicSafeProjection = {
      'location.address': 0,
      'location.pincode': 0,
      'location.coordinates': 0,
      'matchedTutors': 0,
      'unlocks': 0,
    };

    const requirements = await ParentRequirement.find(filter, publicSafeProjection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string, 10))
      .populate('parentId', 'profile.parentName')
      .select('-matchedTutors -unlocks');

    const total = await ParentRequirement.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        requirements,
        pagination: {
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
          total,
          pages: Math.ceil(total / parseInt(limit as string, 10)),
        },
      },
    });
  } catch (error) {
    console.error('Get all requirements error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch requirements',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get single requirement by ID
export const getRequirementById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Public-safe projection - exclude sensitive fields
    const publicSafeProjection = {
      'location.address': 0,
      'location.pincode': 0,
      'location.coordinates': 0,
      'matchedTutors': 0,
      'unlocks': 0,
    };

    const requirement = await ParentRequirement.findById(id, publicSafeProjection)
      .populate('parentId', 'profile.parentName')
      .populate('matchedTutors.tutorId', 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects stats.averageRating');

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { requirement },
    });
  } catch (error) {
    console.error('Get requirement by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch requirement',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Close requirement
export const closeRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const requirement = await ParentRequirement.findOne({
      _id: id,
      parentId: userId,
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found or unauthorized',
      });
    }

    await requirement.closeRequirement(reason);

    return res.status(200).json({
      success: true,
      message: 'Requirement closed successfully',
      data: { requirement },
    });
  } catch (error) {
    console.error('Close requirement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close requirement',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Extend requirement expiry
export const extendRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { days } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const requirement = await ParentRequirement.findOne({
      _id: id,
      parentId: userId,
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found or unauthorized',
      });
    }

    await requirement.extendExpiry(days || 7);

    return res.status(200).json({
      success: true,
      message: 'Requirement extended successfully',
      data: { requirement },
    });
  } catch (error) {
    console.error('Extend requirement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to extend requirement',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get requirements for authenticated parent (their own only)
export const getMyRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const requirements = await ParentRequirement.find({ parentId: userId })
      .sort({ createdAt: -1 });

    const counts = {
      total: requirements.length,
      active: requirements.filter(r => r.status === 'active').length,
      closed: requirements.filter(r => r.status === 'closed').length,
      expired: requirements.filter(r => r.status === 'expired').length,
      paused: requirements.filter(r => r.status === 'paused').length,
    };

    return res.status(200).json({
      success: true,
      data: {
        requirements,
        total: requirements.length,
        counts,
      },
    });
  } catch (error) {
    console.error('Get my requirements error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch requirements',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Delete (soft-delete) a requirement owned by the authenticated parent
export const deleteRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const requirement = await ParentRequirement.findOne({
      _id: id,
      parentId: userId,
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found or unauthorized',
      });
    }

    if (requirement.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an active requirement. Close it first.',
      });
    }

    requirement.isActive = false;
    await requirement.save();

    return res.status(200).json({
      success: true,
      message: 'Requirement deleted successfully',
    });
  } catch (error) {
    console.error('Delete requirement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete requirement',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Helper to generate requirement ID
const generateRequirementId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `REQ-${timestamp}-${random}`.toUpperCase();
};
