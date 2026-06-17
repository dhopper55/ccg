import type { Env } from '../env.js';

export type SerialPatternBucketResult =
  | {
      bucket: 1;
      pattern_key: string;
      pattern_label: string;
      regex: string;
      template_type: 'prefix-yymm-seq' | 'prefix-yy-seq' | 'numeric-yymm-seq';
      params: Record<string, unknown>;
    }
  | { bucket: 2; reason: string };

export async function callAnthropicForSerialPatternBucket(
  brand: string,
  serial: string,
  aiAnalysisText: string,
  env: Env,
): Promise<SerialPatternBucketResult> {
  if (!env.ANTHROPIC_API_KEY) {
    return { bucket: 2, reason: 'Anthropic API key not configured.' };
  }

  const systemPrompt = `You are a guitar serial number expert. Your job is to analyze a failed serial decode and decide if it can be handled by one of these V2 template types, or requires code (Bucket 2).

## V2 Template Types

### prefix-yymm-seq
Format: [fixed letter prefix][YY 2-digit year][MM 2-digit month][sequence digits]
Requirements: fixed yearCentury (1900 or 2000, never dynamic/threshold-based), prefix is 1+ uppercase letters.
Params: {"prefix":string,"prefixLen":number,"brand":string,"factory":string,"country":string,"model"?:string,"yearCentury":number}

### prefix-yy-seq
Format: [fixed letter prefix][YY 2-digit year][sequence digits] — no month encoded
Requirements: same as prefix-yymm-seq but serial has no month field.
Params: {"prefix":string,"prefixLen":number,"brand":string,"factory":string,"country":string,"model"?:string,"yearCentury":number}

### numeric-yymm-seq
Format: all-numeric serial, year and optional month extracted from character positions.
Requirements: fixed yearCentury. monthStart is optional (omit if no month).
Params: {"yearStart":number,"monthStart"?:number,"seqStart":number,"brand":string,"factory":string,"country":string,"model"?:string,"yearCentury":number}

## What makes it Bucket 2 (needs code — do NOT attempt a template):
- Dynamic/threshold century: yy >= 70 → 1900+yy, else 2000+yy (or any variant)
- Factory map lookup: prefix maps to different factory names per variant character
- Week-based year: YYWW not YYMM
- Letter-code year: year encoded as a letter (A=2000, B=2001, etc.)
- Month encoded as a single digit or a letter
- Interleaved year digits (e.g. Y-D-D-D-Y-R-R-R)
- Sequential range lookups (year determined by looking up serial number in a range table)
- Any other logic beyond a simple fixed prefix + fixed-century year + optional month + sequence

## Output

Return ONLY valid JSON — no markdown, no explanation, nothing else.

Bucket 1:
{"bucket":1,"pattern_key":"<brand>-<descriptive-kebab-case-key>","pattern_label":"<Human Readable Label>","regex":"<JS-compatible regex string>","template_type":"prefix-yymm-seq"|"prefix-yy-seq"|"numeric-yymm-seq","params":{...}}

Bucket 2:
{"bucket":2,"reason":"<one sentence explanation>"}

Rules for pattern_key: lowercase kebab-case, unique, descriptive. Example: "epiphone-qi-china-yymm-sequence".
Rules for regex: JavaScript RegExp compatible (no lookbehind unless ES2018+). Anchor with ^ and $.
Use priority 999 (already handled externally — do not include in output).`;

  const userMessage = `Brand: ${brand}
Serial: ${serial}

AI Analysis:
${aiAnalysisText}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error('[serial-bucket] Anthropic API error', response.status, err);
    return { bucket: 2, reason: `AI classification unavailable (${response.status}).` };
  }

  const data = await response.json() as {
    content?: Array<{ type: string; text?: string }>;
  };

  const rawText = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';

  try {
    const parsed = JSON.parse(rawText) as SerialPatternBucketResult;
    if (parsed.bucket !== 1 && parsed.bucket !== 2) throw new Error('invalid bucket');
    return parsed;
  } catch {
    console.error('[serial-bucket] Failed to parse AI response', rawText);
    return { bucket: 2, reason: 'AI returned unparseable response.' };
  }
}
