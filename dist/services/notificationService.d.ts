import mongoose from 'mongoose';
import { NotificationType, NotificationCategory } from '../models/Notification';
export interface SendNotificationInput {
    userId: mongoose.Types.ObjectId | string;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    body: string;
    data?: Record<string, any>;
    entityId?: mongoose.Types.ObjectId | string;
    entityType?: string;
}
export declare function sendNotification(input: SendNotificationInput): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function sendNotificationToMany(userIds: (mongoose.Types.ObjectId | string)[], input: Omit<SendNotificationInput, 'userId'>): Promise<void>;
export declare function notifyTeacherApplied(parentUserId: mongoose.Types.ObjectId | string, teacherName: string, subject: string, applicationId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyDemoScheduled(parentUserId: mongoose.Types.ObjectId | string, teacherName: string, subject: string, demoDate: Date, demoId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyPaymentSuccess(parentUserId: mongoose.Types.ObjectId | string, amount: number, description: string, paymentId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyRefundApproved(userId: mongoose.Types.ObjectId | string, amount: number, refundRequestId: string, refundId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyRefundRejected(userId: mongoose.Types.ObjectId | string, amount: number, reason: string, refundId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyNewLeadMatch(teacherUserId: mongoose.Types.ObjectId | string, subject: string, grade: string, city: string, requirementId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyApplicationShortlisted(teacherUserId: mongoose.Types.ObjectId | string, subject: string, applicationId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyDemoConfirmed(teacherUserId: mongoose.Types.ObjectId | string, subject: string, demoDate: Date, demoId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyLeadUnlockSuccess(teacherUserId: mongoose.Types.ObjectId | string, parentName: string, unlockId: mongoose.Types.ObjectId | string): Promise<(mongoose.Document<unknown, {}, import("../models/Notification").INotification, {}, mongoose.DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export declare function notifyAdminRefundRequest(adminUserIds: (mongoose.Types.ObjectId | string)[], requestedAmount: number, refundRequestId: string, entityId: mongoose.Types.ObjectId | string): Promise<void>;
export declare function notifyAdminTeacherRegistration(adminUserIds: (mongoose.Types.ObjectId | string)[], teacherName: string, teacherId: mongoose.Types.ObjectId | string): Promise<void>;
export declare function notifyAdminImportCompleted(adminUserIds: (mongoose.Types.ObjectId | string)[], importType: string, count: number, importId: mongoose.Types.ObjectId | string): Promise<void>;
//# sourceMappingURL=notificationService.d.ts.map