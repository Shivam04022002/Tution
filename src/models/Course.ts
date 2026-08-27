import mongoose, { Schema, Document } from 'mongoose';

export type CourseVideoStatus = 'processing' | 'ready' | 'failed';
export type CourseAccessType = 'free' | 'paid';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Video metadata for a lesson.
 *
 * Only the S3 storage key and descriptive metadata live in MongoDB — the video
 * binary is never stored in the database. Playback URLs are generated on demand.
 */
export interface ILessonVideo {
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  size: number;              // bytes
  duration?: number;         // seconds, reported by the player after upload
  status: CourseVideoStatus;
  thumbnailKey?: string;
  failureReason?: string;
  uploadedAt: Date;
}

export interface ICourseLesson {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  isPublished: boolean;
  isFreePreview: boolean;    // playable without enrolment on a published course
  video?: ILessonVideo;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  categoryId: string;        // matches the marketplace category ids (math, science, ...)
  level: CourseLevel;
  thumbnailUrl?: string;
  accessType: CourseAccessType;
  price: number;             // INR, 0 for free courses
  currency: string;
  lessons: mongoose.Types.DocumentArray<ICourseLesson & mongoose.Types.Subdocument>;
  isPublished: boolean;
  publishedAt?: Date;
  isActive: boolean;
  enrollmentCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LessonVideoSchema = new Schema<ILessonVideo>(
  {
    storageKey: {
      type: String,
      required: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
      required: true,
    },
    thumbnailKey: {
      type: String,
    },
    failureReason: {
      type: String,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const CourseLessonSchema = new Schema<ICourseLesson>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    isFreePreview: {
      type: Boolean,
      default: false,
    },
    video: {
      type: LessonVideoSchema,
      required: false,
    },
  },
  { timestamps: true }
);

const CourseSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    categoryId: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    thumbnailUrl: {
      type: String,
    },
    accessType: {
      type: String,
      enum: ['free', 'paid'],
      default: 'free',
      required: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    lessons: {
      type: [CourseLessonSchema],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    enrollmentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CourseSchema.index({ isActive: 1, isPublished: 1, categoryId: 1 });
CourseSchema.index({ createdBy: 1 });
CourseSchema.index({ title: 'text', description: 'text' });

export const Course = mongoose.model<ICourse>('Course', CourseSchema);
