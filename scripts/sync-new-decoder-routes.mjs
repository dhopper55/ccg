import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const newRoot = path.join(repoRoot, 'new');
const sourceHtml = path.join(newRoot, 'index.html');
const decoderConfigsPath = path.join(repoRoot, 'new-app', 'src', 'pages', 'decoders', 'decoder-configs.json');
const decoderConfigs = JSON.parse(fs.readFileSync(decoderConfigsPath, 'utf8'));
const featuredBrandKeys = ['gibson', 'fender', 'ibanez', 'yamaha', 'prs', 'epiphone', 'martin', 'taylor', 'esp'];

function buildLandingSeoBody(configs) {
  const featured = configs.filter((config) => featuredBrandKeys.includes(config.brandKey));
  const remaining = configs.filter((config) => !featuredBrandKeys.includes(config.brandKey));

  const renderBrandLinks = (items) => `
    <ul>
      ${items
        .map(
          (item) => `
            <li><a href="${item.publicUrl}">${item.brandName} Guitar Serial Number Lookup/Decoder</a></li>
          `,
        )
        .join('')}
    </ul>
  `;

  return `
      <main class="seo-snapshot">
        <h1>Guitar Serial Number Lookup/Decoder</h1>
        <p>Use our guitar serial number lookup tools to identify the production year, factory, country of origin, and other build details for many major guitar brands. Because serial systems vary widely by maker and era, choose the brand-specific decoder that matches your instrument.</p>
        <section>
          <h2>Featured Guitar Serial Number Lookup Tools</h2>
          <p>Start with the most commonly used guitar serial number decoders, including Gibson, Fender, Ibanez, Yamaha, PRS, Epiphone, Martin, Taylor, and ESP.</p>
          ${renderBrandLinks(featured)}
        </section>
        <section>
          <h2>All Supported Decoder Brands</h2>
          <p>Browse the full brand directory for supported serial number lookup pages covering electric, acoustic, and imported guitar production across many eras.</p>
          ${renderBrandLinks(remaining)}
        </section>
        <section>
          <h2>Where To Find Your Guitar Serial Number</h2>
          <p>Most guitars place the serial number on the back of the headstock, but some use a neck plate, heel stamp, or label inside the soundhole. Acoustics and vintage instruments often differ from modern electrics, so checking more than one location is common.</p>
          <h2>What A Serial Number Can Tell You</h2>
          <p>A serial number can often reveal the production year, factory code, country of origin, and approximate place in a production run. Some brands also encode month, day, or line information, while others only support a narrower year estimate.</p>
          <h2>Why Some Serial Numbers Do Not Decode Cleanly</h2>
          <p>Serial systems change over time, and many brands used overlapping, inconsistent, or factory-specific formats. Worn stamps, partial labels, unusual imports, and model numbers mistaken for serial numbers are all common causes of failed lookups.</p>
          <h2>Why Year And Factory Estimates Can Vary By Brand</h2>
          <p>Some guitars can only be dated to a range rather than an exact year or day. Reissues, transitional production periods, outsourced factories, and missing historical factory records can all affect decoding confidence.</p>
        </section>
        <section>
          <h2>Guitar Serial Number Lookup FAQs</h2>
          <h3>Where can I find my guitar serial number?</h3>
          <p>Most guitars place the serial number on the back of the headstock. Acoustics may list it inside the soundhole on a paper label, and some older guitars use a neck plate or stamped marking. Check the headstock back and neck joint first.</p>
          <h3>What can this guitar serial number lookup/decoder tell me?</h3>
          <p>It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by brand and era.</p>
          <h3>Why won't my guitar serial number decode?</h3>
          <p>Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. Try removing spaces or hyphens, and if it still fails, contact us so we can review it and improve the decoder.</p>
          <h3>Is a model number the same as a serial number?</h3>
          <p>No. A model number identifies the instrument line or configuration, while a serial number is the unique production identifier. Entering the model instead of the serial is one of the most common reasons a lookup fails.</p>
        </section>
      </main>
    `;
}

const routeConfigs = [
  {
    routeDir: 'decoders/guitar-serial-decoder-lookup',
    routePath: '/new/decoders/guitar-serial-decoder-lookup/',
    title: 'Guitar Serial Number Lookup/Decoder | Coal Creek Guitars',
    description:
      'Free guitar serial number lookup/decoder. Find out when and where your guitar was made. Supports Gibson, Kramer, B.C. Rich, Fender, Squier, Epiphone, Taylor, Martin, Ibanez, Yamaha, PRS, ESP, Schecter, Gretsch, Jackson, Cort, Takamine, Washburn, Dean, Ernie Ball Music Man, Guild, Alvarez, Godin, Ovation, Charvel, and Rickenbacker serial numbers.',
    ogDescription:
      'Free guitar serial number lookup/decoder. Find out when and where your guitar was made. Supports Gibson, Kramer, B.C. Rich, Fender, Squier, Epiphone, Taylor, Martin, Ibanez, Yamaha, PRS, ESP, Schecter, Gretsch, Jackson, Cort, Takamine, Washburn, Dean, Ernie Ball Music Man, Guild, Alvarez, Godin, Ovation, Charvel, and Rickenbacker.',
    pageName: 'Guitar Serial Number Lookup/Decoder',
    brandName: 'Guitar Brands',
    faqJson: [
      {
        question: 'Where can I find my guitar serial number?',
        answer:
          'Most guitars place the serial number on the back of the headstock. Acoustics may list it inside the soundhole on a paper label, and some older guitars use a neck plate or stamped marking. Check the headstock back and neck joint first.',
      },
      {
        question: 'What can this guitar serial number lookup/decoder tell me?',
        answer:
          'It typically identifies the production year, factory or plant code, and country of origin. Some serial formats also hint at model lines or production sequence, but that varies by brand and era.',
      },
      {
        question: "Why won't my guitar serial number decode?",
        answer:
          'Serial formats change over time, and limited runs or custom shop instruments can deviate from standard patterns. Try removing spaces or hyphens, and if it still fails, contact us so we can review it and improve the decoder.',
      },
      {
        question: 'Is a model number the same as a serial number?',
        answer:
          'No. A model number identifies the instrument line or configuration, while a serial number is the unique production identifier. Entering the model instead of the serial is one of the most common reasons a lookup fails.',
      },
    ],
    seoBody: buildLandingSeoBody(decoderConfigs),
  },
  ...decoderConfigs.map((config) => ({
    routeDir: config.routeDir,
    routePath: `/new/${config.routeDir}/`,
    title: config.title,
    description: config.description,
    ogDescription: config.ogDescription,
    pageName: config.pageTitle,
    brandName: config.brandName,
    faqJson: config.faqItems.map((item) => ({
      question: item.question,
      answer: item.answerPlain,
    })),
    seoBody: config.seoBody,
  })),
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
