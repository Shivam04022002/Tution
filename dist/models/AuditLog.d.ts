import mongoose, { Document } from 'mongoose';
export type AuditAction = 'APPROVE_TEACHER' | 'REJECT_TEACHER' | 'BLOCK_TEACHER' | 'UNBLOCK_TEACHER' | 'BLOCK_USER' | 'UNBLOCK_USER' | 'DELETE_USER' | 'UPDATE_USER' | 'CLOSE_REQUIREMENT' | 'ADMIN_LOGIN' | 'IMPORT_PARENTS' | 'IMPORT_TEACHERS' | 'UNLOCK_LEAD' | 'UNLOCK_TUTOR' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'PAYMENT_REFUNDED' | 'CONTACT_REQUEST_CREATED' | 'DEMO_REQUEST_CREATED' | 'CONTACT_REQUEST_ACCEPTED' | 'CONTACT_REQUEST_REJECTED' | 'CONTACT_REQUEST_COMPLETED' | 'DEMO_RESCHEDULED' | 'PROMO_APPLIED' | 'PROMO_APPLY_FAILED' | 'REFERRAL_REGISTERED' | 'REFERRAL_REWARDED';
export type AuditEntityType = 'User' | 'TeacherProfile' | 'ParentRequirement' | 'TutorApplication' | 'DemoClass' | 'Payment' | 'LeadUnlock' | 'ContactRequest' | 'PromoCode' | 'Referral';
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
export declare const AuditLog: mongoose.Model<IAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, IAuditLog, {}, mongoose.DefaultSchemaOptions> & IAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAuditLog>;
export default AuditLog;
//# sourceMappingURL=AuditLog.d.ts.map