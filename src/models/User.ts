import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  firebaseUid?: string;
  email: string;
  phoneNumber: string;
  password?: string;
  role: 'parent' | 'teacher' | 'admin' | 'staff';
  profile: {
    firstName: string;
    lastName: string;
    profileImage?: string;
    dateOfBirth?: Date;
    gender?: 'male' | 'female' | 'other';
    department?: string;
  };
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
    minlength: 6,
    select: false,
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
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isVerified: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return [this.profile.firstName, this.profile.lastName].filter(Boolean).join(' ');
});

// Pre-save middleware
userSchema.pre('save', async function(next: any) {
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
  
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
