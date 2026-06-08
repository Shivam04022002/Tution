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
exports.LeadUnlock = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LeadUnlockSchema = new mongoose_1.Schema({
    requirementId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ParentRequirement',
        required: true,
    },
    tutorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TeacherProfile',
        required: true,
    },
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    unlockId: {
        type: String,
        required: true,
        unique: true,
    },
    paymentDetails: {
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        paymentMethod: {
            type: String,
            enum: ['upi', 'card', 'net_banking', 'wallet'],
            required: true,
        },
        transactionId: {
            type: String,
            required: true,
            unique: true,
        },
        razorpayOrderId: {
            type: String,
        },
        razorpayPaymentId: {
            type: String,
        },
        razorpaySignature: {
            type: String,
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'pending',
        },
        paymentDate: {
            type: Date,
        },
        refundAmount: {
            type: Number,
            min: 0,
        },
        refundReason: {
            type: String,
        },
        refundDate: {
            type: Date,
        },
    },
    parentContactDetails: {
        parentName: {
            type: String,
            required: true,
            trim: true,
        },
        mobileNumber: {
            type: String,
            required: true,
            match: /^[0-9]{10}$/,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
        },
        alternateNumber: {
            type: String,
            match: /^[0-9]{10}$/,
        },
    },
    unlockStatus: {
        type: String,
        enum: ['active', 'expired', 'refunded'],
        default: 'active',
    },
    unlockedAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    contactAttempts: [{
            attemptDate: {
                type: Date,
                default: Date.now,
            },
            method: {
                type: String,
                enum: ['call', 'whatsapp', 'email', 'sms'],
                required: true,
            },
            status: {
                type: String,
                enum: ['success', 'failed', 'pending'],
                default: 'pending',
            },
            notes: {
                type: String,
            },
        }],
    followUpRequired: {
        type: Boolean,
        default: false,
    },
    followUpDate: {
        type: Date,
    },
    conversionStatus: {
        type: String,
        enum: ['pending', 'interested', 'not_interested', 'converted', 'lost'],
        default: 'pending',
    },
    conversionDate: {
        type: Date,
    },
    notes: {
        type: String,
        trim: true,
    },
    isRefundEligible: {
        type: Boolean,
        default: true,
    },
    refundRequested: {
        type: Boolean,
        default: false,
    },
    refundRequestDate: {
        type: Date,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
LeadUnlockSchema.index({ requirementId: 1 });
LeadUnlockSchema.index({ tutorId: 1 });
LeadUnlockSchema.index({ parentId: 1 });
LeadUnlockSchema.index({ unlockId: 1 });
LeadUnlockSchema.index({ 'paymentDetails.transactionId': 1 });
LeadUnlockSchema.index({ 'paymentDetails.paymentStatus': 1 });
LeadUnlockSchema.index({ unlockStatus: 1 });
LeadUnlockSchema.index({ expiresAt: 1 });
LeadUnlockSchema.index({ conversionStatus: 1 });
LeadUnlockSchema.index({ createdAt: -1 });
LeadUnlockSchema.virtual('isExpired').get(function () {
    return new Date() > this.expiresAt;
});
LeadUnlockSchema.virtual('daysUntilExpiry').get(function () {
    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});
LeadUnlockSchema.virtual('canRequestRefund').get(function () {
    return this.isRefundEligible &&
        !this.refundRequested &&
        this.paymentDetails.paymentStatus === 'completed' &&
        this.conversionStatus === 'pending' &&
        new Date() <= new Date(this.unlockedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
});
LeadUnlockSchema.virtual('totalContactAttempts').get(function () {
    return this.contactAttempts.length;
});
LeadUnlockSchema.virtual('successfulContactAttempts').get(function () {
    return this.contactAttempts.filter((attempt) => attempt.status === 'success').length;
});
LeadUnlockSchema.pre('save', async function () {
    if (new Date() > this.expiresAt && this.unlockStatus === 'active') {
        this.unlockStatus = 'expired';
    }
    if (this.conversionStatus === 'converted' || this.conversionStatus === 'lost') {
        this.isRefundEligible = false;
    }
});
LeadUnlockSchema.statics.generateUnlockId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ULK-${timestamp}-${random}`.toUpperCase();
};
LeadUnlockSchema.statics.findByTutor = function (tutorId, status) {
    const query = { tutorId };
    if (status) {
        query.unlockStatus = status;
    }
    return this.find(query).populate('requirementId').populate('parentId');
};
LeadUnlockSchema.statics.findByParent = function (parentId) {
    return this.find({ parentId }).populate('tutorId').populate('requirementId');
};
LeadUnlockSchema.statics.findExpiringSoon = function (days = 7) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return this.find({
        expiresAt: { $lte: expiryDate, $gt: new Date() },
        unlockStatus: 'active',
    });
};
LeadUnlockSchema.statics.getRevenueStats = function (startDate, endDate) {
    const matchStage = {
        'paymentDetails.paymentStatus': 'completed',
    };
    if (startDate || endDate) {
        matchStage.paymentDate = {};
        if (startDate)
            matchStage.paymentDate.$gte = startDate;
        if (endDate)
            matchStage.paymentDate.$lte = endDate;
    }
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$paymentDetails.amount' },
                totalUnlocks: { $sum: 1 },
                averageRevenue: { $avg: '$paymentDetails.amount' },
                conversionRate: {
                    $avg: {
                        $cond: [
                            { $eq: ['$conversionStatus', 'converted'] },
                            1,
                            0
                        ]
                    }
                },
            },
        },
    ]);
};
LeadUnlockSchema.statics.getTutorPerformance = function (tutorId) {
    return this.aggregate([
        { $match: { tutorId: new mongoose_1.default.Types.ObjectId(tutorId) } },
        {
            $group: {
                _id: '$tutorId',
                totalUnlocks: { $sum: 1 },
                totalSpent: { $sum: '$paymentDetails.amount' },
                conversions: {
                    $sum: {
                        $cond: [
                            { $eq: ['$conversionStatus', 'converted'] },
                            1,
                            0
                        ]
                    }
                },
                conversionRate: {
                    $avg: {
                        $cond: [
                            { $eq: ['$conversionStatus', 'converted'] },
                            1,
                            0
                        ]
                    }
                },
            },
        },
    ]);
};
LeadUnlockSchema.methods.addContactAttempt = function (method, status, notes) {
    this.contactAttempts.push({
        attemptDate: new Date(),
        method,
        status,
        notes,
    });
    return this.save();
};
LeadUnlockSchema.methods.updateConversionStatus = function (status, notes) {
    this.conversionStatus = status;
    this.conversionDate = new Date();
    if (notes)
        this.notes = notes;
    return this.save();
};
LeadUnlockSchema.methods.requestRefund = function (reason) {
    if (!this.canRequestRefund) {
        throw new Error('Refund not eligible for this unlock');
    }
    this.refundRequested = true;
    this.refundRequestDate = new Date();
    this.paymentDetails.refundReason = reason;
    return this.save();
};
LeadUnlockSchema.methods.processRefund = function (amount, reason) {
    this.paymentDetails.refundAmount = amount;
    this.paymentDetails.refundReason = reason;
    this.paymentDetails.refundDate = new Date();
    this.paymentDetails.paymentStatus = 'refunded';
    this.unlockStatus = 'refunded';
    return this.save();
};
LeadUnlockSchema.methods.extendExpiry = function (days = 7) {
    const newExpiryDate = new Date(this.expiresAt);
    newExpiryDate.setDate(newExpiryDate.getDate() + days);
    this.expiresAt = newExpiryDate;
    this.unlockStatus = 'active';
    return this.save();
};
LeadUnlockSchema.methods.setFollowUp = function (followUpDate, required = true) {
    this.followUpRequired = required;
    this.followUpDate = followUpDate;
    return this.save();
};
exports.LeadUnlock = mongoose_1.default.model('LeadUnlock', LeadUnlockSchema);
//# sourceMappingURL=LeadUnlock.js.map