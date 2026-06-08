"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGstRate = getGstRate;
exports.calculateGst = calculateGst;
exports.computeOrderAmounts = computeOrderAmounts;
exports.formatCurrency = formatCurrency;
function getGstRate() {
    const envRate = parseFloat(process.env.GST_RATE_PERCENT || '18');
    return isNaN(envRate) || envRate < 0 || envRate > 100 ? 18 : envRate;
}
function calculateGst(taxableBase, ratePercent) {
    const rate = ratePercent ?? getGstRate();
    const totalGst = Math.round(taxableBase * rate) / 100;
    const half = Math.round(totalGst / 2);
    const cgst = half;
    const sgst = totalGst - half;
    return {
        baseAmount: taxableBase,
        gstRate: rate,
        cgst,
        sgst,
        igst: 0,
        totalGst,
        totalAmount: taxableBase + totalGst,
    };
}
function computeOrderAmounts(baseAmount, promoDiscount = 0, gstRatePercent) {
    const discount = Math.min(promoDiscount, baseAmount);
    const taxableAmount = baseAmount - discount;
    const gst = calculateGst(taxableAmount, gstRatePercent);
    return {
        baseAmount,
        promoDiscount: discount,
        taxableAmount,
        gst,
        grandTotal: taxableAmount + gst.totalGst,
    };
}
function formatCurrency(amount) {
    return `₹${amount.toFixed(2)}`;
}
//# sourceMappingURL=gstService.js.map