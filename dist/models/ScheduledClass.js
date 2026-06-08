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
exports.ScheduledClass = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ScheduledClassSchema = new mongoose_1.Schema({
    classId: {
        type: String,
        required: true,
        unique: true,
    },
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    teacherProfileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TeacherProfile',
        required: true,
    },
    studentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    requirementId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ParentRequirement',
        required: true,
    },
    applicationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TutorApplication',
        required: true,
    },
    demoId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'DemoClass',
    },
    subject: {
        type: String,
        required: true,
    },
    grade: {
        type: String,
        required: true,
    },
    schedule: {
        daysPerWeek: {
            type: Number,
            required: true,
            min: 1,
            max: 7,
        },
        days: [{
                type: String,
                required: true,
            }],
        timeSlot: {
            type: String,
            required: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
        },
    },
    fee: {
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        billingCycle: {
            type: String,
            enum: ['hourly', 'weekly', 'monthly'],
            default: 'monthly',
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'overdue'],
            default: 'pending',
        },
        lastPaymentDate: {
            type: Date,
        },
        nextPaymentDate: {
            type: Date,
        },
    },
    mode: {
        type: String,
        enum: ['home', 'online', 'center'],
        required: true,
    },
    location: {
        address: {
            type: String,
        },
        city: {
            type: String,
        },
        pincode: {
            type: String,
        },
        coordinates: {
            latitude: {
                type: Number,
            },
            longitude: {
                type: Number,
            },
        },
    },
    meetingDetails: {
        platform: {
            type: String,
        },
        meetingLink: {
            type: String,
        },
        meetingId: {
            type: String,
        },
        password: {
            type: String,
        },
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'cancelled'],
        default: 'active',
        index: true,
    },
    progress: {
        totalClasses: {
            type: Number,
            default: 0,
        },
        completedClasses: {
            type: Number,
            default: 0,
        },
        upcomingClasses: {
            type: Number,
            default: 0,
        },
        lastClassDate: {
            type: Date,
        },
        nextClassDate: {
            type: Date,
        },
    },
    attendance: [{
            date: {
                type: Date,
                required: true,
            },
            status: {
                type: String,
                enum: ['present', 'absent', 'cancelled', 'rescheduled'],
                required: true,
            },
            notes: {
                type: String,
            },
        }],
    performance: {
        parentRating: {
            type: Number,
            min: 1,
            max: 5,
        },
        teacherRating: {
            type: Number,
            min: 1,
            max: 5,
        },
        parentReview: {
            type: String,
            maxlength: 1000,
        },
        teacherReview: {
            type: String,
            maxlength: 1000,
        },
    },
    cancellation: {
        cancelledBy: {
            type: String,
            enum: ['parent', 'teacher'],
        },
        cancelledAt: {
            type: Date,
        },
        reason: {
            type: String,
        },
        refundAmount: {
            type: Number,
        },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
ScheduledClassSchema.index({ parentId: 1, status: 1, 'schedule.startDate': -1 });
ScheduledClassSchema.index({ teacherId: 1, status: 1, 'schedule.startDate': -1 });
ScheduledClassSchema.index({ 'schedule.nextClassDate': 1, status: 1 });
ScheduledClassSchema.index({ requirementId: 1, status: 1 });
ScheduledClassSchema.index({ applicationId: 1 });
ScheduledClassSchema.pre('save', function () {
    if (!this.classId) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        this.classId = `CLS-${timestamp}-${random}`;
    }
});
exports.ScheduledClass = mongoose_1.default.model('ScheduledClass', ScheduledClassSchema);
exports.default = exports.ScheduledClass;
//# sourceMappingURL=ScheduledClass.js.map