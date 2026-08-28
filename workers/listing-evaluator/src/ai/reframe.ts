import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';

export type ReframeResult = { title: string; description: string };

function buildReframePrompt(title: string, description: string): string {
  return [
    'You are helping Coal Creek Guitars re-word a marketplace listing that is being deleted and reposted with new photos.',
    'Say the same thing in different words: same facts, same overall message and length, just reworded so this post reads differently from the one it is replacing.',
    '',
    'Rules:',
    '- Do not add, remove, or invent any factual claim (brand, model, specs, condition, price, dimensions, etc.) beyond what is in the source text below.',
    '- Keep the same tone and the same level of detail.',
    '- Keep the new title and description roughly the same length as the originals.',
    '- The title stays a concise product title, not a full sentence.',
    '- Return JSON only — no markdown, no explanation — in exactly this shape: {"title":"...","description":"..."}',
    '',
    'Current title:',
    title,
    '',
    'Current description:',
    description,
  ].join('\n');
}

async function attemptReframe(prompt: string, env: Env): Promise<ReframeResult | null> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    console.warn('Sale title/description reframe failed', { status: response.status, body: bodyText.slice(0, 600) });
    return null;
  }

  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const output = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? '';

  let parsed: { title?: string; description?: string };
  try {
    parsed = JSON.parse(output);
  } catch {
    console.warn('Sale title/description reframe returned unparseable JSON', { output: output.slice(0, 600) });
    return null;
  }

  const title = normalizeText(parsed.title, '').slice(0, 200);
  const description = normalizeText(parsed.description, '').slice(0, 12000);
  if (!title || !description) return null;

  return { title, description };
}

export async function reframeSaleTitleAndDescription(
  title: string,
  description: string,
  env: Env,
): Promise<ReframeResult | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  const prompt = buildReframePrompt(title, description);

  // One retry — this is a cheap, fast call, and a single retry meaningfully improves
  // reliability against transient API errors or an occasional malformed JSON response.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await attemptReframe(prompt, env);
      if (result) return result;
    } catch (error) {
      console.warn(`Sale title/description reframe error (attempt ${attempt}/2)`, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
}
