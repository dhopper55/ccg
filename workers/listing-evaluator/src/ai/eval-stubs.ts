import type { Env } from '../env.js';

type ListingData = {
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

type SingleAiResult = {
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

type AiResult = { kind: 'multi'; summary: string } | { kind: 'single'; data: SingleAiResult };

export async function runOpenAI(_listing: ListingData, _env: Env, options?: { isMulti?: boolean }): Promise<AiResult> {
  if (options?.isMulti) {
    return { kind: 'multi', summary: '' };
  }
  return {
    kind: 'single',
    data: {
      category: 'Other', brand: '', model: '', finish: '', year: '', condition: 'Good',
      serial: '', serial_brand: '', serial_year: '', serial_model: '',
      value_private_party_low: null, value_private_party_low_notes: '',
      value_private_party_medium: null, value_private_party_medium_notes: '',
      value_private_party_high: null, value_private_party_high_notes: '',
      value_pawn_shop_notes: '', value_online_notes: '',
      known_weak_points: '', typical_repair_needs: '', buyers_worry: '',
      og_specs_pickups: '', og_specs_tuners: '', og_specs_common_mods: '',
      buyer_what_to_check: '', buyer_common_misrepresent: '',
      seller_how_to_price_realistic: '', seller_fixes_add_value_or_waste: '',
      seller_as_is_notes: '', asking_price: null,
    },
  };
}

export async function runOpenAIModelDisambiguation(
  _listing: ListingData,
  base: SingleAiResult,
  _env: Env
): Promise<SingleAiResult> {
  return base;
}

export async function getSinglePricingFromOpenAI(_base: SingleAiResult, _env: Env): Promise<Partial<SingleAiResult> | null> {
  return null;
}

export async function runOpenAIMultiRangePricing(
  _listing: ListingData,
  _aiSummary: string,
  _env: Env
): Promise<{ low: number; high: number } | null> {
  return null;
}
