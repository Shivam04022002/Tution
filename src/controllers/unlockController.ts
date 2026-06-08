import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { LeadUnlock } from '../models/LeadUnlock';
import { Payment } from '../models/Payment';
import { ParentRequirement } from '../models/ParentRequirement';
import { TeacherProfile } from '../models/TeacherProfile';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { canTeacherViewParentContact, canParentViewTeacherContact } from '../services/contactAccessService';
import {
  createOrder,
  verifyPayment as verifyRazorpaySignature,
  verifyWebhookSignature,
  createRefund,
  RazorpayOrderResult,
} from '../services/razorpayService';
import { generateInvoice } from '../services/invoiceService';
import { PromoCode } from '../models/PromoCode';
import { computeOrderAmounts } from '../services/gstService';
import {
  notifyPaymentSuccess,
  notifyLeadUnlockSuccess,
} from '../services/notificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Pricing constants
// ─────────────────────────────────────────────────────────────────────────────
const LEAD_UNLOCK_PRICE = 99;   // INR — teacher pays to unlock parent contact
const TUTOR_UNLOCK_PRICE = 49;  // INR — parent pays to unlock teacher contact
const GST_RATE = 0.18;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function generatePaymentId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `PAY-${ts}-${rand}`;
}

function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${Date.now().toString(36).toUpperCase()}`;
}

function generateUnlockId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `ULK-${ts}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// simulatePayment
// Creates a Payment doc in 'pending' then transitions to 'completed' or
// 'failed' based on the simulated result.  No Razorpay calls are made.
// ─────────────────────────────────────────────────────────────────────────────
async function simulatePayment(
  userId: mongoose.Types.ObjectId,
  amount: number,
  type: 'lead_unlock',
  meta: { tutorId?: mongoose.Types.ObjectId; parentId?: mongoose.Types.ObjectId; requirementId?: mongoose.Types.ObjectId },
  ipAddress: string,
): Promise<{ success: boolean; paymentDoc: InstanceType<typeof Payment> }> {
  const gstAmount = Math.round(amount * GST_RATE);
  const totalAmount = amount + gstAmount;
  const paymentId = generatePaymentId();
  const orderId = generateOrderId();

  const paymentDoc = await Payment.create({
    paymentId,
    type,
    userId,
    tutorId: meta.tutorId,
    parentId: meta.parentId,
    requirementId: meta.requirementId,
    amount,
    currency: 'INR',
    gstAmount,
    totalAmount,
    paymentMethod: 'upi',
    paymentGateway: {
      orderId,
      paymentId: '',
      status: 'created',
    },
    status: 'pending',
    invoiceDetails: {
      invoiceNumber: generateInvoiceNumber(),
      invoiceDate: new Date(),
      items: [
        {
          description: type === 'lead_unlock' ? 'Lead/Contact Unlock Fee' : 'Contact Unlock Fee',
          quantity: 1,
          unitPrice: amount,
          gstRate: 18,
          gstAmount,
          total: totalAmount,
        },
      ],
      subtotal: amount,
      gstTotal: gstAmount,
      total: totalAmount,
    },
    metadata: {
      platform: 'mobile',
      ipAddress,
      source: 'unlock_flow',
    },
  });

  // Simulation: always succeed (swap for gateway integration later)
  paymentDoc.status = 'completed';
  (paymentDoc.paymentGateway as any).paymentId = `SIM_${Date.now()}`;
  (paymentDoc.paymentGateway as any).status = 'captured';
  paymentDoc.paymentDate = new Date();
  await paymentDoc.save();

  return { success: true, paymentDoc };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/unlock/teacher/:leadId
// Teacher pays to unlock parent contact details for a requirement.
// ─────────────────────────────────────────────────────────────────────────────
export const unlockTeacherLead = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = req.params; // requirementId

    if (!req.user || req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can unlock leads.' });
    }

    // Find teacher profile
    const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }

    // Find requirement
    const requirement = await ParentRequirement.findById(leadId);
    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found.' });
    }
    if (requirement.status !== 'active' || !requirement.isActive) {
      return res.status(400).json({ success: false, message: 'Requirement is no longer active.' });
    }

    // Check already unlocked
    const alreadyUnlocked = await canTeacherViewParentContact(teacherProfile._id as mongoose.Types.ObjectId, requirement._id as mongoose.Types.ObjectId);
    if (alreadyUnlocked) {
      return res.status(400).json({ success: false, message: 'You have already unlocked this lead.' });
    }

    // Fetch parent user for contact snapshot
    const parentUser = await User.findById(requirement.parentId);
    if (!parentUser) {
      return res.status(404).json({ success: false, message: 'Parent account not found.' });
    }

    // Simulate payment
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const { success: paySuccess, paymentDoc } = await simulatePayment(
      req.user._id as mongoose.Types.ObjectId,
      LEAD_UNLOCK_PRICE,
      'lead_unlock',
      {
        tutorId: teacherProfile._id as mongoose.Types.ObjectId,
        parentId: requirement.parentId as mongoose.Types.ObjectId,
        requirementId: requirement._id as mongoose.Types.ObjectId,
      },
      ipAddress,
    );

    if (!paySuccess) {
      await AuditLog.create({
        adminId: req.user._id,
        action: 'PAYMENT_FAILED',
        entityType: 'Payment',
        entityId: paymentDoc._id,
        newValue: { tutorId: teacherProfile._id, requirementId: requirement._id },
        ipAddress,
        userAgent: req.headers['user-agent'],
      });
      return res.status(402).json({ success: false, message: 'Payment failed. Please try again.' });
    }

    // Create LeadUnlock record
    const unlockRecord = await LeadUnlock.create({
      requirementId: requirement._id,
      tutorId: teacherProfile._id,
      parentId: requirement.parentId,
      unlockId: generateUnlockId(),
      paymentDetails: {
        amount: LEAD_UNLOCK_PRICE,
        currency: 'INR',
        paymentMethod: 'upi',
        transactionId: paymentDoc.paymentId,
        paymentStatus: 'completed',
        paymentDate: new Date(),
      },
      parentContactDetails: {
        parentName: `${parentUser.profile?.firstName || ''} ${parentUser.profile?.lastName || ''}`.trim() || 'Parent',
        mobileNumber: parentUser.phoneNumber || '',
        email: parentUser.email || '',
        address: requirement.location?.address || '',
        alternateNumber: undefined,
      },
      unlockStatus: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Link payment → unlock
    paymentDoc.leadUnlockId = unlockRecord._id as mongoose.Types.ObjectId;
    await paymentDoc.save();

    // Increment unlock counter on requirement
    await requirement.incrementUnlocks();

    // Update teacher stats
    await teacherProfile.updateStats({
      leadUnlocks: (teacherProfile.stats?.leadUnlocks || 0) + 1,
    });

    // Audit logs
    await AuditLog.create({
      adminId: req.user._id,
      action: 'PAYMENT_SUCCESS',
      entityType: 'Payment',
      entityId: paymentDoc._id,
      newValue: { amount: paymentDoc.totalAmount, type: paymentDoc.type },
      ipAddress,
      userAgent: req.headers['user-agent'],
    });
    await AuditLog.create({
      adminId: req.user._id,
      action: 'UNLOCK_LEAD',
      entityType: 'LeadUnlock',
      entityId: unlockRecord._id,
      newValue: {
        tutorId: teacherProfile._id,
        requirementId: requirement._id,
        unlockId: unlockRecord.unlockId,
      },
      ipAddress,
      userAgent: req.headers['user-agent'],
    });

    // Auto-generate Invoice
    let simInvoiceNumber = paymentDoc.invoiceDetails.invoiceNumber;
    try {
      const inv = await generateInvoice({
        paymentId:     paymentDoc._id as mongoose.Types.ObjectId,
        userId:        req.user._id as mongoose.Types.ObjectId,
        leadUnlockId:  unlockRecord._id as mongoose.Types.ObjectId,
        promoDiscount: 0,
        baseAmount:    LEAD_UNLOCK_PRICE,
        description:   'Lead Contact Unlock Fee',
        paymentType:   'unlock_lead',
      });
      simInvoiceNumber = inv.invoiceNumber;
    } catch (invErr) {
      console.error('Invoice generation error (non-fatal):', invErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Lead unlocked successfully.',
      data: {
        unlockId: unlockRecord.unlockId,
        contact: {
          phone: unlockRecord.parentContactDetails.mobileNumber,
          email: unlockRecord.parentContactDetails.email,
          address: unlockRecord.parentContactDetails.address,
          parentName: unlockRecord.parentContactDetails.parentName,
        },
        payment: {
          paymentId:     paymentDoc.paymentId,
          invoiceNumber: simInvoiceNumber,
          amount:        paymentDoc.amount,
          gstAmount:     paymentDoc.gstAmount,
          totalAmount:   paymentDoc.totalAmount,
          status:        paymentDoc.status,
        },
        expiresAt: unlockRecord.expiresAt,
      },
    });
  } catch (error) {
    console.error('unlockTeacherLead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlock lead.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/unlock/parent/:teacherId
// Parent pays to unlock teacher contact details.
// ─────────────────────────────────────────────────────────────────────────────
export const unlockTutorContact = async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId } = req.params;

    if (!req.user || req.user.role !== 'parent') {
      return res.status(403).json({ success: false, message: 'Only parents can unlock tutor contacts.' });
    }

    const teacherProfile = await TeacherProfile.findById(teacherId);
    if (!teacherProfile) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
    }
    if (!teacherProfile.isActive || !teacherProfile.isVerified || teacherProfile.isBlocked) {
      return res.status(400).json({ success: false, message: 'Teacher profile is not available.' });
    }

    // Check already unlocked
    const alreadyUnlocked = await canParentViewTeacherContact(
      req.user._id as mongoose.Types.ObjectId,
      teacherProfile._id as mongoose.Types.ObjectId,
    );
    if (alreadyUnlocked) {
      return res.status(400).json({ success: false, message: 'You have already unlocked this tutor\'s contact.' });
    }

    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    const { success: paySuccess, paymentDoc } = await simulatePayment(
      req.user._id as mongoose.Types.ObjectId,
      TUTOR_UNLOCK_PRICE,
      'lead_unlock',
      {
        tutorId: teacherProfile._id as mongoose.Types.ObjectId,
        parentId: req.user._id as mongoose.Types.ObjectId,
      },
      ipAddress,
    );

    if (!paySuccess) {
      await AuditLog.create({
        adminId: req.user._id,
        action: 'PAYMENT_FAILED',
        entityType: 'Payment',
        entityId: paymentDoc._id,
        newValue: { parentId: req.user._id, tutorId: teacherProfile._id },
        ipAddress,
        userAgent: req.headers['user-agent'],
      });
      return res.status(402).json({ success: false, message: 'Payment failed. Please try again.' });
    }

    // Create a LeadUnlock record from parent side (requirementId is null)
    const unlockRecord = await LeadUnlock.create({
      requirementId: new mongoose.Types.ObjectId(),  // placeholder — no specific requirement
      tutorId: teacherProfile._id,
      parentId: req.user._id,
      unlockId: generateUnlockId(),
      paymentDetails: {
        amount: TUTOR_UNLOCK_PRICE,
        currency: 'INR',
        paymentMethod: 'upi',
        transactionId: paymentDoc.paymentId,
        paymentStatus: 'completed',
        paymentDate: new Date(),
      },
      parentContactDetails: {
        parentName: `${req.user.profile?.firstName || ''} ${req.user.profile?.lastName || ''}`.trim() || 'Parent',
        mobileNumber: req.user.phoneNumber || '',
        email: req.user.email || '',
        address: '',
      },
      unlockStatus: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    paymentDoc.leadUnlockId = unlockRecord._id as mongoose.Types.ObjectId;
    await paymentDoc.save();

    // Audit logs
    await AuditLog.create({
      adminId: req.user._id,
      action: 'PAYMENT_SUCCESS',
      entityType: 'Payment',
      entityId: paymentDoc._id,
      newValue: { amount: paymentDoc.totalAmount, type: paymentDoc.type },
      ipAddress,
      userAgent: req.headers['user-agent'],
    });
    await AuditLog.create({
      adminId: req.user._id,
      action: 'UNLOCK_TUTOR',
      entityType: 'LeadUnlock',
      entityId: unlockRecord._id,
      newValue: {
        parentId: req.user._id,
        tutorId: teacherProfile._id,
        unlockId: unlockRecord.unlockId,
      },
      ipAddress,
      userAgent: req.headers['user-agent'],
    });

    // Auto-generate Invoice
    let tutorInvoiceNumber = paymentDoc.invoiceDetails.invoiceNumber;
    try {
      const inv = await generateInvoice({
        paymentId:     paymentDoc._id as mongoose.Types.ObjectId,
        userId:        req.user._id as mongoose.Types.ObjectId,
        leadUnlockId:  unlockRecord._id as mongoose.Types.ObjectId,
        promoDiscount: 0,
        baseAmount:    TUTOR_UNLOCK_PRICE,
        description:   'Tutor Contact Unlock Fee',
        paymentType:   'unlock_tutor',
      });
      tutorInvoiceNumber = inv.invoiceNumber;
    } catch (invErr) {
      console.error('Invoice generation error (non-fatal):', invErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Tutor contact unlocked successfully.',
      data: {
        unlockId: unlockRecord.unlockId,
        contact: {
          phone: teacherProfile.basicDetails.mobileNumber,
          email: teacherProfile.basicDetails.email,
          address: teacherProfile.locationAvailability.address,
          name: teacherProfile.basicDetails.fullName,
        },
        payment: {
          paymentId:     paymentDoc.paymentId,
          invoiceNumber: tutorInvoiceNumber,
          amount:        paymentDoc.amount,
          gstAmount:     paymentDoc.gstAmount,
          totalAmount:   paymentDoc.totalAmount,
          status:        paymentDoc.status,
        },
        expiresAt: unlockRecord.expiresAt,
      },
    });
  } catch (error) {
    console.error('unlockTutorContact error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlock tutor contact.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/unlock/history
// Returns unlock history for the authenticated user (teacher or parent).
// ─────────────────────────────────────────────────────────────────────────────
export const getUnlockHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    let query: Record<string, any> = {};
    const role = req.user.role;

    if (role === 'teacher') {
      const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id }).select('_id').lean();
      if (!teacherProfile) {
        return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
      }
      query = { tutorId: teacherProfile._id };
    } else if (role === 'parent') {
      query = { parentId: req.user._id };
    } else if (role === 'admin') {
      // admin can see all — no filter
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [unlocks, total] = await Promise.all([
      LeadUnlock.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('requirementId', 'requirementId subjects studentDetails.grade location.city')
        .populate('tutorId', 'basicDetails.fullName basicDetails.profilePhoto')
        .populate('parentId', 'name email')
        .lean(),
      LeadUnlock.countDocuments(query),
    ]);

    // Shape response: hide contact fields from unlocks that have expired or failed
    const items = unlocks.map((u: any) => {
      const isActive = u.unlockStatus === 'active' &&
        u.paymentDetails?.paymentStatus === 'completed' &&
        new Date(u.expiresAt) > new Date();

      return {
        unlockId: u.unlockId,
        unlockStatus: u.unlockStatus,
        paymentStatus: u.paymentDetails?.paymentStatus,
        amount: u.paymentDetails?.amount,
        currency: u.paymentDetails?.currency,
        unlockedAt: u.unlockedAt,
        expiresAt: u.expiresAt,
        conversionStatus: u.conversionStatus,
        requirement: u.requirementId,
        tutor: u.tutorId,
        contact: isActive
          ? {
              phone: u.parentContactDetails?.mobileNumber,
              email: u.parentContactDetails?.email,
              address: u.parentContactDetails?.address,
            }
          : { phone: '+91 XXXXXXXXXX', email: '****@****.com', address: 'Expired' },
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('getUnlockHistory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unlock history.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/unlock/order
// Step 1 of Razorpay flow: create a Razorpay order and return it to the client.
// Client opens Razorpay checkout with this orderId. No money moves here.
//
// Body: { type: 'unlock_lead' | 'unlock_tutor', targetId: string }
// ─────────────────────────────────────────────────────────────────────────────
export const createRazorpayOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { type, targetId, promoCode: promoCodeInput } = req.body as { type: string; targetId: string; promoCode?: string };
    if (!type || !targetId) {
      return res.status(400).json({ success: false, message: 'type and targetId are required.' });
    }
    if (!['unlock_lead', 'unlock_tutor'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be unlock_lead or unlock_tutor.' });
    }

    const basePrice = type === 'unlock_lead' ? LEAD_UNLOCK_PRICE : TUTOR_UNLOCK_PRICE;

    // Promo code validation
    let promoDiscount = 0;
    let promoDoc: InstanceType<typeof PromoCode> | null = null;
    if (promoCodeInput?.trim()) {
      promoDoc = await PromoCode.findOne({ code: promoCodeInput.trim().toUpperCase() });
      if (promoDoc) {
        const { valid, error } = await promoDoc.isValid(
          req.user._id as mongoose.Types.ObjectId,
          basePrice,
          type,
        );
        if (!valid) {
          return res.status(400).json({ success: false, message: error || 'Invalid promo code.' });
        }
        promoDiscount = promoDoc.computeDiscount(basePrice);
      }
    }

    // Compute amounts with promo applied before GST
    const amounts = computeOrderAmounts(basePrice, promoDiscount);
    const baseAmount  = amounts.taxableAmount;   // after promo discount
    const gstAmount   = amounts.gst.totalGst;
    const totalAmount = amounts.grandTotal;

    // Generate our internal paymentId to use as Razorpay receipt
    const internalPaymentId = generatePaymentId();
    const invoiceNumber = generateInvoiceNumber();

    // Create Razorpay order (total amount including GST)
    let order: RazorpayOrderResult;
    try {
      order = await createOrder(totalAmount, internalPaymentId, {
        type,
        targetId,
        userId: req.user._id.toString(),
        ...(promoCodeInput ? { promoCode: promoCodeInput.toUpperCase() } : {}),
      });
    } catch (err: any) {
      return res.status(503).json({
        success: false,
        message: 'Payment gateway unavailable. ' + (err.message || ''),
      });
    }

    // Create Payment doc in 'pending' state immediately
    const paymentDoc = await Payment.create({
      paymentId: internalPaymentId,
      type: 'lead_unlock',
      userId: req.user._id,
      tutorId: type === 'unlock_tutor' ? new mongoose.Types.ObjectId(targetId) : undefined,
      requirementId: type === 'unlock_lead' ? new mongoose.Types.ObjectId(targetId) : undefined,
      amount: baseAmount,
      currency: 'INR',
      gstAmount,
      totalAmount,
      paymentMethod: 'upi',
      paymentGateway: {
        orderId: order.orderId,
        paymentId: '',
        status: 'created',
      },
      status: 'pending',
      invoiceDetails: {
        invoiceNumber,
        invoiceDate: new Date(),
        items: [
          {
            description: type === 'unlock_lead' ? 'Lead Contact Unlock Fee' : 'Tutor Contact Unlock Fee',
            quantity: 1,
            unitPrice: basePrice,
            gstRate: 18,
            gstAmount,
            total: totalAmount,
          },
        ],
        subtotal: baseAmount,
        gstTotal: gstAmount,
        total: totalAmount,
      },
      metadata: {
        platform: 'mobile',
        ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
        source: 'unlock_flow',
        ...(promoDoc ? { promoCode: promoDoc.code } : {}),
      },
    });

    // Increment promo usage count if applied
    if (promoDoc) {
      await PromoCode.findByIdAndUpdate(promoDoc._id, {
        $inc: { usageCount: 1, totalDiscountGiven: promoDiscount },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Razorpay order created.',
      data: {
        orderId: order.orderId,
        keyId: order.keyId,
        amount: order.amount,            // in paise
        originalPrice: basePrice,
        promoDiscount,
        amountInRupees: baseAmount,
        gstAmount,
        totalAmount,
        currency: 'INR',
        internalPaymentId: paymentDoc.paymentId,
        invoiceNumber,
        type,
        targetId,
        ...(promoDoc ? { promoApplied: { code: promoDoc.code, discount: promoDiscount } } : {}),
        prefill: {
          name: `${req.user.profile?.firstName || ''} ${req.user.profile?.lastName || ''}`.trim(),
          email: req.user.email,
          contact: req.user.phoneNumber,
        },
        theme: { color: '#0F766E' },
      },
    });
  } catch (error) {
    console.error('createRazorpayOrder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/unlock/verify
// Step 2 of Razorpay flow: client calls this after successful checkout.
// Verifies signature, marks Payment completed, creates LeadUnlock, reveals contact.
//
// Body: {
//   razorpayOrderId, razorpayPaymentId, razorpaySignature,
//   internalPaymentId, type, targetId
// }
// ─────────────────────────────────────────────────────────────────────────────
export const verifyRazorpayPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      internalPaymentId,
      type,
      targetId,
    } = req.body as {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      internalPaymentId: string;
      type: 'unlock_lead' | 'unlock_tutor';
      targetId: string;
    };

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !internalPaymentId || !type || !targetId) {
      return res.status(400).json({ success: false, message: 'Missing required payment verification fields.' });
    }

    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';

    // 1. Find the pending Payment doc
    const paymentDoc = await Payment.findOne({ paymentId: internalPaymentId, status: 'pending' });
    if (!paymentDoc) {
      return res.status(404).json({ success: false, message: 'Payment record not found or already processed.' });
    }

    // 2. Verify Razorpay HMAC signature
    try {
      verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    } catch {
      // Mark payment as failed
      paymentDoc.status = 'failed';
      paymentDoc.failureReason = 'Signature verification failed';
      (paymentDoc.paymentGateway as any).status = 'failed';
      await paymentDoc.save();

      await AuditLog.create({
        adminId: req.user._id,
        action: 'PAYMENT_FAILED',
        entityType: 'Payment',
        entityId: paymentDoc._id,
        newValue: { reason: 'Signature mismatch', razorpayOrderId },
        ipAddress,
        userAgent: req.headers['user-agent'],
      });

      return res.status(400).json({ success: false, message: 'Payment verification failed. Possible tamper attempt.' });
    }

    // 3. Mark Payment as completed
    paymentDoc.status = 'completed';
    paymentDoc.paymentDate = new Date();
    (paymentDoc.paymentGateway as any).paymentId = razorpayPaymentId;
    (paymentDoc.paymentGateway as any).signature = razorpaySignature;
    (paymentDoc.paymentGateway as any).status = 'captured';
    await paymentDoc.save();

    await AuditLog.create({
      adminId: req.user._id,
      action: 'PAYMENT_SUCCESS',
      entityType: 'Payment',
      entityId: paymentDoc._id,
      newValue: { amount: paymentDoc.totalAmount, razorpayPaymentId, type },
      ipAddress,
      userAgent: req.headers['user-agent'],
    });

    // 4. Create LeadUnlock and reveal contact
    let unlockRecord: any;
    let contactData: { phone: string; email: string; address: string; name?: string; parentName?: string };

    if (type === 'unlock_lead') {
      // Teacher unlocking a parent lead
      const teacherProfile = await TeacherProfile.findOne({ userId: req.user._id });
      if (!teacherProfile) {
        return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
      }

      const requirement = await ParentRequirement.findById(targetId);
      if (!requirement) {
        return res.status(404).json({ success: false, message: 'Requirement not found.' });
      }

      const parentUser = await User.findById(requirement.parentId);
      if (!parentUser) {
        return res.status(404).json({ success: false, message: 'Parent account not found.' });
      }

      unlockRecord = await LeadUnlock.create({
        requirementId: requirement._id,
        tutorId: teacherProfile._id,
        parentId: requirement.parentId,
        unlockId: generateUnlockId(),
        paymentDetails: {
          amount: paymentDoc.amount,
          currency: 'INR',
          paymentMethod: 'upi',
          transactionId: paymentDoc.paymentId,
          paymentStatus: 'completed',
          paymentDate: new Date(),
        },
        parentContactDetails: {
          parentName: `${parentUser.profile?.firstName || ''} ${parentUser.profile?.lastName || ''}`.trim() || 'Parent',
          mobileNumber: parentUser.phoneNumber || '',
          email: parentUser.email || '',
          address: requirement.location?.address || '',
          alternateNumber: undefined,
        },
        unlockStatus: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await requirement.incrementUnlocks();
      await teacherProfile.updateStats({ leadUnlocks: (teacherProfile.stats?.leadUnlocks || 0) + 1 });

      contactData = {
        phone: unlockRecord.parentContactDetails.mobileNumber,
        email: unlockRecord.parentContactDetails.email,
        address: unlockRecord.parentContactDetails.address,
        parentName: unlockRecord.parentContactDetails.parentName,
      };

      await AuditLog.create({
        adminId: req.user._id,
        action: 'UNLOCK_LEAD',
        entityType: 'LeadUnlock',
        entityId: unlockRecord._id,
        newValue: { tutorId: teacherProfile._id, requirementId: requirement._id, unlockId: unlockRecord.unlockId },
        ipAddress,
        userAgent: req.headers['user-agent'],
      });

    } else {
      // Parent unlocking a tutor contact
      const teacherProfile = await TeacherProfile.findById(targetId);
      if (!teacherProfile) {
        return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
      }

      unlockRecord = await LeadUnlock.create({
        requirementId: new mongoose.Types.ObjectId(),
        tutorId: teacherProfile._id,
        parentId: req.user._id,
        unlockId: generateUnlockId(),
        paymentDetails: {
          amount: paymentDoc.amount,
          currency: 'INR',
          paymentMethod: 'upi',
          transactionId: paymentDoc.paymentId,
          paymentStatus: 'completed',
          paymentDate: new Date(),
        },
        parentContactDetails: {
          parentName: `${req.user.profile?.firstName || ''} ${req.user.profile?.lastName || ''}`.trim() || 'Parent',
          mobileNumber: req.user.phoneNumber || '',
          email: req.user.email || '',
          address: '',
        },
        unlockStatus: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      contactData = {
        phone: teacherProfile.basicDetails.mobileNumber,
        email: teacherProfile.basicDetails.email,
        address: teacherProfile.locationAvailability.address,
        name: teacherProfile.basicDetails.fullName,
      };

      await AuditLog.create({
        adminId: req.user._id,
        action: 'UNLOCK_TUTOR',
        entityType: 'LeadUnlock',
        entityId: unlockRecord._id,
        newValue: { parentId: req.user._id, tutorId: teacherProfile._id, unlockId: unlockRecord.unlockId },
        ipAddress,
        userAgent: req.headers['user-agent'],
      });
    }

    // 5. Link payment → unlock
    paymentDoc.leadUnlockId = unlockRecord._id as mongoose.Types.ObjectId;
    await paymentDoc.save();

    // 6. Auto-generate Invoice (non-blocking — errors logged, not thrown)
    let invoiceNumber = paymentDoc.invoiceDetails.invoiceNumber;
    try {
      const promoCode   = (paymentDoc.metadata as any)?.promoCode as string | undefined;
      const basePrice   = type === 'unlock_lead' ? LEAD_UNLOCK_PRICE : TUTOR_UNLOCK_PRICE;
      const promoDisc   = promoCode ? Math.max(0, basePrice - paymentDoc.amount) : 0;
      const invoiceDoc  = await generateInvoice({
        paymentId:     paymentDoc._id as mongoose.Types.ObjectId,
        userId:        paymentDoc.userId as mongoose.Types.ObjectId,
        leadUnlockId:  unlockRecord._id as mongoose.Types.ObjectId,
        promoDiscount: Math.max(0, promoDisc),
        baseAmount:    type === 'unlock_lead' ? LEAD_UNLOCK_PRICE : TUTOR_UNLOCK_PRICE,
        description:   type === 'unlock_lead' ? 'Lead Contact Unlock Fee' : 'Tutor Contact Unlock Fee',
        paymentType:   type,
      });
      invoiceNumber = invoiceDoc.invoiceNumber;
    } catch (invErr) {
      console.error('Invoice generation error (non-fatal):', invErr);
    }

    // Notifications (non-fatal)
    const contactName = contactData?.name || contactData?.parentName || 'the contact';
    notifyPaymentSuccess(
      req.user._id as mongoose.Types.ObjectId,
      paymentDoc.totalAmount,
      type === 'unlock_lead' ? 'Lead Contact Unlock' : 'Tutor Contact Unlock',
      paymentDoc._id as mongoose.Types.ObjectId,
    ).catch(() => {});
    notifyLeadUnlockSuccess(
      req.user._id as mongoose.Types.ObjectId,
      contactName,
      unlockRecord._id as mongoose.Types.ObjectId,
    ).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Payment verified and contact unlocked successfully.',
      data: {
        unlockId: unlockRecord.unlockId,
        contact: contactData,
        payment: {
          paymentId: paymentDoc.paymentId,
          invoiceNumber,
          amount: paymentDoc.amount,
          gstAmount: paymentDoc.gstAmount,
          totalAmount: paymentDoc.totalAmount,
          status: paymentDoc.status,
          razorpayPaymentId,
        },
        expiresAt: unlockRecord.expiresAt,
      },
    });
  } catch (error) {
    console.error('verifyRazorpayPayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/unlock/webhook
// Razorpay server-to-server webhook for async payment events.
// Must be registered in Razorpay dashboard → Settings → Webhooks.
// Set X-Razorpay-Signature header validation with RAZORPAY_WEBHOOK_SECRET.
//
// Handled events: payment.captured, payment.failed, refund.created
// ─────────────────────────────────────────────────────────────────────────────
export const handleRazorpayWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing webhook signature.' });
    }

    // rawBody is attached by express.raw() middleware on this route
    const rawBody = (req as any).rawBody as string;
    if (!rawBody) {
      return res.status(400).json({ success: false, message: 'No raw body available for verification.' });
    }

    // Verify webhook authenticity
    try {
      verifyWebhookSignature(rawBody, signature);
    } catch {
      return res.status(401).json({ success: false, message: 'Webhook signature invalid.' });
    }

    const event = req.body as { event: string; payload: any };
    const eventType = event?.event;

    // ── payment.captured ──────────────────────────────────────────────────────
    if (eventType === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const razorpayPaymentId = paymentEntity?.id;

      if (razorpayOrderId) {
        const paymentDoc = await Payment.findOne({
          'paymentGateway.orderId': razorpayOrderId,
          status: 'pending',
        });

        if (paymentDoc) {
          paymentDoc.status = 'completed';
          paymentDoc.paymentDate = new Date();
          (paymentDoc.paymentGateway as any).paymentId = razorpayPaymentId;
          (paymentDoc.paymentGateway as any).status = 'captured';
          await paymentDoc.save();

          await AuditLog.create({
            adminId: paymentDoc.userId,
            action: 'PAYMENT_SUCCESS',
            entityType: 'Payment',
            entityId: paymentDoc._id,
            newValue: { razorpayPaymentId, razorpayOrderId, source: 'webhook' },
            ipAddress: 'razorpay-webhook',
          });
        }
      }
    }

    // ── payment.failed ────────────────────────────────────────────────────────
    else if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const errorDescription = paymentEntity?.error_description || 'Payment failed';

      if (razorpayOrderId) {
        const paymentDoc = await Payment.findOne({
          'paymentGateway.orderId': razorpayOrderId,
          status: 'pending',
        });

        if (paymentDoc) {
          paymentDoc.status = 'failed';
          paymentDoc.failureReason = errorDescription;
          (paymentDoc.paymentGateway as any).status = 'failed';
          await paymentDoc.save();

          await AuditLog.create({
            adminId: paymentDoc.userId,
            action: 'PAYMENT_FAILED',
            entityType: 'Payment',
            entityId: paymentDoc._id,
            newValue: { razorpayOrderId, reason: errorDescription, source: 'webhook' },
            ipAddress: 'razorpay-webhook',
          });
        }
      }
    }

    // ── refund.created ────────────────────────────────────────────────────────
    else if (eventType === 'refund.created') {
      const refundEntity = event.payload?.refund?.entity;
      const razorpayPaymentId = refundEntity?.payment_id;
      const refundId = refundEntity?.id;
      const refundAmount = refundEntity?.amount ? refundEntity.amount / 100 : 0;

      if (razorpayPaymentId) {
        const paymentDoc = await Payment.findOne({
          'paymentGateway.paymentId': razorpayPaymentId,
        });

        if (paymentDoc) {
          paymentDoc.status = 'refunded';
          paymentDoc.refundDate = new Date();
          paymentDoc.refundDetails = {
            refundId,
            amount: refundAmount,
            reason: 'Refund via Razorpay',
            status: 'processed',
            processedDate: new Date(),
            refundMethod: 'razorpay',
          };
          await paymentDoc.save();

          // Mark linked LeadUnlock as refunded
          if (paymentDoc.leadUnlockId) {
            await LeadUnlock.findByIdAndUpdate(paymentDoc.leadUnlockId, {
              unlockStatus: 'refunded',
              refundRequested: true,
              refundStatus: 'approved',
            });
          }

          await AuditLog.create({
            adminId: paymentDoc.userId,
            action: 'PAYMENT_REFUNDED',
            entityType: 'Payment',
            entityId: paymentDoc._id,
            newValue: { refundId, refundAmount, razorpayPaymentId, source: 'webhook' },
            ipAddress: 'razorpay-webhook',
          });
        }
      }
    }

    // Always acknowledge webhook immediately
    return res.status(200).json({ success: true, received: true });
  } catch (error) {
    console.error('handleRazorpayWebhook error:', error);
    // Always 200 to Razorpay — otherwise it will retry
    return res.status(200).json({ success: false, message: 'Webhook processing error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/unlock/payment-intent
// Simulates creating a PaymentIntent (pending → paid → failed).
// Replace internals with Razorpay when ready.
// ─────────────────────────────────────────────────────────────────────────────
export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { type, targetId } = req.body;
    if (!type || !targetId) {
      return res.status(400).json({ success: false, message: 'type and targetId are required.' });
    }

    const allowedTypes = ['unlock_lead', 'unlock_tutor'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${allowedTypes.join(', ')}` });
    }

    const amount = type === 'unlock_lead' ? LEAD_UNLOCK_PRICE : TUTOR_UNLOCK_PRICE;
    const gstAmount = Math.round(amount * GST_RATE);
    const totalAmount = amount + gstAmount;

    const intent = {
      intentId: generateOrderId(),
      status: 'pending' as 'pending' | 'paid' | 'failed',
      amount,
      gstAmount,
      totalAmount,
      currency: 'INR',
      type,
      targetId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15-min window
      note: 'Razorpay integration pending. Use /api/unlock/teacher/:leadId or /api/unlock/parent/:teacherId to complete.',
    };

    return res.status(200).json({ success: true, data: intent });
  } catch (error) {
    console.error('createPaymentIntent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment intent.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
