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
const CONFIDENCE_LABELS: Record<string, string> = {
  very_high: 'Very High',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  very_low: 'Very Low',
};
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
    'You have a web_search tool available. Use it — a handful of searches, not excessively — to look up general, publicly known information about this brand and model: typical factory specs for the era, authenticity markers and red flags collectors and experts watch for on this model, known counterfeits/reissues/reproductions, or historical production context. This general research is meant to make your writing more informed and specific to the brand/model.',
    'Do NOT search for, or make any claim about, this specific serial number or this individual instrument — there is no public record of one guitar, and the only facts you may state about THIS instrument are the ones given to you explicitly below.',
    '',
    'JOB 1 — Write THREE specific pieces of text as full, well-developed, professional prose. The human expert has already fully evaluated this guitar and finalized every structured factual judgment given to you below (specifications, markers, red flags, verdict, confidence). The three text fields below may already be blank, or may hold earlier AI-written text to refine further — either way, produce comprehensive, thorough paragraphs for each.',
    'HARD RULES for Job 1 — do not break these:',
    '- Do not add, remove, or change any factual claim about this specific instrument beyond what is given below. General brand/model context from web search is fine as background color, clearly framed as general knowledge, not as something you inspected on this unit.',
    '- Do not change the verdict or confidence level — those are fixed inputs, not yours to interpret.',
    '- Do not mention price, value, resale, or market comps — this report has nothing to do with valuation.',
    '- Favor length and substance over brevity: aim for several well-formed sentences per field (more if there is genuinely more grounded material to draw on), while staying strictly grounded in the facts given below — do not pad with filler unrelated to those facts.',
    '- Voice: confident, plain-spoken, expert-to-owner. No hype, no exclamation points, no invented drama.',
    '',
    'JOB 2 — Suggest a CHECKLIST of things worth examining for this brand/model, based on your general knowledge of the brand/model (not this specific instrument) — informed by the same web research. These are prompts for the human to go check themselves — NOT findings, NOT claims about this particular guitar, NOT something you have inspected. Just short names of relevant things to look at, e.g. "Headstock logo font", "Serial number format", "Hardware plating consistency". Suggest up to 5 specification items and up to 5 authenticity-marker items — fewer is fine. If you have no genuine brand/model-specific knowledge to offer, return empty arrays rather than generic filler.',
    '',
    `Brand: ${data.identity.brandConfirmed || record.brand || 'unknown'}`,
    `Model: ${data.identity.modelConfirmed || record.model || 'unknown'}`,
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
    'Human\'s current text to write or further refine (Job 1):',
    `- Identity confidence statement: "${data.identity.confidenceStatement || '(empty)'}"`,
    `- Verdict reasoning: "${data.verdict.reasoning || '(empty)'}"`,
    `- Certificate summary: "${data.certificateSummary || '(empty)'}"`,
    '',
    'Write plain prose only in the three text fields — no citation markup, no <cite> tags, no footnote markers or bracketed source numbers of any kind. This report is read by a customer, not a researcher; if a web search informed a sentence, just state it plainly.',
    '',
    'After you finish any web searches, return ONLY a JSON object as your final message text, no markdown fences, no explanation, in exactly this shape:',
    '{"confidenceStatement":"...","verdictReasoning":"...","certificateSummary":"...","suggestedSpecs":["...","..."],"suggestedMarkers":["...","..."]}',
  ].join('\n');
}

function extractJsonObject(rawOutput: string): string {
  // Strip markdown code fences in case the model wraps the JSON despite instructions not to
  const fenced = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // Fallback: grab the first {...} span in case of stray leading/trailing prose
  const braceMatch = rawOutput.match(/\{[\s\S]*\}/);
  return braceMatch ? braceMatch[0].trim() : rawOutput.trim();
}

type ParsedPolish = {
  confidenceStatement?: string;
  verdictReasoning?: string;
  certificateSummary?: string;
  suggestedSpecs?: unknown;
  suggestedMarkers?: unknown;
};

async function attemptPolish(
  prompt: string,
  env: Env,
): Promise<{ ok: true; result: AuthenticityPolishResult } | { ok: false; reason: string }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      stream: true,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    return { ok: false, reason: `HTTP ${response.status}: ${bodyText.slice(0, 600)}` };
  }

  // Streamed — a web-search turn can take a while (search + a second generation pass),
  // and streaming keeps the connection alive rather than risking a subrequest timeout.
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buf = '';
  let searchCount = 0;
  let stopReason = 'unknown';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const evt = JSON.parse(dataStr) as {
            type: string;
            content_block?: { type: string; name?: string };
            delta?: { type: string; text?: string; stop_reason?: string };
          };
          if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use' && evt.content_block.name === 'web_search') {
            searchCount++;
          } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            fullText += evt.delta.text;
          } else if (evt.type === 'message_delta' && evt.delta?.stop_reason) {
            stopReason = evt.delta.stop_reason;
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const rawOutput = fullText.trim();
  const output = extractJsonObject(rawOutput);

  let parsed: ParsedPolish;
  try {
    parsed = JSON.parse(output);
  } catch (parseErr) {
    return {
      ok: false,
      reason: `JSON parse failed (stop_reason=${stopReason}, searches=${searchCount}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Raw: ${rawOutput.slice(0, 500)}`,
    };
  }

  // Web search sometimes leaks inline citation markup (e.g. <cite index="2-1">...</cite>)
  // into the generated prose — strip the tags but keep the cited text itself.
  const stripCitations = (s: string): string => s.replace(/<\/?cite[^>]*>/gi, '');

  const confidenceStatement = stripCitations(normalizeText(parsed.confidenceStatement, '')).slice(0, 3000);
  const verdictReasoning = stripCitations(normalizeText(parsed.verdictReasoning, '')).slice(0, 5000);
  const certificateSummary = stripCitations(normalizeText(parsed.certificateSummary, '')).slice(0, 4000);

  if (!confidenceStatement || !verdictReasoning || !certificateSummary) {
    return { ok: false, reason: `Parsed JSON missing required fields: ${JSON.stringify(parsed).slice(0, 500)}` };
  }

  // Best-effort — malformed or missing suggestions shouldn't fail the whole call
  const sanitizeSuggestions = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => v.trim().slice(0, 120))
      .slice(0, 8);
  };

  return {
    ok: true,
    result: {
      confidenceStatement,
      verdictReasoning,
      certificateSummary,
      suggestedSpecs: sanitizeSuggestions(parsed.suggestedSpecs),
      suggestedMarkers: sanitizeSuggestions(parsed.suggestedMarkers),
    },
  };
}

export async function polishAuthenticityReportText(
  data: AuthenticityReportData,
  record: { brand: string | null; model: string | null; serial_number: string | null },
  env: Env,
): Promise<AuthenticityPolishResult | null> {
  if (!env.ANTHROPIC_API_KEY) return null;

  const prompt = buildPolishPrompt(data, record);

  // One retry — this is a cheap, fast call, and a single retry meaningfully improves
  // reliability against transient API errors or an occasional truncated/malformed response.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const outcome = await attemptPolish(prompt, env);
      if (outcome.ok) return outcome.result;
      console.warn(`Authenticity report AI polish failed (attempt ${attempt}/2)`, { reason: outcome.reason });
    } catch (error) {
      console.warn(`Authenticity report AI polish error (attempt ${attempt}/2)`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return null;
}
