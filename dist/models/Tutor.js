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
exports.Tutor = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const tutorSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    personalInfo: {
        qualification: {
            type: String,
            required: true,
            trim: true,
        },
        experience: {
            type: Number,
            required: true,
            min: 0,
            max: 50,
        },
        subjects: [{
                type: String,
                required: true,
                trim: true,
            }],
        classes: [{
                type: String,
                required: true,
                trim: true,
            }],
        boards: [{
                type: String,
                required: true,
                trim: true,
            }],
        languages: [{
                type: String,
                required: true,
                trim: true,
            }],
        about: {
            type: String,
            required: true,
            maxlength: 1000,
            trim: true,
        },
    },
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
        teachingRadius: {
            type: Number,
            required: true,
            min: 1,
            max: 50,
            default: 5,
        },
    },
    availability: {
        preferredTimeSlots: [{
                type: String,
                trim: true,
            }],
        preferredDays: [{
                type: String,
                trim: true,
            }],
        isAvailableForOnline: {
            type: Boolean,
            default: true,
        },
        isAvailableForOffline: {
            type: Boolean,
            default: true,
        },
    },
    pricing: {
        hourlyRate: {
            type: Number,
            required: true,
            min: 50,
            max: 5000,
        },
        monthlyRate: {
            type: Number,
            min: 500,
            max: 50000,
        },
        negotiationAllowed: {
            type: Boolean,
            default: false,
        },
    },
    verification: {
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationDocuments: [{
                type: String,
            }],
        verificationDate: {
            type: Date,
        },
        verifiedBy: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    stats: {
        totalStudents: {
            type: Number,
            default: 0,
            min: 0,
        },
        activeStudents: {
            type: Number,
            default: 0,
            min: 0,
        },
        completedClasses: {
            type: Number,
            default: 0,
            min: 0,
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        totalReviews: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    preferences: {
        minimumClassDuration: {
            type: Number,
            default: 1,
            min: 0.5,
            max: 4,
        },
        maximumStudentsPerBatch: {
            type: Number,
            default: 1,
            min: 1,
            max: 10,
        },
        trialClassAvailable: {
            type: Boolean,
            default: false,
        },
        trialClassDuration: {
            type: Number,
            default: 30,
            min: 15,
            max: 60,
        },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isProfilePublic: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
tutorSchema.index({ userId: 1 });
tutorSchema.index({ 'location.city': 1 });
tutorSchema.index({ 'location.coordinates': '2dsphere' });
tutorSchema.index({ 'personalInfo.subjects': 1 });
tutorSchema.index({ 'personalInfo.classes': 1 });
tutorSchema.index({ 'pricing.hourlyRate': 1 });
tutorSchema.index({ 'stats.averageRating': -1 });
tutorSchema.index({ isActive: 1 });
tutorSchema.index({ isProfilePublic: 1 });
tutorSchema.index({ 'verification.isVerified': 1 });
exports.Tutor = mongoose_1.default.model('Tutor', tutorSchema);
//# sourceMappingURL=Tutor.js.map