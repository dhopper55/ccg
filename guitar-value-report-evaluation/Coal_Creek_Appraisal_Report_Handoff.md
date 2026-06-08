# Coal Creek Guitars — Appraisal Report Generator
### Reusable handoff / prompt pack

> **HOW TO USE (3 steps)**
> 1. Go to the **INSTRUMENT DETAILS** block at the very bottom of this document and fill in every field you can. Leave anything you don't know as `unknown`.
> 2. **Attach all photos** of the instrument to your chat message (front, headstock front & back, fingerboard, body back / serial, the case, and any paperwork — as many as you have).
> 3. **Paste this entire document** into a brand-new Claude session along with the photos. Claude will return one finished, self-contained HTML report.
>
> Do **not** edit anything above the INSTRUMENT DETAILS block — only fill in that block. Everything else is the locked instruction set that keeps every report identical.

---

## ROLE & MISSION (Claude reads everything below)

You are generating a **professional instrument valuation report for Coal Creek Guitars**. Using the photos and the **INSTRUMENT DETAILS** provided at the bottom of this message, produce **one self-contained, print-ready HTML page** that is visually identical to the **REFERENCE TEMPLATE** further down — only the content and photos change from report to report.

The finished report must let the owner: understand exactly what the instrument is, see what it's worth across multiple channels, understand what helps and hurts its value, know how to verify uncertain specs, and copy a ready-to-post sales listing for their local market.

---

## WORKFLOW

**1) Identify the instrument.** From the photos + details, determine make / model / variant / year and decode the serial number (search the manufacturer's serial format if needed). State your confidence. If the model specifics are uncertain, say so plainly and lean on the "Verify" section rather than inventing certainty.

**2) Research value — use web search; do NOT price from memory.** Prices change; always search. Capture, and clearly separate, **what it's LISTED for (asking)** vs **what it has actually SOLD for (recent/completed)**:
- **Reverb** — current asking listings *and* recent sold prices (and price-guide range if available).
- **eBay** — active listings *and* recent sold / completed listings.
- **Other sources** — new/street price (manufacturer + major retailers like Sweetwater/Guitar Center), boutique-dealer asking prices, and any relevant price guides.

**3) Localize to the owner's market.** Use the **Location** field:
- Identify the metro and name real, plausible local shops/dealers that would buy or take it on consignment (search for them).
- **Dealer/shop cash offer:** apply a realistic resale spread (dealers typically pay ~50–65% of what they can resell it for; note more is usually available in trade/store credit).
- **Private local sale** (Facebook Marketplace / Craigslist / local Reverb): estimate a realistic asking price, the realistic landing price, **and how long it would likely sit** given the instrument's desirability, price point, and color/niche.
- **Best-money path** (usually a national Reverb listing): estimate the net after fees (~5% Reverb, ~13% eBay) and shipping, and the likely time to sell.

**4) Value factors.** Spell out what **helps** and what **hurts** this specific instrument's value.

**5) Verify pointers.** If any spec is uncertain, give the owner concrete things to look for, and a **feature → value-impact** table (how each option/feature moves the price up, down, or sideways).

**6) Build the listing.** One **title** (≤ 80 characters, keywords front-loaded so it fits eBay's limit) and **one description** usable on **Reverb, eBay, Facebook Marketplace, and Craigslist**. For **FB Marketplace and Craigslist assume local pickup only** (tell the seller to drop the shipping line). Include short per-platform notes and a suggested asking price. Localize to the metro.

---

## OUTPUT REQUIREMENTS (critical — this is what keeps reports identical)

- Deliver **one self-contained `.html` file**: all CSS inline, **all photos embedded as base64** data URIs (no external image references). It must open in any browser and export cleanly via **Print → Save as PDF**.
- **Use the REFERENCE TEMPLATE below verbatim** for all styling, layout, fonts, colors, the masthead, the sticky jump-nav, the section order, and the footer. **Do not change anything structural or stylistic.**
- **Replace ALL example content** — the Gibson "Dark Blue Widow Burst" / Denver text, every dollar figure, all specs, comps, captions, and the listing are **ILLUSTRATIVE ONLY**. Never reuse the example's values, model, prices, or location. Research everything fresh for the actual instrument and location.
- **Update the masthead meta** to the real instrument: `REF` = serial, `ISSUED` = today's date, `REGION` = the owner's location; and the title block (model / finish / year) and the four "condition / includes" items.
- **Update the stat banner** (the four headline numbers) to the researched figures.
- Keep all **8 sections** and the **jump-nav with working `#` links** (01 Identity, 02 Photos, 03 Specs, 04 Market, 05 Valuation, 06 Helps & Hurts, 07 Verify, 08 Listing).
- The header brand line must read **"Coal Creek Guitar Appraisal & Market Valuation"** (already set in the template — leave it).
- **Every report must end with the standard Coal Creek liability disclaimer.** It is built into the template footer as the full-width **"Disclaimer"** band at the very bottom. Keep it on every report, verbatim — never remove, shorten, or water it down. (It states the report is a subjective good-faith guide, not gospel or a certified appraisal, and that Coal Creek Guitars accepts no liability for reliance on it.)
- **Photos:** downscale before embedding (long edge ~1100px; the hero ~1500px; document/COA shots ~1300px), JPEG quality ~82–86. Use **as many photos as the owner provides** — caption each plate by what it shows, pick the best full-front or most striking shot as the hero, and **adapt the number of gallery plates to the number of photos** (don't leave empty slots or invent photos). If a photo placeholder has no matching image, remove that plate.
- Save the file to the outputs location and present it to the user.

---

## STYLE & TONE (match the example exactly)

- **Fonts:** Fraunces (display / headings), Hanken Grotesk (body), JetBrains Mono (labels & data) — loaded via Google Fonts, as in the template.
- **Palette (locked in the template's CSS variables):** warm parchment background, coal-ink masthead/footer, creek-blue + deep indigo accents, brass/gold rules and numbers, clay for negatives, green for positives.
- **Voice:** confident, plain-spoken, dealer-savvy. Be honest and specific. Always distinguish *listed* vs *sold*. Give **ranges, not false precision.** **Flag unknowns** (e.g., weight, exact pickups, structural condition) and tell the owner to confirm them rather than guessing. Mention selling fees and friction. Keep prose clean — no over-formatting.
- Match the **section depth and length** of the example.

---

## REFERENCE TEMPLATE (use verbatim; swap content + photos only)

The `{{PHOTO_*}}` tokens mark where embedded images go. The text inside is the worked example — **replace it all** with the real instrument's content while keeping every tag, class, and structure intact.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Appraisal — Gibson Custom Les Paul Custom Figured "Dark Blue Widow Burst" (2024)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#F4EFE4;
    --paper-2:#ECE5D5;
    --paper-3:#E4DAC6;
    --ink:#15181E;
    --ink-soft:#2C323C;
    --creek:#235A6E;
    --creek-deep:#1B3957;
    --brass:#A9823B;
    --brass-bright:#C79A47;
    --clay:#9A4628;
    --green:#3F6B3A;
    --muted:#6E6557;
    --line:rgba(21,24,30,.15);
    --line-soft:rgba(21,24,30,.08);
    --display:'Fraunces',Georgia,'Times New Roman',serif;
    --sans:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    --mono:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{
    font-family:var(--sans);
    color:var(--ink);
    background-color:var(--paper);
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
    line-height:1.6;
    font-size:16px;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1080px;margin:0 auto;padding:0 28px}

  html{scroll-behavior:smooth}
  [id]{scroll-margin-top:76px}

  /* ---------- JUMP NAV ---------- */
  .jump{background:var(--paper-2);border-top:1px solid var(--line);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:50}
  .jump .wrap{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding-top:11px;padding-bottom:11px}
  .jump .jlab{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin-right:6px}
  .jump a{font-family:var(--mono);font-size:11px;letter-spacing:.05em;color:var(--ink-soft);text-decoration:none;border:1px solid transparent;border-radius:30px;padding:6px 12px;display:inline-flex;align-items:center;gap:7px;transition:background .15s ease,border-color .15s ease,color .15s ease}
  .jump a:hover{color:var(--ink);background:var(--paper);border-color:var(--line);box-shadow:0 3px 9px -5px rgba(21,24,30,.5)}
  .jump a .n{color:var(--brass);font-weight:600}

  /* ---------- MASTHEAD ---------- */
  .masthead{
    background:var(--ink);
    color:var(--paper);
    padding:46px 0 40px;
    position:relative;
    overflow:hidden;
  }
  .masthead::after{
    content:"";position:absolute;inset:0;
    background:radial-gradient(120% 90% at 78% -10%, rgba(35,90,110,.40), transparent 55%),
               radial-gradient(90% 80% at 12% 120%, rgba(27,57,87,.55), transparent 60%);
    pointer-events:none;
  }
  .masthead .wrap{position:relative;z-index:1}
  .mh-top{
    display:flex;justify-content:space-between;align-items:flex-start;
    border-bottom:1px solid rgba(244,239,228,.22);padding-bottom:16px;margin-bottom:26px;
    gap:18px;flex-wrap:wrap;
  }
  .brandmark{font-family:var(--mono);font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--brass-bright)}
  .brandmark b{display:block;font-family:var(--display);font-weight:600;font-size:20px;letter-spacing:.01em;text-transform:none;color:var(--paper);margin-top:6px}
  .doc-ref{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;color:rgba(244,239,228,.7);text-align:right;line-height:1.9}
  .doc-ref span{color:var(--brass-bright)}
  .overline{font-family:var(--mono);font-size:12px;letter-spacing:.36em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:16px}
  .mh-title{font-family:var(--display);font-weight:600;font-size:clamp(34px,6vw,62px);line-height:1.02;letter-spacing:-.015em;font-optical-sizing:auto}
  .mh-sub{font-family:var(--display);font-style:italic;font-weight:400;font-size:clamp(18px,2.6vw,26px);color:#D9CFB9;margin-top:10px}
  .mh-meta{display:flex;flex-wrap:wrap;gap:8px 26px;margin-top:26px;font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:rgba(244,239,228,.82)}
  .mh-meta div span{color:var(--brass-bright);text-transform:uppercase;font-size:10.5px;letter-spacing:.18em;display:block;margin-bottom:2px;color:#9FB7BE}
  .mh-meta div b{font-weight:500;color:var(--paper)}

  /* ---------- STAT BANNER ---------- */
  .stats{background:var(--ink-soft);color:var(--paper);border-top:2px solid var(--brass)}
  .stats .grid{display:grid;grid-template-columns:repeat(4,1fr)}
  .stat{padding:24px 22px;border-right:1px solid rgba(244,239,228,.13)}
  .stat:last-child{border-right:none}
  .stat .lab{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9FB7BE}
  .stat .num{font-family:var(--display);font-weight:600;font-size:clamp(22px,2.9vw,31px);margin-top:10px;color:var(--paper);letter-spacing:-.01em}
  .stat .num.brass{color:var(--brass-bright)}
  .stat .note{font-size:12px;color:rgba(244,239,228,.62);margin-top:6px;line-height:1.45}

  /* ---------- SECTIONS ---------- */
  section{padding:54px 0}
  section + section{border-top:1px solid var(--line-soft)}
  .sec-head{display:flex;align-items:baseline;gap:18px;margin-bottom:26px}
  .sec-num{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--brass);letter-spacing:.1em;padding-top:6px}
  .sec-head h2{font-family:var(--display);font-weight:600;font-size:clamp(26px,3.4vw,38px);letter-spacing:-.015em;line-height:1.08}
  .sec-head h2 .ital{font-style:italic;font-weight:400}
  .lead{font-size:18px;line-height:1.66;max-width:64ch;color:var(--ink-soft)}
  p{margin-bottom:15px;max-width:68ch}
  p.body{color:var(--ink-soft)}
  strong{font-weight:600}
  .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--creek);margin-bottom:8px}
  a{color:var(--creek);text-decoration:none;border-bottom:1px solid rgba(35,90,110,.3)}

  /* hero figure */
  .hero-fig{margin:6px 0 0;position:relative}
  .hero-fig img{width:100%;display:block;border-radius:3px;box-shadow:0 24px 50px -22px rgba(21,24,30,.55)}
  .hero-fig figcaption{font-family:var(--mono);font-size:11px;letter-spacing:.1em;color:var(--muted);margin-top:10px;text-transform:uppercase}

  /* identity callout */
  .idcard{background:var(--paper-2);border:1px solid var(--line);border-left:4px solid var(--brass);border-radius:3px;padding:24px 26px;margin:8px 0 28px}
  .idcard dl{display:grid;grid-template-columns:170px 1fr;gap:10px 22px}
  .idcard dt{font-family:var(--mono);font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);padding-top:3px}
  .idcard dd{font-size:15.5px;color:var(--ink)}
  .idcard dd b{color:var(--creek-deep)}
  .serial{font-family:var(--mono);background:var(--ink);color:var(--brass-bright);padding:2px 9px;border-radius:3px;font-size:13px;letter-spacing:.08em}

  /* ---------- GALLERY ---------- */
  .gallery{columns:3;column-gap:16px}
  .plate{break-inside:avoid;margin-bottom:16px;background:var(--paper-2);border:1px solid var(--line);padding:8px;border-radius:3px}
  .plate img{width:100%;display:block;border-radius:2px}
  .plate .cap{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;color:var(--muted);margin-top:8px;padding:0 2px 2px;line-height:1.45}
  .plate .cap b{color:var(--creek);display:block;letter-spacing:.16em;text-transform:uppercase;font-size:9.5px;margin-bottom:2px}

  /* ---------- SPEC TABLE ---------- */
  .specs{display:grid;grid-template-columns:1fr 1fr;gap:0 40px}
  .spec-row{display:grid;grid-template-columns:150px 1fr;gap:14px;padding:11px 0;border-bottom:1px solid var(--line-soft);align-items:baseline}
  .spec-row dt{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .spec-row dd{font-size:14.5px;color:var(--ink)}

  /* ---------- COMPS TABLE ---------- */
  .tbl{width:100%;border-collapse:collapse;margin:6px 0 4px;font-size:14px}
  .tbl th{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);text-align:left;padding:0 14px 10px;border-bottom:2px solid var(--ink)}
  .tbl td{padding:13px 14px;border-bottom:1px solid var(--line-soft);vertical-align:top;color:var(--ink-soft)}
  .tbl td.src{color:var(--ink);font-weight:600}
  .tbl td.price{font-family:var(--mono);font-weight:600;color:var(--creek-deep);white-space:nowrap}
  .tag{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:20px;display:inline-block}
  .tag.sold{background:rgba(63,107,58,.14);color:var(--green);border:1px solid rgba(63,107,58,.3)}
  .tag.list{background:rgba(35,90,110,.12);color:var(--creek);border:1px solid rgba(35,90,110,.28)}

  /* ---------- CHANNEL CARDS ---------- */
  .channels{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:6px}
  .chan{background:var(--paper-2);border:1px solid var(--line);border-radius:4px;padding:22px 22px 24px;display:flex;flex-direction:column}
  .chan h3{font-family:var(--display);font-weight:600;font-size:20px;letter-spacing:-.01em;margin-bottom:4px}
  .chan .range{font-family:var(--display);font-weight:600;font-size:30px;color:var(--creek-deep);margin:10px 0 2px;letter-spacing:-.02em}
  .chan .sub{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .chan p{font-size:13.5px;color:var(--ink-soft);margin:14px 0 0;max-width:none}
  .pill{align-self:flex-start;margin-top:16px;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;padding:5px 11px;border-radius:30px;background:var(--ink);color:var(--paper)}
  .pill.slow{background:var(--clay)}
  .pill.med{background:var(--brass)}
  .pill.fast{background:var(--green)}

  /* ---------- HELP / HURT ---------- */
  .hh{display:grid;grid-template-columns:1fr 1fr;gap:22px}
  .col{border-radius:4px;padding:22px 24px;border:1px solid var(--line)}
  .col.help{background:rgba(63,107,58,.07);border-left:4px solid var(--green)}
  .col.hurt{background:rgba(154,70,40,.06);border-left:4px solid var(--clay)}
  .col h3{font-family:var(--display);font-weight:600;font-size:21px;margin-bottom:14px;display:flex;align-items:center;gap:10px}
  .col h3 .mk{font-family:var(--mono);font-size:18px}
  .col.help h3 .mk{color:var(--green)}
  .col.hurt h3 .mk{color:var(--clay)}
  .col ul{list-style:none}
  .col li{font-size:14.5px;padding:9px 0 9px 20px;position:relative;border-bottom:1px solid var(--line-soft);color:var(--ink-soft)}
  .col li:last-child{border-bottom:none}
  .col li::before{content:"";position:absolute;left:0;top:16px;width:7px;height:7px;border-radius:50%}
  .col.help li::before{background:var(--green)}
  .col.hurt li::before{background:var(--clay)}
  .col li b{color:var(--ink)}

  /* ---------- VERIFY ---------- */
  .steps{counter-reset:s;display:grid;grid-template-columns:1fr 1fr;gap:14px 30px;margin-bottom:32px}
  .step{counter-increment:s;position:relative;padding:4px 0 4px 50px;font-size:14.5px;color:var(--ink-soft)}
  .step::before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:2px;font-family:var(--mono);font-size:12px;font-weight:600;color:var(--brass);border:1.5px solid var(--brass);border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center}
  .step b{color:var(--ink)}

  .impact{width:100%;border-collapse:collapse;font-size:14px;margin-top:4px}
  .impact th{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);text-align:left;padding:0 12px 10px;border-bottom:2px solid var(--ink)}
  .impact td{padding:11px 12px;border-bottom:1px solid var(--line-soft);color:var(--ink-soft);vertical-align:top}
  .impact td.feat{color:var(--ink);font-weight:600;white-space:nowrap}
  .chip{font-family:var(--mono);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;white-space:nowrap}
  .chip.up{background:rgba(63,107,58,.15);color:var(--green)}
  .chip.dn{background:rgba(154,70,40,.13);color:var(--clay)}
  .chip.nu{background:rgba(110,101,87,.14);color:var(--muted)}

  .callout{background:var(--creek-deep);color:var(--paper);border-radius:4px;padding:26px 28px;margin-top:10px}
  .callout .kicker{color:var(--brass-bright)}
  .callout p{color:#E7DFCF;max-width:none}
  .callout p:last-child{margin-bottom:0}
  .callout b{color:#fff}

  /* ---------- FOOTER ---------- */
  footer{background:var(--ink);color:rgba(244,239,228,.74);padding:40px 0 48px;font-size:13px;line-height:1.7}
  footer .wrap{display:grid;grid-template-columns:1.4fr 1fr;gap:34px}
  footer h4{font-family:var(--mono);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:12px}
  footer p{max-width:none;margin-bottom:10px}
  footer ul{list-style:none;font-family:var(--mono);font-size:12px;letter-spacing:.02em}
  footer li{padding:4px 0;color:rgba(244,239,228,.7)}
  footer .disc{font-size:11.5px;color:rgba(244,239,228,.5);border-top:1px solid rgba(244,239,228,.16);margin-top:18px;padding-top:16px;line-height:1.65}
  footer .legal{max-width:1080px;margin:28px auto 0;padding:18px 28px 0;border-top:1px solid rgba(244,239,228,.18)}
  footer .legal h4{margin-bottom:9px}
  footer .legal p{font-size:11.5px;color:rgba(244,239,228,.55);line-height:1.66;max-width:none;margin:0}

  /* ---------- LISTING ---------- */
  .listing-card{background:var(--ink);color:var(--paper);border-radius:6px;overflow:hidden;border:1px solid rgba(0,0,0,.25);box-shadow:0 20px 46px -26px rgba(21,24,30,.65)}
  .lc-bar{display:flex;align-items:center;gap:9px;padding:12px 18px;background:rgba(255,255,255,.045);border-bottom:1px solid rgba(244,239,228,.14);font-family:var(--mono);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#9FB7BE}
  .lc-bar .dot{width:10px;height:10px;border-radius:50%;background:var(--brass)}
  .lc-bar .dot+.dot{background:var(--creek)}
  .lc-bar em{margin-left:auto;color:rgba(244,239,228,.5);font-style:normal}
  .lc-body{padding:24px 26px}
  .lc-field{margin-bottom:22px}
  .lc-field:last-child{margin-bottom:0}
  .flab{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--brass-bright);margin-bottom:9px}
  .lc-title{font-family:var(--display);font-weight:600;font-size:22px;color:#fff;line-height:1.26;letter-spacing:-.01em}
  .lc-metaline{font-family:var(--mono);font-size:10.5px;color:rgba(244,239,228,.5);margin-top:9px;letter-spacing:.03em}
  .lc-desc{white-space:pre-wrap;font-size:14px;line-height:1.66;color:#E7DFCF;margin:0;max-width:none}
  .lc-desc b{color:#fff;font-weight:600}
  .plat{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-top:20px}
  .plat .p{background:var(--paper-2);border:1px solid var(--line);border-top:3px solid var(--creek);border-radius:4px;padding:15px 16px}
  .plat .p h5{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--creek-deep);margin-bottom:8px}
  .plat .p span{font-size:12.5px;color:var(--ink-soft);line-height:1.5;display:block}
  .plat .p span+span{margin-top:6px;padding-top:6px;border-top:1px solid var(--line-soft)}
  .lc-foot{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;font-family:var(--mono);font-size:11px}
  .lc-foot b{background:var(--brass);color:var(--ink);padding:6px 12px;border-radius:30px;letter-spacing:.03em;font-weight:600}
  .lc-foot em{background:var(--paper-3);color:var(--ink-soft);padding:6px 12px;border-radius:30px;font-style:normal;letter-spacing:.02em}

  @media (max-width:860px){
    .stats .grid{grid-template-columns:repeat(2,1fr)}
    .stat:nth-child(2){border-right:none}
    .gallery{columns:2}
    .specs{grid-template-columns:1fr}
    .channels{grid-template-columns:1fr}
    .hh{grid-template-columns:1fr}
    .steps{grid-template-columns:1fr}
    .idcard dl{grid-template-columns:1fr}
    .idcard dt{padding-top:8px}
    footer .wrap{grid-template-columns:1fr}
    .plat{grid-template-columns:1fr 1fr}
  }

  @media print{
    @page{margin:14mm}
    body{background:var(--paper)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12px}
    .wrap{max-width:none;padding:0 4mm}
    section{padding:20px 0;break-inside:avoid}
    .masthead{padding:26px 0 22px}
    .plate,.chan,.col,.hero-fig,.idcard,.callout,.step,.listing-card,.plat .p{break-inside:avoid}
    .gallery{columns:3}
    a{border-bottom:none;color:var(--creek)}
    .stat{padding:14px}
    .jump{position:static;border-top:none}
  }
</style>
</head>
<body>

<!-- ===================== MASTHEAD ===================== -->
<header class="masthead">
  <div class="wrap">
    <div class="mh-top">
      <div class="brandmark">Instrument Dossier<b>Coal Creek Guitar Appraisal &amp; Market Valuation</b></div>
      <div class="doc-ref">
        REF <span>CS403228</span><br>
        ISSUED <span>08 JUN 2026</span><br>
        REGION <span>DENVER · CO</span>
      </div>
    </div>
    <div class="overline">Gibson Custom Shop · Made-2-Measure</div>
    <h1 class="mh-title">Les Paul Custom Figured</h1>
    <div class="mh-sub">&ldquo;Dark Blue Widow Burst&rdquo; — 2024</div>
    <div class="mh-meta">
      <div><span>Serial</span><b>CS&nbsp;403228</b></div>
      <div><span>Origin</span><b>Nashville Custom Shop</b></div>
      <div><span>Condition</span><b>Near-Mint / Complete</b></div>
      <div><span>Includes</span><b>OHSC · COA · Tags</b></div>
    </div>
  </div>
</header>

<!-- ===================== STAT BANNER ===================== -->
<div class="stats">
  <div class="wrap">
    <div class="grid">
      <div class="stat">
        <div class="lab">New / Street</div>
        <div class="num">$6,999–7,099</div>
        <div class="note">Current dealer retail for this run</div>
      </div>
      <div class="stat">
        <div class="lab">Reverb — Recent Sold</div>
        <div class="num brass">$7,199</div>
        <div class="note">'24 sibling, mint, sold via dealer</div>
      </div>
      <div class="stat">
        <div class="lab">Private / Local Sale</div>
        <div class="num">$4,800–5,500</div>
        <div class="note">Denver marketplace, realistic net</div>
      </div>
      <div class="stat">
        <div class="lab">Shop / Dealer Offer</div>
        <div class="num">$3,800–4,800</div>
        <div class="note">Cash; more in trade / store credit</div>
      </div>
    </div>
  </div>
</div>

<nav class="jump">
  <div class="wrap">
    <span class="jlab">Jump to</span>
    <a href="#identity"><span class="n">01</span> Identity</a>
    <a href="#gallery"><span class="n">02</span> Photos</a>
    <a href="#specs"><span class="n">03</span> Specs</a>
    <a href="#market"><span class="n">04</span> Market</a>
    <a href="#valuation"><span class="n">05</span> Valuation</a>
    <a href="#helps"><span class="n">06</span> Helps &amp; Hurts</a>
    <a href="#verify"><span class="n">07</span> Verify</a>
    <a href="#listing"><span class="n">08</span> Listing</a>
  </div>
</nav>

<!-- ===================== 01 IDENTIFICATION ===================== -->
<section id="identity">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">01</span><h2>What it <span class="ital">is</span></h2></div>
    <div class="idcard">
      <dl>
        <dt>Model</dt><dd><b>Gibson Custom Shop Les Paul Custom Figured</b> — "Dark Blue Widow Burst"</dd>
        <dt>Year</dt><dd>2024 (decoded from serial)</dd>
        <dt>Serial</dt><dd><span class="serial">CS 403228</span> &nbsp;= CS (Custom Shop) + 4 (2024) + 03228 (build no.)</dd>
        <dt>Build type</dt><dd>Made-2-Measure / dealer-exclusive limited run — not a catalog production model</dd>
        <dt>Family</dt><dd>"Widow" series — defined by colour-matched binding &amp; coloured split-diamond headstock inlay</dd>
      </dl>
    </div>
    <figure class="hero-fig">
      {{PHOTO_HERO}}
      <figcaption>Plate 04 — Full face. AAA figured maple top, blue-matched 7-ply binding, gold hardware.</figcaption>
    </figure>
    <p class="body" style="margin-top:26px">The certificate, the "Gibson Custom" stamp on the back of the headstock, and the oval "Gibson Custom" plate on the rear of the body confirm this is a genuine <strong>Nashville Custom Shop</strong> instrument — a meaningfully higher tier than a regular Gibson USA Les Paul Custom. The serial decodes cleanly on the modern Custom Shop pattern (<strong>CS + year-digit + build number</strong>), placing the build in <strong>2024</strong>.</p>
    <p class="body">The "Widow" tag is the key to the finish. What separates a Blue Widow from an ordinary blue Les Paul Custom is the <strong>colour-matched treatment</strong>: the blue-tinted split-diamond headstock inlay, blue binding wrapping the body, neck and headstock, and the trans-blue burst over a hand-picked figured maple cap. Gibson has run the Widow theme in blue, red, purple, orange and green over the years — all low-volume Custom Shop pieces sold through select dealers, which is why you rarely see them on a big-box wall.</p>
  </div>
</section>

<!-- ===================== 02 GALLERY ===================== -->
<section id="gallery">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">02</span><h2>The <span class="ital">evidence</span></h2></div>
    <div class="gallery">
      <div class="plate">{{PHOTO_TOP}}<div class="cap"><b>Plate 01 · Top</b>Carved face — flame figure, gold covered humbuckers, gold TOM &amp; stopbar, Rhythm/Treble poker chip.</div></div>
      <div class="plate">{{PHOTO_HEADSTOCK}}<div class="cap"><b>Plate 02 · Headstock</b>Blue split-diamond inlay, gold Grover kidney tuners, "Les Paul Custom" rod cover.</div></div>
      <div class="plate">{{PHOTO_FINGERBOARD}}<div class="cap"><b>Plate 03 · Fingerboard</b>Ebony board with pearl block inlays, multi-ply binding — full Custom appointments.</div></div>
      <div class="plate">{{PHOTO_FULL_FRONT}}<div class="cap"><b>Plate 04 · Full front</b>Single-cut LP Custom silhouette, blue-matched binding head to tail.</div></div>
      <div class="plate">{{PHOTO_NECK_REAR}}<div class="cap"><b>Plate 05 · Neck rear</b>Gloss blue neck; "Gibson Custom" headstock stamp — inspect here for repairs.</div></div>
      <div class="plate">{{PHOTO_BODY_REAR}}<div class="cap"><b>Plate 06 · Body rear</b>Oval "Gibson Custom" plate &amp; control cavity cover — check for buckle rash.</div></div>
      <div class="plate">{{PHOTO_IN_CASE}}<div class="cap"><b>Plate 07 · In case</b>Original brown/gold-plush Custom hardshell case — present &amp; correct.</div></div>
      <div class="plate">{{PHOTO_PAPERS}}<div class="cap"><b>Plate 08 · Papers</b>Gibson Custom Certificate of Authenticity — "Les Paul Custom", CS403228.</div></div>
    </div>
  </div>
</section>

<!-- ===================== 03 SPECS ===================== -->
<section id="specs">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">03</span><h2>Specification</h2></div>
    <p class="body" style="margin-bottom:24px;max-width:64ch">Based on the matching Widow-series spec sheets. Two items are worth confirming in person — flagged below — because they swing value and have varied between runs.</p>
    <div class="specs">
      <div>
        <div class="spec-row"><dt>Body</dt><dd>Mahogany back, 2-pc hand-picked AAA figured maple top</dd></div>
        <div class="spec-row"><dt>Finish</dt><dd>Dark Blue Widow Burst, gloss nitro; blue-matched multi-ply binding</dd></div>
        <div class="spec-row"><dt>Neck</dt><dd>Mahogany, Custom long neck tenon</dd></div>
        <div class="spec-row"><dt>Fingerboard</dt><dd>Ebony, pearl block inlays, split-diamond headstock</dd></div>
        <div class="spec-row"><dt>Scale / radius</dt><dd>24.75" · 12" · 1.687" Corian nut</dd></div>
      </div>
      <div>
        <div class="spec-row"><dt>Pickups ⚑</dt><dd>490R / 498T humbuckers, gold covers <em>(confirm — some runs shipped Custombuckers or EMG)</em></dd></div>
        <div class="spec-row"><dt>Hardware</dt><dd>Gold — TOM bridge, stopbar, Grover Kidney tuners, brass strap buttons</dd></div>
        <div class="spec-row"><dt>Electronics</dt><dd>2 vol / 2 tone, CTS pots, 3-way toggle, cream switch tip</dd></div>
        <div class="spec-row"><dt>Weight ⚑</dt><dd><em>Unconfirmed</em> — comparable Widows run 9 lb 11 oz to 10 lb 0 oz</dd></div>
        <div class="spec-row"><dt>Case / papers</dt><dd>Gibson Custom OHSC, COA, hang tags, warranty card</dd></div>
      </div>
    </div>
  </div>
</section>

<!-- ===================== 04 MARKET ===================== -->
<section id="market">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">04</span><h2>What the <span class="ital">market</span> says</h2></div>
    <p class="body" style="max-width:64ch">Read "listed" (the asking price) and "sold" (what actually changed hands) as two different numbers. For this model the gap is small right now — these hold value unusually well for a modern Gibson because the runs are small and the colour has a cult following.</p>
    <table class="tbl">
      <thead><tr><th>Source</th><th>Status</th><th>Price</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td class="src">Guitar Center</td><td><span class="tag list">Listed · New</span></td><td class="price">$7,099</td><td>"Dark Blue Widow Burst" — current new retail for this exact configuration.</td></tr>
        <tr><td class="src">Reverb</td><td><span class="tag sold">Sold · Mint</span></td><td class="price">$7,199</td><td>2024 LP Custom Figured, trans-blue, mint, sold through a dealer. (Nickel-hardware sibling — same family, same year.)</td></tr>
        <tr><td class="src">Reverb</td><td><span class="tag list">Listed · Used</span></td><td class="price">$6,500–7,500</td><td>Multiple Blue Widow M2M / PSL pieces currently listed by dealers; described as rare &amp; highly desirable.</td></tr>
        <tr><td class="src">eBay</td><td><span class="tag sold">Sold</span></td><td class="price">~$6,750</td><td>Closest clean comp is a 2024 Custom Shop (different model). Blue Widow eBay comps are thin; eBay runs softer than Reverb on high-end Gibsons due to ~13% fees.</td></tr>
        <tr><td class="src">Boutique dealers</td><td><span class="tag list">Listed</span></td><td class="price">$6,500–7,500</td><td>Eddie's, Wildwood, Cream City &amp; similar — where these primarily trade.</td></tr>
      </tbody>
    </table>
    <p class="body" style="margin-top:22px;max-width:64ch"><strong>The catch:</strong> those are <em>dealer / retail</em> numbers. A private seller does not net retail. After Reverb fees (~5%), shipping, and buyers expecting a discount versus a store with a warranty, a private national sale realistically nets somewhere around <strong>$5,200–$6,200</strong>. Selling locally only, in cash, lands lower again — and that's where the Denver-specific math comes in below.</p>
  </div>
</section>

<!-- ===================== 05 VALUATION ===================== -->
<section id="valuation">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">05</span><h2>What <span class="ital">you'd</span> get</h2></div>
    <div class="channels">
      <div class="chan">
        <div class="sub">Sell to a Denver shop</div>
        <h3>Dealer / trade</h3>
        <div class="range">$3,800–4,800</div>
        <div class="sub">cash offer</div>
        <p>Shops pay ~50–65% of what they can resell it for. A high-end store that can actually move a Custom Shop piece (e.g. Wildwood in Louisville, or Coal Creek in Englewood, which buys used gear) will sit at the top of that range; a generalist like Guitar Center will lowball a slow-moving blue LP. Expect <b>$500–$1,000 more in trade or store credit</b> than in cash.</p>
        <span class="pill fast">Instant · same day</span>
      </div>
      <div class="chan">
        <div class="sub">Local online ad · Denver metro</div>
        <h3>Private local</h3>
        <div class="range">$4,800–5,500</div>
        <div class="sub">Facebook / Reverb-local / Craigslist</div>
        <p>List around <b>$5,800–$6,200</b> to leave room; expect to land in the $4,800–$5,500 band with one motivated local buyer. A $5k+ blue Custom Shop Les Paul is a narrow, high-ticket niche — Denver has the player base, but not many buyers for <em>this</em> guitar at any given moment.</p>
        <span class="pill slow">Likely 1–3+ months</span>
      </div>
      <div class="chan">
        <div class="sub">National listing</div>
        <h3>Reverb (best $)</h3>
        <div class="range">$5,200–6,200</div>
        <div class="sub">net after fees &amp; shipping</div>
        <p>The widest buyer pool and the only place the colour reliably finds its person. The $7,199 sold comp shows national demand is real. Price it well and it moves in <b>weeks to ~2 months</b>; the trade-off is packing, shipping a heavy guitar, and fee/return exposure.</p>
        <span class="pill med">Weeks – ~2 months</span>
      </div>
    </div>
    <div class="callout" style="margin-top:24px">
      <div class="kicker">Bottom line</div>
      <p>If speed matters, a Denver shop hands you <b>~$4,000–$4,800</b> today (more in trade). If you want the most money and can wait, list it <b>nationally on Reverb</b> and net <b>~$5,500–$6,000</b>. A local-only cash sale splits the difference on price but can sit for months because of the colour and the price point.</p>
    </div>
  </div>
</section>

<!-- ===================== 06 HELPS / HURTS ===================== -->
<section id="helps">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">06</span><h2>Helps &amp; <span class="ital">hurts</span></h2></div>
    <div class="hh">
      <div class="col help">
        <h3><span class="mk">+</span> Adds value</h3>
        <ul>
          <li><b>Genuine Nashville Custom Shop</b> — a full tier above Gibson USA; roughly double the resale of a USA Custom.</li>
          <li><b>Rare Widow finish</b> with the show-stopping colour-matched binding &amp; headstock inlay — collectible and instantly recognisable.</li>
          <li><b>Strong AAA figured top</b> — the flame is dramatic; figure grade directly moves price.</li>
          <li><b>Gold hardware</b> &amp; full Custom appointments (ebony board, pearl blocks, multi-ply binding).</li>
          <li><b>Complete &amp; correct</b> — OHSC, COA, hang tags, paperwork. Completeness alone is worth several hundred dollars.</li>
          <li><b>Near-mint &amp; recent (2024)</b> — modern Custom Shop QC is well regarded.</li>
        </ul>
      </div>
      <div class="col hurt">
        <h3><span class="mk">–</span> Caps value</h3>
        <ul>
          <li><b>Polarising colour</b> — blue Les Pauls have a far narrower buyer pool than a 'burst or black. It takes the right buyer, not any buyer.</li>
          <li><b>Likely heavy</b> — comparable Widows hit 9.7–10 lb. A 10+ lb weight turns some buyers off; weigh it and disclose.</li>
          <li><b>490R/498T pickups</b> are standard Gibson units, not the Historic-grade Custombuckers purists prize.</li>
          <li><b>Modern, not vintage/Historic</b> — these depreciate like normal used gear once sold; they don't appreciate like a '59 reissue.</li>
          <li><b>Not individually numbered</b> — "rare" but not a numbered limited edition; several are on the market now, which tempers price.</li>
          <li><b>Selling friction</b> — fees (Reverb ~5%, eBay ~13%), shipping a heavy guitar, and any buckle rash / fret wear / finish checking would each chip away.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ===================== 07 VERIFY ===================== -->
<section id="verify">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">07</span><h2>If you're <span class="ital">unsure</span> — how to verify</h2></div>
    <p class="body" style="max-width:64ch;margin-bottom:26px">Run these checks before you list or sell. Each one either confirms the model or changes the number.</p>
    <div class="steps">
      <div class="step"><b>Custom Shop vs USA.</b> Back of headstock should read "Gibson Custom" and there must be a COA. A plain "Gibson"-only headstock with no certificate is a USA model worth far less.</div>
      <div class="step"><b>Decode the serial.</b> Back of headstock. CS + year-digit + number = Custom Shop. Confirms the build year (here, 2024).</div>
      <div class="step"><b>Confirm it's a Widow.</b> Colour-matched binding <em>and</em> a coloured split-diamond inlay = Widow. White/cream binding with a plain pearl inlay = the standard trans-blue variant (often a touch less money).</div>
      <div class="step"><b>Hardware colour.</b> Gold is the premium Widow spec. Nickel "hand-selected top" versions also exist and can price slightly differently.</div>
      <div class="step"><b>Identify the pickups.</b> Pop a pickup ring or check the cavity. 490R/498T = standard. <em>Custombuckers</em> add desirability; <em>EMG actives</em> narrow the buyer pool. This genuinely moves price.</div>
      <div class="step"><b>Weigh it.</b> Put the number in any listing. Under ~9.5 lb helps; 10 lb+ hurts and should be disclosed up front.</div>
      <div class="step"><b>Grade the top.</b> Stronger, more 3-D flame = more money. Photograph it in raking light to show the figure.</div>
      <div class="step"><b>Inspect the headstock &amp; neck.</b> The Achilles heel of Gibsons. Any headstock crack or repair is a major value hit — check the rear (Plate 05) under good light.</div>
    </div>

    <p class="kicker">Feature → value impact (quick reference)</p>
    <table class="impact">
      <thead><tr><th>Feature</th><th>Effect</th><th>Why it matters</th></tr></thead>
      <tbody>
        <tr><td class="feat">Custom Shop vs USA</td><td><span class="chip up">▲ Major</span></td><td>The single biggest lever — Custom Shop roughly doubles a comparable USA Custom.</td></tr>
        <tr><td class="feat">Widow matched binding</td><td><span class="chip up">▲ Helps</span></td><td>Collectible &amp; distinctive — but ties value to the niche colour market.</td></tr>
        <tr><td class="feat">Gold hardware</td><td><span class="chip up">▲ Helps</span></td><td>Premium appointment; expected on the top-spec Widow.</td></tr>
        <tr><td class="feat">Custombucker pickups</td><td><span class="chip up">▲ Helps</span></td><td>Historic-grade pickups raise desirability vs 490R/498T.</td></tr>
        <tr><td class="feat">EMG active pickups</td><td><span class="chip dn">▼ Narrows</span></td><td>Great for metal, but shrinks the traditional-buyer pool.</td></tr>
        <tr><td class="feat">Weight 10 lb+</td><td><span class="chip dn">▼ Hurts</span></td><td>Comfort matters; heavy examples are a harder sell.</td></tr>
        <tr><td class="feat">Blue / non-standard colour</td><td><span class="chip dn">▼ Narrows</span></td><td>Fewer buyers than a 'burst/black; slower sale, occasional premium from the right one.</td></tr>
        <tr><td class="feat">Missing COA or case</td><td><span class="chip dn">▼ Hurts</span></td><td>Drops a Custom Shop piece several hundred dollars; completeness is prized.</td></tr>
        <tr><td class="feat">Headstock / neck repair</td><td><span class="chip dn">▼ Major</span></td><td>The biggest single deduction on any Gibson.</td></tr>
        <tr><td class="feat">Top figure grade</td><td><span class="chip nu">↕ Swings</span></td><td>Stronger AAA flame &gt; plain top; varies piece to piece.</td></tr>
      </tbody>
    </table>
  </div>
</section>

<!-- ===================== 08 LISTING ===================== -->
<section id="listing">
  <div class="wrap">
    <div class="sec-head"><span class="sec-num">08</span><h2>The <span class="ital">listing</span></h2></div>
    <p class="body" style="max-width:64ch;margin-bottom:24px">One copy-ready title and description that works on Reverb, eBay, Facebook Marketplace and Craigslist. Fill the two blanks (weight, and your call on trades), then trim the bracketed shipping line for the local-pickup-only platforms.</p>
    <div class="listing-card">
      <div class="lc-bar"><span class="dot"></span><span class="dot"></span>Copy-ready listing<em>Denver Metro · CO</em></div>
      <div class="lc-body">
        <div class="lc-field">
          <div class="flab">Title</div>
          <div class="lc-title">2024 Gibson Custom Shop Les Paul Custom Figured – Dark Blue Widow Burst, OHSC</div>
          <div class="lc-metaline">76 / 80 characters · within eBay's title limit · keywords front-loaded for search</div>
        </div>
        <div class="lc-field">
          <div class="flab">Description</div>
<p class="lc-desc">2024 Gibson Custom Shop Les Paul Custom Figured in the rare "Dark Blue Widow Burst" finish — a genuine Nashville Custom Shop instrument (serial CS403228), a full tier above the standard Gibson USA line, from the low-volume dealer-exclusive "Widow" run you rarely see come up.

• Hand-picked AAA figured (flame) maple top on a mahogany body
• Trans-blue "Widow" finish — color-matched blue binding on body, neck &amp; headstock, plus the blue split-diamond headstock inlay
• Full Les Paul Custom appointments: ebony fingerboard, pearl block inlays, multi-ply binding
• Gold hardware throughout — Tune-o-matic bridge, stopbar, Grover Kidney tuners
• Factory humbuckers (490R/498T) · 2 volume / 2 tone · 3-way toggle
• 24.75" scale · 12" radius · weight ____ lbs

Condition: near-mint and very lightly played — no breaks, no repairs, no issues. Comes complete with the original Gibson Custom hardshell case, Certificate of Authenticity, hang tags &amp; paperwork.

A genuine head-turner and a serious player's or collector's Custom Shop Les Paul. Priced to sell; reasonable offers considered. Trades: ____.

Located in the Denver metro (Englewood / Denver, CO). Local pickup welcome — cash or verified payment. [Online buyers: shipping available to the lower 48, fully insured &amp; double-boxed.]</p>
        </div>
      </div>
    </div>
    <div class="plat">
      <div class="p"><h5>FB Marketplace</h5><span>Local pickup only — delete the shipping line.</span><span>Expect lowball offers; mark price "firm" or pad it.</span><span>Meet at a police-station safe-exchange lot.</span></div>
      <div class="p"><h5>Craigslist</h5><span>Local pickup, cash — delete the shipping line.</span><span>Denver metro; meet in public, daytime.</span><span>Use a few photos in-post; offer the rest on request.</span></div>
      <div class="p"><h5>Reverb</h5><span>Best reach for this niche colour.</span><span>Enable CONUS shipping, insured + double-boxed.</span><span>~5% fee; keep the shipping line in.</span></div>
      <div class="p"><h5>eBay</h5><span>Broadest audience; ~13% fees.</span><span>Pad the price slightly to absorb fees.</span><span>Ship signature-required; keep all packaging.</span></div>
    </div>
    <div class="lc-foot">
      <b>Suggested ask · $5,800–6,200 local · $6,200–6,500 online (OBO)</b>
      <em>⚑ Confirm weight &amp; pickups before posting</em>
      <em>Lead photos: Plate 04 + Plate 01</em>
    </div>
  </div>
</section>

<!-- ===================== FOOTER ===================== -->
<footer>
  <div class="wrap">
    <div>
      <h4>Methodology</h4>
      <p>Identification from submitted photographs and any accompanying documentation. Valuation triangulated from current dealer/retail pricing, completed Reverb sales, eBay completed listings, and active boutique-dealer asking prices for this model and its closest comparables, as of the issue date. Channel estimates apply standard resale spreads (dealers ~50–65% of resale; private national net after ~5% platform fees and shipping).</p>
    </div>
    <div>
      <h4>Sources consulted</h4>
      <ul>
        <li>Gibson Custom — model / spec references</li>
        <li>Guitar Center — new retail (Dark Blue Widow Burst)</li>
        <li>Reverb — sold &amp; active listings + price guide</li>
        <li>eBay — completed-listing comps</li>
        <li>Eddie's · Wildwood · Cream City · Sweetwater — dealer asks</li>
        <li>Gibson Custom Shop serial-format references</li>
      </ul>
    </div>
  </div>
  <div class="legal">
    <h4>Disclaimer</h4>
    <p>This report is a subjective, good-faith estimate prepared by Coal Creek Guitars for general informational and planning purposes only. It is meant to be used as a tool and a guide &mdash; not gospel, not a certified or insurance appraisal, and not a binding offer to buy, sell, or consign. Every identification, specification, and value is based on the photographs and information provided to us, on third-party listings and sales data, and on market conditions at the time of writing &mdash; all of which may be incomplete, may change quickly, and may contain errors. Actual results depend on many factors outside our control, including the instrument's true condition, authenticity, originality, demand, timing, location, and exactly how and where it is ultimately sold. Coal Creek Guitars makes no representation or warranty, express or implied, as to the accuracy or completeness of this report, and accepts no responsibility or liability for any loss, decision, or outcome arising from reliance on it. Always confirm the items flagged for verification, and for insurance, resale, or legal purposes obtain a certified independent appraisal.</p>
  </div>
</footer>

</body>
</html>

```

---

## INSTRUMENT DETAILS — *fill this in for each guitar, then paste the whole document*

> Fill in everything you can. Put `unknown` where you're not sure — Claude will flag those as items to verify. Attach the photos to the same chat message.

```
Brand:
Model (or "unsure"):
Instrument type (electric / acoustic / bass / other):
Serial number:
Year (if known):
Finish / color:
Pickups / electronics (if known):
Weight in lbs (if known):
Location (city, state — and metro area):
Overall condition:
Known damage / repairs / structural issues:
Modifications (anything non-stock):
Included extras (case, COA, paperwork, hang tags, etc.):
Owner's notes / anything else worth knowing:
Desired sale path (optional — quick cash / maximum money / just curious):
Photos: [attach to this message]
```
