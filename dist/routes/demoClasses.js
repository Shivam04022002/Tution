"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const demoClassController_1 = require("../controllers/demoClassController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/schedule', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), demoClassController_1.scheduleDemo);
router.get('/parent', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), demoClassController_1.getParentDemos);
router.get('/teacher', auth_1.authenticate, (0, auth_1.authorize)('teacher'), demoClassController_1.getTeacherDemos);
router.put('/:demoId/reschedule', auth_1.authenticate, (0, auth_1.authorize)('parent', 'teacher', 'admin'), demoClassController_1.rescheduleDemo);
router.put('/:demoId/cancel', auth_1.authenticate, (0, auth_1.authorize)('parent', 'teacher', 'admin'), demoClassController_1.cancelDemo);
router.put('/:demoId/complete', auth_1.authenticate, (0, auth_1.authorize)('parent', 'teacher', 'admin'), demoClassController_1.completeDemo);
exports.default = router;
//# sourceMappingURL=demoClasses.js.map