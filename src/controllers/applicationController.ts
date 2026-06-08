import { Request, Response } from 'express';
import { TutorApplication } from '../models/TutorApplication';
import { ParentRequirement } from '../models/ParentRequirement';
import { TeacherProfile } from '../models/TeacherProfile';
import { TutorMatch } from '../models/TutorMatch';
import { ScheduledClass } from '../models/ScheduledClass';
import { MatchingService } from '../services/MatchingService';
import { AuthRequest } from '../middleware/auth';
import {
  notifyTeacherApplied,
  notifyApplicationShortlisted,
} from '../services/notificationService';

// Apply to a requirement (Teacher workflow)
export const applyToRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const { requirementId } = req.params;
    const { message, proposedFee, proposedSchedule } = req.body;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get requirement details
    const requirement = await ParentRequirement.findById(requirementId);
    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found',
      });
    }

    if (requirement.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This requirement is no longer active',
      });
    }

    // Get teacher profile
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId });
    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Check if already applied
    const existingApplication = await TutorApplication.findOne({
      parentRequirementId: requirementId,
      teacherId,
      isActive: true,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this requirement',
        data: { applicationId: existingApplication.applicationId },
      });
    }

    // Create application
    const application = new TutorApplication({
      parentRequirementId: requirementId,
      teacherId,
      teacherProfileId: teacherProfile._id,
      parentId: requirement.parentId,
      status: 'pending',
      message,
      proposedFee,
      proposedSchedule,
      viewedByParent: false,
    });

    await application.save();

    // Update match status if exists
    await TutorMatch.findOneAndUpdate(
      { requirementId, teacherId },
      { status: 'applied', appliedAt: new Date() }
    );

    // Notify parent
    notifyTeacherApplied(
      requirement.parentId,
      teacherProfile.basicDetails.fullName,
      requirement.subjects?.[0] || 'your subject',
      application._id,
    ).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application.applicationId,
        application,
      },
    });
  } catch (error) {
    console.error('Apply to requirement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get applications for a parent (Parent Dashboard)
export const getParentApplications = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { status, requirementId } = req.query;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Build query
    const query: any = { parentId, isActive: true };
    if (status) query.status = status;
    if (requirementId) query.parentRequirementId = requirementId;

    const applications = await TutorApplication.find(query)
      .populate({
        path: 'teacherProfileId',
        select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects teachingDetails.classes pricingRevenue.hourlyRate stats.averageRating education.highestQualification',
      })
      .populate({
        path: 'parentRequirementId',
        select: 'requirementId studentDetails subjects',
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        applications,
        total: applications.length,
      },
    });
  } catch (error) {
    console.error('Get parent applications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get applications sent by teacher (Teacher Dashboard)
export const getTeacherApplications = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const { status } = req.query;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const query: any = { teacherId, isActive: true };
    if (status) query.status = status;

    const applications = await TutorApplication.find(query)
      .populate({
        path: 'parentRequirementId',
        select: 'requirementId studentDetails grade subjects budget location schedule tuitionType status',
      })
      .populate({
        path: 'parentId',
        select: 'profile.parentName profile.mobileNumber',
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        applications,
        total: applications.length,
      },
    });
  } catch (error) {
    console.error('Get teacher applications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Shortlist an application (Parent workflow)
export const shortlistApplication = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { applicationId } = req.params;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const application = await TutorApplication.findOne({
      applicationId,
      parentId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    application.status = 'shortlisted';
    application.shortlistedAt = new Date();
    await application.save();

    // Update match status
    await TutorMatch.findOneAndUpdate(
      { requirementId: application.parentRequirementId, teacherId: application.teacherId },
      { status: 'shortlisted', shortlistedAt: new Date() }
    );

    // Notify teacher
    notifyApplicationShortlisted(
      application.teacherId,
      'your subject',
      application._id,
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Application shortlisted successfully',
      data: { application },
    });
  } catch (error) {
    console.error('Shortlist application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to shortlist application',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Reject an application (Parent workflow)
export const rejectApplication = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { applicationId } = req.params;
    const { reason } = req.body;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const application = await TutorApplication.findOne({
      applicationId,
      parentId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    application.status = 'rejected';
    application.rejectedAt = new Date();
    application.rejectionReason = reason;
    await application.save();

    // Update match status
    await TutorMatch.findOneAndUpdate(
      { requirementId: application.parentRequirementId, teacherId: application.teacherId },
      { status: 'rejected', rejectedAt: new Date() }
    );

    return res.status(200).json({
      success: true,
      message: 'Application rejected',
      data: { application },
    });
  } catch (error) {
    console.error('Reject application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject application',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Accept an application and create scheduled class (Parent workflow)
export const acceptApplication = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { applicationId } = req.params;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const application = await TutorApplication.findOne({
      applicationId,
      parentId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    application.status = 'accepted';
    application.acceptedAt = new Date();
    await application.save();

    // Update match status
    await TutorMatch.findOneAndUpdate(
      { requirementId: application.parentRequirementId, teacherId: application.teacherId },
      { status: 'hired', hiredAt: new Date() }
    );

    // Get requirement details for ScheduledClass creation
    const requirement = await ParentRequirement.findById(application.parentRequirementId);
    const teacherProfile = await TeacherProfile.findById(application.teacherProfileId);

    if (requirement && teacherProfile) {
      // Create ScheduledClass
      const scheduledClass = new ScheduledClass({
        parentId: application.parentId,
        teacherId: application.teacherId,
        teacherProfileId: application.teacherProfileId,
        requirementId: application.parentRequirementId,
        applicationId: application._id,
        subject: requirement.subjects[0], // Primary subject
        grade: requirement.studentDetails.grade,
        schedule: {
          daysPerWeek: parseInt(requirement.schedule.daysPerWeek) || 3,
          days: requirement.schedule.preferredTimings.slice(0, 3), // First 3 preferred days
          timeSlot: requirement.schedule.preferredTimings[0] || 'Evening',
          startDate: new Date(),
        },
        fee: {
          amount: application.proposedFee || requirement.budget.maxAmount || teacherProfile.pricingRevenue.hourlyRate,
          currency: 'INR',
          billingCycle: 'monthly',
          paymentStatus: 'pending',
        },
        mode: requirement.tuitionType === 'home' ? 'home' : requirement.tuitionType === 'online' ? 'online' : 'home',
        location: {
          address: requirement.location.address,
          city: requirement.location.city,
          pincode: requirement.location.pincode,
          coordinates: requirement.location.coordinates,
        },
        status: 'active',
      });

      await scheduledClass.save();

      // Update TeacherProfile statistics
      await TeacherProfile.findByIdAndUpdate(application.teacherProfileId, {
        $inc: {
          'stats.activeStudents': 1,
          'stats.totalStudents': 1,
        },
      });

      // Update ParentRequirement status
      await ParentRequirement.findByIdAndUpdate(application.parentRequirementId, {
        status: 'closed',
        isActive: false,
      });

      // Expire all competing matches so other teachers stop seeing this lead
      await MatchingService.expireCompetingMatches(
        application.parentRequirementId as any,
        application.teacherId as any
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Application accepted. Tutor assigned successfully.',
      data: {
        application,
        scheduledClass: requirement ? {
          classId: requirement.subjects[0] + '-' + requirement.studentDetails.grade,
          subject: requirement.subjects[0],
          grade: requirement.studentDetails.grade,
        } : null,
      },
    });
  } catch (error) {
    console.error('Accept application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept application',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Withdraw application (Teacher workflow)
export const withdrawApplication = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const { applicationId } = req.params;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const application = await TutorApplication.findOne({
      applicationId,
      teacherId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    if (application.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw an accepted application',
      });
    }

    application.status = 'withdrawn';
    application.isActive = false;
    await application.save();

    // Reset the TutorMatch so teacher can re-apply if they wish
    await MatchingService.resetMatchOnWithdrawal(
      application.parentRequirementId as any,
      application.teacherId as any
    );

    return res.status(200).json({
      success: true,
      message: 'Application withdrawn successfully',
    });
  } catch (error) {
    console.error('Withdraw application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to withdraw application',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get dashboard stats for parent
export const getParentDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const [
      activeRequirements,
      applicationsReceived,
      shortlistedTutors,
      upcomingDemos,
    ] = await Promise.all([
      ParentRequirement.countDocuments({ parentId, status: 'active' }),
      TutorApplication.countDocuments({ parentId, isActive: true }),
      TutorApplication.countDocuments({ parentId, status: 'shortlisted' }),
      // DemoClass count will be added when model is imported
      Promise.resolve(0),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeRequirements,
        applicationsReceived,
        shortlistedTutors,
        demosScheduled: upcomingDemos,
      },
    });
  } catch (error) {
    console.error('Get parent dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get dashboard stats for teacher
export const getTeacherDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId });

    const [
      matchingRequirements,
      applicationsSent,
      activeStudents,
    ] = await Promise.all([
      TutorMatch.countDocuments({ teacherId, status: 'recommended' }),
      TutorApplication.countDocuments({ teacherId, isActive: true }),
      // ScheduledClass count will be added
      Promise.resolve(teacherProfile?.stats.activeStudents || 0),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeStudents,
        tuitionRequestsAvailable: matchingRequirements,
        applicationsSent,
        monthlyEarnings: teacherProfile?.stats.totalEarnings || 0,
        profileCompletion: calculateProfileCompletion(teacherProfile),
        verificationStatus: teacherProfile?.verificationStatus || 'pending',
      },
    });
  } catch (error) {
    console.error('Get teacher dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Helper function to calculate profile completion
function calculateProfileCompletion(profile: any): number {
  if (!profile) return 0;

  const requiredFields = [
    'basicDetails.fullName',
    'basicDetails.mobileNumber',
    'basicDetails.email',
    'education.highestQualification',
    'teachingDetails.subjects',
    'teachingDetails.classes',
    'locationAvailability.city',
    'pricingRevenue.hourlyRate',
    'verificationDocuments.aadhaarCard',
  ];

  let filled = 0;
  for (const field of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], profile);
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      filled++;
    }
  }

  return Math.round((filled / requiredFields.length) * 100);
}
