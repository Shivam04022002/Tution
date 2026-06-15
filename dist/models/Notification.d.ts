import mongoose, { Document } from 'mongoose';
export type NotificationType = 'TEACHER_APPLIED' | 'DEMO_SCHEDULED' | 'PAYMENT_SUCCESS' | 'REFUND_APPROVED' | 'REFUND_REJECTED' | 'CONTACT_REQUEST_ACCEPTED' | 'CONTACT_REQUEST_REJECTED' | 'DEMO_REQUEST_ACCEPTED' | 'DEMO_REQUEST_REJECTED' | 'DEMO_RESCHEDULED_BY_TEACHER' | 'DEMO_COMPLETED' | 'NEW_LEAD_MATCH' | 'APPLICATION_VIEWED' | 'APPLICATION_SHORTLISTED' | 'APPLICATION_ACCEPTED' | 'APPLICATION_REJECTED' | 'TEACHER_SELECTED' | 'TEACHER_HIRED' | 'REQUIREMENT_CLOSED' | 'DEMO_CONFIRMED' | 'LEAD_UNLOCK_SUCCESS' | 'CONTACT_REQUEST_RECEIVED' | 'DEMO_REQUEST_RECEIVED' | 'SUBSCRIPTION_CHANGED' | 'CREDIT_CHANGED' | 'REFUND_REQUEST' | 'TEACHER_REGISTRATION' | 'IMPORT_COMPLETED' | 'KYC_SUBMITTED' | 'KYC_APPROVED' | 'KYC_REJECTED' | 'KYC_REUPLOAD_REQUIRED' | 'NEW_KYC_SUBMISSION' | 'CAMPAIGN_BROADCAST' | 'SYSTEM';
export type NotificationCategory = 'payment' | 'application' | 'demo' | 'lead' | 'admin' | 'system' | 'subscription' | 'credits' | 'kyc' | 'promotions' | 'referrals';
export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    body: string;
    data?: Record<string, any>;
    isRead: boolean;
    readAt?: Date;
    entityId?: mongoose.Types.ObjectId;
    entityType?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Notification: mongoose.Model<INotification, {}, {}, {}, mongoose.Document<unknown, {}, INotification, {}, mongoose.DefaultSchemaOptions> & INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, INotification>;
//# sourceMappingURL=Notification.d.ts.map