import mongoose, { Schema, Document } from 'mongoose';

export interface ITeacherSubscription extends Document {
  subscriptionId: string;
  teacherId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: 'free' | 'starter' | 'professional' | 'premium';
  status: 'active' | 'cancelled' | 'expired' | 'pending' | 'suspended';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt?: Date;
  cancelReason?: string;
  usage: {
    applicationsUsed: number;
    leadUnlocksUsed: number;
    periodStart: Date;
    periodEnd: Date;
  };
  credits: {
    creditsRemaining: number;
    creditsUsed: number;
    creditResetDate: Date;
  };
  history: Array<{
    action: 'subscribed' | 'upgraded' | 'downgraded' | 'renewed' | 'cancelled' | 'expired';
    fromPlan?: string;
    toPlan?: string;
    date: Date;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSubscriptionSchema: Schema = new Schema({
  subscriptionId: {
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
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true,
  },
  planName: {
    type: String,
    enum: ['free', 'starter', 'professional', 'premium'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending', 'suspended'],
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
    default: true,
  },
  cancelledAt: {
    type: Date,
  },
  cancelReason: {
    type: String,
  },
  usage: {
    applicationsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadUnlocksUsed: {
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
  credits: {
    creditsRemaining: {
      type: Number,
      default: 5,
      min: 0,
    },
    creditsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditResetDate: {
      type: Date,
      required: true,
      default: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    },
  },
  history: [{
    action: {
      type: String,
      enum: ['subscribed', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'expired'],
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

TeacherSubscriptionSchema.index({ teacherId: 1, status: 1 });
TeacherSubscriptionSchema.index({ userId: 1 });
TeacherSubscriptionSchema.index({ subscriptionId: 1 });
TeacherSubscriptionSchema.index({ status: 1, endDate: 1 });

// Generate subscription ID pre-save
TeacherSubscriptionSchema.pre('save', function(this: ITeacherSubscription) {
  if (!this.subscriptionId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.subscriptionId = `SUB-${ts}-${rand}`;
  }
});

export const TeacherSubscription = mongoose.model<ITeacherSubscription>('TeacherSubscription', TeacherSubscriptionSchema);
