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
exports.Notification = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const NotificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: [
            'TEACHER_APPLIED', 'DEMO_SCHEDULED', 'PAYMENT_SUCCESS', 'REFUND_APPROVED', 'REFUND_REJECTED',
            'CONTACT_REQUEST_ACCEPTED', 'CONTACT_REQUEST_REJECTED',
            'DEMO_REQUEST_ACCEPTED', 'DEMO_REQUEST_REJECTED', 'DEMO_RESCHEDULED_BY_TEACHER', 'DEMO_COMPLETED',
            'NEW_LEAD_MATCH', 'APPLICATION_SHORTLISTED', 'APPLICATION_ACCEPTED', 'APPLICATION_REJECTED',
            'DEMO_CONFIRMED', 'LEAD_UNLOCK_SUCCESS',
            'CONTACT_REQUEST_RECEIVED', 'DEMO_REQUEST_RECEIVED',
            'SUBSCRIPTION_CHANGED', 'CREDIT_CHANGED',
            'REFUND_REQUEST', 'TEACHER_REGISTRATION', 'IMPORT_COMPLETED',
            'KYC_SUBMITTED', 'KYC_APPROVED', 'KYC_REJECTED', 'KYC_REUPLOAD_REQUIRED', 'NEW_KYC_SUBMISSION',
            'CAMPAIGN_BROADCAST',
            'SYSTEM',
        ],
    },
    category: {
        type: String,
        required: true,
        enum: ['payment', 'application', 'demo', 'lead', 'admin', 'system', 'subscription', 'credits', 'kyc', 'promotions', 'referrals'],
        index: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    data: { type: mongoose_1.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    entityId: { type: mongoose_1.Schema.Types.ObjectId },
    entityType: { type: String },
}, { timestamps: true });
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
exports.Notification = mongoose_1.default.model('Notification', NotificationSchema);
//# sourceMappingURL=Notification.js.map