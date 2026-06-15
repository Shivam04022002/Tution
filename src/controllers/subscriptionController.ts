import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { SubscriptionPlan, IPlanLimits } from '../models/SubscriptionPlan';
import { TeacherSubscription } from '../models/TeacherSubscription';
import { TeacherProfile } from '../models/TeacherProfile';

// ─────────────────────────────────────────────────────────────────────────────
// Default plan definitions (seeded on first call if DB is empty)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_PLANS = [
  {
    planId: 'plan_free',
    name: 'free',
    displayName: 'Free',
    description: 'Get started with basic platform access',
    price: 0,
    annualPrice: 0,
    limits: {
      applicationsPerMonth: 5,
      leadUnlocksPerMonth: 3,
      creditsPerMonth: 5,
      profileVisibilityBoost: 0,
      analyticsAccess: 'none' as const,
      priorityPlacement: false,
      prioritySupport: false,
      demoInsights: false,
    },
    features: [
      '5 applications per month',
      '3 lead unlocks per month',
      '5 credits per month',
      'Basic marketplace listing',
      'Standard profile visibility',
    ],
    badge: 'Free',
    badgeColor: '#94A3B8',
    sortOrder: 0,
    isActive: true,
    isDefault: true,
  },
  {
    planId: 'plan_starter',
    name: 'starter',
    displayName: 'Starter',
    description: 'More reach, more applications',
    price: 299,
    annualPrice: 2990,
    limits: {
      applicationsPerMonth: 15,
      leadUnlocksPerMonth: 10,
      creditsPerMonth: 25,
      profileVisibilityBoost: 20,
      analyticsAccess: 'basic' as const,
      priorityPlacement: false,
      prioritySupport: false,
      demoInsights: false,
    },
    features: [
      '15 applications per month',
      '10 lead unlocks per month',
      '25 credits per month',
      '20% visibility boost',
      'Basic analytics dashboard',
      'Enhanced profile badge',
    ],
    badge: 'Starter',
    badgeColor: '#3B82F6',
    sortOrder: 1,
    isActive: true,
    isDefault: false,
  },
  {
    planId: 'plan_professional',
    name: 'professional',
    displayName: 'Professional',
    description: 'Priority access and advanced insights',
    price: 699,
    annualPrice: 6990,
    limits: {
      applicationsPerMonth: 40,
      leadUnlocksPerMonth: 25,
      creditsPerMonth: 75,
      profileVisibilityBoost: 50,
      analyticsAccess: 'advanced' as const,
      priorityPlacement: true,
      prioritySupport: false,
      demoInsights: true,
    },
    features: [
      '40 applications per month',
      '25 lead unlocks per month',
      '75 credits per month',
      '50% visibility boost',
      'Priority marketplace ranking',
      'Advanced analytics & trends',
      'Demo performance insights',
      'Priority badge on profile',
    ],
    badge: 'Pro',
    badgeColor: '#8B5CF6',
    sortOrder: 2,
    isActive: true,
    isDefault: false,
  },
  {
    planId: 'plan_premium',
    name: 'premium',
    displayName: 'Premium',
    description: 'Unlimited access with maximum visibility',
    price: 1499,
    annualPrice: 14990,
    limits: {
      applicationsPerMonth: -1,
      leadUnlocksPerMonth: -1,
      creditsPerMonth: -1,
      profileVisibilityBoost: 100,
      analyticsAccess: 'full' as const,
      priorityPlacement: true,
      prioritySupport: true,
      demoInsights: true,
    },
    features: [
      'Unlimited applications',
      'Unlimited lead unlocks',
      'Unlimited credits',
      'Maximum visibility boost',
      'Priority marketplace ranking',
      'Full analytics suite',
      'Demo performance insights',
      'Priority customer support',
      'Premium verified badge',
    ],
    badge: 'Premium',
    badgeColor: '#F59E0B',
    sortOrder: 3,
    isActive: true,
    isDefault: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed plans if DB is empty
// ─────────────────────────────────────────────────────────────────────────────
async function ensurePlansSeeded(): Promise<void> {
  const count = await SubscriptionPlan.countDocuments();
  if (count === 0) {
    await SubscriptionPlan.insertMany(DEFAULT_PLANS);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions/plans
// Returns all active subscription plans
// ─────────────────────────────────────────────────────────────────────────────
export const getPlans = async (req: AuthRequest, res: Response) => {
  try {
    await ensurePlansSeeded();

    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    console.error('getPlans error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions/current
// Returns teacher's current subscription + usage
// ─────────────────────────────────────────────────────────────────────────────
export const getCurrentSubscription = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    // Find active subscription
    const subscription = await TeacherSubscription.findOne({
      teacherId: teacherProfile._id,
      status: 'active',
    }).populate('planId').lean();

    // Get the plan limits
    const planName = subscription?.planName || teacherProfile.subscription?.currentPlan || 'free';
    await ensurePlansSeeded();
    const plan = await SubscriptionPlan.findOne({ name: planName as any, isActive: true }).lean();

    // Compute usage for current period
    const now = new Date();
    const periodStart = subscription?.usage?.periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = subscription?.usage?.periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const usage = {
      applicationsUsed: subscription?.usage?.applicationsUsed ?? 0,
      leadUnlocksUsed: subscription?.usage?.leadUnlocksUsed ?? 0,
      periodStart,
      periodEnd,
    };

    const limits: IPlanLimits = plan?.limits || DEFAULT_PLANS[0].limits;

    return res.status(200).json({
      success: true,
      data: {
        subscription: subscription ? {
          subscriptionId: subscription.subscriptionId,
          planName: subscription.planName,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
        } : null,
        currentPlan: planName,
        plan: plan || DEFAULT_PLANS.find(p => p.name === planName),
        usage,
        limits,
        remaining: {
          applications: limits.applicationsPerMonth === -1
            ? -1
            : Math.max(0, limits.applicationsPerMonth - usage.applicationsUsed),
          leadUnlocks: limits.leadUnlocksPerMonth === -1
            ? -1
            : Math.max(0, limits.leadUnlocksPerMonth - usage.leadUnlocksUsed),
        },
      },
    });
  } catch (error) {
    console.error('getCurrentSubscription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current subscription',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions/select
// Select or change subscription plan (no payment - just plan selection)
// Body: { planName: 'free' | 'starter' | 'professional' | 'premium' }
// ─────────────────────────────────────────────────────────────────────────────
export const selectPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { planName } = req.body as { planName: string };
    if (!planName || !['free', 'starter', 'professional', 'premium'].includes(planName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan. Must be one of: free, starter, professional, premium',
      });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    await ensurePlansSeeded();
    const plan = await SubscriptionPlan.findOne({ name: planName as any, isActive: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Determine action
    const currentPlan = teacherProfile.subscription?.currentPlan || 'free';
    const currentSortOrder = DEFAULT_PLANS.findIndex(p => p.name === currentPlan);
    const newSortOrder = DEFAULT_PLANS.findIndex(p => p.name === planName);
    let action: 'subscribed' | 'upgraded' | 'downgraded' = 'subscribed';
    if (currentPlan !== 'free' && currentPlan !== planName) {
      action = newSortOrder > currentSortOrder ? 'upgraded' : 'downgraded';
    }

    // Cancel existing active subscription if any
    await TeacherSubscription.updateMany(
      { teacherId: teacherProfile._id, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: now } }
    );

    // Determine credits for the new plan
    const creditsForPlan = plan.limits.creditsPerMonth ?? DEFAULT_PLANS.find(p => p.name === planName)?.limits.creditsPerMonth ?? 5;
    const creditResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Create new subscription
    const subscription = await TeacherSubscription.create({
      subscriptionId: '', // will be generated by pre-save
      teacherId: teacherProfile._id,
      userId: req.user._id,
      planId: plan._id,
      planName: plan.name,
      status: 'active',
      startDate: periodStart,
      endDate: periodEnd,
      autoRenew: plan.name !== 'free',
      usage: {
        applicationsUsed: 0,
        leadUnlocksUsed: 0,
        periodStart,
        periodEnd,
      },
      credits: {
        creditsRemaining: creditsForPlan === -1 ? 999999 : creditsForPlan,
        creditsUsed: 0,
        creditResetDate,
      },
      history: [{
        action,
        fromPlan: currentPlan,
        toPlan: planName,
        date: now,
      }],
    });

    // Update TeacherProfile subscription fields
    teacherProfile.subscription = {
      currentPlan: plan.name as any,
      subscriptionStatus: 'active',
      subscriptionStartDate: periodStart,
      subscriptionEndDate: periodEnd,
      autoRenew: plan.name !== 'free',
    };
    await teacherProfile.save();

    return res.status(200).json({
      success: true,
      message: `Successfully ${action} to ${plan.displayName} plan`,
      data: {
        subscription: {
          subscriptionId: subscription.subscriptionId,
          planName: subscription.planName,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
        },
        plan: {
          name: plan.name,
          displayName: plan.displayName,
          limits: plan.limits,
          features: plan.features,
          badge: plan.badge,
          badgeColor: plan.badgeColor,
        },
        action,
      },
    });
  } catch (error) {
    console.error('selectPlan error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to select plan',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions/cancel
// Cancel current subscription (reverts to free)
// Body: { reason?: string }
// ─────────────────────────────────────────────────────────────────────────────
export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { reason } = req.body as { reason?: string };

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const currentPlan = teacherProfile.subscription?.currentPlan || 'free';
    if (currentPlan === 'free') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel free plan',
      });
    }

    const now = new Date();

    // Cancel active subscription
    const subscription = await TeacherSubscription.findOneAndUpdate(
      { teacherId: teacherProfile._id, status: 'active' },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: reason || 'User requested cancellation',
          autoRenew: false,
        },
        $push: {
          history: {
            action: 'cancelled',
            fromPlan: currentPlan,
            toPlan: 'free',
            date: now,
            note: reason,
          },
        },
      },
      { new: true }
    );

    // Revert TeacherProfile to free
    teacherProfile.subscription = {
      currentPlan: 'free',
      subscriptionStatus: 'cancelled',
      subscriptionStartDate: undefined,
      subscriptionEndDate: undefined,
      autoRenew: false,
    };
    await teacherProfile.save();

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled. You are now on the Free plan.',
      data: {
        previousPlan: currentPlan,
        currentPlan: 'free',
        cancelledAt: now,
      },
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Limits Engine — utility functions (exported for use by other controllers)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTeacherLimits(userId: mongoose.Types.ObjectId): Promise<{
  plan: string;
  limits: IPlanLimits;
  usage: { applicationsUsed: number; leadUnlocksUsed: number };
  remaining: { applications: number; leadUnlocks: number };
}> {
  const teacherProfile = await TeacherProfile.findOne({ userId });
  const planName = teacherProfile?.subscription?.currentPlan || 'free';

  await ensurePlansSeeded();
  const plan = await SubscriptionPlan.findOne({ name: planName, isActive: true }).lean();
  const limits: IPlanLimits = plan?.limits || DEFAULT_PLANS[0].limits;

  const subscription = await TeacherSubscription.findOne({
    teacherId: teacherProfile?._id,
    status: 'active',
  }).lean();

  const usage = {
    applicationsUsed: subscription?.usage?.applicationsUsed ?? 0,
    leadUnlocksUsed: subscription?.usage?.leadUnlocksUsed ?? 0,
  };

  return {
    plan: planName,
    limits,
    usage,
    remaining: {
      applications: limits.applicationsPerMonth === -1
        ? -1
        : Math.max(0, limits.applicationsPerMonth - usage.applicationsUsed),
      leadUnlocks: limits.leadUnlocksPerMonth === -1
        ? -1
        : Math.max(0, limits.leadUnlocksPerMonth - usage.leadUnlocksUsed),
    },
  };
}

export async function canTeacherApply(userId: mongoose.Types.ObjectId): Promise<{ allowed: boolean; reason?: string }> {
  const { remaining, plan } = await getTeacherLimits(userId);
  if (remaining.applications === -1) return { allowed: true };
  if (remaining.applications > 0) return { allowed: true };
  return {
    allowed: false,
    reason: `You have used all ${plan === 'free' ? '5' : 'your'} applications for this month. Upgrade your plan for more.`,
  };
}

export async function canTeacherUnlockLead(userId: mongoose.Types.ObjectId): Promise<{ allowed: boolean; reason?: string }> {
  const { remaining, plan } = await getTeacherLimits(userId);
  if (remaining.leadUnlocks === -1) return { allowed: true };
  if (remaining.leadUnlocks > 0) return { allowed: true };
  return {
    allowed: false,
    reason: `You have used all lead unlocks for this month. Upgrade your plan for more.`,
  };
}

export async function incrementUsage(userId: mongoose.Types.ObjectId, field: 'applicationsUsed' | 'leadUnlocksUsed'): Promise<void> {
  const teacherProfile = await TeacherProfile.findOne({ userId });
  if (!teacherProfile) return;

  await TeacherSubscription.findOneAndUpdate(
    { teacherId: teacherProfile._id, status: 'active' },
    { $inc: { [`usage.${field}`]: 1 } }
  );
}
