import mongoose from 'mongoose';
import { IInvoice } from '../models/Invoice';
export interface InvoiceInput {
    paymentId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    leadUnlockId?: mongoose.Types.ObjectId;
    promoCodeId?: mongoose.Types.ObjectId;
    promoCode?: string;
    promoDiscount: number;
    baseAmount: number;
    description: string;
    paymentType: 'unlock_lead' | 'unlock_tutor' | string;
}
export declare function generateInvoice(input: InvoiceInput): Promise<IInvoice>;
export declare function generatePdf(invoice: IInvoice): Promise<string>;
export declare function streamInvoicePdf(invoiceId: string, res: import('express').Response): Promise<void>;
//# sourceMappingURL=invoiceService.d.ts.map