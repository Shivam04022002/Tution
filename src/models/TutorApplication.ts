import mongoose, { Schema, Document } from 'mongoose';

// Tutor Application Interface
export interface ITutorApplication extends Document {
  parentRequirementId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherProfileId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId;
  applicationId: string;
  status: 'pending' | 'viewed' | 'shortlisted' | 'rejected' | 'demo_scheduled' | 'demo_completed' | 'selected' | 'hired' | 'withdrawn';
  message?: string;
  proposedFee?: number;
  proposedSchedule?: {
    daysPerWeek: string;
    preferredTimeSlots: string[];
  };
  viewedByParent: boolean;
  viewedAt?: Date;
  shortlistedAt?: Date;
  rejectedAt?: Date;
  selectedAt?: Date;
  hiredAt?: Date;
  rejectionReason?: string;
  selectionReason?: string;
  hireNotes?: string;
  demoScheduled: boolean;
  demoId?: mongoose.Types.ObjectId;
  demoCompletedAt?: Date;
  demoOutcome?: 'interested' | 'not_interested' | 'need_follow_up';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  markAsViewed(): Promise<ITutorApplication>;
  markAsShortlisted(): Promise<ITutorApplication>;
  markAsRejected(reason?: string): Promise<ITutorApplication>;
  markAsDemoScheduled(demoId: mongoose.Types.ObjectId): Promise<ITutorApplication>;
  markAsDemoCompleted(outcome: 'interested' | 'not_interested' | 'need_follow_up'): Promise<ITutorApplication>;
  markAsSelected(reason?: string): Promise<ITutorApplication>;
  markAsHired(notes?: string): Promise<ITutorApplication>;
}

// Tutor Application Schema
const TutorApplicationSchema: Schema = new Schema({
  parentRequirementId: {
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
    type: Schema.Types.ObjectId,
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

// Compound indexes for efficient queries
TutorApplicationSchema.index({ parentRequirementId: 1, status: 1 });
TutorApplicationSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
TutorApplicationSchema.index({ parentId: 1, status: 1, createdAt: -1 });
TutorApplicationSchema.index({ createdAt: -1 });

// Instance methods
TutorApplicationSchema.methods.markAsViewed = function(this: ITutorApplication) {
  this.status = 'viewed';
  this.viewedByParent = true;
  this.viewedAt = new Date();
  return this.save();
};

TutorApplicationSchema.methods.markAsShortlisted = function(this: ITutorApplication) {
  this.status = 'shortlisted';
  this.shortlistedAt = new Date();
  return this.save();
};

TutorApplicationSchema.methods.markAsRejected = function(this: ITutorApplication, reason?: string) {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  if (reason) this.rejectionReason = reason;
  return this.save();
};

TutorApplicationSchema.methods.markAsDemoScheduled = function(this: ITutorApplication, demoId: mongoose.Types.ObjectId) {
  this.status = 'demo_scheduled';
  this.demoScheduled = true;
  this.demoId = demoId;
  return this.save();
};

TutorApplicationSchema.methods.markAsDemoCompleted = function(this: ITutorApplication, outcome: 'interested' | 'not_interested' | 'need_follow_up') {
  this.status = 'demo_completed';
  this.demoCompletedAt = new Date();
  this.demoOutcome = outcome;
  return this.save();
};

TutorApplicationSchema.methods.markAsSelected = function(this: ITutorApplication, reason?: string) {
  this.status = 'selected';
  this.selectedAt = new Date();
  if (reason) this.selectionReason = reason;
  return this.save();
};

TutorApplicationSchema.methods.markAsHired = function(this: ITutorApplication, notes?: string) {
  this.status = 'hired';
  this.hiredAt = new Date();
  if (notes) this.hireNotes = notes;
  return this.save();
};

// Generate unique application ID
TutorApplicationSchema.pre('save', async function() {
  if (!this.applicationId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.applicationId = `APP-${timestamp}-${random}`;
  }
});

export const TutorApplication = mongoose.model<ITutorApplication>('TutorApplication', TutorApplicationSchema);
export default TutorApplication;
