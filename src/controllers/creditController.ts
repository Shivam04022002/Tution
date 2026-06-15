import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { CreditTransaction } from '../models/CreditTransaction';
import { TeacherSubscription } from '../models/TeacherSubscription';
import { TeacherProfile } from '../models/TeacherProfile';
import { LeadUnlock } from '../models/LeadUnlock';
import { SubscriptionPlan } from '../models/SubscriptionPlan';

// Credit allocation per plan (mirrored from subscriptionController DEFAULT_PLANS)
const PLAN_CREDITS: Record<string, number> = {
  free: 5,
  starter: 25,
  professional: 75,
  premium: -1, // unlimited
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get teacher's active subscription + credit balance
// ─────────────────────────────────────────────────────────────────────────────
async function getTeacherCreditState(userId: mongoose.Types.ObjectId) {
  const teacherProfile = await TeacherProfile.findOne({ userId });
  if (!teacherProfile) return null;

  const subscription = await TeacherSubscription.findOne({
    teacherId: teacherProfile._id,
    status: 'active',
  });

  const planName = subscription?.planName || teacherProfile.subscription?.currentPlan || 'free';
  const totalCredits = PLAN_CREDITS[planName] ?? 5;
  const isUnlimited = totalCredits === -1;

  const creditsRemaining = subscription?.credits?.creditsRemaining ?? (isUnlimited ? 999999 : totalCredits);
  const creditsUsed = subscription?.credits?.creditsUsed ?? 0;
  const creditResetDate = subscription?.credits?.creditResetDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  return {
    teacherProfile,
    subscription,
    planName,
    totalCredits,
    isUnlimited,
    creditsRemaining: isUnlimited ? -1 : creditsRemaining,
    creditsUsed,
    creditResetDate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/credits/balance
// ─────────────────────────────────────────────────────────────────────────────
export const getCreditBalance = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const state = await getTeacherCreditState(req.user._id);
    if (!state) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        planName: state.planName,
        creditsRemaining: state.creditsRemaining,
        creditsUsed: state.creditsUsed,
        totalCredits: state.totalCredits,
        isUnlimited: state.isUnlimited,
        creditResetDate: state.creditResetDate,
      },
    });
  } catch (error) {
    console.error('getCreditBalance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch credit balance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/credits/history
// Query params: ?page=1&limit=20&type=LEAD_UNLOCK
// ─────────────────────────────────────────────────────────────────────────────
export const getCreditHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = req.query.type as string;

    const filter: any = { teacherId: teacherProfile._id };
    if (type && ['CREDIT_GRANTED', 'LEAD_UNLOCK', 'CREDIT_REFUND', 'BONUS_CREDIT', 'PLAN_UPGRADE'].includes(type)) {
      filter.type = type;
    }

    const [transactions, total] = await Promise.all([
      CreditTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CreditTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('getCreditHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch credit history',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/credits/unlock-lead
// Body: { requirementId: string }
// ─────────────────────────────────────────────────────────────────────────────
export const unlockLead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { requirementId } = req.body as { requirementId: string };
    if (!requirementId) {
      return res.status(400).json({ success: false, message: 'requirementId is required' });
    }

    const state = await getTeacherCreditState(req.user._id);
    if (!state) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Check subscription active
    if (!state.subscription || state.subscription.status !== 'active') {
      return res.status(403).json({ success: false, message: 'No active subscription. Please subscribe first.' });
    }

    // Check if already unlocked
    const existingUnlock = await LeadUnlock.findOne({
      tutorId: state.teacherProfile._id,
      requirementId: requirementId,
      unlockStatus: { $in: ['active', 'expired'] },
    });
    if (existingUnlock) {
      return res.status(409).json({
        success: false,
        message: 'Lead already unlocked',
        data: {
          unlockId: existingUnlock.unlockId,
          parentContactDetails: existingUnlock.parentContactDetails,
          unlockedAt: existingUnlock.unlockedAt,
        },
      });
    }

    // Check credits
    if (!state.isUnlimited && state.creditsRemaining <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient credits. Upgrade your plan or wait for monthly reset.',
        data: {
          creditsRemaining: 0,
          creditResetDate: state.creditResetDate,
        },
      });
    }

    // Find the requirement to get parent info
    const ParentRequirement = mongoose.model('ParentRequirement');
    const requirement = await ParentRequirement.findOne({
      $or: [
        { requirementId: requirementId },
        ...(mongoose.Types.ObjectId.isValid(requirementId) ? [{ _id: requirementId }] : []),
      ],
    }).populate('parentId', 'name phone email');

    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found' });
    }

    // Check requirement is not hidden
    if (state.teacherProfile.hiddenRequirements?.includes(requirement._id)) {
      return res.status(400).json({ success: false, message: 'Cannot unlock a hidden requirement' });
    }

    const parentUser = requirement.parentId as any;
    const parentContact = {
      parentName: parentUser?.name || 'Parent',
      mobileNumber: parentUser?.phone || '0000000000',
      email: parentUser?.email || 'unknown@email.com',
      address: (requirement as any).location?.address || (requirement as any).location?.city || 'Not provided',
    };

    // Calculate balances
    const balanceBefore = state.isUnlimited ? 999999 : state.creditsRemaining;
    const balanceAfter = state.isUnlimited ? 999999 : Math.max(0, state.creditsRemaining - 1);

    // Generate unlock ID
    const ulkTs = Date.now().toString(36).toUpperCase();
    const ulkRand = Math.random().toString(36).substr(2, 5).toUpperCase();
    const unlockId = `ULK-${ulkTs}-${ulkRand}`;

    // Create LeadUnlock record
    const leadUnlock = await LeadUnlock.create({
      requirementId: requirement._id,
      tutorId: state.teacherProfile._id,
      parentId: parentUser?._id || req.user._id,
      unlockId,
      paymentDetails: {
        amount: 0,
        currency: 'INR',
        paymentMethod: 'wallet',
        transactionId: `CREDIT-${ulkTs}-${ulkRand}`,
        paymentStatus: 'completed',
        paymentDate: new Date(),
      },
      parentContactDetails: parentContact,
      unlockStatus: 'active',
    });

    // Create credit transaction
    await CreditTransaction.create({
      transactionId: '',
      teacherId: state.teacherProfile._id,
      userId: req.user._id,
      type: 'LEAD_UNLOCK',
      amount: -1,
      balanceBefore,
      balanceAfter,
      description: `Lead unlock: ${requirementId}`,
      metadata: {
        requirementId,
        unlockId: leadUnlock.unlockId,
      },
    });

    // Deduct credit from subscription
    if (!state.isUnlimited && state.subscription) {
      await TeacherSubscription.findByIdAndUpdate(state.subscription._id, {
        $inc: {
          'credits.creditsRemaining': -1,
          'credits.creditsUsed': 1,
          'usage.leadUnlocksUsed': 1,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lead unlocked successfully',
      data: {
        unlockId: leadUnlock.unlockId,
        parentContactDetails: parentContact,
        creditsRemaining: balanceAfter === 999999 ? -1 : balanceAfter,
        creditsUsed: state.creditsUsed + 1,
      },
    });
  } catch (error) {
    console.error('unlockLead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlock lead',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/credits/refund
// Body: { unlockId: string, reason: string }
// Admin-only or system-level refund
// ─────────────────────────────────────────────────────────────────────────────
export const refundCredit = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { unlockId, reason } = req.body as { unlockId: string; reason: string };
    if (!unlockId || !reason) {
      return res.status(400).json({ success: false, message: 'unlockId and reason are required' });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Find the unlock record
    const leadUnlock = await LeadUnlock.findOne({
      unlockId,
      tutorId: teacherProfile._id,
    });
    if (!leadUnlock) {
      return res.status(404).json({ success: false, message: 'Unlock record not found' });
    }
    if (leadUnlock.unlockStatus === 'refunded') {
      return res.status(409).json({ success: false, message: 'Credit already refunded for this unlock' });
    }

    // Check if there's already a refund transaction for this unlock
    const existingRefund = await CreditTransaction.findOne({
      teacherId: teacherProfile._id,
      type: 'CREDIT_REFUND',
      'metadata.unlockId': unlockId,
    });
    if (existingRefund) {
      return res.status(409).json({ success: false, message: 'Credit already refunded for this unlock' });
    }

    // Get current balance
    const subscription = await TeacherSubscription.findOne({
      teacherId: teacherProfile._id,
      status: 'active',
    });

    const balanceBefore = subscription?.credits?.creditsRemaining ?? 0;
    const balanceAfter = balanceBefore + 1;

    // Create refund transaction
    await CreditTransaction.create({
      transactionId: '',
      teacherId: teacherProfile._id,
      userId: req.user._id,
      type: 'CREDIT_REFUND',
      amount: 1,
      balanceBefore,
      balanceAfter,
      description: `Credit refund for unlock: ${unlockId}`,
      metadata: {
        unlockId,
        refundReason: reason,
      },
    });

    // Add credit back to subscription
    if (subscription) {
      await TeacherSubscription.findByIdAndUpdate(subscription._id, {
        $inc: {
          'credits.creditsRemaining': 1,
          'credits.creditsUsed': -1,
          'usage.leadUnlocksUsed': -1,
        },
      });
    }

    // Mark unlock as refunded
    leadUnlock.unlockStatus = 'refunded';
    await leadUnlock.save();

    return res.status(200).json({
      success: true,
      message: 'Credit refunded successfully',
      data: {
        creditsRemaining: balanceAfter,
        refundedUnlockId: unlockId,
      },
    });
  } catch (error) {
    console.error('refundCredit error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refund credit',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Check if a teacher has unlocked a specific requirement
// Exported for use in other controllers (e.g. requirement detail)
// ─────────────────────────────────────────────────────────────────────────────
export async function hasTeacherUnlockedLead(
  teacherProfileId: mongoose.Types.ObjectId,
  requirementId: string,
): Promise<{ unlocked: boolean; unlock?: any }> {
  const unlock = await LeadUnlock.findOne({
    tutorId: teacherProfileId,
    $or: [
      { requirementId: requirementId },
      ...(mongoose.Types.ObjectId.isValid(requirementId) ? [{ requirementId: new mongoose.Types.ObjectId(requirementId) }] : []),
    ],
    unlockStatus: { $in: ['active', 'expired'] },
  }).lean();

  return unlock
    ? { unlocked: true, unlock: { unlockId: unlock.unlockId, parentContactDetails: unlock.parentContactDetails, unlockedAt: unlock.unlockedAt } }
    : { unlocked: false };
}
