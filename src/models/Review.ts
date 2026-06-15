import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  reviewId: string;
  tutorId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId;
  rating: 1 | 2 | 3 | 4 | 5;
  reviewText: string;
  subject: string;
  studentClass: string;
  parentName: string;
  tutorResponse?: {
    text: string;
    respondedAt: Date;
  };
  helpfulVotes: number;
  helpfulVoterIds: mongoose.Types.ObjectId[];
  isVerified: boolean;
  verificationSource: 'demo_completed' | 'active_relationship' | 'manual';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema: Schema = new Schema(
  {
    reviewId: {
      type: String,
      required: true,
      unique: true,
    },
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'TeacherProfile',
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      enum: [1, 2, 3, 4, 5],
    },
    reviewText: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 1000,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    studentClass: {
      type: String,
      required: true,
      trim: true,
    },
    parentName: {
      type: String,
      required: true,
      trim: true,
    },
    tutorResponse: {
      text: {
        type: String,
        maxlength: 500,
        trim: true,
      },
      respondedAt: {
        type: Date,
      },
    },
    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulVoterIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationSource: {
      type: String,
      enum: ['demo_completed', 'active_relationship', 'manual'],
      default: 'demo_completed',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
ReviewSchema.index({ tutorId: 1, isActive: 1, createdAt: -1 });
ReviewSchema.index({ tutorId: 1, rating: -1 });
ReviewSchema.index({ tutorId: 1, helpfulVotes: -1, createdAt: -1 });
ReviewSchema.index({ parentId: 1, tutorId: 1 }, { unique: true });

// Auto-generate reviewId
ReviewSchema.pre('save', async function () {
  if (!this.reviewId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.reviewId = `REV-${ts}-${rand}`;
  }
});

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
export default Review;
