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
exports.RefundRequest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RefundRequestSchema = new mongoose_1.Schema({
    refundRequestId: { type: String, required: true, unique: true, index: true },
    paymentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leadUnlockId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LeadUnlock' },
    invoiceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invoice' },
    adminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    originalAmount: { type: Number, required: true },
    requestedAmount: { type: Number, required: true },
    approvedAmount: { type: Number },
    razorpayPaymentId: { type: String, required: true, index: true },
    razorpayRefundId: { type: String, index: true, sparse: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'processed', 'failed'],
        default: 'pending',
        index: true,
    },
    reason: { type: String, required: true, maxlength: 500 },
    adminNotes: { type: String, maxlength: 1000 },
    rejectionReason: { type: String, maxlength: 500 },
    daysSincePayment: { type: Number, required: true },
    isWithinPolicy: { type: Boolean, required: true },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    processedAt: { type: Date },
}, { timestamps: true });
RefundRequestSchema.index({ status: 1, createdAt: -1 });
RefundRequestSchema.index({ userId: 1, createdAt: -1 });
RefundRequestSchema.statics.generateId = function () {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `REF-${ts}-${rand}`;
};
exports.RefundRequest = mongoose_1.default.model('RefundRequest', RefundRequestSchema);
//# sourceMappingURL=RefundRequest.js.map