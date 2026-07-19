import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import type { AuthenticityReportData } from '../guitar-eval/authenticity-report.js';

export type AuthenticityPolishResult = {
  confidenceStatement: string;
  verdictReasoning: string;
  certificateSummary: string;
  suggestedSpecs: string[];
  suggestedMarkers: string[];
};

const VERDICT_LABELS: Record<string, string> = {
  genuine: 'Genuine',
  likely_genuine: 'Likely Genuine',
  inconclusive: 'Inconclusive',
  likely_not_authentic: 'Likely Not Authentic',
};
const CONFIDENCE_LABELS: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const STATUS_LABELS: Record<string, string> = {
  consistent: 'Consistent',
  inconsistent: 'Inconsistent',
  unable_to_verify: 'Unable to Verify',
};

function buildPolishPrompt(
  data: AuthenticityReportData,
  record: { brand: string | null; model: string | null; serial_number: string | null },
): string {
  const specsLines = data.specs.length
    ? data.specs.map((s) => `- ${s.label || '(unlabeled)'}: expected "${s.expected || '—'}", observed "${s.observed || '—'}"`).join('\n')
    : '(none entered)';
  const markersLines = data.markers.length
    ? data.markers.map((m) => `- ${m.marker || '(unnamed)'}: ${STATUS_LABELS[m.status] || m.status} — ${m.note || '(no note)'}`).join('\n')
    : '(none entered)';
  const redFlagsLines = data.redFlags.none || data.redFlags.items.length === 0
    ? 'No red flags found.'
    : data.redFlags.items.map((f) => `- [${f.severity}] ${f.description || '(no description)'}`).join('\n');

  return [
    'You are an assistant for Coal Creek Guitars, helping a human expert write up a guitar authenticity report. You have two SEPARATE jobs, described below. Do not blend them.',
    '',
    'JOB 1 — Rewrite THREE specific pieces of text so they read as fuller, more polished, professional prose. The human expert has already fully evaluated this guitar and finalized every factual judgment given to you below.',
    'HARD RULES for Job 1 — do not break these:',
    '- Do not add, remove, or change any factual claim about this specific instrument beyond what is given below.',
    '- Do not change the verdict or confidence level — those are fixed inputs, not yours to interpret.',
    '- Do not mention price, value, resale, or market comps — this report has nothing to do with valuation.',
    '- If the human\'s current text for a field is very short, expand it into a few well-formed sentences that stay strictly grounded in the facts given below — do not pad with generic filler unrelated to those facts.',
    '- Voice: confident, plain-spoken, expert-to-owner. No hype, no exclamation points, no invented drama.',
    '',
    'JOB 2 — Suggest a CHECKLIST of things worth examining for this brand/model, based only on your general knowledge of the brand/model (not this specific instrument). These are prompts for the human to go check themselves — NOT findings, NOT claims about this particular guitar, NOT something you have inspected. Just names of relevant things to look at, e.g. "Headstock logo font", "Serial number format", "Hardware plating consistency". Suggest 4-6 specification items and 4-6 authenticity-marker items. If you have no genuine brand/model-specific knowledge to offer, return empty arrays rather than generic filler.',
    '',
    `Brand: ${record.brand || 'unknown'}`,
    `Model: ${record.model || 'unknown'}`,
    `Serial: ${record.serial_number || 'unknown'}`,
    `Verdict (fixed, do not change): ${VERDICT_LABELS[data.verdict.determination] || data.verdict.determination}`,
    `Confidence (fixed, do not change): ${CONFIDENCE_LABELS[data.verdict.confidence] || data.verdict.confidence}`,
    '',
    'Specifications checked so far:',
    specsLines,
    '',
    'Authenticity markers checked so far:',
    markersLines,
    '',
    'Red flags:',
    redFlagsLines,
    '',
    'Human\'s current text to expand/polish (Job 1):',
    `- Identity confidence statement: "${data.identity.confidenceStatement || '(empty)'}"`,
    `- Verdict reasoning: "${data.verdict.reasoning || '(empty)'}"`,
    `- Certificate summary: "${data.certificateSummary || '(empty)'}"`,
    '',
    'Return ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:',
    '{"confidenceStatement":"...","verdictReasoning":"...","certificateSummary":"...","suggestedSpecs":["...","..."],"suggestedMarkers":["...","..."]}',
  ].join('\n');
}

export async function polishAuthenticityReportText(
  data: AuthenticityReportData,
  record: { brand: string | null; model: string | null; serial_number: string | null },
  env: Env,
): Promise<AuthenticityPolishResult | null> {
  if (!env.ANTHROPIC_API_KEY) return null;

  const prompt = buildPolishPrompt(data, record);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.warn('Authenticity report AI polish failed', { status: response.status, body: bodyText.slice(0, 600) });
      return null;
    }

    const responseData = await response.json() as { content?: Array<{ type: string; text?: string }> };
    const rawOutput = responseData.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';
    // Strip markdown code fences in case the model wraps the JSON despite instructions not to
    const fenced = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const output = fenced ? fenced[1].trim() : rawOutput;

    let parsed: {
      confidenceStatement?: string;
      verdictReasoning?: string;
      certificateSummary?: string;
      suggestedSpecs?: unknown;
      suggestedMarkers?: unknown;
    };
    try {
      parsed = JSON.parse(output);
    } catch (parseErr) {
      console.warn('Authenticity report AI polish: could not parse model output as JSON', {
        rawOutput: rawOutput.slice(0, 1000),
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      return null;
    }

    const confidenceStatement = normalizeText(parsed.confidenceStatement, '').slice(0, 1200);
    const verdictReasoning = normalizeText(parsed.verdictReasoning, '').slice(0, 2000);
    const certificateSummary = normalizeText(parsed.certificateSummary, '').slice(0, 1500);

    if (!confidenceStatement || !verdictReasoning || !certificateSummary) {
      console.warn('Authenticity report AI polish: parsed JSON missing required fields', { parsed });
      return null;
    }

    // Best-effort — malformed or missing suggestions shouldn't fail the whole call
    const sanitizeSuggestions = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map((v) => v.trim().slice(0, 120))
        .slice(0, 8);
    };
    const suggestedSpecs = sanitizeSuggestions(parsed.suggestedSpecs);
    const suggestedMarkers = sanitizeSuggestions(parsed.suggestedMarkers);

    return { confidenceStatement, verdictReasoning, certificateSummary, suggestedSpecs, suggestedMarkers };
  } catch (error) {
    console.warn('Authenticity report AI polish error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
