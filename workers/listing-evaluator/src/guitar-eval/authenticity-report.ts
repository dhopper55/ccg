import type { Env } from '../env.js';
import { jsonResponse } from '../utils/misc.js';
import { normalizeText } from '../utils/text.js';
import { getBrevoRuntimeConfig } from '../system/runtime.js';
import { sendBrevoTransactionalEmail } from '../orders/email.js';
import { escHtml } from './report.js';
import { polishAuthenticityReportText } from '../ai/authenticity-polish.js';
import { parseAuthenticityChecklistText } from '../ai/authenticity-checklist-parse.js';

// ── Types ──────────────────────────────────────────────────────────────────
export type AuthenticityIdentity = {
  brandConfirmed: string;
  modelConfirmed: string;
  yearConfirmed: string;
  variantNotes: string;
  confidenceStatement: string;
};

export type AuthenticitySpecRow = { label: string; expected: string; observed: string };

export type AuthenticityMarkerStatus = 'consistent' | 'inconsistent' | 'unable_to_verify';
export type AuthenticityMarkerRow = { marker: string; status: AuthenticityMarkerStatus; note: string };

export type AuthenticitySeverity = 'minor' | 'moderate' | 'major';
export type AuthenticityRedFlagRow = { description: string; severity: AuthenticitySeverity };

export type AuthenticityVerdictValue = 'genuine' | 'likely_genuine' | 'inconclusive' | 'likely_not_authentic';
export type AuthenticityConfidence = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

export type AuthenticityReportData = {
  identity: AuthenticityIdentity;
  specs: AuthenticitySpecRow[];
  markers: AuthenticityMarkerRow[];
  redFlags: { none: boolean; items: AuthenticityRedFlagRow[] };
  verdict: {
    determination: AuthenticityVerdictValue;
    confidence: AuthenticityConfidence;
    reasoning: string;
    raiseConfidenceNote: string;
  };
  certificateSummary: string;
};

type EvalRecordForAuthReport = {
  brand: string | null;
  brand_other: string | null;
  model: string | null;
  serial_number: string | null;
  includes_case: string | null;
  location: string | null;
};

const VERDICT_LABELS: Record<AuthenticityVerdictValue, string> = {
  genuine: 'Genuine',
  likely_genuine: 'Likely Genuine',
  inconclusive: 'Inconclusive',
  likely_not_authentic: 'Likely Not Authentic',
};
const VERDICT_COLOR_VAR: Record<AuthenticityVerdictValue, string> = {
  genuine: 'var(--green)',
  likely_genuine: 'var(--green)',
  inconclusive: 'var(--brass-bright)',
  likely_not_authentic: 'var(--clay)',
};
const CONFIDENCE_LABELS: Record<AuthenticityConfidence, string> = {
  very_high: 'Very High',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  very_low: 'Very Low',
};
const STATUS_LABELS: Record<AuthenticityMarkerStatus, string> = {
  consistent: 'Consistent',
  inconsistent: 'Inconsistent',
  unable_to_verify: 'Unable to Verify',
};
const STATUS_TAG_CLASS: Record<AuthenticityMarkerStatus, string> = {
  consistent: 'ok',
  inconsistent: 'bad',
  unable_to_verify: 'unk',
};
const SEVERITY_LABELS: Record<AuthenticitySeverity, string> = { minor: 'Minor', moderate: 'Moderate', major: 'Major' };
const SEVERITY_TAG_CLASS: Record<AuthenticitySeverity, string> = { minor: 'unk', moderate: 'mod', major: 'bad' };

function formatIssuedDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${day} ${month} ${d.getFullYear()}`;
}

function resolvedBrand(record: EvalRecordForAuthReport): string {
  if (record.brand === 'Other' && record.brand_other) return record.brand_other;
  return record.brand || '—';
}

function includesCaseLabel(includesCase: string | null): string {
  if (includesCase === 'hard_case') return 'Hard Case';
  if (includesCase === 'gig_bag') return 'Gig Bag';
  return 'No Case';
}

// ── Deterministic HTML template (no AI, no external calls) ─────────────────
export function buildAuthenticityReportHtml(
  data: AuthenticityReportData,
  record: EvalRecordForAuthReport,
  photoUrls: string[],
): string {
  const markersChecked = data.markers.length;
  const redFlagsFound = data.redFlags.none ? 0 : data.redFlags.items.length;
  const verdictLabel = VERDICT_LABELS[data.verdict.determination];
  const verdictColor = VERDICT_COLOR_VAR[data.verdict.determination];
  const confidenceLabel = CONFIDENCE_LABELS[data.verdict.confidence];
  const issuedDate = formatIssuedDate(new Date());
  const modelTitle = data.identity.modelConfirmed || record.model || 'Guitar';
  const brandTitle = data.identity.brandConfirmed || resolvedBrand(record);
  const subParts = [data.identity.variantNotes, data.identity.yearConfirmed].filter(Boolean).join(' — ');

  const CHECK_OK = '<span class="check-ok">✓</span>';

  const specsRows = data.specs.map((row) => {
    const observedHtml = row.observed.trim() ? escHtml(row.observed) : CHECK_OK;
    return `
        <div class="spec-row"><dt>${escHtml(row.label || '—')}</dt><dd><strong>Expected:</strong> ${escHtml(row.expected || '—')} &nbsp;·&nbsp; <strong>Observed:</strong> ${observedHtml}</dd></div>`;
  }).join('');

  const markersRows = data.markers.map((row) => {
    const noteHtml = row.note.trim() ? escHtml(row.note) : CHECK_OK;
    return `
        <tr>
          <td class="feat">${escHtml(row.marker || '—')}</td>
          <td><span class="tag ${STATUS_TAG_CLASS[row.status]}">${STATUS_LABELS[row.status]}</span></td>
          <td>${noteHtml}</td>
        </tr>`;
  }).join('');

  const redFlagsHtml = data.redFlags.none || data.redFlags.items.length === 0
    ? `
      <div class="clean-callout">
        <div class="ck">✓</div>
        <div>
          <h3>No red flags found</h3>
          <p>Nothing examined contradicts authenticity based on the information and photos provided.</p>
        </div>
      </div>`
    : `
      <div class="redflags-list">
        ${data.redFlags.items.map((f) => `
        <div class="redflag-item">
          <span class="tag ${SEVERITY_TAG_CLASS[f.severity]}">${SEVERITY_LABELS[f.severity]}</span>
          <span>${escHtml(f.description || '—')}</span>
        </div>`).join('')}
      </div>`;

  const photosHtml = photoUrls.length > 0
    ? photoUrls.map((url, i) => `
      <div class="plate">
        <img src="${url}" alt="Submitted photo ${i + 1}">
        <div class="cap">Photo ${i + 1}</div>
      </div>`).join('')
    : '<p class="body">No photos were submitted with this evaluation.</p>';

  const raiseConfidenceHtml = data.verdict.raiseConfidenceNote.trim()
    ? `
      <div class="raise-conf">
        <b>To close the loop completely</b>
        ${escHtml(data.verdict.raiseConfidenceNote)}
      </div>`
    : '';

  const reasoningHtml = data.verdict.reasoning
    .split(/\n{2,}/)
    .map((p) => `<p>${escHtml(p.trim())}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Authenticity Report — ${escHtml(modelTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#F4EFE4; --paper-2:#ECE5D5; --paper-3:#E4DAC6;
    --ink:#15181E; --ink-soft:#2C323C;
    --creek:#235A6E; --creek-deep:#1B3957;
    --brass:#A9823B; --brass-bright:#C79A47;
    --clay:#9A4628; --green:#3F6B3A; --muted:#6E6557;
    --line:rgba(21,24,30,.15); --line-soft:rgba(21,24,30,.08);
    --display:'Fraunces',Georgia,'Times New Roman',serif;
    --sans:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    --mono:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
  body{font-family:var(--sans);color:var(--ink);background-color:var(--paper);line-height:1.6;font-size:16px;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1080px;margin:0 auto;padding:0 28px}
  [id]{scroll-margin-top:76px}
  .jump{background:var(--paper-2);border-top:1px solid var(--line);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:50}
  .jump .wrap{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding-top:11px;padding-bottom:11px}
  .jump .jlab{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin-right:6px}
  .jump a{font-family:var(--mono);font-size:11px;letter-spacing:.05em;color:var(--ink-soft);text-decoration:none;border:1px solid transparent;border-radius:30px;padding:6px 12px;display:inline-flex;align-items:center;gap:7px}
  .jump a:hover{color:var(--ink);background:var(--paper);border-color:var(--line)}
  .jump a .n{color:var(--brass);font-weight:600}
  .masthead{background:var(--ink);color:var(--paper);padding:46px 0 40px;position:relative;overflow:hidden}
  .masthead::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 78% -10%, rgba(35,90,110,.40), transparent 55%),radial-gradient(90% 80% at 12% 120%, rgba(27,57,87,.55), transparent 60%);pointer-events:none}
  .masthead .wrap{position:relative;z-index:1}
  .mh-top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid rgba(244,239,228,.22);padding-bottom:16px;margin-bottom:26px;gap:18px;flex-wrap:wrap}
  .brandmark{font-family:var(--mono);font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--brass-bright)}
  .brandmark b{display:block;font-family:var(--display);font-weight:600;font-size:20px;letter-spacing:.01em;text-transform:none;color:var(--paper);margin-top:6px}
  .doc-ref{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;color:rgba(244,239,228,.7);text-align:right;line-height:1.9}
  .doc-ref span{color:var(--brass-bright)}
  .overline{font-family:var(--mono);font-size:16px;letter-spacing:.36em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:16px}
  .mh-title{font-family:var(--display);font-weight:600;font-size:clamp(26px,4vw,42px);line-height:1.05;letter-spacing:-.015em}
  .mh-sub{font-family:var(--display);font-style:italic;font-weight:400;font-size:clamp(18px,2.6vw,26px);color:#D9CFB9;margin-top:10px}
  .mh-meta{display:flex;flex-wrap:wrap;gap:8px 26px;margin-top:26px;font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:rgba(244,239,228,.82)}
  .mh-meta div span{text-transform:uppercase;font-size:10.5px;letter-spacing:.18em;display:block;margin-bottom:2px;color:#9FB7BE}
  .mh-meta div b{font-weight:500;color:var(--paper)}
  .stats{background:var(--ink-soft);color:var(--paper);border-top:2px solid var(--brass)}
  .stats .grid{display:grid;grid-template-columns:repeat(4,1fr)}
  .stat{padding:24px 22px;border-right:1px solid rgba(244,239,228,.13)}
  .stat:last-child{border-right:none}
  .stat .lab{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9FB7BE}
  .stat .num{font-family:var(--display);font-weight:600;font-size:clamp(22px,2.9vw,31px);margin-top:10px;letter-spacing:-.01em}
  section{padding:54px 0}
  section + section{border-top:1px solid var(--line-soft)}
  .sec-head{display:flex;align-items:baseline;gap:18px;margin-bottom:26px}
  .sec-num{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--brass);letter-spacing:.1em;padding-top:6px}
  .sec-head h2{font-family:var(--display);font-weight:600;font-size:clamp(26px,3.4vw,38px);letter-spacing:-.015em;line-height:1.08}
  p{margin-bottom:15px;max-width:68ch}
  p.body{color:var(--ink-soft)}
  .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--creek);margin-bottom:8px}
  .idcard{background:var(--paper-2);border:1px solid var(--line);border-left:4px solid var(--brass);border-radius:3px;padding:24px 26px;margin:8px 0 28px}
  .idcard dl{display:grid;grid-template-columns:170px 1fr;gap:10px 22px}
  .idcard dt{font-family:var(--mono);font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);padding-top:3px}
  .idcard dd{font-size:15.5px;color:var(--ink)}
  .gallery{columns:3;column-gap:16px}
  .plate{break-inside:avoid;margin-bottom:16px;background:var(--paper-2);border:1px solid var(--line);padding:8px;border-radius:3px}
  .plate img{width:100%;display:block;border-radius:2px}
  .plate .cap{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;color:var(--muted);margin-top:8px;padding:0 2px 2px}
  .specs{display:grid;grid-template-columns:1fr 1fr;gap:0 40px}
  .spec-row{padding:11px 0;border-bottom:1px solid var(--line-soft)}
  .spec-row dt{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:4px}
  .spec-row dd{font-size:14.5px;color:var(--ink)}
  .tbl{width:100%;border-collapse:collapse;margin:6px 0 4px;font-size:14px}
  .tbl th{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);text-align:left;padding:0 14px 10px;border-bottom:2px solid var(--ink)}
  .tbl td{padding:13px 14px;border-bottom:1px solid var(--line-soft);vertical-align:top;color:var(--ink-soft)}
  .tbl td.feat{color:var(--ink);font-weight:600;white-space:nowrap}
  .tag{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:20px;display:inline-block;white-space:nowrap}
  .tag.ok{background:rgba(63,107,58,.14);color:var(--green);border:1px solid rgba(63,107,58,.3)}
  .tag.unk{background:rgba(110,101,87,.14);color:var(--muted);border:1px solid rgba(110,101,87,.3)}
  .tag.bad{background:rgba(154,70,40,.13);color:var(--clay);border:1px solid rgba(154,70,40,.3)}
  .tag.mod{background:rgba(169,130,59,.15);color:var(--brass);border:1px solid rgba(169,130,59,.35)}
  .check-ok{color:var(--green);font-weight:700;font-size:15px}
  .clean-callout{background:rgba(63,107,58,.08);border:1px solid rgba(63,107,58,.3);border-left:4px solid var(--green);border-radius:4px;padding:24px 26px;display:flex;gap:16px;align-items:flex-start}
  .clean-callout .ck{width:34px;height:34px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
  .clean-callout h3{font-family:var(--display);font-weight:600;font-size:19px;margin-bottom:6px}
  .clean-callout p{color:var(--ink-soft);margin-bottom:0;max-width:none}
  .redflags-list{display:flex;flex-direction:column;gap:10px}
  .redflag-item{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:var(--ink-soft);padding:12px 14px;background:var(--paper-2);border:1px solid var(--line);border-radius:3px}
  .verdict-card{background:var(--creek-deep);color:var(--paper);border-radius:6px;padding:36px 38px;position:relative;overflow:hidden}
  .verdict-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;position:relative;z-index:1}
  .verdict-label{font-family:var(--mono);font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:10px}
  .verdict-word{font-family:var(--display);font-weight:600;font-size:clamp(32px,4.6vw,50px);letter-spacing:-.02em}
  .confidence-pill{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);padding:8px 18px;border-radius:30px;white-space:nowrap}
  .confidence-pill b{color:#8fd68a}
  .verdict-reasoning{margin-top:26px;padding-top:24px;border-top:1px solid rgba(244,239,228,.18);position:relative;z-index:1}
  .verdict-reasoning p{color:#E7DFCF;max-width:none;font-size:15px;line-height:1.7}
  .verdict-reasoning p:last-child{margin-bottom:0}
  .raise-conf{margin-top:20px;padding-top:20px;border-top:1px solid rgba(244,239,228,.14);font-size:13.5px;color:rgba(244,239,228,.72);position:relative;z-index:1}
  .raise-conf b{color:var(--brass-bright);text-transform:uppercase;font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;display:block;margin-bottom:6px}
  .cert-card{background:var(--ink);color:var(--paper);border-radius:6px;overflow:hidden;border:1px solid rgba(0,0,0,.25);box-shadow:0 20px 46px -26px rgba(21,24,30,.65)}
  .cert-bar{display:flex;align-items:center;gap:9px;padding:12px 18px;background:rgba(255,255,255,.045);border-bottom:1px solid rgba(244,239,228,.14);font-family:var(--mono);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#9FB7BE}
  .cert-bar .dot{width:10px;height:10px;border-radius:50%;background:var(--brass)}
  .cert-bar .dot+.dot{background:var(--creek)}
  .cert-bar em{margin-left:auto;color:rgba(244,239,228,.5);font-style:normal}
  .cert-body{padding:30px 32px}
  .cert-title{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:10px}
  .cert-instrument{font-family:var(--display);font-weight:600;font-size:26px;color:#fff;line-height:1.26;letter-spacing:-.01em;margin-bottom:4px}
  .cert-sub{font-family:var(--display);font-style:italic;font-size:15px;color:#D9CFB9;margin-bottom:22px}
  .cert-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:20px 0;border-top:1px solid rgba(244,239,228,.14);border-bottom:1px solid rgba(244,239,228,.14);margin-bottom:22px}
  .cert-grid div span{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#9FB7BE;margin-bottom:6px}
  .cert-grid div b{font-family:var(--display);font-weight:600;font-size:17px;color:#fff}
  .cert-summary-lab{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:9px}
  .cert-summary{font-size:14px;line-height:1.7;color:#E7DFCF;max-width:none}
  footer{background:var(--ink);color:rgba(244,239,228,.74);padding:40px 0 48px;font-size:13px;line-height:1.7}
  footer .wrap{display:grid;grid-template-columns:1.4fr 1fr;gap:34px}
  footer h4{font-family:var(--mono);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:12px}
  footer p{max-width:none;margin-bottom:10px}
  footer .legal{max-width:1080px;margin:28px auto 0;padding:18px 28px 0;border-top:1px solid rgba(244,239,228,.18)}
  footer .legal h4{margin-bottom:9px}
  footer .legal p{font-size:11.5px;color:rgba(244,239,228,.55);line-height:1.66;max-width:none;margin:0}
  @media (max-width:860px){
    .stats .grid{grid-template-columns:repeat(2,1fr)}
    .gallery{columns:2}
    .specs{grid-template-columns:1fr}
    .idcard dl{grid-template-columns:1fr}
    .cert-grid{grid-template-columns:1fr}
    footer .wrap{grid-template-columns:1fr}
    .verdict-top{flex-direction:column;align-items:flex-start}
  }
</style>
</head>
<body>

<header class="masthead">
  <div class="wrap">
    <div class="mh-top">
      <div class="brandmark">Instrument Dossier<b>Coal Creek Guitar Authentication &amp; Verdict Report</b></div>
      <div class="doc-ref">
        REF <span>${escHtml(record.serial_number || '—')}</span><br>
        ISSUED <span>${issuedDate}</span><br>
        REGION <span>${escHtml(record.location || '—')}</span>
      </div>
    </div>
    <div class="overline">${escHtml(brandTitle)}</div>
    <h1 class="mh-title">${escHtml(modelTitle)}</h1>
    ${subParts ? `<div class="mh-sub">${escHtml(subParts)}</div>` : ''}
    <div class="mh-meta">
      <div><span>Serial</span><b>${escHtml(record.serial_number || '—')}</b></div>
      <div><span>Brand</span><b>${escHtml(brandTitle)}</b></div>
      <div><span>Location</span><b>${escHtml(record.location || '—')}</b></div>
      <div><span>Includes</span><b>${includesCaseLabel(record.includes_case)}</b></div>
    </div>
  </div>
</header>

<div class="stats">
  <div class="wrap">
    <div class="grid">
      <div class="stat"><div class="lab">Verdict</div><div class="num" style="color:${verdictColor}">${verdictLabel}</div></div>
      <div class="stat"><div class="lab">Confidence</div><div class="num" style="color:var(--brass-bright)">${confidenceLabel}</div></div>
      <div class="stat"><div class="lab">Markers Checked</div><div class="num">${markersChecked}</div></div>
      <div class="stat"><div class="lab">Red Flags Found</div><div class="num">${redFlagsFound}</div></div>
    </div>
  </div>
</div>

<nav class="jump">
  <div class="wrap">
    <span class="jlab">Jump to</span>
    <a href="#identity"><span class="n">01</span> Identity</a>
    <a href="#gallery"><span class="n">02</span> Photos</a>
    <a href="#specs"><span class="n">03</span> Specs</a>
    <a href="#markers"><span class="n">04</span> Markers</a>
    <a href="#redflags"><span class="n">05</span> Red Flags</a>
    <a href="#verdict"><span class="n">06</span> Verdict</a>
    <a href="#certificate"><span class="n">07</span> Certificate</a>
  </div>
</nav>

<section id="identity">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">01</span><h2>What it <span style="font-style:italic;font-weight:400">is</span></h2></div>
    <div class="idcard">
      <dl>
        <dt>Brand</dt><dd>${escHtml(brandTitle)}</dd>
        <dt>Model</dt><dd>${escHtml(modelTitle)}</dd>
        <dt>Year</dt><dd>${escHtml(data.identity.yearConfirmed || '—')}</dd>
        <dt>Build / Variant</dt><dd>${escHtml(data.identity.variantNotes || '—')}</dd>
        <dt>Confidence statement</dt><dd>${escHtml(data.identity.confidenceStatement || '—')}</dd>
      </dl>
    </div>
  </div>
</section>

<section id="gallery">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">02</span><h2>The <span style="font-style:italic;font-weight:400">evidence</span></h2></div>
    <div class="gallery">${photosHtml}</div>
  </div>
</section>

<section id="specs">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">03</span><h2>Specification</h2></div>
    ${data.specs.length > 0 ? `<div class="specs"><div>${specsRows}</div></div>` : '<p class="body">No specification notes recorded.</p>'}
  </div>
</section>

<section id="markers">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">04</span><h2>Authenticity <span style="font-style:italic;font-weight:400">markers</span></h2></div>
    ${data.markers.length > 0 ? `
    <table class="tbl">
      <thead><tr><th>Marker</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${markersRows}</tbody>
    </table>` : '<p class="body">No markers recorded.</p>'}
  </div>
</section>

<section id="redflags">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">05</span><h2>Red flags &amp; <span style="font-style:italic;font-weight:400">inconsistencies</span></h2></div>
    ${redFlagsHtml}
  </div>
</section>

<section id="verdict">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">06</span><h2>Expert <span style="font-style:italic;font-weight:400">verdict</span></h2></div>
    <div class="verdict-card">
      <div class="verdict-top">
        <div>
          <div class="verdict-label">Determination</div>
          <div class="verdict-word">${verdictLabel}</div>
        </div>
        <div class="confidence-pill">Confidence: <b>${confidenceLabel}</b></div>
      </div>
      <div class="verdict-reasoning">${reasoningHtml}</div>
      ${raiseConfidenceHtml}
    </div>
  </div>
</section>

<section id="certificate">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">07</span><h2>Certificate &amp; <span style="font-style:italic;font-weight:400">summary</span></h2></div>
    <div class="cert-card">
      <div class="cert-bar"><span class="dot"></span><span class="dot"></span>Coal Creek Guitars — Authenticity Assessment<em>${escHtml(record.location || '')}</em></div>
      <div class="cert-body">
        <div class="cert-title">Instrument</div>
        <div class="cert-instrument">${escHtml(brandTitle)} ${escHtml(modelTitle)}</div>
        ${subParts ? `<div class="cert-sub">${escHtml(subParts)}</div>` : ''}
        <div class="cert-grid">
          <div><span>Verdict</span><b>${verdictLabel}</b></div>
          <div><span>Confidence</span><b>${confidenceLabel}</b></div>
          <div><span>Date Issued</span><b>${issuedDate}</b></div>
        </div>
        <div class="cert-summary-lab">Summary</div>
        <p class="cert-summary">${escHtml(data.certificateSummary || '—')}</p>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div>
      <h4>Methodology</h4>
      <p>This assessment is based solely on the photographs and instrument details submitted by the owner, reviewed and researched by a Coal Creek Guitars expert. It does not include physical inspection, X-ray, black-light, or other forensic examination.</p>
    </div>
    <div>
      <h4>Prepared By</h4>
      <p>Coal Creek Guitars<br>Englewood, Colorado</p>
    </div>
  </div>
  <div class="legal" id="disclaimer">
    <h4>Disclaimer</h4>
    <p>This report is a subjective, good-faith authenticity assessment prepared by Coal Creek Guitars for general informational purposes only. It is meant to be used as a tool and a guide — not a certified forensic authentication, not an insurance appraisal, and not a legal determination of ownership, title, or value. Every finding in this report is based solely on the photographs and information provided to us and on publicly available reference material at the time of writing — all of which may be incomplete, may contain errors, or may not capture details that are only visible on physical inspection. Actual authenticity can depend on factors that photographs alone cannot resolve. Coal Creek Guitars makes no representation or warranty, express or implied, as to the accuracy or completeness of this report, and accepts no liability for any loss, decision, or outcome arising from reliance on it. For insurance, resale, legal, or high-value transaction purposes, always obtain a certified independent authentication or appraisal.</p>
  </div>
</footer>

</body>
</html>`;
}

// ── Validation ───────────────────────────────────────────────────────────────
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function validateAuthenticityData(data: any): data is AuthenticityReportData {
  if (!data || typeof data !== 'object') return false;
  if (!data.identity || !isNonEmptyString(data.identity.brandConfirmed) || !isNonEmptyString(data.identity.modelConfirmed)) return false;
  if (!data.verdict) return false;
  if (!['genuine', 'likely_genuine', 'inconclusive', 'likely_not_authentic'].includes(data.verdict.determination)) return false;
  if (!['very_high', 'high', 'medium', 'low', 'very_low'].includes(data.verdict.confidence)) return false;
  if (!isNonEmptyString(data.verdict.reasoning)) return false;
  if (!isNonEmptyString(data.certificateSummary)) return false;
  return true;
}

async function loadEvalForAuthReport(id: string, env: Env) {
  return env.DB.prepare(
    `SELECT brand, brand_other, model, serial_number, includes_case, location, image_keys, first_name, email, report_guid
     FROM guitar_evaluations WHERE id = ?`,
  ).bind(id).first<EvalRecordForAuthReport & {
    image_keys: string | null;
    first_name: string | null;
    email: string | null;
    report_guid: string | null;
  }>();
}

function resolvePhotoUrls(imageKeys: string | null, env: Env): string[] {
  if (!imageKeys) return [];
  // Absolute URLs — the Preview flow opens the rendered HTML via a blob: URL,
  // which cannot resolve relative/path-absolute references against the real site.
  const siteBase = (env.SITE_BASE_URL || 'https://www.coalcreekguitars.com').replace(/\/$/, '');
  try {
    const keys: string[] = JSON.parse(imageKeys);
    return keys.map((key) => `${siteBase}/api/guitar-evaluation-image?key=${encodeURIComponent(key)}`);
  } catch {
    return [];
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────
export async function handleAdminV2AuthenticityDraftSave(id: string, request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }
  const row = await env.DB.prepare('SELECT id FROM guitar_evaluations WHERE id = ?').bind(id).first<{ id: number }>();
  if (!row) return jsonResponse({ message: 'Report not found.' }, 404);

  await env.DB.prepare(
    'UPDATE guitar_evaluations SET authenticity_report_data = ? WHERE id = ?',
  ).bind(JSON.stringify(body?.data ?? {}), id).run();

  return jsonResponse({ ok: true });
}

export async function handleAdminV2AuthenticityPreview(id: string, request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }
  const data = body?.data;
  if (!data) return jsonResponse({ message: 'Missing report data.' }, 400);

  const record = await loadEvalForAuthReport(id, env);
  if (!record) return jsonResponse({ message: 'Report not found.' }, 404);

  const photoUrls = resolvePhotoUrls(record.image_keys, env);
  const html = buildAuthenticityReportHtml(data as AuthenticityReportData, record, photoUrls);
  return jsonResponse({ html });
}

export async function handleAdminV2AuthenticityAiPolish(id: string, request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }
  const data = body?.data;
  if (!data) return jsonResponse({ message: 'Missing report data.' }, 400);

  const record = await loadEvalForAuthReport(id, env);
  if (!record) return jsonResponse({ message: 'Report not found.' }, 404);

  const result = await polishAuthenticityReportText(data as AuthenticityReportData, record, env);
  if (!result) {
    return jsonResponse({ message: 'AI polish failed — try again or write it by hand.' }, 502);
  }

  return jsonResponse(result);
}

export async function handleAdminV2AuthenticityParseChecklist(id: string, request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return jsonResponse({ message: 'Paste some text first.' }, 400);

  const record = await loadEvalForAuthReport(id, env);
  if (!record) return jsonResponse({ message: 'Report not found.' }, 404);

  const identity = body?.identity ?? {};
  const brandModel = {
    brand: normalizeText(identity.brandConfirmed, '') || record.brand,
    model: normalizeText(identity.modelConfirmed, '') || record.model,
  };

  const result = await parseAuthenticityChecklistText(text, brandModel, env);
  if (!result) {
    return jsonResponse({ message: 'Could not parse that text — try again or add rows manually.' }, 502);
  }

  return jsonResponse(result);
}

export async function handleAdminV2AuthenticitySend(id: string, request: Request, env: Env): Promise<Response> {
  if (!env.CUSTOM_ITEMS_BUCKET) {
    return jsonResponse({ message: 'Storage bucket not configured.' }, 500);
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: 'Invalid request body.' }, 400);
  }
  const data = body?.data;
  if (!validateAuthenticityData(data)) {
    return jsonResponse({ message: 'Missing required fields: brand, model, verdict, confidence, reasoning, and certificate summary are all required to send.' }, 400);
  }

  const record = await loadEvalForAuthReport(id, env);
  if (!record) return jsonResponse({ message: 'Report not found.' }, 404);

  await env.DB.prepare(
    'UPDATE guitar_evaluations SET authenticity_report_data = ? WHERE id = ?',
  ).bind(JSON.stringify(data), id).run();

  const photoUrls = resolvePhotoUrls(record.image_keys, env);
  const html = buildAuthenticityReportHtml(data, record, photoUrls);

  const guid = record.report_guid || crypto.randomUUID();
  const r2Key = `guitar-eval-reports/${guid}.html`;
  await env.CUSTOM_ITEMS_BUCKET.put(r2Key, html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8' },
  });

  const now = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE guitar_evaluations SET report_guid = ?, report_r2_key = ?, fulfilled = 1, fulfilment_date = ? WHERE id = ?',
  ).bind(guid, r2Key, now, id).run();

  // Send report-ready email — same shape as the AI value-report flow
  try {
    if (record.email) {
      const config = await getBrevoRuntimeConfig(env);
      if (config.apiKey && config.senderEmail) {
        const resolvedFirstName = normalizeText(record.first_name, '') || 'there';

        await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: { accept: 'application/json', 'api-key': config.apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({ email: record.email, attributes: { FIRSTNAME: resolvedFirstName }, updateEnabled: true }),
        });

        const siteBase = (env.SITE_BASE_URL || 'https://www.coalcreekguitars.com').replace(/\/$/, '');
        const reportUrl = `${siteBase}/api/guitar-eval-report/${guid}`;

        await sendBrevoTransactionalEmail(config, {
          sender: { name: config.senderName, email: config.senderEmail },
          to: [{ email: record.email, name: resolvedFirstName }],
          templateId: 5,
          params: { REPORT_URL: reportUrl },
        });
      }
    }
  } catch (err) {
    console.error(`[authenticity-report] email send failed for evaluation ${id}:`, err);
  }

  return jsonResponse({ ok: true, guid });
}
