import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { connectDatabase } from './config/database';
import { initializeFirebase } from './config/firebase';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { startMatchingCron } from './services/matchingCron';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
// Socket.IO Configuration - Allow multiple origins for mobile development
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "https://hometuitionapp.com",
      "https://hometuitionapp.com",
      "https://www.hometuitionapp.com",
      "http://localhost:19006",
      "http://localhost:5000",
      "http://10.0.2.2:5000",
      "http://10.149.172.60:5000", // Physical device LAN IP
      "http://192.168.1.100:5000",
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet());

// CORS Configuration - Environment-driven allowlist
const getAllowedOrigins = (): string[] => {
  const baseOrigins = [
    process.env.FRONTEND_URL || "https://hometuitionapp.com",
    "https://hometuitionapp.com",
    "https://www.hometuitionapp.com",
    "http://localhost:19006",
    "http://localhost:5000",
  ];
  
  // Add development-specific origins from environment if specified
  if (process.env.NODE_ENV === 'development') {
    const devOrigins = process.env.DEV_ORIGINS?.split(',').map(origin => origin.trim()) || [];
    const defaultDevOrigins = [
      "http://10.0.2.2:5000", // Android emulator
      "http://10.149.172.60:5000", // Physical device LAN IP
      "http://192.168.1.100:5000", // Common LAN range
    ];
    return [...baseOrigins, ...defaultDevOrigins, ...devOrigins];
  }
  
  // Production origins from environment
  if (process.env.NODE_ENV === 'production') {
    const prodOrigins = process.env.PROD_ORIGINS?.split(',').map(origin => origin.trim()) || [];
    return [...baseOrigins, ...prodOrigins];
  }
  
  return baseOrigins;
};

const allowedOrigins = getAllowedOrigins();
console.log('🌐 CORS Allowed Origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Firebase
initializeFirebase();

// Routes
app.use('/api', routes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('leave-room', (roomId: string) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0'; // Listen on all network interfaces

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Run automatic system bootstrap (admin & staff accounts)
    console.log('🔧 Running automatic system bootstrap...');
    const { bootstrapSystem } = await import('./scripts/bootstrapSystem');
    const bootstrapResult = await bootstrapSystem();
    
    if (bootstrapResult.success) {
      console.log('✅ System bootstrap completed successfully');
    } else {
      console.log('⚠️ System bootstrap completed with issues');
      console.log(`   Message: ${bootstrapResult.message}`);
    }
    
    // Start matching engine cron jobs
    startMatchingCron();

    // Listen on 0.0.0.0 to accept connections from any network interface
    // This is REQUIRED for physical devices to reach the backend
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Local API: http://localhost:${PORT}/api`);
      console.log(`🔗 Production API: https://hometuitionapp.com/api`);
      console.log(`📱 Mobile Dev URL: http://10.149.172.60:${PORT}/api`);
      console.log(`✅ Accepting connections from all network interfaces`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };
