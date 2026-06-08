"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentIntent = exports.handleRazorpayWebhook = exports.verifyRazorpayPayment = exports.createRazorpayOrder = exports.getUnlockHistory = exports.unlockTutorContact = exports.unlockTeacherLead = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const LeadUnlock_1 = require("../models/LeadUnlock");
const Payment_1 = require("../models/Payment");
const ParentRequirement_1 = require("../models/ParentRequirement");
const TeacherProfile_1 = require("../models/TeacherProfile");
const User_1 = require("../models/User");
const AuditLog_1 = require("../models/AuditLog");
const contactAccessService_1 = require("../services/contactAccessService");
const razorpayService_1 = require("../services/razorpayService");
const invoiceService_1 = require("../services/invoiceService");
const PromoCode_1 = require("../models/PromoCode");
const gstService_1 = require("../services/gstService");
const notificationService_1 = require("../services/notificationService");
const LEAD_UNLOCK_PRICE = 99;
const TUTOR_UNLOCK_PRICE = 49;
const GST_RATE = 0.18;
function generatePaymentId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `PAY-${ts}-${rand}`;
}
function generateOrderId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `ORD-${ts}-${rand}`;
}
function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `INV-${year}${month}-${Date.now().toString(36).toUpperCase()}`;
}
function generateUnlockId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `ULK-${ts}-${rand}`;
}
async function simulatePayment(userId, amount, type, meta, ipAddress) {
    const gstAmount = Math.round(amount * GST_RATE);
    const totalAmount = amount + gstAmount;
    const paymentId = generatePaymentId();
    const orderId = generateOrderId();
    const paymentDoc = await Payment_1.Payment.create({
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
    paymentDoc.status = 'completed';
    paymentDoc.paymentGateway.paymentId = `SIM_${Date.now()}`;
    paymentDoc.paymentGateway.status = 'captured';
    paymentDoc.paymentDate = new Date();
    await paymentDoc.save();
    return { success: true, paymentDoc };
}
const unlockTeacherLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        if (!req.user || req.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Only teachers can unlock leads.' });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId: req.user._id });
        if (!teacherProfile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
        }
        const requirement = await ParentRequirement_1.ParentRequirement.findById(leadId);
        if (!requirement) {
            return res.status(404).json({ success: false, message: 'Requirement not found.' });
        }
        if (requirement.status !== 'active' || !requirement.isActive) {
            return res.status(400).json({ success: false, message: 'Requirement is no longer active.' });
        }
        const alreadyUnlocked = await (0, contactAccessService_1.canTeacherViewParentContact)(teacherProfile._id, requirement._id);
        if (alreadyUnlocked) {
            return res.status(400).json({ success: false, message: 'You have already unlocked this lead.' });
        }
        const parentUser = await User_1.User.findById(requirement.parentId);
        if (!parentUser) {
            return res.status(404).json({ success: false, message: 'Parent account not found.' });
        }
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        const { success: paySuccess, paymentDoc } = await simulatePayment(req.user._id, LEAD_UNLOCK_PRICE, 'lead_unlock', {
            tutorId: teacherProfile._id,
            parentId: requirement.parentId,
            requirementId: requirement._id,
        }, ipAddress);
        if (!paySuccess) {
            await AuditLog_1.AuditLog.create({
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
        const unlockRecord = await LeadUnlock_1.LeadUnlock.create({
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
        paymentDoc.leadUnlockId = unlockRecord._id;
        await paymentDoc.save();
        await requirement.incrementUnlocks();
        await teacherProfile.updateStats({
            leadUnlocks: (teacherProfile.stats?.leadUnlocks || 0) + 1,
        });
        await AuditLog_1.AuditLog.create({
            adminId: req.user._id,
            action: 'PAYMENT_SUCCESS',
            entityType: 'Payment',
            entityId: paymentDoc._id,
            newValue: { amount: paymentDoc.totalAmount, type: paymentDoc.type },
            ipAddress,
            userAgent: req.headers['user-agent'],
        });
        await AuditLog_1.AuditLog.create({
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
        let simInvoiceNumber = paymentDoc.invoiceDetails.invoiceNumber;
        try {
            const inv = await (0, invoiceService_1.generateInvoice)({
                paymentId: paymentDoc._id,
                userId: req.user._id,
                leadUnlockId: unlockRecord._id,
                promoDiscount: 0,
                baseAmount: LEAD_UNLOCK_PRICE,
                description: 'Lead Contact Unlock Fee',
                paymentType: 'unlock_lead',
            });
            simInvoiceNumber = inv.invoiceNumber;
        }
        catch (invErr) {
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
                    paymentId: paymentDoc.paymentId,
                    invoiceNumber: simInvoiceNumber,
                    amount: paymentDoc.amount,
                    gstAmount: paymentDoc.gstAmount,
                    totalAmount: paymentDoc.totalAmount,
                    status: paymentDoc.status,
                },
                expiresAt: unlockRecord.expiresAt,
            },
        });
    }
    catch (error) {
        console.error('unlockTeacherLead error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to unlock lead.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.unlockTeacherLead = unlockTeacherLead;
const unlockTutorContact = async (req, res) => {
    try {
        const { teacherId } = req.params;
        if (!req.user || req.user.role !== 'parent') {
            return res.status(403).json({ success: false, message: 'Only parents can unlock tutor contacts.' });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findById(teacherId);
        if (!teacherProfile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
        }
        if (!teacherProfile.isActive || !teacherProfile.isVerified || teacherProfile.isBlocked) {
            return res.status(400).json({ success: false, message: 'Teacher profile is not available.' });
        }
        const alreadyUnlocked = await (0, contactAccessService_1.canParentViewTeacherContact)(req.user._id, teacherProfile._id);
        if (alreadyUnlocked) {
            return res.status(400).json({ success: false, message: 'You have already unlocked this tutor\'s contact.' });
        }
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        const { success: paySuccess, paymentDoc } = await simulatePayment(req.user._id, TUTOR_UNLOCK_PRICE, 'lead_unlock', {
            tutorId: teacherProfile._id,
            parentId: req.user._id,
        }, ipAddress);
        if (!paySuccess) {
            await AuditLog_1.AuditLog.create({
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
        const unlockRecord = await LeadUnlock_1.LeadUnlock.create({
            requirementId: new mongoose_1.default.Types.ObjectId(),
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
        paymentDoc.leadUnlockId = unlockRecord._id;
        await paymentDoc.save();
        await AuditLog_1.AuditLog.create({
            adminId: req.user._id,
            action: 'PAYMENT_SUCCESS',
            entityType: 'Payment',
            entityId: paymentDoc._id,
            newValue: { amount: paymentDoc.totalAmount, type: paymentDoc.type },
            ipAddress,
            userAgent: req.headers['user-agent'],
        });
        await AuditLog_1.AuditLog.create({
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
        let tutorInvoiceNumber = paymentDoc.invoiceDetails.invoiceNumber;
        try {
            const inv = await (0, invoiceService_1.generateInvoice)({
                paymentId: paymentDoc._id,
                userId: req.user._id,
                leadUnlockId: unlockRecord._id,
                promoDiscount: 0,
                baseAmount: TUTOR_UNLOCK_PRICE,
                description: 'Tutor Contact Unlock Fee',
                paymentType: 'unlock_tutor',
            });
            tutorInvoiceNumber = inv.invoiceNumber;
        }
        catch (invErr) {
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
                    paymentId: paymentDoc.paymentId,
                    invoiceNumber: tutorInvoiceNumber,
                    amount: paymentDoc.amount,
                    gstAmount: paymentDoc.gstAmount,
                    totalAmount: paymentDoc.totalAmount,
                    status: paymentDoc.status,
                },
                expiresAt: unlockRecord.expiresAt,
            },
        });
    }
    catch (error) {
        console.error('unlockTutorContact error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to unlock tutor contact.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.unlockTutorContact = unlockTutorContact;
const getUnlockHistory = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;
        let query = {};
        const role = req.user.role;
        if (role === 'teacher') {
            const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId: req.user._id }).select('_id').lean();
            if (!teacherProfile) {
                return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
            }
            query = { tutorId: teacherProfile._id };
        }
        else if (role === 'parent') {
            query = { parentId: req.user._id };
        }
        else if (role === 'admin') {
        }
        else {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const [unlocks, total] = await Promise.all([
            LeadUnlock_1.LeadUnlock.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('requirementId', 'requirementId subjects studentDetails.grade location.city')
                .populate('tutorId', 'basicDetails.fullName basicDetails.profilePhoto')
                .populate('parentId', 'name email')
                .lean(),
            LeadUnlock_1.LeadUnlock.countDocuments(query),
        ]);
        const items = unlocks.map((u) => {
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
    }
    catch (error) {
        console.error('getUnlockHistory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch unlock history.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getUnlockHistory = getUnlockHistory;
const createRazorpayOrder = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const { type, targetId, promoCode: promoCodeInput } = req.body;
        if (!type || !targetId) {
            return res.status(400).json({ success: false, message: 'type and targetId are required.' });
        }
        if (!['unlock_lead', 'unlock_tutor'].includes(type)) {
            return res.status(400).json({ success: false, message: 'type must be unlock_lead or unlock_tutor.' });
        }
        const basePrice = type === 'unlock_lead' ? LEAD_UNLOCK_PRICE : TUTOR_UNLOCK_PRICE;
        let promoDiscount = 0;
        let promoDoc = null;
        if (promoCodeInput?.trim()) {
            promoDoc = await PromoCode_1.PromoCode.findOne({ code: promoCodeInput.trim().toUpperCase() });
            if (promoDoc) {
                const { valid, error } = await promoDoc.isValid(req.user._id, basePrice, type);
                if (!valid) {
                    return res.status(400).json({ success: false, message: error || 'Invalid promo code.' });
                }
                promoDiscount = promoDoc.computeDiscount(basePrice);
            }
        }
        const amounts = (0, gstService_1.computeOrderAmounts)(basePrice, promoDiscount);
        const baseAmount = amounts.taxableAmount;
        const gstAmount = amounts.gst.totalGst;
        const totalAmount = amounts.grandTotal;
        const internalPaymentId = generatePaymentId();
        const invoiceNumber = generateInvoiceNumber();
        let order;
        try {
            order = await (0, razorpayService_1.createOrder)(totalAmount, internalPaymentId, {
                type,
                targetId,
                userId: req.user._id.toString(),
                ...(promoCodeInput ? { promoCode: promoCodeInput.toUpperCase() } : {}),
            });
        }
        catch (err) {
            return res.status(503).json({
                success: false,
                message: 'Payment gateway unavailable. ' + (err.message || ''),
            });
        }
        const paymentDoc = await Payment_1.Payment.create({
            paymentId: internalPaymentId,
            type: 'lead_unlock',
            userId: req.user._id,
            tutorId: type === 'unlock_tutor' ? new mongoose_1.default.Types.ObjectId(targetId) : undefined,
            requirementId: type === 'unlock_lead' ? new mongoose_1.default.Types.ObjectId(targetId) : undefined,
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
        if (promoDoc) {
            await PromoCode_1.PromoCode.findByIdAndUpdate(promoDoc._id, {
                $inc: { usageCount: 1, totalDiscountGiven: promoDiscount },
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Razorpay order created.',
            data: {
                orderId: order.orderId,
                keyId: order.keyId,
                amount: order.amount,
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
    }
    catch (error) {
        console.error('createRazorpayOrder error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create payment order.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.createRazorpayOrder = createRazorpayOrder;
const verifyRazorpayPayment = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, internalPaymentId, type, targetId, } = req.body;
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !internalPaymentId || !type || !targetId) {
            return res.status(400).json({ success: false, message: 'Missing required payment verification fields.' });
        }
        const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
        const paymentDoc = await Payment_1.Payment.findOne({ paymentId: internalPaymentId, status: 'pending' });
        if (!paymentDoc) {
            return res.status(404).json({ success: false, message: 'Payment record not found or already processed.' });
        }
        try {
            (0, razorpayService_1.verifyPayment)({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
        }
        catch {
            paymentDoc.status = 'failed';
            paymentDoc.failureReason = 'Signature verification failed';
            paymentDoc.paymentGateway.status = 'failed';
            await paymentDoc.save();
            await AuditLog_1.AuditLog.create({
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
        paymentDoc.status = 'completed';
        paymentDoc.paymentDate = new Date();
        paymentDoc.paymentGateway.paymentId = razorpayPaymentId;
        paymentDoc.paymentGateway.signature = razorpaySignature;
        paymentDoc.paymentGateway.status = 'captured';
        await paymentDoc.save();
        await AuditLog_1.AuditLog.create({
            adminId: req.user._id,
            action: 'PAYMENT_SUCCESS',
            entityType: 'Payment',
            entityId: paymentDoc._id,
            newValue: { amount: paymentDoc.totalAmount, razorpayPaymentId, type },
            ipAddress,
            userAgent: req.headers['user-agent'],
        });
        let unlockRecord;
        let contactData;
        if (type === 'unlock_lead') {
            const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId: req.user._id });
            if (!teacherProfile) {
                return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
            }
            const requirement = await ParentRequirement_1.ParentRequirement.findById(targetId);
            if (!requirement) {
                return res.status(404).json({ success: false, message: 'Requirement not found.' });
            }
            const parentUser = await User_1.User.findById(requirement.parentId);
            if (!parentUser) {
                return res.status(404).json({ success: false, message: 'Parent account not found.' });
            }
            unlockRecord = await LeadUnlock_1.LeadUnlock.create({
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
            await AuditLog_1.AuditLog.create({
                adminId: req.user._id,
                action: 'UNLOCK_LEAD',
                entityType: 'LeadUnlock',
                entityId: unlockRecord._id,
                newValue: { tutorId: teacherProfile._id, requirementId: requirement._id, unlockId: unlockRecord.unlockId },
                ipAddress,
                userAgent: req.headers['user-agent'],
            });
        }
        else {
            const teacherProfile = await TeacherProfile_1.TeacherProfile.findById(targetId);
            if (!teacherProfile) {
                return res.status(404).json({ success: false, message: 'Teacher profile not found.' });
            }
            unlockRecord = await LeadUnlock_1.LeadUnlock.create({
                requirementId: new mongoose_1.default.Types.ObjectId(),
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
            await AuditLog_1.AuditLog.create({
                adminId: req.user._id,
                action: 'UNLOCK_TUTOR',
                entityType: 'LeadUnlock',
                entityId: unlockRecord._id,
                newValue: { parentId: req.user._id, tutorId: teacherProfile._id, unlockId: unlockRecord.unlockId },
                ipAddress,
                userAgent: req.headers['user-agent'],
            });
        }
        paymentDoc.leadUnlockId = unlockRecord._id;
        await paymentDoc.save();
        let invoiceNumber = paymentDoc.invoiceDetails.invoiceNumber;
        try {
            const promoCode = paymentDoc.metadata?.promoCode;
            const basePrice = type === 'unlock_lead' ? LEAD_UNLOCK_PRICE : TUTOR_UNLOCK_PRICE;
            const promoDisc = promoCode ? Math.max(0, basePrice - paymentDoc.amount) : 0;
            const invoiceDoc = await (0, invoiceService_1.generateInvoice)({
                paymentId: paymentDoc._id,
                userId: paymentDoc.userId,
                leadUnlockId: unlockRecord._id,
                promoDiscount: Math.max(0, promoDisc),
                baseAmount: type === 'unlock_lead' ? LEAD_UNLOCK_PRICE : TUTOR_UNLOCK_PRICE,
                description: type === 'unlock_lead' ? 'Lead Contact Unlock Fee' : 'Tutor Contact Unlock Fee',
                paymentType: type,
            });
            invoiceNumber = invoiceDoc.invoiceNumber;
        }
        catch (invErr) {
            console.error('Invoice generation error (non-fatal):', invErr);
        }
        const contactName = contactData?.name || contactData?.parentName || 'the contact';
        (0, notificationService_1.notifyPaymentSuccess)(req.user._id, paymentDoc.totalAmount, type === 'unlock_lead' ? 'Lead Contact Unlock' : 'Tutor Contact Unlock', paymentDoc._id).catch(() => { });
        (0, notificationService_1.notifyLeadUnlockSuccess)(req.user._id, contactName, unlockRecord._id).catch(() => { });
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
    }
    catch (error) {
        console.error('verifyRazorpayPayment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Payment verification failed.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.verifyRazorpayPayment = verifyRazorpayPayment;
const handleRazorpayWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        if (!signature) {
            return res.status(400).json({ success: false, message: 'Missing webhook signature.' });
        }
        const rawBody = req.rawBody;
        if (!rawBody) {
            return res.status(400).json({ success: false, message: 'No raw body available for verification.' });
        }
        try {
            (0, razorpayService_1.verifyWebhookSignature)(rawBody, signature);
        }
        catch {
            return res.status(401).json({ success: false, message: 'Webhook signature invalid.' });
        }
        const event = req.body;
        const eventType = event?.event;
        if (eventType === 'payment.captured') {
            const paymentEntity = event.payload?.payment?.entity;
            const razorpayOrderId = paymentEntity?.order_id;
            const razorpayPaymentId = paymentEntity?.id;
            if (razorpayOrderId) {
                const paymentDoc = await Payment_1.Payment.findOne({
                    'paymentGateway.orderId': razorpayOrderId,
                    status: 'pending',
                });
                if (paymentDoc) {
                    paymentDoc.status = 'completed';
                    paymentDoc.paymentDate = new Date();
                    paymentDoc.paymentGateway.paymentId = razorpayPaymentId;
                    paymentDoc.paymentGateway.status = 'captured';
                    await paymentDoc.save();
                    await AuditLog_1.AuditLog.create({
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
        else if (eventType === 'payment.failed') {
            const paymentEntity = event.payload?.payment?.entity;
            const razorpayOrderId = paymentEntity?.order_id;
            const errorDescription = paymentEntity?.error_description || 'Payment failed';
            if (razorpayOrderId) {
                const paymentDoc = await Payment_1.Payment.findOne({
                    'paymentGateway.orderId': razorpayOrderId,
                    status: 'pending',
                });
                if (paymentDoc) {
                    paymentDoc.status = 'failed';
                    paymentDoc.failureReason = errorDescription;
                    paymentDoc.paymentGateway.status = 'failed';
                    await paymentDoc.save();
                    await AuditLog_1.AuditLog.create({
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
        else if (eventType === 'refund.created') {
            const refundEntity = event.payload?.refund?.entity;
            const razorpayPaymentId = refundEntity?.payment_id;
            const refundId = refundEntity?.id;
            const refundAmount = refundEntity?.amount ? refundEntity.amount / 100 : 0;
            if (razorpayPaymentId) {
                const paymentDoc = await Payment_1.Payment.findOne({
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
                    if (paymentDoc.leadUnlockId) {
                        await LeadUnlock_1.LeadUnlock.findByIdAndUpdate(paymentDoc.leadUnlockId, {
                            unlockStatus: 'refunded',
                            refundRequested: true,
                            refundStatus: 'approved',
                        });
                    }
                    await AuditLog_1.AuditLog.create({
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
        return res.status(200).json({ success: true, received: true });
    }
    catch (error) {
        console.error('handleRazorpayWebhook error:', error);
        return res.status(200).json({ success: false, message: 'Webhook processing error.' });
    }
};
exports.handleRazorpayWebhook = handleRazorpayWebhook;
const createPaymentIntent = async (req, res) => {
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
            status: 'pending',
            amount,
            gstAmount,
            totalAmount,
            currency: 'INR',
            type,
            targetId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            note: 'Razorpay integration pending. Use /api/unlock/teacher/:leadId or /api/unlock/parent/:teacherId to complete.',
        };
        return res.status(200).json({ success: true, data: intent });
    }
    catch (error) {
        console.error('createPaymentIntent error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create payment intent.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.createPaymentIntent = createPaymentIntent;
//# sourceMappingURL=unlockController.js.map