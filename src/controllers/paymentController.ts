import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Payment } from '../models/Payment';
import { TeacherProfile } from '../models/TeacherProfile';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { TeacherSubscription } from '../models/TeacherSubscription';
import { CreditTransaction } from '../models/CreditTransaction';
import {
  createOrder,
  verifyPayment as verifyRazorpaySignature,
} from '../services/razorpayService';
import { generateInvoice } from '../services/invoiceService';

// ─────────────────────────────────────────────────────────────────────────────
// Credit Packs — buyable credit bundles
// ─────────────────────────────────────────────────────────────────────────────
export interface ICreditPack {
  packId: string;
  name: string;
  credits: number;
  price: number;        // INR
  originalPrice: number;
  savings: number;
  popular: boolean;
  description: string;
}

const CREDIT_PACKS: ICreditPack[] = [
  {
    packId: 'pack_5',
    name: 'Starter Pack',
    credits: 5,
    price: 49,
    originalPrice: 99,
    savings: 50,
    popular: false,
    description: '5 credits to unlock leads',
  },
  {
    packId: 'pack_15',
    name: 'Growth Pack',
    credits: 15,
    price: 129,
    originalPrice: 297,
    savings: 57,
    popular: true,
    description: '15 credits — best for active teachers',
  },
  {
    packId: 'pack_50',
    name: 'Pro Pack',
    credits: 50,
    price: 399,
    originalPrice: 990,
    savings: 60,
    popular: false,
    description: '50 credits — serious lead generation',
  },
  {
    packId: 'pack_100',
    name: 'Mega Pack',
    credits: 100,
    price: 699,
    originalPrice: 1980,
    savings: 65,
    popular: false,
    description: '100 credits — maximum value',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const GST_RATE = 0.18;

function generatePaymentId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `PAY-${ts}-${rand}`;
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${Date.now().toString(36).toUpperCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/credit-packs
// Returns available credit packs for purchase
// ─────────────────────────────────────────────────────────────────────────────
export const getCreditPacks = async (_req: AuthRequest, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        packs: CREDIT_PACKS,
        gstRate: Math.round(GST_RATE * 100),
      },
    });
  } catch (error) {
    console.error('getCreditPacks error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch credit packs' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/subscription/order
// Create a Razorpay order for subscription payment.
// Body: { planName: 'starter' | 'professional' | 'premium', billingCycle: 'monthly' | 'annual', promoCode?: string }
// ─────────────────────────────────────────────────────────────────────────────
export const createSubscriptionOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const { planName, billingCycle = 'monthly', promoCode } = req.body as {
      planName: string;
      billingCycle?: 'monthly' | 'annual';
      promoCode?: string;
    };

    if (!planName || planName === 'free') {
      return res.status(400).json({ success: false, message: 'Invalid plan. Free plan does not require payment.' });
    }

    const validPlans = ['starter', 'professional', 'premium'];
    if (!validPlans.includes(planName)) {
      return res.status(400).json({ success: false, message: `Plan must be one of: ${validPlans.join(', ')}` });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    // Get plan price
    const plan = await SubscriptionPlan.findOne({ name: planName as any, isActive: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive.' });
    }

    let baseAmount = billingCycle === 'annual' ? (plan.annualPrice || plan.price * 10) : plan.price;
    let discount = 0;
    let appliedPromo = null;

    // Validate and apply promo code if provided
    if (promoCode) {
      const { PromoCode } = await import('../models/PromoCode');
      const promo = await PromoCode.findOne({ code: promoCode.trim().toUpperCase() });

      if (promo) {
        const { valid } = await promo.isValid(
          req.user._id as mongoose.Types.ObjectId,
          baseAmount,
          'subscription',
          planName,
        );

        if (valid) {
          discount = promo.computeDiscount(baseAmount);
          appliedPromo = {
            code: promo.code,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            discount,
          };
          baseAmount = baseAmount - discount;
        }
      }
    }

    const gstAmount = Math.round(baseAmount * GST_RATE);
    const totalAmount = baseAmount + gstAmount;

    // Create internal payment record
    const paymentId = generatePaymentId();
    const paymentDoc = await Payment.create({
      paymentId,
      type: 'subscription',
      userId: req.user._id,
      tutorId: teacherProfile._id,
      amount: baseAmount,
      currency: 'INR',
      gstAmount,
      totalAmount,
      paymentMethod: 'upi',
      paymentGateway: { orderId: '', status: 'created' },
      status: 'pending',
      invoiceDetails: {
        invoiceNumber: generateInvoiceNumber(),
        invoiceDate: new Date(),
        items: [{
          description: `${plan.displayName} Plan — ${billingCycle === 'annual' ? 'Annual' : 'Monthly'} Subscription`,
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
        source: 'subscription_payment',
        ipAddress: req.ip || 'unknown',
        promoCode: appliedPromo?.code || null,
        originalAmount: billingCycle === 'annual' ? (plan.annualPrice || plan.price * 10) : plan.price,
        discount: appliedPromo?.discount || 0,
      },
    });

    // Update promo code usage count if applied
    if (appliedPromo) {
      const { PromoCode } = await import('../models/PromoCode');
      await PromoCode.findOneAndUpdate(
        { code: appliedPromo.code },
        { $inc: { usageCount: 1, totalDiscountGiven: appliedPromo.discount } }
      );
    }

    // Create Razorpay order
    const razorpayOrder = await createOrder(
      totalAmount,
      paymentId,
      { type: 'subscription', planName, billingCycle, userId: String(req.user._id), promoCode: appliedPromo?.code || null },
    );

    // Store orderId on payment doc
    (paymentDoc.paymentGateway as any).orderId = razorpayOrder.orderId;
    await paymentDoc.save();

    return res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.orderId,
        keyId: razorpayOrder.keyId,
        amount: razorpayOrder.amount,           // paise
        amountInRupees: totalAmount,
        baseAmount,
        gstAmount,
        totalAmount,
        currency: razorpayOrder.currency,
        internalPaymentId: paymentId,
        planName,
        billingCycle,
        description: `${plan.displayName} Plan — ${billingCycle === 'annual' ? 'Annual' : 'Monthly'}`,
        promo: appliedPromo,
        prefill: {
          name: teacherProfile.basicDetails?.fullName || '',
          email: teacherProfile.basicDetails?.email || req.user.email || '',
          contact: teacherProfile.basicDetails?.mobileNumber || req.user.phoneNumber || '',
        },
        theme: { color: '#6366F1' },
      },
    });
  } catch (error) {
    console.error('createSubscriptionOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create subscription order.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/subscription/verify
// Verify Razorpay payment → activate subscription
// Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, internalPaymentId, planName, billingCycle }
// ─────────────────────────────────────────────────────────────────────────────
export const verifySubscriptionPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      internalPaymentId,
      planName,
      billingCycle = 'monthly',
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !internalPaymentId || !planName) {
      return res.status(400).json({ success: false, message: 'Missing required verification fields.' });
    }

    // 1. Find pending payment
    const paymentDoc = await Payment.findOne({ paymentId: internalPaymentId, status: 'pending' });
    if (!paymentDoc) {
      return res.status(404).json({ success: false, message: 'Payment record not found or already processed.' });
    }

    // 2. Verify signature
    try {
      verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    } catch {
      paymentDoc.status = 'failed';
      paymentDoc.failureReason = 'Signature verification failed';
      (paymentDoc.paymentGateway as any).status = 'failed';
      await paymentDoc.save();
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    // 3. Mark payment completed
    paymentDoc.status = 'completed';
    paymentDoc.paymentDate = new Date();
    (paymentDoc.paymentGateway as any).paymentId = razorpayPaymentId;
    (paymentDoc.paymentGateway as any).signature = razorpaySignature;
    (paymentDoc.paymentGateway as any).status = 'captured';
    await paymentDoc.save();

    // 4. Activate subscription
    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    const plan = await SubscriptionPlan.findOne({ name: planName as any, isActive: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodEnd = billingCycle === 'annual'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Determine action
    const currentPlan = teacherProfile.subscription?.currentPlan || 'free';
    let action: 'subscribed' | 'upgraded' | 'downgraded' = 'subscribed';
    const planOrder = ['free', 'starter', 'professional', 'premium'];
    const currentIdx = planOrder.indexOf(currentPlan);
    const newIdx = planOrder.indexOf(planName);
    if (currentPlan !== 'free' && currentPlan !== planName) {
      action = newIdx > currentIdx ? 'upgraded' : 'downgraded';
    }

    // Cancel existing active subscriptions
    await TeacherSubscription.updateMany(
      { teacherId: teacherProfile._id, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: now } }
    );

    // Determine credits
    const creditsForPlan = plan.limits.creditsPerMonth ?? 5;
    const creditResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Create new subscription
    const subscription = await TeacherSubscription.create({
      subscriptionId: '',
      teacherId: teacherProfile._id,
      userId: req.user._id,
      planId: plan._id,
      planName: plan.name,
      status: 'active',
      startDate: periodStart,
      endDate: periodEnd,
      autoRenew: true,
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

    // Update TeacherProfile
    teacherProfile.subscription = {
      currentPlan: plan.name as any,
      subscriptionStatus: 'active',
      subscriptionStartDate: periodStart,
      subscriptionEndDate: periodEnd,
      autoRenew: true,
    };
    await teacherProfile.save();

    // Create credit transaction for plan credits
    if (creditsForPlan > 0 && creditsForPlan !== -1) {
      await CreditTransaction.create({
        transactionId: '',
        teacherId: teacherProfile._id,
        userId: req.user._id,
        type: 'CREDIT_GRANTED',
        amount: creditsForPlan,
        balanceBefore: 0,
        balanceAfter: creditsForPlan,
        description: `Monthly credits for ${plan.displayName} plan`,
        metadata: { planName },
      });
    }

    // Generate invoice (non-blocking)
    try {
      await generateInvoice({
        paymentId: paymentDoc._id as mongoose.Types.ObjectId,
        userId: req.user._id as mongoose.Types.ObjectId,
        leadUnlockId: undefined as any,
        promoDiscount: (paymentDoc.metadata as any)?.discount || 0,
        baseAmount: paymentDoc.amount,
        description: `${plan.displayName} Plan Subscription`,
        paymentType: 'subscription',
      });
    } catch (invErr) {
      console.error('Invoice generation error (non-fatal):', invErr);
    }

    // Process referral reward (non-blocking)
    try {
      const { processReferralReward } = await import('../controllers/referralController');
      await processReferralReward(
        { ...req, body: { referredTeacherId: teacherProfile._id.toString() } } as any,
        { json: () => {}, status: () => ({ json: () => {} }) } as any
      );
    } catch (refErr) {
      console.error('Referral reward processing error (non-fatal):', refErr);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully ${action} to ${plan.displayName} plan!`,
      data: {
        subscriptionId: subscription.subscriptionId,
        planName: plan.name,
        displayName: plan.displayName,
        status: 'active',
        startDate: periodStart,
        endDate: periodEnd,
        credits: {
          remaining: creditsForPlan === -1 ? 999999 : creditsForPlan,
          total: creditsForPlan,
        },
        payment: {
          paymentId: paymentDoc.paymentId,
          amount: paymentDoc.amount,
          gstAmount: paymentDoc.gstAmount,
          totalAmount: paymentDoc.totalAmount,
          status: 'completed',
          razorpayPaymentId,
        },
      },
    });
  } catch (error) {
    console.error('verifySubscriptionPayment error:', error);
    return res.status(500).json({ success: false, message: 'Subscription payment verification failed.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/credits/order
// Create a Razorpay order for credit pack purchase.
// Body: { packId: string, promoCode?: string }
// ─────────────────────────────────────────────────────────────────────────────
export const createCreditPackOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const { packId, promoCode } = req.body as { packId: string; promoCode?: string };
    if (!packId) {
      return res.status(400).json({ success: false, message: 'packId is required.' });
    }

    const pack = CREDIT_PACKS.find(p => p.packId === packId);
    if (!pack) {
      return res.status(404).json({ success: false, message: 'Credit pack not found.' });
    }

    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    // Check teacher has an active subscription
    const activeSub = await TeacherSubscription.findOne({
      teacherId: teacherProfile._id,
      status: 'active',
    });
    if (!activeSub) {
      return res.status(403).json({ success: false, message: 'You need an active subscription to purchase credit packs.' });
    }

    let baseAmount = pack.price;
    let discount = 0;
    let appliedPromo = null;

    // Validate and apply promo code if provided
    if (promoCode) {
      const { PromoCode } = await import('../models/PromoCode');
      const promo = await PromoCode.findOne({ code: promoCode.trim().toUpperCase() });

      if (promo) {
        const { valid } = await promo.isValid(
          req.user._id as mongoose.Types.ObjectId,
          baseAmount,
          'credit_pack',
          undefined,
          packId,
        );

        if (valid) {
          discount = promo.computeDiscount(baseAmount);
          appliedPromo = {
            code: promo.code,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            discount,
          };
          baseAmount = baseAmount - discount;
        }
      }
    }

    const gstAmount = Math.round(baseAmount * GST_RATE);
    const totalAmount = baseAmount + gstAmount;

    const paymentId = generatePaymentId();
    const paymentDoc = await Payment.create({
      paymentId,
      type: 'lead_unlock', // reuse type for credit purchases
      userId: req.user._id,
      tutorId: teacherProfile._id,
      amount: baseAmount,
      currency: 'INR',
      gstAmount,
      totalAmount,
      paymentMethod: 'upi',
      paymentGateway: { orderId: '', status: 'created' },
      status: 'pending',
      invoiceDetails: {
        invoiceNumber: generateInvoiceNumber(),
        invoiceDate: new Date(),
        items: [{
          description: `${pack.name} — ${pack.credits} Credits`,
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
        source: 'credit_pack_purchase',
        ipAddress: req.ip || 'unknown',
        promoCode: appliedPromo?.code || null,
        originalAmount: pack.price,
        discount: appliedPromo?.discount || 0,
      },
    });

    // Update promo code usage count if applied
    if (appliedPromo) {
      const { PromoCode } = await import('../models/PromoCode');
      await PromoCode.findOneAndUpdate(
        { code: appliedPromo.code },
        { $inc: { usageCount: 1, totalDiscountGiven: appliedPromo.discount } }
      );
    }

    // Create Razorpay order
    const razorpayOrder = await createOrder(
      totalAmount,
      paymentId,
      { type: 'credit_pack', packId, credits: String(pack.credits), userId: String(req.user._id), promoCode: appliedPromo?.code || null },
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
        packId,
        credits: pack.credits,
        description: `${pack.name} — ${pack.credits} Credits`,
        promo: appliedPromo,
        prefill: {
          name: teacherProfile.basicDetails?.fullName || '',
          email: teacherProfile.basicDetails?.email || req.user.email || '',
          contact: teacherProfile.basicDetails?.mobileNumber || req.user.phoneNumber || '',
        },
        theme: { color: '#10B981' },
      },
    });
  } catch (error) {
    console.error('createCreditPackOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create credit pack order.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/credits/verify
// Verify credit pack payment → grant credits
// Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, internalPaymentId, packId }
// ─────────────────────────────────────────────────────────────────────────────
export const verifyCreditPackPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      internalPaymentId,
      packId,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !internalPaymentId || !packId) {
      return res.status(400).json({ success: false, message: 'Missing required verification fields.' });
    }

    const pack = CREDIT_PACKS.find(p => p.packId === packId);
    if (!pack) {
      return res.status(404).json({ success: false, message: 'Credit pack not found.' });
    }

    // 1. Find pending payment
    const paymentDoc = await Payment.findOne({ paymentId: internalPaymentId, status: 'pending' });
    if (!paymentDoc) {
      return res.status(404).json({ success: false, message: 'Payment record not found or already processed.' });
    }

    // 2. Verify signature
    try {
      verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    } catch {
      paymentDoc.status = 'failed';
      paymentDoc.failureReason = 'Signature verification failed';
      (paymentDoc.paymentGateway as any).status = 'failed';
      await paymentDoc.save();
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    // 3. Mark completed
    paymentDoc.status = 'completed';
    paymentDoc.paymentDate = new Date();
    (paymentDoc.paymentGateway as any).paymentId = razorpayPaymentId;
    (paymentDoc.paymentGateway as any).signature = razorpaySignature;
    (paymentDoc.paymentGateway as any).status = 'captured';
    await paymentDoc.save();

    // 4. Grant credits
    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    const activeSub = await TeacherSubscription.findOne({
      teacherId: teacherProfile._id,
      status: 'active',
    });

    if (!activeSub) {
      return res.status(403).json({ success: false, message: 'No active subscription found.' });
    }

    const balanceBefore = activeSub.credits?.creditsRemaining ?? 0;
    const balanceAfter = balanceBefore + pack.credits;

    // Update subscription credits
    activeSub.credits = {
      ...(activeSub.credits as any),
      creditsRemaining: balanceAfter,
    };
    await activeSub.save();

    // Record credit transaction
    await CreditTransaction.create({
      transactionId: '',
      teacherId: teacherProfile._id,
      userId: req.user._id,
      type: 'BONUS_CREDIT',
      amount: pack.credits,
      balanceBefore,
      balanceAfter,
      description: `Purchased ${pack.name} — ${pack.credits} credits`,
      metadata: {
        bonusReason: `credit_pack_purchase:${packId}`,
      },
    });

    // Generate invoice (non-blocking)
    try {
      await generateInvoice({
        paymentId: paymentDoc._id as mongoose.Types.ObjectId,
        userId: req.user._id as mongoose.Types.ObjectId,
        leadUnlockId: undefined as any,
        promoDiscount: (paymentDoc.metadata as any)?.discount || 0,
        baseAmount: paymentDoc.amount,
        description: `${pack.name} — ${pack.credits} Credits`,
        paymentType: 'credit_pack',
      });
    } catch (invErr) {
      console.error('Invoice generation error (non-fatal):', invErr);
    }

    // Process referral reward (non-blocking)
    try {
      const { processReferralReward } = await import('../controllers/referralController');
      await processReferralReward(
        { ...req, body: { referredTeacherId: teacherProfile._id.toString() } } as any,
        { json: () => {}, status: () => ({ json: () => {} }) } as any
      );
    } catch (refErr) {
      console.error('Referral reward processing error (non-fatal):', refErr);
    }

    return res.status(200).json({
      success: true,
      message: `${pack.credits} credits added to your account!`,
      data: {
        creditsAdded: pack.credits,
        creditsRemaining: balanceAfter,
        packId,
        packName: pack.name,
        payment: {
          paymentId: paymentDoc.paymentId,
          amount: paymentDoc.amount,
          gstAmount: paymentDoc.gstAmount,
          totalAmount: paymentDoc.totalAmount,
          status: 'completed',
          razorpayPaymentId,
        },
      },
    });
  } catch (error) {
    console.error('verifyCreditPackPayment error:', error);
    return res.status(500).json({ success: false, message: 'Credit pack payment verification failed.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/history
// Returns teacher's payment history
// ─────────────────────────────────────────────────────────────────────────────
export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const type = req.query.type as string | undefined;

    const filter: any = { userId: req.user._id };
    if (type) filter.type = type;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('getPaymentHistory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment history.' });
  }
};
