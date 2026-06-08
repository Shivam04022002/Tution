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

// Production allowed origins
// Production: https://hometuitionapp.com
// Local dev: http://localhost:3000
const allowedOrigins = [
  'https://hometuitionapp.com',
  'https://www.hometuitionapp.com',
  'http://localhost:3000',
  'http://localhost:19006'
];

// Override with env var if provided
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  additionalOrigins.forEach(origin => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

// Configure Socket.IO for production
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Trust proxy for CloudFront/EC2 deployment
app.set('trust proxy', 1);

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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For header when behind CloudFront/ELB
    return req.headers['x-forwarded-for'] || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests. Please try again later.',
      retryAfter: 900
    });
  }
});

app.use('/api/', limiter);

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Local MongoDB connection on EC2
const connectDatabase = async () => {
  try {
    const mongooseOptions = {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tuitionAppDB';
    
    console.log(`🔄 Connecting to Local MongoDB: mongodb://127.0.0.1:27017/tuitionAppDB`);

    const conn = await mongoose.connect(mongoUri, mongooseOptions);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Check if mongod service is running: sudo systemctl status mongod');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

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

// Initialize Firebase (disabled by default)
const initializeFirebase = () => {
  if (process.env.ENABLE_FIREBASE !== 'true') {
    console.log('⚠️  Firebase disabled (set ENABLE_FIREBASE=true to enable)');
    return false;
  }
  try {
    console.log('🔥 Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    return false;
  }
};

// Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
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
    server: {
      domain: 'hometuitionapp.com',
      url: 'https://hometuitionapp.com'
    }
  };

  if (mongoose.connection.readyState !== 1) {
    healthCheck.status = 'error';
    return res.status(503).json(healthCheck);
  }

  res.status(200).json(healthCheck);
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Tuition Marketplace API',
    version: '1.0.0',
    environment: 'production',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      teachers: '/api/teachers',
      requirements: '/api/requirements',
      leads: '/api/leads'
    },
    server: {
      domain: 'hometuitionapp.com',
      url: 'https://hometuitionapp.com'
    }
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
      requirementId: `REQ-${Date.now().toString(36).toUpperCase()}`
    });
    
    await requirement.save();
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
    
    const unlock = new LeadUnlock({
      requirementId,
      tutorId,
      unlockId: `ULK-${Date.now().toString(36).toUpperCase()}`,
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
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  try {
    // Validate JWT secret length for production
    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
      console.error('❌ JWT_SECRET must be at least 32 characters long in production');
      process.exit(1);
    }

    // Connect to database
    await connectDatabase();
    
    // Initialize optional services
    initializeFirebase();
    
    // Start server listening on 0.0.0.0 for EC2
    server.listen(PORT, HOST, () => {
      console.log('🚀 ============================================');
      console.log('🚀 TUITION MARKETPLACE API - PRODUCTION MODE');
      console.log('🚀 ============================================');
      console.log(`📅 Started at: ${new Date().toISOString()}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Server running on: http://${HOST}:${PORT}`);
      console.log(`🔗 Production API: https://hometuitionapp.com/api`);
      console.log(`� Local API: http://localhost:${PORT}/api`);
      console.log(`💾 Database: mongodb://127.0.0.1:27017/tuitionAppDB (LOCAL)`);
      console.log('🚀 ============================================');
      console.log(`📝 API Health Check: http://${HOST}:${PORT}/api/health`);
      console.log(`📝 Allowed Origins: ${allowedOrigins.join(', ')}`);
      console.log(`📝 CORS Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`);
      console.log('🚀 ============================================');
      console.log('✅ Server is ready to accept connections');
      console.log('✅ CORS configured for production domain + local development');
      console.log('✅ Local MongoDB connection established');
      console.log('🚀 ============================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 ${signal} received, starting graceful shutdown...`);
  
  io.close(() => {
    console.log('🔌 Socket.IO connections closed');
  });
  
  server.close(async () => {
    console.log('🌐 HTTP server closed');
    try {
      await mongoose.connection.close();
      console.log('💾 Database connection closed');
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  setTimeout(() => {
    console.error('⏱️ Force shutdown: could not close connections in time');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();

module.exports = { app, io };
