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
exports.TutorMatch = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TutorMatchSchema = new mongoose_1.Schema({
    requirementId: {
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
    matchId: {
        type: String,
        required: true,
        unique: true,
    },
    overallScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        index: true,
    },
    breakdown: {
        subjectScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        subjectMatchDetails: {
            requirementSubjects: [String],
            teacherSubjects: [String],
            matchedSubjects: [String],
            matchPercentage: {
                type: Number,
                min: 0,
                max: 100,
            },
        },
        classScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        classMatchDetails: {
            requirementGrade: String,
            teacherClasses: [String],
            isMatch: Boolean,
        },
        boardScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        boardMatchDetails: {
            requirementBoard: String,
            teacherBoards: [String],
            isMatch: Boolean,
        },
        locationScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        locationMatchDetails: {
            requirementCity: String,
            teacherCity: String,
            requirementPincode: String,
            teacherPincode: String,
            distance: Number,
            teachingRadius: Number,
            isWithinRadius: Boolean,
        },
        budgetScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        budgetMatchDetails: {
            requirementMinBudget: Number,
            requirementMaxBudget: Number,
            teacherHourlyRate: Number,
            isWithinBudget: Boolean,
        },
        modeScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        modeMatchDetails: {
            requirementMode: String,
            teacherModes: [String],
            isMatch: Boolean,
        },
        timingScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        timingMatchDetails: {
            requirementTimeSlots: [String],
            teacherDays: [String],
            teacherTimeSlots: [String],
            timeOverlap: [String],
            timeScore: Number,
        },
        bonusDetails: {
            genderScore: { type: Number, default: 0 },
            languageScore: { type: Number, default: 0 },
            experienceScore: { type: Number, default: 0 },
            totalBonus: { type: Number, default: 0 },
        },
    },
    algorithmVersion: {
        type: String,
        default: 'v2.0',
    },
    status: {
        type: String,
        enum: ['recommended', 'viewed', 'applied', 'shortlisted', 'rejected', 'hired', 'expired'],
        default: 'recommended',
        index: true,
    },
    viewedAt: {
        type: Date,
    },
    appliedAt: {
        type: Date,
    },
    shortlistedAt: {
        type: Date,
    },
    rejectedAt: {
        type: Date,
    },
    hiredAt: {
        type: Date,
    },
    expiryDate: {
        type: Date,
        required: true,
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
});
TutorMatchSchema.index({ requirementId: 1, overallScore: -1, status: 1 });
TutorMatchSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
TutorMatchSchema.index({ parentId: 1, status: 1, createdAt: -1 });
TutorMatchSchema.index({ expiryDate: 1, status: 1 });
TutorMatchSchema.index({ requirementId: 1, teacherId: 1 }, { unique: true });
TutorMatchSchema.index({ isActive: 1, expiryDate: 1 });
TutorMatchSchema.index({ algorithmVersion: 1 });
TutorMatchSchema.pre('validate', function () {
    if (!this.matchId) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        this.matchId = `MATCH-${timestamp}-${random}`;
    }
});
exports.TutorMatch = mongoose_1.default.model('TutorMatch', TutorMatchSchema);
exports.default = exports.TutorMatch;
//# sourceMappingURL=TutorMatch.js.map