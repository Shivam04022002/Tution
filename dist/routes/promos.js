"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const promoController_1 = require("../controllers/promoController");
const router = express_1.default.Router();
router.post('/validate', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent'), promoController_1.validatePromoCode);
exports.default = router;
//# sourceMappingURL=promos.js.map