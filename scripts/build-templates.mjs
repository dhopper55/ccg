import nunjucks from 'nunjucks';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const DECODERS_SRC = path.join(TEMPLATES_DIR, 'decoders');
const DECODERS_OUT = path.join(ROOT, 'decoders');

// Configure nunjucks with the templates directory as root
const env = nunjucks.configure(TEMPLATES_DIR, {
  autoescape: false, // HTML content in variables should render as-is
  trimBlocks: true,
  lstripBlocks: true,
});

// Map of template filename → output filename
// Brand key → full decoder page filename
const OUTPUT_MAP = {
  'alvarez.njk': 'alvarez-guitar-serial-number-decoder.html',
  'bc-rich.njk': 'bc-rich-guitar-serial-number-decoder.html',
  'charvel.njk': 'charvel-guitar-serial-number-decoder.html',
  'cort.njk': 'cort-guitar-serial-number-decoder.html',
  'dean.njk': 'dean-guitar-serial-number-decoder.html',
  'epiphone.njk': 'epiphone-guitar-serial-number-decoder.html',
  'ernieball.njk': 'ernieball-guitar-serial-number-decoder.html',
  'esp.njk': 'esp-guitar-serial-number-decoder.html',
  'fender.njk': 'fender-guitar-serial-number-decoder.html',
  'gibson.njk': 'gibson-guitar-serial-number-decoder.html',
  'godin.njk': 'godin-guitar-serial-number-decoder.html',
  'gretsch.njk': 'gretsch-guitar-serial-number-decoder.html',
  'guild.njk': 'guild-guitar-serial-number-decoder.html',
  'ibanez.njk': 'ibanez-guitar-serial-number-decoder.html',
  'jackson.njk': 'jackson-guitar-serial-number-decoder.html',
  'kramer.njk': 'kramer-guitar-serial-number-decoder.html',
  'martin.njk': 'martin-guitar-serial-number-decoder.html',
  'ovation.njk': 'ovation-guitar-serial-number-decoder.html',
  'prs.njk': 'prs-guitar-serial-number-decoder.html',
  'rickenbacker.njk': 'rickenbacker-guitar-serial-number-decoder.html',
  'schecter.njk': 'schecter-guitar-serial-number-decoder.html',
  'squier.njk': 'squier-guitar-serial-number-decoder.html',
  'takamine.njk': 'takamine-guitar-serial-number-decoder.html',
  'taylor.njk': 'taylor-guitar-serial-number-decoder.html',
  'washburn.njk': 'washburn-guitar-serial-number-decoder.html',
  'yamaha.njk': 'yamaha-guitar-serial-number-decoder.html',
};

const templates = fs.readdirSync(DECODERS_SRC).filter((f) => f.endsWith('.njk'));

let count = 0;
for (const template of templates) {
  const outputName = OUTPUT_MAP[template] || template.replace('.njk', '.html');
  const outputPath = path.join(DECODERS_OUT, outputName);
  const templatePath = path.join('decoders', template);

  const html = env.render(templatePath);
  fs.writeFileSync(outputPath, html, 'utf8');
  count++;
  console.log(`  ${template} → decoders/${outputName}`);
}

console.log(`\nTemplates compiled: ${count} file(s).`);
