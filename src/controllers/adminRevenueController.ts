import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Payment } from '../models/Payment';
import { TeacherSubscription } from '../models/TeacherSubscription';
import { CreditTransaction } from '../models/CreditTransaction';
import { Invoice } from '../models/Invoice';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDateRange(range?: string, from?: string, to?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  if (from && to) {
    startDate = new Date(from);
    endDate   = new Date(to);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }

  switch (range) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '7d':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '90d':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 89);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case '30d':
    default:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

function prevPeriod(startDate: Date, endDate: Date): { prevStart: Date; prevEnd: Date } {
  const diff = endDate.getTime() - startDate.getTime();
  const prevEnd   = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { prevStart, prevEnd };
}

function growthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/revenue/overview
// ─────────────────────────────────────────────────────────────────────────────
export const getRevenueOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { range, from, to } = req.query as Record<string, string>;
    const { startDate, endDate } = parseDateRange(range, from, to);
    const { prevStart, prevEnd } = prevPeriod(startDate, endDate);

    // Today boundaries
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    // Month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      periodPayments,
      prevPayments,
      todayPayments,
      monthPayments,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { status: 'completed', paymentDate: { $gte: startDate, $lte: endDate } } },
        { $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        }},
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', paymentDate: { $gte: prevStart, $lte: prevEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', paymentDate: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', paymentDate: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    // Status breakdown for period (all statuses)
    const statusBreakdown = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
    ]);

    const byStatus: Record<string, { count: number; amount: number }> = {};
    statusBreakdown.forEach(s => { byStatus[s._id] = { count: s.count, amount: s.amount }; });

    const currentRevenue  = periodPayments[0]?.total  ?? 0;
    const previousRevenue = prevPayments[0]?.total    ?? 0;
    const currentCount    = periodPayments[0]?.count  ?? 0;
    const previousCount   = prevPayments[0]?.count    ?? 0;

    res.json({
      success: true,
      data: {
        period: { startDate, endDate, range: range ?? '30d' },
        revenue: {
          total:       currentRevenue,
          monthly:     monthPayments[0]?.total  ?? 0,
          today:       todayPayments[0]?.total  ?? 0,
          growth:      growthPct(currentRevenue, previousRevenue),
          previous:    previousRevenue,
        },
        transactions: {
          total:     currentCount,
          previous:  previousCount,
          growth:    growthPct(currentCount, previousCount),
          successful: byStatus['completed']?.count           ?? 0,
          failed:     byStatus['failed']?.count              ?? 0,
          refunded:   (byStatus['refunded']?.count ?? 0) + (byStatus['partially_refunded']?.count ?? 0),
          pending:    byStatus['pending']?.count             ?? 0,
        },
        amounts: {
          successAmount:  byStatus['completed']?.amount           ?? 0,
          failedAmount:   byStatus['failed']?.amount              ?? 0,
          refundedAmount: (byStatus['refunded']?.amount ?? 0) + (byStatus['partially_refunded']?.amount ?? 0),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load revenue overview', error: String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/revenue/subscriptions
// ─────────────────────────────────────────────────────────────────────────────
export const getSubscriptionMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { range, from, to } = req.query as Record<string, string>;
    const { startDate, endDate } = parseDateRange(range, from, to);

    const [
      planCounts,
      newSubscriptions,
      cancelledSubscriptions,
      subscriptionRevenue,
    ] = await Promise.all([
      TeacherSubscription.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$planName', count: { $sum: 1 } } },
      ]),
      TeacherSubscription.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      TeacherSubscription.countDocuments({ status: 'cancelled', cancelledAt: { $gte: startDate, $lte: endDate } }),
      Payment.aggregate([
        { $match: { type: 'subscription', status: 'completed', paymentDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byPlan: Record<string, number> = { free: 0, starter: 0, professional: 0, premium: 0 };
    planCounts.forEach(p => { byPlan[p._id] = p.count; });
    const totalActive = Object.values(byPlan).reduce((a, b) => a + b, 0);

    const renewals = await TeacherSubscription.countDocuments({
      updatedAt: { $gte: startDate, $lte: endDate },
      'history.action': 'renewed',
    });

    const upgrades = await TeacherSubscription.countDocuments({
      updatedAt: { $gte: startDate, $lte: endDate },
      'history.action': 'upgraded',
    });

    const upgradeRate = totalActive > 0 ? Math.round((upgrades / totalActive) * 100 * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        plans: {
          free:         byPlan['free']         ?? 0,
          starter:      byPlan['starter']      ?? 0,
          professional: byPlan['professional'] ?? 0,
          premium:      byPlan['premium']      ?? 0,
          totalActive,
        },
        activity: {
          newSubscriptions,
          cancelledSubscriptions,
          renewals,
          upgrades,
          upgradeRate,
          churnRate: totalActive > 0 ? Math.round((cancelledSubscriptions / totalActive) * 100 * 10) / 10 : 0,
        },
        revenue: {
          total: subscriptionRevenue[0]?.total ?? 0,
          count: subscriptionRevenue[0]?.count ?? 0,
          avg:   subscriptionRevenue[0]?.count > 0
            ? Math.round((subscriptionRevenue[0].total / subscriptionRevenue[0].count) * 100) / 100
            : 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load subscription metrics', error: String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/revenue/credits
// ─────────────────────────────────────────────────────────────────────────────
export const getCreditMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { range, from, to } = req.query as Record<string, string>;
    const { startDate, endDate } = parseDateRange(range, from, to);

    const [
      typeSummary,
      creditPackRevenue,
    ] = await Promise.all([
      CreditTransaction.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: { $abs: '$amount' } },
        }},
      ]),
      Payment.aggregate([
        { $match: { type: 'lead_unlock', status: 'completed', paymentDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byType: Record<string, { count: number; totalAmount: number }> = {};
    typeSummary.forEach(t => { byType[t._id] = { count: t.count, totalAmount: t.totalAmount }; });

    const creditsSold     = (byType['BONUS_CREDIT']?.totalAmount ?? 0) + (byType['CREDIT_GRANTED']?.totalAmount ?? 0);
    const creditsConsumed = byType['LEAD_UNLOCK']?.totalAmount ?? 0;
    const creditsRefunded = byType['CREDIT_REFUND']?.totalAmount ?? 0;

    // Pack breakdown from CreditTransaction metadata
    const packBreakdown = await CreditTransaction.aggregate([
      {
        $match: {
          type: 'BONUS_CREDIT',
          createdAt: { $gte: startDate, $lte: endDate },
          'metadata.bonusReason': { $exists: true },
        },
      },
      {
        $group: {
          _id: '$metadata.bonusReason',
          count: { $sum: 1 },
          totalCredits: { $sum: '$amount' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const topPack = packBreakdown[0]?._id ?? 'N/A';
    const avgCreditsPurchased = packBreakdown.length > 0
      ? Math.round(packBreakdown.reduce((a: number, b: { totalCredits: number; count: number }) => a + (b.totalCredits / b.count), 0) / packBreakdown.length)
      : 0;

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary: {
          creditsSold,
          creditsConsumed,
          creditsRefunded,
          netCredits: creditsSold - creditsConsumed - creditsRefunded,
          topPack,
          avgCreditsPurchased,
        },
        byType: {
          granted: byType['CREDIT_GRANTED']?.count     ?? 0,
          unlocks: byType['LEAD_UNLOCK']?.count        ?? 0,
          refunds: byType['CREDIT_REFUND']?.count      ?? 0,
          bonuses: byType['BONUS_CREDIT']?.count       ?? 0,
          upgrades: byType['PLAN_UPGRADE']?.count      ?? 0,
        },
        packBreakdown: packBreakdown.map((p: { _id: string; count: number; totalCredits: number }) => ({
          pack: p._id,
          purchases: p.count,
          totalCredits: p.totalCredits,
        })),
        revenue: {
          total: creditPackRevenue[0]?.total ?? 0,
          count: creditPackRevenue[0]?.count ?? 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load credit metrics', error: String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/revenue/payments
// ─────────────────────────────────────────────────────────────────────────────
export const getPaymentMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { range, from, to, page = '1', limit = '20' } = req.query as Record<string, string>;
    const { startDate, endDate } = parseDateRange(range, from, to);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [
      statusSummary,
      typeSummary,
      methodSummary,
      recentPayments,
      totalCount,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', paymentDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$type', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
        { $sort: { amount: -1 } },
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', paymentDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
        { $sort: { amount: -1 } },
      ]),
      Payment.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'profile.firstName profile.lastName email')
        .lean(),
      Payment.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
    ]);

    const byStatus: Record<string, { count: number; amount: number }> = {};
    statusSummary.forEach((s: { _id: string; count: number; amount: number }) => { byStatus[s._id] = { count: s.count, amount: s.amount }; });

    const completed = byStatus['completed']?.count ?? 0;
    const failed    = byStatus['failed']?.count    ?? 0;
    const total     = Object.values(byStatus).reduce((a, b) => a + b.count, 0);
    const successRate = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0;
    const failureRate = total > 0 ? Math.round((failed    / total) * 100 * 10) / 10 : 0;

    const totalRevenue = byStatus['completed']?.amount ?? 0;
    const avgTxValue   = completed > 0 ? Math.round((totalRevenue / completed) * 100) / 100 : 0;

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary: {
          total,
          completed,
          failed,
          refunded: (byStatus['refunded']?.count ?? 0) + (byStatus['partially_refunded']?.count ?? 0),
          pending:  byStatus['pending']?.count ?? 0,
          successRate,
          failureRate,
          totalRevenue,
          avgTxValue,
        },
        byType: typeSummary.map((t: { _id: string; count: number; amount: number }) => ({
          type: t._id,
          count: t.count,
          amount: t.amount,
        })),
        byMethod: methodSummary.map((m: { _id: string; count: number; amount: number }) => ({
          method: m._id,
          count: m.count,
          amount: m.amount,
        })),
        payments: recentPayments.map(p => ({
          paymentId:     p.paymentId,
          type:          p.type,
          status:        p.status,
          amount:        p.amount,
          totalAmount:   p.totalAmount,
          gstAmount:     p.gstAmount,
          paymentMethod: p.paymentMethod,
          paymentDate:   p.paymentDate,
          createdAt:     p.createdAt,
          invoiceNumber: p.invoiceDetails?.invoiceNumber,
          user:          (p as any).userId,
        })),
        pagination: {
          page:     parseInt(page),
          limit:    parseInt(limit),
          total:    totalCount,
          pages:    Math.ceil(totalCount / parseInt(limit)),
          hasMore:  skip + parseInt(limit) < totalCount,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load payment metrics', error: String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/revenue/invoices
// ─────────────────────────────────────────────────────────────────────────────
export const getInvoiceMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { range, from, to, page = '1', limit = '20' } = req.query as Record<string, string>;
    const { startDate, endDate } = parseDateRange(range, from, to);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [
      statusSummary,
      recentInvoices,
      totalCount,
      revenueSummary,
    ] = await Promise.all([
      Invoice.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$status', count: { $sum: 1 }, grandTotal: { $sum: '$grandTotal' } } },
      ]),
      Invoice.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'profile.firstName profile.lastName email')
        .lean(),
      Invoice.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Invoice.aggregate([
        { $match: { status: 'issued', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: {
          _id: null,
          grandTotal:    { $sum: '$grandTotal' },
          subtotal:      { $sum: '$subtotal' },
          gstTotal:      { $sum: '$gstTotal' },
          promoDiscount: { $sum: '$promoDiscount' },
          count:         { $sum: 1 },
        }},
      ]),
    ]);

    const byStatus: Record<string, { count: number; grandTotal: number }> = {};
    statusSummary.forEach((s: { _id: string; count: number; grandTotal: number }) => {
      byStatus[s._id] = { count: s.count, grandTotal: s.grandTotal };
    });

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary: {
          total:     totalCount,
          issued:    byStatus['issued']?.count     ?? 0,
          draft:     byStatus['draft']?.count      ?? 0,
          cancelled: byStatus['cancelled']?.count  ?? 0,
          grandTotal:    revenueSummary[0]?.grandTotal    ?? 0,
          subtotal:      revenueSummary[0]?.subtotal      ?? 0,
          gstTotal:      revenueSummary[0]?.gstTotal      ?? 0,
          promoDiscount: revenueSummary[0]?.promoDiscount ?? 0,
        },
        invoices: recentInvoices.map(inv => ({
          _id:           inv._id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate:   inv.invoiceDate,
          status:        inv.status,
          grandTotal:    inv.grandTotal,
          gstTotal:      inv.gstTotal,
          buyer:         inv.buyer,
          user:          (inv as any).userId,
          createdAt:     inv.createdAt,
        })),
        pagination: {
          page:    parseInt(page),
          limit:   parseInt(limit),
          total:   totalCount,
          pages:   Math.ceil(totalCount / parseInt(limit)),
          hasMore: skip + parseInt(limit) < totalCount,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load invoice metrics', error: String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/revenue/charts
// Daily & monthly trend data for revenue charts
// ─────────────────────────────────────────────────────────────────────────────
export const getRevenueCharts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { range, from, to } = req.query as Record<string, string>;
    const { startDate, endDate } = parseDateRange(range, from, to);

    // Daily revenue trend
    const dailyRevenue = await Payment.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: {
            year:  { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
            day:   { $dayOfMonth: '$paymentDate' },
          },
          revenue:      { $sum: '$totalAmount' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateFromParts: {
                  year:  '$_id.year',
                  month: '$_id.month',
                  day:   '$_id.day',
                },
              },
            },
          },
          revenue:      1,
          transactions: 1,
        },
      },
    ]);

    // Monthly revenue trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          revenue:      { $sum: '$totalAmount' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          _id: 0,
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: {
                $dateFromParts: {
                  year:  '$_id.year',
                  month: '$_id.month',
                  day:   { $literal: 1 },
                },
              },
            },
          },
          revenue:      1,
          transactions: 1,
        },
      },
    ]);

    // Revenue by payment type (for period)
    const revenueByType = await Payment.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$type', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
    ]);

    // Subscription plan distribution
    const subscriptionDistribution = await TeacherSubscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$planName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Credit transaction trend (daily)
    const creditTrend = await CreditTransaction.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, type: 'LEAD_UNLOCK' } },
      {
        $group: {
          _id: {
            year:  { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day:   { $dayOfMonth: '$createdAt' },
          },
          unlocks: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateFromParts: {
                  year:  '$_id.year',
                  month: '$_id.month',
                  day:   '$_id.day',
                },
              },
            },
          },
          unlocks: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        daily:    dailyRevenue,
        monthly:  monthlyRevenue,
        byType:   revenueByType.map((t: { _id: string; revenue: number; count: number }) => ({
          type: t._id, revenue: t.revenue, count: t.count,
        })),
        subscriptionDistribution: subscriptionDistribution.map((s: { _id: string; count: number }) => ({
          plan: s._id, count: s.count,
        })),
        creditTrend,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load revenue charts', error: String(err) });
  }
};
