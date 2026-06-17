import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { deriveRegexFromPatternKey } from '../serial/utils.js';
import { sanitizePatternContextList } from '../serial/db2.js';
import { buildStandardPatternLookupHtml, htmlToPromptText } from '../utils/html.js';

export async function maybeParaphrasePatternLookupHtml(
  brand: string,
  pattern: string,
  richHtml: string,
  env: Env,
): Promise<string | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  const rawSourceText = htmlToPromptText(richHtml);
  // Strip the boilerplate "Based on the provided regex ..." opener that AI tools often prepend
  const sourceText = rawSourceText.replace(/^Based on the provided regex\b[^.]*\.\s*/i, '').slice(0, 9000);
  if (!sourceText) return null;

  const regexPattern = deriveRegexFromPatternKey(pattern);
  const prompt = [
    `You are writing standardized serial-pattern guidance for Coal Creek Guitars.`,
    `Brand: ${brand}`,
    `Pattern key: ${pattern}`,
    `Regex pattern: ${regexPattern || '-'}`,
    '',
    'Rewrite the source material into original wording. Do not quote source text verbatim.',
    'Output concise, practical content for buyers decoding serial numbers.',
    'No dates or "as of" timestamps.',
    '',
    'Use this structure:',
    '1) overview paragraph',
    '2) serialStructure paragraph (how this pattern is typically read)',
    '3) keyIndicators bullet list',
    '4) caveats bullet list',
    '5) additionalInfo bullet list (use for overflow/extra details)',
    '6) one short Coal Creek Guitars note based on hands-on experience language',
    '',
    'Return JSON only — no markdown, no explanation.',
    '',
    'Source text:',
    sourceText,
  ].join('\n');

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.warn('Pattern rich-text paraphrase failed', { status: response.status, body: bodyText.slice(0, 600) });
      return null;
    }

    const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
    const output = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';
    const parsed = JSON.parse(output) as {
      overview?: string;
      serialStructure?: string;
      keyIndicators?: unknown;
      caveats?: unknown;
      additionalInfo?: unknown;
      coalCreekNote?: string;
    };

    const overview = normalizeText(parsed.overview, '').slice(0, 1200);
    const serialStructure = normalizeText(parsed.serialStructure, '').slice(0, 1400);
    const coalCreekNote = normalizeText(parsed.coalCreekNote, '').slice(0, 600);
    const keyIndicators = sanitizePatternContextList(parsed.keyIndicators, 12, 320);
    const caveats = sanitizePatternContextList(parsed.caveats, 10, 320);
    const additionalInfo = sanitizePatternContextList(parsed.additionalInfo, 16, 320);

    return buildStandardPatternLookupHtml({
      brand,
      overview,
      serialStructure,
      keyIndicators,
      caveats,
      additionalInfo,
      coalCreekNote,
    });
  } catch (error) {
    console.warn('Pattern rich-text paraphrase error', { error });
    return null;
  }
}
