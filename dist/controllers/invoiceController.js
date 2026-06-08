"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoiceByPayment = exports.downloadInvoicePdf = exports.getInvoice = exports.listInvoices = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Invoice_1 = require("../models/Invoice");
const invoiceService_1 = require("../services/invoiceService");
const listInvoices = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;
        const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
        const [invoices, total] = await Promise.all([
            Invoice_1.Invoice.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('paymentId', 'paymentId status totalAmount')
                .lean(),
            Invoice_1.Invoice.countDocuments(filter),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                invoices,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            },
        });
    }
    catch (error) {
        console.error('listInvoices error:', error);
        return res.status(500).json({ success: false, message: 'Failed to list invoices.' });
    }
};
exports.listInvoices = listInvoices;
const getInvoice = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const invoice = await Invoice_1.Invoice.findById(req.params.id)
            .populate('paymentId', 'paymentId status totalAmount razorpayPaymentId')
            .lean();
        if (!invoice)
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        if (req.user.role !== 'admin' &&
            invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        return res.status(200).json({ success: true, data: invoice });
    }
    catch (error) {
        console.error('getInvoice error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get invoice.' });
    }
};
exports.getInvoice = getInvoice;
const downloadInvoicePdf = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const invoice = await Invoice_1.Invoice.findById(invoiceId).lean();
        if (!invoice)
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        if (req.user.role !== 'admin' &&
            invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        await (0, invoiceService_1.streamInvoicePdf)(invoiceId, res);
        return;
    }
    catch (error) {
        console.error('downloadInvoicePdf error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
        }
        return;
    }
};
exports.downloadInvoicePdf = downloadInvoicePdf;
const getInvoiceByPayment = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const pid = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
        const invoice = await Invoice_1.Invoice.findOne({
            paymentId: new mongoose_1.default.Types.ObjectId(pid),
        }).lean();
        if (!invoice)
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        if (req.user.role !== 'admin' &&
            invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        return res.status(200).json({ success: true, data: invoice });
    }
    catch (error) {
        console.error('getInvoiceByPayment error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get invoice.' });
    }
};
exports.getInvoiceByPayment = getInvoiceByPayment;
//# sourceMappingURL=invoiceController.js.map