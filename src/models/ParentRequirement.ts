import mongoose, { Schema, Document } from 'mongoose';

// Parent Requirement Interface
export interface IParentRequirement extends Document {
  parentId: mongoose.Types.ObjectId;
  requirementId: string;
  studentDetails: {
    studentName: string;
    grade: string;
    board: string;
    genderPreference: 'any' | 'male' | 'female';
    multipleChildren: boolean;
    children?: Array<{
      name: string;
      grade: string;
      board: string;
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
  budget: {
    minAmount: number;
    maxAmount: number;
    negotiationAllowed: boolean;
  };
  status: 'active' | 'closed' | 'expired' | 'paused';
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
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
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
    grade: {
      type: String,
      required: true,
    },
    board: {
      type: String,
      required: true,
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
      grade: {
        type: String,
        required: true,
      },
      board: {
        type: String,
        required: true,
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
    enum: ['active', 'closed', 'expired', 'paused'],
    default: 'active',
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

// Virtuals
ParentRequirementSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

ParentRequirementSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

ParentRequirementSchema.virtual('activeMatches').get(function() {
  return this.matchedTutors.filter(match => 
    match.status !== 'rejected' && match.status !== 'expired' && new Date() <= match.expiryDate
  );
});

ParentRequirementSchema.virtual('contactedMatches').get(function() {
  return this.matchedTutors.filter(match => match.status === 'contacted');
});

// Pre-save middleware
ParentRequirementSchema.pre('save', function(next) {
  // Update totalMatches count
  this.totalMatches = this.matchedTutors.length;
  
  // Check if requirement is expired
  if (new Date() > this.expiresAt && this.status === 'active') {
    this.status = 'expired';
    this.isActive = false;
  }
  
  next();
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
ParentRequirementSchema.methods.addTutorMatch = function(tutorId: mongoose.Types.ObjectId, matchScore: number) {
  // Check if tutor is already matched
  const existingMatch = this.matchedTutors.find(match => match.tutorId.toString() === tutorId.toString());
  
  if (existingMatch) {
    existingMatch.matchScore = matchScore;
    existingMatch.matchDate = new Date();
  } else {
    this.matchedTutors.push({
      tutorId,
      matchScore,
      matchDate: new Date(),
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });
  }
  
  return this.save();
};

ParentRequirementSchema.methods.updateTutorMatchStatus = function(tutorId: mongoose.Types.ObjectId, status: string) {
  const match = this.matchedTutors.find(match => match.tutorId.toString() === tutorId.toString());
  
  if (match) {
    match.status = status;
    if (status === 'contacted') {
      match.contactedDate = new Date();
    }
    return this.save();
  }
  
  return Promise.resolve(this);
};

ParentRequirementSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

ParentRequirementSchema.methods.incrementUnlocks = function() {
  this.unlocks += 1;
  return this.save();
};

ParentRequirementSchema.methods.extendExpiry = function(days: number = 7) {
  const newExpiryDate = new Date(this.expiresAt);
  newExpiryDate.setDate(newExpiryDate.getDate() + days);
  this.expiresAt = newExpiryDate;
  this.status = 'active';
  this.isActive = true;
  return this.save();
};

ParentRequirementSchema.methods.closeRequirement = function(reason?: string) {
  this.status = 'closed';
  this.isActive = false;
  // Close all active matches
  this.matchedTutors.forEach(match => {
    if (match.status === 'recommended' || match.status === 'viewed') {
      match.status = 'expired';
    }
  });
  return this.save();
};

ParentRequirementSchema.methods.getTopMatches = function(limit: number = 5) {
  return this.matchedTutors
    .filter(match => match.status !== 'rejected' && match.status !== 'expired' && new Date() <= match.expiryDate)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
};

export const ParentRequirement = mongoose.model<IParentRequirement>('ParentRequirement', ParentRequirementSchema);
