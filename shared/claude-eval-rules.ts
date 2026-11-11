// Shared Claude evaluation rules, used by both:
// - the admin app (admin-v2-app/src/lib/claudeDesktopAnalysis.ts): the copy/paste prompts for
//   the inventory item's "AI Analysis & Listing Tools" dialog and the listing evaluator's
//   Claude eval dialog, and the Markdown-to-HTML reader for pasted replies;
// - the Worker's CCG Eval connector (workers/listing-evaluator/src/eval/): the evaluation_rules
//   text that get_current_item / get_item hand to Claude, and the Markdown rendering on save.
// Keep this file free of DOM and Worker APIs so both sides can import it. A pricing or wording
// change here applies to the paste prompts and the connector at the same time.

// How every prompt here should value an item: like Guitar Center would price it (store
// open-box/used prices, normal negotiating room), not as a private sale, and with no tax,
// fee or shipping adjustments.
export const SHOP_PRICING_RULE = [
  'How to price for my shop (this applies to the private party value and the quick flip buy price):',
  '- Price it like Guitar Center would. I am a retail music shop in the Denver area, not a private seller: buyers can come in, see the item and try it before they buy, just like at Guitar Center, so my price should match what Guitar Center (or Sam Ash / Sweetwater) charges for the same item in the same condition.',
  '- When I say "private party value in Denver metro", I mean the price I should list it at in my shop: the Guitar Center-style price.',
  "- New or sealed items: price like a store open-box item, just under new retail/MAP. Used items: price like Guitar Center's used price for that item and condition. Reverb and marketplace sold prices are a floor, not the target.",
  '- Negotiation works like it does at Guitar Center: I negotiate and so do they. List at the store price with the normal $20–$50 of room to come down on most items; do not pre-discount to a private-sale price.',
  '- Do not factor in sales tax, marketplace fees or shipping.',
  '- For a project item (needs repair, incomplete, disassembled), estimate the working store price, then discount fairly for the work and risk.',
  '- Quick flip buy price: no more than 70% of that shop price (a 30% margin), with no tax or fee adjustments.',
].join('\n');

export const EVAL_QUESTIONS =
  'Reverb sold range, realistic private party value in Denver metro, quick flip buy price (for 30% margin or more), and lastly, is this gear desirable - meaning do listings for this sit for a long time and are there a lot of them, or are they more rare and desirable?';

const LISTING_DEEP_LINE =
  'Take a deeper look at this one: take more time, check comps thoroughly, and look closely at authenticity, condition and anything in the photos that changes the value.';
const LISTING_QUICK_LINE = 'Keep this quick: a few comps is enough — do not grind on research.';
const LISTING_MULTI_LINE =
  'This listing has multiple items — cover each item briefly, then give totals for the whole lot.';

// Rules for writing an inventory listing (Build Listing). Field names match the JSON block of
// the paste flow and the `listing` argument of the connector's save_inventory_evaluation.
const LISTING_WRITING_RULES = [
  '- Do NOT mention price.',
  '- Do NOT mention my shop, shipping, local pickup, payment or trying it out — that is added separately. The listing is only about the item itself.',
  '- Target Facebook Marketplace for length and tone.',
  '- sale_title: a concise product title, no price, under 80 characters.',
  '- description: plain text, at least a couple of paragraphs about the item (what it is, features, sound/use, and condition from the photos and my notes), followed by a bulleted spec list if you have the specs. Separate paragraphs with a blank line and start each spec line with "• ". No markdown (no **, # or tables). A few emoji are fine but optional.',
  '- bullets: exactly 5 short selling points, each under 60 characters, separate from the description.',
];

const ITEM_FIELD_RULE =
  'The item fields are just bookkeeping: fill them from what you already found for the readout and do not do any extra research or searches for them. Use "" for anything you can\'t determine. model must not repeat the brand. serial_number only if it is legible in the photos. year_range: do not research the year — only if you found a serial number, try one quick decode (at most one lookup); if that does not settle it, leave it "". private_party_value is a whole-dollar number (0 if unknown).';

const LISTING_FIELD_RULE_TAIL =
  'fill it from what you already found and do not do any extra research for it. Use "" for anything you can\'t determine. model must not repeat the brand. year: only if you found a serial number, try one quick decode; otherwise leave it "".';

// Google Merchant Center product categories offered for inventory items.
export const MERCHANT_CENTER_CATEGORY_OPTIONS: { key: string; value: string }[] = [
  { key: 'MUSICAL_INSTRUMENT', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments' },
  { key: 'STRING_INSTRUMENT', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments' },
  { key: 'GUITAR', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Guitars' },
  { key: 'BASS_GUITAR', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Bass Guitars' },
  { key: 'UKULELE', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Ukuleles' },
  { key: 'BANJO', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Banjos' },
  { key: 'MANDOLIN', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Mandolins' },
  { key: 'VIOLIN', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Violins' },
  { key: 'VIOLA', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Violas' },
  { key: 'CELLO', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Cellos' },
  { key: 'DOUBLE_BASS', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Double Basses' },
  { key: 'HARP', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > String Instruments > Harps' },
  { key: 'KEYBOARD_INSTRUMENT', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments' },
  { key: 'PIANO', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments > Pianos' },
  { key: 'DIGITAL_PIANO', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments > Digital Pianos' },
  { key: 'SYNTHESIZER', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Keyboard Instruments > Synthesizers' },
  { key: 'DRUMS_AND_PERCUSSION', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Percussion' },
  { key: 'DRUM_SET', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Percussion > Drum Sets' },
  { key: 'CYMBAL', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Percussion > Cymbals' },
  { key: 'WIND_INSTRUMENT', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments' },
  { key: 'FLUTE', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Flutes' },
  { key: 'CLARINET', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Clarinets' },
  { key: 'SAXOPHONE', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Saxophones' },
  { key: 'TRUMPET', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Trumpets' },
  { key: 'TROMBONE', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Wind Instruments > Trombones' },
  { key: 'MUSICAL_INSTRUMENT_ACCESSORY', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories' },
  { key: 'STRINGS', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Strings' },
  { key: 'PICKS', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Plectrums' },
  { key: 'TUNER', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Tuners' },
  { key: 'METRONOME', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Metronomes' },
  { key: 'CAPO', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Capos' },
  { key: 'SLIDE', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Slides' },
  { key: 'STRAP', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Straps' },
  { key: 'CASE', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Cases' },
  { key: 'STAND', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Stands' },
  { key: 'EFFECTS_PEDAL', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Effects Pedals' },
  { key: 'PEDALBOARD', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Pedalboards' },
  { key: 'PICKUP', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Accessories > Pickups' },
  { key: 'AMPLIFIER', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Amplifiers' },
  { key: 'AMPLIFIER_HEAD', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Amplifiers' },
  { key: 'SPEAKER_CABINET', value: 'Arts & Entertainment > Hobbies & Creative Arts > Musical Instruments > Musical Instrument Amplifiers' },
  { key: 'MUSIC_BOOK', value: 'Media > Books > Music Books' },
  { key: 'SHEET_MUSIC', value: 'Media > Books > Sheet Music' },
];

// ---------------------------------------------------------------------------------------------
// Paste prompts (copied into Claude by the admin dialogs).
// ---------------------------------------------------------------------------------------------

// Prompt for the inventory item's "AI Analysis & Listing Tools" dialog. Always asks for an
// evaluation plus the item-field JSON; with buildListing it also asks for a listing, returned
// in the same JSON block. A previous analysis is included so Claude builds on it. Without
// includeImages, Claude is told to reuse the pictures already in that chat.
export function buildClaudeItemPrompt(options: {
  title: string;
  notes: string;
  previousAnalysis: string;
  categoryLines: string[];
  merchantCodes: string[];
  buildListing: boolean;
  includeImages: boolean;
}): string {
  const { title, notes, previousAnalysis, categoryLines, merchantCodes, buildListing, includeImages } = options;
  const titleLine = title
    ? `The item title is "${title}".`
    : 'There is no item title yet — identify the item from the pictures.';
  const photosLine = includeImages
    ? (buildListing ? "I've taken new, high-quality listing photos of it (attached)." : 'Pictures of it are attached.')
    : 'I have not attached new pictures this time — evaluate using the pictures already attached earlier in this chat, if there are any.';
  const evalText = itemEvalText(Boolean(previousAnalysis), 'below');
  const listingKeys = buildListing ? ',"sale_title":"","description":"","bullets":["","","","",""]' : '';
  return [
    `${titleLine} ${photosLine}${buildListing ? ' Please do two things:' : ''}`,
    '',
    ...(buildListing
      ? [
          `1. ${evalText}`,
          '',
          '2. Build a listing for the item:',
          ...LISTING_WRITING_RULES,
        ]
      : [evalText]),
    ...(notes.trim() ? ['', `Additional details: ${notes.trim()}`] : []),
    '',
    SHOP_PRICING_RULE,
    '',
    ...(buildListing
      ? ['Write the evaluation in your reply as normal, but put the listing ONLY in the JSON block — do not also write it out.']
      : []),
    `At the very end of your reply, add one \`\`\`json code block in exactly this shape, for my inventory system${buildListing ? ' (use \\n for line breaks inside strings)' : ''}. ${ITEM_FIELD_RULE}`,
    '```json',
    `{"title":"","brand":"","model":"","finish":"","year_range":"","serial_number":"","category":"","merchant_center_category":"","private_party_value":0${listingKeys}}`,
    '```',
    `category: copy one line exactly from this list: ${categoryLines.join('; ')}`,
    `merchant_center_category: one of: ${merchantCodes.join(', ')}`,
    ...(previousAnalysis ? ['', 'Previous analysis:', previousAnalysis] : []),
  ].join('\n');
}

// Prompt for evaluating a marketplace listing on the listing evaluator page. The asking
// price is deliberately left out (it is only there if the seller wrote it in the text).
export function buildClaudeListingEvalPrompt(options: {
  title: string;
  description: string;
  notes: string;
  deep: boolean;
  isMulti: boolean;
}): string {
  const { title, description, notes, deep, isMulti } = options;
  const titleLine = title
    ? `The listing title is "${title}".`
    : 'There is no listing title — identify the item from the pictures.';
  return [
    titleLine,
    ...(description.trim()
      ? [
          '',
          "Seller's listing description (these are the seller's claims — check them against the photos):",
          '"""',
          description.trim().slice(0, 4000),
          '"""',
        ]
      : []),
    '',
    `Do your own evaluation on this item based on the pictures. Give me a concise readout of the following: ${EVAL_QUESTIONS}`,
    ...(isMulti ? ['', LISTING_MULTI_LINE] : []),
    ...(notes.trim() ? ['', `Additional details: ${notes.trim()}`] : []),
    '',
    deep ? LISTING_DEEP_LINE : LISTING_QUICK_LINE,
    '',
    SHOP_PRICING_RULE,
    '',
    `At the very end of your reply, add a \`\`\`json code block in exactly this shape. This block is just bookkeeping: ${LISTING_FIELD_RULE_TAIL}`,
    '```json',
    '{"brand":"","model":"","year":""}',
    '```',
  ].join('\n');
}

function itemEvalText(hasPreviousAnalysis: boolean, where: 'below' | 'in previous_analysis'): string {
  return hasPreviousAnalysis
    ? `Re-evaluate the item. My previous analysis is ${where} — use it as your starting point and only research again where the pictures change your view (condition, details, authenticity, value). Give me a concise readout: ${EVAL_QUESTIONS} Note what changed from the previous analysis.`
    : `Do your own evaluation on this item based on the pictures (there is no previous analysis, so do a full evaluation). Give me a concise readout: ${EVAL_QUESTIONS}`;
}

// ---------------------------------------------------------------------------------------------
// Connector rules (returned by the CCG Eval connector's get_current_item / get_item).
// The same evaluation as the paste prompts; only the hand-back differs: Claude calls a save
// tool with the fields instead of ending its reply with a JSON block.
// ---------------------------------------------------------------------------------------------

const CONNECTOR_OPTION_WORDS = [
  'Options the owner may add after "eval" in their message:',
  '- "deep": take the deeper look described below (listings).',
  '- "build listing" or "listing": also write the listing (inventory items).',
  '- "overwrite": pass overwrite=true so fields that already have values are replaced.',
  '- "replace title": pass replace_title=true (inventory items).',
  '- "re-eval": evaluate again even if an analysis is already saved.',
  '- Any other words are extra details about the item: treat them as the owner\'s notes.',
];

export function buildConnectorListingRules(options: { isMulti: boolean }): string {
  return [
    'You are evaluating a marketplace listing for my shop. Look at the photos from get_item_photos; the title and seller_description fields are the seller\'s claims — check them against the photos. The asking price is context only.',
    '',
    `Do your own evaluation on this item based on the pictures. Give me a concise readout of the following: ${EVAL_QUESTIONS}`,
    ...(options.isMulti ? ['', LISTING_MULTI_LINE] : []),
    '',
    `If the owner said "deep": ${LISTING_DEEP_LINE}`,
    `Otherwise: ${LISTING_QUICK_LINE}`,
    '',
    SHOP_PRICING_RULE,
    '',
    ...CONNECTOR_OPTION_WORDS,
    '',
    'When the readout is done, call save_listing_evaluation once with:',
    '- listing_id: the id from this result (not whatever is open now).',
    '- analysis_markdown: the readout exactly as you showed it, in Markdown, with no JSON block.',
    `- brand, model, year: these are just bookkeeping: ${LISTING_FIELD_RULE_TAIL}`,
    '- private_party_value: your private party value as a whole-dollar number (omit it if unknown). For a multi-item lot, the total for the lot.',
    '- overwrite: true only if the owner said "overwrite".',
    'Then confirm the listing title and which fields were filled.',
  ].join('\n');
}

export function buildConnectorItemRules(options: {
  hasPreviousAnalysis: boolean;
  categoryLines: string[];
  merchantCodes: string[];
}): string {
  const { hasPreviousAnalysis, categoryLines, merchantCodes } = options;
  return [
    'You are evaluating an inventory item in my shop. Look at the photos from get_item_photos. The title and the other current field values are what I have entered so far.',
    '',
    itemEvalText(hasPreviousAnalysis, 'in previous_analysis'),
    '',
    'If the owner asked to "build listing" (or "listing"), also build a listing for the item:',
    ...LISTING_WRITING_RULES,
    'Write the evaluation in your reply as normal, but do not also write the listing out in the chat: it goes only in the save tool\'s listing argument.',
    '',
    SHOP_PRICING_RULE,
    '',
    ...CONNECTOR_OPTION_WORDS,
    '',
    'When the readout is done, call save_inventory_evaluation once with:',
    '- item_id, or draft_key for an item that has not been saved yet: from this result (not whatever is open now).',
    '- analysis_markdown: the readout exactly as you showed it, in Markdown, with no JSON block.',
    `- fields: title, brand, model, finish, year_range, serial_number, category, merchant_center_category, private_party_value. ${ITEM_FIELD_RULE}`,
    `- fields.category: copy one line exactly from this list: ${categoryLines.join('; ')}`,
    `- fields.merchant_center_category: one of: ${merchantCodes.join(', ')}`,
    '- listing: only when the owner asked to build a listing: { sale_title, description, bullets (exactly 5) }.',
    '- overwrite / replace_title: true only if the owner said so.',
    'The owner\'s admin page fills the form from what you saved; they review it and tap Save. Then confirm the item title and that the form is being filled.',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Markdown to the simple HTML the AI Analysis fields use. HTML in the input is escaped, links
// are reduced to their text, and tables become " — "-joined lines.
// ---------------------------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1');
}

// Convert the markdown Claude writes into the simple HTML the AI Analysis box uses.
export function claudeMarkdownToHtml(markdown: string): string {
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.join('<br>')}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  const openList = (type: 'ul' | 'ol') => {
    flushParagraph();
    if (list !== type) {
      closeList();
      html.push(`<${type}>`);
      list = type;
    }
  };

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || /^([-*_])\1{2,}$/.test(line) || /^\|?\s*:?-{2,}/.test(line)) {
      flushParagraph();
      closeList();
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const tag = heading[1].length <= 2 ? 'h3' : 'h4';
      html.push(`<${tag}>${inlineMarkdown(heading[2])}</${tag}>`);
      return;
    }
    const bullet = line.match(/^(?:[-*+•])\s+(.*)$/);
    if (bullet) {
      openList('ul');
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      return;
    }
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      openList('ol');
      html.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      return;
    }
    closeList();
    if (line.startsWith('|')) {
      const cells = line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => inlineMarkdown(cell.trim()));
      paragraph.push(cells.join(' — '));
      return;
    }
    paragraph.push(inlineMarkdown(line));
  });
  flushParagraph();
  closeList();
  return html.join('');
}

// Strip a trailing ```json block (or a bare {...} object at the very end) from Claude's
// Markdown, in case it added one out of habit. The connector passes fields as tool arguments.
export function stripTrailingJsonBlock(markdown: string): string {
  return markdown
    .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```\s*$/i, '')
    .trimEnd();
}
