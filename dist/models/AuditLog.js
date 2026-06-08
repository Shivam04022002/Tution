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
exports.AuditLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AuditLogSchema = new mongoose_1.Schema({
    adminId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    action: {
        type: String,
        enum: [
            'APPROVE_TEACHER',
            'REJECT_TEACHER',
            'BLOCK_TEACHER',
            'UNBLOCK_TEACHER',
            'BLOCK_USER',
            'UNBLOCK_USER',
            'DELETE_USER',
            'UPDATE_USER',
            'CLOSE_REQUIREMENT',
            'ADMIN_LOGIN',
            'IMPORT_PARENTS',
            'IMPORT_TEACHERS',
            'UNLOCK_LEAD',
            'UNLOCK_TUTOR',
            'PAYMENT_SUCCESS',
            'PAYMENT_FAILED',
            'PAYMENT_REFUNDED',
        ],
        required: true,
    },
    entityType: {
        type: String,
        enum: [
            'User',
            'TeacherProfile',
            'ParentRequirement',
            'TutorApplication',
            'DemoClass',
            'Payment',
            'LeadUnlock',
        ],
        required: true,
    },
    entityId: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
    },
    oldValue: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    newValue: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    ipAddress: {
        type: String,
        trim: true,
    },
    userAgent: {
        type: String,
        trim: true,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
AuditLogSchema.index({ adminId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ createdAt: -1 });
exports.AuditLog = mongoose_1.default.model('AuditLog', AuditLogSchema);
exports.default = exports.AuditLog;
//# sourceMappingURL=AuditLog.js.map