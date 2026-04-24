import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const decodersDir = path.join(repoRoot, 'decoders');
const indexHtmlPath = path.join(decodersDir, 'guitar-serial-decoder-lookup.html');
const outputPath = path.join(repoRoot, 'new-app', 'src', 'pages', 'decoders', 'decoder-configs.json');

function requireMatch(input, regex, label) {
  const match = input.match(regex);
  if (!match) {
    throw new Error(`Unable to parse ${label}`);
  }
  return match;
}

function stripTags(input) {
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingDivEnd(input, startIndex) {
  const tagRegex = /<\/?div\b[^>]*>/gi;
  tagRegex.lastIndex = startIndex;

  let depth = 0;
  let match;
  while ((match = tagRegex.exec(input))) {
    const tag = match[0];
    const isClosing = /^<\//.test(tag);
    depth += isClosing ? -1 : 1;
    if (depth === 0) {
      return match.index + tag.length;
    }
  }

  return -1;
}

function extractDivInnerHtml(input, markerRegex, label) {
  const match = markerRegex.exec(input);
  if (!match) {
    return '';
  }

  const startIndex = match.index;
  const openTagEnd = input.indexOf('>', startIndex);
  const endIndex = findMatchingDivEnd(input, startIndex);
  if (openTagEnd < 0 || endIndex < 0) {
    throw new Error(`Unable to balance ${label}`);
  }

  return input.slice(openTagEnd + 1, endIndex - '</div>'.length).trim();
}

function normalizeLegacyHtml(input, { decoderHref } = {}) {
  let html = input.trim();

  if (decoderHref) {
    const newSelfUrl = `https://www.coalcreekguitars.com/new/decoders/${decoderHref.replace(/\.html$/, '/')}`;
    html = html.replace(new RegExp(decoderHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newSelfUrl);
  }

  html = html
    .replace(/href="\.\.\/([^"]+)"/g, 'href="https://www.coalcreekguitars.com/$1"')
    .replace(/src="\.\.\/([^"]+)"/g, 'src="https://www.coalcreekguitars.com/$1"')
    .replace(/href="([a-z0-9-]+-guitar-serial-number-decoder)\.html"/gi, 'href="https://www.coalcreekguitars.com/new/decoders/$1/"')
    .replace(/href="guitar-serial-decoder-lookup\.html"/g, 'href="https://www.coalcreekguitars.com/decoders/guitar-serial-decoder-lookup.html"');

  return html;
}

function buildSeoBody({ title, brandDescriptionHtml, faqTitle, faqItems, howToTitle, howToHtml, noteHtml, relatedHtml, decoderHref }) {
  const introHtml = normalizeLegacyHtml(
    brandDescriptionHtml
      .replace(/<br>\s*<a[^>]*>[\s\S]*?<\/a>/i, '')
      .replace(/<a[^>]*class="decoder-howto-link"[^>]*>[\s\S]*?<\/a>/i, ''),
    { decoderHref },
  );

  const faqSection = `
    <section>
      <h2>${faqTitle}</h2>
      ${faqItems
        .map(
          (item) => `
            <h3>${item.question}</h3>
            <p>${normalizeLegacyHtml(item.answerHtml, { decoderHref })}</p>
          `,
        )
        .join('')}
    </section>
  `;

  const noteSection = noteHtml
    ? `
      <section>
        <h2>Decoder Note</h2>
        ${normalizeLegacyHtml(noteHtml, { decoderHref })}
      </section>
    `
    : '';

  const howToSection = howToHtml
    ? `
      <section>
        <h2>${howToTitle}</h2>
        ${normalizeLegacyHtml(howToHtml, { decoderHref })}
      </section>
    `
    : '';

  const extraSections = relatedHtml ? normalizeLegacyHtml(relatedHtml, { decoderHref }) : '';

  return `
      <main class="seo-snapshot">
        <h1>${title}</h1>
        <p>${introHtml}</p>
        ${faqSection}
        ${noteSection}
        ${howToSection}
        ${extraSections}
      </main>
    `;
}

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const orderedBrands = [...indexHtml.matchAll(/<a href="([^"]+)" class="brand-select-card">[\s\S]*?<img src="([^"]+)" alt="([^"]+)"[\s\S]*?<span class="brand-select-name">([^<]+)<\/span>/g)].map(
  (match) => ({
    href: match[1],
    logoSrc: match[2].replace('../', '/'),
    navName: match[3],
    navLabel: match[4],
  }),
);

const configs = orderedBrands.map((brand) => {
  const decoderHtml = fs.readFileSync(path.join(decodersDir, brand.href), 'utf8');
  const slug = brand.href.replace(/\.html$/, '');
  const routePath = `/decoders/${slug}`;
  const routeDir = `decoders/${slug}`;
  const newPublicUrl = `https://www.coalcreekguitars.com/new/decoders/${slug}/`;

  const title = requireMatch(decoderHtml, /<title>([\s\S]*?)<\/title>/i, `${brand.href} title`)[1].trim();
  const description = requireMatch(
    decoderHtml,
    /<meta name="description" content="([\s\S]*?)">/i,
    `${brand.href} description`,
  )[1].trim();
  const ogDescription = requireMatch(
    decoderHtml,
    /<meta property="og:description" content="([\s\S]*?)">/i,
    `${brand.href} og description`,
  )[1].trim();
  const brandKey = requireMatch(decoderHtml, /<body[^>]*data-preselect-brand="([^"]+)"/i, `${brand.href} brand key`)[1].trim();
  const pageTitle = requireMatch(decoderHtml, /<h1>([\s\S]*?)<\/h1>/i, `${brand.href} h1`)[1].trim();
  const brandDescriptionHtml = requireMatch(
    decoderHtml,
    /<p class="brand-description">([\s\S]*?)<\/p>/i,
    `${brand.href} brand description`,
  )[1].trim();
  const noteHtmlMatch = decoderHtml.match(/<div class="decoder-note">([\s\S]*?)<\/div>/i);
  const faqSectionHtml = requireMatch(
    decoderHtml,
    /<section class="decoder-faq">([\s\S]*?)<\/section>/i,
    `${brand.href} faq section`,
  )[1];
  const faqTitle = requireMatch(faqSectionHtml, /<h2>([\s\S]*?)<\/h2>/i, `${brand.href} faq title`)[1].trim();
  const faqItems = [...faqSectionHtml.matchAll(/<div class="decoder-faq-item">[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/div>/gi)].map(
    (match) => ({
      question: stripTags(match[1]),
      answerHtml: match[2].trim(),
      answerPlain: stripTags(match[2]),
    }),
  );

  const howToModalMatch = decoderHtml.match(/<div id="howto-[^"]+" class="decoder-modal/i);
  const howToTitleMatch = decoderHtml.match(/<h2 id="howto-[^"]+-title">([\s\S]*?)<\/h2>/i);
  const howToHtml = extractDivInnerHtml(decoderHtml, /<div class="decoder-modal-body">/i, `${brand.href} how-to body`);
  const footerIndex = decoderHtml.indexOf('<footer class="site-footer">');
  const howToModalStart = howToModalMatch ? howToModalMatch.index ?? -1 : -1;
  const howToModalEnd = howToModalStart >= 0 ? findMatchingDivEnd(decoderHtml, howToModalStart) : -1;
  const afterContentStart = howToModalEnd;
  const relatedHtml =
    afterContentStart >= 0 && footerIndex > afterContentStart
      ? decoderHtml.slice(afterContentStart, footerIndex).trim()
      : '';

  const noteHtml = noteHtmlMatch ? noteHtmlMatch[1].trim() : '';
  const howToTitle = howToTitleMatch ? stripTags(howToTitleMatch[1]) : `How to decode a ${brand.navName} serial number`;

  return {
    brandKey,
    brandName: brand.navName,
    navLabel: brand.navLabel,
    logoSrc: brand.logoSrc,
    href: brand.href,
    slug,
    routePath,
    routeDir,
    publicUrl: newPublicUrl,
    title,
    pageTitle,
    description,
    ogDescription,
    brandDescriptionHtml: normalizeLegacyHtml(brandDescriptionHtml, { decoderHref: brand.href }),
    brandDescriptionText: stripTags(
      brandDescriptionHtml
        .replace(/<br>\s*<a[^>]*>[\s\S]*?<\/a>/i, '')
        .replace(/<a[^>]*class="decoder-howto-link"[^>]*>[\s\S]*?<\/a>/i, ''),
    ),
    noteHtml: normalizeLegacyHtml(noteHtml, { decoderHref: brand.href }),
    faqTitle,
    faqItems,
    howToTitle,
    howToHtml: normalizeLegacyHtml(howToHtml, { decoderHref: brand.href }),
    relatedHtml: normalizeLegacyHtml(relatedHtml, { decoderHref: brand.href }),
    seoBody: buildSeoBody({
      title: pageTitle,
      brandDescriptionHtml,
      faqTitle,
      faqItems,
      howToTitle,
      howToHtml,
      noteHtml,
      relatedHtml,
      decoderHref: brand.href,
    }),
  };
});

fs.writeFileSync(outputPath, `${JSON.stringify(configs, null, 2)}\n`, 'utf8');
console.log(`Wrote ${configs.length} decoder config records to ${path.relative(repoRoot, outputPath)}`);
