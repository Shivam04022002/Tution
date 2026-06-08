import mongoose, { Schema, Document } from 'mongoose';

// Tutor Match Interface
export interface ITutorMatch extends Document {
  requirementId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherProfileId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId;
  matchId: string;
  overallScore: number;
  breakdown: {
    subjectScore: number;
    subjectMatchDetails: {
      requirementSubjects: string[];
      teacherSubjects: string[];
      matchedSubjects: string[];
      matchPercentage: number;
    };
    classScore: number;
    classMatchDetails: {
      requirementGrade: string;
      teacherClasses: string[];
      isMatch: boolean;
    };
    boardScore: number;
    boardMatchDetails: {
      requirementBoard: string;
      teacherBoards: string[];
      isMatch: boolean;
    };
    locationScore: number;
    locationMatchDetails: {
      requirementCity: string;
      teacherCity: string;
      requirementPincode: string;
      teacherPincode: string;
      distance: number;
      teachingRadius: number;
      isWithinRadius: boolean;
    };
    budgetScore: number;
    budgetMatchDetails: {
      requirementMinBudget: number;
      requirementMaxBudget: number;
      teacherHourlyRate: number;
      isWithinBudget: boolean;
    };
    modeScore: number;
    modeMatchDetails: {
      requirementMode: string;
      teacherModes: string[];
      isMatch: boolean;
    };
    timingScore: number;
    timingMatchDetails: {
      requirementTimeSlots: string[];
      teacherDays: string[];
      teacherTimeSlots: string[];
      timeOverlap: string[];
      timeScore: number;
    };
    bonusDetails: {
      genderScore: number;
      languageScore: number;
      experienceScore: number;
      totalBonus: number;
    };
  };
  algorithmVersion: string;
  status: 'recommended' | 'viewed' | 'applied' | 'shortlisted' | 'rejected' | 'hired' | 'expired';
  viewedAt?: Date;
  appliedAt?: Date;
  shortlistedAt?: Date;
  rejectedAt?: Date;
  hiredAt?: Date;
  expiryDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tutor Match Schema
const TutorMatchSchema: Schema = new Schema({
  requirementId: {
    type: Schema.Types.ObjectId,
    ref: 'ParentRequirement',
    required: true,
    index: true,
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  teacherProfileId: {
    type: Schema.Types.ObjectId,
    ref: 'TeacherProfile',
    required: true,
  },
  parentId: {
    type: Schema.Types.ObjectId,
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

// Compound indexes for efficient queries
TutorMatchSchema.index({ requirementId: 1, overallScore: -1, status: 1 });
TutorMatchSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
TutorMatchSchema.index({ parentId: 1, status: 1, createdAt: -1 });
TutorMatchSchema.index({ expiryDate: 1, status: 1 });
TutorMatchSchema.index({ requirementId: 1, teacherId: 1 }, { unique: true });
TutorMatchSchema.index({ isActive: 1, expiryDate: 1 });
TutorMatchSchema.index({ algorithmVersion: 1 });

// Generate unique match ID before validation
TutorMatchSchema.pre('validate', function() {
  if (!this.matchId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.matchId = `MATCH-${timestamp}-${random}`;
  }
});

export const TutorMatch = mongoose.model<ITutorMatch>('TutorMatch', TutorMatchSchema);
export default TutorMatch;
