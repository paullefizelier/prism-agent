/**
 * Prism Surf Advisor — embeddable widget loader.
 *
 * Drop this on any WooCommerce page:
 *   <script src="https://chat.prism-surfboards.com/loader.js" defer></script>
 *
 * It adds a floating button that opens the advisor in an iframe, and detects the
 * current page context (product / category / language) so the chat opens aware
 * of what the visitor is browsing. Everything lives in a Shadow DOM so the host
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
    var cls = document.body ? document.body.classList : { contains: function () { return false; } };
    var classes = document.body ? Array.prototype.slice.call(document.body.classList) : [];

    if (cls.contains('single-product')) {
      ctx.ctxType = 'product';
      var postid = classes.find(function (c) { return /^postid-\d+$/.test(c); });
      if (postid) ctx.productId = postid.replace('postid-', '');
      var titleEl = document.querySelector('.product_title, h1.entry-title, h1.product-title');
      ctx.productName = (titleEl ? titleEl.textContent : document.title).trim();
    } else if (cls.contains('tax-product_cat') || cls.contains('post-type-archive-product')) {
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

  function iframeUrl() {
    var params = new URLSearchParams(detectContext());
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
    '.launcher{position:fixed;bottom:20px;right:20px;z-index:2147483000;width:60px;height:60px;border-radius:9999px;',
    'border:none;cursor:pointer;background:#16a34a;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);',
    'display:flex;align-items:center;justify-content:center;transition:transform .15s ease}',
    '.launcher:hover{transform:scale(1.06)}',
    '.launcher svg{width:28px;height:28px}',
    '.panel{position:fixed;bottom:92px;right:20px;z-index:2147483000;width:400px;height:640px;max-height:calc(100vh - 112px);',
    'border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.3);',
    'opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .18s ease,transform .18s ease}',
    '.panel.open{opacity:1;transform:none;pointer-events:auto}',
    '.panel iframe{width:100%;height:100%;border:none;display:block}',
    '@media (max-width:480px){',
    '.panel{right:12px;left:12px;width:auto;bottom:88px;height:auto;top:12px;max-height:none}',
    '.launcher{bottom:16px;right:16px}}',
    '</style>',
    '<button class="launcher" aria-label="Ouvrir le conseiller Prism" aria-expanded="false">',
    '<span class="ico-open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>',
    '<span class="ico-close" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span>',
    '</button>',
    '<div class="panel" role="dialog" aria-label="Prism Surf Advisor"></div>'
  ].join('');

  var launcher = root.querySelector('.launcher');
  var panel = root.querySelector('.panel');
  var iconOpen = root.querySelector('.ico-open');
  var iconClose = root.querySelector('.ico-close');
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
      panel.appendChild(iframe);
      loaded = true;
    }
    panel.classList.toggle('open', open);
    launcher.setAttribute('aria-expanded', String(open));
    iconOpen.style.display = open ? 'none' : '';
    iconClose.style.display = open ? '' : 'none';
  }

  launcher.addEventListener('click', function () { setOpen(!open); });

  // Allow the chat (inside the iframe) to request closing.
  window.addEventListener('message', function (e) {
    if (e.origin === origin && e.data && e.data.type === 'prism-chat-close') setOpen(false);
  });
})();
