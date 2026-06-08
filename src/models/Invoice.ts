import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────
export interface IInvoice extends Document {
  invoiceNumber: string;           // INV-202506-XXXXX
  invoiceDate: Date;
  dueDate?: Date;

  // Links
  paymentId: mongoose.Types.ObjectId;      // ref: Payment
  userId: mongoose.Types.ObjectId;         // ref: User (buyer)
  leadUnlockId?: mongoose.Types.ObjectId;  // ref: LeadUnlock
  promoCodeId?: mongoose.Types.ObjectId;   // ref: PromoCode (if applied)

  // Business details (platform side)
  business: {
    name: string;
    address: string;
    gstin: string;
    email: string;
    phone: string;
  };

  // Buyer details (snapshot at invoice time)
  buyer: {
    name: string;
    email: string;
    phone: string;
    gstin?: string;
  };

  // Line items
  items: Array<{
    description: string;
    hsn: string;          // HSN/SAC code for GST
    quantity: number;
    unitPrice: number;    // pre-discount
    discount: number;     // flat INR discount
    taxableAmount: number; // unitPrice * qty - discount
    gstRate: number;      // e.g. 18
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    total: number;
  }>;

  // Summary
  subtotal: number;        // sum of taxableAmounts
  promoDiscount: number;   // total promo discount applied
  gstTotal: number;        // sum of all GST
  grandTotal: number;      // subtotal + gstTotal

  // PDF
  pdfPath?: string;        // local or cloud path
  pdfGeneratedAt?: Date;

  // Status
  status: 'draft' | 'issued' | 'cancelled';
  cancelledAt?: Date;
  cancelReason?: string;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  generateNumber(): string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    invoiceDate:   { type: Date,   required: true, default: Date.now },
    dueDate:       { type: Date },

    paymentId:    { type: Schema.Types.ObjectId, ref: 'Payment',    required: true, index: true },
    userId:       { type: Schema.Types.ObjectId, ref: 'User',       required: true, index: true },
    leadUnlockId: { type: Schema.Types.ObjectId, ref: 'LeadUnlock' },
    promoCodeId:  { type: Schema.Types.ObjectId, ref: 'PromoCode'  },

    business: {
      name:    { type: String, default: 'Tuition Marketplace Pvt. Ltd.' },
      address: { type: String, default: 'India' },
      gstin:   { type: String, default: process.env.PLATFORM_GSTIN || 'NOT_REGISTERED' },
      email:   { type: String, default: process.env.EMAIL_USER || 'billing@tuitionmarketplace.in' },
      phone:   { type: String, default: process.env.PLATFORM_PHONE || '+91-0000000000' },
    },

    buyer: {
      name:  { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      gstin: { type: String },
    },

    items: [
      {
        description:   { type: String, required: true },
        hsn:           { type: String, default: '998313' }, // SAC for online info services
        quantity:      { type: Number, required: true, default: 1 },
        unitPrice:     { type: Number, required: true },
        discount:      { type: Number, default: 0 },
        taxableAmount: { type: Number, required: true },
        gstRate:       { type: Number, required: true },
        cgst:          { type: Number, required: true },
        sgst:          { type: Number, required: true },
        igst:          { type: Number, default: 0 },
        totalGst:      { type: Number, required: true },
        total:         { type: Number, required: true },
      },
    ],

    subtotal:      { type: Number, required: true },
    promoDiscount: { type: Number, default: 0 },
    gstTotal:      { type: Number, required: true },
    grandTotal:    { type: Number, required: true },

    pdfPath:        { type: String },
    pdfGeneratedAt: { type: Date },

    status:       { type: String, enum: ['draft', 'issued', 'cancelled'], default: 'issued', index: true },
    cancelledAt:  { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true },
);

// Indexes
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.index({ status: 1, createdAt: -1 });
InvoiceSchema.index({ userId: 1, createdAt: -1 });

// Static: generate invoice number
InvoiceSchema.statics.generateNumber = function (): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = Date.now().toString(36).toUpperCase().slice(-5);
  return `INV-${ym}-${rand}`;
};

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
