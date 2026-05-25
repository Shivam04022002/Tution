"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("./auth"));
const router = express_1.default.Router();
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Tuition Marketplace API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
});
router.use('/auth', auth_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map