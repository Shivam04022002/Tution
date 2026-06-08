import mongoose, { Document } from 'mongoose';
export interface IRefundRequest extends Document {
    refundRequestId: string;
    paymentId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    leadUnlockId?: mongoose.Types.ObjectId;
    invoiceId?: mongoose.Types.ObjectId;
    adminId?: mongoose.Types.ObjectId;
    originalAmount: number;
    requestedAmount: number;
    approvedAmount?: number;
    razorpayPaymentId: string;
    razorpayRefundId?: string;
    status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
    reason: string;
    adminNotes?: string;
    rejectionReason?: string;
    daysSincePayment: number;
    isWithinPolicy: boolean;
    requestedAt: Date;
    reviewedAt?: Date;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RefundRequest: mongoose.Model<IRefundRequest, {}, {}, {}, mongoose.Document<unknown, {}, IRefundRequest, {}, mongoose.DefaultSchemaOptions> & IRefundRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IRefundRequest>;
//# sourceMappingURL=RefundRequest.d.ts.map