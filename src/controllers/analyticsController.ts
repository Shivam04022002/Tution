import { Response } from 'express';
import { User } from '../models/User';
import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import { TutorApplication } from '../models/TutorApplication';
import { TutorMatch } from '../models/TutorMatch';
import { DemoClass } from '../models/DemoClass';
import { ScheduledClass } from '../models/ScheduledClass';
import { Payment } from '../models/Payment';
import { LeadUnlock } from '../models/LeadUnlock';
import { Invoice } from '../models/Invoice';
import { RefundRequest } from '../models/RefundRequest';
import { PromoCode } from '../models/PromoCode';
import { AuthRequest } from '../middleware/auth';

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

function startOf(unit: 'day' | 'week' | 'month' | 'year'): Date {
  const d = new Date();
  if (unit === 'day') { d.setHours(0, 0, 0, 0); return d; }
  if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; }
  if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d;
}

// ─────────────────────────────────────────────
// GET /api/admin/analytics/overview
// ─────────────────────────────────────────────
export const getOverviewAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const monthStart = startOf('month');
    const weekStart = startOf('week');

    const [
      totalParents,
      totalTeachers,
      verifiedTeachers,
      pendingTeachers,
      blockedTeachers,
      activeRequirements,
      closedRequirements,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      totalMatches,
      totalDemoClasses,
      completedDemos,
      scheduledDemos,
      scheduledClasses,
      activeScheduledClasses,
      newParentsThisMonth,
      newTeachersThisMonth,
      newReqsThisMonth,
      newAppsThisWeek,
    ] = await Promise.all([
      User.countDocuments({ role: 'parent', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      TeacherProfile.countDocuments({ verificationStatus: 'verified', isActive: true }),
      TeacherProfile.countDocuments({ verificationStatus: 'pending' }),
      TeacherProfile.countDocuments({ isBlocked: true }),
      ParentRequirement.countDocuments({ status: 'active' as any, isActive: true }),
      ParentRequirement.countDocuments({ status: 'closed' }),
      TutorApplication.countDocuments(),
      TutorApplication.countDocuments({ status: 'pending' }),
      TutorApplication.countDocuments({ status: 'accepted' as any }),
      TutorMatch.countDocuments({ isActive: true }),
      DemoClass.countDocuments(),
      DemoClass.countDocuments({ status: 'completed' }),
      DemoClass.countDocuments({ status: 'scheduled' }),
      ScheduledClass.countDocuments(),
      ScheduledClass.countDocuments({ status: 'active' as any }),
      User.countDocuments({ role: 'parent', isActive: true, createdAt: { $gte: monthStart } }),
      User.countDocuments({ role: 'teacher', isActive: true, createdAt: { $gte: monthStart } }),
      ParentRequirement.countDocuments({ status: 'active' as any, createdAt: { $gte: monthStart } }),
      TutorApplication.countDocuments({ createdAt: { $gte: weekStart } }),
    ]);

    // Conversion funnel: requirements → applications → demos → scheduled classes
    const conversionRate = totalApplications > 0
      ? Math.round((acceptedApplications / totalApplications) * 100)
      : 0;

    const demoConversionRate = totalDemoClasses > 0
      ? Math.round((completedDemos / totalDemoClasses) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        users: {
          totalParents,
          totalTeachers,
          newParentsThisMonth,
          newTeachersThisMonth,
        },
        teachers: {
          verifiedTeachers,
          pendingTeachers,
          blockedTeachers,
          verificationRate: totalTeachers > 0
            ? Math.round((verifiedTeachers / totalTeachers) * 100)
            : 0,
        },
        requirements: {
          activeRequirements,
          closedRequirements,
          newReqsThisMonth,
          totalRequirements: activeRequirements + closedRequirements,
        },
        applications: {
          totalApplications,
          pendingApplications,
          acceptedApplications,
          newAppsThisWeek,
          conversionRate,
        },
        matching: {
          totalMatches,
        },
        demos: {
          totalDemoClasses,
          completedDemos,
          scheduledDemos,
          demoConversionRate,
        },
        classes: {
          scheduledClasses,
          activeScheduledClasses,
        },
        generatedAt: now,
      },
    });
  } catch (error) {
    console.error('getOverviewAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch overview analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/demand
// Aggregates on ParentRequirement (indexed on subjects, city, status)
// ─────────────────────────────────────────────
export const getDemandAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const limit = 10;

    const [
      topSubjects,
      topGrades,
      topBoards,
      topCities,
      tuitionTypeBreakdown,
      budgetDistribution,
      requirementsByMonth,
    ] = await Promise.all([

      // Top subjects demanded by parents (unwind array field)
      ParentRequirement.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$subjects' },
        { $group: { _id: '$subjects', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, subject: '$_id', count: 1 } },
      ]),

      // Top grades/classes demanded
      ParentRequirement.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$studentDetails.grade', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, grade: '$_id', count: 1 } },
      ]),

      // Top boards demanded
      ParentRequirement.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$studentDetails.board', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, board: '$_id', count: 1 } },
      ]),

      // Top cities by requirement count
      ParentRequirement.aggregate([
        { $match: { isActive: true, 'location.city': { $ne: '' } } },
        { $group: { _id: '$location.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, city: '$_id', count: 1 } },
      ]),

      // Tuition type breakdown (home/online/group/crash)
      ParentRequirement.aggregate([
        { $group: { _id: '$tuitionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, type: '$_id', count: 1 } },
      ]),

      // Budget distribution buckets
      ParentRequirement.aggregate([
        { $match: { isActive: true } },
        {
          $bucket: {
            groupBy: '$budget.maxAmount',
            boundaries: [0, 500, 1000, 2000, 3000, 5000, 10000],
            default: '10000+',
            output: { count: { $sum: 1 }, avgBudget: { $avg: '$budget.maxAmount' } },
          },
        },
      ]),

      // Requirements created per month (last 6 months) — uses createdAt index
      ParentRequirement.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            year: '$_id.year',
            month: '$_id.month',
            count: 1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        topSubjects,
        topGrades,
        topBoards,
        topCities,
        tuitionTypeBreakdown,
        budgetDistribution,
        requirementsByMonth,
      },
    });
  } catch (error) {
    console.error('getDemandAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch demand analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/supply
// Aggregates on TeacherProfile
// ─────────────────────────────────────────────
export const getTeacherSupplyAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const limit = 10;

    const [
      teachersByCity,
      teachersBySubject,
      teachersByBoard,
      teachersByExperience,
      teachersByVerification,
      teachersByMode,
      avgHourlyRateByCity,
      teachersJoinedByMonth,
    ] = await Promise.all([

      // Teachers per city (uses locationAvailability.city)
      TeacherProfile.aggregate([
        { $match: { isActive: true, 'locationAvailability.city': { $ne: '' } } },
        { $group: { _id: '$locationAvailability.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, city: '$_id', count: 1 } },
      ]),

      // Teachers per subject (unwind array)
      TeacherProfile.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$teachingDetails.subjects' },
        { $group: { _id: '$teachingDetails.subjects', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, subject: '$_id', count: 1 } },
      ]),

      // Teachers per board
      TeacherProfile.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$teachingDetails.boards' },
        { $group: { _id: '$teachingDetails.boards', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { _id: 0, board: '$_id', count: 1 } },
      ]),

      // Teachers by experience bucket
      TeacherProfile.aggregate([
        { $match: { isActive: true } },
        {
          $bucket: {
            groupBy: '$pricingRevenue.experienceYears',
            boundaries: [0, 1, 3, 5, 10, 20],
            default: '20+',
            output: { count: { $sum: 1 }, avgRate: { $avg: '$pricingRevenue.hourlyRate' } },
          },
        },
      ]),

      // Verification status breakdown
      TeacherProfile.aggregate([
        { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),

      // Teaching mode breakdown (home/online/center)
      TeacherProfile.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$teachingDetails.teachingModes' },
        { $group: { _id: '$teachingDetails.teachingModes', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, mode: '$_id', count: 1 } },
      ]),

      // Average hourly rate per city (top 10 cities)
      TeacherProfile.aggregate([
        {
          $match: {
            isActive: true,
            'locationAvailability.city': { $ne: '' },
            'pricingRevenue.hourlyRate': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$locationAvailability.city',
            avgHourlyRate: { $avg: '$pricingRevenue.hourlyRate' },
            teacherCount: { $sum: 1 },
          },
        },
        { $sort: { teacherCount: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            city: '$_id',
            avgHourlyRate: { $round: ['$avgHourlyRate', 0] },
            teacherCount: 1,
          },
        },
      ]),

      // Teachers joined per month (last 6 months)
      TeacherProfile.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $project: { _id: 0, year: '$_id.year', month: '$_id.month', count: 1 } },
      ]),
    ]);

    // Supply vs Demand: top 5 subjects cross-referenced
    const demandSubjects: { subject: string; demand: number }[] = await ParentRequirement.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$subjects' },
      { $group: { _id: '$subjects', demand: { $sum: 1 } } },
      { $sort: { demand: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, subject: '$_id', demand: 1 } },
    ]);

    const supplyMap = new Map(
      (teachersBySubject as { subject: string; count: number }[]).map(s => [s.subject, s.count])
    );

    const supplyVsDemand = demandSubjects.map(d => ({
      subject: d.subject,
      demand: d.demand,
      supply: supplyMap.get(d.subject) ?? 0,
      gap: d.demand - (supplyMap.get(d.subject) ?? 0),
    }));

    return res.status(200).json({
      success: true,
      data: {
        teachersByCity,
        teachersBySubject,
        teachersByBoard,
        teachersByExperience,
        teachersByVerification,
        teachersByMode,
        avgHourlyRateByCity,
        teachersJoinedByMonth,
        supplyVsDemand,
      },
    });
  } catch (error) {
    console.error('getTeacherSupplyAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch supply analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/revenue
// Uses Payment + LeadUnlock collections
// Returns placeholders with TODO if collections are empty
// ─────────────────────────────────────────────
export const getRevenueAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const monthStart = startOf('month');
    const yearStart = startOf('year');

    const [
      totalRevenueResult,
      monthlyRevenueResult,
      yearlyRevenueResult,
      revenueByType,
      revenueByMonth,
      leadUnlockStats,
      leadUnlockByMonth,
      conversionStats,
    ] = await Promise.all([

      // Total completed payments — sum totalAmount
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),

      // Revenue this month
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),

      // Revenue this year
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: yearStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),

      // Revenue breakdown by payment type
      Payment.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
            avgAmount: { $avg: '$totalAmount' },
          },
        },
        { $sort: { total: -1 } },
        { $project: { _id: 0, type: '$_id', total: 1, count: 1, avgAmount: { $round: ['$avgAmount', 0] } } },
      ]),

      // Monthly revenue trend (last 12 months)
      Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
            transactions: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            year: '$_id.year',
            month: '$_id.month',
            revenue: 1,
            transactions: 1,
          },
        },
      ]),

      // Lead unlock stats: total, completed, refunded
      LeadUnlock.aggregate([
        {
          $group: {
            _id: '$paymentDetails.paymentStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$paymentDetails.amount' },
          },
        },
        { $project: { _id: 0, status: '$_id', count: 1, totalAmount: 1 } },
      ]),

      // Lead unlocks per month (last 6 months)
      LeadUnlock.aggregate([
        {
          $match: {
            'paymentDetails.paymentStatus': 'completed',
            createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$paymentDetails.amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $project: { _id: 0, year: '$_id.year', month: '$_id.month', count: 1, revenue: 1 } },
      ]),

      // Lead conversion: pending/interested/converted/lost
      LeadUnlock.aggregate([
        {
          $group: {
            _id: '$conversionStatus',
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
    ]);

    const totalRevenue = totalRevenueResult[0]?.total ?? 0;
    const totalTransactions = totalRevenueResult[0]?.count ?? 0;
    const monthRevenue = monthlyRevenueResult[0]?.total ?? 0;
    const yearRevenue = yearlyRevenueResult[0]?.total ?? 0;

    // TODO: Integrate subscription revenue when subscription model is active
    // TODO: Add GST breakdown report when tax module is activated

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalTransactions,
          monthRevenue,
          yearRevenue,
          avgTransactionValue: totalTransactions > 0
            ? Math.round(totalRevenue / totalTransactions)
            : 0,
        },
        revenueByType,
        revenueByMonth,
        leadUnlocks: {
          stats: leadUnlockStats,
          byMonth: leadUnlockByMonth,
          conversionStats,
        },
        notes: [
          ...(totalRevenue === 0 ? ['No completed payments recorded yet — revenue data will populate once payments are processed'] : []),
        ],
      },
    });
  } catch (error) {
    console.error('getRevenueAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/financial
// Gross revenue, GST collected, refunded revenue,
// net revenue, and promo code statistics.
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// GET /api/admin/analytics/geography
// Geographic distribution of requirements, teachers, and matches
// ─────────────────────────────────────────────
export const getGeographyAnalytics = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      requirementsByCity,
      teachersByCity,
      matchesByCity,
      cityCoordinates,
    ] = await Promise.all([

      // Requirements by city with coordinates
      ParentRequirement.aggregate([
        { $match: { isActive: true, 'location.city': { $ne: '' } } },
        {
          $group: {
            _id: '$location.city',
            count: { $sum: 1 },
            avgBudget: { $avg: '$budget.maxAmount' },
            coordinates: {
              $first: {
                latitude: { $ifNull: ['$location.latitude', 0] },
                longitude: { $ifNull: ['$location.longitude', 0] },
              },
            },
          },
        },
        { $sort: { count: -1 } },
        {
          $project: {
            _id: 0,
            city: '$_id',
            requirements: '$count',
            avgBudget: { $round: ['$avgBudget', 0] },
            latitude: '$coordinates.latitude',
            longitude: '$coordinates.longitude',
          },
        },
      ]),

      // Teachers by city with coordinates
      TeacherProfile.aggregate([
        { $match: { isActive: true, 'locationAvailability.city': { $ne: '' } } },
        {
          $group: {
            _id: '$locationAvailability.city',
            count: { $sum: 1 },
            avgHourlyRate: { $avg: '$pricingRevenue.hourlyRate' },
            verifiedCount: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] },
            },
            coordinates: {
              $first: {
                latitude: { $ifNull: ['$locationAvailability.coordinates.latitude', 0] },
                longitude: { $ifNull: ['$locationAvailability.coordinates.longitude', 0] },
              },
            },
          },
        },
        { $sort: { count: -1 } },
        {
          $project: {
            _id: 0,
            city: '$_id',
            teachers: '$count',
            verifiedTeachers: '$verifiedCount',
            avgHourlyRate: { $round: ['$avgHourlyRate', 0] },
            latitude: '$coordinates.latitude',
            longitude: '$coordinates.longitude',
          },
        },
      ]),

      // Matches by city
      TutorMatch.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'parentrequirements',
            localField: 'requirementId',
            foreignField: 'requirementId',
            as: 'requirement',
          },
        },
        { $unwind: { path: '$requirement', preserveNullAndEmptyArrays: true } },
        { $match: { 'requirement.location.city': { $ne: '' } } },
        {
          $group: {
            _id: '$requirement.location.city',
            matches: { $sum: 1 },
            avgMatchScore: { $avg: '$overallScore' },
            appliedMatches: {
              $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] },
            },
            hiredMatches: {
              $sum: { $cond: [{ $eq: ['$status', 'hired'] }, 1, 0] },
            },
          },
        },
        { $sort: { matches: -1 } },
        {
          $project: {
            _id: 0,
            city: '$_id',
            matches: 1,
            avgMatchScore: { $round: ['$avgMatchScore', 1] },
            appliedMatches: 1,
            hiredMatches: 1,
          },
        },
      ]),

      // City coordinates from both collections
      ParentRequirement.aggregate([
        { $match: { isActive: true, 'location.latitude': { $ne: 0 } } },
        {
          $group: {
            _id: '$location.city',
            latitude: { $first: '$location.latitude' },
            longitude: { $first: '$location.longitude' },
          },
        },
        { $project: { _id: 0, city: '$_id', latitude: 1, longitude: 1 } },
      ]),
    ]);

    // Merge city data
    const cityMap = new Map();

    requirementsByCity.forEach((c: any) => {
      cityMap.set(c.city, { ...cityMap.get(c.city), ...c });
    });

    teachersByCity.forEach((c: any) => {
      cityMap.set(c.city, { ...cityMap.get(c.city), ...c });
    });

    matchesByCity.forEach((c: any) => {
      cityMap.set(c.city, { ...cityMap.get(c.city), ...c });
    });

    cityCoordinates.forEach((c: any) => {
      if (cityMap.has(c.city)) {
        const existing = cityMap.get(c.city);
        if (!existing.latitude || existing.latitude === 0) {
          cityMap.set(c.city, { ...existing, latitude: c.latitude, longitude: c.longitude });
        }
      }
    });

    const cities = Array.from(cityMap.values()).map((c: any) => ({
      ...c,
      demandSupplyRatio: c.teachers > 0 ? Math.round((c.requirements || 0) / c.teachers * 100) / 100 : 0,
      status: c.requirements > c.teachers ? 'high-demand' : c.teachers > c.requirements ? 'high-supply' : 'balanced',
    }));

    return res.status(200).json({
      success: true,
      data: {
        cities,
        totalCities: cities.length,
        highDemandCities: cities.filter((c: any) => c.status === 'high-demand').length,
        balancedCities: cities.filter((c: any) => c.status === 'balanced').length,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getGeographyAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch geography analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/cities
// Detailed city-level analytics with growth metrics
// ─────────────────────────────────────────────
export const getCityAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      cityGrowth,
      topCitiesByRevenue,
    ] = await Promise.all([

      // City growth over time
      ParentRequirement.aggregate([
        {
          $match: {
            createdAt: { $gte: sinceDate },
            'location.city': { $ne: '' },
          },
        },
        {
          $group: {
            _id: {
              city: '$location.city',
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            newRequirements: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.city',
            dailyGrowth: { $push: { date: { year: '$_id.year', month: '$_id.month', day: '$_id.day' }, count: '$newRequirements' } },
            totalNew: { $sum: '$newRequirements' },
          },
        },
        { $sort: { totalNew: -1 } },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            city: '$_id',
            totalNewRequirements: '$totalNew',
            dailyGrowth: 1,
          },
        },
      ]),

      // Top cities by lead unlock revenue
      Payment.aggregate([
        {
          $match: {
            status: 'completed',
            type: 'lead_unlock',
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $lookup: {
            from: 'teacherprofiles',
            localField: 'userId',
            foreignField: 'userId',
            as: 'teacher',
          },
        },
        { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
        { $match: { 'teacher.locationAvailability.city': { $ne: '' } } },
        {
          $group: {
            _id: '$teacher.locationAvailability.city',
            revenue: { $sum: '$totalAmount' },
            unlocks: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            city: '$_id',
            revenue: 1,
            leadUnlocks: '$unlocks',
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        cityGrowth,
        topCitiesByRevenue,
        periodDays: days,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getCityAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch city analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/subjects
// Subject demand, supply, and gap analysis
// ─────────────────────────────────────────────
export const getSubjectAnalytics = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      subjectDemand,
      subjectSupply,
      subjectByCity,
    ] = await Promise.all([

      // Subject demand from parent requirements
      ParentRequirement.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$subjects' },
        {
          $group: {
            _id: '$subjects',
            demand: { $sum: 1 },
            avgBudget: { $avg: '$budget.maxAmount' },
            cities: { $addToSet: '$location.city' },
          },
        },
        { $sort: { demand: -1 } },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            subject: '$_id',
            demand: 1,
            avgBudget: { $round: ['$avgBudget', 0] },
            cityCount: { $size: '$cities' },
          },
        },
      ]),

      // Subject supply from teacher profiles
      TeacherProfile.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$teachingDetails.subjects' },
        {
          $group: {
            _id: '$teachingDetails.subjects',
            supply: { $sum: 1 },
            verifiedTeachers: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] },
            },
            avgHourlyRate: { $avg: '$pricingRevenue.hourlyRate' },
          },
        },
        { $sort: { supply: -1 } },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            subject: '$_id',
            supply: 1,
            verifiedTeachers: 1,
            avgHourlyRate: { $round: ['$avgHourlyRate', 0] },
          },
        },
      ]),

      // Subject popularity by city
      ParentRequirement.aggregate([
        { $match: { isActive: true, 'location.city': { $ne: '' } } },
        { $unwind: '$subjects' },
        {
          $group: {
            _id: { subject: '$subjects', city: '$location.city' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 50 },
        {
          $project: {
            _id: 0,
            subject: '$_id.subject',
            city: '$_id.city',
            requirements: '$count',
          },
        },
      ]),
    ]);

    // Calculate supply-demand gap
    const demandMap = new Map(subjectDemand.map((s: any) => [s.subject, s]));
    const supplyMap = new Map(subjectSupply.map((s: any) => [s.subject, s]));

    const allSubjects = new Set([...demandMap.keys(), ...supplyMap.keys()]);

    const supplyDemandGap = Array.from(allSubjects).map((subject) => {
      const demand = demandMap.get(subject)?.demand || 0;
      const supply = supplyMap.get(subject)?.supply || 0;
      const gap = demand - supply;
      return {
        subject,
        demand,
        supply,
        gap,
        gapPercentage: demand > 0 ? Math.round((gap / demand) * 100) : 0,
        status: gap > 0 ? 'shortage' : gap < 0 ? 'surplus' : 'balanced',
        avgBudget: demandMap.get(subject)?.avgBudget || 0,
        avgHourlyRate: supplyMap.get(subject)?.avgHourlyRate || 0,
      };
    }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    return res.status(200).json({
      success: true,
      data: {
        subjectDemand,
        subjectSupply,
        supplyDemandGap,
        subjectByCity,
        topShortages: supplyDemandGap.filter((s) => s.status === 'shortage').slice(0, 5),
        topSurpluses: supplyDemandGap.filter((s) => s.status === 'surplus').slice(0, 5),
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getSubjectAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subject analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/supply-demand
// Overall supply-demand analysis with trends
// ─────────────────────────────────────────────
export const getSupplyDemandAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      overallStats,
      demandTrend,
      supplyTrend,
      fastGrowingCities,
    ] = await Promise.all([

      // Overall stats
      Promise.all([
        ParentRequirement.countDocuments({ isActive: true }),
        TeacherProfile.countDocuments({ isActive: true }),
        ParentRequirement.countDocuments({ createdAt: { $gte: sinceDate } }),
        TeacherProfile.countDocuments({ createdAt: { $gte: sinceDate } }),
      ]),

      // Demand trend (new requirements per day)
      ParentRequirement.aggregate([
        {
          $match: {
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: { year: '$_id.year', month: '$_id.month', day: '$_id.day' },
            newRequirements: '$count',
          },
        },
      ]),

      // Supply trend (new teachers per day)
      TeacherProfile.aggregate([
        {
          $match: {
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: { year: '$_id.year', month: '$_id.month', day: '$_id.day' },
            newTeachers: '$count',
          },
        },
      ]),

      // Fast growing cities (7/30/90 days comparison)
      ParentRequirement.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            'location.city': { $ne: '' },
          },
        },
        {
          $group: {
            _id: '$location.city',
            last7Days: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] }, 1, 0],
              },
            },
            last30Days: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] }, 1, 0],
              },
            },
            last90Days: { $sum: 1 },
          },
        },
        { $sort: { last30Days: -1 } },
        { $limit: 15 },
        {
          $project: {
            _id: 0,
            city: '$_id',
            last7Days: 1,
            last30Days: 1,
            last90Days: 1,
            growthRate30d: {
              $cond: [
                { $gt: ['$last90Days', 0] },
                { $multiply: [{ $divide: ['$last30Days', { $divide: ['$last90Days', 3] }] }, 100] },
                0,
              ],
            },
          },
        },
      ]),
    ]);

    const [totalRequirements, totalTeachers, newRequirements, newTeachers] = overallStats;

    return res.status(200).json({
      success: true,
      data: {
        overall: {
          totalRequirements,
          totalTeachers,
          newRequirements,
          newTeachers,
          supplyDemandRatio: totalRequirements > 0 ? Math.round((totalTeachers / totalRequirements) * 100) / 100 : 0,
        },
        demandTrend,
        supplyTrend,
        fastGrowingCities,
        periodDays: days,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('getSupplyDemandAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch supply-demand analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics/financial
// Gross revenue, GST collected, refunded revenue,
// net revenue, and promo code statistics.
// ─────────────────────────────────────────────
export const getFinancialAnalytics = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      grossResult,
      _gstResult,
      refundedResult,
      pendingResult,
      // Invoice-level GST breakdown (CGST + SGST)
      invoiceGstBreakdown,
      // Monthly net revenue trend (completed - refunded)
      monthlyNet,
      // Refund request stats by status
      refundStats,
      // Promo usage stats
      promoStats,
      promoTopCodes,
      // Monthly refunds
      monthlyRefunds,
    ] = await Promise.all([

      // Gross: sum of totalAmount for completed payments
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: {
          _id: null,
          gross: { $sum: '$totalAmount' },
          gstCollected: { $sum: '$gstAmount' },
          net: { $sum: '$amount' },     // pre-GST subtotal
          count: { $sum: 1 },
        }},
      ]),

      // GST collected all time
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalGst: { $sum: '$gstAmount' }, count: { $sum: 1 } } },
      ]),

      // Refunded: sum of refundDetails.amount for refunded payments
      Payment.aggregate([
        { $match: { status: { $in: ['refunded', 'partially_refunded'] } } },
        { $group: {
          _id: null,
          refundedTotal: { $sum: '$refundDetails.amount' },
          refundedGst:   { $sum: '$gstAmount' },
          count: { $sum: 1 },
        }},
      ]),

      // Pending refund requests total
      RefundRequest.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$requestedAmount' }, count: { $sum: 1 } } },
      ]),

      // Invoice GST breakdown (CGST + SGST from issued invoices)
      Invoice.aggregate([
        { $match: { status: 'issued' } },
        { $unwind: '$items' },
        { $group: {
          _id: null,
          totalCgst:  { $sum: '$items.cgst' },
          totalSgst:  { $sum: '$items.sgst' },
          totalIgst:  { $sum: '$items.igst' },
          totalGst:   { $sum: '$items.totalGst' },
          invoices:   { $sum: 1 },
        }},
      ]),

      // Monthly net revenue (last 12 months)
      Payment.aggregate([
        { $match: {
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        }},
        { $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          gross:        { $sum: '$totalAmount' },
          gstCollected: { $sum: '$gstAmount' },
          net:          { $sum: '$amount' },
          count:        { $sum: 1 },
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $project: {
          _id: 0,
          year: '$_id.year', month: '$_id.month',
          gross: 1, gstCollected: 1, net: 1, count: 1,
        }},
      ]),

      // Refund requests by status
      RefundRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$requestedAmount' } } },
        { $project: { _id: 0, status: '$_id', count: 1, totalAmount: 1 } },
      ]),

      // Promo code aggregate stats
      PromoCode.aggregate([
        { $group: {
          _id: null,
          activeCodes:        { $sum: { $cond: ['$isActive', 1, 0] } },
          totalCodes:         { $sum: 1 },
          totalUsage:         { $sum: '$usageCount' },
          totalDiscountGiven: { $sum: '$totalDiscountGiven' },
        }},
      ]),

      // Top 5 most used promo codes
      PromoCode.find({})
        .sort({ usageCount: -1 })
        .limit(5)
        .select('code usageCount totalDiscountGiven discountType discountValue')
        .lean(),

      // Monthly refund amounts (last 6 months)
      Payment.aggregate([
        { $match: {
          status: { $in: ['refunded', 'partially_refunded'] },
          refundDate: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        }},
        { $group: {
          _id: { year: { $year: '$refundDate' }, month: { $month: '$refundDate' } },
          refundedAmount: { $sum: '$refundDetails.amount' },
          count: { $sum: 1 },
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $project: { _id: 0, year: '$_id.year', month: '$_id.month', refundedAmount: 1, count: 1 } },
      ]),
    ]);

    const g               = grossResult[0]   || { gross: 0, gstCollected: 0, net: 0, count: 0 };
    const refunded        = refundedResult[0] || { refundedTotal: 0, refundedGst: 0, count: 0 };
    const pendingRefunds  = pendingResult[0]  || { total: 0, count: 0 };
    const gstBreakdown    = invoiceGstBreakdown[0] || { totalCgst: 0, totalSgst: 0, totalIgst: 0, totalGst: 0, invoices: 0 };
    const promoSummary    = promoStats[0]     || { activeCodes: 0, totalCodes: 0, totalUsage: 0, totalDiscountGiven: 0 };

    const netRevenue = g.gross - (refunded.refundedTotal ?? 0);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          grossRevenue:       g.gross,
          gstCollected:       g.gstCollected,
          subtotalRevenue:    g.net,
          refundedRevenue:    refunded.refundedTotal ?? 0,
          netRevenue,
          completedPayments:  g.count,
          refundedPayments:   refunded.count,
          pendingRefundAmount: pendingRefunds.total,
          pendingRefundCount:  pendingRefunds.count,
        },
        gstBreakdown: {
          cgst:     gstBreakdown.totalCgst,
          sgst:     gstBreakdown.totalSgst,
          igst:     gstBreakdown.totalIgst,
          total:    gstBreakdown.totalGst,
          invoices: gstBreakdown.invoices,
        },
        monthlyNet,
        monthlyRefunds,
        refundStats,
        promos: {
          summary:  promoSummary,
          topCodes: promoTopCodes,
        },
      },
    });
  } catch (error) {
    console.error('getFinancialAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch financial analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
