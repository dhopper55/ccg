import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { getGaPageLocation } from 'lib/googleAnalytics';

const GA_MEASUREMENT_ID = 'G-CZRGM23PJ9';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GoogleAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.gtag !== 'function') return;

    const pageLocation = getGaPageLocation();
    const pageUrl = new URL(pageLocation);
    // Every later event on this route (decodes, clicks, scrolls) reports this URL too.
    window.gtag('set', { page_location: pageLocation });
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: pageLocation,
      page_path: `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
};

export default GoogleAnalytics;
