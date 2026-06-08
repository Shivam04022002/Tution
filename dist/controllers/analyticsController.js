"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinancialAnalytics = exports.getRevenueAnalytics = exports.getTeacherSupplyAnalytics = exports.getDemandAnalytics = exports.getOverviewAnalytics = void 0;
const User_1 = require("../models/User");
const TeacherProfile_1 = require("../models/TeacherProfile");
const ParentRequirement_1 = require("../models/ParentRequirement");
const TutorApplication_1 = require("../models/TutorApplication");
const TutorMatch_1 = require("../models/TutorMatch");
const DemoClass_1 = require("../models/DemoClass");
const ScheduledClass_1 = require("../models/ScheduledClass");
const Payment_1 = require("../models/Payment");
const LeadUnlock_1 = require("../models/LeadUnlock");
const Invoice_1 = require("../models/Invoice");
const RefundRequest_1 = require("../models/RefundRequest");
const PromoCode_1 = require("../models/PromoCode");
function startOf(unit) {
    const d = new Date();
    if (unit === 'day') {
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (unit === 'week') {
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (unit === 'month') {
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
}
const getOverviewAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const monthStart = startOf('month');
        const weekStart = startOf('week');
        const [totalParents, totalTeachers, verifiedTeachers, pendingTeachers, blockedTeachers, activeRequirements, closedRequirements, totalApplications, pendingApplications, acceptedApplications, totalMatches, totalDemoClasses, completedDemos, scheduledDemos, scheduledClasses, activeScheduledClasses, newParentsThisMonth, newTeachersThisMonth, newReqsThisMonth, newAppsThisWeek,] = await Promise.all([
            User_1.User.countDocuments({ role: 'parent', isActive: true }),
            User_1.User.countDocuments({ role: 'teacher', isActive: true }),
            TeacherProfile_1.TeacherProfile.countDocuments({ verificationStatus: 'verified', isActive: true }),
            TeacherProfile_1.TeacherProfile.countDocuments({ verificationStatus: 'pending' }),
            TeacherProfile_1.TeacherProfile.countDocuments({ isBlocked: true }),
            ParentRequirement_1.ParentRequirement.countDocuments({ status: 'active', isActive: true }),
            ParentRequirement_1.ParentRequirement.countDocuments({ status: 'closed' }),
            TutorApplication_1.TutorApplication.countDocuments(),
            TutorApplication_1.TutorApplication.countDocuments({ status: 'pending' }),
            TutorApplication_1.TutorApplication.countDocuments({ status: 'accepted' }),
            TutorMatch_1.TutorMatch.countDocuments({ isActive: true }),
            DemoClass_1.DemoClass.countDocuments(),
            DemoClass_1.DemoClass.countDocuments({ status: 'completed' }),
            DemoClass_1.DemoClass.countDocuments({ status: 'scheduled' }),
            ScheduledClass_1.ScheduledClass.countDocuments(),
            ScheduledClass_1.ScheduledClass.countDocuments({ status: 'active' }),
            User_1.User.countDocuments({ role: 'parent', isActive: true, createdAt: { $gte: monthStart } }),
            User_1.User.countDocuments({ role: 'teacher', isActive: true, createdAt: { $gte: monthStart } }),
            ParentRequirement_1.ParentRequirement.countDocuments({ status: 'active', createdAt: { $gte: monthStart } }),
            TutorApplication_1.TutorApplication.countDocuments({ createdAt: { $gte: weekStart } }),
        ]);
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
    }
    catch (error) {
        console.error('getOverviewAnalytics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch overview analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getOverviewAnalytics = getOverviewAnalytics;
const getDemandAnalytics = async (req, res) => {
    try {
        const limit = 10;
        const [topSubjects, topGrades, topBoards, topCities, tuitionTypeBreakdown, budgetDistribution, requirementsByMonth,] = await Promise.all([
            ParentRequirement_1.ParentRequirement.aggregate([
                { $match: { isActive: true } },
                { $unwind: '$subjects' },
                { $group: { _id: '$subjects', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, subject: '$_id', count: 1 } },
            ]),
            ParentRequirement_1.ParentRequirement.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$studentDetails.grade', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, grade: '$_id', count: 1 } },
            ]),
            ParentRequirement_1.ParentRequirement.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$studentDetails.board', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, board: '$_id', count: 1 } },
            ]),
            ParentRequirement_1.ParentRequirement.aggregate([
                { $match: { isActive: true, 'location.city': { $ne: '' } } },
                { $group: { _id: '$location.city', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, city: '$_id', count: 1 } },
            ]),
            ParentRequirement_1.ParentRequirement.aggregate([
                { $group: { _id: '$tuitionType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $project: { _id: 0, type: '$_id', count: 1 } },
            ]),
            ParentRequirement_1.ParentRequirement.aggregate([
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
            ParentRequirement_1.ParentRequirement.aggregate([
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
    }
    catch (error) {
        console.error('getDemandAnalytics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch demand analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getDemandAnalytics = getDemandAnalytics;
const getTeacherSupplyAnalytics = async (req, res) => {
    try {
        const limit = 10;
        const [teachersByCity, teachersBySubject, teachersByBoard, teachersByExperience, teachersByVerification, teachersByMode, avgHourlyRateByCity, teachersJoinedByMonth,] = await Promise.all([
            TeacherProfile_1.TeacherProfile.aggregate([
                { $match: { isActive: true, 'locationAvailability.city': { $ne: '' } } },
                { $group: { _id: '$locationAvailability.city', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, city: '$_id', count: 1 } },
            ]),
            TeacherProfile_1.TeacherProfile.aggregate([
                { $match: { isActive: true } },
                { $unwind: '$teachingDetails.subjects' },
                { $group: { _id: '$teachingDetails.subjects', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, subject: '$_id', count: 1 } },
            ]),
            TeacherProfile_1.TeacherProfile.aggregate([
                { $match: { isActive: true } },
                { $unwind: '$teachingDetails.boards' },
                { $group: { _id: '$teachingDetails.boards', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $project: { _id: 0, board: '$_id', count: 1 } },
            ]),
            TeacherProfile_1.TeacherProfile.aggregate([
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
            TeacherProfile_1.TeacherProfile.aggregate([
                { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, status: '$_id', count: 1 } },
            ]),
            TeacherProfile_1.TeacherProfile.aggregate([
                { $match: { isActive: true } },
                { $unwind: '$teachingDetails.teachingModes' },
                { $group: { _id: '$teachingDetails.teachingModes', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $project: { _id: 0, mode: '$_id', count: 1 } },
            ]),
            TeacherProfile_1.TeacherProfile.aggregate([
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
            TeacherProfile_1.TeacherProfile.aggregate([
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
        const demandSubjects = await ParentRequirement_1.ParentRequirement.aggregate([
            { $match: { isActive: true } },
            { $unwind: '$subjects' },
            { $group: { _id: '$subjects', demand: { $sum: 1 } } },
            { $sort: { demand: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, subject: '$_id', demand: 1 } },
        ]);
        const supplyMap = new Map(teachersBySubject.map(s => [s.subject, s.count]));
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
    }
    catch (error) {
        console.error('getTeacherSupplyAnalytics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch supply analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTeacherSupplyAnalytics = getTeacherSupplyAnalytics;
const getRevenueAnalytics = async (req, res) => {
    try {
        const monthStart = startOf('month');
        const yearStart = startOf('year');
        const [totalRevenueResult, monthlyRevenueResult, yearlyRevenueResult, revenueByType, revenueByMonth, leadUnlockStats, leadUnlockByMonth, conversionStats,] = await Promise.all([
            Payment_1.Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            Payment_1.Payment.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: monthStart } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            Payment_1.Payment.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: yearStart } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            Payment_1.Payment.aggregate([
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
            Payment_1.Payment.aggregate([
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
            LeadUnlock_1.LeadUnlock.aggregate([
                {
                    $group: {
                        _id: '$paymentDetails.paymentStatus',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$paymentDetails.amount' },
                    },
                },
                { $project: { _id: 0, status: '$_id', count: 1, totalAmount: 1 } },
            ]),
            LeadUnlock_1.LeadUnlock.aggregate([
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
            LeadUnlock_1.LeadUnlock.aggregate([
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
    }
    catch (error) {
        console.error('getRevenueAnalytics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getRevenueAnalytics = getRevenueAnalytics;
const getFinancialAnalytics = async (_req, res) => {
    try {
        const [grossResult, _gstResult, refundedResult, pendingResult, invoiceGstBreakdown, monthlyNet, refundStats, promoStats, promoTopCodes, monthlyRefunds,] = await Promise.all([
            Payment_1.Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: {
                        _id: null,
                        gross: { $sum: '$totalAmount' },
                        gstCollected: { $sum: '$gstAmount' },
                        net: { $sum: '$amount' },
                        count: { $sum: 1 },
                    } },
            ]),
            Payment_1.Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, totalGst: { $sum: '$gstAmount' }, count: { $sum: 1 } } },
            ]),
            Payment_1.Payment.aggregate([
                { $match: { status: { $in: ['refunded', 'partially_refunded'] } } },
                { $group: {
                        _id: null,
                        refundedTotal: { $sum: '$refundDetails.amount' },
                        refundedGst: { $sum: '$gstAmount' },
                        count: { $sum: 1 },
                    } },
            ]),
            RefundRequest_1.RefundRequest.aggregate([
                { $match: { status: 'pending' } },
                { $group: { _id: null, total: { $sum: '$requestedAmount' }, count: { $sum: 1 } } },
            ]),
            Invoice_1.Invoice.aggregate([
                { $match: { status: 'issued' } },
                { $unwind: '$items' },
                { $group: {
                        _id: null,
                        totalCgst: { $sum: '$items.cgst' },
                        totalSgst: { $sum: '$items.sgst' },
                        totalIgst: { $sum: '$items.igst' },
                        totalGst: { $sum: '$items.totalGst' },
                        invoices: { $sum: 1 },
                    } },
            ]),
            Payment_1.Payment.aggregate([
                { $match: {
                        status: 'completed',
                        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
                    } },
                { $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        gross: { $sum: '$totalAmount' },
                        gstCollected: { $sum: '$gstAmount' },
                        net: { $sum: '$amount' },
                        count: { $sum: 1 },
                    } },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $project: {
                        _id: 0,
                        year: '$_id.year', month: '$_id.month',
                        gross: 1, gstCollected: 1, net: 1, count: 1,
                    } },
            ]),
            RefundRequest_1.RefundRequest.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$requestedAmount' } } },
                { $project: { _id: 0, status: '$_id', count: 1, totalAmount: 1 } },
            ]),
            PromoCode_1.PromoCode.aggregate([
                { $group: {
                        _id: null,
                        activeCodes: { $sum: { $cond: ['$isActive', 1, 0] } },
                        totalCodes: { $sum: 1 },
                        totalUsage: { $sum: '$usageCount' },
                        totalDiscountGiven: { $sum: '$totalDiscountGiven' },
                    } },
            ]),
            PromoCode_1.PromoCode.find({})
                .sort({ usageCount: -1 })
                .limit(5)
                .select('code usageCount totalDiscountGiven discountType discountValue')
                .lean(),
            Payment_1.Payment.aggregate([
                { $match: {
                        status: { $in: ['refunded', 'partially_refunded'] },
                        refundDate: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
                    } },
                { $group: {
                        _id: { year: { $year: '$refundDate' }, month: { $month: '$refundDate' } },
                        refundedAmount: { $sum: '$refundDetails.amount' },
                        count: { $sum: 1 },
                    } },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $project: { _id: 0, year: '$_id.year', month: '$_id.month', refundedAmount: 1, count: 1 } },
            ]),
        ]);
        const g = grossResult[0] || { gross: 0, gstCollected: 0, net: 0, count: 0 };
        const refunded = refundedResult[0] || { refundedTotal: 0, refundedGst: 0, count: 0 };
        const pendingRefunds = pendingResult[0] || { total: 0, count: 0 };
        const gstBreakdown = invoiceGstBreakdown[0] || { totalCgst: 0, totalSgst: 0, totalIgst: 0, totalGst: 0, invoices: 0 };
        const promoSummary = promoStats[0] || { activeCodes: 0, totalCodes: 0, totalUsage: 0, totalDiscountGiven: 0 };
        const netRevenue = g.gross - (refunded.refundedTotal ?? 0);
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    grossRevenue: g.gross,
                    gstCollected: g.gstCollected,
                    subtotalRevenue: g.net,
                    refundedRevenue: refunded.refundedTotal ?? 0,
                    netRevenue,
                    completedPayments: g.count,
                    refundedPayments: refunded.count,
                    pendingRefundAmount: pendingRefunds.total,
                    pendingRefundCount: pendingRefunds.count,
                },
                gstBreakdown: {
                    cgst: gstBreakdown.totalCgst,
                    sgst: gstBreakdown.totalSgst,
                    igst: gstBreakdown.totalIgst,
                    total: gstBreakdown.totalGst,
                    invoices: gstBreakdown.invoices,
                },
                monthlyNet,
                monthlyRefunds,
                refundStats,
                promos: {
                    summary: promoSummary,
                    topCodes: promoTopCodes,
                },
            },
        });
    }
    catch (error) {
        console.error('getFinancialAnalytics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch financial analytics',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getFinancialAnalytics = getFinancialAnalytics;
//# sourceMappingURL=analyticsController.js.map