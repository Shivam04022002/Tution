import mongoose, { Schema, Document } from 'mongoose';

export interface IPlanLimits {
  applicationsPerMonth: number;    // -1 = unlimited
  leadUnlocksPerMonth: number;     // -1 = unlimited
  creditsPerMonth: number;         // -1 = unlimited
  profileVisibilityBoost: number;  // 0-100 (percentage boost)
  analyticsAccess: 'none' | 'basic' | 'advanced' | 'full';
  priorityPlacement: boolean;
  prioritySupport: boolean;
  demoInsights: boolean;
}

export interface ISubscriptionPlan extends Document {
  planId: string;
  name: 'free' | 'starter' | 'professional' | 'premium';
  displayName: string;
  description: string;
  price: number;              // monthly price in INR (0 for free)
  annualPrice: number;        // annual price in INR (0 for free)
  currency: string;
  billingCycle: 'monthly' | 'annual';
  limits: IPlanLimits;
  features: string[];         // human-readable feature list
  badge: string;              // badge label for UI
  badgeColor: string;         // hex color for badge
  sortOrder: number;          // display ordering
  isActive: boolean;
  isDefault: boolean;         // free plan is default
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema: Schema = new Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    enum: ['free', 'starter', 'professional', 'premium'],
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  annualPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: 'monthly',
  },
  limits: {
    applicationsPerMonth: {
      type: Number,
      required: true,
      default: 5,
    },
    leadUnlocksPerMonth: {
      type: Number,
      required: true,
      default: 3,
    },
    creditsPerMonth: {
      type: Number,
      required: true,
      default: 5,
    },
    profileVisibilityBoost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    analyticsAccess: {
      type: String,
      enum: ['none', 'basic', 'advanced', 'full'],
      default: 'none',
    },
    priorityPlacement: {
      type: Boolean,
      default: false,
    },
    prioritySupport: {
      type: Boolean,
      default: false,
    },
    demoInsights: {
      type: Boolean,
      default: false,
    },
  },
  features: [{
    type: String,
  }],
  badge: {
    type: String,
    required: true,
  },
  badgeColor: {
    type: String,
    required: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

SubscriptionPlanSchema.index({ name: 1 });
SubscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);
