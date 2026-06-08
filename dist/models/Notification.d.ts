import mongoose, { Document } from 'mongoose';
export type NotificationType = 'TEACHER_APPLIED' | 'DEMO_SCHEDULED' | 'PAYMENT_SUCCESS' | 'REFUND_APPROVED' | 'REFUND_REJECTED' | 'NEW_LEAD_MATCH' | 'APPLICATION_SHORTLISTED' | 'APPLICATION_ACCEPTED' | 'APPLICATION_REJECTED' | 'DEMO_CONFIRMED' | 'LEAD_UNLOCK_SUCCESS' | 'REFUND_REQUEST' | 'TEACHER_REGISTRATION' | 'IMPORT_COMPLETED' | 'SYSTEM';
export type NotificationCategory = 'payment' | 'application' | 'demo' | 'lead' | 'admin' | 'system';
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