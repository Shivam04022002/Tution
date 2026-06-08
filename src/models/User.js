const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  mobileNumber: {
    type: String,
    required: true,
    unique: true,
    match: /^[0-9]{10}$/,
  },
  role: {
    type: String,
    enum: ['parent', 'teacher', 'admin'],
    required: true,
  },
  profile: {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  isMobileVerified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  blockReason: {
    type: String,
  },
  lastLogin: {
    type: Date,
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true,
    },
    emailUpdates: {
      type: Boolean,
      default: true,
    },
    smsUpdates: {
      type: Boolean,
      default: false,
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes (email and mobileNumber are already indexed via unique: true)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1, isBlocked: 1 });

// Virtuals
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.profile.firstName || this.email;
});

userSchema.virtual('isProfileComplete').get(function() {
  const requiredFields = [
    this.profile.firstName,
    this.profile.lastName,
    this.profile.dateOfBirth,
    this.profile.gender,
  ];
  return requiredFields.every(field => field);
});

// Pre-save middleware - Mongoose v6+ async style
userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Static methods
userSchema.statics.findByEmailOrMobile = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { mobileNumber: identifier }
    ]
  });
};

userSchema.statics.findActiveUsers = function(role) {
  const query = { isActive: true, isBlocked: false };
  if (role) {
    query.role = role;
  }
  return this.find(query);
};

module.exports = mongoose.model('User', userSchema);
