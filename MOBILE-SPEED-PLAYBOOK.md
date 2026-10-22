# Mobile-First & Speed Playbook

A reusable handoff from the Coal Creek Guitars site overhaul (Oct 2026). It covers what we did,
in what order, how we measured it, and the traps we hit. It's written so the same approach can be
applied to a different website and stack. The CCG specifics are examples, not requirements.

---

## 1. Principles

1. **Measure first, on a slow phone, before changing anything.** Every fix was chosen from
   measurements, not guesses. Re-measure after each change, on the live site.
2. **Design and test at 390 px wide first.** Desktop is the second check, not the first. The
   biggest problems we found (no navigation on phones, one product per screen) were invisible on
   desktop.
3. **Ship the content in the HTML.** Search engines and slow phones should see the heading, text,
   and links before any JavaScript runs.
4. **Every byte has to earn its place.** Images sized to how they're displayed. JavaScript only for
   the page being viewed. Nothing render-blocking that isn't needed for first paint.
5. **One address per page.** No internal link, sitemap entry, or canonical should point at a URL
   that redirects.
6. **Verify on live after the deploy has actually finished.** Twice we "verified" an old build.
   Check the deployed asset hash or file before testing.

---

## 2. How to measure (the test harness)

We used **Playwright (Chromium)** driven from Python. Any headless browser works. Settings that
approximate a mid-range phone on mediocre 4G:

| Setting | Value |
|---|---|
| Viewport | 390 × 844, `deviceScaleFactor: 2`, `isMobile: true`, `hasTouch: true` |
| Network (CDP `Network.emulateNetworkConditions`) | latency 150 ms, download 1.6 Mbps, upload 750 Kbps |
| CPU (CDP `Emulation.setCPUThrottlingRate`) | 4× slowdown |
| Desktop comparison | 1440 × 900, no throttling |

**What to record per page:**

- **LCP** (Largest Contentful Paint) via `PerformanceObserver({type:'largest-contentful-paint'})`.
  Also record *which element* it is: that tells you what to optimise. Target **< 2.5 s**.
- **CLS** (layout shift) via `PerformanceObserver({type:'layout-shift'})`, with the shifting
  elements (`entry.sources`). Target **< 0.1**.
- **Load time** (`loadEventEnd`), plus bytes by type (JS / CSS / images / fonts) from
  `performance.getEntriesByType('resource')`.
- **Sideways overflow**: `document.documentElement.scrollWidth > viewport width`. Find the culprit
  by listing elements whose `getBoundingClientRect().right` exceeds the viewport.
- **Tap targets** under 24 px tall, and **text** under 12 px.
- **Console / page errors** (`pageerror`, console `error`).
- **Raw HTML as a crawler sees it** (plain HTTP fetch, no JS): title, meta description, canonical,
  H1 count, word count, JSON-LD types, `<img>` without alt.

**Bundle analysis:** build with source maps and run `source-map-explorer` (or
`rollup-plugin-visualizer`) to attribute bytes to packages and source files. Also scan the built
JS for very long string literals: that's how we found 300 KB of JSON that the source map had
mis-attributed.

**Local-before-live trick:** route the production hostname to local files with Playwright's
`page.route()`. That lets you test the exact HTML and assets you're about to deploy, with real
absolute URLs.

---

## 3. Order of work (what paid off most)

Roughly in order of impact for effort. Do a full audit first, then work down this list.

### A. Navigation on phones
- **Problem:** the desktop menu was hidden under a media query with **no menu button in its
  place**, on every static page.
- **Fix:** one shared script (`/js/site-menu.js`) that adds a menu button to each page's existing
  header and opens a slide-in panel.
  - The button shows **only while the page's own desktop links are hidden** (it checks
    `offsetParent`/`display`), so it follows each page's breakpoint.
  - Panel details: `aria-expanded`, Escape to close, a backdrop, body scroll lock, and
    `visibility:hidden` when closed so keyboard users can't tab into it.
  - The current page is highlighted (`aria-current`).
- **Lesson:** keep *one* source for menu content. If there are two menus (static pages + app), note
  in both files that they must stay in step.

### B. Images (usually the biggest byte win)
- **Results:**
  - repair page 6.9 MB → 15 KB (on first load)
  - homepage 6.5 MB → 0.3 MB (on first load)
  - decoder example photos 11 MB → 0.4 MB
  - logo 2.2 MB PNG → 14 KB WebP
- **Method:**
  1. Measure each image's *rendered* width on phone and desktop.
  2. Generate WebP at `max(desktop width, 2 × phone width)`, capped at ~1400 px. We used Pillow,
     `quality 80`, `method=6`.
  3. Rewrite `<img>` with `width`/`height` attributes (prevents layout shift).
  4. Add `loading="lazy" decoding="async"` for anything below the first screen.
  5. Give the hero `fetchpriority="high"`, plus a `srcset` / `sizes` for full-width images.
- **Keep originals.** Write variants next to them (`name-800w.webp`). Social share tags
  (`og:image`) can keep a large original; visitors never download it.
- **Watch for:** a logo or icon shown at 32 px but stored at 1536 px; PNG screenshots of documents
  (huge); full-size images in modals/lightboxes (point those at a ~1400 px version too).

### C. JavaScript bundle
- **Results:** shop bundle 5.5 MB (1.58 MB gzip) → 0.9 MB (283 KB gzip).
- **The biggest single cause:** a template utility imported the **TypeScript compiler** for a
  docs-only feature. Because every page imported that utility, 3.5 MB shipped to every visitor.
  **Purchased templates are full of this.** Check the analyzer for anything that isn't your app.
- **Route-level code splitting** (`React.lazy` per page plus `<Suspense>`): data used only by one
  page type (our 300 KB decoder config) moves out of the main bundle.
- **Remove template leftovers:** i18n libraries for a one-language site, date-picker and data-grid
  theme overrides, global CSS for charts/calendars/editors, scrollbar libraries, icon sets bundled
  offline (we trimmed 479 icons to the 57 actually used).
- **Reload on stale chunk:** `window.addEventListener('vite:preloadError', () => location.reload())`.
  A tab opened before a deploy otherwise breaks when it asks for a deleted chunk file.

### D. Caching
- Hashed build assets (`name-<hash>.js`) should be `Cache-Control: public, max-age=31536000,
  immutable`; HTML entry points `no-cache`.
- **Check the actual response header**, not the config file. See traps.

### E. Server-rendered content for crawlers and slow phones
- For a client-rendered app (React SPA), the edge (a Cloudflare Worker in our case) injects into
  the HTML shell: title, meta description, canonical, Open Graph tags, JSON-LD, and **a plain HTML
  version of the page content** (H1, intro, category links, product links with prices) inside
  `<div id="root">`. `createRoot` replaces it when the app mounts.
- Result: listing pages show meaningful content in ~0.5 s, and Google sees every product link
  without running JS.
- Also render the same H1/intro in the app itself, so the post-JS DOM matches.

### F. Layout stability (CLS)
- **Web-font swap** caused our worst shifts (0.15). Fix: declare **size-matched fallback fonts**:
  `@font-face { font-family: 'X Fallback'; src: local('Georgia'); size-adjust: N%; }`, then put
  `'X', 'X Fallback', …` in the stack.
  - **Tune `N` empirically.** Measure CLS across several pages at a few values. Width-ratio maths
    gave 97%; 106% was actually best because line height differs too.
- Reserve space for anything that loads later (fixed aspect-ratio boxes for thumbnails, width and
  height on images).

### G. Render-blocking third-party scripts
- A payment SDK (Stripe.js, ~270 KB) loaded synchronously in `<head>` delayed first paint by
  2–5 s. It's only needed at the payment step, so make it `async` and, before use, wait for the
  global to exist.
- Audit every `<script>` in `<head>`: if it isn't needed to draw the first screen, it shouldn't
  block.

### H. Phone-specific UI patterns
- **Listing grids:** two columns on phones (smaller image, title clamp, smaller price, hide
  secondary chips). We went from one product per screen to about four.
- **Filters:** a full filter drawer on phones (sort, category, brand, price) with a backdrop, a
  sticky "Show N items" button, and long sections (Category) **collapsed by default on phones
  only**.
- **Header:** icon buttons, not text buttons; conditional icons (show the cart only when it has
  items); keep the search box full width.
- **Wide tables:** let cells wrap and add `overflow-x:auto` on the table under ~600 px, so the
  *page* never scrolls sideways.

### I. Image carousels / galleries
- `loading="lazy"` does **not** help inside a carousel: off-screen slides sit next to the
  viewport, so the browser fetches them all.
- **Fix:** only mount the `<img>` for the current slide; mount neighbours after the first image
  loads or when the user swipes. Hold thumbnails until the main image has loaded. Use a `srcset`
  so phones get ~800 px, not 1400 px.

---

## 4. Technical SEO checklist

- [ ] **Sitemap lists only final URLs** (each returns 200, no redirect). Check every entry with a
      script.
- [ ] **Canonical = the page's own final URL.** Watch hosts that rewrite URLs (Cloudflare Pages
      drops `.html` and adds a trailing slash to folder pages).
- [ ] **Internal links point at final URLs** (no `.html`, correct trailing slash, no
      `/index.html`).
- [ ] **Real 404s.** Single-page-app hosting often serves the homepage with **200** for any unknown
      URL ("soft 404"). Add a `404.html`, and make unknown app routes return a 404 status.
- [ ] **Bare domain → www** (or the reverse) with a 301 that **preserves the path and query
      string**. Confirm the bare domain even has a DNS record.
- [ ] Title ≤ ~60–65 characters, meta description ≤ ~155 characters, one H1 per page.
- [ ] **JSON-LD:** Product (price, availability, *real* condition), Organization/LocalBusiness,
      BreadcrumbList, FAQPage where applicable. Validate that it parses.
- [ ] **Sold / unavailable items:** remove them from the sitemap and send `noindex, follow` (meta +
      `X-Robots-Tag`). Keep the page reachable for old links.
- [ ] Alt text on content images (product photos: use the product title); accessible names on
      icon-only buttons and links.
- [ ] `robots.txt` blocks cart/admin/API; it doesn't block anything you want indexed.
- [ ] Set up **Google Search Console** to see indexing, structured-data errors, and real-user
      Core Web Vitals.

---

## 5. Traps we hit (check for these early)

1. **Cache-busting query strings + code splitting = the app loads twice.** Build scripts appended
   `?v=` / `?version=` to the entry script in the HTML, while lazy chunks import it as
   `./index-<hash>.js` (no query). The browser treats those as two modules and runs the app twice,
   with two Reacts and "Invalid hook call". **The live shop broke.** Rule: **never add query
   strings to content-hashed assets.** We changed both scripts to strip them.
2. **Host header rules merge.** On Cloudflare Pages, `_headers` applies **every** matching rule. A
   broad `/app/*  Cache-Control: no-store` merged into the hashed-asset rule, so assets went out
   with `immutable` *and* `no-store`, and `no-store` wins: nothing was cached. Use narrow rules and
   check real headers with `curl -I`.
3. **Verifying before the deploy finished.** Poll the live HTML for the new asset hash before
   testing.
4. **Preloading the main image made LCP worse** on a slow connection. It competed with the JS the
   page needed. Measure before keeping any "optimisation".
5. **Source maps can mis-attribute large JSON.** Cross-check by scanning the built JS for long
   string literals.
6. **Template placeholder content in production:** a hard-coded "You saved 30%" message on every
   cart; in-store POS buttons ("Open Drawer", "Print Receipt") shown to all customers. Grep a
   purchased template for demo text and staff-only UI.
7. **The canonical pointed at a URL that redirects away from itself.** That's a mixed signal and
   Google may ignore it.
8. **Data hygiene leaks into URLs:** AI-generated listing text began with "Title:", producing
   `/title-ibanez-…` slugs. Strip labels at input, and redirect any renamed slugs.
9. **The desktop-designed nav simply disappeared on phones**, with no hamburger. Easy to miss when
   the designer works on desktop.
10. **Python `urllib` is blocked by Cloudflare (403).** Use a browser user-agent for crawl scripts.

---

## 6. QA pass (definition of done)

Run these against **live** after each release:

- [ ] **Link crawl:** every sitemap page returns 200; every internal link/asset on those pages
      returns 200 (list redirects separately and fix them).
- [ ] **Core flows on phone and desktop:** search, sort, filter, pagination, product page, add to
      cart, cart, start of checkout (stop before payment), any calculators/tools with known-answer
      inputs.
- [ ] **Each page type at 390 px:** no sideways scroll, menu present and working, no broken
      images after scrolling (so lazy images load), no JS errors.
- [ ] **Unknown URLs return 404** (static, app category, app item).
- [ ] **Slow-phone metrics per template:** LCP < 2.5 s target, CLS < 0.1. Record before/after.
- [ ] **Asset headers:** hashed files `immutable`, HTML `no-cache`; the main bundle loads exactly
      **once**.

---

## 7. Results reference (CCG, slow-phone settings)

| Page | Before | After |
|---|---|---|
| Homepage: main content / fully loaded | 17.8 s / 33.7 s | 2.9 s / 3.3 s |
| Shop list: main content | 14.8 s | 0.5 s (server-rendered list) |
| Shop bundle (gzip) | 1,577 KB | 283 KB |
| Repair page: fully loaded | 35.9 s | 2.6 s |
| Valuation page: main content / CLS | 3.1 s / 0.15 | 0.4 s / 0.004 |
| Product page photo data | 909 KB | 297 KB |
| Sitemap products | 506 (incl. sold) | 305 (for sale only) |

---

## 8. Starting a new project

1. Run the audit in §2 on every page *type* (home, listing, detail, content, form, tool) at phone
   size. Save the numbers.
2. Run a bundle analysis; remove anything that isn't your app.
3. Work through §3 in order, re-measuring after each step.
4. Apply the §4 SEO checklist; scan for the §5 traps.
5. Finish with the §6 QA pass on live; keep the scripts so the pass can be re-run every release.

**If you're building from scratch, design to avoid these problems from the start:**
- A phone menu.
- Two-column phone grids.
- Images generated at display size, with lazy loading.
- Route splitting.
- No render-blocking third-party scripts.
- Content in the HTML (static or server-rendered).
- Size-matched font fallbacks.
- A real 404.
- Final URLs everywhere.
