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
  notifyApplicationViewed,
  notifyApplicationRejected,
  notifyTeacherSelected,
  notifyTeacherHired,
  notifyRequirementClosed,
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

    if (!['published', 'receiving_applications', 'shortlisted'].includes(requirement.status)) {
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

    // Check if already applied (any status except rejected/withdrawn)
    const existingApplication = await TutorApplication.findOne({
      parentRequirementId: requirementId,
      teacherId,
      status: { $nin: ['rejected', 'withdrawn'] },
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this requirement',
        data: { applicationId: existingApplication.applicationId },
      });
    }

    // Check if requirement is accepting applications
    if (!['published', 'receiving_applications', 'shortlisted'].includes(requirement.status)) {
      return res.status(400).json({
        success: false,
        message: 'This requirement is no longer accepting applications',
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

    // Increment applications count on requirement
    await ParentRequirement.findByIdAndUpdate(requirementId, {
      $inc: { applicationsCount: 1 },
    });

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

    // Increment shortlisted count on requirement
    await ParentRequirement.findByIdAndUpdate(application.parentRequirementId, {
      $inc: { shortlistedCount: 1 },
    });

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

    // Notify teacher
    notifyApplicationRejected(
      application.teacherId,
      application._id,
      reason,
    ).catch(() => {});

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

// Note: Old acceptApplication endpoint removed - use hiring workflow instead:
// shortlistApplication -> selectTeacher -> hireTeacher

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

    if (['hired', 'selected'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw a hired or selected application',
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
      ParentRequirement.countDocuments({
        parentId,
        status: { $in: ['published', 'receiving_applications', 'shortlisted', 'demo_scheduled'] },
      }),
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

// Get single application by ID (Parent or Teacher workflow)
export const getApplicationById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { applicationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Build query based on user role
    const query: any = { applicationId };
    if (userRole === 'parent' || userRole === 'admin') {
      query.parentId = userId;
    } else if (userRole === 'teacher') {
      query.teacherId = userId;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    // Different population based on role
    let populateOptions: any[] = [
      {
        path: 'parentRequirementId',
        select: 'requirementId studentDetails subjects budget tuitionType location schedule board preferredGender preferredLanguages additionalNotes',
      },
    ];

    // Teachers see parent info, parents see teacher info
    if (userRole === 'teacher') {
      populateOptions.push({
        path: 'parentId',
        select: 'profile.parentName profile.mobileNumber email',
      });
    } else {
      populateOptions.push({
        path: 'teacherProfileId',
        select: 'basicDetails.fullName basicDetails.profilePhoto basicDetails.bio basicDetails.languages teachingDetails.subjects teachingDetails.classes teachingDetails.teachingModes education.highestQualification education.institutions pricingRevenue.hourlyRate pricingRevenue.experienceYears stats.averageRating stats.totalReviews verificationStatus',
      });
    }

    // Also populate demo details if scheduled
    populateOptions.push({
      path: 'demoId',
      select: 'demoId scheduledDate scheduledTime duration mode status meetingDetails feedback',
    });

    const application = await TutorApplication.findOne(query)
      .populate(populateOptions[0])
      .populate(populateOptions[1])
      .populate(populateOptions[2]);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    // Mark as viewed by parent if not already (only for parent workflow)
    if ((userRole === 'parent' || userRole === 'admin') && !application.viewedByParent) {
      application.viewedByParent = true;
      application.viewedAt = new Date();
      await application.save();
    }

    return res.status(200).json({
      success: true,
      data: { application },
    });
  } catch (error) {
    console.error('Get application by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch application',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Schedule demo for an application (Parent workflow)
export const scheduleDemo = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { applicationId } = req.params;
    const { scheduledDate, scheduledTime, duration, mode, notes } = req.body;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Date and time are required',
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

    if (application.status === 'rejected' || application.status === 'withdrawn') {
      return res.status(400).json({
        success: false,
        message: 'Cannot schedule demo for rejected or withdrawn application',
      });
    }

    // Import DemoClass model
    const { DemoClass } = await import('../models/DemoClass');

    // Create demo class
    const demoClass = new DemoClass({
      parentId: application.parentId,
      teacherId: application.teacherId,
      teacherProfileId: application.teacherProfileId,
      requirementId: application.parentRequirementId,
      applicationId: application._id,
      scheduledDate,
      scheduledTime,
      duration: duration || 60,
      mode: mode || 'online',
      notes,
      status: 'scheduled',
    });

    await demoClass.save();

    // Update application
    application.demoScheduled = true;
    application.demoId = demoClass._id as any;
    await application.save();

    return res.status(201).json({
      success: true,
      message: 'Demo scheduled successfully',
      data: {
        demoId: demoClass.demoId,
        demoClass,
        application,
      },
    });
  } catch (error) {
    console.error('Schedule demo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to schedule demo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// NEW HIRING WORKFLOW ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/requirements/:id/applications - Get applications for a requirement
export const getRequirementApplications = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const userRole = req.user?.role;
    const { id: requirementId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Verify requirement ownership
    const requirement = await ParentRequirement.findById(requirementId);
    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found' });
    }

    // Only parent who owns requirement or admin can view applications
    if (requirement.parentId.toString() !== parentId.toString() && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view these applications' });
    }

    // Build query
    const query: any = { parentRequirementId: requirementId, isActive: true };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [applications, total] = await Promise.all([
      TutorApplication.find(query)
        .populate({
          path: 'teacherProfileId',
          select: 'basicDetails.fullName basicDetails.profilePhoto basicDetails.mobileNumber basicDetails.email teachingDetails.subjects teachingDetails.classes teachingDetails.teachingModes education.highestQualification pricingRevenue.hourlyRate pricingRevenue.monthlyRate pricingRevenue.experienceYears stats.averageRating stats.totalReviews stats.totalStudents verificationStatus',
        })
        .populate({
          path: 'demoId',
          select: 'demoDate demoTime demoMode status demoFeedback',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      TutorApplication.countDocuments(query),
    ]);

    // Get status breakdown
    const statusBreakdown = await TutorApplication.aggregate([
      { $match: { parentRequirementId: requirement._id, isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        applications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          hasMore: total > skip + applications.length,
        },
        statusBreakdown,
        requirement: {
          _id: requirement._id,
          requirementId: requirement.requirementId,
          studentDetails: requirement.studentDetails,
          subjects: requirement.subjects,
          status: requirement.status,
        },
      },
    });
  } catch (error) {
    console.error('Get requirement applications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// POST /api/applications/:id/view - Mark application as viewed
export const viewApplication = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { id: applicationId } = req.params;

    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const application = await TutorApplication.findOne({
      _id: applicationId,
      parentId,
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    await application.markAsViewed();

    // Notify teacher
    notifyApplicationViewed(
      application.teacherId,
      application._id,
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Application marked as viewed',
      data: { application },
    });
  } catch (error) {
    console.error('View application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to view application',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// POST /api/applications/:id/select - Select teacher for requirement
export const selectTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { id: applicationId } = req.params;
    const { reason } = req.body;

    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const application = await TutorApplication.findOne({
      _id: applicationId,
      parentId,
    }).populate('teacherProfileId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Can only select from shortlisted or demo_completed status
    if (!['shortlisted', 'demo_completed'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot select teacher from ${application.status} status. Must be shortlisted or demo completed.`,
      });
    }

    // Mark application as selected
    await application.markAsSelected(reason);

    // Update requirement
    const requirement = await ParentRequirement.findById(application.parentRequirementId);
    if (requirement) {
      requirement.hiredTeacherId = application.teacherId;
      requirement.hiredTeacherProfileId = application.teacherProfileId?._id || application.teacherProfileId;
      requirement.hireReason = reason;
      await requirement.save();
    }

    // Notify teacher
    notifyTeacherSelected(
      application.teacherId,
      requirement?.subjects?.[0] || 'your subject',
      application._id,
    ).catch(() => {});

    // Reject all other active applications for this requirement
    await TutorApplication.updateMany(
      {
        parentRequirementId: application.parentRequirementId,
        _id: { $ne: application._id },
        status: { $in: ['pending', 'viewed', 'shortlisted', 'demo_scheduled'] },
      },
      {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: 'Another teacher was selected for this requirement',
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Teacher selected successfully',
      data: { application, requirement },
    });
  } catch (error) {
    console.error('Select teacher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to select teacher',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// POST /api/applications/:id/hire - Hire teacher (finalize)
export const hireTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { id: applicationId } = req.params;
    const { notes, startDate } = req.body;

    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const application = await TutorApplication.findOne({
      _id: applicationId,
      parentId,
    }).populate('teacherProfileId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Can only hire from selected status
    if (application.status !== 'selected') {
      return res.status(400).json({
        success: false,
        message: `Cannot hire from ${application.status} status. Teacher must be selected first.`,
      });
    }

    // Mark application as hired
    await application.markAsHired(notes);

    // Update requirement to hired status and close it
    const requirement = await ParentRequirement.findById(application.parentRequirementId);
    if (requirement) {
      requirement.hiredAt = new Date();
      requirement.hiredTeacherId = application.teacherId;
      requirement.hiredTeacherProfileId = application.teacherProfileId?._id || application.teacherProfileId;
      requirement.status = 'hired';
      requirement.isActive = false;
      requirement.closedReason = 'Teacher hired successfully';
      requirement.closedAt = new Date();
      await requirement.save();
    }

    // Create hired relationship/scheduled class
    const { ScheduledClass } = await import('../models/ScheduledClass');
    if (requirement) {
      const scheduledClass = new ScheduledClass({
        parentId: application.parentId,
        teacherId: application.teacherId,
        teacherProfileId: application.teacherProfileId,
        requirementId: application.parentRequirementId,
        applicationId: application._id,
        subject: requirement.subjects[0],
        grade: requirement.studentDetails.grade,
        schedule: {
          daysPerWeek: parseInt(requirement.schedule.daysPerWeek) || 3,
          days: requirement.schedule.preferredTimings.slice(0, 3),
          timeSlot: requirement.schedule.preferredTimings[0] || 'Evening',
          startDate: startDate ? new Date(startDate) : new Date(),
        },
        fee: {
          amount: application.proposedFee || requirement.budget.maxAmount,
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
    }

    // Update teacher stats
    await TeacherProfile.findByIdAndUpdate(application.teacherProfileId, {
      $inc: {
        'stats.activeStudents': 1,
        'stats.totalStudents': 1,
      },
    });

    // Notify teacher
    notifyTeacherHired(
      application.teacherId,
      requirement?.subjects?.[0] || 'your subject',
      requirement?.studentDetails?.studentName || 'Student',
      application._id,
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Teacher hired successfully. Requirement closed.',
      data: { application, requirement },
    });
  } catch (error) {
    console.error('Hire teacher error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to hire teacher',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// POST /api/requirements/:id/close - Close requirement
export const closeRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const userRole = req.user?.role;
    const { id: requirementId } = req.params;
    const { reason } = req.body;

    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const requirement = await ParentRequirement.findById(requirementId);
    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found' });
    }

    // Only parent who owns requirement or admin can close
    if (requirement.parentId.toString() !== parentId.toString() && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to close this requirement' });
    }

    // Cannot close already hired requirements
    if (requirement.status === 'hired') {
      return res.status(400).json({ success: false, message: 'Cannot close an already hired requirement' });
    }

    requirement.status = 'closed';
    requirement.isActive = false;
    requirement.closedReason = reason || 'Closed by parent';
    requirement.closedAt = new Date();
    await requirement.save();

    // Reject all pending applications
    await TutorApplication.updateMany(
      {
        parentRequirementId: requirementId,
        status: { $in: ['pending', 'viewed', 'shortlisted', 'demo_scheduled', 'demo_completed', 'selected'] },
      },
      {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: 'Requirement was closed by parent',
      }
    );

    // Notify all applicants
    const applications = await TutorApplication.find({
      parentRequirementId: requirementId,
      isActive: true,
    });

    for (const app of applications) {
      notifyRequirementClosed(
        app.teacherId,
        requirement.requirementId,
        reason || 'Requirement closed by parent',
      ).catch(() => {});
    }

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
