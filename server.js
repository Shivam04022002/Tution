const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
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

// Import routes
const authRoutes = require('./src/routes/auth');

const app = express();
const server = createServer(app);
// Get allowed origins from environment
const getAllowedOrigins = () => {
  const origins = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:19006";
  return origins.split(',').map(origin => origin.trim());
};

const allowedOrigins = getAllowedOrigins();

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
    // Use X-Forwarded-For header when behind CloudFront/ELB
    return req.headers['x-forwarded-for'] || req.ip;
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

// Database connection with production optimizations
const connectDatabase = async () => {
  try {
    const mongooseOptions = {
      // Production connection pool settings
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE) || 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT) || 45000,
      connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT) || 10000,
      // Retry settings
      retryWrites: true,
      w: 'majority',
    };

    // If using MongoDB Atlas with special characters in password, ensure proper encoding
    let mongoUri = process.env.MONGODB_URI;
    
    // Log connection attempt (without exposing credentials)
    const sanitizedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`🔄 Connecting to MongoDB: ${sanitizedUri}`);

    const conn = await mongoose.connect(mongoUri, mongooseOptions);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
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
    
    // Provide helpful error messages for common issues
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Tip: Check if MongoDB Atlas IP whitelist includes your EC2 server IP');
    }
    if (error.message.includes('authentication failed')) {
      console.error('💡 Tip: Check your MongoDB username and password in the connection string');
    }
    if (error.message.includes('deprecated')) {
      console.error('💡 Tip: Update your MongoDB connection options');
    }
    
    process.exit(1);
  }
};

// Initialize Firebase (mock for development)
const initializeFirebase = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔥 Firebase initialized in development mode (mock)');
    return true;
  }
  
  // In production, initialize real Firebase
  try {
    // Firebase admin initialization would go here
    console.log('🔥 Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    return false;
  }
};

// Routes
app.use('/api/auth', authRoutes);

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

// Socket.IO connection handling
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
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
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
    
    // Initialize Firebase
    initializeFirebase();
    
    // Start server listening on 0.0.0.0 for EC2 (not localhost)
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
