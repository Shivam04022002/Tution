import mongoose, { Schema, Document } from 'mongoose';

// Parent Requirement Interface
export interface IParentRequirement extends Document {
  parentId: mongoose.Types.ObjectId;
  requirementId: string;
  studentDetails: {
    studentName: string;
    age: number;
    grade: string;
    board: string;
    schoolName: string;
    genderPreference: 'any' | 'male' | 'female';
    multipleChildren: boolean;
    children?: Array<{
      name: string;
      age: number;
      grade: string;
      board: string;
      schoolName: string;
    }>;
  };
  subjects: string[];
  languagePreference: string[];
  tuitionType: 'home' | 'online' | 'group' | 'crash';
  location: {
    address: string;
    city: string;
    pincode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    teachingRadius: number;
  };
  schedule: {
    daysPerWeek: string;
    preferredTimings: string[];
    startDate: string;
  };
  tutorPreferences?: string;
  budget: {
    minAmount: number;
    maxAmount: number;
    negotiationAllowed: boolean;
  };
  status: 'draft' | 'published' | 'receiving_applications' | 'shortlisted' | 'demo_scheduled' | 'teacher_selected' | 'hired' | 'closed' | 'cancelled' | 'expired' | 'paused';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  matchedTutors: Array<{
    tutorId: mongoose.Types.ObjectId;
    matchScore: number;
    matchDate: Date;
    status: 'recommended' | 'viewed' | 'contacted' | 'rejected' | 'expired';
    contactedDate?: Date;
    expiryDate: Date;
  }>;
  totalMatches: number;
  views: number;
  unlocks: number;
  
  // Hiring workflow fields
  applicationsCount: number;
  shortlistedCount: number;
  demosScheduledCount: number;
  demosCompletedCount: number;
  hiredTeacherId?: mongoose.Types.ObjectId;
  hiredTeacherProfileId?: mongoose.Types.ObjectId;
  hiredAt?: Date;
  hireReason?: string;
  closedReason?: string;
  closedAt?: Date;
  
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  addTutorMatch(tutorId: mongoose.Types.ObjectId, matchScore: number): Promise<IParentRequirement>;
  updateTutorMatchStatus(tutorId: mongoose.Types.ObjectId, status: string): Promise<IParentRequirement>;
  incrementViews(): Promise<IParentRequirement>;
  incrementUnlocks(): Promise<IParentRequirement>;
  extendExpiry(days?: number): Promise<IParentRequirement>;
  closeRequirement(reason?: string): Promise<IParentRequirement>;
  getTopMatches(limit?: number): any[];
}

// Parent Requirement Schema
const ParentRequirementSchema: Schema = new Schema({
  parentId: {
    type: Schema.Types.ObjectId,
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
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  hiredTeacherProfileId: {
    type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better performance
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

// Virtuals
ParentRequirementSchema.virtual('isExpired').get(function(this: IParentRequirement) {
  return new Date() > (this.expiresAt || new Date());
});

ParentRequirementSchema.virtual('daysUntilExpiry').get(function(this: IParentRequirement) {
  const now = new Date();
  const diffTime = (this.expiresAt?.getTime() || 0) - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

ParentRequirementSchema.virtual('activeMatches').get(function(this: IParentRequirement) {
  return (this.matchedTutors || []).filter((match: any) => 
    match.status !== 'rejected' && match.status !== 'expired' && new Date() <= match.expiryDate
  );
});

ParentRequirementSchema.virtual('contactedMatches').get(function(this: IParentRequirement) {
  return (this.matchedTutors || []).filter((match: any) => match.status === 'contacted');
});

// Pre-save middleware
ParentRequirementSchema.pre('save', function(this: IParentRequirement) {
  // Update totalMatches count
  this.totalMatches = (this.matchedTutors || []).length;
  
  // Auto-update status based on hiring progress
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
  
  // Check if requirement is expired
  if (new Date() > (this.expiresAt || new Date()) && !['hired', 'closed', 'cancelled'].includes(this.status)) {
    this.status = 'expired';
    this.isActive = false;
  }
});

// Static methods
ParentRequirementSchema.statics.findActiveByLocation = function(latitude: number, longitude: number, maxDistance: number = 10000) {
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

ParentRequirementSchema.statics.findBySubjects = function(subjects: string[]) {
  return this.find({
    subjects: { $in: subjects },
    status: 'active',
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

ParentRequirementSchema.statics.findByBudget = function(minBudget: number, maxBudget: number) {
  return this.find({
    'budget.minAmount': { $lte: maxBudget },
    'budget.maxAmount': { $gte: minBudget },
    status: 'active',
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

ParentRequirementSchema.statics.findExpiringSoon = function(days: number = 7) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  return this.find({
    expiresAt: { $lte: expiryDate, $gt: new Date() },
    status: 'active',
    isActive: true,
  });
};

ParentRequirementSchema.statics.generateRequirementId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `REQ-${timestamp}-${random}`.toUpperCase();
};

// Instance methods
ParentRequirementSchema.methods.addTutorMatch = function(this: IParentRequirement, tutorId: mongoose.Types.ObjectId, matchScore: number) {
  // Check if tutor is already matched
  const existingMatch = this.matchedTutors?.find((match: any) => match.tutorId?.toString() === tutorId.toString());
  
  if (existingMatch) {
    existingMatch.matchScore = matchScore;
    existingMatch.matchDate = new Date();
  } else {
    this.matchedTutors?.push({
      tutorId,
      matchScore,
      matchDate: new Date(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'recommended',
    } as any);
  }
  
  return this.save();
};

ParentRequirementSchema.methods.updateTutorMatchStatus = function(this: IParentRequirement, tutorId: mongoose.Types.ObjectId, status: string) {
  const match = this.matchedTutors?.find((match: any) => match.tutorId?.toString() === tutorId.toString());
  
  if (match) {
    (match as any).status = status;
    if (status === 'contacted') {
      match.contactedDate = new Date();
    }
    return this.save();
  }
  
  return Promise.resolve(this);
};

ParentRequirementSchema.methods.incrementViews = function(this: IParentRequirement) {
  this.views = (this.views || 0) + 1;
  return this.save();
};

ParentRequirementSchema.methods.incrementUnlocks = function(this: IParentRequirement) {
  this.unlocks = (this.unlocks || 0) + 1;
  return this.save();
};

ParentRequirementSchema.methods.extendExpiry = function(this: IParentRequirement, days: number = 7) {
  const newExpiryDate = new Date(this.expiresAt || Date.now());
  newExpiryDate.setDate(newExpiryDate.getDate() + days);
  this.expiresAt = newExpiryDate;
  this.status = 'published';
  this.isActive = true;
  return this.save();
};

ParentRequirementSchema.methods.closeRequirement = function(this: IParentRequirement, reason?: string) {
  this.status = 'closed';
  this.isActive = false;
  // Close all active matches
  this.matchedTutors?.forEach((match: any) => {
    if (match.status === 'recommended' || match.status === 'viewed') {
      match.status = 'expired';
    }
  });
  return this.save();
};

ParentRequirementSchema.methods.getTopMatches = function(this: IParentRequirement, limit: number = 5) {
  return (this.matchedTutors || [])
    .filter((match: any) => match.status !== 'rejected' && match.status !== 'expired' && new Date() <= match.expiryDate)
    .sort((a: any, b: any) => b.matchScore - a.matchScore)
    .slice(0, limit);
};

export const ParentRequirement = mongoose.model<IParentRequirement>('ParentRequirement', ParentRequirementSchema);
