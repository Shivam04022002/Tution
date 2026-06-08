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
exports.Payment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PaymentSchema = new mongoose_1.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true,
    },
    type: {
        type: String,
        enum: ['lead_unlock', 'subscription', 'featured_profile', 'verification', 'refund'],
        required: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    tutorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TeacherProfile',
    },
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    requirementId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ParentRequirement',
    },
    leadUnlockId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'LeadUnlock',
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    gstAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    paymentMethod: {
        type: String,
        enum: ['upi', 'card', 'net_banking', 'wallet'],
        required: true,
    },
    paymentGateway: {
        orderId: {
            type: String,
            required: true,
        },
        paymentId: {
            type: String,
        },
        signature: {
            type: String,
        },
        status: {
            type: String,
            enum: ['created', 'authorized', 'captured', 'refunded', 'failed'],
            default: 'created',
        },
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending',
    },
    invoiceDetails: {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
        },
        invoiceDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        dueDate: {
            type: Date,
        },
        gstNumber: {
            type: String,
        },
        businessName: {
            type: String,
        },
        businessAddress: {
            type: String,
        },
        items: [{
                description: {
                    type: String,
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                unitPrice: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                gstRate: {
                    type: Number,
                    required: true,
                    min: 0,
                    max: 100,
                },
                gstAmount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                total: {
                    type: Number,
                    required: true,
                    min: 0,
                },
            }],
        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },
        gstTotal: {
            type: Number,
            required: true,
            min: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    refundDetails: {
        refundId: {
            type: String,
        },
        amount: {
            type: Number,
            min: 0,
        },
        reason: {
            type: String,
        },
        status: {
            type: String,
            enum: ['pending', 'processed', 'failed'],
            default: 'pending',
        },
        processedDate: {
            type: Date,
        },
        refundMethod: {
            type: String,
        },
    },
    metadata: {
        platform: {
            type: String,
            enum: ['web', 'mobile', 'admin'],
        },
        userAgent: {
            type: String,
        },
        ipAddress: {
            type: String,
        },
        source: {
            type: String,
        },
        campaign: {
            type: String,
        },
    },
    failureReason: {
        type: String,
    },
    paymentDate: {
        type: Date,
    },
    refundDate: {
        type: Date,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
PaymentSchema.index({ paymentId: 1 });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ tutorId: 1 });
PaymentSchema.index({ parentId: 1 });
PaymentSchema.index({ type: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ 'paymentGateway.orderId': 1 });
PaymentSchema.index({ 'paymentGateway.paymentId': 1 });
PaymentSchema.index({ 'invoiceDetails.invoiceNumber': 1 });
PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.virtual('isSuccessful').get(function () {
    return this.status === 'completed';
});
PaymentSchema.virtual('isRefunded').get(function () {
    return this.status === 'refunded' || this.status === 'partially_refunded';
});
PaymentSchema.virtual('refundableAmount').get(function () {
    if (this.status !== 'completed')
        return 0;
    const refundedAmount = this.refundDetails?.amount || 0;
    return this.totalAmount - refundedAmount;
});
PaymentSchema.pre('save', async function () {
    if (this.isModified('amount') && !this.gstAmount) {
        this.gstAmount = Math.round(this.amount * 0.18);
        this.totalAmount = this.amount + this.gstAmount;
    }
    if (this.isModified('status') && this.status === 'completed' && !this.paymentDate) {
        this.paymentDate = new Date();
    }
    if (this.isModified('status') && (this.status === 'refunded' || this.status === 'partially_refunded') && !this.refundDate) {
        this.refundDate = new Date();
    }
});
PaymentSchema.statics.generatePaymentId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `PAY-${timestamp}-${random}`.toUpperCase();
};
PaymentSchema.statics.generateInvoiceNumber = function () {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString(36).toUpperCase();
    return `INV-${year}${month}-${timestamp}`;
};
PaymentSchema.statics.getRevenueStats = function (startDate, endDate, type) {
    const matchStage = {
        status: 'completed',
    };
    if (startDate || endDate) {
        matchStage.paymentDate = {};
        if (startDate)
            matchStage.paymentDate.$gte = startDate;
        if (endDate)
            matchStage.paymentDate.$lte = endDate;
    }
    if (type) {
        matchStage.type = type;
    }
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$totalAmount' },
                totalGST: { $sum: '$gstAmount' },
                netRevenue: { $sum: '$amount' },
                totalPayments: { $sum: 1 },
                averagePayment: { $avg: '$totalAmount' },
            },
        },
        {
            $project: {
                totalRevenue: 1,
                totalGST: 1,
                netRevenue: 1,
                totalPayments: 1,
                averagePayment: 1,
                gstPercentage: {
                    $multiply: [
                        { $divide: ['$totalGST', '$netRevenue'] },
                        100
                    ]
                },
            },
        },
    ]);
};
PaymentSchema.statics.getRevenueByType = function (startDate, endDate) {
    const matchStage = {
        status: 'completed',
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
                _id: '$type',
                revenue: { $sum: '$totalAmount' },
                count: { $sum: 1 },
                averageAmount: { $avg: '$totalAmount' },
            },
        },
        { $sort: { revenue: -1 } },
    ]);
};
PaymentSchema.statics.getPaymentMethodStats = function (startDate, endDate) {
    const matchStage = {
        status: 'completed',
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
                _id: '$paymentMethod',
                revenue: { $sum: '$totalAmount' },
                count: { $sum: 1 },
                averageAmount: { $avg: '$totalAmount' },
            },
        },
        { $sort: { revenue: -1 } },
    ]);
};
PaymentSchema.statics.getFailedPayments = function (startDate, endDate) {
    const matchStage = {
        status: 'failed',
    };
    if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate)
            matchStage.createdAt.$gte = startDate;
        if (endDate)
            matchStage.createdAt.$lte = endDate;
    }
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    type: '$type',
                    method: '$paymentMethod',
                    reason: '$failureReason',
                },
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' },
            },
        },
        { $sort: { count: -1 } },
    ]);
};
PaymentSchema.methods.markAsCompleted = function (paymentId, signature) {
    this.status = 'completed';
    this.paymentGateway.paymentId = paymentId;
    if (signature)
        this.paymentGateway.signature = signature;
    this.paymentGateway.status = 'captured';
    this.paymentDate = new Date();
    return this.save();
};
PaymentSchema.methods.markAsFailed = function (reason) {
    this.status = 'failed';
    this.failureReason = reason;
    this.paymentGateway.status = 'failed';
    return this.save();
};
PaymentSchema.methods.processRefund = function (amount, reason, refundId) {
    const refundableAmount = this.refundableAmount;
    if (amount > refundableAmount) {
        throw new Error('Refund amount cannot exceed refundable amount');
    }
    this.refundDetails = {
        refundId,
        amount,
        reason,
        status: 'pending',
        refundMethod: this.paymentMethod,
    };
    if (amount === refundableAmount) {
        this.status = 'refunded';
    }
    else {
        this.status = 'partially_refunded';
    }
    return this.save();
};
PaymentSchema.methods.confirmRefund = function () {
    if (this.refundDetails) {
        this.refundDetails.status = 'processed';
        this.refundDetails.processedDate = new Date();
    }
    return this.save();
};
exports.Payment = mongoose_1.default.model('Payment', PaymentSchema);
//# sourceMappingURL=Payment.js.map