import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TeacherSubscription } from '../models/TeacherSubscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { TeacherProfile } from '../models/TeacherProfile';
import { Payment } from '../models/Payment';
import { CreditTransaction } from '../models/CreditTransaction';
import { sendNotification } from '../services/notificationService';
import mongoose from 'mongoose';

// Audit Log Interface
interface AuditLogEntry {
  adminId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string;
  entityType: 'subscription' | 'credits';
  oldValue: any;
  newValue: any;
  reason: string;
  timestamp: Date;
  metadata?: any;
}

const auditLogs: AuditLogEntry[] = [];

export function getAuditLogs(filters?: { teacherId?: string; adminId?: string; action?: string; startDate?: Date; endDate?: Date }): AuditLogEntry[] {
  let logs = [...auditLogs];
  if (filters?.teacherId) logs = logs.filter(l => l.teacherId.toString() === filters.teacherId);
  if (filters?.adminId) logs = logs.filter(l => l.adminId.toString() === filters.adminId);
  if (filters?.action) logs = logs.filter(l => l.action === filters.action);
  if (filters?.startDate) logs = logs.filter(l => l.timestamp >= filters.startDate!);
  if (filters?.endDate) logs = logs.filter(l => l.timestamp <= filters.endDate!);
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function addAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  auditLogs.push({ ...entry, timestamp: new Date() });
  if (auditLogs.length > 10000) auditLogs.splice(0, auditLogs.length - 10000);
}

// Helper: Notify teacher
async function notifyTeacherSubscriptionChange(userId: mongoose.Types.ObjectId, action: string, planName: string, details?: string) {
  const titles: Record<string, string> = {
    upgrade: 'Subscription Upgraded', downgrade: 'Subscription Changed', extend: 'Subscription Extended',
    suspend: 'Subscription Suspended', reactivate: 'Subscription Reactivated', cancel: 'Subscription Cancelled',
  };
  await sendNotification({
    userId, type: 'SUBSCRIPTION_CHANGED', category: 'system',
    title: titles[action] || 'Subscription Updated',
    body: `${titles[action] || 'Subscription updated'} to ${planName}. ${details || ''}`,
    data: { screen: 'Subscription', action, planName },
  });
}

function calculateNewExpiryDate(currentEndDate: Date, extensionDays: number): Date {
  const newDate = new Date(currentEndDate);
  newDate.setDate(newDate.getDate() + extensionDays);
  return newDate;
}

// GET /api/admin/subscriptions - List all subscriptions
export const getAllSubscriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', plan, status, search, kycStatus, minCredits, expiryBefore, expiryAfter, sortBy = 'createdAt', sortOrder = 'desc' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const matchStage: any = {};
    if (plan) matchStage.planName = plan;
    if (status) matchStage.status = status;
    if (expiryBefore || expiryAfter) {
      matchStage.endDate = {};
      if (expiryAfter) matchStage.endDate.$gte = new Date(expiryAfter);
      if (expiryBefore) matchStage.endDate.$lte = new Date(expiryBefore);
    }
    const pipeline: any[] = [
      { $match: matchStage },
      { $lookup: { from: 'teacherprofiles', localField: 'teacherId', foreignField: '_id', as: 'teacherProfile' } },
      { $unwind: { path: '$teacherProfile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ];
    if (kycStatus) pipeline.push({ $match: { 'teacherProfile.verificationStatus': kycStatus } });
    if (minCredits) pipeline.push({ $match: { 'credits.creditsRemaining': { $gte: parseInt(minCredits) } } });
    if (search) pipeline.push({ $match: { $or: [{ 'teacherProfile.basicDetails.fullName': { $regex: search, $options: 'i' } }, { 'user.email': { $regex: search, $options: 'i' } }, { subscriptionId: { $regex: search, $options: 'i' } }] } });
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await TeacherSubscription.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;
    pipeline.push(
      { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } }, { $skip: skip }, { $limit: parseInt(limit) },
      { $project: { _id: 1, subscriptionId: 1, planName: 1, status: 1, startDate: 1, endDate: 1, autoRenew: 1, credits: 1, usage: 1, createdAt: 1, teacher: { teacherId: '$teacherProfile._id', fullName: '$teacherProfile.basicDetails.fullName', email: '$user.email', phone: '$teacherProfile.basicDetails.mobileNumber', verificationStatus: '$teacherProfile.verificationStatus', profilePhoto: '$teacherProfile.basicDetails.profilePhoto' } } }
    );
    const subscriptions = await TeacherSubscription.aggregate(pipeline);
    res.json({ success: true, data: { subscriptions, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)), hasMore: skip + subscriptions.length < total } } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load subscriptions', error: String(err) });
  }
};

// GET /api/admin/subscriptions/:teacherId - Get detailed subscription
export const getTeacherSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId } = req.params;
    const subscription = await TeacherSubscription.findOne({ teacherId })
      .populate('teacherId', 'basicDetails.fullName basicDetails.mobileNumber basicDetails.profilePhoto verificationStatus')
      .populate('userId', 'email profile.firstName profile.lastName')
      .populate('planId')
      .lean();
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const [payments, creditTransactions] = await Promise.all([
      Payment.find({ userId: subscription.userId, type: { $in: ['subscription', 'lead_unlock'] }, status: 'completed' }).sort({ createdAt: -1 }).limit(20).lean(),
      CreditTransaction.find({ teacherId: subscription.teacherId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const auditHistory = getAuditLogs({ teacherId: teacherId as string });
    res.json({ success: true, data: { subscription, payments, creditTransactions, auditHistory: auditHistory.slice(0, 20) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load subscription details', error: String(err) });
  }
};

// POST /api/admin/subscriptions/upgrade
export const upgradeSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, targetPlan, reason } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !targetPlan || !reason) { res.status(400).json({ success: false, message: 'Teacher ID, target plan, and reason are required' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const targetPlanDoc = await SubscriptionPlan.findOne({ name: targetPlan, isActive: true });
    if (!targetPlanDoc) { res.status(400).json({ success: false, message: 'Target plan not found or inactive' }); return; }
    const oldPlan = subscription.planName;
    subscription.planId = targetPlanDoc._id as mongoose.Types.ObjectId;
    subscription.planName = targetPlan as any;
    subscription.status = 'active';
    if (targetPlanDoc.limits.creditsPerMonth > 0) {
      subscription.credits.creditsRemaining = targetPlanDoc.limits.creditsPerMonth;
      subscription.credits.creditsUsed = 0;
      subscription.credits.creditResetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    } else { subscription.credits.creditsRemaining = -1; subscription.credits.creditsUsed = 0; }
    subscription.history.push({ action: 'upgraded', fromPlan: oldPlan, toPlan: targetPlan, date: new Date(), note: `Admin upgrade by ${adminId}. Reason: ${reason}` });
    await subscription.save();
    await TeacherProfile.findOneAndUpdate({ _id: teacherId }, { $set: { 'subscription.currentPlan': targetPlan, 'subscription.subscriptionStatus': 'active' } });
    addAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'upgrade', entityType: 'subscription', oldValue: { planName: oldPlan }, newValue: { planName: targetPlan }, reason });
    await notifyTeacherSubscriptionChange(subscription.userId, 'upgrade', targetPlanDoc.displayName, `Reason: ${reason}`);
    res.json({ success: true, message: `Subscription upgraded to ${targetPlan}`, data: { subscription } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to upgrade subscription', error: String(err) });
  }
};

// POST /api/admin/subscriptions/downgrade
export const downgradeSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, targetPlan, reason, atPeriodEnd = true } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !targetPlan || !reason) { res.status(400).json({ success: false, message: 'Teacher ID, target plan, and reason are required' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const targetPlanDoc = await SubscriptionPlan.findOne({ name: targetPlan, isActive: true });
    if (!targetPlanDoc) { res.status(400).json({ success: false, message: 'Target plan not found or inactive' }); return; }
    const oldPlan = subscription.planName;
    if (atPeriodEnd) { subscription.autoRenew = false; subscription.cancelReason = `Scheduled downgrade to ${targetPlan}. Reason: ${reason}`; }
    else {
      subscription.planId = targetPlanDoc._id as mongoose.Types.ObjectId;
      subscription.planName = targetPlan as any;
      if (targetPlanDoc.limits.creditsPerMonth > 0) { subscription.credits.creditsRemaining = targetPlanDoc.limits.creditsPerMonth; subscription.credits.creditsUsed = 0; }
      else { subscription.credits.creditsRemaining = -1; subscription.credits.creditsUsed = 0; }
    }
    subscription.history.push({ action: 'downgraded', fromPlan: oldPlan, toPlan: targetPlan, date: new Date(), note: `Admin downgrade by ${adminId}. Reason: ${reason}. Immediate: ${!atPeriodEnd}` });
    await subscription.save();
    if (!atPeriodEnd) await TeacherProfile.findOneAndUpdate({ _id: teacherId }, { $set: { 'subscription.currentPlan': targetPlan } });
    addAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'downgrade', entityType: 'subscription', oldValue: { planName: oldPlan }, newValue: { planName: targetPlan, autoRenew: subscription.autoRenew }, reason, metadata: { atPeriodEnd } });
    await notifyTeacherSubscriptionChange(subscription.userId, 'downgrade', targetPlanDoc.displayName, `Reason: ${reason}${atPeriodEnd ? ' (at period end)' : ''}`);
    res.json({ success: true, message: atPeriodEnd ? `Downgrade scheduled to ${targetPlan}` : `Downgraded to ${targetPlan}`, data: { subscription } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to downgrade subscription', error: String(err) });
  }
};

// POST /api/admin/subscriptions/extend
export const extendSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, extensionDays, reason, extendFrom = 'current' } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !extensionDays || !reason) { res.status(400).json({ success: false, message: 'Teacher ID, extension days, and reason are required' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const oldEndDate = subscription.endDate;
    const baseDate = extendFrom === 'today' ? new Date() : oldEndDate;
    const newEndDate = calculateNewExpiryDate(baseDate, extensionDays);
    subscription.endDate = newEndDate;
    const wasExpired = subscription.status === 'expired';
    const wasCancelled = subscription.status === 'cancelled';
    if (wasExpired || wasCancelled) {
      subscription.status = 'active';
      if (wasExpired) subscription.startDate = new Date();
    }
    subscription.history.push({ action: 'renewed', toPlan: subscription.planName, date: new Date(), note: `Admin extension by ${adminId}. +${extensionDays} days. Reason: ${reason}` });
    await subscription.save();
    await TeacherProfile.findOneAndUpdate({ _id: teacherId }, { $set: { 'subscription.subscriptionEndDate': newEndDate, 'subscription.subscriptionStatus': subscription.status } });
    addAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'extend', entityType: 'subscription', oldValue: { endDate: oldEndDate }, newValue: { endDate: newEndDate, extensionDays }, reason, metadata: { extendFrom } });
    await notifyTeacherSubscriptionChange(subscription.userId, 'extend', subscription.planName, `Extended by ${extensionDays} days`);
    res.json({ success: true, message: `Subscription extended by ${extensionDays} days`, data: { subscription, oldEndDate, newEndDate } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to extend subscription', error: String(err) });
  }
};

// POST /api/admin/subscriptions/suspend
export const suspendSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, reason } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !reason) { res.status(400).json({ success: false, message: 'Teacher ID and reason are required' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    if (subscription.status === 'cancelled' || subscription.status === 'expired') { res.status(400).json({ success: false, message: 'Cannot suspend cancelled/expired subscription' }); return; }
    const oldStatus = subscription.status;
    subscription.status = 'suspended';
    subscription.history.push({ action: 'cancelled', fromPlan: subscription.planName, date: new Date(), note: `Admin suspension by ${adminId}. Reason: ${reason}. Original: ${oldStatus}` });
    await subscription.save();
    await TeacherProfile.findOneAndUpdate({ _id: teacherId }, { $set: { 'subscription.subscriptionStatus': 'cancelled', 'subscription.autoRenew': false } });
    addAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'suspend', entityType: 'subscription', oldValue: { status: oldStatus }, newValue: { status: 'suspended' }, reason });
    await notifyTeacherSubscriptionChange(subscription.userId, 'suspend', subscription.planName, `Reason: ${reason}`);
    res.json({ success: true, message: 'Subscription suspended', data: { subscription } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to suspend subscription', error: String(err) });
  }
};

// POST /api/admin/subscriptions/reactivate
export const reactivateSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, reason, extendIfExpired = true, extensionDays = 30 } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !reason) { res.status(400).json({ success: false, message: 'Teacher ID and reason are required' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const oldStatus = subscription.status;
    subscription.status = 'active';
    const now = new Date();
    if (extendIfExpired && subscription.endDate < now) {
      subscription.endDate = calculateNewExpiryDate(now, extensionDays);
      subscription.startDate = now;
      subscription.usage.periodStart = now;
      subscription.usage.periodEnd = subscription.endDate;
    }
    subscription.usage.applicationsUsed = 0;
    subscription.usage.leadUnlocksUsed = 0;
    subscription.history.push({ action: 'renewed', toPlan: subscription.planName, date: new Date(), note: `Admin reactivation by ${adminId}. Reason: ${reason}` });
    await subscription.save();
    await TeacherProfile.findOneAndUpdate({ _id: teacherId }, { $set: { 'subscription.subscriptionStatus': 'active', 'subscription.subscriptionStartDate': subscription.startDate, 'subscription.subscriptionEndDate': subscription.endDate } });
    addAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'reactivate', entityType: 'subscription', oldValue: { status: oldStatus }, newValue: { status: 'active', endDate: subscription.endDate }, reason, metadata: { extendIfExpired, extensionDays } });
    await notifyTeacherSubscriptionChange(subscription.userId, 'reactivate', subscription.planName, 'Your subscription has been reactivated');
    res.json({ success: true, message: 'Subscription reactivated', data: { subscription } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reactivate subscription', error: String(err) });
  }
};

// POST /api/admin/subscriptions/cancel
export const cancelSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, reason, atPeriodEnd = false } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !reason) { res.status(400).json({ success: false, message: 'Teacher ID and reason are required' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    if (subscription.status === 'cancelled' || subscription.status === 'expired') { res.status(400).json({ success: false, message: 'Already cancelled or expired' }); return; }
    const oldStatus = subscription.status;
    if (atPeriodEnd) { subscription.autoRenew = false; subscription.cancelReason = `Admin scheduled cancellation. Reason: ${reason}`; }
    else { subscription.status = 'cancelled'; subscription.cancelledAt = new Date(); subscription.cancelReason = `Admin cancellation. Reason: ${reason}`; subscription.autoRenew = false; }
    subscription.history.push({ action: 'cancelled', fromPlan: subscription.planName, date: new Date(), note: `Admin cancellation by ${adminId}. Reason: ${reason}. Immediate: ${!atPeriodEnd}` });
    await subscription.save();
    await TeacherProfile.findOneAndUpdate({ _id: teacherId }, { $set: { 'subscription.subscriptionStatus': atPeriodEnd ? 'active' : 'cancelled', 'subscription.autoRenew': false } });
    addAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'cancel', entityType: 'subscription', oldValue: { status: oldStatus }, newValue: { status: atPeriodEnd ? 'scheduled_cancel' : 'cancelled' }, reason, metadata: { atPeriodEnd } });
    await notifyTeacherSubscriptionChange(subscription.userId, 'cancel', subscription.planName, `Reason: ${reason}${atPeriodEnd ? ' (at period end)' : ''}`);
    res.json({ success: true, message: atPeriodEnd ? 'Scheduled for cancellation' : 'Subscription cancelled', data: { subscription } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel subscription', error: String(err) });
  }
};

// GET /api/admin/subscriptions/audit-logs
export const getAuditLogsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, action, startDate, endDate, page = '1', limit = '50' } = req.query as Record<string, string>;
    const filters: any = {};
    if (teacherId) filters.teacherId = teacherId;
    if (action) filters.action = action;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    const logs = getAuditLogs(filters);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedLogs = logs.slice(skip, skip + parseInt(limit));
    res.json({ success: true, data: { logs: paginatedLogs, pagination: { page: parseInt(page), limit: parseInt(limit), total: logs.length, pages: Math.ceil(logs.length / parseInt(limit)), hasMore: skip + paginatedLogs.length < logs.length } } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load audit logs', error: String(err) });
  }
};

// GET /api/admin/subscriptions/summary
export const getSubscriptionSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [planDist, statusDist, upcomingExp, suspended, topPaying, activeSubscribers] = await Promise.all([
      TeacherSubscription.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$planName', count: { $sum: 1 } } }]),
      TeacherSubscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      TeacherSubscription.countDocuments({ status: 'active', endDate: { $gte: new Date(), $lte: thirtyDaysFromNow } }),
      TeacherSubscription.countDocuments({ status: 'suspended' }),
      Payment.aggregate([{ $match: { status: 'completed', type: 'subscription', paymentDate: { $gte: ninetyDaysAgo } } }, { $group: { _id: '$userId', totalPaid: { $sum: '$totalAmount' } } }, { $sort: { totalPaid: -1 } }, { $limit: 10 }]),
      TeacherSubscription.aggregate([{ $match: { status: 'active' } }, { $sort: { 'usage.applicationsUsed': -1 } }, { $limit: 10 }, { $lookup: { from: 'teacherprofiles', localField: 'teacherId', foreignField: '_id', as: 'teacher' } }, { $unwind: '$teacher' }, { $project: { subscriptionId: 1, planName: 1, 'teacher.basicDetails.fullName': 1, 'usage.applicationsUsed': 1 } }]),
    ]);
    const planDistribution: Record<string, number> = { free: 0, starter: 0, professional: 0, premium: 0 };
    planDist.forEach(p => planDistribution[p._id] = p.count);
    const statusDistribution: Record<string, number> = { active: 0, cancelled: 0, expired: 0, pending: 0, suspended: 0 };
    statusDist.forEach(s => statusDistribution[s._id] = s.count);
    res.json({ success: true, data: { planDistribution, statusDistribution, upcomingExpirations: upcomingExp, suspendedCount: suspended, topPayingTeachers: topPaying, mostActiveSubscribers: activeSubscribers } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load summary', error: String(err) });
  }
};
