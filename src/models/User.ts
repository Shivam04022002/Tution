import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  firebaseUid?: string;
  email: string;
  phoneNumber: string;
  password?: string;
  username?: string | null;
  role: 'parent' | 'teacher' | 'admin' | 'staff';
  staffRole?: string | null;
  profile: {
    firstName: string;
    lastName: string;
    profileImage?: string | null;
    dateOfBirth?: Date | null;
    gender?: 'male' | 'female' | 'other' | null;
    department?: string | null;
  };
  employeeId?: string | null;
  designation?: string | null;
  department?: string | null;
  joiningDate?: Date | null;
  dateOfBirth?: Date | null;
  gender?: 'male' | 'female' | 'other' | null;
  permissions?: string[];
  lastLogin?: Date | null;
  createdBy?: mongoose.Types.ObjectId | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  preferences: {
    notifications: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
    language: string;
  };
  isActive: boolean;
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    minlength: 8,
    select: false,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  role: {
    type: String,
    enum: ['parent', 'teacher', 'admin', 'staff'],
    required: true,
    default: 'parent',
  },
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      default: '',
      trim: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: null,
    },
    department: {
      type: String,
      default: null,
    },
  },
  staffRole: {
    type: String,
    default: null,
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
  },
  designation: {
    type: String,
    default: null,
    trim: true,
  },
  department: {
    type: String,
    default: null,
    trim: true,
  },
  joiningDate: {
    type: Date,
    default: null,
  },
  permissions: {
    type: [String],
    default: [],
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  onboardingCompleted: {
    type: Boolean,
    default: false,
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      default: 'en',
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
}, {
  timestamps: true,
});

// Indexes for better performance
userSchema.index({ firebaseUid: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ staffRole: 1 });
userSchema.index({ department: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdBy: 1 });
userSchema.index({ updatedBy: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return [this.profile.firstName, this.profile.lastName].filter(Boolean).join(' ');
});

// Pre-save middleware
userSchema.pre('save', async function() {
  // Check if profile is completed
  const requiredFields = ['firstName', 'lastName'];
  const isProfileComplete = requiredFields.every(field =>
    this.profile[field as keyof typeof this.profile] &&
    this.profile[field as keyof typeof this.profile]?.toString().trim() !== ''
  );

  if (isProfileComplete && !this.profileCompleted) {
    this.profileCompleted = true;
  }

  // Hash password if modified
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
