import mongoose, { Schema, Document } from 'mongoose';

// Blocked Time Interface
export interface IBlockedTime extends Document {
  blockedTimeId: string;
  teacherId: mongoose.Types.ObjectId;
  date: Date;
  startTime?: string; // HH:mm format, optional for full-day blocks
  endTime?: string;   // HH:mm format, optional for full-day blocks
  isFullDay: boolean;
  reason: string;
  reasonType: 'vacation' | 'exam' | 'personal' | 'medical' | 'other';
  isRecurring: boolean;
  recurringDays?: string[]; // ['Monday', 'Tuesday'] for recurring weekly blocks
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Blocked Time Schema
const BlockedTimeSchema: Schema = new Schema({
  blockedTimeId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  startTime: {
    type: String,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  },
  endTime: {
    type: String,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  },
  isFullDay: {
    type: Boolean,
    default: false,
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true,
  },
  reasonType: {
    type: String,
    enum: ['vacation', 'exam', 'personal', 'medical', 'other'],
    default: 'other',
    index: true,
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  recurringDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
BlockedTimeSchema.index({ teacherId: 1, date: 1, isActive: 1 });
BlockedTimeSchema.index({ teacherId: 1, reasonType: 1, isActive: 1 });
BlockedTimeSchema.index({ date: 1, isActive: 1 });

// Validate that startTime < endTime when both are provided
BlockedTimeSchema.pre('save', function(next: any) {
  const doc = this as any;
  if (doc.startTime && doc.endTime) {
    const [startHour, startMin] = (doc.startTime as string).split(':').map(Number);
    const [endHour, endMin] = (doc.endTime as string).split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      return next(new Error('End time must be after start time'));
    }
  }
  next();
});

// Generate unique blocked time ID
BlockedTimeSchema.pre('save', async function() {
  if (!this.blockedTimeId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.blockedTimeId = `BLK-${timestamp}-${random}`;
  }
});

export const BlockedTime = mongoose.model<IBlockedTime>('BlockedTime', BlockedTimeSchema);
export default BlockedTime;
