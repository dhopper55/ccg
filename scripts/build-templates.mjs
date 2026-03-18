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
// This allows the template name to differ from the output file
const OUTPUT_MAP = {
  'gibson.njk': 'gibson-guitar-serial-number-decoder-test.html',
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
