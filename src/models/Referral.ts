import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────
export interface IReferral extends Document {
  referralId: string;                 // unique referral tracking ID
  
  // Referrer (the teacher who invited)
  referrerId: mongoose.Types.ObjectId;  // TeacherProfile ID
  referrerUserId: mongoose.Types.ObjectId;
  referrerCode: string;                // the code used (e.g., TEACHER123)
  
  // Referred (the new teacher who joined)
  referredId?: mongoose.Types.ObjectId; // TeacherProfile ID (set after registration)
  referredUserId?: mongoose.Types.ObjectId;
  referredName?: string;
  referredEmail?: string;
  
  // Status tracking
  status: 'pending' | 'registered' | 'first_purchase' | 'rewarded' | 'expired';
  
  // Registration tracking
  registeredAt?: Date;
  firstPurchaseAt?: Date;
  rewardedAt?: Date;
  
  // Reward details
  rewardType: 'credits' | 'subscription_discount';
  rewardValue: number;               // credits amount or discount percentage
  rewardGranted: boolean;
  
  // Credit transaction reference (if rewardType is credits)
  creditTransactionId?: mongoose.Types.ObjectId;
  
  // Subscription discount reference (if rewardType is subscription_discount)
  promoCodeId?: mongoose.Types.ObjectId;
  
  // Metadata
  ipAddress?: string;
  userAgent?: string;
  source?: string;                     // where the referral link was shared
  
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const ReferralSchema = new Schema<IReferral>(
  {
    referralId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: 'TeacherProfile',
      required: true,
      index: true,
    },
    referrerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referrerCode: {
      type: String,
      required: true,
      index: true,
    },
    
    referredId: {
      type: Schema.Types.ObjectId,
      ref: 'TeacherProfile',
      index: true,
    },
    referredUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    referredName: { type: String },
    referredEmail: { type: String },
    
    status: {
      type: String,
      enum: ['pending', 'registered', 'first_purchase', 'rewarded', 'expired'],
      default: 'pending',
      index: true,
    },
    
    registeredAt: { type: Date },
    firstPurchaseAt: { type: Date },
    rewardedAt: { type: Date },
    
    rewardType: {
      type: String,
      enum: ['credits', 'subscription_discount'],
      default: 'credits',
    },
    rewardValue: {
      type: Number,
      default: 0,
    },
    rewardGranted: {
      type: Boolean,
      default: false,
    },
    
    creditTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'CreditTransaction',
    },
    promoCodeId: {
      type: Schema.Types.ObjectId,
      ref: 'PromoCode',
    },
    
    ipAddress: { type: String },
    userAgent: { type: String },
    source: { type: String },
  },
  { timestamps: true },
);

// Indexes
ReferralSchema.index({ referrerId: 1, status: 1 });
ReferralSchema.index({ referredUserId: 1 });
ReferralSchema.index({ referrerCode: 1, status: 1 });
ReferralSchema.index({ createdAt: -1 });
ReferralSchema.index({ status: 1, createdAt: -1 });

// Generate referral ID pre-save
ReferralSchema.pre('save', function(this: IReferral) {
  if (!this.referralId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.referralId = `REF-${ts}-${rand}`;
  }
});

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
