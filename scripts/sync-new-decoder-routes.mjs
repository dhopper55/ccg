import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const newRoot = path.join(repoRoot, 'new');
const sourceHtml = path.join(newRoot, 'index.html');

const routeConfigs = [
  {
    routeDir: 'decoders/ibanez-guitar-serial-number-decoder',
    routePath: '/new/decoders/ibanez-guitar-serial-number-decoder/',
    title: 'Ibanez Guitar Serial Number Lookup/Decoder | Coal Creek Guitars',
    description:
      'Free Ibanez guitar serial number lookup/decoder. Find the year, factory location, and production details of your Ibanez guitar. Works with RG, JEM, S, Prestige, and all Ibanez models from Japan, Korea, Indonesia, and China.',
    ogDescription:
      'Free Ibanez serial number lookup/decoder. Find the year, factory location, and production details of your Ibanez guitar.',
    pageName: 'Ibanez Guitar Serial Number Lookup/Decoder',
    brandName: 'Ibanez',
    faqJson: [
      {
        question: 'Where can I find the Ibanez serial number?',
        answer:
          'Most Ibanez guitars list the serial number on the back of the headstock. Some acoustics place it inside the soundhole on a paper label, and older instruments may use a neck plate or stamped marking. If you cannot find it, check the headstock back and the neck joint first.',
      },
      {
        question: 'What can this Ibanez serial number lookup/decoder tell me?',
        answer:
          'It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by era.',
      },
      {
        question: "Why won't my Ibanez serial number decode?",
        answer:
          'Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. Try removing spaces or hyphens, and if it still fails, reach out so we can review it and improve the decoder.',
      },
    ],
    seoBody: `
      <main class="seo-snapshot">
        <h1>Ibanez Guitar Serial Number Lookup/Decoder</h1>
        <p>Founded in 1908 as Hoshino Gakki, a Japanese bookstore chain that began importing Spanish guitars, Ibanez has evolved into a premier manufacturer of guitars, basses, and amplifiers. Known for high-performance instruments favored by rock and metal artists, the company is renowned for its "lawsuit era" copies in the 1970s, which led to iconic original designs like the JEM, RG, and S series.</p>
        <section>
          <h2>Ibanez Serial Number Lookup/Decoder FAQs</h2>
          <h3>Where can I find the Ibanez serial number?</h3>
          <p>Most Ibanez guitars list the serial number on the back of the headstock. Some acoustics place it inside the soundhole on a paper label, and older instruments may use a neck plate or stamped marking. If you cannot find it, check the headstock back and the neck joint first.</p>
          <h3>What can this Ibanez serial number lookup/decoder tell me?</h3>
          <p>It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by era.</p>
          <h3>Why won't my Ibanez serial number decode?</h3>
          <p>Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. The decoder now retries common formatting fixes automatically (such as removing spaces/hyphens), but some serials still require manual review. Also, model codes such as SR305EDX or GRG170DX are not serial numbers and usually cannot provide exact month/year without the actual stamped serial.</p>
        </section>
        <section>
          <h2>How to decode an Ibanez serial number</h2>
          <p>Ibanez serial numbers are generally found on the back of the headstock and can often be decoded by prefix plus date digits. A common modern pattern is factory prefix plus YYMM plus sequence, for example I160100231 means Indonesia, January 2016. This decoder also supports GI plus 7 digits legacy Indonesia GIO format, 5A, 5B, 5N plus 9 digits, 4H or OZ plus 9 digits, 4H plus 10 digits, H plus 9 digits, GZ plus 9 digits, SQ plus YY plus month-letter plus sequence, C plus 7 digits, B plus 9 digits, L or N plus 9 digits, numeric-only 7 to 10 digits, legacy YYMM plus letters formats, and compound codes where an internal prefix is prepended to a standard date payload.</p>
          <h3>Decoding by Location and Year</h3>
          <ul>
            <li>Japan FujiGen 1987 to present starts with a letter followed by 6 to 7 digits. The first two digits after the letter are the year.</li>
            <li>Indonesia 2001 and newer usually uses I, K, J, or U plus 9 digits with YYMM plus sequence. An extended 10 digit variant also appears as YY plus line plus MM plus sequence.</li>
            <li>Indonesia GIO legacy uses GI plus 7 digits on some early GIO production.</li>
            <li>Import prefix variants include 5A, 5B, 5N, 4H, OZ, and H where the remaining digits are read as YYMM plus sequence.</li>
            <li>Korea 1990s C-prefix 7-digit serials can be parsed as YMM plus sequence.</li>
            <li>Month-letter variants use B plus 9 digits where the leading letter can indicate the month.</li>
            <li>Numeric-only import variants use 8 to 10 digits with date plus sequence patterns.</li>
            <li>World short WK format uses WK plus 4 digits and can have more than one plausible interpretation.</li>
          </ul>
          <h3>Key Identification Clues</h3>
          <ul>
            <li>Letter prefix identifies factory or origin.</li>
            <li>First two digits in modern formats represent the year.</li>
            <li>Input cleanup often helps with spaces, hyphens, and common character misreads.</li>
            <li>Model names are not serial numbers and do not provide exact dating without the stamped serial.</li>
          </ul>
        </section>
      </main>
    `,
  },
  {
    routeDir: 'decoders/gibson-guitar-serial-number-decoder',
    routePath: '/new/decoders/gibson-guitar-serial-number-decoder/',
    title: 'Gibson Guitar Serial Number Lookup/Decoder | Coal Creek Guitars',
    description:
      'Free Gibson guitar serial number lookup/decoder. Find the year, factory location, and production details of your Gibson guitar. Works with Les Paul, SG, ES-335, and all Gibson models.',
    ogDescription:
      'Free Gibson serial number lookup/decoder. Find the year, factory location, and production details of your Gibson guitar.',
    pageName: 'Gibson Guitar Serial Number Lookup/Decoder',
    brandName: 'Gibson',
    faqJson: [
      {
        question: 'Where can I find the Gibson serial number?',
        answer:
          'Most Gibson guitars list the serial number on the back of the headstock. Some acoustics place it inside the soundhole on a paper label, and older instruments may use a neck plate or stamped marking. If you cannot find it, check the headstock back and the neck joint first.',
      },
      {
        question: 'What can this Gibson serial number lookup/decoder tell me?',
        answer:
          'It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by era.',
      },
      {
        question: "Why won't my Gibson serial number decode?",
        answer:
          'Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. Try removing spaces or hyphens, and if it still fails, reach out so we can review it and improve the decoder.',
      },
    ],
    seoBody: `
      <main class="seo-snapshot">
        <h1>Gibson Guitar Serial Number Lookup/Decoder</h1>
        <p>The Gibson Guitar Corporation, now known as Gibson Brands, Inc., is an iconic American manufacturer of musical instruments, best known for influential electric and acoustic guitars such as the Les Paul. Founded in 1894 and headquartered in Nashville, Tennessee, Gibson has a long history of craftsmanship and musical innovation.</p>
        <section>
          <h2>Gibson Serial Number Lookup/Decoder FAQs</h2>
          <h3>Where can I find the Gibson serial number?</h3>
          <p>Most Gibson guitars list the serial number on the back of the headstock. Some acoustics place it inside the soundhole on a paper label, and older instruments may use a neck plate or stamped marking. If you cannot find it, check the headstock back and the neck joint first.</p>
          <h3>What can this Gibson serial number lookup/decoder tell me?</h3>
          <p>It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by era.</p>
          <h3>Why won't my Gibson serial number decode?</h3>
          <p>Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. Try removing spaces or hyphens, and if it still fails, reach out so we can review it and improve the decoder.</p>
        </section>
        <section>
          <h2>How to decode a Gibson serial number</h2>
          <p>Gibson serial numbers have changed over time, but most modern Gibson USA, Gibson Acoustic, and Gibson Memphis instruments use an 8-digit stamp on the back of the headstock. If your serial does not match the standard pattern, it may be from a different era, model line, or special run.</p>
          <ol>
            <li>Find the serial number on the back of the headstock. Many Gibsons also include MADE IN USA below the stamp.</li>
            <li>Check the 8-digit 1977 to present format YDDDYRRR. The first and fifth digits indicate the year, the middle three digits are the day of the year, and the last three digits are the factory ranking or plant designation for that day.</li>
            <li>Watch for 1975 to 1977 decals. In that period, Gibson used an 8-digit decal where the first two digits indicate the year, such as 99 for 1975, 00 for 1976, and 06 for 1977.</li>
          </ol>
          <p>Gibson has multiple exceptions and model-specific formats, so the official Gibson serial number guide remains the best reference for tricky cases.</p>
        </section>
      </main>
    `,
  },
];

if (!fs.existsSync(sourceHtml)) {
  throw new Error(`Missing built new-app entry: ${sourceHtml}`);
}

const buildStamp = Date.now().toString();
const rawHtml = fs.readFileSync(sourceHtml, 'utf8');
const stampedHtml = rawHtml.replace(/(\/new\/assets\/[^"'?]+\.(?:js|css))(?!\?v=)/g, `$1?v=${buildStamp}`);
fs.writeFileSync(sourceHtml, stampedHtml);

function injectRouteSeo(baseHtml, config) {
  const pageUrl = `https://www.coalcreekguitars.com${config.routePath}`;
  const imageUrl = 'https://www.coalcreekguitars.com/images/coal-creek-logo.png';

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://www.coalcreekguitars.com/#organization',
        name: 'Coal Creek Guitars',
        url: 'https://www.coalcreekguitars.com',
        logo: imageUrl,
      },
      {
        '@type': 'WebSite',
        '@id': 'https://www.coalcreekguitars.com/#website',
        url: 'https://www.coalcreekguitars.com',
        name: 'Coal Creek Guitars',
        publisher: {
          '@id': 'https://www.coalcreekguitars.com/#organization',
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: config.pageName,
        description: config.description,
        isPartOf: {
          '@id': 'https://www.coalcreekguitars.com/#website',
        },
        about: {
          '@type': 'Brand',
          name: config.brandName,
        },
        publisher: {
          '@id': 'https://www.coalcreekguitars.com/#organization',
        },
      },
      {
        '@type': 'WebApplication',
        name: config.pageName,
        description: config.description,
        url: pageUrl,
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web Browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        provider: {
          '@id': 'https://www.coalcreekguitars.com/#organization',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://www.coalcreekguitars.com/index.html',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Guitar Serial Number Lookup/Decoder',
            item: 'https://www.coalcreekguitars.com/decoders/guitar-serial-decoder-lookup.html',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: config.pageName,
            item: pageUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: config.faqJson.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };

  const descriptionMeta = `<meta name="description" content="${config.description.replace(/"/g, '&quot;')}" />`;

  const seoHead = `
    <link rel="canonical" href="${pageUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${config.title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${config.ogDescription.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${pageUrl}" />
    <meta name="twitter:title" content="${config.title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${config.ogDescription.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    <style>
      .seo-snapshot {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    </style>
  `.trim();

  let html = baseHtml;
  html = html.replace(/<title>.*?<\/title>/, `<title>${config.title}</title>`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?\/>/, descriptionMeta);
  html = html.replace('</head>', `${seoHead}\n  </head>`);
  html = html.replace('<div id="root"></div>', `${config.seoBody}\n    <div id="root"></div>`);
  return html;
}

for (const routeConfig of routeConfigs) {
  const routeHtml = injectRouteSeo(stampedHtml, routeConfig);
  const targetDir = path.join(newRoot, routeConfig.routeDir);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), routeHtml);
}

console.log(`Synced ${routeConfigs.length} new-app decoder route entries with build stamp ${buildStamp}.`);
