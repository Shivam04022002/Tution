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
exports.TeacherProfile = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TeacherProfileSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    basicDetails: {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other'],
            required: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
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
        languages: [{
                type: String,
                required: true,
            }],
        profilePhoto: {
            type: String,
            default: '',
        },
    },
    education: {
        highestQualification: {
            type: String,
            required: true,
        },
        degree: {
            type: String,
            required: true,
        },
        university: {
            type: String,
            required: true,
        },
        yearOfCompletion: {
            type: Number,
            required: true,
            min: 1950,
            max: new Date().getFullYear(),
        },
        certifications: [{
                name: {
                    type: String,
                    required: true,
                },
                issuer: {
                    type: String,
                    required: true,
                },
                year: {
                    type: Number,
                    required: true,
                },
                certificateUrl: {
                    type: String,
                },
            }],
        status: {
            type: String,
            enum: ['completed', 'pursuing'],
            default: 'completed',
        },
    },
    teachingDetails: {
        subjects: [{
                type: String,
                required: true,
            }],
        classes: [{
                type: String,
                required: true,
            }],
        boards: [{
                type: String,
                required: true,
            }],
        specialization: {
            type: String,
            required: true,
        },
        teachingModes: [{
                type: String,
                enum: ['online', 'student_home', 'own_home', 'group'],
                required: true,
            }],
        groupTuitionOption: {
            type: Boolean,
            default: false,
        },
        groupSize: {
            type: Number,
            min: 2,
            max: 20,
            default: 5,
        },
        groupRate: {
            type: Number,
            min: 0,
        },
        subjectExperience: [{
                subject: { type: String, required: true, trim: true },
                yearsExperience: { type: Number, required: true, min: 0, max: 50 },
            }],
        studentTypes: [{
                type: String,
                enum: ['school_students', 'college_students', 'competitive_exams', 'working_professionals'],
            }],
        teachingLevel: [{
                type: String,
                enum: ['beginner', 'intermediate', 'advanced'],
            }],
        examPreparation: [{
                type: String,
                enum: ['JEE', 'NEET', 'CUET', 'UPSC', 'SSC', 'Banking', 'State Exams'],
            }],
    },
    locationAvailability: {
        address: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            required: true,
        },
        pincode: {
            type: String,
            required: true,
            match: /^[0-9]{6}$/,
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
        preferredAreas: [{
                type: String,
            }],
        preferredLocations: [{
                area: {
                    type: String,
                    required: true,
                    trim: true,
                },
                city: {
                    type: String,
                    required: true,
                    trim: true,
                },
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
                radiusKm: {
                    type: Number,
                    required: true,
                    min: 1,
                    max: 50,
                    default: 5,
                },
            }],
        teachingRadius: {
            type: Number,
            required: true,
            min: 1,
            max: 50,
            default: 5,
        },
        availableDays: [{
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                required: true,
            }],
        availableTimeSlots: [{
                type: String,
                required: true,
            }],
        customTimeSlots: [{
                id: { type: String, required: true },
                startTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
                endTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
                label: { type: String, required: true, trim: true },
                isActive: { type: Boolean, default: true },
            }],
        weeklySchedule: {
            type: Map,
            of: {
                isEnabled: { type: Boolean, default: false },
                timeSlots: [{ type: String }],
            },
            default: {},
        },
        maxStudents: {
            active: {
                type: Number,
                default: 10,
                min: 1,
                max: 100,
            },
            daily: {
                type: Number,
                default: 5,
                min: 1,
                max: 20,
            },
        },
        vacationMode: {
            type: Boolean,
            default: false,
        },
    },
    discoverability: {
        availableForNewStudents: {
            type: Boolean,
            default: true,
        },
        visibleInMarketplace: {
            type: Boolean,
            default: true,
        },
        onlineStatus: {
            type: String,
            enum: ['online', 'offline', 'hybrid'],
            default: 'hybrid',
        },
        travelSettings: {
            maxTravelDistance: {
                type: Number,
                default: 10,
                min: 1,
                max: 50,
            },
            preferredTravelModes: [{
                    type: String,
                    enum: ['walking', 'cycling', 'public_transport', 'car', 'bike'],
                }],
        },
        locationCoverage: {
            state: {
                type: String,
                required: true,
            },
            city: {
                type: String,
                required: true,
            },
            areas: [{
                    type: String,
                }],
            pincodes: [{
                    type: String,
                    match: /^[0-9]{6}$/,
                }],
        },
    },
    bio: {
        type: String,
        default: '',
    },
    pricingRevenue: {
        hourlyRate: {
            type: Number,
            required: true,
            min: 50,
        },
        monthlyRate: {
            type: Number,
            required: true,
            min: 1000,
        },
        currentRevenue: {
            type: String,
            enum: ['0', '10000', '25000', '50000', '100000', '100000+'],
            default: '0',
        },
        experienceYears: {
            type: Number,
            required: true,
            min: 0,
            max: 50,
        },
        pricingStrategy: {
            type: String,
            enum: ['competitive', 'premium', 'flexible', 'value_based'],
            default: 'competitive',
        },
        negotiationAllowed: {
            type: Boolean,
            default: true,
        },
    },
    verificationDocuments: {
        aadhaarCard: {
            type: String,
            required: true,
        },
        panCard: {
            type: String,
            required: true,
        },
        qualificationDocuments: [{
                type: String,
            }],
        introVideo: {
            type: String,
        },
        portfolioPhotos: [{
                type: String,
            }],
    },
    documents: [{
            type: {
                type: String,
                enum: ['profile_photo', 'government_id', 'aadhaar', 'pan', 'driving_license', 'passport', 'degree_certificate', 'teaching_certificate', 'experience_certificate'],
                required: true,
            },
            name: {
                type: String,
                required: true,
            },
            url: {
                type: String,
                required: true,
            },
            publicId: {
                type: String,
                required: true,
            },
            status: {
                type: String,
                enum: ['draft', 'pending', 'verified', 'rejected'],
                default: 'draft',
            },
            uploadedAt: {
                type: Date,
                default: Date.now,
            },
            verifiedAt: {
                type: Date,
            },
            rejectionReason: {
                type: String,
            },
            fileType: {
                type: String,
                enum: ['jpg', 'png', 'pdf'],
                required: true,
            },
            fileSize: {
                type: Number,
                required: true,
            },
        }],
    verificationStatus: {
        type: String,
        enum: ['draft', 'pending', 'verified', 'rejected'],
        default: 'draft',
    },
    verificationDate: {
        type: Date,
    },
    rejectionReason: {
        type: String,
    },
    verificationNotes: {
        type: String,
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
        ratingBreakdown: {
            type: Map,
            of: Number,
            default: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        },
        totalEarnings: {
            type: Number,
            default: 0,
            min: 0,
        },
        leadUnlocks: {
            type: Number,
            default: 0,
            min: 0,
        },
        responseRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        responseTime: {
            type: String,
            default: '30 min',
        },
    },
    preferences: {
        notifications: {
            type: Boolean,
            default: true,
        },
        whatsappUpdates: {
            type: Boolean,
            default: true,
        },
        emailUpdates: {
            type: Boolean,
            default: true,
        },
        leadAlerts: {
            type: Boolean,
            default: true,
        },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    blockReason: {
        type: String,
    },
    isProfileComplete: {
        type: Boolean,
        default: false,
    },
    profileCompletionPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    subscription: {
        currentPlan: {
            type: String,
            enum: ['free', 'starter', 'professional', 'premium'],
            default: 'free',
        },
        subscriptionStatus: {
            type: String,
            enum: ['active', 'cancelled', 'expired', 'none'],
            default: 'none',
        },
        subscriptionStartDate: {
            type: Date,
        },
        subscriptionEndDate: {
            type: Date,
        },
        autoRenew: {
            type: Boolean,
            default: false,
        },
    },
    savedRequirements: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'ParentRequirement',
        }],
    hiddenRequirements: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'ParentRequirement',
        }],
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
    referralCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalRewardsEarned: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
TeacherProfileSchema.index({ userId: 1 });
TeacherProfileSchema.index({ 'locationAvailability.city': 1 });
TeacherProfileSchema.index({ 'locationAvailability.coordinates': '2dsphere' });
TeacherProfileSchema.index({ 'teachingDetails.subjects': 1 });
TeacherProfileSchema.index({ 'teachingDetails.classes': 1 });
TeacherProfileSchema.index({ verificationStatus: 1 });
TeacherProfileSchema.index({ isActive: 1, isVerified: 1, isBlocked: 1 });
TeacherProfileSchema.index({ 'stats.averageRating': -1 });
TeacherProfileSchema.index({ 'pricingRevenue.hourlyRate': 1 });
TeacherProfileSchema.index({ 'locationAvailability.vacationMode': 1 });
TeacherProfileSchema.index({ 'teachingDetails.teachingModes': 1 });
TeacherProfileSchema.index({ 'teachingDetails.boards': 1 });
TeacherProfileSchema.virtual('profileCompletion').get(function () {
    const fields = [
        this.basicDetails?.fullName,
        this.basicDetails?.mobileNumber,
        this.basicDetails?.email,
        this.education?.highestQualification,
        this.education?.degree,
        this.teachingDetails?.subjects?.length > 0,
        this.teachingDetails?.classes?.length > 0,
        this.locationAvailability?.address,
        this.pricingRevenue?.hourlyRate,
        this.verificationDocuments?.aadhaarCard,
        this.verificationDocuments?.panCard,
    ];
    const completedFields = fields.filter(field => field).length;
    return Math.round((completedFields / fields.length) * 100);
});
TeacherProfileSchema.pre('save', function () {
    if (this.isModified('verificationStatus') && this.verificationStatus === 'verified') {
        this.verificationDate = new Date();
        this.isVerified = true;
    }
});
TeacherProfileSchema.statics.findNearbyTutors = function (latitude, longitude, maxDistance = 10000) {
    return this.find({
        'locationAvailability.coordinates': {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                $maxDistance: maxDistance,
            },
        },
        isActive: true,
        isVerified: true,
        isBlocked: false,
    });
};
TeacherProfileSchema.statics.findBySubjects = function (subjects) {
    return this.find({
        'teachingDetails.subjects': { $in: subjects },
        isActive: true,
        isVerified: true,
        isBlocked: false,
    });
};
TeacherProfileSchema.statics.findByLocation = function (city) {
    return this.find({
        'locationAvailability.city': city,
        isActive: true,
        isVerified: true,
        isBlocked: false,
    });
};
TeacherProfileSchema.methods.updateStats = async function (statsUpdate) {
    Object.assign(this.stats, statsUpdate);
    return this.save();
};
TeacherProfileSchema.methods.toggleVacationMode = function () {
    this.locationAvailability.vacationMode = !this.locationAvailability.vacationMode;
    return this.save();
};
TeacherProfileSchema.methods.canAcceptLead = function () {
    return this.isActive && this.isVerified && !this.isBlocked && !this.locationAvailability.vacationMode;
};
exports.TeacherProfile = mongoose_1.default.model('TeacherProfile', TeacherProfileSchema);
//# sourceMappingURL=TeacherProfile.js.map