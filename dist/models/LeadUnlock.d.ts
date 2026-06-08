import mongoose, { Document } from 'mongoose';
export interface ILeadUnlock extends Document {
    requirementId: mongoose.Types.ObjectId;
    tutorId: mongoose.Types.ObjectId;
    parentId: mongoose.Types.ObjectId;
    unlockId: string;
    paymentDetails: {
        amount: number;
        currency: string;
        paymentMethod: string;
        transactionId: string;
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        razorpaySignature?: string;
        paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
        paymentDate?: Date;
        refundAmount?: number;
        refundReason?: string;
        refundDate?: Date;
    };
    parentContactDetails: {
        parentName: string;
        mobileNumber: string;
        email: string;
        address: string;
        alternateNumber?: string;
    };
    unlockStatus: 'active' | 'expired' | 'refunded';
    unlockedAt: Date;
    expiresAt: Date;
    contactAttempts: {
        attemptDate: Date;
        method: 'call' | 'whatsapp' | 'email' | 'sms';
        status: 'success' | 'failed' | 'pending';
        notes?: string;
    }[];
    followUpRequired: boolean;
    followUpDate?: Date;
    conversionStatus: 'pending' | 'interested' | 'not_interested' | 'converted' | 'lost';
    conversionDate?: Date;
    notes: string;
    isRefundEligible: boolean;
    refundRequested: boolean;
    refundRequestDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const LeadUnlock: mongoose.Model<ILeadUnlock, {}, {}, {}, mongoose.Document<unknown, {}, ILeadUnlock, {}, mongoose.DefaultSchemaOptions> & ILeadUnlock & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ILeadUnlock>;
//# sourceMappingURL=LeadUnlock.d.ts.map