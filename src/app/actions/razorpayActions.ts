
'use server';

import Razorpay from 'razorpay';
import crypto from 'crypto';

// These should be environment variables in a real application.
// Ensure these are set in your .env.local or hosting environment.
const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

interface CreateOrderParams {
  amount: number; // Amount in paisa
  currency: string;
  receipt: string;
  notes?: Record<string, any>;
}

export async function createRazorpayOrder(params: CreateOrderParams) {
  console.log('[Server Action] createRazorpayOrder called with params:', params);
  console.log('[Server Action] Using RAZORPAY_KEY_ID:', RAZORPAY_KEY_ID ? 'Loaded' : 'MISSING!');
  console.log('[Server Action] Using RAZORPAY_KEY_SECRET:', RAZORPAY_KEY_SECRET ? 'Loaded (partially hidden)' : 'MISSING!');

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const errorMessage = "Razorpay API Key ID or Secret is not defined in environment variables. Cannot create order.";
    console.error(`[Server Action] CRITICAL: ${errorMessage}`);
    return { error: errorMessage };
  }

  try {
    const razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
    console.log('[Server Action] Razorpay instance created.');

    const options = {
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes || {},
    };
    console.log('[Server Action] Order options being sent to Razorpay:', options);

    const order = await razorpayInstance.orders.create(options);
    console.log('[Server Action] Razorpay order created successfully:', order);
    return {
      order_id: order.id,
      currency: order.currency,
      amount: order.amount,
    };
  } catch (error: any) {
    console.error('[Server Action] Razorpay order creation error:', error);
    // Try to get a more specific error message from Razorpay's error structure
 console.error('[Server Action] Full error object:', error);
    const specificError = error.error?.description || error.message || 'Failed to create Razorpay order due to an unknown server error.';
    return { error: specificError };
  }
}

interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function verifyRazorpayPayment(params: VerifyPaymentParams) {
  console.log('[Server Action] verifyRazorpayPayment called with params:', params);

  if (!RAZORPAY_KEY_SECRET) {
    const errorMessage = "Razorpay Key Secret is not defined. Cannot verify payment.";
    console.error(`[Server Action] CRITICAL: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
    
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      console.log('[Server Action] Payment verification successful for order_id:', razorpay_order_id);
      return { success: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id };
    } else {
      console.warn('[Server Action] Payment verification failed. Signature mismatch for order_id:', razorpay_order_id);
      return { success: false, error: 'Payment verification failed. Signature mismatch.' };
    }
  } catch (error: any) {
    console.error('[Server Action] Error verifying Razorpay payment:', error);
    return { success: false, error: error.message || 'Payment verification failed due to an unknown server error.' };
  }
}
