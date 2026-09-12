import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ParentSubscriptionPlan } from '../models/ParentSubscriptionPlan';
import { ParentSubscription } from '../models/ParentSubscription';
import { Payment } from '../models/Payment';
import { createOrder, verifyPayment as verifyRazorpaySignature } from '../services/razorpayService';
import { getActiveSubscription } from '../services/parentSubscriptionService';

// ─────────────────────────────────────────────────────────────────────────────
// Default plan definitions (seeded on first call if DB is empty) — placeholder
// dev/test pricing, easily edited later.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_PARENT_PLANS = [
  {
    planId: 'plan_parent_monthly',
    name: 'monthly',
    displayName: 'Monthly Access',
    description: 'Contact tutors and request demos for 30 days',
    price: 199,
    durationDays: 30,
    contactLimit: -1,
    features: ['Unlimited tutor contact requests', 'Unlimited demo requests', '30 days validity'],
    badge: 'Monthly',
    badgeColor: '#3B82F6',
    sortOrder: 0,
    isActive: true,
    isDefault: true,
  },
  {
    planId: 'plan_parent_quarterly',
    name: 'quarterly',
    displayName: 'Quarterly Access',
    description: 'Best value for an active tutor search',
    price: 499,
    durationDays: 90,
    contactLimit: -1,
    features: ['Everything in Monthly', '90 days validity', 'Priority support'],
    badge: 'Quarterly',
    badgeColor: '#8B5CF6',
    sortOrder: 1,
    isActive: true,
    isDefault: false,
  },
  {
    planId: 'plan_parent_annual',
    name: 'annual',
    displayName: 'Annual Access',
    description: 'Maximum savings for the full academic year',
    price: 1499,
    durationDays: 365,
    contactLimit: -1,
    features: ['Everything in Quarterly', '365 days validity', 'Best value per month'],
    badge: 'Annual',
    badgeColor: '#F59E0B',
    sortOrder: 2,
    isActive: true,
    isDefault: false,
  },
];

const GST_RATE = 0.18;

function generatePaymentId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `PAY-${ts}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed plans if DB is empty. Called defensively at the top of every handler
// (no migration framework exists in this project), mirroring
// subscriptionController.ts's ensurePlansSeeded().
// ─────────────────────────────────────────────────────────────────────────────
async function ensureParentPlansSeeded(): Promise<void> {
  const count = await ParentSubscriptionPlan.countDocuments();
  if (count === 0) {
    await ParentSubscriptionPlan.insertMany(DEFAULT_PARENT_PLANS);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/parent-subscriptions/plans
// ─────────────────────────────────────────────────────────────────────────────
export const getParentPlans = async (req: AuthRequest, res: Response) => {
  try {
    await ensureParentPlansSeeded();
    const plans = await ParentSubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    return res.status(200).json({ success: true, data: { plans } });
  } catch (error) {
    console.error('getParentPlans error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/parent-subscriptions/status
// Returns the current parent's subscription state. Never exposes payment
// details — only what the mobile app needs to gate the Contact button.
// ─────────────────────────────────────────────────────────────────────────────
export const getParentSubscriptionStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    await ensureParentPlansSeeded();
    const subscription = await getActiveSubscription(req.user._id);

    if (!subscription) {
      return res.status(200).json({ success: true, data: { hasActiveSubscription: false, subscription: null } });
    }

    const plan = subscription.planId as any;
    return res.status(200).json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription: {
          id: subscription._id,
          plan: plan && typeof plan === 'object'
            ? { id: plan._id, name: plan.name, displayName: plan.displayName, price: plan.price, duration: plan.durationDays }
            : null,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
      },
    });
  } catch (error) {
    console.error('getParentSubscriptionStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/parent-subscriptions/order
// Body: { planId: string }  (the ParentSubscriptionPlan.planId, not Mongo _id)
// ─────────────────────────────────────────────────────────────────────────────
export const createParentSubscriptionOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    await ensureParentPlansSeeded();

    const { planId } = req.body as { planId: string };
    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required.' });
    }

    const plan = await ParentSubscriptionPlan.findOne({ planId, isActive: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive.' });
    }

    const baseAmount = plan.price;
    const gstAmount = Math.round(baseAmount * GST_RATE);
    const totalAmount = baseAmount + gstAmount;

    const paymentId = generatePaymentId();
    const paymentDoc = await Payment.create({
      paymentId,
      type: 'subscription',
      userId: req.user._id,
      parentId: req.user._id,
      amount: baseAmount,
      currency: 'INR',
      gstAmount,
      totalAmount,
      paymentMethod: 'upi',
      paymentGateway: { orderId: '', status: 'created' },
      status: 'pending',
      invoiceDetails: {
        invoiceNumber: `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
        invoiceDate: new Date(),
        items: [{
          description: `${plan.displayName} — ${plan.durationDays} days`,
          quantity: 1,
          unitPrice: baseAmount,
          gstRate: 18,
          gstAmount,
          total: totalAmount,
        }],
        subtotal: baseAmount,
        gstTotal: gstAmount,
        total: totalAmount,
      },
      metadata: {
        platform: 'mobile',
        source: 'parent_subscription_payment',
        ipAddress: req.ip || 'unknown',
      },
    });

    const razorpayOrder = await createOrder(
      totalAmount,
      paymentId,
      { type: 'parent_subscription', planId, userId: String(req.user._id) },
    );

    (paymentDoc.paymentGateway as any).orderId = razorpayOrder.orderId;
    await paymentDoc.save();

    return res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.orderId,
        keyId: razorpayOrder.keyId,
        amount: razorpayOrder.amount,
        amountInRupees: totalAmount,
        baseAmount,
        gstAmount,
        totalAmount,
        currency: razorpayOrder.currency,
        internalPaymentId: paymentId,
        planId,
        description: `${plan.displayName} — ${plan.durationDays} days`,
        prefill: {
          name: req.user.profile?.firstName || '',
          email: req.user.email || '',
          contact: req.user.phoneNumber || '',
        },
        theme: { color: '#6366F1' },
      },
    });
  } catch (error) {
    console.error('createParentSubscriptionOrder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/parent-subscriptions/verify
// ─────────────────────────────────────────────────────────────────────────────
export const verifyParentSubscriptionPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      internalPaymentId,
      planId,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !internalPaymentId || !planId) {
      return res.status(400).json({ success: false, message: 'Missing required verification fields.' });
    }

    const paymentDoc = await Payment.findOne({ paymentId: internalPaymentId, status: 'pending' });
    if (!paymentDoc) {
      return res.status(404).json({ success: false, message: 'Payment record not found or already processed.' });
    }

    try {
      verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    } catch {
      paymentDoc.status = 'failed';
      paymentDoc.failureReason = 'Signature verification failed';
      (paymentDoc.paymentGateway as any).status = 'failed';
      await paymentDoc.save();
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    paymentDoc.status = 'completed';
    paymentDoc.paymentDate = new Date();
    (paymentDoc.paymentGateway as any).paymentId = razorpayPaymentId;
    (paymentDoc.paymentGateway as any).signature = razorpaySignature;
    (paymentDoc.paymentGateway as any).status = 'captured';
    await paymentDoc.save();

    const plan = await ParentSubscriptionPlan.findOne({ planId, isActive: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }

    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // Cancel any existing active subscription for this parent before activating the new one.
    await ParentSubscription.updateMany(
      { parentId: req.user._id, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: now } }
    );

    const subscription = await ParentSubscription.create({
      subscriptionId: '',
      parentId: req.user._id,
      planId: plan._id,
      planName: plan.name,
      status: 'active',
      startDate,
      endDate,
      autoRenew: false,
      usage: {
        contactsUsed: 0,
        periodStart: startDate,
        periodEnd: endDate,
      },
      history: [{
        action: 'subscribed',
        toPlan: plan.name,
        date: now,
      }],
    });

    return res.status(200).json({
      success: true,
      message: `Successfully subscribed to ${plan.displayName}!`,
      data: {
        id: subscription._id,
        plan: { id: plan._id, name: plan.name, displayName: plan.displayName, price: plan.price, duration: plan.durationDays },
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      },
    });
  } catch (error) {
    console.error('verifyParentSubscriptionPayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
