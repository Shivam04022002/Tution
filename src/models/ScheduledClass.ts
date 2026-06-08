import mongoose, { Schema, Document } from 'mongoose';

// Scheduled Class Interface
export interface IScheduledClass extends Document {
  classId: string;
  parentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherProfileId: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId;
  requirementId: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  demoId?: mongoose.Types.ObjectId;
  subject: string;
  grade: string;
  schedule: {
    daysPerWeek: number;
    days: string[];
    timeSlot: string;
    startDate: Date;
    endDate?: Date;
  };
  fee: {
    amount: number;
    currency: string;
    billingCycle: 'hourly' | 'weekly' | 'monthly';
    paymentStatus: 'pending' | 'paid' | 'overdue';
    lastPaymentDate?: Date;
    nextPaymentDate?: Date;
  };
  mode: 'home' | 'online' | 'center';
  location?: {
    address: string;
    city: string;
    pincode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  meetingDetails?: {
    platform?: string;
    meetingLink?: string;
    meetingId?: string;
    password?: string;
  };
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  progress: {
    totalClasses: number;
    completedClasses: number;
    upcomingClasses: number;
    lastClassDate?: Date;
    nextClassDate?: Date;
  };
  attendance: Array<{
    date: Date;
    status: 'present' | 'absent' | 'cancelled' | 'rescheduled';
    notes?: string;
  }>;
  performance?: {
    parentRating?: number;
    teacherRating?: number;
    parentReview?: string;
    teacherReview?: string;
  };
  cancellation?: {
    cancelledBy: 'parent' | 'teacher';
    cancelledAt: Date;
    reason: string;
    refundAmount?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Scheduled Class Schema
const ScheduledClassSchema: Schema = new Schema({
  classId: {
    type: String,
    required: true,
    unique: true,
  },
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
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  requirementId: {
    type: Schema.Types.ObjectId,
    ref: 'ParentRequirement',
    required: true,
  },
  applicationId: {
    type: Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
  },
  demoId: {
    type: Schema.Types.ObjectId,
    ref: 'DemoClass',
  },
  subject: {
    type: String,
    required: true,
  },
  grade: {
    type: String,
    required: true,
  },
  schedule: {
    daysPerWeek: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    days: [{
      type: String,
      required: true,
    }],
    timeSlot: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
  },
  fee: {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    billingCycle: {
      type: String,
      enum: ['hourly', 'weekly', 'monthly'],
      default: 'monthly',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending',
    },
    lastPaymentDate: {
      type: Date,
    },
    nextPaymentDate: {
      type: Date,
    },
  },
  mode: {
    type: String,
    enum: ['home', 'online', 'center'],
    required: true,
  },
  location: {
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    pincode: {
      type: String,
    },
    coordinates: {
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
    },
  },
  meetingDetails: {
    platform: {
      type: String,
    },
    meetingLink: {
      type: String,
    },
    meetingId: {
      type: String,
    },
    password: {
      type: String,
    },
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
    index: true,
  },
  progress: {
    totalClasses: {
      type: Number,
      default: 0,
    },
    completedClasses: {
      type: Number,
      default: 0,
    },
    upcomingClasses: {
      type: Number,
      default: 0,
    },
    lastClassDate: {
      type: Date,
    },
    nextClassDate: {
      type: Date,
    },
  },
  attendance: [{
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'cancelled', 'rescheduled'],
      required: true,
    },
    notes: {
      type: String,
    },
  }],
  performance: {
    parentRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    teacherRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    parentReview: {
      type: String,
      maxlength: 1000,
    },
    teacherReview: {
      type: String,
      maxlength: 1000,
    },
  },
  cancellation: {
    cancelledBy: {
      type: String,
      enum: ['parent', 'teacher'],
    },
    cancelledAt: {
      type: Date,
    },
    reason: {
      type: String,
    },
    refundAmount: {
      type: Number,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
ScheduledClassSchema.index({ parentId: 1, status: 1, 'schedule.startDate': -1 });
ScheduledClassSchema.index({ teacherId: 1, status: 1, 'schedule.startDate': -1 });
ScheduledClassSchema.index({ 'schedule.nextClassDate': 1, status: 1 });
ScheduledClassSchema.index({ requirementId: 1, status: 1 });
ScheduledClassSchema.index({ applicationId: 1 });

// Generate unique class ID
ScheduledClassSchema.pre('save', function() {
  if (!this.classId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.classId = `CLS-${timestamp}-${random}`;
  }
});

export const ScheduledClass = mongoose.model<IScheduledClass>('ScheduledClass', ScheduledClassSchema);
export default ScheduledClass;
