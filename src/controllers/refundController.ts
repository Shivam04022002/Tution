import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { RefundRequest } from '../models/RefundRequest';
import { Payment } from '../models/Payment';
import { LeadUnlock } from '../models/LeadUnlock';
import { Invoice } from '../models/Invoice';
import { AuditLog } from '../models/AuditLog';
import { createRefund } from '../services/razorpayService';
import {
  notifyAdminRefundRequest,
  notifyRefundApproved,
  notifyRefundRejected,
} from '../services/notificationService';
import { User } from '../models/User';

const REFUND_WINDOW_DAYS = 7;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/refunds
// User requests a refund for a completed payment.
// Policy: within 7 days, payment status=completed, no prior refund.
// ─────────────────────────────────────────────────────────────────────────────
export const requestRefund = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const { paymentId, reason } = req.body as { paymentId: string; reason: string };
    if (!paymentId || !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'paymentId and reason are required.' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    // Ownership check
    if (payment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed payments can be refunded.' });
    }

    // Check no existing active refund request
    const existing = await RefundRequest.findOne({
      paymentId: payment._id,
      status: { $in: ['pending', 'approved', 'processed'] },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A refund request already exists for this payment.' });
    }

    // Policy window
    const paymentDate = payment.paymentDate || payment.createdAt;
    const daysSince   = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
    const withinPolicy = daysSince <= REFUND_WINDOW_DAYS;

    const razorpayPaymentId = (payment.paymentGateway as any)?.paymentId as string;
    if (!razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'No Razorpay payment ID found. Cannot process refund.' });
    }

    // Find linked invoice
    const invoice = await Invoice.findOne({ paymentId: payment._id }).lean();

    const refundRequest = await RefundRequest.create({
      refundRequestId:   (RefundRequest as any).generateId(),
      paymentId:         payment._id,
      userId:            req.user._id,
      leadUnlockId:      payment.leadUnlockId,
      invoiceId:         invoice?._id,
      originalAmount:    payment.totalAmount,
      requestedAmount:   payment.totalAmount,
      razorpayPaymentId,
      reason:            reason.trim(),
      daysSincePayment:  daysSince,
      isWithinPolicy:    withinPolicy,
      requestedAt:       new Date(),
    });

    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    await AuditLog.create({
      adminId:    req.user._id,
      action:     'PAYMENT_REFUNDED',
      entityType: 'Payment',
      entityId:   payment._id,
      newValue:   { refundRequestId: refundRequest.refundRequestId, reason, withinPolicy },
      ipAddress,
      userAgent:  req.headers['user-agent'],
    });

    // Notify all admins
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    const adminIds = admins.map((a) => a._id);
    await notifyAdminRefundRequest(adminIds, refundRequest.requestedAmount, refundRequest.refundRequestId, refundRequest._id as mongoose.Types.ObjectId);

    return res.status(201).json({
      success: true,
      message: withinPolicy
        ? 'Refund request submitted. It will be reviewed within 2 business days.'
        : 'Refund request submitted but is outside the 7-day refund window. Admin review required.',
      data: {
        refundRequestId:  refundRequest.refundRequestId,
        status:           refundRequest.status,
        requestedAmount:  refundRequest.requestedAmount,
        isWithinPolicy:   withinPolicy,
        daysSincePayment: daysSince,
      },
    });
  } catch (error) {
    console.error('requestRefund error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit refund request.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/refunds
// User: own refund requests. Admin: all.
// ─────────────────────────────────────────────────────────────────────────────
export const listRefunds = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit as string) || 10);
    const skip   = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const filter: Record<string, any> = {};
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    if (status) filter.status = status;

    const [requests, total] = await Promise.all([
      RefundRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('paymentId',    'paymentId totalAmount status')
        .populate('userId',       'profile.firstName profile.lastName email')
        .lean(),
      RefundRequest.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    console.error('listRefunds error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list refund requests.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/refunds/:id/approve
// Admin approves a refund request and triggers Razorpay refund.
// ─────────────────────────────────────────────────────────────────────────────
export const approveRefund = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const refundReq = await RefundRequest.findById(req.params.id);
    if (!refundReq) return res.status(404).json({ success: false, message: 'Refund request not found.' });

    if (refundReq.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot approve a request in '${refundReq.status}' status.` });
    }

    const { approvedAmount, adminNotes } = req.body as {
      approvedAmount?: number;
      adminNotes?: string;
    };

    const finalAmount = approvedAmount ?? refundReq.requestedAmount;
    const ipAddress   = req.ip || req.socket?.remoteAddress || 'unknown';

    // Mark approved first
    refundReq.status         = 'approved';
    refundReq.approvedAmount = finalAmount;
    refundReq.adminId        = req.user._id as mongoose.Types.ObjectId;
    refundReq.adminNotes     = adminNotes;
    refundReq.reviewedAt     = new Date();
    await refundReq.save();

    // Issue Razorpay refund
    try {
      const rzpRefund = await createRefund(
        refundReq.razorpayPaymentId,
        finalAmount,
        { reason: refundReq.reason, refundRequestId: refundReq.refundRequestId },
      );

      refundReq.status          = 'processed';
      refundReq.razorpayRefundId = rzpRefund.refundId;
      refundReq.processedAt     = new Date();
      await refundReq.save();

      // Update Payment status
      await Payment.findByIdAndUpdate(refundReq.paymentId, {
        status:      'refunded',
        refundDate:  new Date(),
        refundDetails: {
          refundId:      rzpRefund.refundId,
          amount:        finalAmount,
          reason:        refundReq.reason,
          status:        'processed',
          processedDate: new Date(),
          refundMethod:  'razorpay',
        },
      });

      // Deactivate LeadUnlock if linked
      if (refundReq.leadUnlockId) {
        await LeadUnlock.findByIdAndUpdate(refundReq.leadUnlockId, {
          unlockStatus:   'refunded',
          refundRequested: true,
          refundStatus:   'approved',
        });
      }

      // Audit
      await AuditLog.create({
        adminId:    req.user._id,
        action:     'PAYMENT_REFUNDED',
        entityType: 'Payment',
        entityId:   refundReq.paymentId,
        newValue:   { refundId: rzpRefund.refundId, amount: finalAmount, refundRequestId: refundReq.refundRequestId },
        ipAddress,
        userAgent:  req.headers['user-agent'],
      });

      // Notify user
      await notifyRefundApproved(refundReq.userId, finalAmount, refundReq.refundRequestId, refundReq._id as mongoose.Types.ObjectId);

      return res.status(200).json({
        success: true,
        message: 'Refund processed successfully via Razorpay.',
        data:    { refundId: rzpRefund.refundId, amount: finalAmount, status: 'processed' },
      });
    } catch (rzpErr: any) {
      // Razorpay call failed — mark as failed but keep audit trail
      refundReq.status    = 'failed';
      refundReq.adminNotes = (adminNotes || '') + ` | Razorpay error: ${rzpErr.message}`;
      await refundReq.save();

      await AuditLog.create({
        adminId:    req.user._id,
        action:     'PAYMENT_FAILED',
        entityType: 'Payment',
        entityId:   refundReq.paymentId,
        newValue:   { error: rzpErr.message, refundRequestId: refundReq.refundRequestId },
        ipAddress,
        userAgent:  req.headers['user-agent'],
      });

      return res.status(502).json({
        success: false,
        message: 'Refund approval saved but Razorpay refund failed. Retry or process manually.',
        error:   rzpErr.message,
      });
    }
  } catch (error) {
    console.error('approveRefund error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve refund.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/refunds/:id/reject
// Admin rejects a refund request.
// ─────────────────────────────────────────────────────────────────────────────
export const rejectRefund = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const refundReq = await RefundRequest.findById(req.params.id);
    if (!refundReq) return res.status(404).json({ success: false, message: 'Refund request not found.' });

    if (refundReq.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot reject a request in '${refundReq.status}' status.` });
    }

    const { rejectionReason, adminNotes } = req.body as {
      rejectionReason: string;
      adminNotes?: string;
    };
    if (!rejectionReason?.trim()) {
      return res.status(400).json({ success: false, message: 'rejectionReason is required.' });
    }

    refundReq.status          = 'rejected';
    refundReq.adminId         = req.user._id as mongoose.Types.ObjectId;
    refundReq.adminNotes      = adminNotes;
    refundReq.rejectionReason = rejectionReason.trim();
    refundReq.reviewedAt      = new Date();
    await refundReq.save();

    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    await AuditLog.create({
      adminId:    req.user._id,
      action:     'PAYMENT_FAILED',
      entityType: 'Payment',
      entityId:   refundReq.paymentId,
      newValue:   { action: 'refund_rejected', reason: rejectionReason, refundRequestId: refundReq.refundRequestId },
      ipAddress,
      userAgent:  req.headers['user-agent'],
    });

    // Notify user
    await notifyRefundRejected(refundReq.userId, refundReq.requestedAmount, rejectionReason.trim(), refundReq._id as mongoose.Types.ObjectId);

    return res.status(200).json({
      success: true,
      message: 'Refund request rejected.',
      data:    { refundRequestId: refundReq.refundRequestId, status: 'rejected' },
    });
  } catch (error) {
    console.error('rejectRefund error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject refund.' });
  }
};
