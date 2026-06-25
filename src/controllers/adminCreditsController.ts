import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TeacherSubscription } from '../models/TeacherSubscription';
import { CreditTransaction } from '../models/CreditTransaction';
import { TeacherProfile } from '../models/TeacherProfile';
import { User } from '../models/User';
import { sendNotification } from '../services/notificationService';
import mongoose from 'mongoose';

//tests
// Audit Log Interface
interface CreditAuditEntry {
  adminId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: 'grant' | 'deduct' | 'bonus' | 'correction';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  timestamp: Date;
  metadata?: any;
}

const creditAuditLogs: CreditAuditEntry[] = [];

function addCreditAuditLog(entry: Omit<CreditAuditEntry, 'timestamp'>): void {
  creditAuditLogs.push({ ...entry, timestamp: new Date() });
  if (creditAuditLogs.length > 10000) creditAuditLogs.splice(0, creditAuditLogs.length - 10000);
}

export function getCreditAuditLogs(filters?: { teacherId?: string; action?: string; startDate?: Date; endDate?: Date }): CreditAuditEntry[] {
  let logs = [...creditAuditLogs];
  if (filters?.teacherId) logs = logs.filter(l => l.teacherId.toString() === filters.teacherId);
  if (filters?.action) logs = logs.filter(l => l.action === filters.action);
  if (filters?.startDate) logs = logs.filter(l => l.timestamp >= filters.startDate!);
  if (filters?.endDate) logs = logs.filter(l => l.timestamp <= filters.endDate!);
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Helper: Notify teacher
async function notifyTeacherCreditChange(userId: mongoose.Types.ObjectId, action: string, amount: number, balanceAfter: number, reason?: string) {
  const titles: Record<string, string> = { grant: 'Credits Added', deduct: 'Credits Deducted', bonus: 'Bonus Credits Added', correction: 'Credit Balance Corrected' };
  const bodies: Record<string, string> = {
    grant: `${amount} credits have been added to your account. New balance: ${balanceAfter === -1 ? 'Unlimited' : balanceAfter}.`,
    deduct: `${amount} credits have been deducted from your account. New balance: ${balanceAfter === -1 ? 'Unlimited' : balanceAfter}.`,
    bonus: `You've received ${amount} bonus credits! New balance: ${balanceAfter === -1 ? 'Unlimited' : balanceAfter}.`,
    correction: `Your credit balance has been corrected to ${balanceAfter === -1 ? 'Unlimited' : balanceAfter}.`,
  };
  await sendNotification({
    userId, type: 'CREDIT_CHANGED', category: 'system',
    title: titles[action] || 'Credits Updated',
    body: bodies[action] || `Credit balance updated. New balance: ${balanceAfter === -1 ? 'Unlimited' : balanceAfter}`,
    data: { screen: 'Credits', action, amount, balanceAfter },
  });
}

// Helper: Generate transaction ID
function generateTransactionId(): string {
  return `CRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
}

// GET /api/admin/credits - List all credit balances with filters
export const getAllCredits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search, minBalance, maxBalance, plan, sortBy = 'credits.creditsRemaining', sortOrder = 'desc' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const pipeline: any[] = [
      { $lookup: { from: 'teacherprofiles', localField: 'teacherId', foreignField: '_id', as: 'teacherProfile' } },
      { $unwind: { path: '$teacherProfile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ];
    const matchStage: any = {};
    if (plan) matchStage.planName = plan;
    if (search) {
      pipeline.push({ $match: { $or: [{ 'teacherProfile.basicDetails.fullName': { $regex: search, $options: 'i' } }, { 'user.email': { $regex: search, $options: 'i' } }, { subscriptionId: { $regex: search, $options: 'i' } }] } });
    }
    if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });
    if (minBalance !== undefined || maxBalance !== undefined) {
      const balanceMatch: any = {};
      if (minBalance !== undefined) balanceMatch.$gte = parseInt(minBalance);
      if (maxBalance !== undefined) balanceMatch.$lte = parseInt(maxBalance);
      pipeline.push({ $match: { 'credits.creditsRemaining': balanceMatch } });
    }
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await TeacherSubscription.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;
    pipeline.push(
      { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } }, { $skip: skip }, { $limit: parseInt(limit) },
      { $project: { _id: 1, subscriptionId: 1, planName: 1, status: 1, credits: 1, usage: 1, teacher: { teacherId: '$teacherProfile._id', fullName: '$teacherProfile.basicDetails.fullName', email: '$user.email', phone: '$teacherProfile.basicDetails.mobileNumber', profilePhoto: '$teacherProfile.basicDetails.profilePhoto', verificationStatus: '$teacherProfile.verificationStatus' } } }
    );
    const subscriptions = await TeacherSubscription.aggregate(pipeline);
    res.json({ success: true, data: { teachers: subscriptions, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)), hasMore: skip + subscriptions.length < total } } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load credits', error: String(err) });
  }
};

// GET /api/admin/credits/:teacherId - Get detailed credit info
export const getTeacherCredits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId } = req.params;
    const subscription = await TeacherSubscription.findOne({ teacherId })
      .populate('teacherId', 'basicDetails.fullName basicDetails.mobileNumber basicDetails.profilePhoto verificationStatus')
      .populate('userId', 'email profile.firstName profile.lastName')
      .lean();
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const transactions = await CreditTransaction.find({ teacherId: subscription.teacherId }).sort({ createdAt: -1 }).limit(50).lean();
    const summary = await CreditTransaction.aggregate([
      { $match: { teacherId: subscription.teacherId } },
      { $group: { _id: '$type', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]);
    const creditSummary = { granted: 0, consumed: 0, refunded: 0, bonus: 0 };
    summary.forEach(s => {
      if (s._id === 'CREDIT_GRANTED') creditSummary.granted = s.totalAmount;
      if (s._id === 'LEAD_UNLOCK') creditSummary.consumed = Math.abs(s.totalAmount);
      if (s._id === 'CREDIT_REFUND') creditSummary.refunded = s.totalAmount;
      if (s._id === 'BONUS_CREDIT') creditSummary.bonus = s.totalAmount;
    });
    const auditHistory = getCreditAuditLogs({ teacherId: teacherId as string });
    res.json({ success: true, data: { subscription, transactions, summary: creditSummary, auditHistory: auditHistory.slice(0, 20) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load credit details', error: String(err) });
  }
};

// POST /api/admin/credits/grant - Grant credits
export const grantCredits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, amount, reason, expiresAt } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !amount || !reason) { res.status(400).json({ success: false, message: 'Teacher ID, amount, and reason are required' }); return; }
    if (amount <= 0) { res.status(400).json({ success: false, message: 'Amount must be positive' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const oldBalance = subscription.credits.creditsRemaining;
    const newBalance = oldBalance === -1 ? -1 : oldBalance + parseInt(amount);
    if (newBalance !== -1) subscription.credits.creditsRemaining = newBalance;
    await subscription.save();
    const transaction = await CreditTransaction.create({
      transactionId: generateTransactionId(),
      teacherId: subscription.teacherId,
      userId: subscription.userId,
      type: 'CREDIT_GRANTED',
      amount: parseInt(amount),
      balanceBefore: oldBalance,
      balanceAfter: newBalance,
      description: `Admin credit grant. Reason: ${reason}`,
      metadata: { adminId, grantReason: reason, expiresAt },
    });
    addCreditAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'grant', amount: parseInt(amount), balanceBefore: oldBalance, balanceAfter: newBalance, reason });
    await notifyTeacherCreditChange(subscription.userId, 'grant', amount, newBalance, reason);
    res.json({ success: true, message: `${amount} credits granted successfully`, data: { transaction, newBalance } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to grant credits', error: String(err) });
  }
};

// POST /api/admin/credits/deduct - Deduct credits
export const deductCredits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, amount, reason } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !amount || !reason) { res.status(400).json({ success: false, message: 'Teacher ID, amount, and reason are required' }); return; }
    if (amount <= 0) { res.status(400).json({ success: false, message: 'Amount must be positive' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const oldBalance = subscription.credits.creditsRemaining;
    if (oldBalance !== -1 && oldBalance < amount) { res.status(400).json({ success: false, message: 'Insufficient credits to deduct', data: { currentBalance: oldBalance } }); return; }
    const newBalance = oldBalance === -1 ? -1 : oldBalance - parseInt(amount);
    if (newBalance !== -1) subscription.credits.creditsRemaining = newBalance;
    await subscription.save();
    const transaction = await CreditTransaction.create({
      transactionId: generateTransactionId(),
      teacherId: subscription.teacherId,
      userId: subscription.userId,
      type: 'LEAD_UNLOCK', // Using LEAD_UNLOCK type for deductions as it's a negative transaction
      amount: -parseInt(amount),
      balanceBefore: oldBalance,
      balanceAfter: newBalance,
      description: `Admin credit deduction. Reason: ${reason}`,
      metadata: { adminId, deductionReason: reason },
    });
    addCreditAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'deduct', amount: -parseInt(amount), balanceBefore: oldBalance, balanceAfter: newBalance, reason });
    await notifyTeacherCreditChange(subscription.userId, 'deduct', amount, newBalance, reason);
    res.json({ success: true, message: `${amount} credits deducted successfully`, data: { transaction, newBalance } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to deduct credits', error: String(err) });
  }
};

// POST /api/admin/credits/bonus - Grant bonus credits
export const grantBonusCredits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, amount, bonusType, reason, promoCode } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || !amount || !reason) { res.status(400).json({ success: false, message: 'Teacher ID, amount, and reason are required' }); return; }
    if (amount <= 0) { res.status(400).json({ success: false, message: 'Amount must be positive' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const oldBalance = subscription.credits.creditsRemaining;
    const newBalance = oldBalance === -1 ? -1 : oldBalance + parseInt(amount);
    if (newBalance !== -1) subscription.credits.creditsRemaining = newBalance;
    await subscription.save();
    const bonusReasons: Record<string, string> = { referral: 'Referral Bonus', loyalty: 'Loyalty Reward', promotion: 'Promotional Bonus', compensation: 'Service Compensation', goodwill: 'Goodwill Gesture', manual: 'Manual Bonus' };
    const transaction = await CreditTransaction.create({
      transactionId: generateTransactionId(),
      teacherId: subscription.teacherId,
      userId: subscription.userId,
      type: 'BONUS_CREDIT',
      amount: parseInt(amount),
      balanceBefore: oldBalance,
      balanceAfter: newBalance,
      description: `${bonusReasons[bonusType] || 'Bonus'}: ${reason}`,
      metadata: { adminId, bonusType, bonusReason: reason, promoCode },
    });
    addCreditAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'bonus', amount: parseInt(amount), balanceBefore: oldBalance, balanceAfter: newBalance, reason, metadata: { bonusType, promoCode } });
    await notifyTeacherCreditChange(subscription.userId, 'bonus', amount, newBalance, reason);
    res.json({ success: true, message: `${amount} bonus credits granted successfully`, data: { transaction, newBalance } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to grant bonus credits', error: String(err) });
  }
};

// POST /api/admin/credits/correct - Correction adjustment
export const correctCredits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, newBalance: targetBalance, reason } = req.body;
    const adminId = req.user?.id;
    if (!teacherId || targetBalance === undefined || !reason) { res.status(400).json({ success: false, message: 'Teacher ID, new balance, and reason are required' }); return; }
    const subscription = await TeacherSubscription.findOne({ teacherId });
    if (!subscription) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }
    const oldBalance = subscription.credits.creditsRemaining;
    const newBalance = parseInt(targetBalance);
    subscription.credits.creditsRemaining = newBalance;
    await subscription.save();
    const adjustment = newBalance - (oldBalance === -1 ? 0 : oldBalance);
    const transaction = await CreditTransaction.create({
      transactionId: generateTransactionId(),
      teacherId: subscription.teacherId,
      userId: subscription.userId,
      type: adjustment >= 0 ? 'CREDIT_GRANTED' : 'LEAD_UNLOCK',
      amount: adjustment,
      balanceBefore: oldBalance,
      balanceAfter: newBalance,
      description: `Credit balance correction. Reason: ${reason}`,
      metadata: { adminId, correctionReason: reason, previousBalance: oldBalance },
    });
    addCreditAuditLog({ adminId: new mongoose.Types.ObjectId(adminId), teacherId: new mongoose.Types.ObjectId(teacherId), userId: subscription.userId, action: 'correction', amount: adjustment, balanceBefore: oldBalance, balanceAfter: newBalance, reason });
    await notifyTeacherCreditChange(subscription.userId, 'correction', Math.abs(adjustment), newBalance, reason);
    res.json({ success: true, message: `Credit balance corrected to ${newBalance}`, data: { transaction, oldBalance, newBalance } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to correct credits', error: String(err) });
  }
};

// GET /api/admin/credits/audit-logs
export const getCreditAuditLogsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teacherId, action, startDate, endDate, page = '1', limit = '50' } = req.query as Record<string, string>;
    const filters: any = {};
    if (teacherId) filters.teacherId = teacherId;
    if (action) filters.action = action;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    const logs = getCreditAuditLogs(filters);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedLogs = logs.slice(skip, skip + parseInt(limit));
    res.json({ success: true, data: { logs: paginatedLogs, pagination: { page: parseInt(page), limit: parseInt(limit), total: logs.length, pages: Math.ceil(logs.length / parseInt(limit)), hasMore: skip + paginatedLogs.length < logs.length } } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load audit logs', error: String(err) });
  }
};

// GET /api/admin/credits/summary
export const getCreditsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalCreditsByPlan, lowBalanceTeachers, topCreditUsers, recentTransactions] = await Promise.all([
      TeacherSubscription.aggregate([{ $group: { _id: '$planName', totalCredits: { $sum: '$credits.creditsRemaining' }, avgCredits: { $avg: '$credits.creditsRemaining' }, count: { $sum: 1 } } }]),
      TeacherSubscription.countDocuments({ 'credits.creditsRemaining': { $gte: 0, $lte: 5 }, status: 'active' }),
      TeacherSubscription.find({ 'credits.creditsRemaining': { $gt: 0 } }).sort({ 'credits.creditsRemaining': -1 }).limit(10).populate('teacherId', 'basicDetails.fullName'),
      CreditTransaction.find().sort({ createdAt: -1 }).limit(20).populate('teacherId', 'basicDetails.fullName'),
    ]);
    const unlimitedUsers = await TeacherSubscription.countDocuments({ 'credits.creditsRemaining': -1 });
    res.json({ success: true, data: { totalCreditsByPlan, lowBalanceTeachers, topCreditUsers, recentTransactions, unlimitedUsers } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load credits summary', error: String(err) });
  }
};

// GET /api/admin/credits/transactions
export const getAllTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', teacherId, type, startDate, endDate } = req.query as Record<string, string>;
    const query: any = {};
    if (teacherId) query.teacherId = new mongoose.Types.ObjectId(teacherId);
    if (type) query.type = type;
    if (startDate || endDate) { query.createdAt = {}; if (startDate) query.createdAt.$gte = new Date(startDate); if (endDate) query.createdAt.$lte = new Date(endDate); }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [transactions, total] = await Promise.all([
      CreditTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('teacherId', 'basicDetails.fullName').lean(),
      CreditTransaction.countDocuments(query),
    ]);
    res.json({ success: true, data: { transactions, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)), hasMore: skip + transactions.length < total } } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load transactions', error: String(err) });
  }
};
