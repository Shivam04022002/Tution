import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Notification types — exhaustive union used for icon/routing on mobile
// ─────────────────────────────────────────────────────────────────────────────
export type NotificationType =
  // Parent
  | 'TEACHER_APPLIED'
  | 'DEMO_SCHEDULED'
  | 'PAYMENT_SUCCESS'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  // Teacher
  | 'NEW_LEAD_MATCH'
  | 'APPLICATION_SHORTLISTED'
  | 'APPLICATION_ACCEPTED'
  | 'APPLICATION_REJECTED'
  | 'DEMO_CONFIRMED'
  | 'LEAD_UNLOCK_SUCCESS'
  // Admin
  | 'REFUND_REQUEST'
  | 'TEACHER_REGISTRATION'
  | 'IMPORT_COMPLETED'
  // Generic
  | 'SYSTEM';

export type NotificationCategory = 'payment' | 'application' | 'demo' | 'lead' | 'admin' | 'system';

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────
export interface INotification extends Document {
  userId:   mongoose.Types.ObjectId;    // recipient
  type:     NotificationType;
  category: NotificationCategory;

  title:   string;
  body:    string;
  data?:   Record<string, any>;        // deep-link payload (screen + params)

  isRead:  boolean;
  readAt?: Date;

  // Linking
  entityId?:   mongoose.Types.ObjectId;
  entityType?: string;                 // 'Payment' | 'LeadUnlock' | 'TutorApplication' | etc.

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: {
      type: String,
      required: true,
      enum: [
        'TEACHER_APPLIED', 'DEMO_SCHEDULED', 'PAYMENT_SUCCESS', 'REFUND_APPROVED', 'REFUND_REJECTED',
        'NEW_LEAD_MATCH', 'APPLICATION_SHORTLISTED', 'APPLICATION_ACCEPTED', 'APPLICATION_REJECTED',
        'DEMO_CONFIRMED', 'LEAD_UNLOCK_SUCCESS',
        'REFUND_REQUEST', 'TEACHER_REGISTRATION', 'IMPORT_COMPLETED',
        'SYSTEM',
      ],
    },

    category: {
      type: String,
      required: true,
      enum: ['payment', 'application', 'demo', 'lead', 'admin', 'system'],
      index: true,
    },

    title:  { type: String, required: true, maxlength: 120 },
    body:   { type: String, required: true, maxlength: 500 },
    data:   { type: Schema.Types.Mixed },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },

    entityId:   { type: Schema.Types.ObjectId },
    entityType: { type: String },
  },
  { timestamps: true },
);

// Compound indexes for the most common query patterns
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
