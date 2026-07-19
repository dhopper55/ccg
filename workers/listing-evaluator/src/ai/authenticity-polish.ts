import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import type { AuthenticityReportData } from '../guitar-eval/authenticity-report.js';

export type AuthenticityPolishResult = {
  confidenceStatement: string;
  verdictReasoning: string;
  certificateSummary: string;
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
    'You are a writing assistant for Coal Creek Guitars. A human expert has already fully evaluated a guitar\'s authenticity and finalized every factual judgment below. Your ONLY job is to rewrite THREE specific pieces of text so they read as fuller, more polished, professional prose for a customer-facing report.',
    '',
    'HARD RULES — do not break these:',
    '- Do not add, remove, or change any factual claim about this specific instrument beyond what is given below.',
    '- Do not change the verdict or confidence level — those are fixed inputs, not yours to interpret.',
    '- Do not mention price, value, resale, or market comps — this report has nothing to do with valuation.',
    '- If the human\'s current text for a field is very short, expand it into a few well-formed sentences that stay strictly grounded in the facts given below — do not pad with generic filler unrelated to those facts.',
    '- Voice: confident, plain-spoken, expert-to-owner. No hype, no exclamation points, no invented drama.',
    '',
    `Brand: ${record.brand || 'unknown'}`,
    `Model: ${record.model || 'unknown'}`,
    `Serial: ${record.serial_number || 'unknown'}`,
    `Verdict (fixed, do not change): ${VERDICT_LABELS[data.verdict.determination] || data.verdict.determination}`,
    `Confidence (fixed, do not change): ${CONFIDENCE_LABELS[data.verdict.confidence] || data.verdict.confidence}`,
    '',
    'Specifications checked:',
    specsLines,
    '',
    'Authenticity markers checked:',
    markersLines,
    '',
    'Red flags:',
    redFlagsLines,
    '',
    'Human\'s current text to expand/polish:',
    `- Identity confidence statement: "${data.identity.confidenceStatement || '(empty)'}"`,
    `- Verdict reasoning: "${data.verdict.reasoning || '(empty)'}"`,
    `- Certificate summary: "${data.certificateSummary || '(empty)'}"`,
    '',
    'Return ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:',
    '{"confidenceStatement":"...","verdictReasoning":"...","certificateSummary":"..."}',
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
    const output = responseData.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';
    const parsed = JSON.parse(output) as {
      confidenceStatement?: string;
      verdictReasoning?: string;
      certificateSummary?: string;
    };

    const confidenceStatement = normalizeText(parsed.confidenceStatement, '').slice(0, 1200);
    const verdictReasoning = normalizeText(parsed.verdictReasoning, '').slice(0, 2000);
    const certificateSummary = normalizeText(parsed.certificateSummary, '').slice(0, 1500);

    if (!confidenceStatement || !verdictReasoning || !certificateSummary) return null;

    return { confidenceStatement, verdictReasoning, certificateSummary };
  } catch (error) {
    console.warn('Authenticity report AI polish error', { error });
    return null;
  }
}
