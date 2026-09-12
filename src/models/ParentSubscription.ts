import mongoose, { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// A parent's subscription record — gates access to contacting tutors.
// Structurally mirrors TeacherSubscription; parentId is the User._id directly
// (there is no separate ParentProfile collection).
// ─────────────────────────────────────────────────────────────────────────────

export interface IParentSubscription extends Document {
  subscriptionId: string;
  parentId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: 'monthly' | 'quarterly' | 'annual';
  status: 'active' | 'expired' | 'cancelled' | 'pending' | 'inactive';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt?: Date;
  cancelReason?: string;
  usage: {
    contactsUsed: number;
    periodStart: Date;
    periodEnd: Date;
  };
  history: Array<{
    action: 'subscribed' | 'renewed' | 'cancelled' | 'expired';
    fromPlan?: string;
    toPlan?: string;
    date: Date;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ParentSubscriptionSchema: Schema = new Schema({
  subscriptionId: {
    type: String,
    required: true,
    unique: true,
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'ParentSubscriptionPlan',
    required: true,
  },
  planName: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending', 'inactive'],
    default: 'active',
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  autoRenew: {
    type: Boolean,
    default: false,
  },
  cancelledAt: {
    type: Date,
  },
  cancelReason: {
    type: String,
  },
  usage: {
    contactsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
  },
  history: [{
    action: {
      type: String,
      enum: ['subscribed', 'renewed', 'cancelled', 'expired'],
      required: true,
    },
    fromPlan: {
      type: String,
    },
    toPlan: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
    },
  }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

ParentSubscriptionSchema.index({ parentId: 1, status: 1 });
ParentSubscriptionSchema.index({ subscriptionId: 1 });
ParentSubscriptionSchema.index({ status: 1, endDate: 1 });

// Generate subscription ID before validation runs, so the `required` check
// on subscriptionId passes even when the caller creates the doc with '' .
ParentSubscriptionSchema.pre('validate', function (this: IParentSubscription) {
  if (!this.subscriptionId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.subscriptionId = `PSUB-${ts}-${rand}`;
  }
});

export const ParentSubscription = mongoose.model<IParentSubscription>(
  'ParentSubscription',
  ParentSubscriptionSchema
);
