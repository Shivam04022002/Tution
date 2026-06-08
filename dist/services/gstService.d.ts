export interface GstBreakdown {
    baseAmount: number;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    totalAmount: number;
}
export interface OrderAmounts {
    baseAmount: number;
    promoDiscount: number;
    taxableAmount: number;
    gst: GstBreakdown;
    grandTotal: number;
}
export declare function getGstRate(): number;
export declare function calculateGst(taxableBase: number, ratePercent?: number): GstBreakdown;
export declare function computeOrderAmounts(baseAmount: number, promoDiscount?: number, gstRatePercent?: number): OrderAmounts;
export declare function formatCurrency(amount: number): string;
//# sourceMappingURL=gstService.d.ts.map