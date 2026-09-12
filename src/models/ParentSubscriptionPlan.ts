import mongoose, { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Parent subscription plan catalog. Distinct from the teacher SubscriptionPlan
// model — a parent's plan is a flat-price, fixed-duration contact-access pass,
// not a feature-tier ladder, so it does not share that model's fields
// (applicationsPerMonth, leadUnlocksPerMonth, profileVisibilityBoost, etc.).
// ─────────────────────────────────────────────────────────────────────────────

export interface IParentSubscriptionPlan extends Document {
  planId: string;
  name: 'monthly' | 'quarterly' | 'annual';
  displayName: string;
  description: string;
  price: number;          // flat price in INR for the whole durationDays period
  durationDays: number;
  contactLimit: number;   // -1 = unlimited. Not enforced yet — reserved for future use.
  features: string[];
  badge: string;
  badgeColor: string;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ParentSubscriptionPlanSchema: Schema = new Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
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
  durationDays: {
    type: Number,
    required: true,
    min: 1,
  },
  contactLimit: {
    type: Number,
    required: true,
    default: -1,
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

ParentSubscriptionPlanSchema.index({ name: 1 });
ParentSubscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export const ParentSubscriptionPlan = mongoose.model<IParentSubscriptionPlan>(
  'ParentSubscriptionPlan',
  ParentSubscriptionPlanSchema
);
