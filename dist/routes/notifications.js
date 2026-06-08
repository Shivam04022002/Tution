"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const notificationController_1 = require("../controllers/notificationController");
const router = express_1.default.Router();
router.get('/unread-count', auth_1.authenticate, notificationController_1.getUnreadCount);
router.get('/', auth_1.authenticate, notificationController_1.listNotifications);
router.patch('/read-all', auth_1.authenticate, notificationController_1.markAllAsRead);
router.patch('/:id/read', auth_1.authenticate, notificationController_1.markAsRead);
router.delete('/', auth_1.authenticate, (0, auth_1.authorize)('admin'), notificationController_1.bulkDeleteOld);
router.delete('/:id', auth_1.authenticate, notificationController_1.deleteNotification);
exports.default = router;
//# sourceMappingURL=notifications.js.map