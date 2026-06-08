import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────
export interface IPromoCode extends Document {
  code: string;                       // e.g. FIRST50
  description: string;

  // Discount
  discountType: 'flat' | 'percent';
  discountValue: number;              // flat INR or percent (0-100)
  maxDiscountAmount?: number;         // cap for percent type

  // Applicability
  applicableTo: 'unlock_lead' | 'unlock_tutor' | 'all';
  minOrderAmount: number;             // minimum order before discount

  // Usage limits
  usageLimit: number;                 // total redemptions allowed
  usageCount: number;                 // current count
  perUserLimit: number;               // max uses per user

  // Validity
  validFrom: Date;
  validTo: Date;
  isActive: boolean;

  // Who can use
  restrictedToUserIds?: mongoose.Types.ObjectId[];  // empty = all users

  // Stats (denormalised for performance)
  totalDiscountGiven: number;         // cumulative INR discount

  // Audit
  createdBy: mongoose.Types.ObjectId;  // admin userId
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isValid(userId: mongoose.Types.ObjectId, orderAmount: number, type: string): Promise<{ valid: boolean; error?: string }>;
  computeDiscount(baseAmount: number): number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const PromoCodeSchema = new Schema<IPromoCode>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, required: true, maxlength: 200 },

    discountType:      { type: String, enum: ['flat', 'percent'], required: true },
    discountValue:     { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number },

    applicableTo:  {
      type: String,
      enum: ['unlock_lead', 'unlock_tutor', 'all'],
      default: 'all',
    },
    minOrderAmount: { type: Number, default: 0 },

    usageLimit:    { type: Number, required: true, default: 1000 },
    usageCount:    { type: Number, default: 0 },
    perUserLimit:  { type: Number, default: 1 },

    validFrom: { type: Date, required: true, index: true },
    validTo:   { type: Date, required: true, index: true },
    isActive:  { type: Boolean, default: true, index: true },

    restrictedToUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    totalDiscountGiven: { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Indexes
PromoCodeSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
PromoCodeSchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Instance method: isValid
// ─────────────────────────────────────────────────────────────────────────────
PromoCodeSchema.methods.isValid = async function (
  this: IPromoCode,
  userId: mongoose.Types.ObjectId,
  orderAmount: number,
  type: string,
): Promise<{ valid: boolean; error?: string }> {
  const now = new Date();

  if (!this.isActive)                              return { valid: false, error: 'Promo code is inactive.' };
  if (now < this.validFrom)                        return { valid: false, error: 'Promo code is not yet valid.' };
  if (now > this.validTo)                          return { valid: false, error: 'Promo code has expired.' };
  if (this.usageCount >= this.usageLimit)          return { valid: false, error: 'Promo code usage limit reached.' };
  if (orderAmount < this.minOrderAmount)           return { valid: false, error: `Minimum order ₹${this.minOrderAmount} required.` };
  if (this.applicableTo !== 'all' && this.applicableTo !== type) {
    return { valid: false, error: `Promo code not applicable for this payment type.` };
  }
  if (this.restrictedToUserIds && this.restrictedToUserIds.length > 0) {
    const allowed = this.restrictedToUserIds.map((id) => id.toString());
    if (!allowed.includes(userId.toString())) {
      return { valid: false, error: 'Promo code is not available for your account.' };
    }
  }

  // Per-user limit check
  const { Payment } = await import('./Payment');
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

// ─────────────────────────────────────────────────────────────────────────────
// Instance method: computeDiscount
// ─────────────────────────────────────────────────────────────────────────────
PromoCodeSchema.methods.computeDiscount = function (
  this: IPromoCode,
  baseAmount: number,
): number {
  let discount = 0;
  if (this.discountType === 'flat') {
    discount = Math.min(this.discountValue, baseAmount);
  } else {
    discount = Math.round((baseAmount * this.discountValue) / 100);
    if (this.maxDiscountAmount) {
      discount = Math.min(discount, this.maxDiscountAmount);
    }
  }
  return discount;
};

export const PromoCode = mongoose.model<IPromoCode>('PromoCode', PromoCodeSchema);
