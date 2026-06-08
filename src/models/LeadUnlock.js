const mongoose = require('mongoose');

const leadUnlockSchema = new mongoose.Schema({
  requirementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParentRequirement',
    required: true,
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeacherProfile',
    required: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
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

// Indexes (unlockId and paymentDetails.transactionId already indexed via unique: true)
leadUnlockSchema.index({ requirementId: 1 });
leadUnlockSchema.index({ tutorId: 1 });
leadUnlockSchema.index({ parentId: 1 });
leadUnlockSchema.index({ 'paymentDetails.paymentStatus': 1 });
leadUnlockSchema.index({ unlockStatus: 1 });
leadUnlockSchema.index({ expiresAt: 1 });
leadUnlockSchema.index({ conversionStatus: 1 });
leadUnlockSchema.index({ createdAt: -1 });

// Virtuals
leadUnlockSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

leadUnlockSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

leadUnlockSchema.virtual('canRequestRefund').get(function() {
  return this.isRefundEligible && 
         !this.refundRequested && 
         this.paymentDetails.paymentStatus === 'completed' &&
         this.conversionStatus === 'pending' &&
         new Date() <= new Date(this.unlockedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days window
});

leadUnlockSchema.virtual('totalContactAttempts').get(function() {
  return this.contactAttempts.length;
});

leadUnlockSchema.virtual('successfulContactAttempts').get(function() {
  return this.contactAttempts.filter(attempt => attempt.status === 'success').length;
});

// Pre-save middleware
leadUnlockSchema.pre('save', function(next) {
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
leadUnlockSchema.statics.generateUnlockId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `ULK-${timestamp}-${random}`.toUpperCase();
};

leadUnlockSchema.statics.findByTutor = function(tutorId, status) {
  const query = { tutorId };
  if (status) {
    query.unlockStatus = status;
  }
  return this.find(query).populate('requirementId').populate('parentId');
};

leadUnlockSchema.statics.findByParent = function(parentId) {
  return this.find({ parentId }).populate('tutorId').populate('requirementId');
};

leadUnlockSchema.statics.findExpiringSoon = function(days = 7) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  return this.find({
    expiresAt: { $lte: expiryDate, $gt: new Date() },
    unlockStatus: 'active',
  });
};

leadUnlockSchema.statics.getRevenueStats = function(startDate, endDate) {
  const matchStage = {
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

leadUnlockSchema.statics.getTutorPerformance = function(tutorId) {
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
leadUnlockSchema.methods.addContactAttempt = function(method, status, notes) {
  this.contactAttempts.push({
    attemptDate: new Date(),
    method,
    status,
    notes,
  });
  return this.save();
};

leadUnlockSchema.methods.updateConversionStatus = function(status, notes) {
  this.conversionStatus = status;
  this.conversionDate = new Date();
  if (notes) this.notes = notes;
  return this.save();
};

leadUnlockSchema.methods.requestRefund = function(reason) {
  if (!this.canRequestRefund) {
    throw new Error('Refund not eligible for this unlock');
  }
  
  this.refundRequested = true;
  this.refundRequestDate = new Date();
  this.paymentDetails.refundReason = reason;
  return this.save();
};

leadUnlockSchema.methods.processRefund = function(amount, reason) {
  this.paymentDetails.refundAmount = amount;
  this.paymentDetails.refundReason = reason;
  this.paymentDetails.refundDate = new Date();
  this.paymentDetails.paymentStatus = 'refunded';
  this.unlockStatus = 'refunded';
  return this.save();
};

leadUnlockSchema.methods.extendExpiry = function(days = 7) {
  const newExpiryDate = new Date(this.expiresAt);
  newExpiryDate.setDate(newExpiryDate.getDate() + days);
  this.expiresAt = newExpiryDate;
  this.unlockStatus = 'active';
  return this.save();
};

leadUnlockSchema.methods.setFollowUp = function(followUpDate, required = true) {
  this.followUpRequired = required;
  this.followUpDate = followUpDate;
  return this.save();
};

module.exports = mongoose.model('LeadUnlock', leadUnlockSchema);
