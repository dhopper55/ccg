import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const newRoot = path.join(repoRoot, 'new');
const sourceHtml = path.join(newRoot, 'index.html');
const decoderConfigsPath = path.join(repoRoot, 'new-app', 'src', 'pages', 'decoders', 'decoder-configs.json');
const decoderConfigs = JSON.parse(fs.readFileSync(decoderConfigsPath, 'utf8'));
const routeConfigs = decoderConfigs.map((config) => ({
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
}));

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
