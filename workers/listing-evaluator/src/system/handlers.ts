import type { Env } from '../env.js';
import { jsonResponse, normalizeText, normalizeInventoryDate, toBooleanInput } from '../utils/misc.js';
import { normalizeEmailAddress } from '../utils/text.js';
import { parseCurrencyAmount, formatSystemCurrency } from '../utils/money.js';
import {
  getStripeRuntimeConfig,
  getBrevoRuntimeConfig,
  dbGetV2DecodeLogicEnabled,
  dbSetV2DecodeLogic,
  dbSetStripeSandboxMode,
  dbSetStripePublishableKeys,
  dbGetSystemSettings,
  dbSetSystemSettings,
} from './runtime.js';

export async function handleAdminV2StripeConfig(env: Env): Promise<Response> {
  const config = await getStripeRuntimeConfig(env);
  const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>().catch(() => null);
  return jsonResponse({
    useStripeSandbox: config.useSandbox,
    hasSecretKey: Boolean(config.secretKey),
    hasTaxRateId: Boolean(config.taxRateId),
    stripePublishableKeySandbox: normalizeText(row?.stripe_publishable_key_sandbox, ''),
    stripePublishableKey: normalizeText(row?.stripe_publishable_key, ''),
  });
}

export async function handleAdminV2StripeConfigUpdate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const useStripeSandbox = toBooleanInput(body.useStripeSandbox, true);
  try {
    await dbSetStripeSandboxMode(useStripeSandbox, env);

    if (body.stripePublishableKeySandbox !== undefined || body.stripePublishableKey !== undefined) {
      await dbSetStripePublishableKeys(
        normalizeText(body.stripePublishableKeySandbox, ''),
        normalizeText(body.stripePublishableKey, ''),
        env,
      );
    }

    const config = await getStripeRuntimeConfig(env);
    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>().catch(() => null);
    return jsonResponse({
      ok: true,
      useStripeSandbox: config.useSandbox,
      hasSecretKey: Boolean(config.secretKey),
      hasTaxRateId: Boolean(config.taxRateId),
      stripePublishableKeySandbox: normalizeText(row?.stripe_publishable_key_sandbox, ''),
      stripePublishableKey: normalizeText(row?.stripe_publishable_key, ''),
    });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to update Stripe environment.',
    }, 500);
  }
}

export async function handleAdminV2V2DecodeConfig(env: Env): Promise<Response> {
  const enabled = await dbGetV2DecodeLogicEnabled(env);
  return jsonResponse({ useV2DecodeLogic: enabled });
}

export async function handleAdminV2V2DecodeConfigUpdate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }
  const enabled = toBooleanInput(body.useV2DecodeLogic, false);
  try {
    await dbSetV2DecodeLogic(enabled, env);
    return jsonResponse({ ok: true, useV2DecodeLogic: enabled });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to update V2 decode logic setting.',
    }, 500);
  }
}

export async function handleAdminV2SystemSettings(env: Env): Promise<Response> {
  try {
    const settings = await dbGetSystemSettings(env);
    return jsonResponse(settings);
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to load system settings.',
    }, 500);
  }
}

export async function handleAdminV2SystemSettingsUpdate(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid JSON payload.' }, 400);
  }

  const templateId = Number(body.brevoOrderConfirmationTemplateId);
  const senderName = normalizeText(body.brevoSenderName, '');
  const senderEmail = normalizeEmailAddress(body.brevoSenderEmail);
  const associateScreensaverIdleSeconds = Number(body.associateScreensaverIdleSeconds);
  const customProductBarcode = normalizeText(body.customProductBarcode, '').slice(0, 80);
  const currentUsedLocalFunds = parseCurrencyAmount(body.currentUsedLocalFunds);
  const currentMfrWholesaleFunds = parseCurrencyAmount(body.currentMfrWholesaleFunds);
  const postStoreLaunchDate = normalizeInventoryDate(body.postStoreLaunchDate);
  const saleDescriptionPostfix = normalizeText(body.saleDescriptionPostfix, '').slice(0, 12000);

  if (!Number.isFinite(templateId) || templateId <= 0 || Math.floor(templateId) !== templateId) {
    return jsonResponse({ message: 'Brevo Order Confirm Template ID must be a positive whole number.' }, 400);
  }
  if (!senderName) {
    return jsonResponse({ message: 'Brevo Sender Name is required.' }, 400);
  }
  if (!senderEmail) {
    return jsonResponse({ message: 'Enter a valid Brevo Sender Email.' }, 400);
  }
  if (
    !Number.isFinite(associateScreensaverIdleSeconds) ||
    associateScreensaverIdleSeconds <= 0 ||
    Math.floor(associateScreensaverIdleSeconds) !== associateScreensaverIdleSeconds
  ) {
    return jsonResponse({ message: 'Associate Screensaver Idle Seconds must be a positive whole number.' }, 400);
  }
  if (currentUsedLocalFunds == null || currentUsedLocalFunds < 0) {
    return jsonResponse({ message: 'Current Used Local Funds must be zero or greater.' }, 400);
  }
  if (currentMfrWholesaleFunds == null || currentMfrWholesaleFunds < 0) {
    return jsonResponse({ message: 'Current Mfr Wholesale Funds must be zero or greater.' }, 400);
  }
  if (!postStoreLaunchDate) {
    return jsonResponse({ message: 'Post Store Launch Date must be a valid date.' }, 400);
  }

  try {
    await dbSetSystemSettings({
      brevoOrderConfirmationTemplateId: templateId,
      brevoSenderName: senderName,
      brevoSenderEmail: senderEmail,
      associateScreensaverIdleSeconds,
      customProductBarcode,
      currentUsedLocalFunds,
      currentMfrWholesaleFunds,
      postStoreLaunchDate,
      saleDescriptionPostfix,
    }, env);
    const settings = await dbGetSystemSettings(env);
    return jsonResponse({ ok: true, ...settings });
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unable to save system settings.',
    }, 500);
  }
}
