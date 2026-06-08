import { Request, Response } from 'express';
import { DemoClass } from '../models/DemoClass';
import { TutorApplication } from '../models/TutorApplication';
import { AuthRequest } from '../middleware/auth';

// Schedule a demo class (Parent workflow)
export const scheduleDemo = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const {
      applicationId,
      teacherId,
      teacherProfileId,
      requirementId,
      studentName,
      grade,
      subject,
      scheduledDate,
      scheduledTime,
      duration,
      mode,
      meetingPlatform,
      meetingLink,
    } = req.body;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Verify application exists and belongs to parent
    const application = await TutorApplication.findOne({
      applicationId,
      parentId,
      status: 'shortlisted',
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or not shortlisted',
      });
    }

    // Create demo class
    const demoClass = new DemoClass({
      parentId,
      teacherId,
      teacherProfileId,
      requirementId,
      applicationId: application._id,
      studentDetails: {
        studentName,
        grade,
        subject,
      },
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration: duration || 60,
      mode: mode || 'online',
      meetingDetails: {
        platform: meetingPlatform || 'zoom',
        meetingLink,
      },
      status: 'scheduled',
    });

    await demoClass.save();

    // Update application to mark demo scheduled
    application.demoScheduled = true;
    application.demoId = demoClass._id;
    await application.save();

    return res.status(201).json({
      success: true,
      message: 'Demo class scheduled successfully',
      data: {
        demoId: demoClass.demoId,
        demoClass,
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

// Get demos for parent (Parent Dashboard)
export const getParentDemos = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { status } = req.query;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const query: any = { parentId, isActive: true };
    if (status) query.status = status;

    const demos = await DemoClass.find(query)
      .populate({
        path: 'teacherProfileId',
        select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects',
      })
      .populate({
        path: 'requirementId',
        select: 'requirementId subjects',
      })
      .sort({ scheduledDate: 1 });

    return res.status(200).json({
      success: true,
      data: {
        demos,
        total: demos.length,
      },
    });
  } catch (error) {
    console.error('Get parent demos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch demos',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get demos for teacher (Teacher Dashboard)
export const getTeacherDemos = async (req: AuthRequest, res: Response) => {
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

    const demos = await DemoClass.find(query)
      .populate({
        path: 'parentId',
        select: 'profile.parentName profile.mobileNumber',
      })
      .populate({
        path: 'requirementId',
        select: 'requirementId studentDetails subjects',
      })
      .sort({ scheduledDate: 1 });

    return res.status(200).json({
      success: true,
      data: {
        demos,
        total: demos.length,
      },
    });
  } catch (error) {
    console.error('Get teacher demos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch demos',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Reschedule demo
export const rescheduleDemo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { demoId } = req.params;
    const { newDate, newTime, reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const demo = await DemoClass.findOne({
      demoId,
      $or: [{ parentId: userId }, { teacherId: userId }],
    });

    if (!demo) {
      return res.status(404).json({
        success: false,
        message: 'Demo not found',
      });
    }

    // Store previous date
    demo.previousDates = demo.previousDates || [];
    demo.previousDates.push({
      date: demo.scheduledDate,
      time: demo.scheduledTime,
      reason: reason || 'Rescheduled',
    });

    // Update to new date/time
    demo.scheduledDate = new Date(newDate);
    demo.scheduledTime = newTime;
    demo.status = 'rescheduled';

    await demo.save();

    return res.status(200).json({
      success: true,
      message: 'Demo rescheduled successfully',
      data: { demo },
    });
  } catch (error) {
    console.error('Reschedule demo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reschedule demo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Cancel demo
export const cancelDemo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { demoId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const demo = await DemoClass.findOne({
      demoId,
      $or: [{ parentId: userId }, { teacherId: userId }],
    });

    if (!demo) {
      return res.status(404).json({
        success: false,
        message: 'Demo not found',
      });
    }

    demo.status = 'cancelled';
    demo.isActive = false;
    demo.nextSteps = reason || 'Cancelled by user';

    await demo.save();

    return res.status(200).json({
      success: true,
      message: 'Demo cancelled successfully',
      data: { demo },
    });
  } catch (error) {
    console.error('Cancel demo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel demo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Complete demo and add feedback
export const completeDemo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { demoId } = req.params;
    const { rating, comment, isInterested } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const demo = await DemoClass.findOne({
      demoId,
      $or: [{ parentId: userId }, { teacherId: userId }],
    });

    if (!demo) {
      return res.status(404).json({
        success: false,
        message: 'Demo not found',
      });
    }

    demo.status = 'completed';

    // Add feedback based on user role
    if (userRole === 'parent' || demo.parentId.toString() === userId.toString()) {
      demo.feedback = {
        ...demo.feedback,
        parentFeedback: {
          rating,
          comment,
          isInterested,
          submittedAt: new Date(),
        },
      };
      demo.outcome = isInterested ? 'interested' : 'not_interested';
    } else {
      demo.feedback = {
        ...demo.feedback,
        teacherFeedback: {
          rating,
          comment,
          isInterested,
          submittedAt: new Date(),
        },
      };
    }

    await demo.save();

    return res.status(200).json({
      success: true,
      message: 'Demo marked as completed',
      data: { demo },
    });
  } catch (error) {
    console.error('Complete demo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete demo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
