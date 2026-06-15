import { Request, Response } from 'express';
import mongoose from 'mongoose';
import os from 'os';
import process from 'process';
import { AuthRequest } from '../middleware/auth';

// Service health status interface
interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: Date;
  message?: string;
}

/**
 * Health check controller for monitoring and observability
 * Provides various health endpoints for load balancers and monitoring tools
 */

/**
 * Basic health check - for load balancers
 * Returns 200 if server is running
 */
export const getHealth = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Database health check
 * Verifies MongoDB connection and provides connection stats
 */
export const getDatabaseHealth = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Check MongoDB connection state
    const readyState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    // Perform a simple query to verify connectivity
    let queryTime = 0;
    let documentCount = 0;
    
    try {
      const queryStart = Date.now();
      const db = mongoose.connection.db;
      if (db) {
        await db.admin().ping();
        queryTime = Date.now() - queryStart;
        
        // Get count of a collection as additional verification
        const usersCollection = mongoose.connection.db?.collection('users');
        if (usersCollection) {
          documentCount = await usersCollection.countDocuments();
        }
      }
    } catch (pingError: any) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        service: 'database',
        state: states[readyState] || 'unknown',
        message: 'Database ping failed',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const responseTime = Date.now() - startTime;
    
    // Determine health status based on response time
    let status: 'healthy' | 'degraded' = 'healthy';
    if (responseTime > 1000) {
      status = 'degraded';
    }

    res.status(200).json({
      success: true,
      status,
      service: 'database',
      state: states[readyState],
      responseTime,
      queryTime,
      documentCount,
      connection: {
        host: mongoose.connection.host || 'unknown',
        port: mongoose.connection.port || 0,
        name: mongoose.connection.name || 'unknown'
      },
      timestamp: new Date().toISOString()
    });
    return;
  } catch (error: any) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      service: 'database',
      message: error.message,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    return;
  }
};

/**
 * External services health check
 * Verifies Razorpay, Cloudinary, Firebase, etc.
 */
export const getServicesHealth = async (req: Request, res: Response) => {
  const services: ServiceHealth[] = [];

  // Check Razorpay configuration
  const razorpayStart = Date.now();
  services.push({
    name: 'razorpay',
    status: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'healthy' : 'unhealthy',
    responseTime: Date.now() - razorpayStart,
    lastChecked: new Date(),
    message: process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Missing configuration'
  });

  // Check Cloudinary configuration
  const cloudinaryStart = Date.now();
  services.push({
    name: 'cloudinary',
    status: process.env.CLOUDINARY_CLOUD_NAME && 
             process.env.CLOUDINARY_API_KEY && 
             process.env.CLOUDINARY_API_SECRET ? 'healthy' : 'unhealthy',
    responseTime: Date.now() - cloudinaryStart,
    lastChecked: new Date(),
    message: process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing configuration'
  });

  // Check Firebase configuration
  const firebaseStart = Date.now();
  services.push({
    name: 'firebase',
    status: process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY ? 'healthy' : 'degraded',
    responseTime: Date.now() - firebaseStart,
    lastChecked: new Date(),
    message: process.env.FIREBASE_PROJECT_ID ? 'Configured' : 'Missing configuration'
  });

  // Check Email configuration
  const emailStart = Date.now();
  services.push({
    name: 'email',
    status: process.env.EMAIL_HOST && process.env.EMAIL_USER ? 'healthy' : 'degraded',
    responseTime: Date.now() - emailStart,
    lastChecked: new Date(),
    message: process.env.EMAIL_HOST ? 'Configured' : 'Missing configuration'
  });

  // Check Google Maps API
  const mapsStart = Date.now();
  services.push({
    name: 'google_maps',
    status: process.env.GOOGLE_MAPS_API_KEY ? 'healthy' : 'degraded',
    responseTime: Date.now() - mapsStart,
    lastChecked: new Date(),
    message: process.env.GOOGLE_MAPS_API_KEY ? 'Configured' : 'Missing configuration'
  });

  const allHealthy = services.every(s => s.status === 'healthy');
  const anyUnhealthy = services.some(s => s.status === 'unhealthy');

  res.status(anyUnhealthy ? 503 : 200).json({
    success: allHealthy,
    status: anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
    services,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get system metrics
 * Provides CPU, memory, and process statistics
 */
export const getSystemMetrics = async (req: Request, res: Response) => {
  try {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate load average (1, 5, 15 minutes)
    const loadAvg = os.loadavg();

    // Process memory usage
    const processMemory = process.memoryUsage();

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime()
      },
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model,
        speed: cpus[0]?.speed,
        loadAverage: {
          '1min': loadAvg[0],
          '5min': loadAvg[1],
          '15min': loadAvg[2]
        }
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
        formatted: {
          total: formatBytes(totalMemory),
          free: formatBytes(freeMemory),
          used: formatBytes(usedMemory)
        }
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: processMemory.rss,
          heapTotal: processMemory.heapTotal,
          heapUsed: processMemory.heapUsed,
          external: processMemory.external,
          formatted: {
            rss: formatBytes(processMemory.rss),
            heapTotal: formatBytes(processMemory.heapTotal),
            heapUsed: formatBytes(processMemory.heapUsed)
          }
        },
        versions: process.versions
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system metrics',
      error: error.message
    });
  }
};

/**
 * Get version information
 * Returns application and dependency versions
 */
export const getVersion = async (req: Request, res: Response) => {
  try {
    // Read package.json
    const packageJson = require('../../package.json');

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      application: {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        author: packageJson.author
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nodeVersion: process.version,
        platform: process.platform
      },
      dependencies: {
        total: Object.keys(packageJson.dependencies || {}).length,
        key: {
          express: packageJson.dependencies?.express,
          mongoose: packageJson.dependencies?.mongoose,
          typescript: packageJson.dependencies?.typescript,
          jsonwebtoken: packageJson.dependencies?.jsonwebtoken,
          razorpay: packageJson.dependencies?.razorpay,
          cloudinary: packageJson.dependencies?.cloudinary
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get version info',
      error: error.message
    });
    return;
  }
};

/**
 * Admin monitoring dashboard data
 * Provides comprehensive metrics for admin dashboard
 */
export const getMonitoringDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    
    // Only allow admin and staff
    if (!user || !['admin', 'staff'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin/Staff only.'
      });
    }

    // Get real-time metrics
    const db = mongoose.connection.db;
    
    // Count documents in key collections
    const [
      userCount,
      teacherCount,
      parentCount,
      requirementCount,
      applicationCount,
      paymentCount,
      notificationCount,
      ticketCount
    ] = await Promise.all([
      db?.collection('users').countDocuments() || 0,
      db?.collection('teacherprofiles').countDocuments() || 0,
      db?.collection('users').countDocuments({ role: 'parent' }) || 0,
      db?.collection('parentrequirements').countDocuments() || 0,
      db?.collection('tutorapplications').countDocuments() || 0,
      db?.collection('payments').countDocuments({ status: 'completed' }) || 0,
      db?.collection('notifications').countDocuments() || 0,
      db?.collection('tickets').countDocuments() || 0
    ]);

    // Get recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      newUsers24h,
      newRequirements24h,
      newApplications24h,
      newPayments24h
    ] = await Promise.all([
      db?.collection('users').countDocuments({ createdAt: { $gte: last24Hours } }) || 0,
      db?.collection('parentrequirements').countDocuments({ createdAt: { $gte: last24Hours } }) || 0,
      db?.collection('tutorapplications').countDocuments({ createdAt: { $gte: last24Hours } }) || 0,
      db?.collection('payments').countDocuments({ createdAt: { $gte: last24Hours }, status: 'completed' }) || 0
    ]);

    // System health
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);
    
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadPercentage = Math.round((loadAvg / cpuCount) * 100);

    // Database stats
    const dbStats = await db?.stats();

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        users: {
          total: userCount,
          teachers: teacherCount,
          parents: parentCount,
          new24h: newUsers24h
        },
        activity: {
          requirements: requirementCount,
          requirements24h: newRequirements24h,
          applications: applicationCount,
          applications24h: newApplications24h,
          payments: paymentCount,
          payments24h: newPayments24h
        },
        system: {
          memoryUsage,
          loadPercentage,
          uptime: process.uptime()
        },
        database: {
          dataSize: formatBytes(dbStats?.dataSize || 0),
          indexSize: formatBytes(dbStats?.indexSize || 0),
          storageSize: formatBytes(dbStats?.storageSize || 0),
          collections: dbStats?.collections || 0
        },
        support: {
          totalTickets: ticketCount,
          notifications: notificationCount
        }
      }
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get monitoring dashboard data',
      error: error.message
    });
    return;
  }
};

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
