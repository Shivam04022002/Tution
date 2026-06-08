"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoice = generateInvoice;
exports.generatePdf = generatePdf;
exports.streamInvoicePdf = streamInvoicePdf;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const Invoice_1 = require("../models/Invoice");
const User_1 = require("../models/User");
const gstService_1 = require("./gstService");
async function generateInvoice(input) {
    const user = await User_1.User.findById(input.userId).lean();
    if (!user)
        throw new Error('User not found for invoice generation');
    const amounts = (0, gstService_1.computeOrderAmounts)(input.baseAmount, input.promoDiscount);
    const invoiceNumber = Invoice_1.Invoice.generateNumber();
    const invoiceDoc = await Invoice_1.Invoice.create({
        invoiceNumber,
        invoiceDate: new Date(),
        paymentId: input.paymentId,
        userId: input.userId,
        leadUnlockId: input.leadUnlockId,
        promoCodeId: input.promoCodeId,
        buyer: {
            name: `${user.profile.firstName} ${user.profile.lastName}`.trim() || 'User',
            email: user.email,
            phone: user.phoneNumber,
        },
        items: [
            {
                description: input.description,
                hsn: '998313',
                quantity: 1,
                unitPrice: input.baseAmount,
                discount: amounts.promoDiscount,
                taxableAmount: amounts.taxableAmount,
                gstRate: amounts.gst.gstRate,
                cgst: amounts.gst.cgst,
                sgst: amounts.gst.sgst,
                igst: amounts.gst.igst,
                totalGst: amounts.gst.totalGst,
                total: amounts.gst.totalAmount,
            },
        ],
        subtotal: amounts.taxableAmount,
        promoDiscount: amounts.promoDiscount,
        gstTotal: amounts.gst.totalGst,
        grandTotal: amounts.gst.totalAmount,
        status: 'issued',
    });
    generatePdf(invoiceDoc).catch((err) => console.error(`PDF generation failed for ${invoiceNumber}:`, err));
    return invoiceDoc;
}
async function generatePdf(invoice) {
    const dir = path_1.default.join(process.cwd(), 'tmp', 'invoices');
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    const filePath = path_1.default.join(dir, `${invoice.invoiceNumber}.pdf`);
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ size: 'A4', margin: 50 });
        const stream = fs_1.default.createWriteStream(filePath);
        doc.pipe(stream);
        doc
            .fontSize(22)
            .font('Helvetica-Bold')
            .text(invoice.business.name, { align: 'center' })
            .fontSize(10)
            .font('Helvetica')
            .text(invoice.business.address, { align: 'center' })
            .text(`GSTIN: ${invoice.business.gstin}  |  ${invoice.business.email}`, { align: 'center' })
            .moveDown(0.5);
        doc
            .fontSize(16)
            .font('Helvetica-Bold')
            .text('TAX INVOICE', { align: 'center' })
            .moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
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
        const buyerY = metaY + 50;
        doc
            .font('Helvetica-Bold')
            .text('Bill To:', 50, buyerY)
            .font('Helvetica')
            .text(invoice.buyer.name, 50, buyerY + 14)
            .text(invoice.buyer.email, 50, buyerY + 27)
            .text(invoice.buyer.phone, 50, buyerY + 40);
        const tableTop = buyerY + 80;
        const cols = { desc: 50, qty: 250, unit: 290, disc: 340, taxable: 390, gst: 450, total: 490 };
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Description', cols.desc, tableTop);
        doc.text('Qty', cols.qty, tableTop);
        doc.text('Unit Price', cols.unit, tableTop);
        doc.text('Discount', cols.disc, tableTop);
        doc.text('Taxable', cols.taxable, tableTop);
        doc.text('GST', cols.gst, tableTop);
        doc.text('Total', cols.total, tableTop);
        doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke();
        doc.font('Helvetica').fontSize(9);
        let rowY = tableTop + 20;
        for (const item of invoice.items) {
            doc.text(item.description, cols.desc, rowY, { width: 190 });
            doc.text(String(item.quantity), cols.qty, rowY);
            doc.text((0, gstService_1.formatCurrency)(item.unitPrice), cols.unit, rowY);
            doc.text((0, gstService_1.formatCurrency)(item.discount), cols.disc, rowY);
            doc.text((0, gstService_1.formatCurrency)(item.taxableAmount), cols.taxable, rowY);
            doc.text(`${item.gstRate}%`, cols.gst, rowY);
            doc.text((0, gstService_1.formatCurrency)(item.total), cols.total, rowY);
            rowY += 20;
        }
        doc.moveTo(50, rowY).lineTo(545, rowY).stroke();
        rowY += 10;
        const gstItem = invoice.items[0];
        if (gstItem) {
            doc.font('Helvetica').fontSize(9);
            doc.text(`CGST @ ${gstItem.gstRate / 2}%:`, 380, rowY);
            doc.text((0, gstService_1.formatCurrency)(gstItem.cgst), cols.total, rowY);
            rowY += 14;
            doc.text(`SGST @ ${gstItem.gstRate / 2}%:`, 380, rowY);
            doc.text((0, gstService_1.formatCurrency)(gstItem.sgst), cols.total, rowY);
            rowY += 14;
        }
        doc.moveTo(330, rowY).lineTo(545, rowY).stroke();
        rowY += 8;
        doc.font('Helvetica-Bold').fontSize(10);
        if (invoice.promoDiscount > 0) {
            doc.text('Promo Discount:', 330, rowY);
            doc.text(`- ${(0, gstService_1.formatCurrency)(invoice.promoDiscount)}`, cols.total, rowY);
            rowY += 16;
        }
        doc.text('GST Total:', 330, rowY);
        doc.text((0, gstService_1.formatCurrency)(invoice.gstTotal), cols.total, rowY);
        rowY += 16;
        doc.fontSize(12).text('Grand Total:', 330, rowY);
        doc.text((0, gstService_1.formatCurrency)(invoice.grandTotal), cols.total, rowY);
        doc.moveDown(3).fontSize(8).font('Helvetica').fillColor('#888888')
            .text('This is a computer-generated invoice. No signature required.\n' +
            'Tuition Marketplace is an intermediary platform. GST applied as per applicable rates.', { align: 'center' });
        doc.end();
        stream.on('finish', async () => {
            await Invoice_1.Invoice.findByIdAndUpdate(invoice._id, {
                pdfPath: filePath,
                pdfGeneratedAt: new Date(),
            });
            resolve(filePath);
        });
        stream.on('error', reject);
    });
}
async function streamInvoicePdf(invoiceId, res) {
    const invoice = await Invoice_1.Invoice.findById(invoiceId);
    if (!invoice)
        throw new Error('Invoice not found');
    let filePath = invoice.pdfPath;
    if (!filePath || !fs_1.default.existsSync(filePath)) {
        filePath = await generatePdf(invoice);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    fs_1.default.createReadStream(filePath).pipe(res);
}
//# sourceMappingURL=invoiceService.js.map