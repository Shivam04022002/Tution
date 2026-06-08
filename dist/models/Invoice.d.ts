import mongoose, { Document } from 'mongoose';
export interface IInvoice extends Document {
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate?: Date;
    paymentId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    leadUnlockId?: mongoose.Types.ObjectId;
    promoCodeId?: mongoose.Types.ObjectId;
    business: {
        name: string;
        address: string;
        gstin: string;
        email: string;
        phone: string;
    };
    buyer: {
        name: string;
        email: string;
        phone: string;
        gstin?: string;
    };
    items: Array<{
        description: string;
        hsn: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        taxableAmount: number;
        gstRate: number;
        cgst: number;
        sgst: number;
        igst: number;
        totalGst: number;
        total: number;
    }>;
    subtotal: number;
    promoDiscount: number;
    gstTotal: number;
    grandTotal: number;
    pdfPath?: string;
    pdfGeneratedAt?: Date;
    status: 'draft' | 'issued' | 'cancelled';
    cancelledAt?: Date;
    cancelReason?: string;
    createdAt: Date;
    updatedAt: Date;
    generateNumber(): string;
}
export declare const Invoice: mongoose.Model<IInvoice, {}, {}, {}, mongoose.Document<unknown, {}, IInvoice, {}, mongoose.DefaultSchemaOptions> & IInvoice & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IInvoice>;
//# sourceMappingURL=Invoice.d.ts.map