import { useEffect } from 'react';
import { useLocation } from 'react-router';

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

    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
};

export default GoogleAnalytics;
