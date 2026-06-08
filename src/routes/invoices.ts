import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listInvoices,
  getInvoice,
  downloadInvoicePdf,
  getInvoiceByPayment,
} from '../controllers/invoiceController';

const router = express.Router();

// GET  /api/invoices                       — list (own or all for admin)
router.get('/', authenticate, authorize('teacher', 'parent', 'admin'), listInvoices);

// GET  /api/invoices/by-payment/:paymentId — lookup by payment
router.get('/by-payment/:paymentId', authenticate, authorize('teacher', 'parent', 'admin'), getInvoiceByPayment);

// GET  /api/invoices/:id                   — single invoice
router.get('/:id', authenticate, authorize('teacher', 'parent', 'admin'), getInvoice);

// GET  /api/invoices/:id/pdf               — download PDF
router.get('/:id/pdf', authenticate, authorize('teacher', 'parent', 'admin'), downloadInvoicePdf);

export default router;
