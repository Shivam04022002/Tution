import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { PromoCode } from '../models/PromoCode';
import { AuditLog } from '../models/AuditLog';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/promos/validate
// Public (authenticated): validate a promo code before checkout.
// Returns discount amount if valid.
// ─────────────────────────────────────────────────────────────────────────────
export const validatePromoCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const { code, type, baseAmount, planName, packId } = req.body as {
      code: string;
      type: string;       // 'unlock_lead' | 'unlock_tutor' | 'subscription' | 'credit_pack'
      baseAmount: number;
      planName?: string;
      packId?: string;
    };

    if (!code || !type || baseAmount == null) {
      return res.status(400).json({ success: false, message: 'code, type, and baseAmount are required.' });
    }

    const promo = await PromoCode.findOne({ code: code.trim().toUpperCase() });
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo code not found.' });
    }

    const { valid, error } = await promo.isValid(
      req.user._id as mongoose.Types.ObjectId,
      baseAmount,
      type,
      planName,
      packId,
    );

    if (!valid) {
      return res.status(400).json({ success: false, message: error || 'Promo code is not valid.' });
    }

    const discount = promo.computeDiscount(baseAmount);
    const discountedBase = baseAmount - discount;
    const gstRate = 0.18;
    const gstAmount = Math.round(discountedBase * gstRate);
    const totalAmount = discountedBase + gstAmount;

    return res.status(200).json({
      success: true,
      data: {
        code:           promo.code,
        description:    promo.description,
        discountType:   promo.discountType,
        discountValue:  promo.discountValue,
        discount,
        discountedBase,
        gstAmount,
        totalAmount,
        validTo:        promo.validTo,
      },
    });
  } catch (error) {
    console.error('validatePromoCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to validate promo code.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/promos/apply
// Apply a promo code during checkout (records usage intent, tracks analytics)
// Body: { code, type, baseAmount, planName?, packId?, orderId? }
// ─────────────────────────────────────────────────────────────────────────────
export const applyPromoCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const { code, type, baseAmount, planName, packId, orderId } = req.body as {
      code: string;
      type: string;
      baseAmount: number;
      planName?: string;
      packId?: string;
      orderId?: string;
    };

    if (!code || !type || baseAmount == null) {
      return res.status(400).json({ success: false, message: 'code, type, and baseAmount are required.' });
    }

    const promo = await PromoCode.findOne({ code: code.trim().toUpperCase() });
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo code not found.' });
    }

    const { valid, error } = await promo.isValid(
      req.user._id as mongoose.Types.ObjectId,
      baseAmount,
      type,
      planName,
      packId,
    );

    if (!valid) {
      // Log failed promo application
      await AuditLog.create({
        adminId: req.user._id,
        action: 'PROMO_APPLY_FAILED',
        entityType: 'PromoCode',
        entityId: promo._id,
        details: { code, type, baseAmount, planName, packId, error, orderId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(400).json({ success: false, message: error || 'Promo code is not valid.' });
    }

    const discount = promo.computeDiscount(baseAmount);
    const discountedBase = baseAmount - discount;
    const gstRate = 0.18;
    const gstAmount = Math.round(discountedBase * gstRate);
    const totalAmount = discountedBase + gstAmount;

    // Log successful promo application
    await AuditLog.create({
      adminId: req.user._id,
      action: 'PROMO_APPLIED',
      entityType: 'PromoCode',
      entityId: promo._id,
      details: { code, type, baseAmount, discount, discountedBase, gstAmount, totalAmount, planName, packId, orderId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      data: {
        code: promo.code,
        description: promo.description,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discount,
        discountedBase,
        gstAmount,
        totalAmount,
        savingsPercentage: baseAmount > 0 ? Math.round((discount / baseAmount) * 100) : 0,
        appliedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('applyPromoCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to apply promo code.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/promos
// Admin: list all promo codes with usage stats.
// ─────────────────────────────────────────────────────────────────────────────
export const listPromoCodes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const page      = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit     = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip      = (page - 1) * limit;
    const isActive  = req.query.isActive;

    const filter: Record<string, any> = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const [promos, total] = await Promise.all([
      PromoCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PromoCode.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { promos, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    console.error('listPromoCodes error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list promo codes.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/promos
// Admin: create a promo code.
// ─────────────────────────────────────────────────────────────────────────────
export const createPromoCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const {
      code, description, discountType, discountValue,
      maxDiscountAmount, applicableTo, applicablePlans, applicablePacks,
      minOrderAmount, usageLimit, perUserLimit, validFrom, validTo,
      restrictedToUserIds,
    } = req.body;

    if (!code || !description || !discountType || discountValue == null || !validFrom || !validTo) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    if (!['flat', 'percent'].includes(discountType)) {
      return res.status(400).json({ success: false, message: 'discountType must be flat or percent.' });
    }
    if (discountType === 'percent' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({ success: false, message: 'Percent discount must be 0–100.' });
    }

    const existing = await PromoCode.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Promo code already exists.' });
    }

    const promo = await PromoCode.create({
      code:                code.trim().toUpperCase(),
      description,
      discountType,
      discountValue,
      maxDiscountAmount:   maxDiscountAmount || undefined,
      applicableTo:        applicableTo || 'all',
      applicablePlans:     applicablePlans || [],
      applicablePacks:     applicablePacks || [],
      minOrderAmount:      minOrderAmount || 0,
      usageLimit:          usageLimit || 1000,
      perUserLimit:        perUserLimit || 1,
      validFrom:           new Date(validFrom),
      validTo:             new Date(validTo),
      restrictedToUserIds: restrictedToUserIds || [],
      createdBy:           req.user._id,
    });

    return res.status(201).json({ success: true, data: promo });
  } catch (error) {
    console.error('createPromoCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create promo code.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/promos/:id
// Admin: update a promo code (toggle active, extend validity, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export const updatePromoCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const allowedFields = [
      'description', 'isActive', 'validFrom', 'validTo',
      'usageLimit', 'perUserLimit', 'maxDiscountAmount',
      'minOrderAmount', 'restrictedToUserIds',
      'applicablePlans', 'applicablePacks', 'applicableTo',
    ];

    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const promo = await PromoCode.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!promo) return res.status(404).json({ success: false, message: 'Promo code not found.' });

    return res.status(200).json({ success: true, data: promo });
  } catch (error) {
    console.error('updatePromoCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update promo code.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/promos/:id
// Admin: deactivate (soft delete) a promo code.
// ─────────────────────────────────────────────────────────────────────────────
export const deactivatePromoCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const promo = await PromoCode.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!promo) return res.status(404).json({ success: false, message: 'Promo code not found.' });

    return res.status(200).json({ success: true, message: 'Promo code deactivated.', data: { code: promo.code } });
  } catch (error) {
    console.error('deactivatePromoCode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to deactivate promo code.' });
  }
};
