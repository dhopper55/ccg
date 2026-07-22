import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';

export type ParsedChecklist = {
  specs: { label: string; expected: string }[];
  markers: string[];
};

function buildParsePrompt(
  text: string,
  record: { brand: string | null; model: string | null },
): string {
  return [
    'You are helping parse pasted text into two structured lists for a guitar authenticity report checklist.',
    '',
    'The text below was pasted in by a human. It is the output of a DIFFERENT AI tool that was asked to name specifications to check and authenticity markers to check for a specific guitar brand/model. It may be numbered, bulleted, or plain prose, and may not cleanly separate the two lists.',
    '',
    `Context — brand: ${record.brand || 'unknown'}, model: ${record.model || 'unknown'}.`,
    '',
    'Extract exactly two things from the pasted text, using ONLY what is actually present — do not invent additional items beyond what is given:',
    '1. "specs": specifications worth checking, each with a short "label" (the name of the thing to check) and an "expected" value (the correct/typical value for this model, if the text states one — leave "expected" as an empty string if no expected value is given for that item).',
    '2. "markers": authenticity markers worth checking — short names only (e.g. "Headstock logo font", "Serial number format"), no expected values needed.',
    '',
    'Cap each list at 8 items.',
    '',
    'Return ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:',
    '{"specs":[{"label":"...","expected":"..."}],"markers":["...","..."]}',
    '',
    'Pasted text:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

function extractJsonObject(rawOutput: string): string {
  const fenced = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const braceMatch = rawOutput.match(/\{[\s\S]*\}/);
  return braceMatch ? braceMatch[0].trim() : rawOutput.trim();
}

async function attemptParse(
  prompt: string,
  env: Env,
): Promise<{ ok: true; result: ParsedChecklist } | { ok: false; reason: string }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    return { ok: false, reason: `HTTP ${response.status}: ${bodyText.slice(0, 600)}` };
  }

  const responseData = await response.json() as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };
  const rawOutput = responseData.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';
  const output = extractJsonObject(rawOutput);

  let parsed: { specs?: unknown; markers?: unknown };
  try {
    parsed = JSON.parse(output);
  } catch (parseErr) {
    return {
      ok: false,
      reason: `JSON parse failed (stop_reason=${responseData.stop_reason ?? 'unknown'}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Raw: ${rawOutput.slice(0, 500)}`,
    };
  }

  const specs = Array.isArray(parsed.specs)
    ? parsed.specs
        .filter((s): s is { label?: unknown; expected?: unknown } => typeof s === 'object' && s !== null)
        .map((s) => ({
          label: normalizeText((s as { label?: unknown }).label, '').slice(0, 120),
          expected: normalizeText((s as { expected?: unknown }).expected, '').slice(0, 300),
        }))
        .filter((s) => s.label !== '')
        .slice(0, 8)
    : [];

  const markers = Array.isArray(parsed.markers)
    ? parsed.markers
        .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
        .map((m) => m.trim().slice(0, 120))
        .slice(0, 8)
    : [];

  if (specs.length === 0 && markers.length === 0) {
    return { ok: false, reason: `No specs or markers extracted from pasted text: ${JSON.stringify(parsed).slice(0, 500)}` };
  }

  return { ok: true, result: { specs, markers } };
}

export async function parseAuthenticityChecklistText(
  text: string,
  record: { brand: string | null; model: string | null },
  env: Env,
): Promise<ParsedChecklist | null> {
  if (!env.ANTHROPIC_API_KEY) return null;

  const prompt = buildParsePrompt(text, record);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const outcome = await attemptParse(prompt, env);
      if (outcome.ok) return outcome.result;
      console.warn(`Authenticity checklist parse failed (attempt ${attempt}/2)`, { reason: outcome.reason });
    } catch (error) {
      console.warn(`Authenticity checklist parse error (attempt ${attempt}/2)`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return null;
}
