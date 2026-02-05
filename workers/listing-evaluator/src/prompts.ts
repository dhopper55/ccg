type ListingData = {
  title?: string | null;
  description?: string | null;
  price?: string | null;
  location?: string | null;
};

type SingleAiResult = {
  category: string;
  brand: string;
  model: string;
  finish: string;
  year: string;
  condition: string;
};

type DefaultText = Record<string, string>;

export function buildSystemPrompt(isMulti: boolean): string {
  return isMulti
    ? 'You are an expert used gear buyer and appraiser focused on music gear. This listing contains MULTIPLE items. Produce a concise valuation with the exact format below. If details are missing, be clear about uncertainty and suggest the specific photo or detail needed. Avoid hype.'
    : 'You are an expert used gear buyer and appraiser focused on music gear. Provide structured output for a SINGLE item using the exact JSON schema provided. If details are missing, be clear about uncertainty. Avoid hype.';
}

export function buildMainUserPrompt(
  listing: ListingData,
  isMulti: boolean,
  categoryOptions: string[],
  conditionOptions: string[]
): string {
  if (isMulti) {
    return `Listing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nAsking price: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\n\nThis is a multi-item listing. Identify each distinct item for sale based on photos and description. For EACH item, output the same section format below, one item after another (no merged sections). If you cannot identify an item clearly, note it as "Unknown item" and explain why. If an item has no explicit asking price, write "Asking price (from listing text): Unknown" in that item. The ideal buy price is the LOW end of the used range minus 20%.\n\nIMPORTANT: Do NOT use asking price to compute any market value ranges. Asking price is for context only.\n\nAfter the last item, include TWO additional sections exactly as labeled below:\n\nItemized recap\n- Item name - $X asking, used range $Y to $Z, $W ideal (use "Unknown" if missing)\n\nTotals\n- Total listing asking price: $X (or "Unknown")\n- Used market range for all: $Y to $Z (or "Unknown")\n- Ideal price for all: $W (20% below used range low end; or "Unknown")\n\nUse this format for EACH item (plain bullet points, no extra dashes or nested bullet markers):\n\nWhat it appears to be\n- Make/model/variant\n- Estimated year or range (if possible; otherwise "Year: Not enough info")\n- Estimated condition from photos (or "Condition from photos: Inconclusive")\n- Notable finish/features\n\nPrices\n- Typical private-party value: $X-$Y\n- Music store pricing: $X-$Y\n- New price: $X (append "(no longer available)" if discontinued); or "Unknown" if you cannot determine\n- Ideal buy price: $X (20% below used range low end)\n\n- Adds Value: include one specific, model-relevant value add if it exists; avoid generic condition/finish statements; otherwise omit this line entirely\n\nHow long to sell\n- If put up for sale at the higher end of the used price range ($X), it will take about N-N weeks to sell to a local buyer, and perhaps N weeks to sell to an online buyer (Reverb.com).\n- If you cannot reasonably estimate, output exactly: Not enough data available.\n\nScore\n- Score: X/10 (resell potential based on ask vs realistic value, condition, and included extras)\n\nBottom line\n- Realistic value range\n- Asking price (from listing text): $X or "Unknown"\n- Buy/skip note\n- Any missing info to tighten valuation\n`;
  }

  return `Listing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nAsking price: ${listing.price || 'Unknown'}\nLocation: ${listing.location || 'Unknown'}\n\nThis is a SINGLE item. Use the JSON schema provided to respond. Do not include any additional keys. Use these rules:\n- category must be one of: ${categoryOptions.join(', ')}. Use "Other" if unsure.\n- condition must be one of: ${conditionOptions.join(', ')}.\n- brand/model should be "Unknown" only if truly impossible. If inferred, append " (NOT DEFINITIVE)" in caps.\n- finish: if unknown, guess a color and prefix with "Guess: ".\n- year: avoid "Unknown". Prefer a specific year or a tight range (<= 10-15 years). If only a broad era is possible, provide a range and mark "(NOT DEFINITIVE)".\n- serial: only if identified from photos or description; otherwise blank.\n- serial_brand/year/model: only if serial is provided; otherwise blank.\n- value_private_party_low/medium/high: numeric or string values.\n- value_pawn_shop_notes must be less than private party low.\n- value_online_notes must mention marketplace fees and risks (shipping, buyer can't try before buying).\n- og_specs_pickups/og_specs_tuners: provide the most likely stock spec for this model; if unknown use "Unknown".\n- asking_price: include parsed asking price if provided (numeric if possible).\n- Do NOT use asking price to compute any market value ranges; asking price is for context only.\n\nModel-specific detail requirements (must be specific to this model/brand/year when possible):\n- known_weak_points, typical_repair_needs, buyers_worry, og_specs_common_mods, buyer_what_to_check, buyer_common_misrepresent, seller_how_to_price_realistic, seller_fixes_add_value_or_waste, seller_as_is_notes.\n- For each field above, start with model-specific info (at least 1-2 sentences), then END with the default text below exactly as written, prefixed by "General: ".\n- If no model-specific info is available, still include "General: ..." only.\n\nDefault text (use verbatim at the end of each field listed above):\n- known_weak_points: "Potential issues with electronics or hardware over time."\n- typical_repair_needs: "Possible need for setup adjustments or electronics cleaning."\n- buyers_worry: "Check for neck straightness and electronics functionality."\n- og_specs_common_mods: "Common mods vary; verify originality and parts."\n- buyer_what_to_check: "Inspect electronics, neck relief, fret wear, and hardware function."\n- buyer_common_misrepresent: "Watch for misrepresented year, model, or replaced parts."\n- seller_how_to_price_realistic: "Price realistically by comparing recent sales in similar condition."\n- seller_fixes_add_value_or_waste: "Minor setup and cleaning can help; major repairs may not pay off."\n- seller_as_is_notes: "Sell as-is if repair costs exceed value gains."\n`;
}

export function buildSpecificsPrompt(
  listing: ListingData,
  base: SingleAiResult,
  specificFields: string[],
  defaultText: DefaultText
): string {
  return `You are improving model-specific guidance for used music gear. Use your general knowledge (no browsing) to provide concrete, model-specific bullet points.\n\nListing title: ${listing.title || 'Unknown'}\nDescription: ${listing.description || 'Not provided'}\nBrand: ${base.brand}\nModel: ${base.model}\nYear: ${base.year}\n\nReturn JSON only with these keys:\n${specificFields.join(', ')}, og_specs_pickups, og_specs_tuners\n\nRules:\n- Each field should start with 2-4 short, model-specific bullets (not paragraphs). Use semicolons to separate bullets. Do not use leading dashes or bullet characters.\n- If uncertain, include "(NOT DEFINITIVE)" in the specific text.\n- End each field with "General: <default text>" exactly once.\n- og_specs_pickups/og_specs_tuners: provide the most likely stock spec for this model; if unknown use "Unknown".\nDefault text:\nknown_weak_points: ${defaultText.known_weak_points}\ntypical_repair_needs: ${defaultText.typical_repair_needs}\nbuyers_worry: ${defaultText.buyers_worry}\nog_specs_common_mods: ${defaultText.og_specs_common_mods}\nbuyer_what_to_check: ${defaultText.buyer_what_to_check}\nbuyer_common_misrepresent: ${defaultText.buyer_common_misrepresent}\nseller_how_to_price_realistic: ${defaultText.seller_how_to_price_realistic}\nseller_fixes_add_value_or_waste: ${defaultText.seller_fixes_add_value_or_waste}\nseller_as_is_notes: ${defaultText.seller_as_is_notes}\n`;
}

export function buildSinglePricingPrompt(listing: ListingData, base: SingleAiResult): string {
  return `You are an expert used gear buyer and appraiser focused on music gear. Provide ONLY JSON using the schema below.\n\nListing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nLocation: ${listing.location || 'Unknown'}\n\nKnown/inferred details from a prior pass:\n- Category: ${base.category || 'Unknown'}\n- Brand: ${base.brand || 'Unknown'}\n- Model: ${base.model || 'Unknown'}\n- Year: ${base.year || 'Unknown'}\n- Condition: ${base.condition || 'Unknown'}\n- Finish: ${base.finish || 'Unknown'}\n\nTask:\n- Estimate realistic private-party market values (low, medium, high) for this item based on typical used market value.\n- Asking price is intentionally omitted; do NOT infer or use it.\n- Do NOT use any numbers found in text or images (including price overlays). Ignore all numeric tokens in text/images.\n- If uncertain, estimate from comparable models.\n- Use realistic numbers; do not round to the nearest 50/100 unless that is the most realistic value.\n`;
}

export function buildMultiPricingPrompt(listing: ListingData, summary: string): string {
  return `You are an expert used gear buyer and appraiser focused on music gear. Provide ONLY JSON using the schema below.\n\nListing title: ${listing.title || 'Unknown'}\nListing description: ${listing.description || 'Not provided'}\nLocation: ${listing.location || 'Unknown'}\n\nPrior analysis (may be incomplete):\n${summary || 'Not provided'}\n\nTask:\n- Estimate the combined private-party used market range (low/high total) for ALL items in this listing.\n- Asking price is intentionally omitted; do NOT infer or use it.\n- Do NOT use any numbers found in text or images (including price overlays). Ignore all numeric tokens in text/images.\n- If uncertain, estimate from comparable models and typical bundles.\n- Use realistic numbers; do not round to the nearest 50/100 unless that is the most realistic value.\n`;
}
