import puppeteer from '@cloudflare/puppeteer';
import type { Env } from '../env.js';

export async function generateGuitarEvalReportPdf(reportUrl: string, env: Env): Promise<Uint8Array> {
  if (!env.BROWSER) {
    throw new Error('Browser Rendering binding (BROWSER) is not configured.');
  }
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      printBackground: true,
      format: 'Letter',
      margin: { top: '0.4in', bottom: '0.5in', left: '0.4in', right: '0.4in' },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
