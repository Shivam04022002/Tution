import { Response } from 'express';
import mongoose from 'mongoose';
import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import Ticket from '../models/Ticket';
import { AuthRequest } from '../middleware/auth';

// ─────────────────────────────────────────────
// GET /api/staff/dashboard
// Returns: pendingVerifications, openTickets, activeLeads, resolvedToday
// ─────────────────────────────────────────────
export const getStaffDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      pendingVerifications,
      openTickets,
      activeLeads,
      resolvedToday,
      urgentTickets,
    ] = await Promise.all([
      TeacherProfile.countDocuments({ verificationStatus: 'pending' }),
      Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      ParentRequirement.countDocuments({ status: 'active' as any, isActive: true }),
      Ticket.countDocuments({
        status: 'resolved',
        resolvedAt: { $gte: todayStart },
      }),
      Ticket.countDocuments({ priority: 'urgent', status: { $in: ['open', 'in_progress'] } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pendingVerifications,
        openTickets,
        activeLeads,
        resolvedToday,
        urgentTickets,
      },
    });
  } catch (error) {
    console.error('getStaffDashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch staff dashboard',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/staff/verification-queue
// Query: status (pending|verified|rejected), search, page, limit
// ─────────────────────────────────────────────
export const getVerificationQueue = async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      search,
      page = '1',
      limit = '20',
    } = req.query;

    const filter: Record<string, any> = {};

    if (status) {
      filter.verificationStatus = status;
    }

    if (search) {
      filter.$or = [
        { 'basicDetails.fullName': { $regex: search, $options: 'i' } },
        { 'basicDetails.email': { $regex: search, $options: 'i' } },
        { 'teachingDetails.subjects': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [teachers, total, statusCounts] = await Promise.all([
      TeacherProfile.find(filter)
        .select(
          'basicDetails.fullName basicDetails.email basicDetails.mobileNumber basicDetails.profilePhoto ' +
          'teachingDetails.subjects education.highestQualification ' +
          'locationAvailability.city verificationStatus isActive isVerified ' +
          'verificationDocuments createdAt updatedAt rejectionReason'
        )
        .populate('userId', 'email phoneNumber isActive createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      TeacherProfile.countDocuments(filter),
      TeacherProfile.aggregate([
        {
          $group: {
            _id: '$verificationStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts: Record<string, number> = { pending: 0, verified: 0, rejected: 0 };
    statusCounts.forEach((s: any) => {
      if (s._id && counts[s._id] !== undefined) counts[s._id] = s.count;
    });

    return res.status(200).json({
      success: true,
      data: teachers,
      counts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getVerificationQueue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch verification queue',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};


// ─────────────────────────────────────────────
// GET /api/staff/reports
// Returns aggregated stats for staff reports screen
// ─────────────────────────────────────────────
export const getStaffReports = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [
      ticketStats,
      verificationStats,
      dailyTickets,
      verificationBySubject,
    ] = await Promise.all([
      // Ticket summary
      Ticket.aggregate([
        {
          $facet: {
            totalResolved: [
              { $match: { status: 'resolved', resolvedAt: { $gte: monthStart } } },
              { $count: 'count' },
            ],
            resolvedToday: [
              { $match: { status: 'resolved', resolvedAt: { $gte: todayStart } } },
              { $count: 'count' },
            ],
            avgResolutionMs: [
              { $match: { status: 'resolved', resolvedAt: { $exists: true } } },
              {
                $project: {
                  diff: {
                    $subtract: ['$resolvedAt', '$createdAt'],
                  },
                },
              },
              { $group: { _id: null, avg: { $avg: '$diff' } } },
            ],
            slaCompliance: [
              { $match: { status: 'resolved' } },
              {
                $project: {
                  withinSla: {
                    $lte: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 86400000],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  compliant: { $sum: { $cond: ['$withinSla', 1, 0] } },
                },
              },
            ],
          },
        },
      ]),

      // Verification summary
      TeacherProfile.aggregate([
        {
          $facet: {
            approved: [
              { $match: { verificationStatus: 'verified', verificationDate: { $gte: monthStart } } },
              { $count: 'count' },
            ],
            rejected: [
              { $match: { verificationStatus: 'rejected', updatedAt: { $gte: monthStart } } },
              { $count: 'count' },
            ],
            pending: [
              { $match: { verificationStatus: 'pending' } },
              { $count: 'count' },
            ],
          },
        },
      ]),

      // Lead summary
      ParentRequirement.aggregate([
        {
          $facet: {
            newToday: [
              { $match: { createdAt: { $gte: todayStart }, isActive: true } },
              { $count: 'count' },
            ],
            newYesterday: [
              { $match: { createdAt: { $gte: yesterdayStart, $lt: todayStart }, isActive: true } },
              { $count: 'count' },
            ],
            active: [
              { $match: { status: 'active' as any, isActive: true } },
              { $count: 'count' },
            ],
            closed: [
              { $match: { status: 'closed', isActive: true } },
              { $count: 'count' },
            ],
          },
        },
      ]),

      // Daily ticket activity (last 7 days)
      Ticket.aggregate([
        {
          $match: {
            createdAt: { $gte: weekStart },
          },
        },
        {
          $group: {
            _id: { $dayOfWeek: '$createdAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id': 1 } },
      ]),

      // Leads by status
      ParentRequirement.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Verifications by subject
      TeacherProfile.aggregate([
        { $match: { verificationStatus: 'pending' } },
        { $unwind: '$teachingDetails.subjects' },
        { $group: { _id: '$teachingDetails.subjects', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const ts = ticketStats[0];
    const vs = verificationStats[0];

    const totalResolved = ts.totalResolved[0]?.count ?? 0;
    const resolvedToday = ts.resolvedToday[0]?.count ?? 0;
    const avgResMs = ts.avgResolutionMs[0]?.avg ?? 0;
    const avgResHours = avgResMs > 0 ? (avgResMs / 3600000).toFixed(1) : '0.0';
    const sla = ts.slaCompliance[0];
    const slaRate = sla && sla.total > 0 ? Math.round((sla.compliant / sla.total) * 100) : 0;

    const verApproved = vs.approved[0]?.count ?? 0;
    const verRejected = vs.rejected[0]?.count ?? 0;
    const verPending = vs.pending[0]?.count ?? 0;

    // Day names map (MongoDB $dayOfWeek: 1=Sun, 2=Mon, ...)
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyMap: Record<number, number> = {};
    dailyTickets.forEach((d: any) => { dailyMap[d._id] = d.count; });
    const weekDays = [2, 3, 4, 5, 6, 7, 1]; // Mon–Sun
    const dailyActivity = weekDays.map((dow) => ({
      label: DAY_NAMES[dow === 1 ? 0 : dow - 1],
      value: dailyMap[dow] ?? 0,
    }));


    // Verification by subject
    const verBySubject = verificationBySubject.map((v: any) => ({
      label: v._id as string,
      value: v.count as number,
    }));

    return res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalResolved,
          avgResolutionHours: avgResHours,
          verifications: verApproved + verRejected,
        },
        tickets: {
          totalResolved,
          resolvedToday,
          avgResolutionHours: avgResHours,
          slaCompliance: slaRate,
        },
        verifications: {
          approved: verApproved,
          rejected: verRejected,
          pending: verPending,
          bySubject: verBySubject,
        },
                dailyActivity,
      },
    });
  } catch (error) {
    console.error('getStaffReports error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch staff reports',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
