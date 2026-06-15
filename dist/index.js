"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const database_1 = require("./config/database");
const firebase_1 = require("./config/firebase");
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const notFound_1 = require("./middleware/notFound");
const errorTracker_1 = require("./middleware/errorTracker");
const matchingCron_1 = require("./services/matchingCron");
dotenv_1.default.config();
process.on('unhandledRejection', errorTracker_1.handleUnhandledRejection);
process.on('uncaughtException', errorTracker_1.handleUncaughtException);
const app = (0, express_1.default)();
app.use(errorTracker_1.requestIdMiddleware);
app.use(errorTracker_1.requestLogger);
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL || "https://hometuitionapp.com",
            "https://hometuitionapp.com",
            "https://www.hometuitionapp.com",
            "http://localhost:19006",
            "http://localhost:5000",
            "http://10.0.2.2:5000",
            "http://10.149.172.60:5000",
            "http://192.168.1.100:5000",
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});
exports.io = io;
app.use((0, helmet_1.default)());
const getAllowedOrigins = () => {
    const baseOrigins = [
        process.env.FRONTEND_URL || "https://hometuitionapp.com",
        "https://hometuitionapp.com",
        "https://www.hometuitionapp.com",
        "http://localhost:19006",
        "http://localhost:5000",
    ];
    if (process.env.NODE_ENV === 'development') {
        const devOrigins = process.env.DEV_ORIGINS?.split(',').map(origin => origin.trim()) || [];
        const defaultDevOrigins = [
            "http://10.0.2.2:5000",
            "http://10.149.172.60:5000",
            "http://192.168.1.100:5000",
        ];
        return [...baseOrigins, ...defaultDevOrigins, ...devOrigins];
    }
    if (process.env.NODE_ENV === 'production') {
        const prodOrigins = process.env.PROD_ORIGINS?.split(',').map(origin => origin.trim()) || [];
        return [...baseOrigins, ...prodOrigins];
    }
    return baseOrigins;
};
const allowedOrigins = getAllowedOrigins();
console.log('🌐 CORS Allowed Origins:', allowedOrigins);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.log(`⚠️ CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/api/', limiter);
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
(0, firebase_1.initializeFirebase)();
app.use('/api', routes_1.default);
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});
app.use(notFound_1.notFound);
app.use(errorTracker_1.errorTracker);
app.use(errorHandler_1.errorHandler);
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';
const startServer = async () => {
    try {
        await (0, database_1.connectDatabase)();
        console.log('🔧 Running automatic system bootstrap...');
        const { bootstrapSystem } = await Promise.resolve().then(() => __importStar(require('./scripts/bootstrapSystem')));
        const bootstrapResult = await bootstrapSystem();
        if (bootstrapResult.success) {
            console.log('✅ System bootstrap completed successfully');
        }
        else {
            console.log('⚠️ System bootstrap completed with issues');
            console.log(`   Message: ${bootstrapResult.message}`);
        }
        (0, matchingCron_1.startMatchingCron)();
        server.listen(PORT, HOST, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Environment: ${process.env.NODE_ENV}`);
            console.log(`🔗 Local API: http://localhost:${PORT}/api`);
            console.log(`🔗 Production API: https://hometuitionapp.com/api`);
            console.log(`📱 Mobile Dev URL: http://10.149.172.60:${PORT}/api`);
            console.log(`✅ Accepting connections from all network interfaces`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=index.js.map