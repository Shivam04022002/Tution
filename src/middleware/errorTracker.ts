import { Request, Response, NextFunction } from 'express';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Extended error interface with tracking properties
 */
export interface TrackedError extends Error {
  errorId?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  statusCode?: number;
  isOperational?: boolean;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
}

/**
 * Generate unique error ID
 */
export const generateErrorId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ERR-${timestamp}-${random}`;
};

/**
 * Classify error into category and severity
 */
export const classifyError = (error: Error): { category: ErrorCategory; severity: ErrorSeverity } => {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Validation errors
  if (name.includes('validation') || message.includes('validation') || message.includes('invalid')) {
    return { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW };
  }

  // Authentication errors
  if (name.includes('authentication') || message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
    return { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.MEDIUM };
  }

  // Authorization errors
  if (message.includes('permission') || message.includes('forbidden') || message.includes('access denied')) {
    return { category: ErrorCategory.AUTHORIZATION, severity: ErrorSeverity.MEDIUM };
  }

  // Database errors
  if (name.includes('mongo') || name.includes('mongoose') || message.includes('database') || message.includes('collection')) {
    return { category: ErrorCategory.DATABASE, severity: ErrorSeverity.HIGH };
  }

  // External service errors
  if (message.includes('razorpay') || message.includes('cloudinary') || message.includes('firebase') || message.includes('twilio')) {
    return { category: ErrorCategory.EXTERNAL_SERVICE, severity: ErrorSeverity.HIGH };
  }

  // System errors
  if (name.includes('syntax') || name.includes('reference') || name.includes('type')) {
    return { category: ErrorCategory.SYSTEM, severity: ErrorSeverity.CRITICAL };
  }

  return { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.MEDIUM };
};

/**
 * Async error wrapper for controllers
 * Automatically catches errors and forwards to error handler
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Enhanced error tracking middleware
 * Adds error IDs, classification, and logging
 */
export const errorTracker = (
  err: TrackedError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate error ID if not present
  const errorId = err.errorId || generateErrorId();
  err.errorId = errorId;

  // Classify error
  const { category, severity } = classifyError(err);
  err.category = category;
  err.severity = severity;

  // Determine status code
  let statusCode = err.statusCode || 500;
  
  if (err.name === 'ValidationError') statusCode = 400;
  if (err.name === 'CastError') statusCode = 400;
  if (err.name === 'JsonWebTokenError') statusCode = 401;
  if (err.name === 'TokenExpiredError') statusCode = 401;
  if (err.name === 'MongoError' && (err as any).code === 11000) statusCode = 409;

  err.statusCode = statusCode;

  // Add request context
  err.context = {
    path: req.path,
    method: req.method,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  };

  // Add user info if available
  const authReq = req as any;
  if (authReq.user) {
    err.userId = authReq.user._id?.toString();
  }

  // Log error with structured data
  const logData = {
    errorId,
    category,
    severity,
    statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    context: err.context,
    userId: err.userId
  };

  // Log based on severity
  if (severity === ErrorSeverity.CRITICAL) {
    console.error('🚨 CRITICAL ERROR:', logData);
  } else if (severity === ErrorSeverity.HIGH) {
    console.error('⚠️ HIGH SEVERITY ERROR:', logData);
  } else if (severity === ErrorSeverity.MEDIUM) {
    console.warn('⚡ MEDIUM SEVERITY ERROR:', logData);
  } else {
    console.log('ℹ️ LOW SEVERITY ERROR:', logData);
  }

  // Note: Critical errors are logged to console with structured data
  // Audit log integration can be added here with proper admin context

  // Send response with error ID
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errorId,
    category,
    severity: process.env.NODE_ENV === 'development' ? severity : undefined,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Unhandled promise rejection handler
 */
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  console.error('🚨 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);

  const errorId = generateErrorId();
  
  // Log to console only - audit system integration available with proper admin context

  // In production, don't crash the process
  if (process.env.NODE_ENV === 'production') {
    console.error(`Error ID: ${errorId} - Process continuing despite unhandled rejection`);
  }
};

/**
 * Uncaught exception handler
 */
export const handleUncaughtException = (error: Error) => {
  console.error('🚨 Uncaught Exception:', error);

  const errorId = generateErrorId();
  const { category, severity } = classifyError(error);

  // Log to console only - audit system integration available with proper admin context

  // In production, graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    console.error(`Critical error ${errorId} - Initiating graceful shutdown...`);
    
    // Give time for logs to be written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
};

/**
 * Request ID middleware
 * Adds unique request ID for tracing
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.get('X-Request-ID') || generateErrorId();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * Request logging middleware
 * Logs all requests for audit trail
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    };

    // Log slow requests
    if (duration > 1000) {
      console.warn('🐌 Slow Request:', logData);
    } else if (res.statusCode >= 400) {
      console.warn('❌ Error Response:', logData);
    } else {
      console.log('✅ Request:', logData);
    }
  });

  next();
};
