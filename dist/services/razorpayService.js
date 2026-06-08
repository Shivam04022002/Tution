"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.verifyPayment = verifyPayment;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.createRefund = createRefund;
exports.fetchPayment = fetchPayment;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
let _razorpay = null;
function getRazorpay() {
    if (!_razorpay) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret || keyId.includes('your-') || keySecret.includes('your-')) {
            throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
        }
        _razorpay = new razorpay_1.default({ key_id: keyId, key_secret: keySecret });
    }
    return _razorpay;
}
async function createOrder(amountInRupees, receipt, notes) {
    const instance = getRazorpay();
    const amountInPaise = Math.round(amountInRupees * 100);
    const order = await instance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt.substring(0, 40),
        notes: notes ?? {},
    });
    return {
        orderId: order.id,
        amount: Number(order.amount),
        amountInRupees,
        currency: order.currency,
        receipt: order.receipt ?? receipt,
        keyId: process.env.RAZORPAY_KEY_ID,
    };
}
function verifyPayment(input) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret)
        throw new Error('RAZORPAY_KEY_SECRET not configured');
    const body = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expected = crypto_1.default
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    if (expected !== input.razorpaySignature) {
        throw new Error('Payment signature verification failed. Possible tamper attempt.');
    }
    return true;
}
function verifyWebhookSignature(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret)
        throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
    const expected = crypto_1.default
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
    return expected === signature;
}
async function createRefund(razorpayPaymentId, amountInRupees, notes) {
    const instance = getRazorpay();
    const refundParams = { notes: notes ?? {} };
    if (amountInRupees !== undefined) {
        refundParams.amount = Math.round(amountInRupees * 100);
    }
    const refund = await instance.payments.refund(razorpayPaymentId, refundParams);
    return {
        refundId: refund.id,
        amount: Number(refund.amount),
        status: refund.status ?? 'pending',
    };
}
async function fetchPayment(razorpayPaymentId) {
    const instance = getRazorpay();
    return instance.payments.fetch(razorpayPaymentId);
}
//# sourceMappingURL=razorpayService.js.map