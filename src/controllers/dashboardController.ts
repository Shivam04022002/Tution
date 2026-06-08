import { Request, Response } from 'express';
import { ParentRequirement } from '../models/ParentRequirement';
import { TutorApplication } from '../models/TutorApplication';
import { TeacherProfile } from '../models/TeacherProfile';
import { TutorMatch } from '../models/TutorMatch';
import { DemoClass } from '../models/DemoClass';
import { Shortlist } from '../models/Shortlist';
import { ScheduledClass } from '../models/ScheduledClass';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

// Parent Dashboard - Aggregated data
export const getParentDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Fetch all data in parallel
    const [
      activeRequirements,
      applications,
      shortlistedTutors,
      upcomingDemos,
      stats,
      recommendedTutors,
      notificationsCount,
    ] = await Promise.all([
      // Active requirements
      ParentRequirement.find({
        parentId,
        status: 'active',
        isActive: true,
      }).sort({ createdAt: -1 }),

      // Applications received
      TutorApplication.find({
        parentId,
        isActive: true,
      })
        .populate({
          path: 'teacherProfileId',
          select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects pricingRevenue.hourlyRate stats.averageRating',
        })
        .populate({
          path: 'parentRequirementId',
          select: 'requirementId studentDetails subjects',
        })
        .sort({ createdAt: -1 }),

      // Shortlisted tutors
      Shortlist.find({
        parentId,
        isDeleted: false,
      })
        .populate({
          path: 'teacherProfileId',
          select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects pricingRevenue.hourlyRate',
        })
        .sort({ createdAt: -1 }),

      // Upcoming demos
      DemoClass.find({
        parentId,
        status: { $in: ['scheduled', 'rescheduled'] },
        scheduledDate: { $gte: new Date() },
        isActive: true,
      })
        .populate({
          path: 'teacherProfileId',
          select: 'basicDetails.fullName basicDetails.profilePhoto',
        })
        .sort({ scheduledDate: 1 }),

      // Stats aggregation
      getParentStats(parentId),

      // Recommended tutors from TutorMatch (top matches for this parent's active requirements)
      TutorMatch.find({
        parentId,
        status: 'recommended',
        isActive: true,
        expiryDate: { $gte: new Date() },
      })
        .populate({
          path: 'teacherId',
          select: 'profile.teacherName',
        })
        .populate({
          path: 'teacherProfileId',
          select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects pricingRevenue.experienceYears stats.averageRating locationAvailability.city locationAvailability.coordinates',
        })
        .sort({ overallScore: -1 })
        .limit(10),

      // Unread notifications count
      Notification.countDocuments({
        userId: parentId,
        isRead: false,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        stats,
        activeRequirements,
        applications,
        shortlistedTutors,
        upcomingDemos,
        recommendedTutors,
        notificationsCount,
      },
    });
  } catch (error) {
    console.error('Get parent dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Teacher Dashboard - Aggregated data
export const getTeacherDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get teacher profile for stats
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId });

    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Fetch all data in parallel
    const [
      matches,
      applications,
      upcomingDemos,
      activeStudents,
    ] = await Promise.all([
      // Matching requirements
      TutorMatch.find({
        teacherId,
        status: 'recommended',
        isActive: true,
        expiryDate: { $gte: new Date() },
      })
        .populate({
          path: 'requirementId',
          select: 'requirementId studentDetails subjects budget location schedule tuitionType',
        })
        .sort({ overallScore: -1 })
        .limit(10),

      // Applications sent
      TutorApplication.find({
        teacherId,
        isActive: true,
      })
        .populate({
          path: 'parentRequirementId',
          select: 'requirementId studentDetails subjects budget',
        })
        .populate({
          path: 'parentId',
          select: 'profile.parentName profile.mobileNumber',
        })
        .sort({ createdAt: -1 }),

      // Upcoming demos
      DemoClass.find({
        teacherId,
        status: { $in: ['scheduled', 'rescheduled'] },
        scheduledDate: { $gte: new Date() },
        isActive: true,
      })
        .populate({
          path: 'parentId',
          select: 'profile.parentName profile.mobileNumber',
        })
        .sort({ scheduledDate: 1 }),

      // Active students (from ScheduledClass)
      ScheduledClass.find({
        teacherId,
        status: 'active',
      })
        .populate({
          path: 'parentId',
          select: 'profile.parentName',
        })
        .sort({ 'schedule.startDate': -1 }),
    ]);

    // Calculate real profile completion
    const profileCompletion = calculateTeacherProfileCompletion(teacherProfile);

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          activeStudents: teacherProfile.stats?.activeStudents || 0,
          totalStudents: teacherProfile.stats?.totalStudents || 0,
          totalEarnings: teacherProfile.stats?.totalEarnings || 0,
          averageRating: teacherProfile.stats?.averageRating || 0,
          profileCompletion,
          verificationStatus: teacherProfile.verificationStatus || 'pending',
          tuitionRequestsAvailable: matches.length,
          applicationsSent: applications.length,
        },
        matches,
        applications,
        upcomingDemos,
        activeStudents,
      },
    });
  } catch (error) {
    console.error('Get teacher dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Helper: Calculate parent stats
async function getParentStats(parentId: any) {
  const [
    activeRequirementsCount,
    applicationsCount,
    shortlistedCount,
    upcomingDemosCount,
    closedRequirementsCount,
  ] = await Promise.all([
    ParentRequirement.countDocuments({
      parentId,
      status: 'active',
      isActive: true,
    }),
    TutorApplication.countDocuments({
      parentId,
      isActive: true,
    }),
    Shortlist.countDocuments({
      parentId,
      isDeleted: false,
    }),
    DemoClass.countDocuments({
      parentId,
      status: { $in: ['scheduled', 'rescheduled'] },
      scheduledDate: { $gte: new Date() },
      isActive: true,
    }),
    ParentRequirement.countDocuments({
      parentId,
      status: 'closed',
    }),
  ]);

  return {
    activeRequirements: activeRequirementsCount,
    applicationsReceived: applicationsCount,
    shortlistedTutors: shortlistedCount,
    demosScheduled: upcomingDemosCount,
    closedRequirements: closedRequirementsCount,
  };
}

// Helper: Calculate teacher profile completion percentage
function calculateTeacherProfileCompletion(profile: any): number {
  if (!profile) return 0;

  const requiredFields = [
    { path: 'basicDetails.fullName', weight: 10 },
    { path: 'basicDetails.mobileNumber', weight: 10 },
    { path: 'basicDetails.email', weight: 5 },
    { path: 'basicDetails.profilePhoto', weight: 5 },
    { path: 'education.highestQualification', weight: 10 },
    { path: 'education.degree', weight: 5 },
    { path: 'teachingDetails.subjects', weight: 10, isArray: true },
    { path: 'teachingDetails.classes', weight: 10, isArray: true },
    { path: 'teachingDetails.boards', weight: 5, isArray: true },
    { path: 'locationAvailability.city', weight: 10 },
    { path: 'locationAvailability.address', weight: 5 },
    { path: 'pricingRevenue.hourlyRate', weight: 10 },
    { path: 'bio', weight: 5 },
    { path: 'verificationDocuments.aadhaarCard', weight: 10 },
    { path: 'verificationDocuments.panCard', weight: 5 },
  ];

  let filledWeight = 0;
  let totalWeight = 0;

  for (const field of requiredFields) {
    totalWeight += field.weight;
    const value = field.path.split('.').reduce((obj, key) => obj?.[key], profile);
    
    if (field.isArray) {
      if (value && Array.isArray(value) && value.length > 0) {
        filledWeight += field.weight;
      }
    } else {
      if (value && value !== '') {
        filledWeight += field.weight;
      }
    }
  }

  return Math.round((filledWeight / totalWeight) * 100);
}
