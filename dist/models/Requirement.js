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
exports.Requirement = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const requirementSchema = new mongoose_1.Schema({
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    studentInfo: {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        grade: {
            type: String,
            required: true,
            trim: true,
        },
        board: {
            type: String,
            required: true,
            trim: true,
        },
        school: {
            type: String,
            trim: true,
        },
        currentPerformance: {
            type: String,
            trim: true,
        },
        learningGoals: [{
                type: String,
                trim: true,
            }],
    },
    subjectRequirements: [{
            subject: {
                type: String,
                required: true,
                trim: true,
            },
            currentLevel: {
                type: String,
                required: true,
                trim: true,
            },
            targetLevel: {
                type: String,
                required: true,
                trim: true,
            },
            priority: {
                type: String,
                enum: ['high', 'medium', 'low'],
                required: true,
            },
        }],
    location: {
        address: {
            type: String,
            required: true,
            trim: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
        },
        state: {
            type: String,
            required: true,
            trim: true,
        },
        pincode: {
            type: String,
            required: true,
            trim: true,
        },
        coordinates: {
            latitude: {
                type: Number,
                required: true,
                min: -90,
                max: 90,
            },
            longitude: {
                type: Number,
                required: true,
                min: -180,
                max: 180,
            },
        },
        preferredRadius: {
            type: Number,
            required: true,
            min: 1,
            max: 50,
            default: 5,
        },
    },
    schedule: {
        preferredDays: [{
                type: String,
                trim: true,
            }],
        preferredTimeSlots: [{
                type: String,
                trim: true,
            }],
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'bi-weekly', 'monthly'],
            required: true,
        },
        startDate: {
            type: Date,
        },
        endDate: {
            type: Date,
        },
    },
    preferences: {
        mode: {
            type: String,
            enum: ['online', 'offline', 'both'],
            required: true,
            default: 'both',
        },
        genderPreference: {
            type: String,
            enum: ['male', 'female', 'any'],
        },
        tutorQualification: [{
                type: String,
                trim: true,
            }],
        minExperience: {
            type: Number,
            required: true,
            min: 0,
            max: 50,
            default: 0,
        },
        budget: {
            minHourlyRate: {
                type: Number,
                required: true,
                min: 50,
                max: 5000,
            },
            maxHourlyRate: {
                type: Number,
                required: true,
                min: 50,
                max: 5000,
            },
            negotiationAllowed: {
                type: Boolean,
                default: true,
            },
        },
        trialClassRequired: {
            type: Boolean,
            default: false,
        },
        groupClassAllowed: {
            type: Boolean,
            default: false,
        },
        maxGroupSize: {
            type: Number,
            default: 1,
            min: 1,
            max: 10,
        },
    },
    urgency: {
        level: {
            type: String,
            enum: ['immediate', 'within_week', 'within_month', 'flexible'],
            required: true,
            default: 'flexible',
        },
        reason: {
            type: String,
            trim: true,
        },
    },
    status: {
        type: String,
        enum: ['active', 'closed', 'paused', 'fulfilled'],
        required: true,
        default: 'active',
    },
    matches: [{
            tutorId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'Tutor',
                required: true,
            },
            matchScore: {
                type: Number,
                required: true,
                min: 0,
                max: 100,
            },
            contactedAt: {
                type: Date,
            },
            responseStatus: {
                type: String,
                enum: ['pending', 'interested', 'not_interested', 'hired'],
                default: 'pending',
            },
            contactedBy: {
                type: String,
                enum: ['parent', 'tutor', 'admin'],
                required: true,
            },
        }],
    visibility: {
        isPublic: {
            type: Boolean,
            default: true,
        },
        expiresAt: {
            type: Date,
        },
        maxContacts: {
            type: Number,
            default: 10,
            min: 1,
            max: 50,
        },
        currentContacts: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
}, {
    timestamps: true,
});
requirementSchema.index({ parentId: 1 });
requirementSchema.index({ 'location.city': 1 });
requirementSchema.index({ 'location.coordinates': '2dsphere' });
requirementSchema.index({ 'subjectRequirements.subject': 1 });
requirementSchema.index({ 'preferences.mode': 1 });
requirementSchema.index({ 'urgency.level': 1 });
requirementSchema.index({ status: 1 });
requirementSchema.index({ 'visibility.isPublic': 1 });
requirementSchema.index({ createdAt: -1 });
exports.Requirement = mongoose_1.default.model('Requirement', requirementSchema);
//# sourceMappingURL=Requirement.js.map