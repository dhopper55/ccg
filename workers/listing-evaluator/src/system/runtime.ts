import type { Env } from '../env.js';
import { normalizeText, normalizeInventoryDate, dbGetColumnNames } from '../utils/misc.js';
import { normalizeEmailAddress } from '../utils/text.js';
import { formatSystemCurrency } from '../utils/money.js';
import { DEFAULT_CO_SALES_TAX_RATE_ID, DEFAULT_SALE_DESCRIPTION_POSTFIX } from '../constants.js';

export type StripeRuntimeConfig = {
  secretKey?: string;
  publishableKey?: string;
  taxRateId?: string;
  useSandbox: boolean;
};

export type BrevoRuntimeConfig = {
  apiKey: string;
  templateId: number;
  senderName: string;
  senderEmail: string;
};

export async function getStripeRuntimeConfig(env: Env): Promise<StripeRuntimeConfig> {
  const fallback: StripeRuntimeConfig = {
    secretKey: normalizeText(env.STRIPE_SECRET_KEY, ''),
    publishableKey: normalizeText(env.STRIPE_PUBLISHABLE_KEY, ''),
    taxRateId: normalizeText(env.STRIPE_CO_SALES_TAX_RATE_ID, DEFAULT_CO_SALES_TAX_RATE_ID),
    useSandbox: true,
  };

  try {
    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    if (!row) return fallback;

    const useSandbox = parseSysInfoBoolean(row.use_stripe_sandbox, fallback.useSandbox);
    const secretKey = useSandbox
      ? normalizeText(row.stripe_secret_key_sandbox, fallback.secretKey)
      : normalizeText(row.stripe_secret_key, fallback.secretKey);
    const publishableKey = useSandbox
      ? normalizeText(row.stripe_publishable_key_sandbox, fallback.publishableKey)
      : normalizeText(row.stripe_publishable_key, fallback.publishableKey);
    const taxRateId = useSandbox
      ? normalizeText(row.string_tax_id_sandbox, fallback.taxRateId)
      : normalizeText(row.stripe_tax_id, fallback.taxRateId);

    return {
      secretKey,
      publishableKey,
      taxRateId,
      useSandbox,
    };
  } catch (error) {
    console.warn('Stripe sys_info lookup failed; using environment fallback.', { error });
    return fallback;
  }
}

export async function getBrevoRuntimeConfig(env: Env): Promise<BrevoRuntimeConfig> {
  const fallback: BrevoRuntimeConfig = {
    apiKey: '',
    templateId: 3,
    senderName: 'Coal Creek Guitars',
    senderEmail: '',
  };

  try {
    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    if (!row) return fallback;

    const templateId = Number(row.brevo_order_confirmation_template_id ?? fallback.templateId);
    return {
      apiKey: normalizeText(row.brevo_api_key, ''),
      templateId: Number.isFinite(templateId) && templateId > 0 ? Math.floor(templateId) : fallback.templateId,
      senderName: normalizeText(row.brevo_sender_name, fallback.senderName),
      senderEmail: normalizeEmailAddress(row.brevo_sender_email),
    };
  } catch (error) {
    console.warn('Brevo sys_info lookup failed.', { error });
    return fallback;
  }
}

export async function getShopRuntimeSettings(env: Env): Promise<{
  associateScreensaverIdleMs: number;
  customProductBarcode: string;
  saleDescriptionPostfix: string;
  stripeSandbox: boolean;
}> {
  const fallback = {
    associateScreensaverIdleMs: 60_000,
    customProductBarcode: '',
    saleDescriptionPostfix: DEFAULT_SALE_DESCRIPTION_POSTFIX,
    stripeSandbox: false,
  };

  try {
    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    if (!row) return fallback;

    const idleSeconds = Number(row.associate_screensaver_idle_seconds);
    return {
      associateScreensaverIdleMs: Number.isFinite(idleSeconds) && idleSeconds > 0
        ? Math.floor(idleSeconds) * 1000
        : fallback.associateScreensaverIdleMs,
      customProductBarcode: normalizeText(row.custom_product_barcode, '').slice(0, 80),
      saleDescriptionPostfix: normalizeText(row.sale_description_postfix, DEFAULT_SALE_DESCRIPTION_POSTFIX),
      stripeSandbox: parseSysInfoBoolean(row.use_stripe_sandbox, false),
    };
  } catch (error) {
    console.warn('Shop sys_info settings lookup failed.', { error });
    return fallback;
  }
}

export async function getStripeRuntimeConfigForLivemode(
  livemode: boolean,
  env: Env,
): Promise<StripeRuntimeConfig> {
  const fallback = await getStripeRuntimeConfig(env);
  const useSandbox = !livemode;

  try {
    const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    if (!row) return { ...fallback, useSandbox };

    const secretKey = useSandbox
      ? normalizeText(row.stripe_secret_key_sandbox, fallback.secretKey)
      : normalizeText(row.stripe_secret_key, fallback.secretKey);
    const taxRateId = useSandbox
      ? normalizeText(row.string_tax_id_sandbox, fallback.taxRateId)
      : normalizeText(row.stripe_tax_id, fallback.taxRateId);

    return {
      secretKey,
      taxRateId,
      useSandbox,
    };
  } catch (error) {
    console.warn('Stripe sys_info livemode lookup failed; using current Stripe fallback.', { livemode, error });
    return { ...fallback, useSandbox };
  }
}

export function parseSysInfoBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeText(value, '').toLowerCase();
  if (['1', 'true', 'yes', 'y', 'sandbox'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'prod', 'production'].includes(normalized)) return false;
  return fallback;
}

export async function dbGetV2DecodeLogicEnabled(env: Env): Promise<boolean> {
  try {
    const row = await env.DB.prepare('SELECT use_v2_decode_logic FROM sys_info LIMIT 1').first<Record<string, unknown>>();
    return parseSysInfoBoolean(row?.use_v2_decode_logic, false);
  } catch {
    return false;
  }
}

export async function dbSetV2DecodeLogic(enabled: boolean, env: Env): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO sys_info (id, use_v2_decode_logic)
     VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET
       use_v2_decode_logic = excluded.use_v2_decode_logic,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(enabled ? 1 : 0).run();
}

export async function dbSetStripeSandboxMode(useSandbox: boolean, env: Env): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO sys_info (id, use_stripe_sandbox)
     VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET
       use_stripe_sandbox = excluded.use_stripe_sandbox,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(useSandbox ? 1 : 0).run();
}

export async function dbSetStripePublishableKeys(sandboxKey: string, liveKey: string, env: Env): Promise<void> {
  const existingCols = await dbGetColumnNames('sys_info', env);
  const allValues: Record<string, unknown> = {
    stripe_publishable_key_sandbox: sandboxKey || null,
    stripe_publishable_key: liveKey || null,
  };
  const cols = Object.keys(allValues).filter((col) => existingCols.has(col));
  if (cols.length === 0) return;
  await env.DB.prepare(
    `INSERT INTO sys_info (id, ${cols.join(', ')})
     VALUES (1, ${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET
       ${cols.map((col) => `${col} = excluded.${col}`).join(',\n       ')},
       updated_at = CURRENT_TIMESTAMP`
  ).bind(...cols.map((col) => allValues[col])).run();
}

export async function dbGetSystemSettings(env: Env): Promise<{
  brevoOrderConfirmationTemplateId: string;
  brevoSenderName: string;
  brevoSenderEmail: string;
  associateScreensaverIdleSeconds: string;
  customProductBarcode: string;
  currentUsedLocalFunds: string;
  currentMfrWholesaleFunds: string;
  postStoreLaunchDate: string;
  saleDescriptionPostfix: string;
}> {
  const row = await env.DB.prepare('SELECT * FROM sys_info LIMIT 1').first<Record<string, unknown>>();

  return {
    brevoOrderConfirmationTemplateId: normalizeText(row?.brevo_order_confirmation_template_id, '3'),
    brevoSenderName: normalizeText(row?.brevo_sender_name, ''),
    brevoSenderEmail: normalizeText(row?.brevo_sender_email, ''),
    associateScreensaverIdleSeconds: normalizeText(row?.associate_screensaver_idle_seconds, '60'),
    customProductBarcode: normalizeText(row?.custom_product_barcode, ''),
    currentUsedLocalFunds: formatSystemCurrency(row?.current_used_local_funds),
    currentMfrWholesaleFunds: formatSystemCurrency(row?.current_mfr_wholesale_funds),
    postStoreLaunchDate: normalizeInventoryDate(row?.post_store_launch_date) || '2026-06-01',
    saleDescriptionPostfix: normalizeText(row?.sale_description_postfix, DEFAULT_SALE_DESCRIPTION_POSTFIX),
  };
}

export async function dbSetSystemSettings(
  settings: {
    brevoOrderConfirmationTemplateId: number;
    brevoSenderName: string;
    brevoSenderEmail: string;
    associateScreensaverIdleSeconds: number;
    customProductBarcode: string;
    currentUsedLocalFunds: number;
    currentMfrWholesaleFunds: number;
    postStoreLaunchDate: string;
    saleDescriptionPostfix: string;
  },
  env: Env,
): Promise<void> {
  const existingCols = await dbGetColumnNames('sys_info', env);
  const allValues: Record<string, unknown> = {
    brevo_order_confirmation_template_id: settings.brevoOrderConfirmationTemplateId,
    brevo_sender_name: settings.brevoSenderName,
    brevo_sender_email: settings.brevoSenderEmail,
    associate_screensaver_idle_seconds: settings.associateScreensaverIdleSeconds,
    custom_product_barcode: settings.customProductBarcode,
    current_used_local_funds: Number(settings.currentUsedLocalFunds.toFixed(2)),
    current_mfr_wholesale_funds: Number(settings.currentMfrWholesaleFunds.toFixed(2)),
    post_store_launch_date: settings.postStoreLaunchDate,
    sale_description_postfix: settings.saleDescriptionPostfix,
  };
  const cols = Object.keys(allValues).filter((col) => existingCols.has(col));
  if (cols.length === 0) return;
  await env.DB.prepare(
    `INSERT INTO sys_info (id, ${cols.join(', ')})
     VALUES (1, ${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET
       ${cols.map((col) => `${col} = excluded.${col}`).join(',\n       ')},
       updated_at = CURRENT_TIMESTAMP`
  ).bind(...cols.map((col) => allValues[col])).run();
}
