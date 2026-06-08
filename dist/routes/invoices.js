"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const invoiceController_1 = require("../controllers/invoiceController");
const router = express_1.default.Router();
router.get('/', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent', 'admin'), invoiceController_1.listInvoices);
router.get('/by-payment/:paymentId', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent', 'admin'), invoiceController_1.getInvoiceByPayment);
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent', 'admin'), invoiceController_1.getInvoice);
router.get('/:id/pdf', auth_1.authenticate, (0, auth_1.authorize)('teacher', 'parent', 'admin'), invoiceController_1.downloadInvoicePdf);
exports.default = router;
//# sourceMappingURL=invoices.js.map