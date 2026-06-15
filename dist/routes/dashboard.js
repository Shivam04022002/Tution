"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dashboardController_1 = require("../controllers/dashboardController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/parent', auth_1.authenticate, (0, auth_1.authorize)('parent'), dashboardController_1.getParentDashboard);
router.get('/teacher', auth_1.authenticate, (0, auth_1.authorize)('teacher'), dashboardController_1.getTeacherDashboard);
router.get('/parent/stats', auth_1.authenticate, (0, auth_1.authorize)('parent'), dashboardController_1.getParentQuickStats);
exports.default = router;
//# sourceMappingURL=dashboard.js.map