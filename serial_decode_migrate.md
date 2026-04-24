# Serial Decoder Migration Guide

This document captures the current state of the new-format Ibanez serial decoder at:

- Old: `https://www.coalcreekguitars.com/decoders/ibanez-guitar-serial-number-decoder`
- New: `https://www.coalcreekguitars.com/new/decoders/ibanez-guitar-serial-number-decoder/`

The goal is to use the current Ibanez implementation as the template for migrating the other brand decoders into the new Aurora-based format without losing decode behavior or SEO value.

## What Exists Now

The new Ibanez decoder is implemented as a frontend-only route inside `new-app`, with the live decode request still going to the existing backend endpoint:

- Decode API: `POST https://www.coalcreekguitars.com/api/decode`
- Brand sent in payload: `ibanez`

The route is mounted inside the Aurora app and then emitted as a real nested HTML file during build so the direct URL works on deploy.

## Core Files

### Route and page wiring

- `new-app/src/routes/router.tsx`
  - Registers the decoder route.
- `new-app/src/pages/decoders/IbanezDecoder.tsx`
  - Main page composition for the new Ibanez decoder.

### Decoder-specific layout shell

- `new-app/src/layouts/decoder-layout/DecoderPreviewLayout.tsx`
  - Aurora-based sidebar/header wrapper used for the decoder page.
  - Sidebar currently shows:
    - Coal Creek logo
    - `Serial Decoders`
    - `COAL CREEK GUITARS`
    - brand nav items for `Ibanez`, `Gibson`, `Fender`
  - Top header currently shows:
    - Ibanez logo
    - `Back` button

### Left-side decode panel

- `new-app/src/components/sections/dashboards/crm/active-users/ActiveUsers.tsx`
  - Reused Aurora card slot, repurposed into the serial decode interaction area.
  - Handles:
    - serial input
    - decode button
    - `Enter` key decode
    - result rendering
    - post-success collapse of input controls
    - inline `Start Over..` reload link in the results heading row

### Right-side informational panels

- `new-app/src/pages/decoders/IbanezAdditionalInfoPanel.tsx`
  - Renders backend `additionalContextRichText` when returned.
- `new-app/src/pages/decoders/IbanezFaqPanel.tsx`
  - Renders the three FAQ items from the old Ibanez decoder.
- `new-app/src/pages/decoders/IbanezHowToPanel.tsx`
  - Renders the how-to content and example image derived from the old Ibanez decoder.

### Shared top intro block

- `new-app/src/components/sections/dashboards/crm/CRMGreeting.tsx`
  - Extended from stock Aurora CRM greeting to support:
    - custom title
    - custom subtitle
    - optional note content
    - `singleColumn` mode

### Route build and SEO output

- `scripts/sync-new-decoder-routes.mjs`
  - Post-build step that:
    - copies the built app HTML to the nested decoder route
    - cache-busts JS/CSS asset URLs
    - injects route-specific SEO metadata
    - injects crawlable decoder copy into the built HTML

### Caching

- `_headers`
  - `new` HTML is no-cache
  - `new/assets/*` is immutable

## Page Structure in the New Format

The new Ibanez page is intentionally split into three layers:

### 1. Top intro section

Aurora `CRMGreeting` is used in `singleColumn` mode.

It contains:

- Title:
  - `Ibanez Guitar Serial Number Lookup/Decoder`
- Short brand synopsis
- Inline note under synopsis:
  - contact-us link
  - current `Mon/YYYY` decoder freshness note

### 2. Left decode card

Aurora card area adapted for the actual decode interaction.

Before decode:

- heading: `Ibanez Number to Decode`
- serial text input
- `Decode` button

After successful decode:

- the input section collapses completely
- results remain in the same left card
- results heading row becomes:
  - `Decoder Results`
  - `Start Over..` small yellow link on the right

### 3. Right information column

Top-to-bottom order:

1. `Additional decoded information`
   - only rendered when backend returns `additionalContextRichText`
2. `Ibanez Serial Number Lookup/Decoder FAQs`
3. `How to decode an Ibanez serial #`

If no rich text is returned, the first card is omitted entirely.

## Decode Flow

Current decode flow lives in:

- `new-app/src/components/sections/dashboards/crm/active-users/ActiveUsers.tsx`

### Request payload

The new page intentionally matches the current site’s decode contract:

```json
{
  "brand": "ibanez",
  "serial": "<user-entered serial>",
  "pagePath": window.location.pathname,
  "userAgent": navigator.userAgent,
  "clientTimestamp": new Date().toString()
}
```

### Endpoint

```ts
POST https://www.coalcreekguitars.com/api/decode
```

### Successful response handling

On success:

- `info` fields are captured into local state
- `serialNumber` from the response replaces the local serial value
  - useful when backend normalization changes the input
- `additionalContextRichText` is passed upward to the page so the right-side panel can appear

### Rendered left-side fields

Current result rows include:

- `Serial Number`
- `Year`
- `Month`
- `Day`
- `Model`
- `Factory`
- `Country`
- `Notes`

Only truthy populated fields are rendered.

### Error handling

On failure:

- left card shows a warning-colored error message
- additional rich text panel is cleared

## Current Result Layout Behavior

The left-side results were explicitly reworked to avoid flex-wrap collisions with the input/button.

Important implementation detail:

- the input/button area and the result area must live in separate block wrappers
- do not allow the results section to participate in the same row/flex context as the controls

That behavior is already implemented in `ActiveUsers.tsx`.

## Additional Rich Text Handling

The right-side additional info panel uses:

- `new-app/src/pages/decoders/IbanezAdditionalInfoPanel.tsx`

Behavior:

- if backend returns HTML-like content, it is sanitized client-side
- allowed tags are restricted
- links are normalized to safe target/rel attributes
- if plain text or bullet-like text is returned, it is converted into paragraphs/lists

Current panel heading:

- `Additional decoded information`

This panel should be retained for all migrated decoders if the backend can return `additionalContextRichText` for that brand.

## SEO Work Completed

The biggest difference between old and new pages was not visual. It was crawlability.

### Old page characteristics

The old indexed Ibanez page exposes in raw HTML:

- decoder-specific `<title>`
- decoder-specific meta description
- canonical
- OG tags
- Twitter tags
- structured data:
  - `Organization`
  - `WebSite`
  - `WebPage`
  - `WebApplication`
  - `BreadcrumbList`
  - `FAQPage`
- full crawlable decoder body copy in source HTML

### Original new page problem

The new page initially shipped as a generic SPA shell:

- `<title>Coal Creek Guitars</title>`
- generic description
- no route canonical
- no decoder-specific OG/Twitter tags
- no decoder-specific JSON-LD
- almost no crawlable decoder content in source

That is now fixed at build time for the nested decoder route.

### How it is fixed now

`scripts/sync-new-decoder-routes.mjs` now injects decoder-route-specific:

- `<title>`
- `<meta name="description">`
- `<link rel="canonical">`
- `og:*`
- `twitter:*`
- `application/ld+json`
- hidden crawlable body snapshot

The visible React UI is unchanged for users, but bots now see decoder-specific HTML at the route.

## SEO Snapshot Content

The built route HTML currently includes a hidden `.seo-snapshot` block containing:

- H1
- synopsis paragraph
- FAQ content
- how-to decode content

It is visually hidden but still present in the HTML source for crawlers.

For future brands, this content should be swapped brand-by-brand to match the old page’s meaningful decoder copy.

## Build / Route Output Behavior

### Build command

```bash
npm --prefix new-app run build:ccg
```

This does:

1. Vite production build for `new-app`
2. runs `scripts/sync-new-decoder-routes.mjs`

### Output route file

For Ibanez:

- `new/decoders/ibanez-guitar-serial-number-decoder/index.html`

This file is critical. Without it, direct deep-link requests can fall back to the wrong HTML.

## What To Reuse for the Next Decoder

When cloning this pattern for another brand, reuse the structure and swap the brand-specific inputs.

### Files to clone or adapt

Use Ibanez as the template for:

- `new-app/src/pages/decoders/<Brand>Decoder.tsx`
- `new-app/src/pages/decoders/<Brand>FaqPanel.tsx`
- `new-app/src/pages/decoders/<Brand>HowToPanel.tsx`
- optionally reuse `IbanezAdditionalInfoPanel.tsx` generically if you rename it to a shared component later

### Values to swap per brand

For each decoder migration, update:

- route path
- `brand` in decode payload
- top intro title
- brand synopsis
- note/contact text if brand page differs
- FAQ content
- how-to content
- image path in how-to panel
- SEO title
- SEO description
- OG/Twitter description
- structured data `Brand` name
- breadcrumb terminal item
- hidden crawlable snapshot content

## Strong Recommendation for Multi-Brand Migration

Right now Ibanez is hard-coded in several places because it was the first migrated page. Before duplicating many brands, it would be worth extracting a shared brand-decoder config model.

Suggested future refactor:

### Shared config shape

Create one config object per brand with:

- `brandKey`
- `routePath`
- `title`
- `description`
- `ogDescription`
- `synopsis`
- `faqItems`
- `howToHtml`
- `howToImageSrc`
- `howToImageAlt`
- `seoSnapshotHtml`

### Shared components

Then reuse:

- one generic decoder page shell
- one generic decode card
- one generic FAQ panel
- one generic how-to panel
- one generic additional-info panel
- one generic SEO route injection function in `sync-new-decoder-routes.mjs`

That will reduce duplication significantly before migrating all brands.

## Practical Brand Migration Checklist

For each new brand decoder:

1. Create the new route in `router.tsx`
2. Create the new page under `new-app/src/pages/decoders/`
3. Point decode request `brand` to the correct backend brand key
4. Replace intro synopsis
5. Replace FAQ panel content
6. Replace how-to panel content and image
7. Update route generation config in `scripts/sync-new-decoder-routes.mjs`
8. Ensure nested HTML output exists under `new/decoders/<brand>/index.html`
9. Build `new-app`
10. Inspect built route HTML directly for:
   - title
   - description
   - canonical
   - OG/Twitter tags
   - JSON-LD
   - hidden crawlable snapshot
11. Test a live decode on the new route
12. Verify that:
   - left results render correctly
   - right additional-info appears only when rich text exists
   - page source exposes the expected SEO content

## Important Constraints Preserved

The implementation intentionally keeps these boundaries:

- no new backend decoder endpoint was created
- decode still uses the existing `/api/decode`
- the visible page stays Aurora-based
- SEO parity is handled in the built route HTML, not by changing the visible UI to look like the old page

## Files Most Important to Review Before Migrating Another Brand

- `new-app/src/pages/decoders/IbanezDecoder.tsx`
- `new-app/src/components/sections/dashboards/crm/active-users/ActiveUsers.tsx`
- `new-app/src/pages/decoders/IbanezAdditionalInfoPanel.tsx`
- `new-app/src/pages/decoders/IbanezFaqPanel.tsx`
- `new-app/src/pages/decoders/IbanezHowToPanel.tsx`
- `new-app/src/layouts/decoder-layout/DecoderPreviewLayout.tsx`
- `new-app/src/components/sections/dashboards/crm/CRMGreeting.tsx`
- `scripts/sync-new-decoder-routes.mjs`
- `_headers`

## Bottom Line

The current Ibanez `/new` decoder is now the reference implementation for migrating the remaining brand decoders into the new Aurora format.

It already solves:

- route wiring
- direct deep-link HTML output
- frontend decode interaction
- conditional additional-info rendering
- old-page FAQ/how-to content carryover
- crawl-facing SEO parity at the route HTML level

For the next brand migration, the safest approach is:

- copy the Ibanez structure
- replace only the brand-specific content and decode brand key
- update the route SEO config in `scripts/sync-new-decoder-routes.mjs`
- verify the built route HTML before deploying
