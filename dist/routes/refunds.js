"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const refundController_1 = require("../controllers/refundController");
const router = express_1.default.Router();
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent'), refundController_1.requestRefund);
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent', 'admin'), refundController_1.listRefunds);
exports.default = router;
//# sourceMappingURL=refunds.js.map