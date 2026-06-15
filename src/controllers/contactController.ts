import { Request, Response } from 'express';
import { ContactRequest } from '../models/ContactRequest';
import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';
import { BlockedTime } from '../models/BlockedTime';
import {
  sendNotification,
  notifyContactRequestReceived,
  notifyDemoRequestReceived,
  notifyContactRequestAccepted,
  notifyContactRequestRejected,
  notifyDemoRescheduled,
  notifyDemoCompleted,
  notifyDemoAccepted,
  notifyDemoRejected,
} from '../services/notificationService';

// ─────────────────────────────────────────────
// Helper: Log activity to audit log
// ─────────────────────────────────────────────
async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, any>,
  ipAddress?: string,
) {
  try {
    await AuditLog.create({
      adminId: userId,
      action: action as any,
      entityType: entityType as any,
      entityId,
      newValue: details,
      ipAddress,
    });
  } catch (err) {
    console.error('[ContactController] Audit log error:', err);
  }
}

// ─────────────────────────────────────────────
// POST /api/contact/request
// Create a new contact request (call, whatsapp, message)
// ─────────────────────────────────────────────
export const createContactRequest = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const {
      teacherId,
      teacherProfileId,
      requirementId,
      contactType,
      message,
    } = req.body;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate required fields
    if (!teacherId || !teacherProfileId || !contactType) {
      return res.status(400).json({
        success: false,
        message: 'teacherId, teacherProfileId, and contactType are required',
      });
    }

    // Validate contact type
    if (!['call', 'whatsapp', 'message'].includes(contactType)) {
      return res.status(400).json({
        success: false,
        message: 'contactType must be call, whatsapp, or message',
      });
    }

    // Verify teacher exists
    const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
      });
    }

    // Verify teacher profile exists
    const teacherProfile = await TeacherProfile.findById(teacherProfileId);
    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Verify requirement exists if provided
    if (requirementId) {
      const requirement = await ParentRequirement.findOne({
        _id: requirementId,
        parentId,
      });
      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found',
        });
      }
    }

    // Create contact request
    const contactRequest = new ContactRequest({
      parentId,
      teacherId,
      teacherProfileId,
      requirementId,
      contactType,
      message,
      status: 'pending',
    });

    await contactRequest.save();

    // Send notification to teacher
    await notifyContactRequestReceived(
      teacherId,
      req.user?.profile?.parentName || 'A parent',
      contactType,
      contactRequest._id,
    );

    // Log activity
    await logActivity(
      parentId.toString(),
      'CONTACT_REQUEST_CREATED',
      'ContactRequest',
      contactRequest._id.toString(),
      { contactType, teacherId, requirementId },
      req.ip,
    );

    return res.status(201).json({
      success: true,
      message: 'Contact request sent successfully',
      data: {
        contactRequest,
      },
    });
  } catch (error) {
    console.error('createContactRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create contact request',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// POST /api/contact/demo
// Create a new demo request
// ─────────────────────────────────────────────
export const createDemoRequest = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const {
      teacherId,
      teacherProfileId,
      requirementId,
      demoDate,
      demoTime,
      demoMode,
      demoNotes,
      message,
    } = req.body;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate required fields
    if (!teacherId || !teacherProfileId || !demoDate || !demoTime) {
      return res.status(400).json({
        success: false,
        message: 'teacherId, teacherProfileId, demoDate, and demoTime are required',
      });
    }

    // Verify teacher exists
    const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
      });
    }

    // Verify teacher profile exists
    const teacherProfile = await TeacherProfile.findById(teacherProfileId);
    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Verify requirement exists if provided
    if (requirementId) {
      const requirement = await ParentRequirement.findOne({
        _id: requirementId,
        parentId,
      });
      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'Requirement not found',
        });
      }
    }

    // Create demo request
    const contactRequest = new ContactRequest({
      parentId,
      teacherId,
      teacherProfileId,
      requirementId,
      contactType: 'demo',
      message,
      demoDate: new Date(demoDate),
      demoTime,
      demoMode: demoMode || 'online',
      demoNotes,
      status: 'pending',
    });

    await contactRequest.save();

    // Send notification to teacher
    await notifyDemoRequestReceived(
      teacherId,
      req.user?.profile?.parentName || 'A parent',
      new Date(demoDate),
      contactRequest._id,
    );

    // Log activity
    await logActivity(
      parentId.toString(),
      'DEMO_REQUEST_CREATED',
      'ContactRequest',
      contactRequest._id.toString(),
      { demoDate, demoTime, demoMode, teacherId },
      req.ip,
    );

    return res.status(201).json({
      success: true,
      message: 'Demo request sent successfully',
      data: {
        contactRequest,
      },
    });
  } catch (error) {
    console.error('createDemoRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create demo request',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/contact/history
// Get contact history for parent
// ─────────────────────────────────────────────
export const getParentContactHistory = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { status, contactType, page = 1, limit = 20 } = req.query;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const query: any = { parentId, isActive: true };
    if (status) query.status = status;
    if (contactType) query.contactType = contactType;

    const skip = (Number(page) - 1) * Number(limit);

    const [contactRequests, total] = await Promise.all([
      ContactRequest.find(query)
        .populate({
          path: 'teacherProfileId',
          select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects',
        })
        .populate({
          path: 'requirementId',
          select: 'requirementId subjects studentDetails.grade',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ContactRequest.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        contactRequests,
        total,
        page: Number(page),
        limit: Number(limit),
        hasMore: total > skip + contactRequests.length,
      },
    });
  } catch (error) {
    console.error('getParentContactHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contact history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/contact/teacher-requests
// Get contact requests for teacher (with search, filter, stats)
// ─────────────────────────────────────────────
export const getTeacherContactRequests = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const {
      status,
      contactType,
      page = 1,
      limit = 20,
      search,
      upcoming,
      past,
    } = req.query;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const query: any = { teacherId, isActive: true };
    if (status) query.status = status;
    if (contactType) query.contactType = contactType;

    // Upcoming: demoDate in future
    if (upcoming === 'true') {
      query.demoDate = { $gte: new Date() };
    }
    // Past: demoDate in past
    if (past === 'true') {
      query.demoDate = { $lt: new Date() };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Fetch with population
    let requestsQuery = ContactRequest.find(query)
      .populate({
        path: 'parentId',
        select: 'profile.parentName profile.mobileNumber',
      })
      .populate({
        path: 'requirementId',
        select: 'requirementId subjects studentDetails location',
      })
      .sort({ createdAt: -1 })
      .lean();

    let allRequests = await requestsQuery;

    // Client-side search across populated fields
    if (search) {
      const q = (search as string).toLowerCase();
      allRequests = allRequests.filter((r: any) => {
        const parentName = r.parentId?.profile?.parentName?.toLowerCase() || '';
        const studentName = r.requirementId?.studentDetails?.studentName?.toLowerCase() || '';
        const requirementId = r.requirementId?.requirementId?.toLowerCase() || '';
        const subjects = (r.requirementId?.subjects || []).join(' ').toLowerCase();
        const city = r.requirementId?.location?.city?.toLowerCase() || '';
        return (
          parentName.includes(q) ||
          studentName.includes(q) ||
          requirementId.includes(q) ||
          subjects.includes(q) ||
          city.includes(q)
        );
      });
    }

    const total = allRequests.length;
    const contactRequests = allRequests.slice(skip, skip + Number(limit));

    // Compute summary stats (always from full teacher dataset, not filtered)
    const statsRaw = await ContactRequest.aggregate([
      { $match: { teacherId: teacherId, isActive: true, contactType: 'demo' } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statsMap: Record<string, number> = {};
    for (const s of statsRaw) {
      statsMap[s._id] = s.count;
    }

    const summaryStats = {
      total: Object.values(statsMap).reduce((a: number, b: number) => a + b, 0),
      pending: statsMap['pending'] || 0,
      accepted: statsMap['accepted'] || 0,
      rejected: statsMap['rejected'] || 0,
      completed: statsMap['completed'] || 0,
      rescheduled: statsMap['rescheduled'] || 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        contactRequests,
        total,
        page: Number(page),
        limit: Number(limit),
        hasMore: total > skip + contactRequests.length,
        summaryStats,
      },
    });
  } catch (error) {
    console.error('getTeacherContactRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contact requests',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/contact/:id
// Get single contact request details
// ─────────────────────────────────────────────
export const getContactRequestById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const contactRequest = await ContactRequest.findOne({
      $and: [
        { $or: [{ _id: id }, { contactRequestId: id }] },
        { $or: [{ parentId: userId }, { teacherId: userId }] },
      ],
      isActive: true,
    })
      .populate({
        path: 'teacherProfileId',
        select: 'basicDetails.fullName basicDetails.profilePhoto basicDetails.mobileNumber teachingDetails.subjects',
      })
      .populate({
        path: 'parentId',
        select: 'profile.parentName profile.mobileNumber',
      })
      .populate({
        path: 'requirementId',
        select: 'requirementId subjects studentDetails location',
      });

    if (!contactRequest) {
      return res.status(404).json({
        success: false,
        message: 'Contact request not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { contactRequest },
    });
  } catch (error) {
    console.error('getContactRequestById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contact request',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/contact/:id/status
// Update contact request status (accept/reject)
// ─────────────────────────────────────────────
export const updateContactRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { id } = req.params;
    const { status, responseMessage } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate status
    if (!['accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be accepted, rejected, or completed',
      });
    }

    const { outcome, feedbackNotes } = req.body;

    const contactRequest = await ContactRequest.findOne({
      $or: [{ _id: id }, { contactRequestId: id }],
      isActive: true,
    });

    if (!contactRequest) {
      return res.status(404).json({
        success: false,
        message: 'Contact request not found',
      });
    }

    // Only teacher can accept/reject their own requests, parent can complete
    const isTeacher = userRole === 'teacher' && contactRequest.teacherId.toString() === userId.toString();
    const isParent = contactRequest.parentId.toString() === userId.toString();

    if (!isTeacher && !isParent && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this contact request',
      });
    }

    // Parent can only mark as completed
    if (isParent && !['completed'].includes(status)) {
      return res.status(403).json({
        success: false,
        message: 'Parents can only mark contact requests as completed',
      });
    }

    // Update status
    contactRequest.status = status;
    contactRequest.responseMessage = responseMessage;
    contactRequest.respondedAt = new Date();
    contactRequest.respondedBy = userId;

    // If completing a demo, attach feedback
    if (status === 'completed' && contactRequest.contactType === 'demo') {
      if (outcome && ['interested', 'not_interested', 'need_follow_up'].includes(outcome)) {
        contactRequest.demoFeedback = {
          outcome,
          notes: feedbackNotes || undefined,
          completedAt: new Date(),
        };
      }
    }

    await contactRequest.save();

    // Send notification to parent
    if (status === 'accepted') {
      if (contactRequest.contactType === 'demo') {
        await notifyDemoAccepted(
          contactRequest.parentId,
          contactRequest.demoDate || new Date(),
          contactRequest._id,
        );
      } else {
        await notifyContactRequestAccepted(
          contactRequest.parentId,
          contactRequest.contactType,
          contactRequest._id,
        );
      }
    } else if (status === 'rejected') {
      if (contactRequest.contactType === 'demo') {
        await notifyDemoRejected(
          contactRequest.parentId,
          responseMessage,
          contactRequest._id,
        );
      } else {
        await notifyContactRequestRejected(
          contactRequest.parentId,
          contactRequest.contactType,
          responseMessage,
          contactRequest._id,
        );
      }
    } else if (status === 'completed' && contactRequest.contactType === 'demo') {
      await notifyDemoCompleted(
        contactRequest.parentId,
        outcome || 'completed',
        contactRequest._id,
      );
    }

    // Log activity
    const action = status === 'accepted' ? 'CONTACT_REQUEST_ACCEPTED' :
                   status === 'rejected' ? 'CONTACT_REQUEST_REJECTED' :
                   'CONTACT_REQUEST_COMPLETED';
    await logActivity(
      userId.toString(),
      action,
      'ContactRequest',
      contactRequest._id.toString(),
      { status, responseMessage },
      req.ip,
    );

    return res.status(200).json({
      success: true,
      message: `Contact request ${status} successfully`,
      data: { contactRequest },
    });
  } catch (error) {
    console.error('updateContactRequestStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update contact request status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/contact/demo/:id
// Reschedule demo
// ─────────────────────────────────────────────
export const rescheduleDemoRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { id } = req.params;
    const { newDate, newTime, reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!newDate || !newTime) {
      return res.status(400).json({
        success: false,
        message: 'newDate and newTime are required',
      });
    }

    const contactRequest = await ContactRequest.findOne({
      $or: [{ _id: id }, { contactRequestId: id }],
      contactType: 'demo',
      isActive: true,
    });

    if (!contactRequest) {
      return res.status(404).json({
        success: false,
        message: 'Demo request not found',
      });
    }

    // Only teacher or parent can reschedule
    const isTeacher = userRole === 'teacher' && contactRequest.teacherId.toString() === userId.toString();
    const isParent = contactRequest.parentId.toString() === userId.toString();

    if (!isTeacher && !isParent && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reschedule this demo',
      });
    }

    // Store previous date in history
    if (contactRequest.demoDate && contactRequest.demoTime) {
      contactRequest.rescheduleHistory = contactRequest.rescheduleHistory || [];
      contactRequest.rescheduleHistory.push({
        previousDate: contactRequest.demoDate,
        previousTime: contactRequest.demoTime,
        newDate: new Date(newDate),
        newTime,
        reason: reason || 'Rescheduled',
        rescheduledAt: new Date(),
        rescheduledBy: isTeacher ? 'teacher' : 'parent',
      });
    }

    // Update demo date/time and set status to rescheduled
    contactRequest.demoDate = new Date(newDate);
    contactRequest.demoTime = newTime;
    contactRequest.status = 'rescheduled';

    await contactRequest.save();

    // Send notification
    const notifyUserId = isTeacher ? contactRequest.parentId : contactRequest.teacherId;
    await notifyDemoRescheduled(
      notifyUserId,
      new Date(newDate),
      contactRequest._id,
    );

    // Log activity
    await logActivity(
      userId.toString(),
      'DEMO_RESCHEDULED',
      'ContactRequest',
      contactRequest._id.toString(),
      { newDate, newTime, reason },
      req.ip,
    );

    return res.status(200).json({
      success: true,
      message: 'Demo rescheduled successfully',
      data: { contactRequest },
    });
  } catch (error) {
    console.error('rescheduleDemoRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reschedule demo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/contact/stats
// Get contact request statistics (for analytics)
// ─────────────────────────────────────────────
export const getContactStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    if (!userId || (userRole !== 'admin' && userRole !== 'staff')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const days = parseInt(req.query.days as string) || 30;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalRequests,
      byType,
      byStatus,
      recentRequests,
      demoConversion,
    ] = await Promise.all([
      ContactRequest.countDocuments({ isActive: true }),
      ContactRequest.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$contactType', count: { $sum: 1 } } },
        { $project: { _id: 0, type: '$_id', count: 1 } },
      ]),
      ContactRequest.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      ContactRequest.countDocuments({ createdAt: { $gte: sinceDate }, isActive: true }),
      ContactRequest.aggregate([
        { $match: { contactType: 'demo', isActive: true } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
    ]);

    // Calculate conversion rate
    const demoStats = {
      pending: demoConversion.find((s: any) => s.status === 'pending')?.count || 0,
      accepted: demoConversion.find((s: any) => s.status === 'accepted')?.count || 0,
      rejected: demoConversion.find((s: any) => s.status === 'rejected')?.count || 0,
      completed: demoConversion.find((s: any) => s.status === 'completed')?.count || 0,
    };
    const totalDemos = demoStats.pending + demoStats.accepted + demoStats.rejected + demoStats.completed;
    const conversionRate = totalDemos > 0 ? Math.round((demoStats.completed / totalDemos) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalRequests,
        byType,
        byStatus,
        recentRequests,
        demoStats: {
          ...demoStats,
          total: totalDemos,
          conversionRate,
        },
        periodDays: days,
      },
    });
  } catch (error) {
    console.error('getContactStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contact stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/contact/calendar
// Get teacher's calendar data (demos + blocked time) for date range
// ─────────────────────────────────────────────
export const getTeacherCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Only teachers can view their own calendar (or admin/staff can view any)
    const teacherId = userRole === 'teacher' ? userId : (req.query.teacherId as string || userId);

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Adjust start/end to cover full days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Fetch demos (accepted and rescheduled) within date range
    const demos = await ContactRequest.find({
      teacherId,
      isActive: true,
      contactType: 'demo',
      status: { $in: ['accepted', 'rescheduled'] },
      demoDate: { $gte: startDate, $lte: endDate },
    })
      .populate({
        path: 'parentId',
        select: 'profile.parentName profile.mobileNumber',
      })
      .populate({
        path: 'requirementId',
        select: 'requirementId subjects studentDetails',
      })
      .sort({ demoDate: 1, demoTime: 1 })
      .lean();

    // Fetch blocked time within date range
    const blockedTimes = await BlockedTime.find({
      teacherId,
      isActive: true,
      $or: [
        { date: { $gte: startDate, $lte: endDate } },
        { isRecurring: true, recurringDays: { $exists: true, $not: { $size: 0 } } },
      ],
    }).sort({ date: 1 }).lean();

    // Transform demos into calendar events
    const demoEvents = demos.map((demo: any) => ({
      id: demo._id.toString(),
      type: 'demo',
      title: `Demo - ${demo.requirementId?.subjects?.[0] || 'Subject'}`,
      date: demo.demoDate,
      time: demo.demoTime,
      mode: demo.demoMode,
      status: demo.status,
      studentName: demo.requirementId?.studentDetails?.studentName || 'Student',
      parentName: demo.parentId?.profile?.parentName || 'Parent',
      subjects: demo.requirementId?.subjects || [],
      requirementId: demo.requirementId?.requirementId,
      contactRequestId: demo.contactRequestId,
      meetingLink: demo.meetingLink,
      duration: 60, // Default 60 minutes
      backgroundColor: demo.status === 'accepted' ? '#10B981' : '#8B5CF6',
      borderColor: demo.status === 'accepted' ? '#059669' : '#7C3AED',
    }));

    // Transform blocked times into calendar events
    const blockedEvents = blockedTimes.map((block: any) => ({
      id: block._id.toString(),
      type: 'blocked',
      title: block.reason,
      date: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      isFullDay: block.isFullDay,
      reasonType: block.reasonType,
      blockedTimeId: block.blockedTimeId,
      isRecurring: block.isRecurring,
      recurringDays: block.recurringDays,
      backgroundColor: '#EF4444',
      borderColor: '#DC2626',
    }));

    // Calculate upcoming stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingDemos = demos.filter((d: any) => new Date(d.demoDate) >= today);
    const todayCount = upcomingDemos.filter((d: any) => {
      const dDate = new Date(d.demoDate);
      return dDate >= today && dDate < tomorrow;
    }).length;
    const tomorrowCount = upcomingDemos.filter((d: any) => {
      const dDate = new Date(d.demoDate);
      return dDate >= tomorrow && dDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
    }).length;
    const thisWeekCount = upcomingDemos.filter((d: any) => {
      const dDate = new Date(d.demoDate);
      return dDate >= today && dDate <= weekEnd;
    }).length;

    return res.status(200).json({
      success: true,
      data: {
        events: [...demoEvents, ...blockedEvents],
        demos: demoEvents,
        blockedTimes: blockedEvents,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        stats: {
          today: todayCount,
          tomorrow: tomorrowCount,
          thisWeek: thisWeekCount,
          totalUpcoming: upcomingDemos.length,
          blockedDays: blockedEvents.filter((b: any) => b.isFullDay).length,
        },
      },
    });
  } catch (error) {
    console.error('getTeacherCalendar error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// POST /api/contact/calendar/block
// Block a date/time slot
// ─────────────────────────────────────────────
export const blockTime = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Only teachers can block their own time
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can block time slots',
      });
    }

    const {
      date,
      startTime,
      endTime,
      isFullDay,
      reason,
      reasonType,
      isRecurring,
      recurringDays,
    } = req.body;

    if (!date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'date and reason are required',
      });
    }

    // Check for conflicting demos
    const blockDate = new Date(date);
    const conflictingDemos = await ContactRequest.find({
      teacherId: userId,
      isActive: true,
      contactType: 'demo',
      status: { $in: ['accepted', 'rescheduled'] },
      demoDate: {
        $gte: new Date(blockDate.setHours(0, 0, 0, 0)),
        $lt: new Date(blockDate.setHours(23, 59, 59, 999)),
      },
    });

    // Create blocked time entry
    const blockedTime = new BlockedTime({
      teacherId: userId,
      date: new Date(date),
      startTime,
      endTime,
      isFullDay: isFullDay || false,
      reason,
      reasonType: reasonType || 'other',
      isRecurring: isRecurring || false,
      recurringDays: recurringDays || [],
    });

    await blockedTime.save();

    // Log activity
    await logActivity(
      userId.toString(),
      'TIME_BLOCKED',
      'BlockedTime',
      blockedTime._id.toString(),
      { date, reason, reasonType },
      req.ip,
    );

    return res.status(201).json({
      success: true,
      message: 'Time blocked successfully',
      data: {
        blockedTime,
        conflicts: conflictingDemos.length > 0 ? {
          warning: 'You have scheduled demos on this date',
          demos: conflictingDemos.map(d => ({
            id: d._id,
            time: d.demoTime,
            requirementId: d.requirementId,
          })),
        } : undefined,
      },
    });
  } catch (error) {
    console.error('blockTime error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to block time',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/contact/calendar/block/:id
// Remove a blocked time entry
// ─────────────────────────────────────────────
export const unblockTime = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const blockedTime = await BlockedTime.findOne({
      $or: [{ _id: id }, { blockedTimeId: id }],
      isActive: true,
    });

    if (!blockedTime) {
      return res.status(404).json({
        success: false,
        message: 'Blocked time entry not found',
      });
    }

    // Only the teacher who created it or admin can unblock
    if (blockedTime.teacherId.toString() !== userId.toString() && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to unblock this time',
      });
    }

    // Soft delete
    blockedTime.isActive = false;
    await blockedTime.save();

    // Log activity
    await logActivity(
      userId.toString(),
      'TIME_UNBLOCKED',
      'BlockedTime',
      blockedTime._id.toString(),
      { date: blockedTime.date, reason: blockedTime.reason },
      req.ip,
    );

    return res.status(200).json({
      success: true,
      message: 'Time unblocked successfully',
    });
  } catch (error) {
    console.error('unblockTime error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unblock time',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/contact/calendar/conflicts
// Check for availability conflicts
// ─────────────────────────────────────────────
export const checkAvailabilityConflicts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { date, startTime, endTime, excludeDemoId } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'date is required',
      });
    }

    const checkDate = new Date(date as string);
    const dayStart = new Date(checkDate.setHours(0, 0, 0, 0));
    const dayEnd = new Date(checkDate.setHours(23, 59, 59, 999));

    // Find demos on this date
    const query: any = {
      teacherId: userId,
      isActive: true,
      contactType: 'demo',
      status: { $in: ['accepted', 'rescheduled'] },
      demoDate: { $gte: dayStart, $lte: dayEnd },
    };

    if (excludeDemoId) {
      query.$nor = [{ _id: excludeDemoId }, { contactRequestId: excludeDemoId }];
    }

    const demos = await ContactRequest.find(query)
      .populate('requirementId', 'subjects studentDetails')
      .lean();

    // Find blocked times on this date
    const blockedTimes = await BlockedTime.find({
      teacherId: userId,
      isActive: true,
      date: { $gte: dayStart, $lte: dayEnd },
    }).lean();

    // If specific time range provided, check for overlaps
    let conflicts: any[] = [];
    if (startTime && endTime) {
      const [checkStartHour, checkStartMin] = (startTime as string).split(':').map(Number);
      const [checkEndHour, checkEndMin] = (endTime as string).split(':').map(Number);
      const checkStartMinTotal = checkStartHour * 60 + checkStartMin;
      const checkEndMinTotal = checkEndHour * 60 + checkEndMin;

      // Check demo overlaps
      demos.forEach((demo: any) => {
        if (demo.demoTime) {
          const [demoHour, demoMin] = demo.demoTime.split(':').map(Number);
          const demoStartMin = demoHour * 60 + demoMin;
          const demoEndMin = demoStartMin + 60; // Assume 60 min duration

          // Check overlap
          if (checkStartMinTotal < demoEndMin && checkEndMinTotal > demoStartMin) {
            conflicts.push({
              type: 'demo',
              id: demo._id,
              contactRequestId: demo.contactRequestId,
              time: demo.demoTime,
              subject: demo.requirementId?.subjects?.[0],
              studentName: demo.requirementId?.studentDetails?.studentName,
              overlapMinutes: Math.min(checkEndMinTotal, demoEndMin) - Math.max(checkStartMinTotal, demoStartMin),
            });
          }
        }
      });

      // Check blocked time overlaps
      blockedTimes.forEach((block: any) => {
        if (block.isFullDay) {
          conflicts.push({
            type: 'blocked',
            id: block._id,
            blockedTimeId: block.blockedTimeId,
            reason: block.reason,
            isFullDay: true,
          });
        } else if (block.startTime && block.endTime) {
          const [blockStartHour, blockStartMin] = block.startTime.split(':').map(Number);
          const [blockEndHour, blockEndMin] = block.endTime.split(':').map(Number);
          const blockStartMinTotal = blockStartHour * 60 + blockStartMin;
          const blockEndMinTotal = blockEndHour * 60 + blockEndMin;

          if (checkStartMinTotal < blockEndMinTotal && checkEndMinTotal > blockStartMinTotal) {
            conflicts.push({
              type: 'blocked',
              id: block._id,
              blockedTimeId: block.blockedTimeId,
              reason: block.reason,
              startTime: block.startTime,
              endTime: block.endTime,
              overlapMinutes: Math.min(checkEndMinTotal, blockEndMinTotal) - Math.max(checkStartMinTotal, blockStartMinTotal),
            });
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        date: date as string,
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length,
        conflicts,
        demosOnDate: demos.map(d => ({
          id: d._id,
          time: d.demoTime,
          subject: (d.requirementId as any)?.subjects?.[0],
        })),
        blockedTimesOnDate: blockedTimes.map(b => ({
          id: b._id,
          isFullDay: b.isFullDay,
          startTime: b.startTime,
          endTime: b.endTime,
          reason: b.reason,
        })),
      },
    });
  } catch (error) {
    console.error('checkAvailabilityConflicts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check conflicts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
