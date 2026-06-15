import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Campaign types
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignType =
  | 'broadcast'
  | 'scheduled'
  | 'triggered'
  | 'promotional'
  | 'system'
  | 'transactional';

// ─────────────────────────────────────────────────────────────────────────────
// Target audience segments
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignAudience =
  | 'all_users'
  | 'all_teachers'
  | 'all_parents'
  | 'verified_teachers'
  | 'premium_teachers'
  | 'free_teachers'
  | 'kyc_pending'
  | 'active_parents'
  | 'inactive_users'
  | 'custom_segment';

// ─────────────────────────────────────────────────────────────────────────────
// Delivery status
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled';

// ─────────────────────────────────────────────────────────────────────────────
// Delivery stats sub-document
// ─────────────────────────────────────────────────────────────────────────────
export interface ICampaignDeliveryStats {
  totalTargeted: number;
  sent:          number;
  delivered:     number;
  opened:        number;
  clicked:       number;
  failed:        number;
  openRate:      number; // percentage (0-100)
  ctr:           number; // click-through rate (0-100)
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom segment filter (used when audience = 'custom_segment')
// ─────────────────────────────────────────────────────────────────────────────
export interface ICustomSegment {
  roles?:             string[];   // ['parent','teacher']
  cities?:            string[];
  subjects?:          string[];
  planNames?:         string[];   // ['free','starter','professional','premium']
  kycStatus?:         string[];   // ['pending','submitted','verified','rejected']
  registeredAfter?:   Date;
  registeredBefore?:  Date;
  lastActiveAfter?:   Date;
  lastActiveBefore?:  Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main interface
// ─────────────────────────────────────────────────────────────────────────────
export interface INotificationCampaign extends Document {
  campaignId:     string;
  title:          string;
  message:        string;
  imageUrl?:      string;
  deepLinkScreen?: string;        // e.g. 'TeacherCredits', 'TutorProfile'
  deepLinkParams?: Record<string, any>;

  campaignType:   CampaignType;
  targetAudience: CampaignAudience;
  customSegment?: ICustomSegment;

  status:       CampaignStatus;
  scheduledAt?: Date;
  sentAt?:      Date;

  deliveryStats: ICampaignDeliveryStats;

  // Tracking: list of notification._id docs created for this campaign
  notificationIds: mongoose.Types.ObjectId[];

  createdBy:  mongoose.Types.ObjectId;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const DeliveryStatsSchema = new Schema<ICampaignDeliveryStats>(
  {
    totalTargeted: { type: Number, default: 0 },
    sent:          { type: Number, default: 0 },
    delivered:     { type: Number, default: 0 },
    opened:        { type: Number, default: 0 },
    clicked:       { type: Number, default: 0 },
    failed:        { type: Number, default: 0 },
    openRate:      { type: Number, default: 0 },
    ctr:           { type: Number, default: 0 },
  },
  { _id: false },
);

const CustomSegmentSchema = new Schema<ICustomSegment>(
  {
    roles:              [{ type: String }],
    cities:             [{ type: String }],
    subjects:           [{ type: String }],
    planNames:          [{ type: String }],
    kycStatus:          [{ type: String }],
    registeredAfter:    { type: Date },
    registeredBefore:   { type: Date },
    lastActiveAfter:    { type: Date },
    lastActiveBefore:   { type: Date },
  },
  { _id: false },
);

const NotificationCampaignSchema = new Schema<INotificationCampaign>(
  {
    campaignId: { type: String, unique: true, index: true },

    title:           { type: String, required: true, maxlength: 120 },
    message:         { type: String, required: true, maxlength: 500 },
    imageUrl:        { type: String },
    deepLinkScreen:  { type: String },
    deepLinkParams:  { type: Schema.Types.Mixed },

    campaignType: {
      type: String,
      required: true,
      enum: ['broadcast', 'scheduled', 'triggered', 'promotional', 'system', 'transactional'],
      default: 'broadcast',
    },

    targetAudience: {
      type: String,
      required: true,
      enum: [
        'all_users', 'all_teachers', 'all_parents',
        'verified_teachers', 'premium_teachers', 'free_teachers',
        'kyc_pending', 'active_parents', 'inactive_users', 'custom_segment',
      ],
    },

    customSegment: { type: CustomSegmentSchema },

    status: {
      type: String,
      required: true,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    scheduledAt: { type: Date },
    sentAt:      { type: Date },

    deliveryStats:   { type: DeliveryStatsSchema, default: () => ({}) },
    notificationIds: [{ type: Schema.Types.ObjectId, ref: 'Notification' }],

    createdBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String },
  },
  { timestamps: true },
);

// ─── Auto-generate campaignId pre-save ────────────────────────────────────────
NotificationCampaignSchema.pre('save', async function () {
  if (!this.campaignId) {
    const count = await (this.constructor as any).countDocuments();
    this.campaignId = `CMP-${String(count + 1).padStart(5, '0')}`;
  }
});

// ─── Compound indexes ─────────────────────────────────────────────────────────
NotificationCampaignSchema.index({ status: 1, createdAt: -1 });
NotificationCampaignSchema.index({ campaignType: 1, createdAt: -1 });
NotificationCampaignSchema.index({ targetAudience: 1, status: 1 });
NotificationCampaignSchema.index({ scheduledAt: 1, status: 1 }); // for scheduler

export const NotificationCampaign = mongoose.model<INotificationCampaign>(
  'NotificationCampaign',
  NotificationCampaignSchema,
);
