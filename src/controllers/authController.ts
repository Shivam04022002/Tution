import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { auth, firestore } from '../config/firebase';
import { User } from '../models/User';
import { ParentRequirement } from '../models/ParentRequirement';
import { TeacherProfile } from '../models/TeacherProfile';
import { AuthRequest } from '../middleware/auth';

// Generate JWT Token (standardized to use only userId)
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  } as jwt.SignOptions);
};

// Send OTP
export const sendOTP = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    
    // Send OTP via Firebase (simulated for demo)
    // In production, you would use Firebase Auth to send OTP
    try {
      await auth.createUser({
        phoneNumber,
      });
    } catch (error: any) {
      if (error.code === 'auth/user-already-exists') {
        // User already exists, proceed with verification
        return res.status(200).json({
          success: true,
          message: 'OTP sent successfully',
          userExists: true,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      userExists: !!existingUser,
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
};

// Verify OTP and Login/Register
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, otp, role } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required',
      });
    }

    // Validate OTP format
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP format. OTP must be 6 digits.',
      });
    }

    // Verify OTP with Firebase - ACTUAL VERIFICATION
    let firebaseUser;
    try {
      firebaseUser = await auth.verifyPhoneNumber(phoneNumber, otp);
    } catch (error: any) {
      console.error('OTP verification failed:', error.message);
      
      // Handle specific Firebase OTP errors
      if (error.message.includes('Invalid OTP') || error.message.includes('auth/invalid-verification-code')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid OTP. Please try again.',
        });
      }
      
      if (error.message.includes('expired') || error.message.includes('auth/code-expired')) {
        return res.status(401).json({
          success: false,
          message: 'OTP has expired. Please request a new one.',
        });
      }
      
      if (error.message.includes('too many') || error.message.includes('auth/too-many-requests')) {
        return res.status(429).json({
          success: false,
          message: 'Too many attempts. Please try again later.',
        });
      }
      
      // Generic OTP verification failure
      return res.status(401).json({
        success: false,
        message: 'OTP verification failed. Please try again.',
      });
    }

    // Find user in our database first
    let user = await User.findOne({ firebaseUid: firebaseUser.uid });
    
    // Only require role if user doesn't exist (new user)
    if (!user) {
      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required for new users. Please specify parent or teacher.',
        });
      }

      // Validate role - prevent admin/staff creation via OTP
      if (!['parent', 'teacher'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Only parent and teacher roles can be created via OTP.',
        });
      }

      user = new User({
        firebaseUid: firebaseUser.uid,
        phoneNumber,
        email: `${phoneNumber}@tuition.app`, // Placeholder email
        role,
        profile: {
          firstName: '',
          lastName: '',
        },
      });
      
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  }
};

// Get current user
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
        preferences: user.preferences,
        isVerified: user.isVerified,
      },
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user information',
    });
  }
};

// Update user profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    // Don't allow updating sensitive fields directly
    const allowedUpdates = [
      'profile.firstName',
      'profile.lastName',
      'profile.dateOfBirth',
      'profile.gender',
      'profile.profileImage',
      'preferences',
    ];

    const updateData: any = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key) || allowedUpdates.some(allowed => key.startsWith(allowed + '.'))) {
        updateData[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
        preferences: user.preferences,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

// Logout (client-side token removal)
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    // In a real implementation, you might want to invalidate the token
    // For JWT, this is typically handled client-side by removing the token
    
    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
    });
  }
};

// Login with email/mobile and password
export const login = async (req: Request, res: Response) => {
  try {
    const { emailOrMobile, password } = req.body;

    if (!emailOrMobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Mobile and password are required',
      });
    }

    // Find user by email or phone number
    const user = await User.findOne({
      $or: [
        { email: emailOrMobile.toLowerCase() },
        { phoneNumber: emailOrMobile },
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      role: user.role,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
};

// Generate unique IDs
const generateRequirementId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `REQ-${timestamp}-${random}`.toUpperCase();
};

// Complete Registration - Creates User + Profile in one call
export const registerComplete = async (req: Request, res: Response) => {
  try {
    const {
      role,
      fullName,
      mobileNumber,
      email,
      password,
      // Parent specific
      parentDetails,
      studentDetails,
      tuitionRequirement,
      locationDetails,
      budgetDetails,
      scheduleDetails,
      tutorPreferences,
      // Teacher specific
      personalDetails,
      educationDetails,
      professionalDetails,
      teachingDetails,
      teachingMode,
      availability,
      locationPreferences,
      pricingDetails,
    } = req.body;

    // Validation
    if (!role || !fullName || !mobileNumber || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Role, full name, mobile number, email, and password are required',
      });
    }

    if (!['parent', 'teacher'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be parent or teacher',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber: mobileNumber }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or mobile number already exists',
      });
    }

    // Split full name into first and last
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      phoneNumber: mobileNumber,
      password,
      role,
      profile: {
        firstName,
        lastName,
      },
      profileCompleted: true,
      onboardingCompleted: true,
    });

    await user.save();

    let profileData: any = null;

    // DEBUG: Log what we received
    console.log('=== REGISTER-COMPLETE DEBUG ===');
    console.log('studentDetails:', JSON.stringify(studentDetails, null, 2));
    console.log('tuitionRequirement:', JSON.stringify(tuitionRequirement, null, 2));
    console.log('scheduleDetails:', JSON.stringify(scheduleDetails, null, 2));
    console.log('locationDetails:', JSON.stringify(locationDetails, null, 2));
    console.log('=== END DEBUG ===');

    // Create role-specific profile
    if (role === 'parent') {
      // Parse budget
      let minAmount = 0;
      let maxAmount = 0;

      if (budgetDetails?.budget === 'Custom Budget' && budgetDetails?.customBudget) {
        minAmount = 0;
        maxAmount = parseInt(budgetDetails.customBudget, 10) || 0;
      } else {
        const budgetMap: { [key: string]: { min: number; max: number } } = {
          '₹1000 - ₹2000': { min: 1000, max: 2000 },
          '₹2000 - ₹5000': { min: 2000, max: 5000 },
          '₹5000 - ₹10000': { min: 5000, max: 10000 },
          '₹10000+': { min: 10000, max: 50000 },
        };
        const budget = budgetMap[budgetDetails?.budget] || { min: 0, max: 0 };
        minAmount = budget.min;
        maxAmount = budget.max;
      }

      // Map tuition mode to enum - use frontend mapped value if available, otherwise map it
      let tuitionType = 'home';
      if (tuitionRequirement?.tuitionType) {
        // Frontend already mapped it to enum
        tuitionType = tuitionRequirement.tuitionType;
      } else if (tuitionRequirement?.tuitionMode) {
        // Need to map from display value
        const modeMap: { [key: string]: string } = {
          'Home Tuition': 'home',
          'Online Tuition': 'online',
          'Group Tuition': 'group',
          'Crash Course': 'crash',
        };
        tuitionType = modeMap[tuitionRequirement.tuitionMode] || 'home';
      }

      // Create parent requirement with proper field mappings
      const parentRequirement = new ParentRequirement({
        parentId: user._id,
        requirementId: generateRequirementId(),
        studentDetails: {
          studentName: studentDetails?.studentName || '',
          age: parseInt(studentDetails?.age, 10) || 0,
          grade: studentDetails?.grade || studentDetails?.className || '',
          board: studentDetails?.board || tuitionRequirement?.board || '',
          schoolName: studentDetails?.schoolName || '',
          genderPreference: studentDetails?.gender?.toLowerCase() || 'any',
          multipleChildren: false,
        },
        subjects: tuitionRequirement?.subjects || [],
        languagePreference: ['English'],
        tuitionType,
        location: {
          address: locationDetails?.address || '',
          city: locationDetails?.city || '',
          pincode: locationDetails?.pincode || '',
          coordinates: {
            latitude: parseFloat(locationDetails?.latitude) || 0,
            longitude: parseFloat(locationDetails?.longitude) || 0,
          },
          teachingRadius: parseInt(locationDetails?.teachingRadius) || 5,
        },
        schedule: {
          daysPerWeek: scheduleDetails?.daysPerWeek || '3',
          preferredTimings: scheduleDetails?.preferredTimings || 
            (tuitionRequirement?.preferredTiming ? [tuitionRequirement.preferredTiming] : []),
          startDate: scheduleDetails?.startDate || new Date().toISOString().split('T')[0],
        },
        tutorPreferences: tutorPreferences || '',
        budget: { 
          minAmount: minAmount || 0, 
          maxAmount: maxAmount || 0, 
          negotiationAllowed: true 
        },
        status: 'active',
        priority: 'medium',
        matchedTutors: [],
        totalMatches: 0,
        views: 0,
        unlocks: 0,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await parentRequirement.save();
      profileData = parentRequirement;
    } else if (role === 'teacher') {
      // Map teaching experience to years
      const experienceMap: { [key: string]: number } = {
        'Fresher': 0,
        '0-1 Years': 0.5,
        '1-3 Years': 2,
        '3-5 Years': 4,
        '5-10 Years': 7.5,
        '10+ Years': 12,
      };

      // Parse pricing
      let monthlyRate = 0;
      let hourlyRate = 0;
      if (pricingDetails?.pricing === 'Custom Amount') {
        monthlyRate = parseInt(pricingDetails.customAmount) || 0;
      } else {
        const range = pricingDetails?.pricing?.replace('₹', '').split('-');
        if (range && range.length === 2) {
          monthlyRate = (parseInt(range[0]) + parseInt(range[1])) / 2;
        } else if (pricingDetails?.pricing?.includes('10000+')) {
          monthlyRate = 10000;
        }
      }
      hourlyRate = Math.max(50, Math.round(monthlyRate / 40));

      // Create teacher profile
      const teacherProfile = new TeacherProfile({
        userId: user._id,
        basicDetails: {
          fullName: personalDetails?.fullName || fullName,
          gender: (personalDetails?.gender || '').toLowerCase(),
          dateOfBirth: personalDetails?.dob ? new Date(personalDetails.dob) : new Date(),
          mobileNumber: personalDetails?.mobileNumber || mobileNumber,
          email: personalDetails?.email || email,
          languages: ['English', 'Hindi'],
          profilePhoto: '',
        },
        education: {
          highestQualification: educationDetails?.qualification || '',
          degree: educationDetails?.qualification || '',
          university: educationDetails?.collegeUniversity || '',
          yearOfCompletion: new Date().getFullYear(),
          certifications: [],
          status: 'completed',
        },
        teachingDetails: {
          subjects: teachingDetails?.subjects || [],
          classes: teachingDetails?.classes || [],
          boards: teachingDetails?.boards || [],
          specialization: teachingDetails?.subjects?.[0] || '',
          teachingModes: (teachingMode || []).map((m: string) => {
            const modeMap: { [key: string]: string } = {
              'Home Tuition': 'student_home',
              'Online Tuition': 'online',
              'Group Tuition': 'group',
              'Institute Tuition': 'own_home',
            };
            return modeMap[m] || m.toLowerCase().replace(' ', '_');
          }),
          groupTuitionOption: teachingMode?.includes('Group Tuition') || false,
          groupSize: 5,
          groupRate: 0,
        },
        locationAvailability: {
          address: personalDetails?.address || '',
          city: personalDetails?.city || '',
          pincode: personalDetails?.pincode || '',
          coordinates: { latitude: 0, longitude: 0 },
          preferredAreas: locationPreferences || [],
          teachingRadius: 10,
          availableDays: availability?.days || [],
          availableTimeSlots: availability?.timeSlots || [],
          vacationMode: false,
        },
        discoverability: {
          availableForNewStudents: true,
          visibleInMarketplace: true,
          onlineStatus: 'hybrid',
          travelSettings: {
            maxTravelDistance: 10,
            preferredTravelModes: [],
          },
          locationCoverage: {
            state: personalDetails?.state || personalDetails?.city || '',
            city: personalDetails?.city || '',
            areas: locationPreferences || [],
            pincodes: personalDetails?.pincode ? [personalDetails.pincode] : [],
          },
        },
        bio: professionalDetails?.bio || '',
        pricingRevenue: {
          hourlyRate,
          monthlyRate,
          currentRevenue: '0',
          experienceYears: experienceMap[professionalDetails?.teachingExperience] || 0,
          pricingStrategy: 'competitive',
          negotiationAllowed: true,
        },
        verificationDocuments: {
          aadhaarCard: '',
          panCard: '',
          qualificationDocuments: [],
          portfolioPhotos: [],
        },
        verificationStatus: 'pending',
        stats: {
          totalStudents: 0,
          activeStudents: 0,
          completedClasses: 0,
          averageRating: 0,
          totalReviews: 0,
          totalEarnings: 0,
          leadUnlocks: 0,
          responseRate: 0,
          responseTime: '30 min',
        },
        preferences: {
          notifications: true,
          whatsappUpdates: true,
          emailUpdates: true,
          leadAlerts: true,
        },
        isActive: true,
        isVerified: false,
        isBlocked: false,
      });

      await teacherProfile.save();
      profileData = teacherProfile;
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
      },
      profile: profileData,
    });
  } catch (error: any) {
    console.error('Complete registration error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error.message,
    });
  }
};

// Signup with email, mobile, password
export const signup = async (req: Request, res: Response) => {
  try {
    const { role, fullName, mobileNumber, email, password } = req.body;

    // Validation
    if (!role || !fullName || !mobileNumber || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (!['parent', 'teacher'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Only parent and teacher roles can be created via signup.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber: mobileNumber }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or mobile number already exists',
      });
    }

    // Split full name into first and last
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      phoneNumber: mobileNumber,
      password,
      role,
      profile: {
        firstName,
        lastName,
      },
      profileCompleted: true,
      onboardingCompleted: false,
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create account',
    });
  }
};

// Check for duplicate account (email or mobile)
export const checkDuplicate = async (req: Request, res: Response) => {
  try {
    const { email, mobileNumber } = req.body;

    if (!email && !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Email or mobile number is required',
      });
    }

    const query: any = {};
    if (email) query.email = email.toLowerCase();
    if (mobileNumber) query.phoneNumber = mobileNumber;

    const existingUser = await User.findOne({
      $or: Object.keys(query).map((key) => ({ [key]: query[key] })),
    });

    return res.status(200).json({
      success: true,
      exists: !!existingUser,
      message: existingUser ? 'Account already exists' : 'Account available',
    });
  } catch (error: any) {
    console.error('Check duplicate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check account availability',
    });
  }
};
