export interface RazorpayOrderResult {
    orderId: string;
    amount: number;
    amountInRupees: number;
    currency: string;
    receipt: string;
    keyId: string;
}
export interface RazorpayVerifyInput {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}
export interface RazorpayRefundResult {
    refundId: string;
    amount: number;
    status: string;
}
export declare function createOrder(amountInRupees: number, receipt: string, notes?: Record<string, string | number | null>): Promise<RazorpayOrderResult>;
export declare function verifyPayment(input: RazorpayVerifyInput): boolean;
export declare function verifyWebhookSignature(rawBody: string, signature: string): boolean;
export declare function createRefund(razorpayPaymentId: string, amountInRupees?: number, notes?: Record<string, string>): Promise<RazorpayRefundResult>;
export declare function fetchPayment(razorpayPaymentId: string): Promise<import("razorpay/dist/types/payments").Payments.RazorpayPayment>;
//# sourceMappingURL=razorpayService.d.ts.map