type GaParams = Record<string, string | number | boolean | undefined>;

// Query params that must never reach GA: decoder links carry the serial number.
const PRIVATE_QUERY_PARAMS = ['serial'];

export const getGaPageLocation = () => {
  const pageUrl = new URL(window.location.href);
  PRIVATE_QUERY_PARAMS.forEach((key) => pageUrl.searchParams.delete(key));
  return pageUrl.href;
};

export const trackGaEvent = (name: string, params: GaParams = {}) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  // Beacon transport so clicks that open or leave the page still send.
  window.gtag('event', name, { ...params, transport_type: 'beacon' });
};

export type SerialDecodeResult = 'success' | 'no_match' | 'error';

export const trackSerialDecode = (brand: string, result: SerialDecodeResult) =>
  trackGaEvent('serial_decode', { brand, result });

export type ReportCtaPlacement = 'decode_result' | 'decoder_static' | 'report_page' | 'guide';

export const trackReportCtaClick = (
  report: 'value' | 'authenticity',
  brand: string,
  placement: ReportCtaPlacement,
) => trackGaEvent('report_cta_click', { report, brand, placement });
