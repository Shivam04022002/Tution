// ─────────────────────────────────────────────────────────────────────────────
// GST Service
// Centralised, configurable GST calculation.
// Default rate: 18% (configurable via GST_RATE_PERCENT env var).
// Indian GST split: CGST 9% + SGST 9% for intra-state,
//                   IGST 18% for inter-state.
// For simplicity, platform always applies CGST+SGST (intra-state).
// ─────────────────────────────────────────────────────────────────────────────

export interface GstBreakdown {
  baseAmount:    number;   // amount before GST
  gstRate:       number;   // e.g. 18
  cgst:          number;   // CGST portion
  sgst:          number;   // SGST portion
  igst:          number;   // IGST (0 for intra-state)
  totalGst:      number;   // cgst + sgst + igst
  totalAmount:   number;   // baseAmount + totalGst
}

export interface OrderAmounts {
  baseAmount:     number;  // original price (INR)
  promoDiscount:  number;  // flat discount after promo
  taxableAmount:  number;  // baseAmount - promoDiscount
  gst:            GstBreakdown;
  grandTotal:     number;  // taxableAmount + gst.totalGst
}

// ─────────────────────────────────────────────────────────────────────────────
// getGstRate — reads env, falls back to 18
// ─────────────────────────────────────────────────────────────────────────────
export function getGstRate(): number {
  const envRate = parseFloat(process.env.GST_RATE_PERCENT || '18');
  return isNaN(envRate) || envRate < 0 || envRate > 100 ? 18 : envRate;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateGst — compute GST on a taxable base amount
// ─────────────────────────────────────────────────────────────────────────────
export function calculateGst(taxableBase: number, ratePercent?: number): GstBreakdown {
  const rate      = ratePercent ?? getGstRate();
  const totalGst  = Math.round(taxableBase * rate) / 100;
  const half      = Math.round(totalGst / 2);
  const cgst      = half;
  const sgst      = totalGst - half;    // handles odd-paise rounding

  return {
    baseAmount:  taxableBase,
    gstRate:     rate,
    cgst,
    sgst,
    igst:        0,
    totalGst,
    totalAmount: taxableBase + totalGst,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeOrderAmounts
// Applies promo discount BEFORE GST, then computes final totals.
// ─────────────────────────────────────────────────────────────────────────────
export function computeOrderAmounts(
  baseAmount: number,
  promoDiscount = 0,
  gstRatePercent?: number,
): OrderAmounts {
  const discount      = Math.min(promoDiscount, baseAmount);
  const taxableAmount = baseAmount - discount;
  const gst           = calculateGst(taxableAmount, gstRatePercent);

  return {
    baseAmount,
    promoDiscount:  discount,
    taxableAmount,
    gst,
    grandTotal: taxableAmount + gst.totalGst,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// formatCurrency — INR formatting helper
// ─────────────────────────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}
