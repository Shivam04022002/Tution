"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("./auth"));
const teacher_1 = __importDefault(require("./teacher"));
const parent_1 = __importDefault(require("./parent"));
const applications_1 = __importDefault(require("./applications"));
const matches_1 = __importDefault(require("./matches"));
const demoClasses_1 = __importDefault(require("./demoClasses"));
const shortlists_1 = __importDefault(require("./shortlists"));
const dashboard_1 = __importDefault(require("./dashboard"));
const admin_1 = __importDefault(require("./admin"));
const unlock_1 = __importDefault(require("./unlock"));
const invoices_1 = __importDefault(require("./invoices"));
const refunds_1 = __importDefault(require("./refunds"));
const promos_1 = __importDefault(require("./promos"));
const notifications_1 = __importDefault(require("./notifications"));
const location_1 = __importDefault(require("./location"));
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
router.use('/teachers', teacher_1.default);
router.use('/parents', parent_1.default);
router.use('/applications', applications_1.default);
router.use('/matches', matches_1.default);
router.use('/demos', demoClasses_1.default);
router.use('/shortlists', shortlists_1.default);
router.use('/dashboard', dashboard_1.default);
router.use('/admin', admin_1.default);
router.use('/unlock', unlock_1.default);
router.use('/invoices', invoices_1.default);
router.use('/refunds', refunds_1.default);
router.use('/promos', promos_1.default);
router.use('/notifications', notifications_1.default);
router.use('/location', location_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map