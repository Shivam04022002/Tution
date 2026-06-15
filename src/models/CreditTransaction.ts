import mongoose, { Schema, Document } from 'mongoose';

export type CreditTransactionType =
  | 'CREDIT_GRANTED'
  | 'LEAD_UNLOCK'
  | 'CREDIT_REFUND'
  | 'BONUS_CREDIT'
  | 'PLAN_UPGRADE';

export interface ICreditTransaction extends Document {
  transactionId: string;
  teacherId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: CreditTransactionType;
  amount: number;            // positive = credit added, negative = credit consumed
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata: {
    requirementId?: string;
    planName?: string;
    fromPlan?: string;
    toPlan?: string;
    unlockId?: string;
    refundReason?: string;
    bonusReason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CreditTransactionSchema: Schema = new Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'TeacherProfile',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['CREDIT_GRANTED', 'LEAD_UNLOCK', 'CREDIT_REFUND', 'BONUS_CREDIT', 'PLAN_UPGRADE'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  balanceBefore: {
    type: Number,
    required: true,
    min: 0,
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    required: true,
  },
  metadata: {
    requirementId: { type: String },
    planName: { type: String },
    fromPlan: { type: String },
    toPlan: { type: String },
    unlockId: { type: String },
    refundReason: { type: String },
    bonusReason: { type: String },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

CreditTransactionSchema.index({ teacherId: 1, createdAt: -1 });
CreditTransactionSchema.index({ userId: 1 });
CreditTransactionSchema.index({ transactionId: 1 });
CreditTransactionSchema.index({ type: 1 });

// Generate transaction ID pre-save
CreditTransactionSchema.pre('save', function(this: ICreditTransaction) {
  if (!this.transactionId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.transactionId = `CRD-${ts}-${rand}`;
  }
});

export const CreditTransaction = mongoose.model<ICreditTransaction>('CreditTransaction', CreditTransactionSchema);
