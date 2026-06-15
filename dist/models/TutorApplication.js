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
exports.TutorApplication = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TutorApplicationSchema = new mongoose_1.Schema({
    parentRequirementId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ParentRequirement',
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
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    applicationId: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ['pending', 'shortlisted', 'rejected', 'accepted', 'withdrawn'],
        default: 'pending',
        index: true,
    },
    message: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    proposedFee: {
        type: Number,
        min: 0,
    },
    proposedSchedule: {
        daysPerWeek: {
            type: String,
        },
        preferredTimeSlots: [{
                type: String,
            }],
    },
    viewedByParent: {
        type: Boolean,
        default: false,
    },
    viewedAt: {
        type: Date,
    },
    shortlistedAt: {
        type: Date,
    },
    rejectedAt: {
        type: Date,
    },
    selectedAt: {
        type: Date,
    },
    hiredAt: {
        type: Date,
    },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    selectionReason: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    hireNotes: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    demoScheduled: {
        type: Boolean,
        default: false,
    },
    demoId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ContactRequest',
    },
    demoCompletedAt: {
        type: Date,
    },
    demoOutcome: {
        type: String,
        enum: ['interested', 'not_interested', 'need_follow_up'],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
TutorApplicationSchema.index({ parentRequirementId: 1, status: 1 });
TutorApplicationSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
TutorApplicationSchema.index({ parentId: 1, status: 1, createdAt: -1 });
TutorApplicationSchema.index({ createdAt: -1 });
TutorApplicationSchema.methods.markAsViewed = function () {
    this.status = 'viewed';
    this.viewedByParent = true;
    this.viewedAt = new Date();
    return this.save();
};
TutorApplicationSchema.methods.markAsShortlisted = function () {
    this.status = 'shortlisted';
    this.shortlistedAt = new Date();
    return this.save();
};
TutorApplicationSchema.methods.markAsRejected = function (reason) {
    this.status = 'rejected';
    this.rejectedAt = new Date();
    if (reason)
        this.rejectionReason = reason;
    return this.save();
};
TutorApplicationSchema.methods.markAsDemoScheduled = function (demoId) {
    this.status = 'demo_scheduled';
    this.demoScheduled = true;
    this.demoId = demoId;
    return this.save();
};
TutorApplicationSchema.methods.markAsDemoCompleted = function (outcome) {
    this.status = 'demo_completed';
    this.demoCompletedAt = new Date();
    this.demoOutcome = outcome;
    return this.save();
};
TutorApplicationSchema.methods.markAsSelected = function (reason) {
    this.status = 'selected';
    this.selectedAt = new Date();
    if (reason)
        this.selectionReason = reason;
    return this.save();
};
TutorApplicationSchema.methods.markAsHired = function (notes) {
    this.status = 'hired';
    this.hiredAt = new Date();
    if (notes)
        this.hireNotes = notes;
    return this.save();
};
TutorApplicationSchema.pre('save', async function () {
    if (!this.applicationId) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        this.applicationId = `APP-${timestamp}-${random}`;
    }
});
exports.TutorApplication = mongoose_1.default.model('TutorApplication', TutorApplicationSchema);
exports.default = exports.TutorApplication;
//# sourceMappingURL=TutorApplication.js.map