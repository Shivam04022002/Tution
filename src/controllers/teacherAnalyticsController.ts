import { Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import { TutorApplication } from '../models/TutorApplication';
import { TutorMatch } from '../models/TutorMatch';
import { ContactRequest } from '../models/ContactRequest';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

// ─────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────

function startOf(unit: 'day' | 'week' | 'month' | 'year'): Date {
  const d = new Date();
  if (unit === 'day') { d.setHours(0, 0, 0, 0); return d; }
  if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; }
  if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d;
}

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate = now;

  switch (period) {
    case 'today':
      startDate = startOf('day');
      break;
    case '7days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = startOf('month');
  }

  return { startDate, endDate };
}

// ─────────────────────────────────────────────
// GET /api/teachers/analytics
// Main teacher analytics endpoint with KPIs
// ─────────────────────────────────────────────
export const getTeacherAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const period = req.query.period as string || '30days';
    const { startDate, endDate } = getDateRange(period);

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get teacher profile
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId, isActive: true });
    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Parallel aggregation queries for KPIs
    const [
      totalLeadsViewed,
      applicationsSubmitted,
      applicationsShortlisted,
      applicationsSelected,
      demoRequests,
      completedDemos,
      activeStudents,
      savedRequirements,
      averageMatchScore,
      responseRate,
    ] = await Promise.all([
      // Total unique requirements viewed (from saved + hidden requirements)
      TeacherProfile.aggregate([
        { $match: { userId: teacherId, isActive: true } },
        {
          $project: {
            totalViewed: {
              $add: [
                { $size: { $ifNull: ['$savedRequirements', []] } },
                { $size: { $ifNull: ['$hiddenRequirements', []] } },
              ],
            },
          },
        },
      ]),

      // Applications submitted
      TutorApplication.countDocuments({
        teacherId,
        createdAt: { $gte: startDate, $lte: endDate },
        isActive: true,
      }),

      // Applications shortlisted
      TutorApplication.countDocuments({
        teacherId,
        status: 'shortlisted' as any,
        createdAt: { $gte: startDate, $lte: endDate },
        isActive: true,
      }),

      // Applications selected (accepted)
      TutorApplication.countDocuments({
        teacherId,
        status: 'accepted' as any,
        createdAt: { $gte: startDate, $lte: endDate },
        isActive: true,
      }),

      // Demo requests received
      ContactRequest.countDocuments({
        teacherId,
        contactType: 'demo',
        createdAt: { $gte: startDate, $lte: endDate },
        isActive: true,
      }),

      // Completed demos
      ContactRequest.countDocuments({
        teacherId,
        contactType: 'demo',
        status: 'completed' as any,
        createdAt: { $gte: startDate, $lte: endDate },
        isActive: true,
      }),

      // Active students (from profile stats)
      TeacherProfile.aggregate([
        { $match: { userId: teacherId, isActive: true } },
        { $project: { activeStudents: '$stats.activeStudents' } },
      ]),

      // Saved requirements count
      TeacherProfile.aggregate([
        { $match: { userId: teacherId, isActive: true } },
        {
          $project: {
            savedCount: { $size: { $ifNull: ['$savedRequirements', []] } },
          },
        },
      ]),

      // Average match score
      TutorMatch.aggregate([
        { $match: { teacherId, isActive: true } },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$overallScore' },
          },
        },
      ]),

      // Response rate (from profile stats)
      TeacherProfile.aggregate([
        { $match: { userId: teacherId, isActive: true } },
        { $project: { responseRate: '$stats.responseRate' } },
      ]),
    ]);

    // Extract values from aggregations
    const leadsViewed = totalLeadsViewed[0]?.totalViewed || 0;
    const activeStudentsCount = activeStudents[0]?.activeStudents || 0;
    const savedCount = savedRequirements[0]?.savedCount || 0;
    const avgMatchScoreValue = averageMatchScore[0]?.avgScore || 0;
    const responseRateValue = responseRate[0]?.responseRate || 0;

    return res.status(200).json({
      success: true,
      data: {
        period,
        kpis: {
          totalLeadsViewed: leadsViewed,
          applicationsSubmitted,
          applicationsShortlisted,
          applicationsSelected,
          demoRequests,
          completedDemos,
          activeStudents: activeStudentsCount,
          savedRequirements: savedCount,
          averageMatchScore: Math.round(avgMatchScoreValue * 10) / 10,
          responseRate: Math.round(responseRateValue),
        },
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getTeacherAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/teachers/analytics/funnel
// Conversion funnel analysis
// ─────────────────────────────────────────────
export const getTeacherFunnelAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const period = req.query.period as string || '30days';
    const { startDate, endDate } = getDateRange(period);

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Funnel stages aggregation
    const [
      leadsViewed,
      applicationsData,
      shortlistedData,
      demoScheduledData,
      demoCompletedData,
      studentConvertedData,
    ] = await Promise.all([
      // Stage 1: Leads Viewed (saved + hidden requirements)
      TeacherProfile.aggregate([
        { $match: { userId: teacherId, isActive: true } },
        {
          $project: {
            leadsViewed: {
              $add: [
                { $size: { $ifNull: ['$savedRequirements', []] } },
                { $size: { $ifNull: ['$hiddenRequirements', []] } },
              ],
            },
          },
        },
      ]),

      // Stage 2: Applications Submitted
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]),

      // Stage 3: Shortlisted
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            status: 'shortlisted' as any,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]),

      // Stage 4: Demo Scheduled
      ContactRequest.aggregate([
        {
          $match: {
            teacherId,
            contactType: 'demo',
            status: { $in: ['accepted', 'completed'] },
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]),

      // Stage 5: Demo Completed
      ContactRequest.aggregate([
        {
          $match: {
            teacherId,
            contactType: 'demo',
            status: 'completed' as any,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]),

      // Stage 6: Student Converted (accepted applications with completed demos)
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            status: 'accepted' as any,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $lookup: {
            from: 'contactrequests',
            localField: 'parentRequirementId',
            foreignField: 'requirementId',
            as: 'demoRequests',
          },
        },
        {
          $match: {
            'demoRequests.status': 'completed',
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Extract counts
    const leadsViewedCount = leadsViewed[0]?.leadsViewed || 0;
    const applicationsCount = applicationsData[0]?.count || 0;
    const shortlistedCount = shortlistedData[0]?.count || 0;
    const demoScheduledCount = demoScheduledData[0]?.count || 0;
    const demoCompletedCount = demoCompletedData[0]?.count || 0;
    const studentConvertedCount = studentConvertedData[0]?.count || 0;

    // Calculate conversion percentages
    const funnel = [
      {
        stage: 'Leads Viewed',
        count: leadsViewedCount,
        conversionRate: 100,
      },
      {
        stage: 'Applications Submitted',
        count: applicationsCount,
        conversionRate: leadsViewedCount > 0 ? Math.round((applicationsCount / leadsViewedCount) * 100) : 0,
      },
      {
        stage: 'Shortlisted',
        count: shortlistedCount,
        conversionRate: applicationsCount > 0 ? Math.round((shortlistedCount / applicationsCount) * 100) : 0,
      },
      {
        stage: 'Demo Scheduled',
        count: demoScheduledCount,
        conversionRate: shortlistedCount > 0 ? Math.round((demoScheduledCount / shortlistedCount) * 100) : 0,
      },
      {
        stage: 'Demo Completed',
        count: demoCompletedCount,
        conversionRate: demoScheduledCount > 0 ? Math.round((demoCompletedCount / demoScheduledCount) * 100) : 0,
      },
      {
        stage: 'Student Converted',
        count: studentConvertedCount,
        conversionRate: demoCompletedCount > 0 ? Math.round((studentConvertedCount / demoCompletedCount) * 100) : 0,
      },
    ];

    return res.status(200).json({
      success: true,
      data: {
        period,
        funnel,
        overallConversionRate: leadsViewedCount > 0 
          ? Math.round((studentConvertedCount / leadsViewedCount) * 100) 
          : 0,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getTeacherFunnelAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch funnel analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/teachers/analytics/trends
// Trend analysis over time
// ─────────────────────────────────────────────
export const getTeacherTrendsAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const period = req.query.period as string || '30days';
    const { startDate, endDate } = getDateRange(period);

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Trend data aggregations
    const [
      applicationsTrend,
      demoTrend,
      conversionTrend,
      topSubjects,
      topLocations,
    ] = await Promise.all([
      // Applications trend over time
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            applications: { $sum: 1 },
            shortlisted: {
              $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] },
            },
            accepted: {
              $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
            },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
            applications: 1,
            shortlisted: 1,
            accepted: 1,
          },
        },
      ]),

      // Demo trend over time
      ContactRequest.aggregate([
        {
          $match: {
            teacherId,
            contactType: 'demo',
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            requests: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
            requests: 1,
            completed: 1,
          },
        },
      ]),

      // Conversion trend over time
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $lookup: {
            from: 'contactrequests',
            localField: 'parentRequirementId',
            foreignField: 'requirementId',
            as: 'demoRequests',
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            totalApplications: { $sum: 1 },
            converted: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'accepted'] },
                      { $gt: [{ $size: '$demoRequests' }, 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
            totalApplications: 1,
            converted: 1,
            conversionRate: {
              $cond: [
                { $gt: ['$totalApplications', 0] },
                { $multiply: [{ $divide: ['$converted', '$totalApplications'] }, 100] },
                0,
              ],
            },
          },
        },
      ]),

      // Top subjects by applications
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $lookup: {
            from: 'parentrequirements',
            localField: 'parentRequirementId',
            foreignField: '_id',
            as: 'requirement',
          },
        },
        { $unwind: '$requirement' },
        { $unwind: '$requirement.subjects' },
        {
          $group: {
            _id: '$requirement.subjects',
            applications: { $sum: 1 },
            selections: {
              $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
            },
          },
        },
        { $sort: { applications: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            subject: '$_id',
            applications: 1,
            selections: 1,
            conversionRate: {
              $cond: [
                { $gt: ['$applications', 0] },
                { $multiply: [{ $divide: ['$selections', '$applications'] }, 100] },
                0,
              ],
            },
          },
        },
      ]),

      // Top locations by applications
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $lookup: {
            from: 'parentrequirements',
            localField: 'parentRequirementId',
            foreignField: '_id',
            as: 'requirement',
          },
        },
        { $unwind: '$requirement' },
        {
          $group: {
            _id: '$requirement.location.city',
            applications: { $sum: 1 },
            conversions: {
              $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
            },
          },
        },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { applications: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            city: '$_id',
            applications: 1,
            conversions: 1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        period,
        trends: {
          applications: applicationsTrend,
          demos: demoTrend,
          conversions: conversionTrend,
        },
        topSubjects,
        topLocations,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getTeacherTrendsAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trends analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/teachers/analytics/performance
// Performance metrics and goals
// ─────────────────────────────────────────────
export const getTeacherPerformanceAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const period = req.query.period as string || '30days';
    const { startDate, endDate } = getDateRange(period);

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Performance metrics aggregation
    const [
      applicationSuccessRate,
      shortlistRate,
      demoConversionRate,
      responseRate,
      averageMatchScore,
      recentActivity,
    ] = await Promise.all([
      // Application Success Rate (accepted / total applications)
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          },
        },
      ]),

      // Shortlist Rate
      TutorApplication.aggregate([
        {
          $match: {
            teacherId,
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] } },
          },
        },
      ]),

      // Demo Conversion Rate
      ContactRequest.aggregate([
        {
          $match: {
            teacherId,
            contactType: 'demo',
            createdAt: { $gte: startDate, $lte: endDate },
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          },
        },
      ]),

      // Response Rate (from profile)
      TeacherProfile.aggregate([
        { $match: { userId: teacherId, isActive: true } },
        { $project: { responseRate: '$stats.responseRate' } },
      ]),

      // Average Match Score
      TutorMatch.aggregate([
        { $match: { teacherId, isActive: true } },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$overallScore' },
          },
        },
      ]),

      // Recent Activity (last 10 activities)
      Notification.aggregate([
        {
          $match: {
            userId: teacherId,
            createdAt: { $gte: startDate },
            isActive: true,
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            type: 1,
            title: 1,
            message: 1,
            createdAt: 1,
            isRead: 1,
          },
        },
      ]),
    ]);

    // Calculate rates
    const appSuccessData = applicationSuccessRate[0];
    const shortlistData = shortlistRate[0];
    const demoData = demoConversionRate[0];
    const responseRateData = responseRate[0];
    const matchScoreData = averageMatchScore[0];

    const performance = {
      applicationSuccessRate: appSuccessData?.total > 0 
        ? Math.round((appSuccessData.accepted / appSuccessData.total) * 100) 
        : 0,
      shortlistRate: shortlistData?.total > 0 
        ? Math.round((shortlistData.shortlisted / shortlistData.total) * 100) 
        : 0,
      demoConversionRate: demoData?.total > 0 
        ? Math.round((demoData.completed / demoData.total) * 100) 
        : 0,
      responseRate: responseRateData?.responseRate || 0,
      averageMatchScore: matchScoreData?.avgScore ? Math.round(matchScoreData.avgScore * 10) / 10 : 0,
    };

    // Monthly goals (can be made configurable later)
    const goals = {
      monthlyApplicationGoal: 20,
      monthlyDemoGoal: 10,
      monthlyConversionGoal: 5,
    };

    // Current month progress
    const monthStart = startOf('month');
    const [
      currentMonthApplications,
      currentMonthDemos,
      currentMonthConversions,
    ] = await Promise.all([
      TutorApplication.countDocuments({
        teacherId,
        createdAt: { $gte: monthStart },
        isActive: true,
      }),
      ContactRequest.countDocuments({
        teacherId,
        contactType: 'demo',
        status: { $in: ['accepted', 'completed'] },
        createdAt: { $gte: monthStart },
        isActive: true,
      }),
      TutorApplication.countDocuments({
        teacherId,
        status: 'accepted' as any,
        createdAt: { $gte: monthStart },
        isActive: true,
      }),
    ]);

    const goalProgress = {
      applications: {
        current: currentMonthApplications,
        target: goals.monthlyApplicationGoal,
        percentage: Math.round((currentMonthApplications / goals.monthlyApplicationGoal) * 100),
      },
      demos: {
        current: currentMonthDemos,
        target: goals.monthlyDemoGoal,
        percentage: Math.round((currentMonthDemos / goals.monthlyDemoGoal) * 100),
      },
      conversions: {
        current: currentMonthConversions,
        target: goals.monthlyConversionGoal,
        percentage: Math.round((currentMonthConversions / goals.monthlyConversionGoal) * 100),
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        period,
        performance,
        goals,
        goalProgress,
        recentActivity,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getTeacherPerformanceAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch performance analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/teachers/earnings
// Teacher earnings and revenue analytics
// ─────────────────────────────────────────────
export const getTeacherEarningsAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?._id;
    const period = req.query.period as string || '30days';
    const { startDate, endDate } = getDateRange(period);

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get teacher profile
    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId, isActive: true });
    if (!teacherProfile) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    // Parallel aggregation queries for earnings data
    const [
      conversionMetrics,
      revenueMetrics,
      subjectPerformance,
      locationPerformance,
      revenueTrends,
      benchmarkData,
    ] = await Promise.all([
      // Conversion funnel metrics
      TutorApplication.aggregate([
        { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            shortlistedApplications: { $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] } },
            acceptedApplications: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            demoScheduled: { $sum: { $cond: [{ $eq: ['$demoScheduled', true] }, 1, 0] } },
          },
        },
      ]),

      // Revenue metrics based on accepted applications
      TutorApplication.aggregate([
        { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: 'accepted' as any, createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'parentrequirements',
            localField: 'parentRequirementId',
            foreignField: '_id',
            as: 'requirement',
          },
        },
        { $unwind: '$requirement' },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            estimatedMonthlyRevenue: {
              $sum: {
                $ifNull: [
                  '$proposedFee',
                  { $avg: ['$requirement.budget.minAmount', '$requirement.budget.maxAmount'] },
                ],
              },
            },
            averageFeePerStudent: {
              $avg: {
                $ifNull: [
                  '$proposedFee',
                  { $avg: ['$requirement.budget.minAmount', '$requirement.budget.maxAmount'] },
                ],
              },
            },
          },
        },
      ]),

      // Subject-wise performance
      TutorApplication.aggregate([
        { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: 'accepted' as any, createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'parentrequirements',
            localField: 'parentRequirementId',
            foreignField: '_id',
            as: 'requirement',
          },
        },
        { $unwind: '$requirement' },
        { $unwind: '$requirement.subjects' },
        {
          $group: {
            _id: '$requirement.subjects',
            applications: { $sum: 1 },
            conversions: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            estimatedRevenue: {
              $sum: {
                $ifNull: [
                  '$proposedFee',
                  { $avg: ['$requirement.budget.minAmount', '$requirement.budget.maxAmount'] },
                ],
              },
            },
          },
        },
        { $sort: { conversions: -1 } },
        { $limit: 10 },
      ]),

      // Location-wise performance
      TutorApplication.aggregate([
        { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: 'accepted' as any, createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'parentrequirements',
            localField: 'parentRequirementId',
            foreignField: '_id',
            as: 'requirement',
          },
        },
        { $unwind: '$requirement' },
        {
          $group: {
            _id: '$requirement.location.city',
            applications: { $sum: 1 },
            students: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            estimatedRevenue: {
              $sum: {
                $ifNull: [
                  '$proposedFee',
                  { $avg: ['$requirement.budget.minAmount', '$requirement.budget.maxAmount'] },
                ],
              },
            },
          },
        },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { estimatedRevenue: -1 } },
        { $limit: 10 },
      ]),

      // Revenue trends over time
      TutorApplication.aggregate([
        { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: 'accepted' as any, createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'parentrequirements',
            localField: 'parentRequirementId',
            foreignField: '_id',
            as: 'requirement',
          },
        },
        { $unwind: '$requirement' },
        {
          $group: {
            _id: {
              $dateToString: {
                format: period === 'today' ? '%H:00' : '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            students: { $sum: 1 },
            revenue: {
              $sum: {
                $ifNull: [
                  '$proposedFee',
                  { $avg: ['$requirement.budget.minAmount', '$requirement.budget.maxAmount'] },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Benchmark data (platform averages)
      TeacherProfile.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            averageConversionRate: {
              $avg: {
                $cond: [
                  { $gt: ['$stats.totalStudents', 0] },
                  { $multiply: [{ $divide: ['$stats.totalStudents', '$stats.leadUnlocks'] }, 100] },
                  0,
                ],
              },
            },
            averageMonthlyRevenue: { $avg: '$pricingRevenue.monthlyRate' },
            topPerformerRevenue: { $max: '$pricingRevenue.monthlyRate' },
          },
        },
      ]),
    ]);

    // Calculate conversion percentages
    const conversionData = conversionMetrics[0] || {
      totalApplications: 0,
      shortlistedApplications: 0,
      acceptedApplications: 0,
      demoScheduled: 0,
    };

    const revenueData = revenueMetrics[0] || {
      totalStudents: 0,
      estimatedMonthlyRevenue: 0,
      averageFeePerStudent: 0,
    };

    const leadToApplicationRate = teacherProfile.stats.leadUnlocks > 0 
      ? (conversionData.totalApplications / teacherProfile.stats.leadUnlocks) * 100 
      : 0;

    const applicationToShortlistRate = conversionData.totalApplications > 0
      ? (conversionData.shortlistedApplications / conversionData.totalApplications) * 100
      : 0;

    const shortlistToDemoRate = conversionData.shortlistedApplications > 0
      ? (conversionData.demoScheduled / conversionData.shortlistedApplications) * 100
      : 0;

    const demoToStudentRate = conversionData.demoScheduled > 0
      ? (conversionData.acceptedApplications / conversionData.demoScheduled) * 100
      : 0;

    const overallConversionRate = teacherProfile.stats.leadUnlocks > 0
      ? (conversionData.acceptedApplications / teacherProfile.stats.leadUnlocks) * 100
      : 0;

    // Calculate estimated earnings projections
    const monthlyPotentialRevenue = revenueData.estimatedMonthlyRevenue;
    const quarterlyPotentialRevenue = monthlyPotentialRevenue * 3;
    const annualPotentialRevenue = monthlyPotentialRevenue * 12;

    // Get teacher's current conversion rate for benchmarking
    const teacherConversionRate = overallConversionRate;

    const benchmarkDataProcessed = benchmarkData[0] || {
      averageConversionRate: 0,
      averageMonthlyRevenue: 0,
      topPerformerRevenue: 0,
    };

    return res.json({
      success: true,
      data: {
        period,
        kpis: {
          leadsGenerated: teacherProfile.stats.leadUnlocks,
          applicationsSubmitted: conversionData.totalApplications,
          shortlisted: conversionData.shortlistedApplications,
          demoScheduled: conversionData.demoScheduled,
          demoCompleted: conversionData.acceptedApplications,
          studentsConverted: conversionData.acceptedApplications,
        },
        conversionMetrics: {
          leadToApplicationRate: Math.round(leadToApplicationRate * 100) / 100,
          applicationToShortlistRate: Math.round(applicationToShortlistRate * 100) / 100,
          shortlistToDemoRate: Math.round(shortlistToDemoRate * 100) / 100,
          demoToStudentRate: Math.round(demoToStudentRate * 100) / 100,
          overallConversionRate: Math.round(overallConversionRate * 100) / 100,
        },
        estimatedEarnings: {
          monthlyPotentialRevenue: Math.round(monthlyPotentialRevenue),
          quarterlyPotentialRevenue: Math.round(quarterlyPotentialRevenue),
          annualPotentialRevenue: Math.round(annualPotentialRevenue),
          averageStudentValue: Math.round(revenueData.averageFeePerStudent),
        },
        subjectPerformance: subjectPerformance.map(item => ({
          subject: item._id,
          leads: item.applications,
          applications: item.applications,
          conversions: item.conversions,
          revenueContribution: Math.round(item.estimatedRevenue),
        })),
        locationPerformance: locationPerformance.map(item => ({
          city: item._id,
          applications: item.applications,
          students: item.students,
          revenue: Math.round(item.estimatedRevenue),
        })),
        revenueTrends: revenueTrends.map(item => ({
          period: item._id,
          students: item.students,
          revenue: Math.round(item.revenue),
        })),
        benchmarks: {
          yourConversionRate: Math.round(teacherConversionRate * 100) / 100,
          platformAverage: Math.round(benchmarkDataProcessed.averageConversionRate * 100) / 100,
          topTeacherAverage: Math.round(benchmarkDataProcessed.averageConversionRate * 1.5 * 100) / 100, // Estimated top performer
        },
      },
    });
  } catch (error) {
    console.error('Error fetching earnings analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
