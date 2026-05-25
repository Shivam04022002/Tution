import mongoose, { Document, Schema } from 'mongoose';

export interface IRequirement extends Document {
  parentId: mongoose.Types.ObjectId;
  studentInfo: {
    name: string;
    grade: string;
    board: string;
    school?: string;
    currentPerformance?: string;
    learningGoals: string[];
  };
  subjectRequirements: [{
    subject: string;
    currentLevel: string;
    targetLevel: string;
    priority: 'high' | 'medium' | 'low';
  }];
  location: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    preferredRadius: number; // in kilometers
  };
  schedule: {
    preferredDays: string[];
    preferredTimeSlots: string[];
    frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly';
    startDate?: Date;
    endDate?: Date;
  };
  preferences: {
    mode: 'online' | 'offline' | 'both';
    genderPreference?: 'male' | 'female' | 'any';
    tutorQualification: string[];
    minExperience: number; // in years
    budget: {
      minHourlyRate: number;
      maxHourlyRate: number;
      negotiationAllowed: boolean;
    };
    trialClassRequired: boolean;
    groupClassAllowed: boolean;
    maxGroupSize: number;
  };
  urgency: {
    level: 'immediate' | 'within_week' | 'within_month' | 'flexible';
    reason?: string;
  };
  status: 'active' | 'closed' | 'paused' | 'fulfilled';
  matches: [{
    tutorId: mongoose.Types.ObjectId;
    matchScore: number;
    contactedAt?: Date;
    responseStatus: 'pending' | 'interested' | 'not_interested' | 'hired';
    contactedBy: 'parent' | 'tutor' | 'admin';
  }];
  visibility: {
    isPublic: boolean;
    expiresAt?: Date;
    maxContacts: number;
    currentContacts: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const requirementSchema = new Schema<IRequirement>({
  parentId: {
    type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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

// Indexes for better performance
requirementSchema.index({ parentId: 1 });
requirementSchema.index({ 'location.city': 1 });
requirementSchema.index({ 'location.coordinates': '2dsphere' });
requirementSchema.index({ 'subjectRequirements.subject': 1 });
requirementSchema.index({ 'preferences.mode': 1 });
requirementSchema.index({ 'urgency.level': 1 });
requirementSchema.index({ status: 1 });
requirementSchema.index({ 'visibility.isPublic': 1 });
requirementSchema.index({ createdAt: -1 });

export const Requirement = mongoose.model<IRequirement>('Requirement', requirementSchema);
