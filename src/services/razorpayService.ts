import Razorpay from 'razorpay';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Razorpay instance
// Keys come from env; if not set, instance creation will fail at call-time.
// ─────────────────────────────────────────────────────────────────────────────
let _razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes('your-') || keySecret.includes('your-')) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }

    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface RazorpayOrderResult {
  orderId: string;        // Razorpay order_id  (order_XXXX)
  amount: number;         // in paise
  amountInRupees: number; // convenience
  currency: string;
  receipt: string;
  keyId: string;          // returned to frontend for checkout
}

export interface RazorpayVerifyInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface RazorpayRefundResult {
  refundId: string;
  amount: number;       // in paise
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// createOrder
// Creates a Razorpay order. Amount is in INR (rupees), converted to paise.
// receipt = internal reference (paymentId or unlockId).
// ─────────────────────────────────────────────────────────────────────────────
export async function createOrder(
  amountInRupees: number,
  receipt: string,
  notes?: Record<string, string | number | null>,
): Promise<RazorpayOrderResult> {
  const instance = getRazorpay();
  const amountInPaise = Math.round(amountInRupees * 100);

  const order = await instance.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: receipt.substring(0, 40), // Razorpay receipt max 40 chars
    notes: notes ?? {},
  });

  return {
    orderId: order.id,
    amount: Number(order.amount),
    amountInRupees,
    currency: order.currency,
    receipt: order.receipt ?? receipt,
    keyId: process.env.RAZORPAY_KEY_ID as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyPayment
// HMAC-SHA256 signature check per Razorpay docs:
// signature = HMAC(key_secret, "orderId|paymentId")
// Returns true if valid, throws on invalid signature.
// ─────────────────────────────────────────────────────────────────────────────
export function verifyPayment(input: RazorpayVerifyInput): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET not configured');

  const body = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (expected !== input.razorpaySignature) {
    throw new Error('Payment signature verification failed. Possible tamper attempt.');
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyWebhookSignature
// Used in the /webhook endpoint to validate Razorpay webhook payloads.
// X-Razorpay-Signature header must match HMAC(webhook_secret, rawBody).
// ─────────────────────────────────────────────────────────────────────────────
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return expected === signature;
}

// ─────────────────────────────────────────────────────────────────────────────
// createRefund
// Issues a full or partial refund on a captured Razorpay payment.
// amount is in INR rupees; omit for full refund.
// ─────────────────────────────────────────────────────────────────────────────
export async function createRefund(
  razorpayPaymentId: string,
  amountInRupees?: number,
  notes?: Record<string, string>,
): Promise<RazorpayRefundResult> {
  const instance = getRazorpay();

  const refundParams: Record<string, any> = { notes: notes ?? {} };
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

// ─────────────────────────────────────────────────────────────────────────────
// fetchPayment
// Fetch full Razorpay payment object by razorpayPaymentId.
// Useful for server-side status reconciliation.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPayment(razorpayPaymentId: string) {
  const instance = getRazorpay();
  return instance.payments.fetch(razorpayPaymentId);
}
