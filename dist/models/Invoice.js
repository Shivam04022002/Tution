"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Invoice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InvoiceSchema = new mongoose_1.Schema({
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    invoiceDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date },
    paymentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leadUnlockId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LeadUnlock' },
    promoCodeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PromoCode' },
    business: {
        name: { type: String, default: 'Tuition Marketplace Pvt. Ltd.' },
        address: { type: String, default: 'India' },
        gstin: { type: String, default: process.env.PLATFORM_GSTIN || 'NOT_REGISTERED' },
        email: { type: String, default: process.env.EMAIL_USER || 'billing@tuitionmarketplace.in' },
        phone: { type: String, default: process.env.PLATFORM_PHONE || '+91-0000000000' },
    },
    buyer: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        gstin: { type: String },
    },
    items: [
        {
            description: { type: String, required: true },
            hsn: { type: String, default: '998313' },
            quantity: { type: Number, required: true, default: 1 },
            unitPrice: { type: Number, required: true },
            discount: { type: Number, default: 0 },
            taxableAmount: { type: Number, required: true },
            gstRate: { type: Number, required: true },
            cgst: { type: Number, required: true },
            sgst: { type: Number, required: true },
            igst: { type: Number, default: 0 },
            totalGst: { type: Number, required: true },
            total: { type: Number, required: true },
        },
    ],
    subtotal: { type: Number, required: true },
    promoDiscount: { type: Number, default: 0 },
    gstTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    pdfPath: { type: String },
    pdfGeneratedAt: { type: Date },
    status: { type: String, enum: ['draft', 'issued', 'cancelled'], default: 'issued', index: true },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
}, { timestamps: true });
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.index({ status: 1, createdAt: -1 });
InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.statics.generateNumber = function () {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rand = Date.now().toString(36).toUpperCase().slice(-5);
    return `INV-${ym}-${rand}`;
};
exports.Invoice = mongoose_1.default.model('Invoice', InvoiceSchema);
//# sourceMappingURL=Invoice.js.map