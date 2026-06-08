import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────
export interface IRefundRequest extends Document {
  refundRequestId: string;          // REF-XXXXXX

  // Links
  paymentId:    mongoose.Types.ObjectId;       // ref: Payment
  userId:       mongoose.Types.ObjectId;       // ref: User (requester)
  leadUnlockId?: mongoose.Types.ObjectId;      // ref: LeadUnlock
  invoiceId?:   mongoose.Types.ObjectId;       // ref: Invoice
  adminId?:     mongoose.Types.ObjectId;       // ref: User (approver)

  // Amounts
  originalAmount: number;           // total paid
  requestedAmount: number;          // amount user wants back
  approvedAmount?: number;          // what admin approves

  // Razorpay
  razorpayPaymentId: string;        // original rzp payment id for refund call
  razorpayRefundId?: string;        // populated after refund issued

  // Workflow
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
  reason: string;                   // user-provided
  adminNotes?: string;              // admin review note
  rejectionReason?: string;

  // Policy checks (stored at request time)
  daysSincePayment: number;         // auto-computed
  isWithinPolicy: boolean;          // within 7-day window

  // Timestamps
  requestedAt: Date;
  reviewedAt?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const RefundRequestSchema = new Schema<IRefundRequest>(
  {
    refundRequestId: { type: String, required: true, unique: true, index: true },

    paymentId:    { type: Schema.Types.ObjectId, ref: 'Payment',    required: true, index: true },
    userId:       { type: Schema.Types.ObjectId, ref: 'User',       required: true, index: true },
    leadUnlockId: { type: Schema.Types.ObjectId, ref: 'LeadUnlock' },
    invoiceId:    { type: Schema.Types.ObjectId, ref: 'Invoice'    },
    adminId:      { type: Schema.Types.ObjectId, ref: 'User'       },

    originalAmount:  { type: Number, required: true },
    requestedAmount: { type: Number, required: true },
    approvedAmount:  { type: Number },

    razorpayPaymentId: { type: String, required: true, index: true },
    razorpayRefundId:  { type: String, index: true, sparse: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed', 'failed'],
      default: 'pending',
      index: true,
    },

    reason:           { type: String, required: true, maxlength: 500 },
    adminNotes:       { type: String, maxlength: 1000 },
    rejectionReason:  { type: String, maxlength: 500 },

    daysSincePayment: { type: Number, required: true },
    isWithinPolicy:   { type: Boolean, required: true },

    requestedAt:  { type: Date, default: Date.now },
    reviewedAt:   { type: Date },
    processedAt:  { type: Date },
  },
  { timestamps: true },
);

// Indexes
RefundRequestSchema.index({ status: 1, createdAt: -1 });
RefundRequestSchema.index({ userId: 1, createdAt: -1 });

// Static: generate refund request ID
RefundRequestSchema.statics.generateId = function (): string {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `REF-${ts}-${rand}`;
};

export const RefundRequest = mongoose.model<IRefundRequest>('RefundRequest', RefundRequestSchema);
