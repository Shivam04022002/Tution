import mongoose, { Document } from 'mongoose';
export interface IPayment extends Document {
    paymentId: string;
    type: 'lead_unlock' | 'subscription' | 'featured_profile' | 'verification' | 'refund';
    userId: mongoose.Types.ObjectId;
    tutorId?: mongoose.Types.ObjectId;
    parentId?: mongoose.Types.ObjectId;
    requirementId?: mongoose.Types.ObjectId;
    leadUnlockId?: mongoose.Types.ObjectId;
    amount: number;
    currency: string;
    gstAmount: number;
    totalAmount: number;
    paymentMethod: 'upi' | 'card' | 'net_banking' | 'wallet';
    paymentGateway: {
        orderId: string;
        paymentId: string;
        signature?: string;
        status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
    };
    status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
    invoiceDetails: {
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate?: Date;
        gstNumber?: string;
        businessName?: string;
        businessAddress?: string;
        items: Array<{
            description: string;
            quantity: number;
            unitPrice: number;
            gstRate: number;
            gstAmount: number;
            total: number;
        }>;
        subtotal: number;
        gstTotal: number;
        total: number;
    };
    refundDetails?: {
        refundId: string;
        amount: number;
        reason: string;
        status: 'pending' | 'processed' | 'failed';
        processedDate?: Date;
        refundMethod: string;
    };
    metadata: {
        platform?: 'web' | 'mobile' | 'admin';
        userAgent?: string;
        ipAddress?: string;
        source?: string;
        campaign?: string;
    };
    failureReason?: string;
    paymentDate?: Date;
    refundDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Payment: mongoose.Model<IPayment, {}, {}, {}, mongoose.Document<unknown, {}, IPayment, {}, mongoose.DefaultSchemaOptions> & IPayment & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPayment>;
//# sourceMappingURL=Payment.d.ts.map