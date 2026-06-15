"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromoCode = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PromoCodeSchema = new mongoose_1.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true,
    },
    description: { type: String, required: true, maxlength: 200 },
    discountType: { type: String, enum: ['flat', 'percent'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number },
    applicableTo: {
        type: String,
        enum: ['unlock_lead', 'unlock_tutor', 'subscription', 'credit_pack', 'all'],
        default: 'all',
    },
    applicablePlans: [{ type: String }],
    applicablePacks: [{ type: String }],
    minOrderAmount: { type: Number, default: 0 },
    usageLimit: { type: Number, required: true, default: 1000 },
    usageCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    validFrom: { type: Date, required: true, index: true },
    validTo: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    restrictedToUserIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    totalDiscountGiven: { type: Number, default: 0 },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
PromoCodeSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
PromoCodeSchema.index({ createdAt: -1 });
PromoCodeSchema.methods.isValid = async function (userId, orderAmount, type, planName, packId) {
    const now = new Date();
    if (!this.isActive)
        return { valid: false, error: 'Promo code is inactive.' };
    if (now < this.validFrom)
        return { valid: false, error: 'Promo code is not yet valid.' };
    if (now > this.validTo)
        return { valid: false, error: 'Promo code has expired.' };
    if (this.usageCount >= this.usageLimit)
        return { valid: false, error: 'Promo code usage limit reached.' };
    if (orderAmount < this.minOrderAmount)
        return { valid: false, error: `Minimum order ₹${this.minOrderAmount} required.` };
    if (this.applicableTo !== 'all' && this.applicableTo !== type) {
        return { valid: false, error: `Promo code not applicable for this payment type.` };
    }
    if (this.applicableTo === 'subscription' && this.applicablePlans && this.applicablePlans.length > 0) {
        if (!planName || !this.applicablePlans.includes(planName)) {
            return { valid: false, error: `Promo code not applicable for this subscription plan.` };
        }
    }
    if (this.applicableTo === 'credit_pack' && this.applicablePacks && this.applicablePacks.length > 0) {
        if (!packId || !this.applicablePacks.includes(packId)) {
            return { valid: false, error: `Promo code not applicable for this credit pack.` };
        }
    }
    if (this.restrictedToUserIds && this.restrictedToUserIds.length > 0) {
        const allowed = this.restrictedToUserIds.map((id) => id.toString());
        if (!allowed.includes(userId.toString())) {
            return { valid: false, error: 'Promo code is not available for your account.' };
        }
    }
    const { Payment } = await Promise.resolve().then(() => __importStar(require('./Payment')));
    const userUsageCount = await Payment.countDocuments({
        userId,
        'metadata.promoCode': this.code,
        status: 'completed',
    });
    if (userUsageCount >= this.perUserLimit) {
        return { valid: false, error: `You have already used this promo code ${this.perUserLimit} time(s).` };
    }
    return { valid: true };
};
PromoCodeSchema.methods.computeDiscount = function (baseAmount) {
    let discount = 0;
    if (this.discountType === 'flat') {
        discount = Math.min(this.discountValue, baseAmount);
    }
    else {
        discount = Math.round((baseAmount * this.discountValue) / 100);
        if (this.maxDiscountAmount) {
            discount = Math.min(discount, this.maxDiscountAmount);
        }
    }
    return discount;
};
exports.PromoCode = mongoose_1.default.model('PromoCode', PromoCodeSchema);
//# sourceMappingURL=PromoCode.js.map