"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectRefund = exports.approveRefund = exports.listRefunds = exports.requestRefund = void 0;
const RefundRequest_1 = require("../models/RefundRequest");
const Payment_1 = require("../models/Payment");
const LeadUnlock_1 = require("../models/LeadUnlock");
const Invoice_1 = require("../models/Invoice");
const AuditLog_1 = require("../models/AuditLog");
const razorpayService_1 = require("../services/razorpayService");
const notificationService_1 = require("../services/notificationService");
const User_1 = require("../models/User");
const REFUND_WINDOW_DAYS = 7;
const requestRefund = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const { paymentId, reason } = req.body;
        if (!paymentId || !reason?.trim()) {
            return res.status(400).json({ success: false, message: 'paymentId and reason are required.' });
        }
        const payment = await Payment_1.Payment.findById(paymentId);
        if (!payment)
            return res.status(404).json({ success: false, message: 'Payment not found.' });
        if (payment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (payment.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Only completed payments can be refunded.' });
        }
        const existing = await RefundRequest_1.RefundRequest.findOne({
            paymentId: payment._id,
            status: { $in: ['pending', 'approved', 'processed'] },
        });
        if (existing) {
            return res.status(400).json({ success: false, message: 'A refund request already exists for this payment.' });
        }
        const paymentDate = payment.paymentDate || payment.createdAt;
        const daysSince = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
        const withinPolicy = daysSince <= REFUND_WINDOW_DAYS;
        const razorpayPaymentId = payment.paymentGateway?.paymentId;
        if (!razorpayPaymentId) {
            return res.status(400).json({ success: false, message: 'No Razorpay payment ID found. Cannot process refund.' });
        }
        const invoice = await Invoice_1.Invoice.findOne({ paymentId: payment._id }).lean();
        const refundRequest = await RefundRequest_1.RefundRequest.create({
            refundRequestId: RefundRequest_1.RefundRequest.generateId(),
            paymentId: payment._id,
            userId: req.user._id,
            leadUnlockId: payment.leadUnlockId,
            invoiceId: invoice?._id,
            originalAmount: payment.totalAmount,
            requestedAmount: payment.totalAmount,
            razorpayPaymentId,
            reason: reason.trim(),
            daysSincePayment: daysSince,
            isWithinPolicy: withinPolicy,
            requestedAt: new Date(),
        });
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        await AuditLog_1.AuditLog.create({
            adminId: req.user._id,
            action: 'PAYMENT_REFUNDED',
            entityType: 'Payment',
            entityId: payment._id,
            newValue: { refundRequestId: refundRequest.refundRequestId, reason, withinPolicy },
            ipAddress,
            userAgent: req.headers['user-agent'],
        });
        const admins = await User_1.User.find({ role: 'admin' }).select('_id').lean();
        const adminIds = admins.map((a) => a._id);
        await (0, notificationService_1.notifyAdminRefundRequest)(adminIds, refundRequest.requestedAmount, refundRequest.refundRequestId, refundRequest._id);
        return res.status(201).json({
            success: true,
            message: withinPolicy
                ? 'Refund request submitted. It will be reviewed within 2 business days.'
                : 'Refund request submitted but is outside the 7-day refund window. Admin review required.',
            data: {
                refundRequestId: refundRequest.refundRequestId,
                status: refundRequest.status,
                requestedAmount: refundRequest.requestedAmount,
                isWithinPolicy: withinPolicy,
                daysSincePayment: daysSince,
            },
        });
    }
    catch (error) {
        console.error('requestRefund error:', error);
        return res.status(500).json({ success: false, message: 'Failed to submit refund request.' });
    }
};
exports.requestRefund = requestRefund;
const listRefunds = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const filter = {};
        if (req.user.role !== 'admin')
            filter.userId = req.user._id;
        if (status)
            filter.status = status;
        const [requests, total] = await Promise.all([
            RefundRequest_1.RefundRequest.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('paymentId', 'paymentId totalAmount status')
                .populate('userId', 'profile.firstName profile.lastName email')
                .lean(),
            RefundRequest_1.RefundRequest.countDocuments(filter),
        ]);
        return res.status(200).json({
            success: true,
            data: { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
        });
    }
    catch (error) {
        console.error('listRefunds error:', error);
        return res.status(500).json({ success: false, message: 'Failed to list refund requests.' });
    }
};
exports.listRefunds = listRefunds;
const approveRefund = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required.' });
        }
        const refundReq = await RefundRequest_1.RefundRequest.findById(req.params.id);
        if (!refundReq)
            return res.status(404).json({ success: false, message: 'Refund request not found.' });
        if (refundReq.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot approve a request in '${refundReq.status}' status.` });
        }
        const { approvedAmount, adminNotes } = req.body;
        const finalAmount = approvedAmount ?? refundReq.requestedAmount;
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        refundReq.status = 'approved';
        refundReq.approvedAmount = finalAmount;
        refundReq.adminId = req.user._id;
        refundReq.adminNotes = adminNotes;
        refundReq.reviewedAt = new Date();
        await refundReq.save();
        try {
            const rzpRefund = await (0, razorpayService_1.createRefund)(refundReq.razorpayPaymentId, finalAmount, { reason: refundReq.reason, refundRequestId: refundReq.refundRequestId });
            refundReq.status = 'processed';
            refundReq.razorpayRefundId = rzpRefund.refundId;
            refundReq.processedAt = new Date();
            await refundReq.save();
            await Payment_1.Payment.findByIdAndUpdate(refundReq.paymentId, {
                status: 'refunded',
                refundDate: new Date(),
                refundDetails: {
                    refundId: rzpRefund.refundId,
                    amount: finalAmount,
                    reason: refundReq.reason,
                    status: 'processed',
                    processedDate: new Date(),
                    refundMethod: 'razorpay',
                },
            });
            if (refundReq.leadUnlockId) {
                await LeadUnlock_1.LeadUnlock.findByIdAndUpdate(refundReq.leadUnlockId, {
                    unlockStatus: 'refunded',
                    refundRequested: true,
                    refundStatus: 'approved',
                });
            }
            await AuditLog_1.AuditLog.create({
                adminId: req.user._id,
                action: 'PAYMENT_REFUNDED',
                entityType: 'Payment',
                entityId: refundReq.paymentId,
                newValue: { refundId: rzpRefund.refundId, amount: finalAmount, refundRequestId: refundReq.refundRequestId },
                ipAddress,
                userAgent: req.headers['user-agent'],
            });
            await (0, notificationService_1.notifyRefundApproved)(refundReq.userId, finalAmount, refundReq.refundRequestId, refundReq._id);
            return res.status(200).json({
                success: true,
                message: 'Refund processed successfully via Razorpay.',
                data: { refundId: rzpRefund.refundId, amount: finalAmount, status: 'processed' },
            });
        }
        catch (rzpErr) {
            refundReq.status = 'failed';
            refundReq.adminNotes = (adminNotes || '') + ` | Razorpay error: ${rzpErr.message}`;
            await refundReq.save();
            await AuditLog_1.AuditLog.create({
                adminId: req.user._id,
                action: 'PAYMENT_FAILED',
                entityType: 'Payment',
                entityId: refundReq.paymentId,
                newValue: { error: rzpErr.message, refundRequestId: refundReq.refundRequestId },
                ipAddress,
                userAgent: req.headers['user-agent'],
            });
            return res.status(502).json({
                success: false,
                message: 'Refund approval saved but Razorpay refund failed. Retry or process manually.',
                error: rzpErr.message,
            });
        }
    }
    catch (error) {
        console.error('approveRefund error:', error);
        return res.status(500).json({ success: false, message: 'Failed to approve refund.' });
    }
};
exports.approveRefund = approveRefund;
const rejectRefund = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required.' });
        }
        const refundReq = await RefundRequest_1.RefundRequest.findById(req.params.id);
        if (!refundReq)
            return res.status(404).json({ success: false, message: 'Refund request not found.' });
        if (refundReq.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot reject a request in '${refundReq.status}' status.` });
        }
        const { rejectionReason, adminNotes } = req.body;
        if (!rejectionReason?.trim()) {
            return res.status(400).json({ success: false, message: 'rejectionReason is required.' });
        }
        refundReq.status = 'rejected';
        refundReq.adminId = req.user._id;
        refundReq.adminNotes = adminNotes;
        refundReq.rejectionReason = rejectionReason.trim();
        refundReq.reviewedAt = new Date();
        await refundReq.save();
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        await AuditLog_1.AuditLog.create({
            adminId: req.user._id,
            action: 'PAYMENT_FAILED',
            entityType: 'Payment',
            entityId: refundReq.paymentId,
            newValue: { action: 'refund_rejected', reason: rejectionReason, refundRequestId: refundReq.refundRequestId },
            ipAddress,
            userAgent: req.headers['user-agent'],
        });
        await (0, notificationService_1.notifyRefundRejected)(refundReq.userId, refundReq.requestedAmount, rejectionReason.trim(), refundReq._id);
        return res.status(200).json({
            success: true,
            message: 'Refund request rejected.',
            data: { refundRequestId: refundReq.refundRequestId, status: 'rejected' },
        });
    }
    catch (error) {
        console.error('rejectRefund error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reject refund.' });
    }
};
exports.rejectRefund = rejectRefund;
//# sourceMappingURL=refundController.js.map