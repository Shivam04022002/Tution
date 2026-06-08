import mongoose, { Schema, Document } from 'mongoose';

// Shortlist Interface
export interface IShortlist extends Document {
  parentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherProfileId: mongoose.Types.ObjectId;
  requirementId: mongoose.Types.ObjectId;
  notes?: string;
  matchScore?: number;
  isContacted: boolean;
  contactedAt?: Date;
  contactMethod?: 'call' | 'whatsapp' | 'email' | 'sms';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Shortlist Schema
const ShortlistSchema: Schema = new Schema({
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
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
  requirementId: {
    type: Schema.Types.ObjectId,
    ref: 'ParentRequirement',
    required: true,
    index: true,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  matchScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  isContacted: {
    type: Boolean,
    default: false,
  },
  contactedAt: {
    type: Date,
  },
  contactMethod: {
    type: String,
    enum: ['call', 'whatsapp', 'email', 'sms'],
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
ShortlistSchema.index({ parentId: 1, requirementId: 1, isDeleted: 1 });
ShortlistSchema.index({ parentId: 1, teacherId: 1, requirementId: 1 }, { unique: true });
ShortlistSchema.index({ parentId: 1, createdAt: -1 });
ShortlistSchema.index({ teacherId: 1, isDeleted: 1 });

// Ensure unique shortlist per parent-teacher-requirement combination
ShortlistSchema.pre('save', function() {
  // Note: Mongoose handles uniqueness via index, this hook is redundant
  // Keeping for documentation purposes
});

export const Shortlist = mongoose.model<IShortlist>('Shortlist', ShortlistSchema);
export default Shortlist;
