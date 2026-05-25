import mongoose, { Schema, Document } from 'mongoose';

// Lead Unlock Interface
export interface ILeadUnlock extends Document {
  requirementId: mongoose.Types.ObjectId;
  tutorId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId;
  unlockId: string;
  paymentDetails: {
    amount: number;
    currency: string;
    paymentMethod: string;
    transactionId: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
    paymentDate?: Date;
    refundAmount?: number;
    refundReason?: string;
    refundDate?: Date;
  };
  parentContactDetails: {
    parentName: string;
    mobileNumber: string;
    email: string;
    address: string;
    alternateNumber?: string;
  };
  unlockStatus: 'active' | 'expired' | 'refunded';
  unlockedAt: Date;
  expiresAt: Date;
  contactAttempts: {
    attemptDate: Date;
    method: 'call' | 'whatsapp' | 'email' | 'sms';
    status: 'success' | 'failed' | 'pending';
    notes?: string;
  }[];
  followUpRequired: boolean;
  followUpDate?: Date;
  conversionStatus: 'pending' | 'interested' | 'not_interested' | 'converted' | 'lost';
  conversionDate?: Date;
  notes: string;
  isRefundEligible: boolean;
  refundRequested: boolean;
  refundRequestDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Lead Unlock Schema
const LeadUnlockSchema: Schema = new Schema({
  requirementId: {
    type: Schema.Types.ObjectId,
    ref: 'ParentRequirement',
    required: true,
  },
  tutorId: {
    type: Schema.Types.ObjectId,
    ref: 'TeacherProfile',
    required: true,
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  unlockId: {
    type: String,
    required: true,
    unique: true,
  },
  paymentDetails: {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMethod: {
      type: String,
      enum: ['upi', 'card', 'net_banking', 'wallet'],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentDate: {
      type: Date,
    },
    refundAmount: {
      type: Number,
      min: 0,
    },
    refundReason: {
      type: String,
    },
    refundDate: {
      type: Date,
    },
  },
  parentContactDetails: {
    parentName: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      match: /^[0-9]{10}$/,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    alternateNumber: {
      type: String,
      match: /^[0-9]{10}$/,
    },
  },
  unlockStatus: {
    type: String,
    enum: ['active', 'expired', 'refunded'],
    default: 'active',
  },
  unlockedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  contactAttempts: [{
    attemptDate: {
      type: Date,
      default: Date.now,
    },
    method: {
      type: String,
      enum: ['call', 'whatsapp', 'email', 'sms'],
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending',
    },
    notes: {
      type: String,
    },
  }],
  followUpRequired: {
    type: Boolean,
    default: false,
  },
  followUpDate: {
    type: Date,
  },
  conversionStatus: {
    type: String,
    enum: ['pending', 'interested', 'not_interested', 'converted', 'lost'],
    default: 'pending',
  },
  conversionDate: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
  isRefundEligible: {
    type: Boolean,
    default: true,
  },
  refundRequested: {
    type: Boolean,
    default: false,
  },
  refundRequestDate: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better performance
LeadUnlockSchema.index({ requirementId: 1 });
LeadUnlockSchema.index({ tutorId: 1 });
LeadUnlockSchema.index({ parentId: 1 });
LeadUnlockSchema.index({ unlockId: 1 });
LeadUnlockSchema.index({ 'paymentDetails.transactionId': 1 });
LeadUnlockSchema.index({ 'paymentDetails.paymentStatus': 1 });
LeadUnlockSchema.index({ unlockStatus: 1 });
LeadUnlockSchema.index({ expiresAt: 1 });
LeadUnlockSchema.index({ conversionStatus: 1 });
LeadUnlockSchema.index({ createdAt: -1 });

// Virtuals
LeadUnlockSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

LeadUnlockSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

LeadUnlockSchema.virtual('canRequestRefund').get(function() {
  return this.isRefundEligible && 
         !this.refundRequested && 
         this.paymentDetails.paymentStatus === 'completed' &&
         this.conversionStatus === 'pending' &&
         new Date() <= new Date(this.unlockedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days window
});

LeadUnlockSchema.virtual('totalContactAttempts').get(function() {
  return this.contactAttempts.length;
});

LeadUnlockSchema.virtual('successfulContactAttempts').get(function() {
  return this.contactAttempts.filter(attempt => attempt.status === 'success').length;
});

// Pre-save middleware
LeadUnlockSchema.pre('save', function(next) {
  // Check if unlock is expired
  if (new Date() > this.expiresAt && this.unlockStatus === 'active') {
    this.unlockStatus = 'expired';
  }
  
  // Update refund eligibility
  if (this.conversionStatus === 'converted' || this.conversionStatus === 'lost') {
    this.isRefundEligible = false;
  }
  
  next();
});

// Static methods
LeadUnlockSchema.statics.generateUnlockId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `ULK-${timestamp}-${random}`.toUpperCase();
};

LeadUnlockSchema.statics.findByTutor = function(tutorId: mongoose.Types.ObjectId, status?: string) {
  const query: any = { tutorId };
  if (status) {
    query.unlockStatus = status;
  }
  return this.find(query).populate('requirementId').populate('parentId');
};

LeadUnlockSchema.statics.findByParent = function(parentId: mongoose.Types.ObjectId) {
  return this.find({ parentId }).populate('tutorId').populate('requirementId');
};

LeadUnlockSchema.statics.findExpiringSoon = function(days: number = 7) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  return this.find({
    expiresAt: { $lte: expiryDate, $gt: new Date() },
    unlockStatus: 'active',
  });
};

LeadUnlockSchema.statics.getRevenueStats = function(startDate?: Date, endDate?: Date) {
  const matchStage: any = {
    'paymentDetails.paymentStatus': 'completed',
  };
  
  if (startDate || endDate) {
    matchStage.paymentDate = {};
    if (startDate) matchStage.paymentDate.$gte = startDate;
    if (endDate) matchStage.paymentDate.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$paymentDetails.amount' },
        totalUnlocks: { $sum: 1 },
        averageRevenue: { $avg: '$paymentDetails.amount' },
        conversionRate: {
          $avg: {
            $cond: [
              { $eq: ['$conversionStatus', 'converted'] },
              1,
              0
            ]
          }
        },
      },
    },
  ]);
};

LeadUnlockSchema.statics.getTutorPerformance = function(tutorId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { tutorId: new mongoose.Types.ObjectId(tutorId) } },
    {
      $group: {
        _id: '$tutorId',
        totalUnlocks: { $sum: 1 },
        totalSpent: { $sum: '$paymentDetails.amount' },
        conversions: {
          $sum: {
            $cond: [
              { $eq: ['$conversionStatus', 'converted'] },
              1,
              0
            ]
          }
        },
        conversionRate: {
          $avg: {
            $cond: [
              { $eq: ['$conversionStatus', 'converted'] },
              1,
              0
            ]
          }
        },
      },
    },
  ]);
};

// Instance methods
LeadUnlockSchema.methods.addContactAttempt = function(method: string, status: string, notes?: string) {
  this.contactAttempts.push({
    attemptDate: new Date(),
    method,
    status,
    notes,
  });
  return this.save();
};

LeadUnlockSchema.methods.updateConversionStatus = function(status: string, notes?: string) {
  this.conversionStatus = status;
  this.conversionDate = new Date();
  if (notes) this.notes = notes;
  return this.save();
};

LeadUnlockSchema.methods.requestRefund = function(reason: string) {
  if (!this.canRequestRefund) {
    throw new Error('Refund not eligible for this unlock');
  }
  
  this.refundRequested = true;
  this.refundRequestDate = new Date();
  this.paymentDetails.refundReason = reason;
  return this.save();
};

LeadUnlockSchema.methods.processRefund = function(amount: number, reason: string) {
  this.paymentDetails.refundAmount = amount;
  this.paymentDetails.refundReason = reason;
  this.paymentDetails.refundDate = new Date();
  this.paymentDetails.paymentStatus = 'refunded';
  this.unlockStatus = 'refunded';
  return this.save();
};

LeadUnlockSchema.methods.extendExpiry = function(days: number = 7) {
  const newExpiryDate = new Date(this.expiresAt);
  newExpiryDate.setDate(newExpiryDate.getDate() + days);
  this.expiresAt = newExpiryDate;
  this.unlockStatus = 'active';
  return this.save();
};

LeadUnlockSchema.methods.setFollowUp = function(followUpDate: Date, required: boolean = true) {
  this.followUpRequired = required;
  this.followUpDate = followUpDate;
  return this.save();
};

export const LeadUnlock = mongoose.model<ILeadUnlock>('LeadUnlock', LeadUnlockSchema);
