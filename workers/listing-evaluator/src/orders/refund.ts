import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { getStripeRuntimeConfig } from '../system/runtime.js';
import { numberOrZero } from '../utils/misc.js';

export async function createStripeFeeAdjustedRefund(
  paymentIntentId: string,
  orderId: string,
  orderTotalCents: number,
  env: Env,
): Promise<{
  ok: true;
  refundId: string;
  refundAmountCents: number;
  retainedFeeCents: number;
  feeSource: string;
  paymentMethodType: string;
} | { ok: false; message: string; status: number }> {
  const { secretKey: stripeSecretKey } = await getStripeRuntimeConfig(env);
  if (!stripeSecretKey) return { ok: false, message: 'Stripe secret key is not configured.', status: 500 };

  try {
    const refundPlan = await resolveStripeFeeAdjustedRefundPlan(paymentIntentId, orderTotalCents, stripeSecretKey);
    if (refundPlan.refundAmountCents <= 0) {
      return {
        ok: true,
        refundId: '',
        refundAmountCents: 0,
        retainedFeeCents: refundPlan.retainedFeeCents,
        feeSource: refundPlan.feeSource,
        paymentMethodType: refundPlan.paymentMethodType,
      };
    }

    const body = new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(refundPlan.refundAmountCents),
    });
    body.set('metadata[order_id]', orderId);
    body.set('metadata[retained_fee_cents]', String(refundPlan.retainedFeeCents));
    body.set('metadata[retained_fee_source]', refundPlan.feeSource);
    body.set('metadata[payment_method_type]', refundPlan.paymentMethodType);
    const response = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `ccg-order-refund-${orderId}`,
      },
      body,
    });
    const data = await response.json<any>();
    if (!response.ok) {
      return {
        ok: false,
        message: normalizeText(data?.error?.message, 'Stripe refund failed.'),
        status: response.status || 502,
      };
    }
    return {
      ok: true,
      refundId: normalizeText(data?.id, ''),
      refundAmountCents: refundPlan.refundAmountCents,
      retainedFeeCents: refundPlan.retainedFeeCents,
      feeSource: refundPlan.feeSource,
      paymentMethodType: refundPlan.paymentMethodType,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Stripe refund failed.',
      status: 502,
    };
  }
}

export async function resolveStripeFeeAdjustedRefundPlan(
  paymentIntentId: string,
  orderTotalCents: number,
  stripeSecretKey: string,
): Promise<{
  refundAmountCents: number;
  retainedFeeCents: number;
  feeSource: string;
  paymentMethodType: string;
}> {
  let chargeAmountCents = Math.max(0, Math.round(orderTotalCents));
  let retainedFeeCents = 0;
  let feeSource = 'fallback_card_estimate';
  let paymentMethodType = '';

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge.balance_transaction`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );
    const data = await response.json<any>();
    if (response.ok) {
      const latestCharge = data?.latest_charge;
      const balanceTransaction = latestCharge?.balance_transaction;
      chargeAmountCents = numberOrZero(latestCharge?.amount) || numberOrZero(data?.amount_received) || chargeAmountCents;
      paymentMethodType = normalizeText(
        latestCharge?.payment_method_details?.type,
        normalizeText(data?.payment_method_types?.[0], ''),
      );
      if (paymentMethodType === 'affirm' || paymentMethodType === 'klarna') {
        retainedFeeCents = numberOrZero(balanceTransaction?.fee);
      }
      if (retainedFeeCents > 0) {
        feeSource = 'stripe_balance_transaction';
      }
    } else {
      console.warn('Stripe refund fee lookup failed', { paymentIntentId, status: response.status });
    }
  } catch (error) {
    console.warn('Stripe refund fee lookup failed', { paymentIntentId, error });
  }

  if (paymentMethodType !== 'affirm' && paymentMethodType !== 'klarna') {
    return {
      refundAmountCents: chargeAmountCents,
      retainedFeeCents: 0,
      feeSource: 'standard_payment_full_refund',
      paymentMethodType: paymentMethodType || 'stripe',
    };
  }

  if (retainedFeeCents <= 0) {
    retainedFeeCents = estimateNonRefundableStripeFeeCents(chargeAmountCents, paymentMethodType);
    feeSource = 'fallback_financing_estimate';
  }

  const cappedFeeCents = Math.min(Math.max(0, retainedFeeCents), chargeAmountCents);
  return {
    refundAmountCents: Math.max(0, chargeAmountCents - cappedFeeCents),
    retainedFeeCents: cappedFeeCents,
    feeSource,
    paymentMethodType: paymentMethodType || 'stripe',
  };
}

export function estimateNonRefundableStripeFeeCents(amountCents: number, paymentMethodType: string): number {
  const normalizedType = normalizeText(paymentMethodType, '').toLowerCase();
  const rate = normalizedType === 'affirm' || normalizedType === 'klarna' ? 0.06 : 0;
  if (rate <= 0) return 0;
  return Math.max(0, Math.round(amountCents * rate) + 30);
}
