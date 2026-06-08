import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Invoice } from '../models/Invoice';
import { streamInvoicePdf } from '../services/invoiceService';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoices
// Returns all invoices for the authenticated user (or all for admin).
// ─────────────────────────────────────────────────────────────────────────────
export const listInvoices = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const skip  = (page - 1) * limit;

    const filter: Record<string, any> =
      req.user.role === 'admin' ? {} : { userId: req.user._id };

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('paymentId', 'paymentId status totalAmount')
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('listInvoices error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list invoices.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoices/:id
// Returns a single invoice (owner or admin only).
// ─────────────────────────────────────────────────────────────────────────────
export const getInvoice = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const invoice = await Invoice.findById(req.params.id)
      .populate('paymentId', 'paymentId status totalAmount razorpayPaymentId')
      .lean();

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    if (
      req.user.role !== 'admin' &&
      invoice.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    console.error('getInvoice error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get invoice.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoices/:id/pdf
// Streams the invoice PDF. Regenerates if file is missing.
// ─────────────────────────────────────────────────────────────────────────────
export const downloadInvoicePdf = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    if (
      req.user.role !== 'admin' &&
      invoice.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await streamInvoicePdf(invoiceId, res);
    return;
  } catch (error) {
    console.error('downloadInvoicePdf error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
    }
    return;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoices/by-payment/:paymentId
// Returns the invoice associated with a specific payment.
// ─────────────────────────────────────────────────────────────────────────────
export const getInvoiceByPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const pid = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
    const invoice = await Invoice.findOne({
      paymentId: new mongoose.Types.ObjectId(pid),
    }).lean();

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    if (
      req.user.role !== 'admin' &&
      invoice.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    console.error('getInvoiceByPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get invoice.' });
  }
};
