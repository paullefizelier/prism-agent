/**
 * Prism Surf Advisor — embeddable widget loader.
 *
 * Drop this on any WooCommerce page:
 *   <script src="https://chat.prism-surfboards.com/loader.js" defer></script>
 *
 * IMPORTANT (LiteSpeed / optimiseurs JS): do NOT enqueue this via
 * wp_enqueue_script — LiteSpeed "JS Combine" merges/drops the external tag for
 * guests (it survives cache purges and ?cb= busters), so the widget shows for
 * logged-in users but vanishes for anonymous visitors. Output it raw in
 * wp_footer with no-optimize markers instead:
 *   add_action('wp_footer', function () {
 *     echo '<script src="https://chat.prism-surfboards.com/loader.js" defer '
 *        . 'data-no-optimize="1" data-no-defer="1" data-no-minify="1" '
 *        . 'data-cfasync="false"></script>';
 *   }, 99);
 *
 * Adds a vertical "tab" pinned to the right edge that opens the advisor in an
 * iframe, detecting the current page context (product / category / language) so
 * the chat opens aware of what the visitor is browsing. Everything lives in a
 * Shadow DOM so the host theme's CSS can't interfere (and vice versa).
 *
 * Because this script runs first-party on the shop, it also acts as a bridge:
 * the iframe asks it (via postMessage) to add a product to the real WooCommerce
 * cart over AJAX, so the visitor never leaves the conversation.
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
  if (!origin) origin = 'https://chat.prism-surfboards.com';

  // Per-tab UI state (open / enlarged / nudge dismissed) so the widget survives
  // navigation between shop pages within the same browsing session.
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  var SS_OPEN = 'prism-chat-open';
  var SS_MAX = 'prism-chat-max';
  var SS_NUDGE = 'prism-chat-nudge-dismissed';

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
    fr: {
      launch: 'Conseiller', open: 'Ouvrir le conseiller Prism', close: 'Fermer',
      full: 'Ouvrir l’application complète', expand: 'Agrandir', collapse: 'Réduire',
      nudgeProduct: 'Une question sur cette planche ? 🤙',
      nudgeCategory: 'Besoin d’aide pour choisir ? 🤙',
      nudgeDefault: 'Besoin de conseils ? 🤙'
    },
    en: {
      launch: 'Advisor', open: 'Open the Prism advisor', close: 'Close',
      full: 'Open the full app', expand: 'Enlarge', collapse: 'Shrink',
      nudgeProduct: 'A question about this board? 🤙',
      nudgeCategory: 'Need help choosing? 🤙',
      nudgeDefault: 'Need advice? 🤙'
    }
  })[lang];

  var nudgeText = ctx.ctxType === 'product'
    ? L.nudgeProduct
    : ctx.ctxType === 'category'
      ? L.nudgeCategory
      : L.nudgeDefault;

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
    // Proactive nudge bubble, to the left of the tab
    '.nudge{position:fixed;right:54px;top:50%;z-index:2147483000;max-width:230px;',
    'background:#fff;color:#0f172a;border-radius:14px;padding:12px 32px 12px 14px;',
    'font-size:14px;line-height:1.35;box-shadow:0 8px 30px rgba(0,0,0,.18);cursor:pointer;',
    'opacity:0;transform:translateY(-50%) translateX(10px);pointer-events:none;',
    'transition:opacity .22s ease,transform .22s ease}',
    '.nudge.show{opacity:1;transform:translateY(-50%);pointer-events:auto}',
    '.nudge .x{position:absolute;top:3px;right:3px;width:24px;height:24px;border:none;',
    'background:none;color:#94a3b8;cursor:pointer;border-radius:7px;font-size:16px;line-height:1}',
    '.nudge .x:hover{background:#f1f5f9;color:#0f172a}',
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
    '.frame{position:relative;flex:1;min-height:0;display:flex}',
    '.frame iframe{width:100%;height:100%;border:none;display:block}',
    '.loader{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#fff}',
    '.loader .spin{width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#00a9eb;',
    'border-radius:50%;animation:prism-spin .8s linear infinite}',
    '@keyframes prism-spin{to{transform:rotate(360deg)}}',
    '@media (max-width:480px){',
    '.panel{right:10px;left:10px;width:auto;bottom:10px;top:10px;height:auto;max-height:none}',
    '.nudge{display:none}}',
    '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}',
    '</style>',
    '<button class="launcher" aria-label="' + L.open + '" aria-expanded="false">',
    '<span class="ico-open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>',
    '<span class="ico-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span>',
    '<span class="label">' + L.launch + '</span>',
    '</button>',
    '<div class="nudge" role="button" tabindex="0" aria-label="' + L.open + '">',
    '<button class="x" aria-label="' + L.close + '">&times;</button>',
    '<span class="nudge-text">' + nudgeText + '</span>',
    '</div>',
    '<div class="panel" role="dialog" aria-modal="true" aria-label="Prism Surf Advisor">',
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
  var maximize = root.querySelector('.bar .maximize');
  var nudge = root.querySelector('.nudge');
  var iframe = null;
  var loaded = false;
  var open = false;

  // Create the iframe (once) with a loading spinner. Called on first open, or
  // ahead of time during idle so the first open is instant.
  function ensureIframe() {
    if (loaded) return;
    loaded = true;
    var spinner = document.createElement('div');
    spinner.className = 'loader';
    spinner.innerHTML = '<div class="spin"></div>';
    frame.appendChild(spinner);
    iframe = document.createElement('iframe');
    iframe.src = iframeUrl();
    iframe.setAttribute('title', 'Prism Surf Advisor');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.addEventListener('load', function () { spinner.remove(); });
    frame.appendChild(iframe);
  }

  function setOpen(next, skipPersist) {
    open = next;
    if (open) ensureIframe();
    panel.classList.toggle('open', open);
    launcher.classList.toggle('open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? L.close : L.open);
    if (open) hideNudge();
    if (!skipPersist) ssSet(SS_OPEN, open ? '1' : '0');
    if (open) {
      try { root.querySelector('.bar .close').focus(); } catch (e) { /* ignore */ }
    }
  }

  function setMax(next, skipPersist) {
    panel.classList.toggle('max', next);
    maximize.setAttribute('title', next ? L.collapse : L.expand);
    maximize.setAttribute('aria-label', next ? L.collapse : L.expand);
    if (!skipPersist) ssSet(SS_MAX, next ? '1' : '0');
  }

  function hideNudge() {
    if (nudge) nudge.classList.remove('show');
  }
  function dismissNudge() {
    hideNudge();
    ssSet(SS_NUDGE, '1');
  }
  // Show the contextual bubble once per session, only on product/category pages,
  // and only if the visitor hasn't already opened or dismissed it.
  function maybeShowNudge() {
    if (!nudge || open) return;
    if (ssGet(SS_NUDGE) === '1') return;
    if (ctx.ctxType !== 'product' && ctx.ctxType !== 'category') return;
    nudge.classList.add('show');
  }

  // --- Cart bridge: add to the real WooCommerce cart over AJAX -------------
  function postToIframe(msg) {
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(msg, origin);
  }
  function ajaxAddToCart(productId, productUrl) {
    var body = new URLSearchParams();
    body.set('product_id', String(productId));
    body.set('quantity', '1');
    fetch('/?wc-ajax=add_to_cart', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      credentials: 'same-origin'
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // Variable product (needs a size) or any error: fall back to the product
        // page so the visitor can pick options.
        if (!data || data.error) {
          postToIframe({ type: 'prism-add-to-cart-result', ok: false, productId: productId });
          var url = productUrl || (data && data.product_url);
          if (url) window.location.href = url;
          return;
        }
        // Refresh the theme's mini-cart with the returned fragments…
        if (data.fragments) {
          Object.keys(data.fragments).forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
              var tmp = document.createElement('div');
              tmp.innerHTML = data.fragments[sel];
              if (tmp.firstElementChild) el.replaceWith(tmp.firstElementChild);
            });
          });
        }
        // …and let the theme/plugins react (cart count, side-cart, etc.).
        try {
          if (window.jQuery) {
            window.jQuery(document.body).trigger('added_to_cart', [data.fragments, data.cart_hash]);
          }
        } catch (e) { /* ignore */ }
        postToIframe({ type: 'prism-add-to-cart-result', ok: true, productId: productId });
      })
      .catch(function () {
        postToIframe({ type: 'prism-add-to-cart-result', ok: false, productId: productId });
        if (productUrl) window.location.href = productUrl;
      });
  }

  // --- Wiring --------------------------------------------------------------
  launcher.addEventListener('click', function () { setOpen(!open); });
  root.querySelector('.bar .close').addEventListener('click', function () { setOpen(false); });
  maximize.addEventListener('click', function () { setMax(!panel.classList.contains('max')); });

  nudge.querySelector('.x').addEventListener('click', function (e) {
    e.stopPropagation();
    dismissNudge();
  });
  nudge.addEventListener('click', function () { setOpen(true); });
  nudge.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  // Messages from the chat iframe (same app origin only).
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data) return;
    if (e.data.type === 'prism-chat-close') setOpen(false);
    else if (e.data.type === 'prism-add-to-cart') {
      ajaxAddToCart(e.data.productId, e.data.productUrl);
    }
  });

  // --- Init: restore session state, preload, schedule the nudge ------------
  if (ssGet(SS_MAX) === '1') setMax(true, true);
  if (ssGet(SS_OPEN) === '1') {
    setOpen(true, true);
  } else {
    // Preload the iframe while the browser is idle so the first open is instant,
    // without competing with the host page's own loading.
    var preload = function () { ensureIframe(); };
    if (window.requestIdleCallback) window.requestIdleCallback(preload, { timeout: 4000 });
    else window.setTimeout(preload, 2500);
    window.setTimeout(maybeShowNudge, 8000);
  }
})();
