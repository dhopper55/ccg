import type { Env } from '../env.js';
import { normalizeText } from '../utils/text.js';
import { getBrevoRuntimeConfig } from '../system/runtime.js';
import { sendBrevoTransactionalEmail } from '../orders/email.js';

export const GUITAR_EVAL_REPORT_SYSTEM_PROMPT = `You are generating a professional instrument valuation report for Coal Creek Guitars. Using the photos and instrument details provided, produce one complete, self-contained HTML document.

## CRITICAL OUTPUT RULES

- Output ONLY raw HTML — no markdown code fences, no explanation, no preamble. The very first character must be < and the output must end with </html>.
- Self-contained: all CSS inline in a <style> block in <head>. No external CSS links except Google Fonts.
- For images, use placeholder tokens as img src values: {{PHOTO_0}}, {{PHOTO_1}}, {{PHOTO_2}}, etc. You MUST use every token from {{PHOTO_0}} through {{PHOTO_N-1}} where N is the total number of photos provided — include ALL of them, never skip any. Choose the best full-front shot for the hero and reference it as {{PHOTO_HERO}}. Do NOT output any base64 data.
- Do NOT include any note, caption, or paragraph suggesting additional photos are needed or recommended. The customer has already submitted all available photos.
- Use web search to research current market pricing for this specific instrument — search Reverb, eBay, Guitar Center, dealer sites. Always distinguish listed (asking) vs. sold (completed) prices. Do NOT rely on memory for prices.

## STRUCTURE (6 HTML sections + 1 JSON block)

01 Identity — instrument ID, hero photo, confidence statement
02 Photos — masonry gallery containing every provided photo (all N tokens); each image gets a caption; include no fewer and no more photos than were provided
03 Specs — two-column spec table
04 Market — comparable sales table (listed vs. sold, with source/status/price/notes columns)
05 Valuation — three channel cards (dealer, private local, national Reverb)
06 Helps & Hurts — two columns (adds value / caps value)
07 Listing (JSON only — no HTML section body) — immediately before </body>, output this exact element:
<script type="application/json" id="listing-data">{"year":"YYYY","model_confirmed":"Full confirmed model name","asking_price":"$XXX","top_sells":["top selling point 1","top selling point 2","top selling point 3"]}</script>

Include a sticky jump-nav above section 01 with links to all 7 sections (01–07). The 07 nav link must be: <a href="#listing">07 Listing</a>

## PALETTE & FONTS

Load these from Google Fonts: Fraunces (display/headings), Hanken Grotesk (body), JetBrains Mono (labels/data).

Use exactly these CSS variables:
:root {
  --paper:#F4EFE4; --paper-2:#ECE5D5; --paper-3:#E4DAC6;
  --ink:#15181E; --ink-soft:#2C323C;
  --creek:#235A6E; --creek-deep:#1B3957;
  --brass:#A9823B; --brass-bright:#C79A47;
  --clay:#9A4628; --green:#3F6B3A; --muted:#6E6557;
  --line:rgba(21,24,30,.15); --line-soft:rgba(21,24,30,.08);
  --display:'Fraunces',Georgia,serif;
  --sans:'Hanken Grotesk',-apple-system,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}

Background: warm parchment (--paper). Masthead & footer: coal ink (--ink). Stats bar: --ink-soft with brass top border. Accent: creek blue and brass/gold.

Style the top notice like this: .top-notice { font-family:var(--mono); font-size:11px; color:var(--muted); line-height:1.5; padding:8px 12px; border:1px solid var(--line); border-radius:3px; margin:12px 0 20px; } .top-notice a { color:var(--muted); text-decoration:underline; }

## MASTHEAD

- Brand line: "Instrument Dossier" / "Coal Creek Guitar Appraisal & Market Valuation"
- REF = serial number (or "—" if unknown)
- ISSUED = today's date
- REGION = owner's location

## STAT BANNER (4 headline numbers, ink-soft background, brass top border)

New/street price · Reverb recent sold · Private/local estimate · Dealer cash offer

## TOP NOTICE (include verbatim immediately after the jump-nav, before section 01)

<p class="top-notice"><strong style="color:var(--clay);">DISCLAIMER</strong> — This report is a good-faith market estimate prepared by Coal Creek Guitars for informational purposes only — not a certified appraisal, not a binding offer to buy or sell. Values reflect market conditions at time of writing and may change. <a href="#disclaimer">Full disclaimer below.</a></p>

## FOOTER DISCLAIMER (include verbatim at bottom of every report)

<div class="legal" id="disclaimer"><h4>Disclaimer</h4><p>This report is a subjective, good-faith estimate prepared by Coal Creek Guitars for general informational and planning purposes only. It is meant to be used as a tool and a guide — not gospel, not a certified or insurance appraisal, and not a binding offer to buy, sell, or consign. Every identification, specification, and value is based on the photographs and information provided to us, on third-party listings and sales data, and on market conditions at the time of writing — all of which may be incomplete, may change quickly, and may contain errors. Actual results depend on many factors outside our control, including the instrument's true condition, authenticity, originality, demand, timing, location, and exactly how and where it is ultimately sold. Coal Creek Guitars makes no representation or warranty, express or implied, as to the accuracy or completeness of this report, and accepts no liability for any loss, decision, or outcome arising from reliance on it. Always confirm the items flagged for verification, and for insurance, resale, or legal purposes obtain a certified independent appraisal.</p></div>

## VOICE

Confident, plain-spoken, dealer-savvy. Always distinguish listed vs. sold prices. Give ranges, not false precision. Flag unknowns honestly. Mention selling fees and friction.`;

export function buildGuitarEvalPrompt(
  record: {
    brand: string | null;
    brand_other: string | null;
    model: string | null;
    serial_number: string | null;
    includes_case: string | null;
    location: string | null;
    note: string | null;
    damage: string | null;
    color_finish: string | null;
  },
  photoCount: number,
): string {
  const brand = record.brand === 'Other'
    ? (record.brand_other || 'Unknown')
    : (record.brand || 'Unknown');
  const includesCase = record.includes_case === 'hard_case' ? 'Original hard case'
    : record.includes_case === 'gig_bag' ? 'Gig bag'
    : record.includes_case === 'no' ? 'No case'
    : 'Unknown';
  const photoTokens = Array.from({ length: photoCount }, (_, i) => `{{PHOTO_${i}}}`).join(', ');
  const photoInstr = photoCount > 0
    ? `${photoCount} photos are attached. You MUST place ALL ${photoCount} of the following tokens as img src values in the Section 02 gallery — every single one, no exceptions: ${photoTokens}. Each token must appear exactly once in the gallery. {{PHOTO_HERO}} must equal whichever token is the best full-front shot.`
    : 'No photos provided.';

  return `Generate the Coal Creek Guitars valuation report for this instrument.

PHOTOS: ${photoInstr}

INSTRUMENT DETAILS:
Brand: ${brand}
Model (or "unsure"): ${record.model || 'unsure'}
Instrument type: electric guitar (confirm from photos if possible)
Serial number: ${record.serial_number || 'unknown'}
Year (if known): unknown — decode from serial if possible
Finish / color (owner's description — not verified, use as a clue only): ${record.color_finish || 'unknown'}
Weight in lbs: unknown
Location: ${record.location || 'unknown'}
Overall condition: ${record.note || 'not specified'}
Known damage / repairs: ${record.damage || 'none noted by owner'}
Included extras: ${includesCase}
Additional owner notes: ${record.note || 'none'}

Search the web for current market pricing. Limit yourself to no more than 3 web searches total. Output only the complete HTML document — nothing else. Do NOT write any text, explanation, or preamble before the opening <!DOCTYPE html> tag.`;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

type AnthropicTextContent = { type: 'text'; text: string };
export type AnthropicImageContent = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
export type AnthropicUserContent = AnthropicTextContent | AnthropicImageContent;

type ReportGenResult = { html: string; inputTokens: number; outputTokens: number; searchCount: number };

export async function callAnthropicForReport(userContent: AnthropicUserContent[], env: Env): Promise<ReportGenResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 15000,
      stream: true,
      system: GUITAR_EVAL_REPORT_SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${errorBody}`);
  }

  console.log('[report-gen] Anthropic stream open, reading…');

  // Parse SSE stream — keeps the connection alive as Claude generates
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buf = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let searchCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data) as {
            type: string;
            message?: { usage?: { input_tokens?: number } };
            content_block?: { type: string; name?: string };
            delta?: { type: string; text?: string };
            usage?: { output_tokens?: number; input_tokens?: number };
          };
          if (evt.type === 'message_start' && evt.message?.usage?.input_tokens) {
            inputTokens = evt.message.usage.input_tokens;
          } else if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use' && evt.content_block.name === 'web_search') {
            searchCount++;
          } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            fullText += evt.delta.text;
          } else if (evt.type === 'message_delta') {
            if (evt.usage?.output_tokens) outputTokens = evt.usage.output_tokens;
            // Capture cumulative input tokens if Anthropic reports them here (covers tool-result turns)
            if (evt.usage?.input_tokens) inputTokens = evt.usage.input_tokens;
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log(`[report-gen] stream complete — ${inputTokens} in / ${outputTokens} out / ${searchCount} searches`);

  const fenced = fullText.trim().match(/```(?:html)?\s*([\s\S]*?)```/);
  const html = fenced ? fenced[1].trim() : fullText.trim();
  return { html, inputTokens, outputTokens, searchCount };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildListingSection(
  data: { year: string; model_confirmed: string; asking_price: string; top_sells: string[] },
  record: { color_finish: string | null; includes_case: string | null; location: string | null },
): string {
  const caseStr = record.includes_case === 'hard_case' ? 'hard case'
    : record.includes_case === 'gig_bag' ? 'gig bag'
    : null;

  const titleParts = [data.year, data.model_confirmed];
  if (record.color_finish) titleParts.push(`· ${record.color_finish}`);
  if (caseStr) titleParts.push(`— w/ ${caseStr}`);
  const title = titleParts.join(' ');

  const bullets = data.top_sells.map((s) => `• ${s}`).join('\n');
  const location = record.location || 'location on request';

  const desc = `${data.year} ${data.model_confirmed}${record.color_finish ? ` in ${record.color_finish}` : ''}.

${bullets}

${caseStr ? `Includes ${caseStr}. ` : ''}Located in ${location}. Asking ${data.asking_price} — reasonable offers considered. Local pickup preferred or will ship.`;

  return `
  <div style="max-width:1100px;margin:0 auto;padding:0 2rem;">
  <section id="listing" style="padding:3rem 0 2rem;">
    <div class="section-head">
      <span class="section-num">07</span>
      <h2 class="section-title">Listing</h2>
    </div>
    <div style="display:flex;flex-direction:column;gap:1.25rem;margin-top:.25rem;">
      <div style="background:var(--creek-deep);border-radius:6px;padding:1.25rem 1.5rem;">
        <div style="font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:.5rem;">Suggested Title</div>
        <div style="font-family:var(--display);font-size:1.05rem;font-weight:600;color:#fff;line-height:1.3;">${escHtml(title)}</div>
      </div>
      <div style="background:var(--paper-2);border:1px solid var(--line);border-radius:6px;padding:1.5rem;">
        <div style="font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--brass);margin-bottom:.75rem;">Copy-Ready Description</div>
        <div style="font-size:.9rem;color:var(--ink);line-height:1.7;white-space:pre-wrap;">${escHtml(desc)}</div>
      </div>
    </div>
  </section>
  </div>`;
}

export async function runGuitarEvalReportGeneration(id: number, env: Env): Promise<void> {
  try {
    console.log(`[report-gen] starting for evaluation ${id}`);

    const row = await env.DB.prepare(
      `SELECT id, brand, brand_other, model, serial_number, includes_case,
              location, note, damage, color_finish, image_keys, report_guid
       FROM guitar_evaluations WHERE id = ?`,
    ).bind(id).first<{
      id: number;
      brand: string | null;
      brand_other: string | null;
      model: string | null;
      serial_number: string | null;
      includes_case: string | null;
      location: string | null;
      note: string | null;
      damage: string | null;
      color_finish: string | null;
      image_keys: string | null;
      report_guid: string | null;
    }>();
    if (!row) { console.log(`[report-gen] evaluation ${id} not found`); return; }

    // Fetch photos from R2, convert to base64
    const photoContent: AnthropicImageContent[] = [];
    const photoKeys: string[] = [];

    if (row.image_keys) {
      let keys: string[] = [];
      try { keys = JSON.parse(row.image_keys); } catch { /* ignore */ }
      let totalBytes = 0;
      const MAX_BYTES = 8 * 1024 * 1024;

      for (const key of keys) {
        if (photoContent.length >= 5 || totalBytes >= MAX_BYTES) break;
        const obj = await env.CUSTOM_ITEMS_BUCKET!.get(key);
        if (!obj) continue;
        const buffer = await obj.arrayBuffer();
        if (totalBytes + buffer.byteLength > MAX_BYTES) continue;
        totalBytes += buffer.byteLength;
        const base64 = arrayBufferToBase64(buffer);
        const mediaType = (obj.httpMetadata?.contentType || 'image/jpeg') as
          'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        photoContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
        photoKeys.push(key);
      }
    }

    console.log(`[report-gen] fetched ${photoContent.length} photo(s), calling Anthropic`);

    const promptText = buildGuitarEvalPrompt(row, photoContent.length);
    const userContent: AnthropicUserContent[] = [...photoContent, { type: 'text', text: promptText }];

    const { html: rawHtml, inputTokens, outputTokens, searchCount } = await callAnthropicForReport(userContent, env);

    // Sonnet 4.6: $3/M input, $15/M output, $0.01/search + $0.02 offset for web-search result tokens not captured in stream
    const reportCost = Math.round(((inputTokens * 3 + outputTokens * 15) / 1_000_000 + searchCount * 0.01 + 0.02) * 10000) / 10000;
    console.log(`[report-gen] cost $${reportCost} — ${inputTokens} in / ${outputTokens} out / ${searchCount} searches`);

    // Strip any preamble text before the HTML document starts
    let html = rawHtml;
    const htmlStart = html.indexOf('<!DOCTYPE html>') !== -1
      ? html.indexOf('<!DOCTYPE html>')
      : html.indexOf('<html');
    if (htmlStart > 0) html = html.slice(htmlStart);

    console.log(`[report-gen] Anthropic returned ${html.length} chars`);

    // Replace photo tokens with working image URLs
    photoKeys.forEach((key, i) => {
      const url = `/api/guitar-evaluation-image?key=${encodeURIComponent(key)}`;
      html = html.replaceAll(`{{PHOTO_${i}}}`, url);
    });
    if (photoKeys.length > 0) {
      html = html.replaceAll(
        '{{PHOTO_HERO}}',
        `/api/guitar-evaluation-image?key=${encodeURIComponent(photoKeys[0])}`,
      );
    }

    // Extract listing JSON from model output and inject templated Section 07
    const listingMatch = html.match(/<script type="application\/json" id="listing-data">([\s\S]*?)<\/script>/);
    if (listingMatch) {
      try {
        const listingData = JSON.parse(listingMatch[1]) as {
          year: string; model_confirmed: string; asking_price: string; top_sells: string[];
        };
        const listingHtml = buildListingSection(listingData, {
          color_finish: row.color_finish,
          includes_case: row.includes_case,
          location: row.location,
        });
        html = html.replace(listingMatch[0], '');
        // Inject before the footer disclaimer div first, then the footer element,
        // then </main> (Claude often puts the footer inside <main>), then </body> as last resort.
        if (html.includes('<div class="legal"')) {
          html = html.replace('<div class="legal"', listingHtml + '\n<div class="legal"');
        } else if (html.includes('<footer')) {
          html = html.replace('<footer', listingHtml + '\n<footer');
        } else if (html.includes('</main>')) {
          html = html.replace('</main>', listingHtml + '\n  </main>');
        } else {
          html = html.replace('</body>', listingHtml + '\n</body>');
        }
        console.log('[report-gen] listing section injected');
      } catch {
        console.log('[report-gen] listing JSON parse failed — section 07 skipped');
      }
    }

    const guid = row.report_guid || crypto.randomUUID();
    const r2Key = `guitar-eval-reports/${guid}.html`;

    await env.CUSTOM_ITEMS_BUCKET!.put(r2Key, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    });

    await env.DB.prepare(
      'UPDATE guitar_evaluations SET report_r2_key = ?, report_guid = ?, report_cost = ?, report_error = NULL WHERE id = ?',
    ).bind(r2Key, guid, reportCost, id).run();

    console.log(`[report-gen] done — guid ${guid}`);

    // Send report-ready email with the finished HTML attached
    try {
      const emailRow = await env.DB.prepare(
        `SELECT first_name, email FROM guitar_evaluations WHERE id = ?`,
      ).bind(id).first<{ first_name: string | null; email: string | null }>();

      if (emailRow?.email) {
        const config = await getBrevoRuntimeConfig(env);
        if (config.apiKey && config.senderEmail) {
          const resolvedFirstName = normalizeText(emailRow.first_name, '') || 'there';

          // Upsert Brevo contact
          await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'api-key': config.apiKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              email: emailRow.email,
              attributes: { FIRSTNAME: resolvedFirstName },
              updateEnabled: true,
            }),
          });

          // Make image URLs absolute so they resolve when the attachment is opened from an email client
          const siteBase = (env.SITE_BASE_URL || 'https://www.coalcreekguitars.com').replace(/\/$/, '');
          const emailHtml = html.replaceAll('/api/guitar-evaluation-image?', `${siteBase}/api/guitar-evaluation-image?`);

          // Base64-encode the HTML for the attachment
          const htmlBytes = new TextEncoder().encode(emailHtml);
          const htmlBase64 = arrayBufferToBase64(htmlBytes.buffer);

          await sendBrevoTransactionalEmail(config, {
            sender: { name: config.senderName, email: config.senderEmail },
            to: [{ email: emailRow.email, name: resolvedFirstName }],
            templateId: 5,
            attachment: [{ content: htmlBase64, name: 'guitar-valuation-report.html' }],
          });

          console.log(`[report-gen] report-ready email sent to ${emailRow.email}`);
        }
      }
    } catch (err) {
      console.error(`[report-gen] email send failed for evaluation ${id}:`, err);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[report-gen] failed for evaluation ${id}:`, msg);
    try {
      await env.DB.prepare(
        'UPDATE guitar_evaluations SET report_error = ? WHERE id = ?',
      ).bind(msg.slice(0, 1000), id).run();
    } catch { /* ignore secondary failure */ }
  }
}
