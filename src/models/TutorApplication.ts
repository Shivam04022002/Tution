import mongoose, { Schema, Document } from 'mongoose';

// Tutor Application Interface
export interface ITutorApplication extends Document {
  parentRequirementId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherProfileId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId;
  applicationId: string;
  status: 'pending' | 'shortlisted' | 'rejected' | 'accepted' | 'withdrawn';
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
  acceptedAt?: Date;
  rejectionReason?: string;
  demoScheduled: boolean;
  demoId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  acceptedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  demoScheduled: {
    type: Boolean,
    default: false,
  },
  demoId: {
    type: Schema.Types.ObjectId,
    ref: 'DemoClass',
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
