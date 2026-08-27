import mongoose, { Schema, Document } from 'mongoose';

export type EnrollmentStatus = 'active' | 'cancelled';
export type EnrollmentSource = 'free' | 'purchase' | 'admin_grant';

export interface ICourseEnrollment extends Document {
  courseId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId;
  status: EnrollmentStatus;
  source: EnrollmentSource;
  enrolledAt: Date;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CourseEnrollmentSchema: Schema = new Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },
    source: {
      type: String,
      enum: ['free', 'purchase', 'admin_grant'],
      default: 'free',
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    lastAccessedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CourseEnrollmentSchema.index({ courseId: 1, parentId: 1 }, { unique: true });
CourseEnrollmentSchema.index({ parentId: 1, status: 1 });

export const CourseEnrollment = mongoose.model<ICourseEnrollment>(
  'CourseEnrollment',
  CourseEnrollmentSchema
);
