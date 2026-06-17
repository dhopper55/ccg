import type { ActivityEventKey } from '../constants.js';

export interface SubmitPayload {
  urls: Array<string | { url: string; isMulti?: boolean }>;
}

export interface QueueResult {
  url: string;
  source?: string;
  runId?: string;
  row?: number;
  recordId?: string;
  unarchived?: boolean;
  unsaved?: boolean;
  existing?: boolean;
  requeued?: boolean;
  resubmitted?: boolean;
  isMulti?: boolean;
}

export interface RejectResult {
  url: string;
  reason: string;
}

export const ALLOWED_ARCHIVE_REASONS = new Set([
  'Overpriced',
  'Not Desirable',
  'Repair Needs',
  'Too Far',
  'Old/Stale',
  'I bought it',
  'It sold',
  'Unresponsive',
  'Other',
]);

export interface SerialDecodeEventPayload {
  brand?: unknown;
  serial?: unknown;
  success?: unknown;
  year?: unknown;
  factory?: unknown;
  country?: unknown;
  error?: unknown;
  pagePath?: unknown;
  userAgent?: unknown;
  clientTimestamp?: unknown;
}

export interface DecodeRequestPayload {
  brand?: unknown;
  serial?: unknown;
  pagePath?: unknown;
  userAgent?: unknown;
  clientTimestamp?: unknown;
}

export interface DecodeEmailRequestPayload {
  decodeEventId?: unknown;
  brand?: unknown;
  serial?: unknown;
  email?: unknown;
}

export interface AiSerialDecodeParsed {
  success: boolean;
  year: string | null;
  month: string | null;
  factory: string | null;
  country: string | null;
  model: string | null;
  notes: string | null;
  error: string | null;
}

export interface AiSerialDecodeCacheRow {
  success: number | null;
  brand: string | null;
  serial: string | null;
  year: string | null;
  month: string | null;
  factory: string | null;
  country: string | null;
  model: string | null;
  notes: string | null;
  error: string | null;
  ai_model: string | null;
  ai_response_json: string | null;
}

export interface SerialPatternContextPayload {
  title: string;
  summary: string;
  highlights: string[];
  caveats: string[];
  verificationTips: string[];
}

export interface SerialPatternContextRow {
  id: number | null;
  brand: string | null;
  normalized_brand: string | null;
  pattern_key: string | null;
  pattern_label: string | null;
  title: string | null;
  summary: string | null;
  highlights_json: string | null;
  caveats_json: string | null;
  verification_json: string | null;
  source_serial: string | null;
  ai_model: string | null;
  ai_response_json: string | null;
  published: number | null;
}

export interface SerialDecodeEventInsert {
  brand: string;
  serial: string;
  pattern?: string | null;
  patternKey?: string | null;
  patternLabel?: string | null;
  patternLookupId?: number | null;
  normalizedBrand?: string;
  normalizedSerial?: string;
  success: boolean;
  evaluated?: boolean;
  isInvalid?: boolean;
  needsContext?: boolean;
  year?: string;
  month?: string;
  factory?: string;
  country?: string;
  model?: string;
  notes?: string;
  error?: string;
  email?: string;
  usedAi?: boolean;
  aiCacheHit?: boolean;
  aiModel?: string;
  aiResponseJson?: string;
  aiAttemptedAt?: string;
  pagePath?: string;
  userAgent?: string;
  clientTimestamp?: string;
  ipAddress?: string;
  countryCode?: string;
  colo?: string;
}

export interface ActivityLogInsert {
  eventKey: ActivityEventKey;
  eventText: string;
  eventUrl?: string | null;
  imageUrl?: string | null;
  eventTimeUtc?: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type ListingListItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  score?: number | string;
  saved?: boolean;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  inInventory?: boolean;
};

export type ListingMapItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  saved?: boolean;
  location?: string;
};

export type StripeRuntimeConfig = {
  secretKey: string;
  publishableKey: string;
  taxRateId: string;
  useSandbox: boolean;
};

export type BrevoRuntimeConfig = {
  apiKey: string;
  templateId: number;
  senderName: string;
  senderEmail: string;
};

export type AdminV2SerialDecodeRow = {
  id: number;
  eventTimeUtc: string | null;
  clientTimestamp: string | null;
  brand: string;
  serial: string;
  email: string | null;
  patternLookupId: number | null;
  success: boolean;
  evaluated: boolean;
  year: string | null;
  factory: string | null;
  country: string | null;
  error: string | null;
};

export type AdminV2SerialDecodeBrandResponseRow = {
  brand: string;
  responseCount: number;
};

export type AdminV2SerialLookupVolumeView = 'day' | 'month';

export type AdminV2SerialLookupVolumeBucket = {
  key: string;
  label: string;
  responseCount: number;
  successCount: number;
  failureCount: number;
};

export type AdminV2SerialPatternLookupSortBy = 'brand' | 'pattern' | 'populated';

export type AdminV2SerialPatternLookupRow = {
  id: number;
  brand: string;
  pattern: string;
  regexPattern: string;
  richText: string;
  richTextPopulated: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ListingSource = 'facebook' | 'craigslist' | 'reverb';

export type ListingData = {
  title: string;
  price: string;
  location: string;
  condition: string;
  description: string;
  images: string[];
  url?: string;
  notes?: string;
  brandHint?: string;
  modelHint?: string;
};

export type SingleAiResult = {
  category: string;
  brand: string;
  model: string;
  finish: string;
  year: string;
  condition: string;
  serial: string;
  serial_brand: string;
  serial_year: string;
  serial_model: string;
  value_private_party_low: number | string | null;
  value_private_party_low_notes: string;
  value_private_party_medium: number | string | null;
  value_private_party_medium_notes: string;
  value_private_party_high: number | string | null;
  value_private_party_high_notes: string;
  value_pawn_shop_notes: string;
  value_online_notes: string;
  known_weak_points: string;
  typical_repair_needs: string;
  buyers_worry: string;
  og_specs_pickups: string;
  og_specs_tuners: string;
  og_specs_common_mods: string;
  buyer_what_to_check: string;
  buyer_common_misrepresent: string;
  seller_how_to_price_realistic: string;
  seller_fixes_add_value_or_waste: string;
  seller_as_is_notes: string;
  asking_price: number | string | null;
  pricing_source?: string;
  pricing_confidence?: string;
  pricing_comp_count?: number | string | null;
  pricing_notes?: string;
};

export type AiResult = { kind: 'multi'; summary: string } | { kind: 'single'; data: SingleAiResult };
