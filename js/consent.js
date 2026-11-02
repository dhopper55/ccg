// Cookie consent banner for visitors in the EEA, UK and Switzerland.
//
// The Google consent defaults are set inline in each page's Google tag snippet, before any
// tag config runs: denied in these regions until a choice is made, and a stored choice
// applies straight away on later visits. This file only asks the question, stores the
// answer and passes it to Google tags. Visitors elsewhere never see the banner.
(function () {
  var STORAGE_KEY = 'ccg-consent';
  var CONSENT_REGIONS = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    'IS', 'LI', 'NO', 'GB', 'CH',
  ];
  var bannerEl = null;

  function storedChoice() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function applyConsent(choice) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: choice,
        ad_user_data: choice,
        ad_personalization: choice,
        analytics_storage: choice,
      });
    }
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch (e) {
      // The choice still applies to this page view.
    }
    applyConsent(choice);
    closeBanner();
  }

  function closeBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
  }

  function addStyles() {
    if (document.getElementById('ccg-consent-style')) return;
    var style = document.createElement('style');
    style.id = 'ccg-consent-style';
    style.textContent = [
      '.ccg-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin:0 auto;',
      'display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding:14px 16px;border-radius:10px;',
      'background:#18150f;color:#e9e1cf;border:1px solid rgba(201,162,39,.55);box-shadow:0 8px 28px rgba(0,0,0,.45);',
      'font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}',
      '.ccg-consent p{margin:0;flex:1 1 280px}',
      '.ccg-consent a{color:#d9b84a;text-decoration:underline}',
      '.ccg-consent-actions{display:flex;gap:8px;flex:0 0 auto}',
      '.ccg-consent button{font:inherit;font-weight:600;padding:8px 18px;border-radius:6px;cursor:pointer;',
      'border:1px solid #c9a227;min-width:96px}',
      '.ccg-consent-accept{background:#c9a227;color:#18150f}',
      '.ccg-consent-decline{background:transparent;color:#e9e1cf}',
      '.ccg-consent button:focus-visible{outline:2px solid #f2dc8a;outline-offset:2px}',
      '@media (max-width:480px){.ccg-consent-actions{flex:1 1 100%}.ccg-consent button{flex:1}}',
    ].join('');
    document.head.appendChild(style);
  }

  function openBanner() {
    if (bannerEl) return;
    addStyles();
    bannerEl = document.createElement('div');
    bannerEl.className = 'ccg-consent';
    bannerEl.setAttribute('role', 'region');
    bannerEl.setAttribute('aria-label', 'Cookie choices');
    bannerEl.innerHTML =
      '<p>We use cookies to measure how this site is used and to improve our ads. ' +
      'The decoders and reports work either way. ' +
      '<a href="https://www.coalcreekguitars.com/privacy-policy">Privacy policy</a></p>' +
      '<div class="ccg-consent-actions">' +
      '<button type="button" class="ccg-consent-decline">Decline</button>' +
      '<button type="button" class="ccg-consent-accept">Accept</button>' +
      '</div>';
    bannerEl.querySelector('.ccg-consent-accept').addEventListener('click', function () { saveChoice('granted'); });
    bannerEl.querySelector('.ccg-consent-decline').addEventListener('click', function () { saveChoice('denied'); });
    document.body.appendChild(bannerEl);
  }

  // The privacy policy's "Cookie settings" button reopens the banner for anyone.
  window.ccgOpenConsentSettings = openBanner;

  function inEuropeanTimeZone() {
    try {
      return /^(Europe|Atlantic\/(Reykjavik|Canary|Madeira|Faroe|Azores))\//.test(
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      );
    } catch (e) {
      return false;
    }
  }

  if (storedChoice() === 'granted' || storedChoice() === 'denied') return;

  // Cloudflare reports the visitor's country at /cdn-cgi/trace; fall back to the time zone.
  fetch('/cdn-cgi/trace')
    .then(function (response) { return response.ok ? response.text() : ''; })
    .then(function (text) {
      var match = /^loc=([A-Z]{2})$/m.exec(text);
      return match ? CONSENT_REGIONS.indexOf(match[1]) >= 0 : inEuropeanTimeZone();
    })
    .catch(inEuropeanTimeZone)
    .then(function (needsConsent) {
      if (!needsConsent) return;
      // Google's own region default normally already denies here; this covers visitors whose
      // location Cloudflare and Google read differently.
      applyConsent('denied');
      openBanner();
    });
})();
