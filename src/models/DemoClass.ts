import mongoose, { Schema, Document } from 'mongoose';

// Demo Class Interface
export interface IDemoClass extends Document {
  demoId: string;
  parentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherProfileId: mongoose.Types.ObjectId;
  requirementId: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  studentDetails: {
    studentName: string;
    grade: string;
    subject: string;
  };
  scheduledDate: Date;
  scheduledTime: string;
  duration: number; // in minutes
  mode: 'online' | 'offline';
  meetingDetails?: {
    platform: string;
    meetingLink?: string;
    meetingId?: string;
    password?: string;
    address?: string;
  };
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';
  previousDates?: Array<{
    date: Date;
    time: string;
    reason: string;
  }>;
  feedback?: {
    parentFeedback?: {
      rating: number;
      comment: string;
      isInterested: boolean;
      submittedAt: Date;
    };
    teacherFeedback?: {
      rating: number;
      comment: string;
      isInterested: boolean;
      submittedAt: Date;
    };
  };
  outcome?: 'interested' | 'not_interested' | 'pending';
  nextSteps?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Demo Class Schema
const DemoClassSchema: Schema = new Schema({
  demoId: {
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
  studentDetails: {
    studentName: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true,
  },
  scheduledTime: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    default: 60, // 60 minutes default
    min: 30,
    max: 180,
  },
  mode: {
    type: String,
    enum: ['online', 'offline'],
    required: true,
  },
  meetingDetails: {
    platform: {
      type: String,
      enum: ['zoom', 'google_meet', 'microsoft_teams', 'skype', 'whatsapp', 'in_person'],
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
    address: {
      type: String,
    },
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'],
    default: 'scheduled',
    index: true,
  },
  previousDates: [{
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
  }],
  feedback: {
    parentFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
        maxlength: 1000,
      },
      isInterested: {
        type: Boolean,
      },
      submittedAt: {
        type: Date,
      },
    },
    teacherFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
        maxlength: 1000,
      },
      isInterested: {
        type: Boolean,
      },
      submittedAt: {
        type: Date,
      },
    },
  },
  outcome: {
    type: String,
    enum: ['interested', 'not_interested', 'pending'],
    default: 'pending',
  },
  nextSteps: {
    type: String,
    maxlength: 500,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
DemoClassSchema.index({ parentId: 1, status: 1, scheduledDate: 1 });
DemoClassSchema.index({ teacherId: 1, status: 1, scheduledDate: 1 });
DemoClassSchema.index({ scheduledDate: 1, status: 1 });
DemoClassSchema.index({ requirementId: 1, status: 1 });
DemoClassSchema.index({ applicationId: 1 });

// Generate unique demo ID
DemoClassSchema.pre('save', async function() {
  if (!this.demoId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.demoId = `DEMO-${timestamp}-${random}`;
  }
});

export const DemoClass = mongoose.model<IDemoClass>('DemoClass', DemoClassSchema);
export default DemoClass;
