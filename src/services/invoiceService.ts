import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { Invoice, IInvoice } from '../models/Invoice';
import { Payment, IPayment } from '../models/Payment';
import { User } from '../models/User';
import { computeOrderAmounts, formatCurrency } from './gstService';

// ─────────────────────────────────────────────────────────────────────────────
// Invoice generation input
// ─────────────────────────────────────────────────────────────────────────────
export interface InvoiceInput {
  paymentId:     mongoose.Types.ObjectId;
  userId:        mongoose.Types.ObjectId;
  leadUnlockId?: mongoose.Types.ObjectId;
  promoCodeId?:  mongoose.Types.ObjectId;
  promoCode?:    string;
  promoDiscount: number;          // flat INR already applied
  baseAmount:    number;          // price before discount + GST
  description:   string;          // line item description
  paymentType:   'unlock_lead' | 'unlock_tutor' | string;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateInvoice
// Creates an Invoice document and generates PDF.
// Called after payment.status === 'completed'.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateInvoice(input: InvoiceInput): Promise<IInvoice> {
  const user = await User.findById(input.userId).lean();
  if (!user) throw new Error('User not found for invoice generation');

  const amounts = computeOrderAmounts(input.baseAmount, input.promoDiscount);

  const invoiceNumber = (Invoice as any).generateNumber();

  const invoiceDoc = await Invoice.create({
    invoiceNumber,
    invoiceDate: new Date(),
    paymentId:    input.paymentId,
    userId:       input.userId,
    leadUnlockId: input.leadUnlockId,
    promoCodeId:  input.promoCodeId,

    buyer: {
      name:  `${user.profile.firstName} ${user.profile.lastName}`.trim() || 'User',
      email: user.email,
      phone: user.phoneNumber,
    },

    items: [
      {
        description:   input.description,
        hsn:           '998313',
        quantity:      1,
        unitPrice:     input.baseAmount,
        discount:      amounts.promoDiscount,
        taxableAmount: amounts.taxableAmount,
        gstRate:       amounts.gst.gstRate,
        cgst:          amounts.gst.cgst,
        sgst:          amounts.gst.sgst,
        igst:          amounts.gst.igst,
        totalGst:      amounts.gst.totalGst,
        total:         amounts.gst.totalAmount,
      },
    ],

    subtotal:      amounts.taxableAmount,
    promoDiscount: amounts.promoDiscount,
    gstTotal:      amounts.gst.totalGst,
    grandTotal:    amounts.gst.totalAmount,
    status:        'issued',
  });

  // Generate PDF asynchronously (non-blocking)
  generatePdf(invoiceDoc).catch((err) =>
    console.error(`PDF generation failed for ${invoiceNumber}:`, err),
  );

  return invoiceDoc;
}

// ─────────────────────────────────────────────────────────────────────────────
// generatePdf
// Creates a PDF using pdfkit and saves to /tmp/invoices/<invoiceNumber>.pdf.
// Updates invoiceDoc with pdfPath + pdfGeneratedAt.
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePdf(invoice: IInvoice): Promise<string> {
  const dir = path.join(process.cwd(), 'tmp', 'invoices');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${invoice.invoiceNumber}.pdf`);

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(invoice.business.name, { align: 'center' })
      .fontSize(10)
      .font('Helvetica')
      .text(invoice.business.address, { align: 'center' })
      .text(`GSTIN: ${invoice.business.gstin}  |  ${invoice.business.email}`, { align: 'center' })
      .moveDown(0.5);

    // ── Title ────────────────────────────────────────────────────────────────
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('TAX INVOICE', { align: 'center' })
      .moveDown(0.5);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);

    // ── Invoice Meta ─────────────────────────────────────────────────────────
    const metaY = doc.y;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice Number:', 50, metaY)
      .font('Helvetica')
      .text(invoice.invoiceNumber, 160, metaY);

    doc
      .font('Helvetica-Bold')
      .text('Invoice Date:', 50, metaY + 16)
      .font('Helvetica')
      .text(invoice.invoiceDate.toLocaleDateString('en-IN'), 160, metaY + 16);

    // ── Buyer ────────────────────────────────────────────────────────────────
    const buyerY = metaY + 50;
    doc
      .font('Helvetica-Bold')
      .text('Bill To:', 50, buyerY)
      .font('Helvetica')
      .text(invoice.buyer.name, 50, buyerY + 14)
      .text(invoice.buyer.email, 50, buyerY + 27)
      .text(invoice.buyer.phone, 50, buyerY + 40);

    // ── Items Table ──────────────────────────────────────────────────────────
    const tableTop = buyerY + 80;
    const cols = { desc: 50, qty: 250, unit: 290, disc: 340, taxable: 390, gst: 450, total: 490 };

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Description',      cols.desc,    tableTop);
    doc.text('Qty',              cols.qty,     tableTop);
    doc.text('Unit Price',       cols.unit,    tableTop);
    doc.text('Discount',         cols.disc,    tableTop);
    doc.text('Taxable',          cols.taxable, tableTop);
    doc.text('GST',              cols.gst,     tableTop);
    doc.text('Total',            cols.total,   tableTop);

    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke();

    doc.font('Helvetica').fontSize(9);
    let rowY = tableTop + 20;

    for (const item of invoice.items) {
      doc.text(item.description,             cols.desc,    rowY, { width: 190 });
      doc.text(String(item.quantity),        cols.qty,     rowY);
      doc.text(formatCurrency(item.unitPrice), cols.unit,  rowY);
      doc.text(formatCurrency(item.discount),  cols.disc,  rowY);
      doc.text(formatCurrency(item.taxableAmount), cols.taxable, rowY);
      doc.text(`${item.gstRate}%`,           cols.gst,     rowY);
      doc.text(formatCurrency(item.total),   cols.total,   rowY);
      rowY += 20;
    }

    doc.moveTo(50, rowY).lineTo(545, rowY).stroke();
    rowY += 10;

    // ── GST Breakdown ────────────────────────────────────────────────────────
    const gstItem = invoice.items[0];
    if (gstItem) {
      doc.font('Helvetica').fontSize(9);
      doc.text(`CGST @ ${gstItem.gstRate / 2}%:`, 380, rowY);
      doc.text(formatCurrency(gstItem.cgst), cols.total, rowY);
      rowY += 14;
      doc.text(`SGST @ ${gstItem.gstRate / 2}%:`, 380, rowY);
      doc.text(formatCurrency(gstItem.sgst), cols.total, rowY);
      rowY += 14;
    }

    // ── Totals ───────────────────────────────────────────────────────────────
    doc.moveTo(330, rowY).lineTo(545, rowY).stroke();
    rowY += 8;

    doc.font('Helvetica-Bold').fontSize(10);
    if (invoice.promoDiscount > 0) {
      doc.text('Promo Discount:', 330, rowY);
      doc.text(`- ${formatCurrency(invoice.promoDiscount)}`, cols.total, rowY);
      rowY += 16;
    }
    doc.text('GST Total:', 330, rowY);
    doc.text(formatCurrency(invoice.gstTotal), cols.total, rowY);
    rowY += 16;

    doc.fontSize(12).text('Grand Total:', 330, rowY);
    doc.text(formatCurrency(invoice.grandTotal), cols.total, rowY);

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.moveDown(3).fontSize(8).font('Helvetica').fillColor('#888888')
      .text(
        'This is a computer-generated invoice. No signature required.\n' +
        'Tuition Marketplace is an intermediary platform. GST applied as per applicable rates.',
        { align: 'center' },
      );

    doc.end();

    stream.on('finish', async () => {
      await Invoice.findByIdAndUpdate(invoice._id, {
        pdfPath:        filePath,
        pdfGeneratedAt: new Date(),
      });
      resolve(filePath);
    });
    stream.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// streamInvoicePdf
// Pipes the PDF to an Express response. Triggers on-demand regeneration if
// file is missing.
// ─────────────────────────────────────────────────────────────────────────────
export async function streamInvoicePdf(
  invoiceId: string,
  res: import('express').Response,
): Promise<void> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  let filePath = invoice.pdfPath;

  if (!filePath || !fs.existsSync(filePath)) {
    filePath = await generatePdf(invoice);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.invoiceNumber}.pdf"`,
  );
  fs.createReadStream(filePath).pipe(res);
}
