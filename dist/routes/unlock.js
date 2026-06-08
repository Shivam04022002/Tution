"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const unlockController_1 = require("../controllers/unlockController");
const router = express_1.default.Router();
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), (req, _res, next) => {
    req.rawBody = req.body.toString('utf8');
    try {
        req.body = JSON.parse(req.rawBody);
    }
    catch {
        req.body = {};
    }
    next();
}, unlockController_1.handleRazorpayWebhook);
router.post('/order', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent'), unlockController_1.createRazorpayOrder);
router.post('/verify', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent'), unlockController_1.verifyRazorpayPayment);
router.post('/teacher/:leadId', auth_1.authenticate, (0, auth_1.authorize)('teacher'), unlockController_1.unlockTeacherLead);
router.post('/parent/:teacherId', auth_1.authenticate, (0, auth_1.authorize)('parent'), unlockController_1.unlockTutorContact);
router.get('/history', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent', 'admin'), unlockController_1.getUnlockHistory);
router.post('/payment-intent', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent'), unlockController_1.createPaymentIntent);
exports.default = router;
//# sourceMappingURL=unlock.js.map