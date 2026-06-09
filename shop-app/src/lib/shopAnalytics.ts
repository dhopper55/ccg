type ShopAnalyticsEvent = {
  eventType: 'product_view' | 'search' | 'add_to_cart' | 'checkout_start' | 'value_report_initiate';
  inventoryItemId?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

const analyticsSessionKey = 'ccg-shop-analytics-session';
const associateModeStorageKey = 'ccgAssociateMode';

const getAnalyticsSessionId = () => {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(analyticsSessionKey);
    if (existing) return existing;
    const generated = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(analyticsSessionKey, generated);
    return generated;
  } catch {
    return '';
  }
};

export const trackShopAnalyticsEvent = (event: ShopAnalyticsEvent) => {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(associateModeStorageKey) === '1') return;
  } catch {
    // Server-side analytics filtering still applies if local storage is unavailable.
  }

  const payload = JSON.stringify({
    ...event,
    sessionId: getAnalyticsSessionId(),
    pagePath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    referrer: document.referrer || '',
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/shop/analytics/event', blob)) return;
    }
  } catch {
    // Fall back to fetch below.
  }

  void fetch('/api/shop/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
};
