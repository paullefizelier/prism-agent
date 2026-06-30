/**
 * Prism Surf Advisor — embeddable widget loader.
 *
 * Drop this on any WooCommerce page:
 *   <script src="https://prism-agent-ten.vercel.app/loader.js" defer></script>
 *
 * Adds a vertical "tab" pinned to the right edge that opens the advisor in an
 * iframe, detecting the current page context (product / category / language) so
 * the chat opens aware of what the visitor is browsing. A toolbar in the panel
 * links to the full web app. Everything lives in a Shadow DOM so the host
 * theme's CSS can't interfere (and vice versa).
 */
(function () {
  if (window.__prismChatLoaded) return;
  window.__prismChatLoaded = true;

  // Origin = where this script is served from (the chat app). Override with
  // data-origin on the <script> tag if needed.
  var script = document.currentScript;
  var origin = (script && script.getAttribute('data-origin')) || '';
  if (!origin && script && script.src) {
    try {
      origin = new URL(script.src).origin;
    } catch (e) {
      /* ignore */
    }
  }
  // Fallback only — origin is normally auto-derived from this script's src above.
  // Update when the app moves to its final domain (e.g. chat.prism-surfboards.com).
  if (!origin) origin = 'https://prism-agent-ten.vercel.app';

  // --- Detect page context from WooCommerce/WordPress markup --------------
  function detectContext() {
    var ctx = {};
    var classes = document.body
      ? Array.prototype.slice.call(document.body.classList)
      : [];
    var has = function (c) { return classes.indexOf(c) !== -1; };

    if (has('single-product')) {
      ctx.ctxType = 'product';
      var postid = classes.find(function (c) { return /^postid-\d+$/.test(c); });
      if (postid) ctx.productId = postid.replace('postid-', '');
      var titleEl = document.querySelector('.product_title, h1.entry-title, h1.product-title');
      ctx.productName = (titleEl ? titleEl.textContent : document.title).trim();
    } else if (has('tax-product_cat') || has('post-type-archive-product')) {
      ctx.ctxType = 'category';
      var term = classes.find(function (c) { return c.indexOf('term-') === 0; });
      if (term) ctx.categorySlug = term.replace('term-', '');
      var catEl = document.querySelector('.woocommerce-products-header__title, h1.page-title, h1.entry-title, h1');
      if (catEl) ctx.categoryName = catEl.textContent.trim();
    }

    // Language (Weglot): <html lang> or an /en/ path prefix.
    var lang = (document.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase();
    if (!lang && /^\/en(\/|$)/.test(location.pathname)) lang = 'en';
    if (lang === 'fr' || lang === 'en') ctx.lang = lang;

    return ctx;
  }

  var ctx = detectContext();
  var lang = ctx.lang || 'fr';
  var L = ({
    fr: { launch: 'Conseiller', open: 'Ouvrir le conseiller Prism', close: 'Fermer', full: 'Ouvrir l’application complète', expand: 'Agrandir', collapse: 'Réduire' },
    en: { launch: 'Advisor', open: 'Open the Prism advisor', close: 'Close', full: 'Open the full app', expand: 'Enlarge', collapse: 'Shrink' }
  })[lang];

  function iframeUrl() {
    var params = new URLSearchParams(ctx);
    return origin + '/embed' + (params.toString() ? '?' + params.toString() : '');
  }

  // --- Build the widget (Shadow DOM) --------------------------------------
  var host = document.createElement('div');
  host.id = 'prism-chat-widget';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML = [
    '<style>',
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    // Right-edge vertical tab, vertically centered
    '.launcher{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483000;',
    'background:#00a9eb;color:#fff;border:none;cursor:pointer;border-radius:12px 0 0 12px;',
    'padding:14px 7px;display:flex;flex-direction:column;align-items:center;gap:8px;',
    'box-shadow:-4px 0 16px rgba(0,0,0,.2);transition:padding-right .15s ease,background .15s ease}',
    '.launcher:hover{padding-right:11px;background:#0079a8}',
    '.launcher svg{width:22px;height:22px}',
    '.launcher .label{writing-mode:vertical-rl;text-orientation:mixed;font-size:13px;font-weight:600;letter-spacing:.02em}',
    '.launcher .ico-close{display:none}',
    '.launcher.open .label{display:none}',
    '.launcher.open .ico-open{display:none}',
    '.launcher.open .ico-close{display:block}',
    // Panel: bottom-right floating, with a toolbar above the iframe
    '.panel{position:fixed;bottom:20px;right:20px;z-index:2147483000;width:400px;height:640px;',
    'max-height:calc(100vh - 40px);border-radius:16px;overflow:hidden;background:#fff;',
    'box-shadow:0 12px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;',
    'opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .18s ease,transform .18s ease}',
    '.panel.open{opacity:1;transform:none;pointer-events:auto}',
    // Enlarged in-place (toggled from the toolbar)
    '.panel.max{width:min(960px,calc(100vw - 40px));height:calc(100vh - 40px)}',
    '.maximize .ico-collapse{display:none}',
    '.panel.max .maximize .ico-expand{display:none}',
    '.panel.max .maximize .ico-collapse{display:block}',
    '.bar{display:flex;align-items:center;justify-content:flex-end;gap:2px;height:38px;',
    'padding:0 6px;border-bottom:1px solid #e5e7eb;background:#fff;flex:none}',
    '.bar a,.bar button{display:flex;align-items:center;justify-content:center;width:30px;height:30px;',
    'border:none;background:none;color:#475569;cursor:pointer;border-radius:8px;text-decoration:none}',
    '.bar a:hover,.bar button:hover{background:#f1f5f9;color:#0f172a}',
    '.bar svg{width:17px;height:17px}',
    '.frame{flex:1;min-height:0;display:flex}',
    '.frame iframe{width:100%;height:100%;border:none;display:block}',
    '@media (max-width:480px){',
    '.panel{right:10px;left:10px;width:auto;bottom:10px;top:10px;height:auto;max-height:none}}',
    '</style>',
    '<button class="launcher" aria-label="' + L.open + '" aria-expanded="false">',
    '<span class="ico-open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>',
    '<span class="ico-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span>',
    '<span class="label">' + L.launch + '</span>',
    '</button>',
    '<div class="panel" role="dialog" aria-label="Prism Surf Advisor">',
    '<div class="bar">',
    '<button class="maximize" title="' + L.expand + '" aria-label="' + L.expand + '">',
    '<span class="ico-expand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg></span>',
    '<span class="ico-collapse"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/></svg></span>',
    '</button>',
    '<a class="full" href="' + origin + '/" target="_blank" rel="noopener" title="' + L.full + '" aria-label="' + L.full + '">',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></a>',
    '<button class="close" title="' + L.close + '" aria-label="' + L.close + '">',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>',
    '</div>',
    '<div class="frame"></div>',
    '</div>'
  ].join('');

  var launcher = root.querySelector('.launcher');
  var panel = root.querySelector('.panel');
  var frame = root.querySelector('.frame');
  var loaded = false;
  var open = false;

  function setOpen(next) {
    open = next;
    if (open && !loaded) {
      // Lazy-load the iframe on first open (with the page context baked in).
      var iframe = document.createElement('iframe');
      iframe.src = iframeUrl();
      iframe.setAttribute('title', 'Prism Surf Advisor');
      iframe.setAttribute('allow', 'clipboard-write');
      frame.appendChild(iframe);
      loaded = true;
    }
    panel.classList.toggle('open', open);
    launcher.classList.toggle('open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? L.close : L.open);
  }

  launcher.addEventListener('click', function () { setOpen(!open); });
  root.querySelector('.bar .close').addEventListener('click', function () { setOpen(false); });

  // Enlarge / shrink the panel in place (no new tab).
  var maximize = root.querySelector('.bar .maximize');
  maximize.addEventListener('click', function () {
    var max = panel.classList.toggle('max');
    maximize.setAttribute('title', max ? L.collapse : L.expand);
    maximize.setAttribute('aria-label', max ? L.collapse : L.expand);
  });

  // Allow the chat (inside the iframe) to request closing.
  window.addEventListener('message', function (e) {
    if (e.origin === origin && e.data && e.data.type === 'prism-chat-close') setOpen(false);
  });
})();
