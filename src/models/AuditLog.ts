import mongoose, { Document, Schema } from 'mongoose';

export type AuditAction =
  | 'APPROVE_TEACHER'
  | 'REJECT_TEACHER'
  | 'BLOCK_TEACHER'
  | 'UNBLOCK_TEACHER'
  | 'BLOCK_USER'
  | 'UNBLOCK_USER'
  | 'DELETE_USER'
  | 'UPDATE_USER'
  | 'CLOSE_REQUIREMENT'
  | 'ADMIN_LOGIN'
  | 'IMPORT_PARENTS'
  | 'IMPORT_TEACHERS'
  | 'UNLOCK_LEAD'
  | 'UNLOCK_TUTOR'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  | 'CONTACT_REQUEST_CREATED'
  | 'DEMO_REQUEST_CREATED'
  | 'CONTACT_REQUEST_ACCEPTED'
  | 'CONTACT_REQUEST_REJECTED'
  | 'CONTACT_REQUEST_COMPLETED'
  | 'DEMO_RESCHEDULED'
  | 'PROMO_APPLIED'
  | 'PROMO_APPLY_FAILED'
  | 'REFERRAL_REGISTERED'
  | 'REFERRAL_REWARDED';

export type AuditEntityType =
  | 'User'
  | 'TeacherProfile'
  | 'ParentRequirement'
  | 'TutorApplication'
  | 'DemoClass'
  | 'Payment'
  | 'LeadUnlock'
  | 'ContactRequest'
  | 'PromoCode'
  | 'Referral';

export interface IAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: mongoose.Types.ObjectId | string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'APPROVE_TEACHER',
        'REJECT_TEACHER',
        'BLOCK_TEACHER',
        'UNBLOCK_TEACHER',
        'BLOCK_USER',
        'UNBLOCK_USER',
        'DELETE_USER',
        'UPDATE_USER',
        'CLOSE_REQUIREMENT',
        'ADMIN_LOGIN',
        'IMPORT_PARENTS',
        'IMPORT_TEACHERS',
        'UNLOCK_LEAD',
        'UNLOCK_TUTOR',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'PAYMENT_REFUNDED',
        'CONTACT_REQUEST_CREATED',
        'DEMO_REQUEST_CREATED',
        'CONTACT_REQUEST_ACCEPTED',
        'CONTACT_REQUEST_REJECTED',
        'CONTACT_REQUEST_COMPLETED',
        'DEMO_RESCHEDULED',
        'PROMO_APPLIED',
        'PROMO_APPLY_FAILED',
        'REFERRAL_REGISTERED',
        'REFERRAL_REWARDED',
      ],
      required: true,
    },
    entityType: {
      type: String,
      enum: [
        'User',
        'TeacherProfile',
        'ParentRequirement',
        'TutorApplication',
        'DemoClass',
        'Payment',
        'LeadUnlock',
        'ContactRequest',
        'PromoCode',
        'Referral',
      ],
      required: true,
    },
    entityId: {
      type: Schema.Types.Mixed,
      required: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    details: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ adminId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
