const mongoose = require('mongoose');

const teacherProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  basicDetails: {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
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
    languages: [{
      type: String,
      required: true,
    }],
    profilePhoto: {
      type: String,
      default: '',
    },
  },
  education: {
    highestQualification: {
      type: String,
      required: true,
    },
    degree: {
      type: String,
      required: true,
    },
    university: {
      type: String,
      required: true,
    },
    yearOfCompletion: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear(),
    },
    certifications: [{
      name: {
        type: String,
        required: true,
      },
      issuer: {
        type: String,
        required: true,
      },
      year: {
        type: Number,
        required: true,
      },
      certificateUrl: {
        type: String,
      },
    }],
    status: {
      type: String,
      enum: ['completed', 'pursuing'],
      default: 'completed',
    },
  },
  teachingDetails: {
    subjects: [{
      type: String,
      required: true,
    }],
    classes: [{
      type: String,
      required: true,
    }],
    boards: [{
      type: String,
      required: true,
    }],
    specialization: {
      type: String,
      required: true,
    },
    teachingModes: [{
      type: String,
      enum: ['online', 'student_home', 'own_home', 'group'],
      required: true,
    }],
    groupTuitionOption: {
      type: Boolean,
      default: false,
    },
    groupSize: {
      type: Number,
      min: 2,
      max: 20,
      default: 5,
    },
    groupRate: {
      type: Number,
      min: 0,
    },
  },
  locationAvailability: {
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
      match: /^[0-9]{6}$/,
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },
    },
    preferredAreas: [{
      type: String,
    }],
    teachingRadius: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      default: 5,
    },
    availableDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    }],
    availableTimeSlots: [{
      type: String,
      required: true,
    }],
    vacationMode: {
      type: Boolean,
      default: false,
    },
  },
  pricingRevenue: {
    hourlyRate: {
      type: Number,
      required: true,
      min: 50,
    },
    monthlyRate: {
      type: Number,
      required: true,
      min: 1000,
    },
    currentRevenue: {
      type: String,
      enum: ['0', '10000', '25000', '50000', '100000', '100000+'],
      default: '0',
    },
    experienceYears: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    pricingStrategy: {
      type: String,
      enum: ['competitive', 'premium', 'flexible', 'value_based'],
      default: 'competitive',
    },
    negotiationAllowed: {
      type: Boolean,
      default: true,
    },
  },
  verificationDocuments: {
    aadhaarCard: {
      type: String,
      required: true,
    },
    panCard: {
      type: String,
      required: true,
    },
    qualificationDocuments: [{
      type: String,
    }],
    introVideo: {
      type: String,
    },
    portfolioPhotos: [{
      type: String,
    }],
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  verificationDate: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  stats: {
    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    activeStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedClasses: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadUnlocks: {
      type: Number,
      default: 0,
      min: 0,
    },
    responseRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    responseTime: {
      type: String,
      default: '30 min',
    },
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true,
    },
    whatsappUpdates: {
      type: Boolean,
      default: true,
    },
    emailUpdates: {
      type: Boolean,
      default: true,
    },
    leadAlerts: {
      type: Boolean,
      default: true,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  blockReason: {
    type: String,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
teacherProfileSchema.index({ userId: 1 });
teacherProfileSchema.index({ 'locationAvailability.city': 1 });
teacherProfileSchema.index({ 'locationAvailability.coordinates': '2dsphere' });
teacherProfileSchema.index({ 'teachingDetails.subjects': 1 });
teacherProfileSchema.index({ 'teachingDetails.classes': 1 });
teacherProfileSchema.index({ verificationStatus: 1 });
teacherProfileSchema.index({ isActive: 1, isVerified: 1, isBlocked: 1 });
teacherProfileSchema.index({ 'stats.averageRating': -1 });
teacherProfileSchema.index({ 'pricingRevenue.hourlyRate': 1 });

// Virtuals
teacherProfileSchema.virtual('profileCompletion').get(function() {
  const fields = [
    this.basicDetails.fullName,
    this.basicDetails.mobileNumber,
    this.basicDetails.email,
    this.education.highestQualification,
    this.education.degree,
    this.teachingDetails.subjects.length > 0,
    this.teachingDetails.classes.length > 0,
    this.locationAvailability.address,
    this.pricingRevenue.hourlyRate,
    this.verificationDocuments.aadhaarCard,
    this.verificationDocuments.panCard,
  ];
  
  const completedFields = fields.filter(field => field).length;
  return Math.round((completedFields / fields.length) * 100);
});

// Pre-save middleware
teacherProfileSchema.pre('save', function(next) {
  if (this.isModified('verificationStatus') && this.verificationStatus === 'verified') {
    this.verificationDate = new Date();
    this.isVerified = true;
  }
  next();
});

// Static methods
teacherProfileSchema.statics.findNearbyTutors = function(latitude, longitude, maxDistance = 10000) {
  return this.find({
    'locationAvailability.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
    isActive: true,
    isVerified: true,
    isBlocked: false,
  });
};

teacherProfileSchema.statics.findBySubjects = function(subjects) {
  return this.find({
    'teachingDetails.subjects': { $in: subjects },
    isActive: true,
    isVerified: true,
    isBlocked: false,
  });
};

teacherProfileSchema.statics.findByLocation = function(city) {
  return this.find({
    'locationAvailability.city': city,
    isActive: true,
    isVerified: true,
    isBlocked: false,
  });
};

// Instance methods
teacherProfileSchema.methods.updateStats = async function(statsUpdate) {
  Object.assign(this.stats, statsUpdate);
  return this.save();
};

teacherProfileSchema.methods.toggleVacationMode = function() {
  this.locationAvailability.vacationMode = !this.locationAvailability.vacationMode;
  return this.save();
};

teacherProfileSchema.methods.canAcceptLead = function() {
  return this.isActive && this.isVerified && !this.isBlocked && !this.locationAvailability.vacationMode;
};

module.exports = mongoose.model('TeacherProfile', teacherProfileSchema);
