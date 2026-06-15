import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Referral } from '../models/Referral';
import { TeacherProfile } from '../models/TeacherProfile';
import { CreditTransaction } from '../models/CreditTransaction';
import { PromoCode } from '../models/PromoCode';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const REFERRAL_REWARD_CREDITS = 10;      // Credits given to referrer
const REFERRAL_PROMO_DISCOUNT = 20;      // 20% discount for referred teacher
const REFERRAL_PROMO_MAX_USES = 1;       // One-time use for referral promo

// ─────────────────────────────────────────────────────────────────────────────
// Generate unique referral code for a teacher
// ─────────────────────────────────────────────────────────────────────────────
function generateReferralCode(teacherId: string, fullName: string): string {
  const namePart = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  const idPart = teacherId.slice(-4).toUpperCase();
  const random = Math.random().toString(36).substr(2, 3).toUpperCase();
  return `REF${namePart}${idPart}${random}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referrals/my-code
// Get the current teacher's referral code (create if doesn't exist)
// ─────────────────────────────────────────────────────────────────────────────
export const getMyReferralCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    // Generate code if doesn't exist
    if (!teacherProfile.referralCode) {
      teacherProfile.referralCode = generateReferralCode(
        teacherProfile._id.toString(),
        teacherProfile.basicDetails?.fullName || 'TEACHER'
      );
      await teacherProfile.save();
    }

    // Get referral stats
    const referralStats = await Referral.aggregate([
      { $match: { referrerId: teacherProfile._id } },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          registered: { $sum: { $cond: [{ $eq: ['$status', 'registered'] }, 1, 0] } },
          rewarded: { $sum: { $cond: [{ $eq: ['$status', 'rewarded'] }, 1, 0] } },
        },
      },
    ]);

    const stats = referralStats[0] || {
      totalReferrals: 0,
      pending: 0,
      registered: 0,
      rewarded: 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        referralCode: teacherProfile.referralCode,
        stats: {
          totalReferrals: stats.totalReferrals,
          pending: stats.pending,
          registered: stats.registered,
          rewarded: stats.rewarded,
          totalRewardsEarned: teacherProfile.totalRewardsEarned || 0,
        },
        shareMessage: `Join me on Tuition Marketplace! Use my referral code ${teacherProfile.referralCode} to get 20% off your first subscription. Download the app and start teaching today!`,
      },
    });
  } catch (error) {
    console.error('getMyReferralCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get referral code.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referrals/my-referrals
// Get all referrals made by the current teacher
// ─────────────────────────────────────────────────────────────────────────────
export const getMyReferrals = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const status = req.query.status as string | undefined;

    const filter: any = { referrerId: teacherProfile._id };
    if (status) filter.status = status;

    const [referrals, total] = await Promise.all([
      Referral.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Referral.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        referrals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('getMyReferrals error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get referrals.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/referrals/track-click
// Track when someone clicks a referral link (creates pending referral)
// ─────────────────────────────────────────────────────────────────────────────
export const trackReferralClick = async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body as { code: string };

    if (!code) {
      return res.status(400).json({ success: false, message: 'Referral code is required.' });
    }

    // Find the referrer by code
    const referrer = await TeacherProfile.findOne({ referralCode: code.trim().toUpperCase() });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code.' });
    }

    // Check if there's already a pending referral from this IP (prevent spam)
    const existingPending = await Referral.findOne({
      referrerId: referrer._id,
      ipAddress: req.ip,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    });

    if (existingPending) {
      return res.status(200).json({
        success: true,
        data: {
          referralId: existingPending.referralId,
          message: 'Referral already tracked. Complete registration to claim reward.',
        },
      });
    }

    // Create pending referral
    const referral = await Referral.create({
      referralId: '',
      referrerId: referrer._id,
      referrerUserId: referrer.userId,
      referrerCode: code.trim().toUpperCase(),
      status: 'pending',
      rewardType: 'credits',
      rewardValue: REFERRAL_REWARD_CREDITS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      source: req.body.source || 'direct',
    });

    return res.status(201).json({
      success: true,
      data: {
        referralId: referral.referralId,
        message: 'Referral tracked. Complete registration to claim reward.',
      },
    });
  } catch (error) {
    console.error('trackReferralClick error:', error);
    return res.status(500).json({ success: false, message: 'Failed to track referral.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/referrals/register
// Called when a new teacher registers with a referral code
// ─────────────────────────────────────────────────────────────────────────────
export const registerWithReferral = async (req: AuthRequest, res: Response) => {
  try {
    const { code, newTeacherId, newTeacherName, newTeacherEmail } = req.body as {
      code: string;
      newTeacherId: string;
      newTeacherName: string;
      newTeacherEmail: string;
    };

    if (!code || !newTeacherId || !newTeacherName || !newTeacherEmail) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Prevent self-referral
    const referrer = await TeacherProfile.findOne({ referralCode: code.trim().toUpperCase() });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code.' });
    }

    if (referrer._id.toString() === newTeacherId) {
      return res.status(400).json({ success: false, message: 'Cannot refer yourself.' });
    }

    // Check if this teacher was already referred
    const existingReferral = await Referral.findOne({
      $or: [
        { referredId: newTeacherId },
        { referredEmail: newTeacherEmail.toLowerCase() },
      ],
    });

    if (existingReferral) {
      return res.status(409).json({ success: false, message: 'Teacher already referred by someone else.' });
    }

    // Update pending referral or create new one
    const referral = await Referral.findOneAndUpdate(
      {
        referrerId: referrer._id,
        status: 'pending',
        $or: [
          { referredId: { $exists: false } },
          { referredId: null },
        ],
      },
      {
        $set: {
          referredId: newTeacherId,
          referredName: newTeacherName,
          referredEmail: newTeacherEmail.toLowerCase(),
          status: 'registered',
          registeredAt: new Date(),
        },
      },
      { sort: { createdAt: -1 }, new: true }
    );

    if (!referral) {
      // Create new referral if no pending one found
      await Referral.create({
        referralId: '',
        referrerId: referrer._id,
        referrerUserId: referrer.userId,
        referrerCode: code.trim().toUpperCase(),
        referredId: newTeacherId,
        referredName: newTeacherName,
        referredEmail: newTeacherEmail.toLowerCase(),
        status: 'registered',
        registeredAt: new Date(),
        rewardType: 'credits',
        rewardValue: REFERRAL_REWARD_CREDITS,
      });
    }

    // Create welcome promo code for new teacher
    const welcomePromoCode = `WELCOME${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    await PromoCode.create({
      code: welcomePromoCode,
      description: `Welcome bonus - ${REFERRAL_PROMO_DISCOUNT}% off your first subscription (referral from ${referrer.basicDetails?.fullName || 'a teacher'})`,
      discountType: 'percent',
      discountValue: REFERRAL_PROMO_DISCOUNT,
      maxDiscountAmount: 500, // Max ₹500 discount
      applicableTo: 'subscription',
      applicablePlans: ['starter', 'professional', 'premium'],
      minOrderAmount: 299,
      usageLimit: 1,
      perUserLimit: 1,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      restrictedToUserIds: [new mongoose.Types.ObjectId(newTeacherId)],
      createdBy: referrer.userId,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Referral registered successfully.',
        welcomePromoCode,
        discount: REFERRAL_PROMO_DISCOUNT,
      },
    });
  } catch (error) {
    console.error('registerWithReferral error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register referral.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/referrals/process-reward
// Process reward when referred teacher makes first purchase
// ─────────────────────────────────────────────────────────────────────────────
export const processReferralReward = async (req: AuthRequest, res: Response) => {
  try {
    const { referredTeacherId } = req.body as { referredTeacherId: string };

    if (!referredTeacherId) {
      return res.status(400).json({ success: false, message: 'referredTeacherId is required.' });
    }

    // Find the referral
    const referral = await Referral.findOne({
      referredId: referredTeacherId,
      status: { $in: ['registered', 'first_purchase'] },
    });

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found or already rewarded.' });
    }

    if (referral.rewardGranted) {
      return res.status(400).json({ success: false, message: 'Reward already granted.' });
    }

    // Get referrer's subscription for credit balance
    const { TeacherSubscription } = await import('../models/TeacherSubscription');
    const referrerSub = await TeacherSubscription.findOne({
      teacherId: referral.referrerId,
      status: 'active',
    });

    const balanceBefore = referrerSub?.credits?.creditsRemaining ?? 0;
    const balanceAfter = balanceBefore + REFERRAL_REWARD_CREDITS;

    // Grant credits to referrer
    if (referrerSub) {
      referrerSub.credits = {
        ...(referrerSub.credits as any),
        creditsRemaining: balanceAfter,
      };
      await referrerSub.save();
    }

    // Create credit transaction
    const creditTx = await CreditTransaction.create({
      transactionId: '',
      teacherId: referral.referrerId,
      userId: referral.referrerUserId,
      type: 'BONUS_CREDIT',
      amount: REFERRAL_REWARD_CREDITS,
      balanceBefore,
      balanceAfter,
      description: `Referral reward - ${referral.referredName} joined and made first purchase`,
      metadata: {
        bonusReason: 'referral_reward',
        referralId: referral.referralId,
        referredTeacherId,
      },
    });

    // Update referral status
    referral.status = 'rewarded';
    referral.rewardGranted = true;
    referral.rewardedAt = new Date();
    referral.firstPurchaseAt = new Date();
    referral.creditTransactionId = creditTx._id as mongoose.Types.ObjectId;
    await referral.save();

    // Update referrer stats
    await TeacherProfile.findByIdAndUpdate(referral.referrerId, {
      $inc: { referralCount: 1, totalRewardsEarned: REFERRAL_REWARD_CREDITS },
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Referral reward granted successfully.',
        creditsGranted: REFERRAL_REWARD_CREDITS,
        referralId: referral.referralId,
      },
    });
  } catch (error) {
    console.error('processReferralReward error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process referral reward.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/referrals
// Admin: Get all referrals with filtering
// ─────────────────────────────────────────────────────────────────────────────
export const getAllReferrals = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const status = req.query.status as string | undefined;
    const referrerCode = req.query.referrerCode as string | undefined;

    const filter: any = {};
    if (status) filter.status = status;
    if (referrerCode) filter.referrerCode = referrerCode.toUpperCase();

    const [referrals, total] = await Promise.all([
      Referral.find(filter)
        .populate('referrerId', 'basicDetails.fullName basicDetails.email')
        .populate('referredId', 'basicDetails.fullName basicDetails.email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Referral.countDocuments(filter),
    ]);

    // Get aggregate stats
    const stats = await Referral.aggregate([
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          registered: { $sum: { $cond: [{ $eq: ['$status', 'registered'] }, 1, 0] } },
          rewarded: { $sum: { $cond: [{ $eq: ['$status', 'rewarded'] }, 1, 0] } },
          expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
          totalCreditsGranted: { $sum: { $cond: [{ $eq: ['$rewardGranted', true] }, '$rewardValue', 0] } },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        referrals,
        stats: stats[0] || {
          totalReferrals: 0,
          pending: 0,
          registered: 0,
          rewarded: 0,
          expired: 0,
          totalCreditsGranted: 0,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('getAllReferrals error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get referrals.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/referrals/top-referrers
// Admin: Get top performing referrers
// ─────────────────────────────────────────────────────────────────────────────
export const getTopReferrers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);

    const topReferrers = await Referral.aggregate([
      {
        $group: {
          _id: '$referrerId',
          totalReferrals: { $sum: 1 },
          rewarded: { $sum: { $cond: [{ $eq: ['$status', 'rewarded'] }, 1, 0] } },
          totalCreditsEarned: { $sum: { $cond: [{ $eq: ['$rewardGranted', true] }, '$rewardValue', 0] } },
        },
      },
      { $sort: { rewarded: -1, totalReferrals: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'teacherprofiles',
          localField: '_id',
          foreignField: '_id',
          as: 'teacher',
        },
      },
      { $unwind: '$teacher' },
      {
        $project: {
          _id: 0,
          teacherId: '$_id',
          fullName: '$teacher.basicDetails.fullName',
          email: '$teacher.basicDetails.email',
          referralCode: '$teacher.referralCode',
          totalReferrals: 1,
          rewarded: 1,
          totalCreditsEarned: 1,
          conversionRate: { $multiply: [{ $divide: ['$rewarded', '$totalReferrals'] }, 100] },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: { topReferrers },
    });
  } catch (error) {
    console.error('getTopReferrers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get top referrers.' });
  }
};
