"use strict";
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
const matchingCron_1 = require("./services/matchingCron");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL || "http://localhost:19006",
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
const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:19006",
    "http://localhost:19006",
    "http://localhost:5000",
    "http://10.0.2.2:5000",
    "http://10.149.172.60:5000",
    "http://192.168.1.100:5000",
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        }
        else {
            console.log(`⚠️ CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
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
app.use(errorHandler_1.errorHandler);
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';
const startServer = async () => {
    try {
        await (0, database_1.connectDatabase)();
        (0, matchingCron_1.startMatchingCron)();
        server.listen(PORT, HOST, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Environment: ${process.env.NODE_ENV}`);
            console.log(`🔗 Local API: http://localhost:${PORT}/api`);
            console.log(`🔗 Network API: http://0.0.0.0:${PORT}/api`);
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