"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const shortlistController_1 = require("../controllers/shortlistController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), shortlistController_1.addToShortlist);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), shortlistController_1.removeFromShortlist);
router.get('/parent', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), shortlistController_1.getParentShortlists);
router.get('/teacher', auth_1.authenticate, (0, auth_1.authorize)('teacher'), shortlistController_1.getTeacherShortlists);
router.post('/:id/contacted', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), shortlistController_1.markShortlistContacted);
exports.default = router;
//# sourceMappingURL=shortlists.js.map