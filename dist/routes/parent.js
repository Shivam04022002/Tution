"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const parentController_1 = require("../controllers/parentController");
const applicationController_1 = require("../controllers/applicationController");
const auth_1 = require("../middleware/auth");
const parentValidation_1 = require("../middleware/parentValidation");
const router = express_1.default.Router();
router.get('/requirements', parentController_1.getAllRequirements);
router.get('/requirements/:id', parentController_1.getRequirementById);
router.post('/register', auth_1.authenticate, parentValidation_1.registerParentValidation, parentController_1.registerParent);
router.get('/profile/me', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.getParentProfile);
router.put('/profile', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentValidation_1.updateParentValidation, parentController_1.updateParentProfile);
router.get('/my-requirements', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.getMyRequirements);
router.delete('/requirements/:id', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.deleteRequirement);
router.post('/requirements/:id/close', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.closeRequirement);
router.post('/requirements/:id/extend', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.extendRequirement);
router.post('/requirements', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.createRequirement);
router.put('/requirements/:id', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.updateRequirement);
router.patch('/requirements/:id/status', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), parentController_1.updateRequirementStatus);
router.get('/requirements/:id/applications', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.getRequirementApplications);
router.post('/requirements/:id/close-hire', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), applicationController_1.closeRequirement);
exports.default = router;
//# sourceMappingURL=parent.js.map