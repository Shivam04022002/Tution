import mongoose, { Schema, Document } from 'mongoose';

// Contact Request Interface
export interface IContactRequest extends Document {
  contactRequestId: string;
  parentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherProfileId: mongoose.Types.ObjectId;
  requirementId?: mongoose.Types.ObjectId;
  contactType: 'call' | 'whatsapp' | 'message' | 'demo';
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'rescheduled';
  message?: string;
  demoDate?: Date;
  demoTime?: string;
  demoMode?: 'online' | 'offline';
  demoNotes?: string;
  rescheduleHistory?: Array<{
    previousDate: Date;
    previousTime: string;
    newDate: Date;
    newTime: string;
    reason: string;
    rescheduledAt: Date;
    rescheduledBy: 'parent' | 'teacher';
  }>;
  responseMessage?: string;
  respondedAt?: Date;
  respondedBy?: mongoose.Types.ObjectId;
  demoFeedback?: {
    outcome: 'interested' | 'not_interested' | 'need_follow_up';
    notes?: string;
    completedAt: Date;
  };
  meetingLink?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Contact Request Schema
const ContactRequestSchema: Schema = new Schema({
  contactRequestId: {
    type: String,
    required: true,
    unique: true,
    index: true,
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
    index: true,
  },
  contactType: {
    type: String,
    enum: ['call', 'whatsapp', 'message', 'demo'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'rescheduled'],
    default: 'pending',
    index: true,
  },
  demoFeedback: {
    outcome: {
      type: String,
      enum: ['interested', 'not_interested', 'need_follow_up'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    completedAt: {
      type: Date,
    },
  },
  meetingLink: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  message: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  demoDate: {
    type: Date,
    index: true,
  },
  demoTime: {
    type: String,
  },
  demoMode: {
    type: String,
    enum: ['online', 'offline'],
  },
  demoNotes: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  rescheduleHistory: [{
    previousDate: {
      type: Date,
      required: true,
    },
    previousTime: {
      type: String,
      required: true,
    },
    newDate: {
      type: Date,
      required: true,
    },
    newTime: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },
    rescheduledAt: {
      type: Date,
      default: Date.now,
    },
    rescheduledBy: {
      type: String,
      enum: ['parent', 'teacher'],
      required: true,
    },
  }],
  responseMessage: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  respondedAt: {
    type: Date,
  },
  respondedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
ContactRequestSchema.index({ parentId: 1, status: 1, createdAt: -1 });
ContactRequestSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
ContactRequestSchema.index({ parentId: 1, teacherId: 1, contactType: 1 });
ContactRequestSchema.index({ requirementId: 1, status: 1 });
ContactRequestSchema.index({ contactType: 1, status: 1 });
ContactRequestSchema.index({ createdAt: -1 });

// Generate unique contact request ID
ContactRequestSchema.pre('save', async function() {
  if (!this.contactRequestId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.contactRequestId = `CNT-${timestamp}-${random}`;
  }
});

export const ContactRequest = mongoose.model<IContactRequest>('ContactRequest', ContactRequestSchema);
export default ContactRequest;
