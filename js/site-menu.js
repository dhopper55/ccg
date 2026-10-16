/*
 * Shared phone menu for the static site pages.
 *
 * Each page has its own desktop header (the first <nav> on the page) whose link list is hidden
 * on small screens, which left phones with no navigation at all. This script adds a menu button
 * to that nav and shows it only while the page's own link list is hidden, so it follows each
 * page's breakpoint and never doubles up with the desktop links. The menu groups match the
 * shop app's site menu (shop-app/src/routes/sitemap.ts) — keep the two in step.
 *
 * Include on a page with: <script src="/js/site-menu.js" defer></script>
 */
(function () {
  var SITE = 'https://www.coalcreekguitars.com';
  var GROUPS = [
    { title: 'Shop', links: [
      ['Guitars & Gear for Sale', '/guitars-and-gear-for-sale/'],
      ['Financing', '/musical-gear-financing/'],
    ] },
    { title: 'Sell or Consign', links: [
      ['We Buy Used Gear', '/we-buy-music-gear-denver-englewood/'],
      ['Consignment', '/denver-area-music-gear-consignment/'],
    ] },
    { title: 'Services', links: [
      ['Repair Services & Pricing', '/guitar-repair-services-pricing/'],
      ["What's My Guitar Worth?", '/guitar-value-report-evaluation/'],
      ['Guitar Authenticity Report', '/guitar-authenticity-report/'],
      ['Serial Number Decoders', '/decoders/guitar-serial-decoder-lookup/'],
    ] },
    { title: 'Coal Creek Guitars', links: [
      ['Home', '/'],
      ['About Us', '/about-us'],
      ['Our Neighborhood', '/ccg-englewood-broadway-gothic-theatre-history'],
      ['FAQ', '/faq/'],
      ['Contact Us', '/contact-us'],
    ] },
  ];

  var CSS = [
    '.ccgm-btn{display:none;position:absolute;right:12px;top:50%;transform:translateY(-50%);width:44px;height:44px;',
    'align-items:center;justify-content:center;border:1px solid rgba(212,168,32,.45);border-radius:8px;',
    'background:rgba(20,20,20,.6);color:#f2ead8;cursor:pointer;padding:0;z-index:5}',
    '.ccgm-btn.ccgm-show{display:inline-flex}',
    '.ccgm-btn svg{width:22px;height:22px}',
    '.ccgm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .2s;z-index:9998}',
    '.ccgm-panel{position:fixed;top:0;right:0;bottom:0;width:min(86vw,360px);background:#141414;color:#f2ead8;',
    'transform:translateX(100%);visibility:hidden;transition:transform .25s ease,visibility 0s linear .25s;z-index:9999;overflow-y:auto;overscroll-behavior:contain;',
    'padding:16px 20px 32px;box-sizing:border-box;font-family:inherit;border-left:1px solid #2a2a2a}',
    '.ccgm-open .ccgm-overlay{opacity:1;pointer-events:auto}',
    '.ccgm-open .ccgm-panel{transform:none;visibility:visible;transition:transform .25s ease}',
    '.ccgm-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
    '.ccgm-head img{width:72px;height:auto;display:block}',
    '.ccgm-close{width:44px;height:44px;border:0;background:transparent;color:#f2ead8;font-size:26px;line-height:1;cursor:pointer}',
    '.ccgm-group{margin-top:18px}',
    '.ccgm-group h2{margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a08a4a}',
    '.ccgm-group a{display:block;padding:11px 0;color:#f2ead8;text-decoration:none;font-size:16px;border-bottom:1px solid #222}',
    '.ccgm-group a[aria-current=page]{color:#d4a820}',
    '.ccgm-cta{display:flex;gap:10px;margin-top:22px}',
    '.ccgm-cta a{flex:1;text-align:center;padding:12px 8px;border-radius:6px;font-size:14px;font-weight:700;text-decoration:none;',
    'letter-spacing:.04em;border:1px solid #8B6914;color:#d4a820}',
    '.ccgm-cta a.ccgm-primary{background:#8B6914;color:#141414;border-color:#8B6914}',
    '@media (prefers-reduced-motion:reduce){.ccgm-panel,.ccgm-overlay{transition:none}}',
  ].join('');

  function normalize(path) {
    return path.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  }

  function init() {
    var nav = document.querySelector('body > nav, nav.site-nav, body nav');
    if (!nav || document.querySelector('.ccgm-btn')) return;
    var desktopLinks = nav.querySelector('.nav-links, ul');

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ccgm-btn';
    button.setAttribute('aria-label', 'Open site menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'ccgm-panel');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>';
    nav.appendChild(button);

    var here = normalize(location.pathname);
    var root = document.createElement('div');
    var html = '<div class="ccgm-overlay"></div>' +
      '<div class="ccgm-panel" id="ccgm-panel" role="dialog" aria-modal="true" aria-label="Site menu">' +
      '<div class="ccgm-head"><a href="' + SITE + '/"><img src="/images/coal-creek-logo-480.webp" alt="Coal Creek Guitars" width="72" height="48"></a>' +
      '<button type="button" class="ccgm-close" aria-label="Close menu">&times;</button></div>';
    GROUPS.forEach(function (group) {
      html += '<div class="ccgm-group"><h2>' + group.title + '</h2>';
      group.links.forEach(function (link) {
        var current = normalize(link[1]) === here ? ' aria-current="page"' : '';
        html += '<a href="' + SITE + link[1] + '"' + current + '>' + link[0].replace(/&/g, '&amp;') + '</a>';
      });
      html += '</div>';
    });
    html += '<div class="ccgm-cta"><a class="ccgm-primary" href="' + SITE + '/guitars-and-gear-for-sale/">Shop Inventory</a>' +
      '<a href="' + SITE + '/contact-us">Contact</a></div></div>';
    root.innerHTML = html;
    document.body.appendChild(root);

    var panel = root.querySelector('.ccgm-panel');
    var closeBtn = root.querySelector('.ccgm-close');
    var savedOverflow = '';

    function open() {
      root.classList.add('ccgm-open');
      button.setAttribute('aria-expanded', 'true');
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function close() {
      if (!root.classList.contains('ccgm-open')) return;
      root.classList.remove('ccgm-open');
      button.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = savedOverflow;
      button.focus();
    }
    button.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    root.querySelector('.ccgm-overlay').addEventListener('click', close);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) close();
    });

    // Show the button only while the page's own desktop links are hidden.
    function sync() {
      var hidden = !desktopLinks || desktopLinks.offsetParent === null || getComputedStyle(desktopLinks).display === 'none';
      button.classList.toggle('ccgm-show', hidden);
      if (!hidden) close();
    }
    sync();
    window.addEventListener('resize', sync);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
