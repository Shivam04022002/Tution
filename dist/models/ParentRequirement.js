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
exports.ParentRequirement = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ParentRequirementSchema = new mongoose_1.Schema({
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    requirementId: {
        type: String,
        required: true,
        unique: true,
    },
    studentDetails: {
        studentName: {
            type: String,
            required: true,
            trim: true,
        },
        age: {
            type: Number,
            required: true,
            min: 3,
            max: 25,
        },
        grade: {
            type: String,
            required: true,
        },
        board: {
            type: String,
            required: true,
        },
        schoolName: {
            type: String,
            required: true,
            trim: true,
        },
        genderPreference: {
            type: String,
            enum: ['any', 'male', 'female'],
            default: 'any',
        },
        multipleChildren: {
            type: Boolean,
            default: false,
        },
        children: [{
                name: {
                    type: String,
                    required: true,
                },
                age: {
                    type: Number,
                    required: true,
                    min: 3,
                    max: 25,
                },
                grade: {
                    type: String,
                    required: true,
                },
                board: {
                    type: String,
                    required: true,
                },
                schoolName: {
                    type: String,
                    required: true,
                    trim: true,
                },
            }],
    },
    subjects: [{
            type: String,
            required: true,
        }],
    languagePreference: [{
            type: String,
            required: true,
        }],
    tuitionType: {
        type: String,
        enum: ['home', 'online', 'group', 'crash'],
        required: true,
    },
    location: {
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
        teachingRadius: {
            type: Number,
            required: true,
            min: 1,
            max: 50,
        },
    },
    schedule: {
        daysPerWeek: {
            type: String,
            required: true,
        },
        preferredTimings: [{
                type: String,
                required: true,
            }],
        startDate: {
            type: String,
            required: true,
        },
    },
    tutorPreferences: {
        type: String,
        default: '',
    },
    budget: {
        minAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        maxAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        negotiationAllowed: {
            type: Boolean,
            default: true,
        },
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'receiving_applications', 'shortlisted', 'demo_scheduled', 'teacher_selected', 'hired', 'closed', 'cancelled', 'expired', 'paused'],
        default: 'published',
    },
    applicationsCount: {
        type: Number,
        default: 0,
    },
    shortlistedCount: {
        type: Number,
        default: 0,
    },
    demosScheduledCount: {
        type: Number,
        default: 0,
    },
    demosCompletedCount: {
        type: Number,
        default: 0,
    },
    hiredTeacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    hiredTeacherProfileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TeacherProfile',
    },
    hiredAt: {
        type: Date,
    },
    hireReason: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    closedReason: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    closedAt: {
        type: Date,
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
    },
    matchedTutors: [{
            tutorId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'TeacherProfile',
                required: true,
            },
            matchScore: {
                type: Number,
                required: true,
                min: 0,
                max: 100,
            },
            matchDate: {
                type: Date,
                default: Date.now,
            },
            status: {
                type: String,
                enum: ['recommended', 'viewed', 'contacted', 'rejected', 'expired'],
                default: 'recommended',
            },
            contactedDate: {
                type: Date,
            },
            expiryDate: {
                type: Date,
                required: true,
            },
        }],
    totalMatches: {
        type: Number,
        default: 0,
        min: 0,
    },
    views: {
        type: Number,
        default: 0,
        min: 0,
    },
    unlocks: {
        type: Number,
        default: 0,
        min: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
ParentRequirementSchema.index({ parentId: 1 });
ParentRequirementSchema.index({ requirementId: 1 });
ParentRequirementSchema.index({ status: 1 });
ParentRequirementSchema.index({ priority: 1 });
ParentRequirementSchema.index({ 'location.city': 1 });
ParentRequirementSchema.index({ 'location.coordinates': '2dsphere' });
ParentRequirementSchema.index({ subjects: 1 });
ParentRequirementSchema.index({ 'studentDetails.grade': 1 });
ParentRequirementSchema.index({ 'budget.maxAmount': 1 });
ParentRequirementSchema.index({ expiresAt: 1 });
ParentRequirementSchema.index({ createdAt: -1 });
ParentRequirementSchema.index({ 'matchedTutors.tutorId': 1 });
ParentRequirementSchema.index({ 'matchedTutors.status': 1 });
ParentRequirementSchema.index({ isActive: 1, status: 1, expiresAt: 1 });
ParentRequirementSchema.index({ tuitionType: 1 });
ParentRequirementSchema.virtual('isExpired').get(function () {
    return new Date() > (this.expiresAt || new Date());
});
ParentRequirementSchema.virtual('daysUntilExpiry').get(function () {
    const now = new Date();
    const diffTime = (this.expiresAt?.getTime() || 0) - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});
ParentRequirementSchema.virtual('activeMatches').get(function () {
    return (this.matchedTutors || []).filter((match) => match.status !== 'rejected' && match.status !== 'expired' && new Date() <= match.expiryDate);
});
ParentRequirementSchema.virtual('contactedMatches').get(function () {
    return (this.matchedTutors || []).filter((match) => match.status === 'contacted');
});
ParentRequirementSchema.pre('save', function () {
    this.totalMatches = (this.matchedTutors || []).length;
    if (this.status === 'published' && this.applicationsCount > 0) {
        this.status = 'receiving_applications';
    }
    if (this.status === 'receiving_applications' && this.shortlistedCount > 0) {
        this.status = 'shortlisted';
    }
    if (this.status === 'shortlisted' && this.demosScheduledCount > 0) {
        this.status = 'demo_scheduled';
    }
    if (this.status === 'demo_scheduled' && this.demosCompletedCount > 0 && this.hiredTeacherId) {
        this.status = 'teacher_selected';
    }
    if (this.status === 'teacher_selected' && this.hiredAt) {
        this.status = 'hired';
    }
    if (new Date() > (this.expiresAt || new Date()) && !['hired', 'closed', 'cancelled'].includes(this.status)) {
        this.status = 'expired';
        this.isActive = false;
    }
});
ParentRequirementSchema.statics.findActiveByLocation = function (latitude, longitude, maxDistance = 10000) {
    return this.find({
        'location.coordinates': {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                $maxDistance: maxDistance,
            },
        },
        status: 'active',
        isActive: true,
        expiresAt: { $gt: new Date() },
    });
};
ParentRequirementSchema.statics.findBySubjects = function (subjects) {
    return this.find({
        subjects: { $in: subjects },
        status: 'active',
        isActive: true,
        expiresAt: { $gt: new Date() },
    });
};
ParentRequirementSchema.statics.findByBudget = function (minBudget, maxBudget) {
    return this.find({
        'budget.minAmount': { $lte: maxBudget },
        'budget.maxAmount': { $gte: minBudget },
        status: 'active',
        isActive: true,
        expiresAt: { $gt: new Date() },
    });
};
ParentRequirementSchema.statics.findExpiringSoon = function (days = 7) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return this.find({
        expiresAt: { $lte: expiryDate, $gt: new Date() },
        status: 'active',
        isActive: true,
    });
};
ParentRequirementSchema.statics.generateRequirementId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `REQ-${timestamp}-${random}`.toUpperCase();
};
ParentRequirementSchema.methods.addTutorMatch = function (tutorId, matchScore) {
    const existingMatch = this.matchedTutors?.find((match) => match.tutorId?.toString() === tutorId.toString());
    if (existingMatch) {
        existingMatch.matchScore = matchScore;
        existingMatch.matchDate = new Date();
    }
    else {
        this.matchedTutors?.push({
            tutorId,
            matchScore,
            matchDate: new Date(),
            expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'recommended',
        });
    }
    return this.save();
};
ParentRequirementSchema.methods.updateTutorMatchStatus = function (tutorId, status) {
    const match = this.matchedTutors?.find((match) => match.tutorId?.toString() === tutorId.toString());
    if (match) {
        match.status = status;
        if (status === 'contacted') {
            match.contactedDate = new Date();
        }
        return this.save();
    }
    return Promise.resolve(this);
};
ParentRequirementSchema.methods.incrementViews = function () {
    this.views = (this.views || 0) + 1;
    return this.save();
};
ParentRequirementSchema.methods.incrementUnlocks = function () {
    this.unlocks = (this.unlocks || 0) + 1;
    return this.save();
};
ParentRequirementSchema.methods.extendExpiry = function (days = 7) {
    const newExpiryDate = new Date(this.expiresAt || Date.now());
    newExpiryDate.setDate(newExpiryDate.getDate() + days);
    this.expiresAt = newExpiryDate;
    this.status = 'published';
    this.isActive = true;
    return this.save();
};
ParentRequirementSchema.methods.closeRequirement = function (reason) {
    this.status = 'closed';
    this.isActive = false;
    this.matchedTutors?.forEach((match) => {
        if (match.status === 'recommended' || match.status === 'viewed') {
            match.status = 'expired';
        }
    });
    return this.save();
};
ParentRequirementSchema.methods.getTopMatches = function (limit = 5) {
    return (this.matchedTutors || [])
        .filter((match) => match.status !== 'rejected' && match.status !== 'expired' && new Date() <= match.expiryDate)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);
};
exports.ParentRequirement = mongoose_1.default.model('ParentRequirement', ParentRequirementSchema);
//# sourceMappingURL=ParentRequirement.js.map