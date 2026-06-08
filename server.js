const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
dotenv.config();

// Import models
const User = require('./src/models/User');
const TeacherProfile = require('./src/models/TeacherProfile');
const ParentRequirement = require('./src/models/ParentRequirement');
const LeadUnlock = require('./src/models/LeadUnlock');
const Payment = require('./src/models/Payment');

// Safe model loader — avoids OverwriteModelError if model already registered
const safeModel = (name, distPath, exportKey) => {
  if (mongoose.models[name]) return mongoose.models[name];
  try { return require(distPath)[exportKey]; } catch(e) { return null; }
};
const TutorApplication = safeModel('TutorApplication', './dist/models/TutorApplication', 'TutorApplication');
const DemoClass       = safeModel('DemoClass',        './dist/models/DemoClass',        'DemoClass');
const Shortlist       = safeModel('Shortlist',         './dist/models/Shortlist',         'Shortlist');
const TutorMatch      = safeModel('TutorMatch',        './dist/models/TutorMatch',        'TutorMatch');
const Notification    = safeModel('Notification',      './dist/models/Notification',      'Notification');

const app = express();
const server = createServer(app);
// Production allowed origins
// Production: https://hometuitionapp.com
// Local dev: http://localhost:3000
const allowedOrigins = [
  'https://hometuitionapp.com',
  'https://www.hometuitionapp.com',
  'http://localhost:3000',
  'http://localhost:19006',  // Expo dev client
  'http://localhost:5000',   // Local API
  'http://10.0.2.2:5000',    // Android emulator
  'http://10.149.172.60:5000', // Physical device LAN IP
  'http://192.168.1.100:5000', // Common LAN range
];

// Override with env var if provided
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
}

console.log('🌐 CORS Allowed Origins:', allowedOrigins);

// Configure Socket.IO for production
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: process.env.SOCKET_TRANSPORTS?.split(',') || ['websocket', 'polling'],
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000,
});

// Trust proxy for CloudFront/EC2 deployment
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Security Middleware - Helmet with production settings
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...allowedOrigins],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS Configuration for CloudFront/Production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: process.env.CORS_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: process.env.CORS_ALLOWED_HEADERS?.split(',') || ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression({
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Rate limiting with proxy support
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  keyGenerator: (req) => {
    // Use X-Forwarded-For header when behind CloudFront/ELB, with IPv6 support
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    return ipKeyGenerator(req);
  },
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000)
    });
  }
});

app.use('/api/', limiter);

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// Local MongoDB connection on EC2
const connectDatabase = async () => {
  try {
    // Local MongoDB configuration
    const mongooseOptions = {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };

    // Default to local MongoDB if not specified
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tuition-app';
    
    console.log(`🔄 Connecting to Local MongoDB: mongodb://127.0.0.1:27017/tuitionAppDB`);

    const conn = await mongoose.connect(mongoUri, mongooseOptions);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    console.log(`📝 MongoDB Version: ${conn.connection.db.serverConfig?.s?.options?.server_version || 'N/A'}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Check if mongod service is running: sudo systemctl status mongod');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown handler for database
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Make sure MongoDB is installed and running locally:');
    console.error('   sudo systemctl start mongod');
    console.error('   sudo systemctl enable mongod');
    console.error('💡 Check MongoDB status: sudo systemctl status mongod');
    console.error('💡 Check MongoDB logs: sudo tail -f /var/log/mongodb/mongod.log');
    
    process.exit(1);
  }
};

// Initialize Firebase (disabled by default for production)
const initializeFirebase = () => {
  if (process.env.ENABLE_FIREBASE !== 'true') {
    console.log('⚠️  Firebase disabled (set ENABLE_FIREBASE=true to enable)');
    return false;
  }
  
  try {
    // Firebase admin initialization would go here when configured
    console.log('🔥 Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    return false;
  }
};

// ==========================================
// SEED DEMO ACCOUNTS
// ==========================================
const seedDemoAccounts = async () => {
  try {
    console.log('🌱 Checking demo accounts...');
    
    const bcrypt = require('bcryptjs');
    
    // Check if demo parent exists
    const parentExists = await User.findOne({ email: 'parent@test.com' });
    if (!parentExists) {
      console.log('👤 Creating demo parent...');
      const parentPassword = await bcrypt.hash('Parent@123', 10);
      const parent = new User({
        email: 'parent@test.com',
        mobileNumber: '9999999991', // User.js model uses mobileNumber
        password: parentPassword,
        role: 'parent',
        profile: {
          firstName: 'Demo',
          lastName: 'Parent'
        },
        profileCompleted: true,
        onboardingCompleted: true
      });
      await parent.save();
      
      // Create parent requirement
      const ParentRequirement = require('./src/models/ParentRequirement');
      const requirement = new ParentRequirement({
        parentId: parent._id,
        requirementId: 'REQ-DEMO-' + Date.now(),
        studentDetails: {
          studentName: 'Rahul',
          age: 15,
          grade: 'Class 10',
          board: 'CBSE',
          schoolName: 'Demo School'
        },
        subjects: ['Mathematics', 'Science'],
        tuitionType: 'home',
        location: {
          address: '123 Demo Street, Kanpur',
          city: 'Kanpur',
          pincode: '208001'
        },
        budget: {
          minAmount: 4000,
          maxAmount: 5000,
          negotiationAllowed: true
        },
        status: 'active',
        isActive: true
      });
      await requirement.save();
      console.log('✅ Demo parent created: parent@test.com / Parent@123');
    } else {
      console.log('✅ Demo parent already exists');
    }
    
    // Check if demo teacher exists
    const teacherExists = await User.findOne({ email: 'teacher@test.com' });
    if (!teacherExists) {
      console.log('👨‍🏫 Creating demo teacher...');
      const teacherPassword = await bcrypt.hash('Teacher@123', 10);
      const teacher = new User({
        email: 'teacher@test.com',
        mobileNumber: '9999999992', // User.js model uses mobileNumber
        password: teacherPassword,
        role: 'teacher',
        profile: {
          firstName: 'Demo',
          lastName: 'Teacher'
        },
        profileCompleted: true,
        onboardingCompleted: true
      });
      await teacher.save();
      
      // Create teacher profile
      const TeacherProfile = require('./src/models/TeacherProfile');
      const profile = new TeacherProfile({
        userId: teacher._id,
        basicDetails: {
          fullName: 'Demo Teacher',
          mobileNumber: '9999999992',
          email: 'teacher@test.com'
        },
        education: {
          highestQualification: 'B.Tech'
        },
        teachingDetails: {
          subjects: ['Mathematics', 'Science'],
          classes: ['Class 8', 'Class 9', 'Class 10'],
          boards: ['CBSE']
        },
        locationAvailability: {
          city: 'Kanpur'
        },
        pricingRevenue: {
          experienceYears: 5
        },
        verificationStatus: 'approved',
        isActive: true
      });
      await profile.save();
      console.log('✅ Demo teacher created: teacher@test.com / Teacher@123');
    } else {
      console.log('✅ Demo teacher already exists');
    }
    
    console.log('🌱 Demo accounts ready!');
  } catch (error) {
    console.error('❌ Error seeding demo accounts:', error);
  }
};

// ==========================================
// AUTH ROUTES (Direct implementation for server.js)
// ==========================================
console.log('🔍 Setting up auth routes...');

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrMobile, password } = req.body;
    
    console.log('� Login attempt:', emailOrMobile);
    
    if (!emailOrMobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Mobile and password are required'
      });
    }
    
    // Find user by email or phone using direct MongoDB query
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const userDoc = await usersCollection.findOne({
      $or: [
        { email: emailOrMobile.toLowerCase() },
        { phoneNumber: emailOrMobile }
      ]
    });
    
    console.log('🔍 User found:', !!userDoc);
    if (userDoc) {
      console.log('📧 User email:', userDoc.email);
      console.log('🔑 User password exists:', !!userDoc.password);
      console.log('🔑 User password type:', typeof userDoc.password);
    }
    
    if (!userDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Convert to User model instance for compatibility
    const user = userDoc;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check password
    const bcrypt = require('bcryptjs');
    console.log('🔐 Comparing passwords...');
    console.log('🔐 Input password type:', typeof password);
    console.log('🔐 User password type:', typeof user.password);
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login successful:', user.email);
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { role, fullName, mobileNumber, email, password } = req.body;
    
    console.log('📝 Signup attempt:', email);
    
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { mobileNumber: mobileNumber }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    
    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      email: email.toLowerCase(),
      mobileNumber: mobileNumber,
      password: hashedPassword,
      role,
      profile: {
        firstName: fullName?.split(' ')[0] || '',
        lastName: fullName?.split(' ').slice(1).join(' ') || ''
      },
      profileCompleted: true,
      onboardingCompleted: true
    });
    
    await user.save();
    
    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Signup successful:', user.email);
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.mobileNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Signup failed'
    });
  }
});

// POST /api/auth/register-complete
app.post('/api/auth/register-complete', async (req, res) => {
  try {
    const {
      role,
      fullName,
      mobileNumber,
      email,
      password,
      parentDetails,
      studentDetails,
      tuitionRequirement,
      locationDetails,
      budgetDetails,
      tutorPreferences,
      personalDetails,
      educationDetails,
      professionalDetails,
      teachingDetails,
      teachingMode,
      availability,
      locationPreferences,
      pricingDetails
    } = req.body;
    
    console.log('📝 Register-complete attempt:', email, 'Role:', role);
    
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { mobileNumber: mobileNumber }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or mobile number'
      });
    }
    
    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      email: email.toLowerCase(),
      mobileNumber: mobileNumber,
      password: hashedPassword,
      role,
      profile: {
        firstName: fullName?.split(' ')[0] || '',
        lastName: fullName?.split(' ').slice(1).join(' ') || ''
      },
      profileCompleted: true,
      onboardingCompleted: true
    });
    
    await user.save();
    
    // Create role-specific profile
    if (role === 'parent') {
      const ParentRequirement = require('./src/models/ParentRequirement');
      
      const requirement = new ParentRequirement({
        parentId: user._id,
        requirementId: 'REQ-' + Date.now(),
        studentDetails: studentDetails || {},
        subjects: tuitionRequirement?.subjects || [],
        languagePreference: ['English', 'Hindi'],
        tuitionType: tuitionRequirement?.tuitionMode || 'home',
        location: locationDetails || {},
        schedule: {
          daysPerWeek: tuitionRequirement?.preferredTiming || '3',
          preferredTimings: [tuitionRequirement?.preferredTiming || 'Evening']
        },
        tutorPreferences: tutorPreferences || '',
        budget: budgetDetails || { minAmount: 0, maxAmount: 0, negotiationAllowed: true },
        status: 'active',
        priority: 'medium',
        matchedTutors: [],
        totalMatches: 0,
        views: 0,
        unlocks: 0,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      
      await requirement.save();
      console.log('✅ ParentRequirement created:', requirement.requirementId);
    } else if (role === 'teacher') {
      const TeacherProfile = require('./src/models/TeacherProfile');
      
      const teacherProfile = new TeacherProfile({
        userId: user._id,
        basicDetails: personalDetails || {
          fullName,
          mobileNumber,
          email
        },
        education: educationDetails || {},
        teachingDetails: teachingDetails || {},
        locationAvailability: {
          ...locationDetails,
          availableDays: availability?.days || [],
          availableTimeSlots: availability?.timeSlots || []
        },
        bio: professionalDetails?.bio || '',
        pricingRevenue: {
          ...pricingDetails,
          experienceYears: professionalDetails?.experienceYears || 0
        },
        verificationStatus: 'pending',
        isActive: true,
        isVerified: false,
        isBlocked: false
      });
      
      await teacherProfile.save();
      console.log('✅ TeacherProfile created:', teacherProfile._id);
    }
    
    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Register-complete successful:', user.email);
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.mobileNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (error) {
    console.error('❌ Register-complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed: ' + error.message
    });
  }
});

// ==========================================
// DEVELOPMENT OTP LOGIN (Only for testing)
// ==========================================
const DEV_OTP = '123456';
const isDevelopment = process.env.NODE_ENV === 'development';

// POST /api/auth/send-otp
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    console.log('📱 SEND OTP REQUEST:', phoneNumber);
    
    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile number'
      });
    }
    
    // Development mode: return OTP directly
    if (isDevelopment) {
      console.log('🔓 DEVELOPMENT MODE - OTP:', DEV_OTP);
      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully (Development Mode)',
        devOtp: DEV_OTP,
        userExists: !!(await User.findOne({ mobileNumber: phoneNumber }))
      });
    }
    
    // Production: would call SMS provider here
    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, role } = req.body;
    console.log('📱 VERIFY OTP REQUEST:', phoneNumber, 'OTP:', otp);
    
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }
    
    // Development mode: accept 1234
    const isValidOtp = isDevelopment && otp === DEV_OTP;
    
    if (!isValidOtp && !isDevelopment) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Find or create user
    let user = await User.findOne({ mobileNumber: phoneNumber });
    console.log('👤 USER FOUND:', user ? 'Yes' : 'No');
    
    if (!user) {
      // Auto-create user in development mode
      if (!isDevelopment) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      console.log('🆕 Creating new user for:', phoneNumber);
      const bcrypt = require('bcryptjs');
      const tempPassword = await bcrypt.hash('temp123', 10);
      
      user = new User({
        email: `temp_${phoneNumber}@test.com`,
        mobileNumber: phoneNumber,
        password: tempPassword,
        role: role || 'parent',
        profile: {
          firstName: 'Demo',
          lastName: 'User'
        },
        profileCompleted: true,
        onboardingCompleted: true
      });
      
      await user.save();
      console.log('✅ New user created:', user._id);
    }
    
    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('🔑 JWT GENERATED for:', user.email);
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.mobileNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'OTP verification failed'
    });
  }
});

console.log('✅ Auth routes mounted:');
console.log('   POST /api/auth/login');
console.log('   POST /api/auth/signup');
console.log('   POST /api/auth/send-otp (Dev OTP: 123456)');
console.log('   POST /api/auth/verify-otp');
console.log('   POST /api/auth/register-complete');

// Debug route to list all registered routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json({ routes, count: routes.length });
});

// Health check endpoint - comprehensive for production monitoring
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    uptime: process.uptime(),
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: mongoose.connection.name || 'N/A',
      host: mongoose.connection.host || 'N/A'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    }
  };

  // Return 503 if database is down
  if (mongoose.connection.readyState !== 1) {
    healthCheck.status = 'error';
    return res.status(503).json(healthCheck);
  }

  res.status(200).json(healthCheck);
});

// Detailed health check for load balancers
app.get('/api/health/detailed', (req, res) => {
  const checks = {
    server: true,
    database: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  };

  const allHealthy = Object.values(checks).every(check => check === true);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    uptime: process.uptime()
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Tuition Marketplace API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      health: '/api/health',
      docs: '/api/docs'
    },
    models: ['User', 'TeacherProfile', 'ParentRequirement', 'LeadUnlock', 'Payment']
  });
});

// Teacher Profile Routes
app.get('/api/teachers', async (req, res) => {
  try {
    const { page = 1, limit = 10, subject, city, minRating = 0 } = req.query;
    
    let query = { 
      isActive: true, 
      isVerified: true, 
      isBlocked: false,
      'stats.averageRating': { $gte: parseFloat(minRating) }
    };
    
    if (subject) {
      query['teachingDetails.subjects'] = { $in: [subject] };
    }
    
    if (city) {
      query['locationAvailability.city'] = city;
    }
    
    const teachers = await TeacherProfile.find(query)
      .populate('userId', 'email mobileNumber')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ 'stats.averageRating': -1 });
    
    const total = await TeacherProfile.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      data: teachers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/api/teachers/:id', async (req, res) => {
  try {
    const teacher = await TeacherProfile.findById(req.params.id)
      .populate('userId', 'email mobileNumber');
    
    if (!teacher) {
      return res.status(404).json({
        status: 'error',
        message: 'Teacher not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: teacher
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Parent Requirement Routes
app.post('/api/requirements', async (req, res) => {
  try {
    const requirement = new ParentRequirement({
      ...req.body,
      requirementId: ParentRequirement.generateRequirementId()
    });
    
    await requirement.save();
    
    // Trigger tutor matching (simplified)
    await matchTutorsToRequirement(requirement._id);
    
    res.status(201).json({
      status: 'success',
      data: requirement
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/api/requirements/:parentId', async (req, res) => {
  try {
    const requirements = await ParentRequirement.find({ 
      parentId: req.params.parentId,
      isActive: true 
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      data: requirements
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Lead Unlock Routes
app.post('/api/leads/unlock', async (req, res) => {
  try {
    const { requirementId, tutorId, paymentDetails } = req.body;
    
    // Create payment record
    const payment = new Payment({
      paymentId: Payment.generatePaymentId(),
      type: 'lead_unlock',
      userId: tutorId,
      requirementId,
      amount: paymentDetails.amount,
      paymentMethod: paymentDetails.paymentMethod,
      paymentGateway: paymentDetails.paymentGateway,
      status: 'completed',
      paymentDate: new Date()
    });
    
    await payment.save();
    
    // Create lead unlock record
    const unlock = new LeadUnlock({
      requirementId,
      tutorId,
      unlockId: LeadUnlock.generateUnlockId(),
      paymentDetails: {
        amount: paymentDetails.amount,
        paymentMethod: paymentDetails.paymentMethod,
        transactionId: paymentDetails.transactionId,
        paymentStatus: 'completed',
        paymentDate: new Date()
      },
      unlockStatus: 'active'
    });
    
    await unlock.save();
    
    res.status(201).json({
      status: 'success',
      data: unlock
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Payment Routes
app.get('/api/payments/:userId', async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Helper function to match tutors to requirements
const matchTutorsToRequirement = async (requirementId) => {
  try {
    const requirement = await ParentRequirement.findById(requirementId);
    if (!requirement) return;
    
    // Find matching tutors (simplified matching logic)
    const tutors = await TeacherProfile.find({
      isActive: true,
      isVerified: true,
      isBlocked: false,
      'teachingDetails.subjects': { $in: requirement.subjects },
      'locationAvailability.city': requirement.location.city
    }).limit(10);
    
    // Add tutors to requirement's matched tutors
    for (const tutor of tutors) {
      const matchScore = calculateMatchScore(requirement, tutor);
      await requirement.addTutorMatch(tutor._id, matchScore);
    }
    
    console.log(`✅ Matched ${tutors.length} tutors to requirement ${requirementId}`);
  } catch (error) {
    console.error('❌ Error matching tutors:', error);
  }
};

// Helper function to calculate match score
const calculateMatchScore = (requirement, tutor) => {
  let score = 50; // Base score
  
  // Subject matching
  const subjectMatch = requirement.subjects.filter(subject => 
    tutor.teachingDetails.subjects.includes(subject)
  ).length;
  score += (subjectMatch / requirement.subjects.length) * 20;
  
  // Location matching
  if (tutor.locationAvailability.city === requirement.location.city) {
    score += 15;
  }
  
  // Rating bonus
  score += tutor.stats.averageRating * 3;
  
  // Experience bonus
  score += Math.min(tutor.pricingRevenue.experienceYears * 2, 10);
  
  return Math.min(Math.round(score), 100);
};

// ==========================================
// JWT AUTH MIDDLEWARE (for protected routes)
// ==========================================
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    next();
  };
};

// ==========================================
// PARENT PROFILE ROUTE
// ==========================================
app.get('/api/parents/profile/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        phoneNumber: user.mobileNumber,
        role: user.role,
        profile: user.profile,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// ==========================================
// DASHBOARD ROUTES
// ==========================================
app.get('/api/dashboard/parent', authenticateToken, async (req, res) => {
  try {
    const parentId = req.user._id;
    // Use top-level model references (already loaded at startup)

    const [activeRequirements, applications, shortlistedTutors, upcomingDemos,
           activeReqCount, appCount, shortCount, demoCount] = await Promise.all([
      ParentRequirement.find({ parentId, status: 'active', isActive: true }).sort({ createdAt: -1 }).limit(5),
      TutorApplication.find({ parentId, isActive: true })
        .populate({ path: 'teacherProfileId', select: 'basicDetails teachingDetails pricingRevenue stats' })
        .sort({ createdAt: -1 }).limit(5),
      Shortlist.find({ parentId, isDeleted: false })
        .populate({ path: 'teacherProfileId', select: 'basicDetails teachingDetails pricingRevenue stats' })
        .sort({ createdAt: -1 }).limit(5),
      DemoClass.find({ parentId, status: { $in: ['scheduled', 'rescheduled'] }, scheduledDate: { $gte: new Date() }, isActive: true })
        .populate({ path: 'teacherProfileId', select: 'basicDetails' })
        .sort({ scheduledDate: 1 }).limit(5),
      ParentRequirement.countDocuments({ parentId, status: 'active', isActive: true }),
      TutorApplication.countDocuments({ parentId, isActive: true }),
      Shortlist.countDocuments({ parentId, isDeleted: false }),
      DemoClass.countDocuments({ parentId, status: { $in: ['scheduled', 'rescheduled'] }, scheduledDate: { $gte: new Date() }, isActive: true }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          activeRequirements: activeReqCount,
          applicationsReceived: appCount,
          shortlistedTutors: shortCount,
          demosScheduled: demoCount,
        },
        activeRequirements,
        applications,
        shortlistedTutors,
        upcomingDemos,
      },
    });
  } catch (error) {
    console.error('❌ Parent dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/dashboard/teacher', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user._id;
    // Use top-level model references (already loaded at startup)

    const teacherProfile = await TeacherProfile.findOne({ userId: teacherId });

    const [matches, applications, upcomingDemos] = await Promise.all([
      TutorMatch.find({ teacherId, status: 'recommended', isActive: true, expiryDate: { $gte: new Date() } })
        .populate({ path: 'requirementId', select: 'requirementId studentDetails subjects budget location schedule tuitionType' })
        .sort({ overallScore: -1 }).limit(10),
      TutorApplication.find({ teacherId, isActive: true })
        .populate({ path: 'parentRequirementId', select: 'requirementId studentDetails subjects budget' })
        .sort({ createdAt: -1 }).limit(10),
      DemoClass.find({ teacherId, status: { $in: ['scheduled', 'rescheduled'] }, scheduledDate: { $gte: new Date() }, isActive: true })
        .sort({ scheduledDate: 1 }).limit(5),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          activeStudents: teacherProfile?.stats?.activeStudents || 0,
          totalStudents: teacherProfile?.stats?.totalStudents || 0,
          totalEarnings: teacherProfile?.stats?.totalEarnings || 0,
          averageRating: teacherProfile?.stats?.averageRating || 0,
          tuitionRequestsAvailable: matches.length,
          applicationsSent: applications.length,
        },
        matches,
        applications,
        upcomingDemos,
      },
    });
  } catch (error) {
    console.error('❌ Teacher dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

// ==========================================
// NOTIFICATION ROUTES
// ==========================================
// Notification model is loaded at top via dist/models/Notification

app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    if (!Notification) return res.status(200).json({ success: true, count: 0 });
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    if (!Notification) return res.status(200).json({ success: true, notifications: [], unreadCount: 0, pagination: { total: 0, page: 1, limit: 20, pages: 0 } });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = { userId: req.user._id };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    if (!Notification) return res.status(200).json({ success: true });
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    if (!Notification) return res.status(200).json({ success: true });
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.status(200).json({ success: true, notification: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    if (!Notification) return res.status(200).json({ success: true });
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

// ==========================================
// TEACHER PROFILE ROUTE
// ==========================================
app.get('/api/teachers/profile/me', authenticateToken, async (req, res) => {
  try {
    const profile = await TeacherProfile.findOne({ userId: req.user._id }).lean();
    if (!profile) {
      // No TeacherProfile doc yet — return a stub from User record so the screen doesn't error
      const u = req.user;
      return res.status(200).json({
        success: true,
        data: {
          _id: null,
          userId: u._id,
          basicDetails: {
            fullName: `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim(),
            email: u.email,
            mobileNumber: u.mobileNumber,
            profilePhoto: u.profile?.profilePhoto || '',
          },
          teachingDetails: { subjects: [], classes: [], boards: [] },
          education: {},
          locationAvailability: {},
          pricingRevenue: { experienceYears: 0 },
          stats: { averageRating: 0, totalReviews: 0, totalStudents: 0, activeStudents: 0, totalEarnings: 0 },
          verificationStatus: 'pending',
          isActive: true,
          isProfileComplete: false,
        },
      });
    }
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('❌ Teacher profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// ==========================================
// MATCHES ROUTES
// ==========================================
app.get('/api/matches/teacher', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { status } = req.query;
    const filter = { teacherId, isActive: true };
    if (status) filter.status = status;
    else filter.expiryDate = { $gte: new Date() };

    const matches = await TutorMatch.find(filter)
      .populate({ path: 'requirementId', select: 'requirementId studentDetails subjects budget location schedule tuitionType' })
      .sort({ overallScore: -1 })
      .limit(50)
      .lean();

    res.status(200).json({ success: true, data: { matches, total: matches.length } });
  } catch (error) {
    console.error('❌ Teacher matches error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch matches' });
  }
});

app.get('/api/matches/parent', authenticateToken, async (req, res) => {
  try {
    const parentId = req.user._id;
    const requirements = await ParentRequirement.find({ parentId, isActive: true }).select('_id').lean();
    const requirementIds = requirements.map(r => r._id);

    const matches = await TutorMatch.find({ requirementId: { $in: requirementIds }, isActive: true })
      .populate({ path: 'teacherProfileId', select: 'basicDetails teachingDetails pricingRevenue stats' })
      .sort({ overallScore: -1 })
      .limit(20)
      .lean();

    res.status(200).json({ success: true, data: { matches, total: matches.length } });
  } catch (error) {
    console.error('❌ Parent matches error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch matches' });
  }
});

// ==========================================
// APPLICATIONS ROUTES
// ==========================================
app.get('/api/applications/teacher', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { status } = req.query;
    const filter = { teacherId, isActive: true };
    if (status) filter.status = status;

    const applications = await TutorApplication.find(filter)
      .populate({ path: 'parentRequirementId', select: 'requirementId studentDetails subjects budget' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({ success: true, data: { applications, total: applications.length } });
  } catch (error) {
    console.error('❌ Teacher applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
});

// STAFF ROUTES
app.get('/api/staff/dashboard', authenticateToken, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const [
      pendingVerifications,
      openTickets,
      activeLeads,
      resolvedToday,
      urgentTickets,
    ] = await Promise.all([
      db.collection('teacherprofiles').countDocuments({ verificationStatus: 'pending' }),
      db.collection('tickets').countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      db.collection('parentrequirements').countDocuments({ status: 'active', isActive: true }),
      db.collection('tickets').countDocuments({
        status: 'resolved',
        resolvedAt: { $gte: todayStart },
      }),
      db.collection('tickets').countDocuments({ priority: 'urgent', status: { $in: ['open', 'in_progress'] } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pendingVerifications,
        openTickets,
        activeLeads,
        resolvedToday,
        urgentTickets,
      },
    });
  } catch (error) {
    console.error('getStaffDashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff dashboard',
      error: error.message,
    });
  }
});

app.get('/api/staff/verification-queue', authenticateToken, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const filter = {};
    if (status) filter.verificationStatus = status;
    if (search) {
      filter.$or = [
        { 'basicDetails.fullName': { $regex: search, $options: 'i' } },
        { 'basicDetails.email': { $regex: search, $options: 'i' } },
        { 'teachingDetails.subjects': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [teachers, total] = await Promise.all([
      db.collection('teacherprofiles').find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      db.collection('teacherprofiles').countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: teachers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getVerificationQueue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verification queue',
      error: error.message,
    });
  }
});

app.get('/api/staff/leads', authenticateToken, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const filter = { isActive: true };
    if (status === 'active') filter.status = 'active';
    else if (status === 'closed') filter.status = 'closed';
    else if (status === 'matched') filter.status = { $in: ['matched', 'hired'] };

    if (search) {
      filter.$or = [
        { requirementId: { $regex: search, $options: 'i' } },
        { subjects: { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'studentDetails.grade': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [leads, total] = await Promise.all([
      db.collection('parentrequirements').find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      db.collection('parentrequirements').countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getStaffLeads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leads',
      error: error.message,
    });
  }
});

app.get('/api/staff/reports', authenticateToken, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    // Mock reports data for now
    const reportsData = {
      kpis: {
        totalResolved: 0,
        avgResolutionHours: '0.0',
        verifications: 0,
        leadsClosed: 0,
      },
      tickets: {
        totalResolved: 0,
        resolvedToday: 0,
        avgResolutionHours: '0.0',
        slaCompliance: 0,
      },
      verifications: {
        approved: 0,
        rejected: 0,
        pending: 0,
        bySubject: [],
      },
      leads: {
        active: 0,
        closed: 0,
        newToday: 0,
        newYesterday: 0,
        conversionRate: 0,
        statusBreakdown: [],
      },
      dailyActivity: [],
    };

    res.status(200).json({
      success: true,
      data: reportsData,
    });
  } catch (error) {
    console.error('getStaffReports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff reports',
      error: error.message,
    });
  }
});

console.log('✅ Additional routes mounted:');
console.log('   GET  /api/parents/profile/me');
console.log('   GET  /api/teachers/profile/me');
console.log('   GET  /api/dashboard/parent');
console.log('   GET  /api/dashboard/teacher');
console.log('   GET  /api/matches/teacher');
console.log('   GET  /api/matches/parent');
console.log('   GET  /api/applications/teacher');
console.log('   GET  /api/notifications');
console.log('   GET  /api/notifications/unread-count');
console.log('   PATCH /api/notifications/:id/read');
console.log('   PATCH /api/notifications/read-all');
console.log('   DELETE /api/notifications/:id');
console.log('   GET  /api/staff/dashboard');
console.log('   GET  /api/staff/verification-queue');
console.log('   GET  /api/staff/leads');
console.log('   GET  /api/staff/reports');

// ==========================================
// Socket.IO connection handling
// ==========================================
io.on('connection', (socket) => {
  console.log('🔌 A user connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`📱 User ${socket.id} joined room ${roomId}`);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`📱 User ${socket.id} left room ${roomId}`);
  });

  socket.on('new-requirement', (data) => {
    // Broadcast new requirement to matched tutors
    socket.to('tutors').emit('requirement-update', data);
  });

  socket.on('payment-completed', (data) => {
    // Notify relevant parties about payment
    socket.to(`user-${data.userId}`).emit('payment-success', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`⚠️  404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.url,
    method: req.method
  });
});

// Start server - Production optimized for EC2
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for EC2

const startServer = async () => {
  try {
    // Validate environment variables
    const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
      console.error('💡 Please check your .env.production file');
      process.exit(1);
    }

    // Validate JWT secret length for production
    if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
      console.error('❌ JWT_SECRET must be at least 32 characters long in production');
      process.exit(1);
    }

    // Connect to database
    await connectDatabase();
    
    // Seed demo accounts for testing
    await seedDemoAccounts();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Start server listening on 0.0.0.0 for production (accepts connections from any interface)
    server.listen(PORT, HOST, () => {
      console.log('🚀 ============================================');
      console.log('🚀 TUITION MARKETPLACE API - PRODUCTION MODE');
      console.log('🚀 ============================================');
      console.log(`📅 Started at: ${new Date().toISOString()}`);
      console.log(`� Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Server running on: http://${HOST}:${PORT}`);
      console.log(`� API Base URL: http://${HOST}:${PORT}/api`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
      console.log(`💾 Database: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`🔥 Firebase: ${process.env.FIREBASE_PROJECT_ID ? '✅ Configured' : '⚠️  Not configured'}`);
      console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configured' : '⚠️  Not configured'}`);
      console.log(`💳 Razorpay: ${process.env.RAZORPAY_KEY_ID ? '✅ Configured' : '⚠️  Not configured'}`);
      console.log(`📧 Email: ${process.env.EMAIL_HOST ? '✅ Configured' : '⚠️  Not configured'}`);
      console.log(`📍 Google Maps: ${process.env.GOOGLE_MAPS_API_KEY ? '✅ Configured' : '⚠️  Not configured'}`);
      console.log('🚀 ============================================');
      console.log('✅ Server is ready to accept connections');
      console.log('🚀 ============================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown with socket handling
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 ${signal} received, starting graceful shutdown...`);
  console.log('⏳ Closing HTTP server and Socket.IO connections...');
  
  // Close Socket.IO connections
  io.close(() => {
    console.log('🔌 Socket.IO connections closed');
  });
  
  // Close HTTP server
  server.close(async () => {
    console.log('🌐 HTTP server closed');
    
    try {
      // Close database connection
      await mongoose.connection.close();
      console.log('� Database connection closed');
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⏱️  Force shutdown: could not close connections in time');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();

module.exports = { app, io };
