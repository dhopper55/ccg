import type { MouseEvent } from 'react';
import { ReportCtaPlacement, trackReportCtaClick } from 'lib/googleAnalytics';

// Decoder → report page handoff. The serial travels through localStorage rather than the URL
// so it never lands in analytics, logs or shared links; the report pages read it back.
const HANDOFF_STORAGE_KEY = 'ccg-decoder-handoff';

export const VALUE_REPORT_PRICE = '$19.99';
export const AUTHENTICITY_REPORT_PRICE = '$12';

export const saveDecoderHandoff = (brand: string, serial: string) => {
  try {
    window.localStorage.setItem(
      HANDOFF_STORAGE_KEY,
      JSON.stringify({ brand, serial: serial.trim(), savedAt: Date.now() }),
    );
  } catch {
    // The report form just won't be pre-filled.
  }
};

interface ReportHrefOptions {
  brand: string;
  year?: string;
  decodeId?: number | null;
}

export const buildReportHref = (report: 'value' | 'authenticity', { brand, year, decodeId }: ReportHrefOptions) => {
  const params = new URLSearchParams({ brand });
  if (year && /^\d{4}$/.test(year.trim())) params.set('year', year.trim());
  if (decodeId != null) params.set('decodeId', String(decodeId));
  params.set('src', 'decoder');
  const path = report === 'value' ? '/guitar-value-report-evaluation/' : '/guitar-authenticity-report/';
  return `${path}?${params.toString()}`;
};

// Click handler for config HTML (FAQ answers, report mention) whose report links are
// marked <a data-report="value|authenticity">.
export const trackReportLinkClick = (event: MouseEvent<HTMLElement>, brand: string, placement: ReportCtaPlacement) => {
  const report = (event.target as HTMLElement).closest('a[data-report]')?.getAttribute('data-report');
  if (report === 'value' || report === 'authenticity') trackReportCtaClick(report, brand, placement);
};
