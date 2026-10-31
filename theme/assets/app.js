/* core.js: the shared front-end engine (window.UI). Same in every app made from APP_MAKER/template;
   app-specific things live in web/app.js (brand, nav, footer) and web/pages/*.html (the pages).

   Pages:   UI.page(name, {title, nav, icon, auth, order, chrome}, mount)
              auth: null (anyone) | 'guest' (signed-out only) | 'user' | 'admin'
              nav: label for the header / phone tab bar (omit to keep it out of the menus)
              mount(view, ctx) draws into `view`; ctx = {args, me, go, api}. Return a Promise (the page
              is "ready" when it resolves) or {ready, destroy}. URLs are #name/arg1/arg2.
   Server:  UI.api(fn, ...args) -> Promise of the server function's return value. A reply of
              {ok: false, error} rejects with that message (shown as a toast unless you .catch it).
            UI.apiQuiet(fn, ...args) is the same without Anvil's loading spinner.
   Auth:    UI.auth('login'|'signup'|'reset'|'logout', {...}) -> Promise of {ok, me, message}
   Helpers: UI.esc, UI.icon, UI.toast, UI.modal, UI.confirm, UI.busy, UI.formData, UI.fmtDate, UI.ago,
            UI.store, UI.setTheme, UI.feedback, UI.go, UI.refresh
   Tests:   window.UI_READY is true when the current page has finished loading. */
(function () {
  'use strict';
  if (window.UI && window.UI.__v) return;
  var UI = window.UI = { __v: 1, pages: {}, me: null, config: { name: 'App', key: 'app', home: 'home', landing: 'landing' } };
  window.UI_READY = false;

  UI.configure = function (cfg) { Object.keys(cfg).forEach(function (k) { UI.config[k] = cfg[k]; }); };

  /* ------------------------------------------------------------------ small helpers */
  UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  UI.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  UI.initials = function (name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  UI.fmtDate = function (iso, opts) {
    if (!iso) return '';
    var d = iso.length <= 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
    return d.toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
  };
  UI.fmtDateTime = function (iso) {
    return iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  };
  UI.ago = function (iso) {
    if (!iso) return '';
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    var steps = [[60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']], n = s / 60;
    for (var i = 0; i < steps.length; i++) {
      if (n < steps[i][0]) { n = Math.floor(n); return UI.plural(n, steps[i][1]) + ' ago'; }
      n = n / steps[i][0];
    }
    return '';
  };
  UI.store = {
    get: function (k, dflt) { try { var v = localStorage.getItem(UI.config.key + '.' + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set: function (k, v) { try { localStorage.setItem(UI.config.key + '.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  UI.formData = function (form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  };
  /* Disable a button while a Promise runs; returns the Promise. */
  UI.busy = function (btn, promise) {
    if (!btn) return promise;
    btn.disabled = true; btn.classList.add('is-busy');
    var done = function () { btn.disabled = false; btn.classList.remove('is-busy'); };
    promise.then(done, done);
    return promise;
  };

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.7c2.2.6 3.5 2.4 3.5 5.3"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8V5M9 5.5 7.5 4M15 5.5 16.5 4M7 13H3M21 13h-4M7.5 18l-3 2M16.5 18l3 2M7.5 9.5l-3-2M16.5 9.5l3-2"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13"/><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
  };
  UI.ICONS = ICONS;
  UI.icon = function (name, cls) {
    return '<svg class="ui-ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.sparkle) + '</svg>';
  };

  /* ------------------------------------------------------------------ toasts, modals */
  UI.toast = function (msg, kind) {
    var box = document.querySelector('.ui-toasts');
    if (!box) { box = document.createElement('div'); box.className = 'ui ui-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'ui-toast' + (kind ? ' ' + kind : '');
    t.innerHTML = (kind === 'error' ? UI.icon('info') : kind === 'ok' ? UI.icon('check') : '') + '<span>' + UI.esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, kind === 'error' ? 6500 : 3200);
  };
  UI.modal = function (html, opts) {
    opts = opts || {};
    var prev = document.activeElement;
    var wrap = document.createElement('div');
    wrap.className = 'ui ui-modal-wrap';
    wrap.innerHTML = '<div class="ui-modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<button class="ui-btn ghost icon ui-modal-x" data-close aria-label="Close">' + UI.icon('x') + '</button>' + html + '</div>';
    document.body.appendChild(wrap);
    document.documentElement.classList.add('ui-modal-open');
    function key(e) { if (e.key === 'Escape') close(); }
    function close() {
      if (!wrap.parentNode) return;
      wrap.remove(); document.removeEventListener('keydown', key);
      if (!document.querySelector('.ui-modal-wrap')) document.documentElement.classList.remove('ui-modal-open');
      if (opts.onclose) opts.onclose();
      if (prev && prev.focus) prev.focus();
    }
    document.addEventListener('keydown', key);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    var first = wrap.querySelector('input, textarea, select');
    setTimeout(function () { (first || wrap.querySelector('.ui-modal')).focus && (first || wrap.querySelector('.ui-modal')).focus(); }, 30);
    return { el: wrap.querySelector('.ui-modal'), close: close };
  };
  UI.confirm = function (o) {
    o = typeof o === 'string' ? { title: o } : (o || {});
    return new Promise(function (resolve) {
      var answered = false;
      var m = UI.modal('<h2>' + UI.esc(o.title || 'Are you sure?') + '</h2>' + (o.text ? '<p class="muted">' + UI.esc(o.text) + '</p>' : '') +
        '<div class="ui-row end" style="margin-top:20px"><button class="ui-btn ghost" data-close>' + UI.esc(o.cancel || 'Cancel') + '</button>' +
        '<button class="ui-btn ' + (o.danger ? 'danger solid' : 'primary') + '" data-ok>' + UI.esc(o.ok || 'OK') + '</button></div>',
      { onclose: function () { if (!answered) resolve(false); } });
      m.el.querySelector('[data-ok]').onclick = function () { answered = true; m.close(); resolve(true); };
    });
  };

  /* ------------------------------------------------------------------ theme */
  UI.theme = function () { return UI.store.get('theme', 'auto'); };
  UI.applyTheme = function (t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('ui-dark', !!dark);
  };
  UI.setTheme = function (t) { UI.store.set('theme', t); UI.applyTheme(t); };
  UI.applyTheme(UI.theme());
  if (window.matchMedia) {
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { UI.applyTheme(UI.theme()); }); } catch (e) {}
  }

  /* ------------------------------------------------------------------ server bridge */
  var bridge = null;
  function send(kind, payload) {
    if (!bridge) return Promise.reject(new Error('The app is still starting.'));
    var out;
    try { out = bridge(kind, JSON.stringify(payload || {})); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(out).then(function (r) {
      r = typeof r === 'string' ? JSON.parse(r) : (r || {});
      if (r.error) {
        var err = new Error(r.error); err.uiApi = true; err.denied = !!r.denied;
        if (r.detail) console.error(kind, payload && payload.fn, r.detail);
        if (r.reload) setTimeout(function () { location.reload(); }, 2500);
        throw err;
      }
      return r.result;
    });
  }
  function apiCall(quiet, fn, args) {
    return send('call', { fn: fn, args: args, quiet: quiet }).then(function (res) {
      if (res && typeof res === 'object' && res.ok === false) {
        var err = new Error(res.error || 'That didn\'t work.'); err.uiApi = true; err.expected = true; err.result = res;
        throw err;
      }
      return res;
    });
  }
  UI.api = function (fn) { return apiCall(false, fn, Array.prototype.slice.call(arguments, 1)); };
  UI.apiQuiet = function (fn) { return apiCall(true, fn, Array.prototype.slice.call(arguments, 1)); };
  /* Errors nobody caught become a toast, so a failed action is never silent. */
  window.addEventListener('unhandledrejection', function (e) {
    if (e.reason && e.reason.uiApi) { e.preventDefault(); UI.toast(e.reason.message, 'error'); }
  });

  /* Sign in / up / out. On success it navigates: to where the visitor was heading (UI.after) or home
     after signing in, to the landing page after signing out. */
  UI.auth = function (kind, payload) {
    return send(kind, payload || {}).then(function (r) {
      if (r && r.ok === false) { var err = new Error(r.error); err.uiApi = true; err.expected = true; throw err; }
      if (r && 'me' in r && (r.me || kind === 'logout')) {
        UI.me = r.me || null;
        var target = r.me ? (UI.after || '#' + UI.config.home) : '#' + UI.config.landing;
        UI.after = null;
        if (location.hash === target) route(); else location.hash = target;
      }
      return r;
    });
  };
  /* Update the signed-in user's details (e.g. a new name) and redraw the header, without reloading the page. */
  UI.setMe = function (me) {
    UI.me = me || null;
    if (shellRoot) renderChrome(current.name);
  };

  /* ------------------------------------------------------------------ pages and routing */
  UI.page = function (name, opts, mount) {
    if (typeof opts === 'function') { mount = opts; opts = {}; }
    opts.name = name; opts.mount = mount;
    UI.pages[name] = opts;
  };
  UI.allowed = function (p) {
    if (!p) return false;
    if (p.auth === 'user') return !!UI.me;
    if (p.auth === 'admin') return !!(UI.me && UI.me.is_admin);
    if (p.auth === 'guest') return !UI.me;
    return true;
  };
  UI.navPages = function () {
    return Object.keys(UI.pages).map(function (k) { return UI.pages[k]; })
      .filter(function (p) { return p.nav && UI.allowed(p) && (!p.when || p.when()); })
      .sort(function (a, b) { return (a.order || 50) - (b.order || 50); });
  };
  UI.parseHash = function () {
    var h = (location.hash || '').replace(/^#!?\/?/, '');
    var parts = h.split('?')[0].split('/').filter(function (x) { return x !== ''; }).map(decodeURIComponent);
    return { name: parts[0] || '', args: parts.slice(1) };
  };
  UI.hashFor = function (name) {
    var args = Array.prototype.slice.call(arguments, 1).filter(function (a) { return a != null && a !== ''; });
    return '#' + [name].concat(args.map(encodeURIComponent)).join('/');
  };
  UI.go = function (name) {
    var h = UI.hashFor.apply(null, arguments);
    if (location.hash === h) route(); else location.hash = h;
  };
  UI.refresh = function () { route(); };
  UI.after = null;  // where to go after signing in

  var shellRoot = null, view = null, current = { name: null, destroy: null }, routeSeq = 0;

  function defaultPage() { return UI.me ? UI.config.home : UI.config.landing; }

  function route() {
    var r = UI.parseHash(), name = r.name || defaultPage(), p = UI.pages[name];
    if (!p) { name = defaultPage(); p = UI.pages[name]; r.args = []; }
    if (p.auth === 'guest' && UI.me) { p = UI.pages[UI.config.home]; name = UI.config.home; r.args = []; }
    if ((p.auth === 'user' || p.auth === 'admin') && !UI.me) {
      UI.after = location.hash && location.hash !== '#' ? location.hash : null;
      p = UI.pages.auth; name = 'auth'; r.args = [];
    }
    if (p.auth === 'admin' && !(UI.me && UI.me.is_admin)) {
      UI.toast('That page is for admins only.', 'error');
      p = UI.pages[UI.config.home]; name = UI.config.home; r.args = [];
    }
    var seq = ++routeSeq;
    window.UI_READY = false;
    if (current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
    current = { name: name, args: r.args, destroy: null };
    if (shellRoot) {
      shellRoot.className = 'ui ui-shell page-' + name + (UI.me ? ' signed-in' : ' signed-out') + (p.chrome === false ? ' no-chrome' : '');
      renderChrome(name);
    }
    // A fresh element for every page, so listeners a page adds to `view` never pile up.
    var fresh = view.cloneNode(false);
    view.parentNode.replaceChild(fresh, view);
    view = fresh;
    window.scrollTo(0, 0);
    document.title = (p.title ? (typeof p.title === 'function' ? p.title(r.args) : p.title) + ' · ' : '') + UI.config.name;
    var ctx = { name: name, args: r.args, me: UI.me, go: UI.go, api: UI.api, page: p };
    var out;
    try { out = p.mount(view, ctx); } catch (e) { console.error(e); out = Promise.reject(e); }
    var ready = out && typeof out.then === 'function' ? out : (out && out.ready) || Promise.resolve();
    if (out && out.destroy) current.destroy = out.destroy;
    Promise.resolve(ready).then(function () { if (seq === routeSeq) window.UI_READY = true; },
      function (e) {
        if (seq !== routeSeq) return;
        console.error(e);
        if (!view.innerHTML) view.innerHTML = '<div class="ui-wrap"><div class="ui-empty">' + UI.icon('info') +
          '<h3>This page didn\'t load</h3><p class="muted">' + UI.esc(e && e.message || 'Something went wrong.') + '</p>' +
          '<button class="ui-btn" onclick="UI.refresh()">Try again</button></div></div>';
        window.UI_READY = true;
      });
  }
  UI.current = function () { return current; };

  /* The shell's parts come from web/app.js: UI.shell = {header(me, active), footer(me), tabbar(me, active)} */
  function renderChrome(active) {
    var S = UI.shell || {};
    var hd = shellRoot.querySelector('[data-ui-header]'), ft = shellRoot.querySelector('[data-ui-footer]'), tb = shellRoot.querySelector('[data-ui-tabbar]');
    if (hd) hd.innerHTML = S.header ? S.header(UI.me, active) : '';
    if (ft) ft.innerHTML = S.footer ? S.footer(UI.me, active) : '';
    if (tb) tb.innerHTML = S.tabbar ? S.tabbar(UI.me, active) : '';
  }
  UI.renderChrome = function () { if (shellRoot) renderChrome(current.name); };

  /* Called by client_code/Main.py (and by the local harness) once the page is up. */
  UI.start = function (node, bridgeFn, bootJson) {
    bridge = bridgeFn;
    var boot = typeof bootJson === 'string' ? JSON.parse(bootJson || '{}') : (bootJson || {});
    UI.me = boot.me || null;
    var host = node && node.matches && node.matches('[data-ui-app]') ? node : (node && node.querySelector('[data-ui-app]')) || node || document.body;
    host.innerHTML = '<div class="ui ui-shell">' +
      '<header class="ui-header" data-ui-header></header>' +
      '<main class="ui-main" data-ui-view></main>' +
      '<footer class="ui-footer" data-ui-footer></footer>' +
      '<nav class="ui-tabbar" data-ui-tabbar aria-label="Main"></nav></div>';
    shellRoot = host.firstChild;
    view = host.querySelector('[data-ui-view]');
    if (UI.shell && UI.shell.wire) UI.shell.wire(shellRoot);
    window.addEventListener('hashchange', route);
    route();
  };

  /* ------------------------------------------------------------------ feedback form (footer + menu) */
  UI.feedback = function (kind) {
    var kinds = [['bug', 'Something\'s broken', 'bug'], ['idea', 'An idea', 'bulb'], ['question', 'A question', 'info'], ['other', 'Something else', 'chat']];
    var m = UI.modal('<h2>Send feedback</h2><p class="muted">Found a bug or have an idea? It goes straight to the people who make ' + UI.esc(UI.config.name) + '.</p>' +
      '<form class="ui-stack" data-fb>' +
      '<div class="ui-choices">' + kinds.map(function (k) {
        return '<label class="ui-choice"><input type="radio" name="kind" value="' + k[0] + '"' + ((kind || 'bug') === k[0] ? ' checked' : '') + '>' +
          '<span>' + UI.icon(k[2]) + UI.esc(k[1]) + '</span></label>';
      }).join('') + '</div>' +
      '<label class="ui-field"><span>What happened, or what would you like?</span><textarea name="message" rows="5" required minlength="5" placeholder="The more detail, the better."></textarea></label>' +
      (UI.me ? '' : '<label class="ui-field"><span>Your email <em>(optional, if you\'d like a reply)</em></span><input type="email" name="email" autocomplete="email"></label>') +
      '<p class="ui-hint">We also send the page you were on, your screen size and browser, to help us fix bugs.</p>' +
      '<div class="ui-row end"><button type="button" class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn primary" type="submit">' + UI.icon('arrow') + 'Send</button></div></form>');
    var form = m.el.querySelector('[data-fb]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = UI.formData(form);
      var ctx = { page: location.hash || '#', screen: innerWidth + 'x' + innerHeight, browser: navigator.userAgent.slice(0, 280), theme: UI.theme() };
      UI.busy(form.querySelector('[type=submit]'), UI.api('submit_feedback', v.kind, v.message, v.email || null, ctx)).then(function () {
        m.close(); UI.toast('Thank you! Your message was sent.', 'ok');
      });
    });
    return m;
  };

  /* Shared clicks: [data-go="page/arg"], [data-feedback], [data-theme-set] anywhere in the app. */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-go],[data-feedback],[data-theme-set]');
    if (!el) return;
    if (el.hasAttribute('data-go')) { e.preventDefault(); UI.go.apply(null, el.getAttribute('data-go').split('/')); }
    else if (el.hasAttribute('data-feedback')) { e.preventDefault(); UI.feedback(el.getAttribute('data-feedback') || null); }
    else if (el.hasAttribute('data-theme-set')) { e.preventDefault(); UI.setTheme(el.getAttribute('data-theme-set')); if (UI.shell && UI.shell.onTheme) UI.shell.onTheme(); }
  });
})();


/* app.js: this app's identity and frame: name, header, footer, phone tab bar.
   Pages live in web/pages/*.html. The engine (window.UI) is web/core.js. */
(function () {
  'use strict';
  UI.configure({
    name: 'Little Hero Books',
    key: 'littleherobooks',          // prefix for this app's browser storage
    tagline: 'Classic stories, starring your child.',   // footer line
    home: 'home',                // first page after signing in
    landing: 'landing'           // first page for visitors who aren't signed in
  });

  var esc = UI.esc;
  // Extra icons for this app (UI.icon reads this same table).
  UI.ICONS.book = '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/>';
  UI.ICONS.wand = '<path d="m4 20 11-11"/><path d="m13 7 4 4"/><path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M9 3v2M8 4h2"/>';
  UI.ICONS.download = '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>';
  UI.ICONS.link = '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>';
  UI.ICONS.dice = '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>';
  UI.ICONS.volume = '<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>';
  UI.ICONS.smile = '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>';

  function brand() {
    return '<a class="ui-brand" href="#" data-go="' + (UI.me ? UI.config.home : UI.config.landing) + '" aria-label="' + esc(UI.config.name) + ' home">' +
      '<img src="_/theme/icon.svg" alt="" width="32" height="32"><span>' + esc(UI.config.name) + '</span></a>';
  }

  function themeSwitch() {
    var t = UI.theme();
    return '<div class="ui-seg" role="group" aria-label="Appearance">' + [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
      return '<button type="button" data-theme-set="' + o[0] + '" class="' + (t === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function userMenu(me) {
    return '<div class="ui-menu" data-menu hidden>' +
      '<div class="ui-menu-head"><strong>' + esc(me.name) + '</strong><span class="muted small">' + esc(me.email) + '</span></div>' +
      '<a href="#profile" data-go="profile">' + UI.icon('user') + 'Your profile</a>' +
      (me.is_admin ? '<a href="#admin" data-go="admin">' + UI.icon('shield') + 'Admin</a>' : '') +
      '<div class="ui-menu-block"><span class="small muted">Appearance</span>' + themeSwitch() + '</div>' +
      '<button type="button" data-feedback>' + UI.icon('chat') + 'Send feedback</button>' +
      '<button type="button" data-lk-open="overview">' + UI.icon('lock') + 'Privacy &amp; Terms</button>' +
      '<button type="button" data-signout>' + UI.icon('logout') + 'Sign out</button></div>';
  }

  UI.shell = {
    header: function (me, active) {
      var nav = UI.navPages();
      return '<div class="ui-header-in">' + brand() +
        (me ? '<nav class="ui-nav" aria-label="Main">' + nav.map(function (p) {
          return '<a href="#' + p.name + '" class="' + (p.name === active ? 'on' : '') + '">' + UI.icon(p.icon) + '<span>' + esc(p.nav) + '</span></a>';
        }).join('') + '</nav>' : '') +
        '<div class="ui-header-right">' +
        (me ? '<button type="button" class="ui-avatar-btn" data-menu-toggle aria-label="Your account" aria-haspopup="true">' + esc(UI.initials(me.name)) + '</button>' + userMenu(me)
          : (active === 'auth' ? '' : '<a class="ui-btn ghost" href="#auth" data-go="auth">Sign in</a><a class="ui-btn primary" href="#auth/signup" data-go="auth/signup">Get started</a>')) +
        '</div></div>';
    },
    footer: function (me) {
      return '<div class="ui-footer-in"><div class="ui-footer-brand">' + brand() + '<p class="muted small">' + esc(UI.config.tagline) + '</p></div>' +
        '<div class="ui-footer-links">' +
        '<a href="#landing" data-go="landing">About</a>' +
        '<a href="#library" data-go="library">Stories</a><a href="#studio" data-go="studio">Hero studio</a>' +
        '<button type="button" data-feedback>Send feedback</button>' +
        '<button type="button" data-lk-open="overview">Privacy &amp; Terms</button>' +
        '</div><p class="ui-footer-legal small muted">© ' + new Date().getFullYear() + ' ' + esc(UI.config.name) + '</p></div>';
    },
    tabbar: function (me, active) {
      var nav = UI.navPages();
      if (!me || nav.length < 2) return '';
      return nav.slice(0, 4).map(function (p) {
        return '<a href="#' + p.name + '" class="' + (p.name === active ? 'on' : '') + '">' + UI.icon(p.icon) + '<span>' + esc(p.nav) + '</span></a>';
      }).join('') + '<a href="#profile" class="' + (active === 'profile' ? 'on' : '') + '">' + UI.icon('user') + '<span>You</span></a>';
    },
    wire: function (root) {
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-menu-toggle]');
        var menu = root.querySelector('[data-menu]');
        if (t && menu) { menu.hidden = !menu.hidden; t.setAttribute('aria-expanded', String(!menu.hidden)); return; }
        if (e.target.closest('[data-signout]')) { UI.auth('logout').then(function () { UI.toast('Signed out. See you soon!'); }); }
        if (menu && !menu.hidden && !e.target.closest('[data-menu] .ui-seg')) menu.hidden = true;
      });
      document.addEventListener('keydown', function (e) {
        var menu = root.querySelector('[data-menu]');
        if (e.key === 'Escape' && menu) menu.hidden = true;
      });
    },
    onTheme: function () {  // redraw the menu's Auto/Light/Dark buttons and keep the menu open
      var menu = document.querySelector('[data-menu]'), open = menu && !menu.hidden;
      UI.renderChrome();
      if (open) document.querySelector('[data-menu]').hidden = false;
    }
  };
})();


/* ===== _avatar.html ===== */
(function () {
  'use strict';
  var LH = window.LH = window.LH || {};
  var INK = '#2B2350';
  LH.INK = INK;
  var uid = 0;
  LH.uid = function (p) { uid += 1; return (p || 'lh') + uid; };

  function shade(hex, f) {  // f < 0 darker, f > 0 lighter
    var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function m(c) { return Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))); }
    return '#' + ((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1);
  }
  LH.shade = shade;

  /* ------------------------------------------------------------------ the choices */
  LH.COL = {
    skin: { s1: '#FFE5D0', s2: '#F9D2B4', s3: '#EFBF98', s4: '#DDA477', s5: '#C08558', s6: '#9A633D', s7: '#774A2C', s8: '#55331E' },
    hair: { black: '#231C24', dark: '#3B2416', brown: '#6A4024', auburn: '#8E3B1F', ginger: '#D9692A', strawberry: '#E8A06A',
            blonde: '#EECB6E', platinum: '#F4E9C6', grey: '#BDB8C7', white: '#F4F2F7', pink: '#FF8FB8', blue: '#5BB2F7', purple: '#A98BE8' },
    eye: { brown: '#7A4A22', dark: '#3A2416', hazel: '#9A7A35', green: '#4A9A62', blue: '#4A8BDB', grey: '#7F8B99', amber: '#C9861E' },
    cloth: { tomato: '#EF5A36', sun: '#FFC93C', grass: '#3DBE8B', sky: '#4EA8F5', plum: '#8A6BD8', pink: '#FF8FB8', orange: '#FF9A3C',
             teal: '#2FA39B', navy: '#3C4F8F', white: '#F7F3EA', brown: '#8A5A3B', gold: '#E9B53B', green: '#3E8E4E', red: '#C8372D' }
  };
  LH.OPTIONS = {
    size: [['kid', 'Big kid'], ['toddler', 'Little one']],
    skin: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
    face: [['round', 'Round'], ['oval', 'Oval'], ['heart', 'Heart'], ['square', 'Square'], ['chubby', 'Chubby']],
    hair: [['none', 'No hair yet'], ['fuzz', 'Baby fuzz'], ['crop', 'Short'], ['swoop', 'Swoop'], ['spiky', 'Spiky'], ['curly', 'Curly'],
           ['afro', 'Afro'], ['puffs', 'Puffs'], ['bun', 'Top bun'], ['pigtails', 'Pigtails'], ['ponytail', 'Ponytail'], ['bob', 'Bob'],
           ['long', 'Long'], ['braids', 'Braids']],
    hairColor: ['black', 'dark', 'brown', 'auburn', 'ginger', 'strawberry', 'blonde', 'platinum', 'pink', 'blue', 'purple'],
    eyes: [['round', 'Round'], ['sparkle', 'Sparkly'], ['almond', 'Almond'], ['dot', 'Button'], ['smiley', 'Smiley']],
    eyeColor: ['brown', 'dark', 'hazel', 'green', 'blue', 'grey', 'amber'],
    brows: [['soft', 'Soft'], ['bold', 'Bold'], ['arched', 'Arched'], ['none', 'None']],
    nose: [['button', 'Button'], ['dot', 'Dot'], ['none', 'None']],
    mouth: [['smile', 'Smile'], ['grin', 'Big grin'], ['toothy', 'Toothy'], ['giggle', 'Giggle'], ['ooh', 'Ooh!']],
    glasses: [['none', 'None'], ['round', 'Round'], ['square', 'Square'], ['star', 'Party stars']],
    outfit: [['tee', 'T-shirt'], ['stripes', 'Stripes'], ['overalls', 'Dungarees'], ['dress', 'Dress'], ['hoodie', 'Hoodie'],
             ['cape', 'Super cape'], ['pyjamas', 'Pyjamas']],
    outfitColor: ['tomato', 'orange', 'sun', 'grass', 'teal', 'sky', 'navy', 'plum', 'pink', 'white'],
    hat: [['none', 'None'], ['bow', 'Bow'], ['flower', 'Flower'], ['headband', 'Star band'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['crown', 'Crown']]
  };
  LH.DEFAULT_LOOK = { size: 'kid', skin: 's3', face: 'round', hair: 'crop', hairColor: 'brown', eyes: 'round', eyeColor: 'brown',
    brows: 'soft', nose: 'button', mouth: 'smile', cheeks: true, freckles: false, glasses: 'none', outfit: 'tee',
    outfitColor: 'tomato', hat: 'none' };
  var EXTRA = { size: ['adult'], hair: ['tufts', 'bald'], hairColor: ['grey', 'white'], outfit: ['apron', 'robe', 'undies', 'tunic', 'suit'],
                outfitColor: ['brown', 'gold', 'green', 'red'], hat: ['elfhat', 'feather', 'kerchief'] };
  function allowed(key, v) {
    if (key === 'skin' || key === 'hairColor' || key === 'eyeColor' || key === 'outfitColor') {
      var table = { skin: LH.COL.skin, hairColor: LH.COL.hair, eyeColor: LH.COL.eye, outfitColor: LH.COL.cloth }[key];
      return Object.prototype.hasOwnProperty.call(table, v);
    }
    var list = (LH.OPTIONS[key] || []).map(function (o) { return o[0]; }).concat(EXTRA[key] || []);
    return list.indexOf(v) >= 0;
  }
  LH.normal = function (look) {
    var out = {}, d = LH.DEFAULT_LOOK;
    look = look || {};
    Object.keys(d).forEach(function (k) {
      var v = look[k];
      if (typeof d[k] === 'boolean') out[k] = typeof v === 'boolean' ? v : d[k];
      else out[k] = (typeof v === 'string' && allowed(k, v)) ? v : d[k];
    });
    out.facial = look.facial || 'none';     // people only: moustache, beard
    out.shoes = look.shoes || null;
    return out;
  };
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function val(o) { return Array.isArray(o) ? o[0] : o; }
  LH.randomLook = function (keep) {
    var o = LH.OPTIONS, l = {};
    Object.keys(o).forEach(function (k) { l[k] = val(pick(o[k])); });
    l.hairColor = pick(['black', 'dark', 'brown', 'brown', 'auburn', 'ginger', 'blonde', 'blonde', 'platinum', 'dark', Math.random() < .15 ? 'pink' : 'black']);
    if (Math.random() < .5) l.hat = 'none';
    if (Math.random() < .7) l.glasses = 'none';
    l.cheeks = Math.random() < .85; l.freckles = Math.random() < .25;
    if (keep) { l.size = keep.size || l.size; }
    return l;
  };

  /* ------------------------------------------------------------------ pronouns + names in story text */
  LH.PRONOUNS = {
    she: { he: 'she', He: 'She', him: 'her', his: 'her', His: 'Her', child: 'girl', royal: 'princess', royals: 'princesses' },
    he: { he: 'he', He: 'He', him: 'him', his: 'his', His: 'His', child: 'boy', royal: 'prince', royals: 'princes' },
    they: { he: 'they', He: 'They', him: 'them', his: 'their', His: 'Their', child: 'child', royal: 'royal', royals: 'royals' }
  };
  LH.GENERIC = { name: 'Little Hero', pronoun: 'they', look: null, generic: true };
  LH.fill = function (text, hero) {
    hero = hero || LH.GENERIC;
    var p = LH.PRONOUNS[hero.pronoun] || LH.PRONOUNS.they;
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return k === 'name' ? hero.name : (p[k] != null ? p[k] : m); });
  };
  /* HTML version: escaped, with the name highlighted. */
  LH.fillHtml = function (text, hero) {
    hero = hero || LH.GENERIC;
    var mark = '\u0001';
    var s = UI.esc(LH.fill(String(text).split('{name}').join(mark), hero));
    return s.split(mark).join('<b class="lh-name">' + UI.esc(hero.name) + '</b>');
  };

  /* ------------------------------------------------------------------ drawing helpers */
  function P(n) { return Math.round(n * 10) / 10; }
  function circ(x, y, r, fill, stroke, sw, extra) {
    return '<circle cx="' + P(x) + '" cy="' + P(y) + '" r="' + P(r) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 4) + '"' : '') + (extra || '') + '/>';
  }
  function ell(x, y, rx, ry, fill, stroke, sw, extra) {
    return '<ellipse cx="' + P(x) + '" cy="' + P(y) + '" rx="' + P(rx) + '" ry="' + P(ry) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 4) + '"' : '') + (extra || '') + '/>';
  }
  function path(d, fill, stroke, sw, extra) {
    return '<path d="' + d + '" fill="' + (fill || 'none') + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 4) + '" stroke-linejoin="round" stroke-linecap="round"' : '') + (extra || '') + '/>';
  }
  /* A soft blob made of circles with one outline around the lot (curls, clouds, bushes). */
  function blob(cs, fill, ink, sw) {
    sw = sw == null ? 4 : sw;
    return cs.map(function (c) { return circ(c[0], c[1], c[2] + sw, ink); }).join('') + cs.map(function (c) { return circ(c[0], c[1], c[2], fill); }).join('');
  }
  function arc(cx, cy, R, r, a0, a1, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = (a0 + (a1 - a0) * i / Math.max(1, n - 1)) * Math.PI / 180;
      out.push([cx + R * Math.cos(a), cy + R * Math.sin(a), r]);
    }
    return out;
  }
  function mirror(d) { return '<g transform="scale(-1,1)">' + d + '</g>'; }
  function star(x, y, r, fill, stroke, sw) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
      pts.push(P(x + rr * Math.cos(a)) + ' ' + P(y + rr * Math.sin(a)));
    }
    return path('M' + pts.join(' L') + 'Z', fill, stroke, sw);
  }
  LH.draw = { circ: circ, ell: ell, path: path, blob: blob, arc: arc, star: star, mirror: mirror, P: P };

  /* A limb: shoulder/hip -> bend -> hand/foot, outlined, with an optional sleeve over part of it. */
  function limb(p0, p1, p2, w, col, ink, sleeve, frac) {
    var d = 'M' + P(p0[0]) + ' ' + P(p0[1]) + ' Q' + P(p1[0]) + ' ' + P(p1[1]) + ' ' + P(p2[0]) + ' ' + P(p2[1]);
    var out = '<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-width="' + (w + 8) + '" stroke-linecap="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>';
    if (sleeve) {
      var t = frac == null ? 1 : frac;
      var q0 = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
      var q1 = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
      var e = [q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t];
      var ds = 'M' + P(p0[0]) + ' ' + P(p0[1]) + ' Q' + P(q0[0]) + ' ' + P(q0[1]) + ' ' + P(e[0]) + ' ' + P(e[1]);
      if (t < 1) out += '<path d="' + ds + '" fill="none" stroke="' + ink + '" stroke-width="' + (w + 11) + '" stroke-linecap="round"/>';
      out += '<path d="' + ds + '" fill="none" stroke="' + sleeve + '" stroke-width="' + (w + 3) + '" stroke-linecap="round"/>';
    }
    return out;
  }

  /* ------------------------------------------------------------------ body sizes */
  var BODY = {
    kid: { hip: -70, sh: -152, head: -232, hs: 1, bw: 84, legx: 17, arm: 70, lw: 24, aw: 19 },
    toddler: { hip: -52, sh: -126, head: -205, hs: 1.04, bw: 92, legx: 18, arm: 58, lw: 25, aw: 19 },
    adult: { hip: -128, sh: -248, head: -318, hs: .84, bw: 100, legx: 19, arm: 104, lw: 26, aw: 21 }
  };
  LH.BODY = BODY;
  var FACE = {
    round: { hw: 74, d: null, e: [28, 4] }, oval: { hw: 66, e: [25, 4] }, heart: { hw: 72, e: [28, 2] },
    square: { hw: 70, e: [28, 4] }, chubby: { hw: 80, e: [30, 8] }
  };
  function facePath(shape, fill, ink) {
    if (shape === 'oval') return ell(0, 0, 66, 81, fill, ink, 4.5);
    if (shape === 'chubby') return ell(0, 4, 80, 72, fill, ink, 4.5);
    if (shape === 'heart') return path('M0 80 C-30 78 -64 52 -71 12 C-78 -38 -46 -78 0 -78 C46 -78 78 -38 71 12 C64 52 30 78 0 80Z', fill, ink, 4.5);
    if (shape === 'square') return path('M-70 -38 Q-70 -76 -32 -76 L32 -76 Q70 -76 70 -38 L70 30 Q70 76 24 78 L-24 78 Q-70 76 -70 30Z', fill, ink, 4.5);
    return ell(0, 0, 74, 76, fill, ink, 4.5);
  }

  /* ------------------------------------------------------------------ hair */
  var FRONT = {
    crop: 'M-77 -2 C-84 -62 -48 -92 0 -92 C48 -92 84 -62 77 -2 C72 -26 64 -38 52 -44 C44 -34 30 -36 20 -48 C10 -36 -10 -36 -20 -48 C-30 -36 -44 -34 -52 -44 C-64 -38 -72 -26 -77 -2Z',
    swoop: 'M-78 4 C-86 -60 -50 -94 4 -94 C56 -94 86 -60 78 -2 C74 -22 68 -32 60 -38 C34 -26 -6 -34 -36 -62 C-46 -38 -64 -20 -78 4Z',
    spiky: 'M-77 -2 C-80 -36 -72 -56 -62 -66 L-72 -96 L-42 -84 L-34 -114 L-10 -90 L4 -118 L20 -90 L44 -112 L48 -82 L76 -92 L66 -62 C78 -48 82 -28 77 -2 C70 -28 58 -42 42 -46 C22 -40 -20 -40 -42 -46 C-58 -42 -70 -28 -77 -2Z',
    sleek: 'M-76 0 C-82 -58 -48 -90 0 -90 C48 -90 82 -58 76 0 C68 -40 40 -58 0 -60 C-40 -58 -68 -40 -76 0Z',
    part: 'M-80 30 C-88 -58 -50 -94 0 -94 C50 -94 88 -58 80 30 C74 -18 52 -48 8 -60 L0 -48 L-8 -60 C-52 -48 -74 -18 -80 30Z',
    bangs: 'M-80 14 C-86 -58 -50 -96 0 -96 C50 -96 86 -58 80 14 C74 -6 70 -24 66 -32 C30 -26 -30 -26 -66 -32 C-70 -24 -74 -6 -80 14Z'
  };
  function hairBack(l, hc, ink, acc) {
    var h = l.hair;
    if (h === 'bob') return path('M-90 54 C-100 -40 -62 -100 0 -100 C62 -100 100 -40 90 54 Q84 62 74 56 L-74 56 Q-84 62 -90 54Z', hc, ink, 4.5);
    if (h === 'long') return path('M-92 140 C-104 0 -72 -100 0 -100 C72 -100 104 0 92 140 Q60 150 40 136 L-40 136 Q-60 150 -92 140Z', hc, ink, 4.5);
    if (h === 'afro') return blob(arc(0, -24, 88, 34, 0, 345, 16).concat([[0, -24, 92]]), hc, ink, 4.5);
    if (h === 'puffs') return blob(arc(-70, -64, 20, 24, 0, 330, 8).concat([[-70, -64, 26]]), hc, ink, 4.5) + blob(arc(70, -64, 20, 24, 0, 330, 8).concat([[70, -64, 26]]), hc, ink, 4.5);
    if (h === 'bun') return blob(arc(0, -104, 14, 20, 0, 330, 7).concat([[0, -104, 22]]), hc, ink, 4.5);
    if (h === 'pigtails') {
      var t = path('M-70 -24 C-114 -26 -134 30 -116 76 C-106 52 -98 32 -76 18Z', hc, ink, 4.5) + circ(-76, -14, 9, acc, ink, 3.5);
      return t + mirror(t);
    }
    if (h === 'ponytail') return path('M36 -80 C100 -96 126 -22 108 52 C98 22 82 2 58 -30Z', hc, ink, 4.5) + circ(50, -74, 9, acc, ink, 3.5);
    if (h === 'braids') {
      var b = '';
      for (var i = 0; i < 5; i++) b += ell(-72, 16 + i * 25, 17 - i, 15, hc, ink, 4);
      b += circ(-72, 132, 8, acc, ink, 3.5) + path('M-80 140 L-72 160 L-64 140Z', hc, ink, 3.5);
      return b + mirror(b);
    }
    return '';
  }
  function hairFront(l, hc, ink) {
    var h = l.hair;
    if (h === 'none' || h === 'bald') return '';
    if (h === 'fuzz') return path('M-6 -76 C-14 -100 16 -110 18 -92 C19 -82 6 -82 8 -92', 'none', ink, 9) + path('M-6 -76 C-14 -100 16 -110 18 -92 C19 -82 6 -82 8 -92', 'none', hc, 4.5) +
      path('M-34 -70 Q-30 -86 -20 -88', 'none', ink, 8) + path('M-34 -70 Q-30 -86 -20 -88', 'none', hc, 4) + path('M34 -70 Q32 -86 22 -90', 'none', ink, 8) + path('M34 -70 Q32 -86 22 -90', 'none', hc, 4);
    if (h === 'tufts') return ell(-74, -16, 14, 24, hc, ink, 4) + ell(74, -16, 14, 24, hc, ink, 4);
    if (h === 'curly') return blob(arc(0, -10, 68, 22, 195, 345, 9).concat([[0, -66, 32], [-32, -60, 28], [32, -60, 28]]), hc, ink, 4.5);
    if (h === 'afro') return blob(arc(0, -10, 66, 19, 192, 348, 11).concat([[0, -64, 34], [-34, -58, 26], [34, -58, 26]]), hc, ink, 4.5);
    if (h === 'crop' || h === 'swoop' || h === 'spiky') return path(FRONT[h], hc, ink, 4.5);
    if (h === 'puffs' || h === 'bun' || h === 'ponytail') return path(FRONT.sleek, hc, ink, 4.5);
    if (h === 'pigtails' || h === 'braids' || h === 'long') return path(FRONT.part, hc, ink, 4.5);
    if (h === 'bob') return path(FRONT.bangs, hc, ink, 4.5);
    return '';
  }

  /* ------------------------------------------------------------------ face */
  function eyes(l, mood, ink, ex, ey) {
    var shape = l.eyes, ec = LH.COL.eye[l.eyeColor], one;
    if (mood === 'sleep') one = path('M-12 0 Q0 10 12 0', 'none', ink, 4.5);
    else if (mood === 'laugh' || (shape === 'smiley' && mood !== 'wow')) one = path('M-12 4 Q0 -10 12 4', 'none', ink, 4.5);
    else {
      if (mood === 'wow' && shape !== 'sparkle') shape = 'round';
      if (shape === 'sparkle') one = ell(0, 0, 15, 17, '#fff', ink, 3.5) + circ(0, 2, 11.5, ec) + circ(0, 2, 6, '#1B1530') + circ(4, -4, 4, '#fff') + circ(-4, 7, 2, '#fff');
      else if (shape === 'almond') one = path('M-15 2 Q0 -14 15 2 Q0 13 -15 2Z', '#fff', ink, 3.5) + circ(0, 1.5, 6.5, ec) + circ(0, 1.5, 3.4, '#1B1530') + circ(2.4, -1.4, 2.2, '#fff');
      else if (shape === 'dot') one = circ(0, 0, 8.5, shade(ec, -.6)) + circ(2.6, -2.8, 2.6, '#fff');
      else one = ell(0, 0, 13, 14, '#fff', ink, 3.5) + circ(0, 1, 9, ec) + circ(0, 1, 4.6, '#1B1530') + circ(3, -3, 3, '#fff');
    }
    return '<g transform="translate(' + (-ex) + ' ' + ey + ')">' + one + '</g><g transform="translate(' + ex + ' ' + ey + ')">' + one + '</g>';
  }
  function brows(l, mood, bc, ex, ey) {
    if (l.brows === 'none') return '';
    var w = l.brows === 'bold' ? 7 : 4.5, y = ey - 26 - (mood === 'wow' ? 7 : 0);
    var d = l.brows === 'arched' ? 'M-13 4 Q-2 -10 13 0' : 'M-12 2 Q0 -6 12 2';
    if (mood === 'oops' || mood === 'sad') d = 'M-12 2 Q2 0 12 -7';
    var one = path(d, 'none', bc, w);
    return '<g transform="translate(' + (-ex) + ' ' + y + ')">' + one + '</g><g transform="translate(' + ex + ' ' + y + ') scale(-1,1)">' + one + '</g>';
  }
  function mouth(l, mood, ink) {
    var m = l.mouth, red = '#7A2638', tongue = '#FF7F8E';
    if (mood === 'wow') m = 'ooh';
    if (mood === 'laugh') m = 'giggle';
    if (mood === 'sleep') return path('M-9 40 Q0 46 9 40', 'none', ink, 4);
    if (mood === 'oops') return path('M-14 44 Q-7 38 0 44 Q7 50 14 44', 'none', ink, 4.5);
    if (mood === 'sad') return path('M-14 48 Q0 36 14 48', 'none', ink, 4.5);
    if (m === 'grin') return path('M-19 34 Q0 62 19 34 Z', red, ink, 4) + ell(0, 47, 9, 5, tongue);
    if (m === 'toothy') return path('M-19 34 Q0 62 19 34 Z', red, ink, 4) + ell(0, 48, 9, 5, tongue) + path('M-12 35.5 L12 35.5 L11 42 L-11 42Z', '#fff');
    if (m === 'giggle') return path('M-24 32 Q0 72 24 32 Z', red, ink, 4) + ell(0, 52, 12, 7, tongue);
    if (m === 'ooh') return ell(0, 44, 8, 10, red, ink, 4);
    return path('M-17 36 Q0 52 17 36', 'none', ink, 4.5);
  }
  function glasses(l, ink, ex, ey) {
    var g = l.glasses;
    if (g === 'none') return '';
    var tint = 'rgba(255,255,255,.22)';
    if (g === 'round') return circ(-ex, ey, 19, tint, ink, 4) + circ(ex, ey, 19, tint, ink, 4) + path('M' + (-ex + 19) + ' ' + ey + ' Q0 ' + (ey - 8) + ' ' + (ex - 19) + ' ' + ey, 'none', ink, 4);
    if (g === 'square') return '<rect x="' + (-ex - 21) + '" y="' + (ey - 16) + '" width="42" height="32" rx="9" fill="' + tint + '" stroke="' + ink + '" stroke-width="4"/>' +
      '<rect x="' + (ex - 21) + '" y="' + (ey - 16) + '" width="42" height="32" rx="9" fill="' + tint + '" stroke="' + ink + '" stroke-width="4"/>' + path('M' + (-ex + 21) + ' ' + ey + ' L' + (ex - 21) + ' ' + ey, 'none', ink, 4);
    if (g === 'star') return star(-ex, ey + 1, 26, 'rgba(255,201,60,.35)', '#EF5A36', 4.5) + star(ex, ey + 1, 26, 'rgba(255,201,60,.35)', '#EF5A36', 4.5) + path('M' + (-ex + 14) + ' ' + ey + ' L' + (ex - 14) + ' ' + ey, 'none', '#EF5A36', 4);
    return '';
  }
  function hat(l, oc, ink) {
    var h = l.hat;
    if (h === 'bow') return '<g transform="translate(48 -72) rotate(20)">' + path('M0 0 L-28 -17 Q-33 0 -28 17 Z', oc, ink, 4) + path('M0 0 L28 -17 Q33 0 28 17 Z', oc, ink, 4) + circ(0, 0, 8, shade(oc, -.15), ink, 4) + '</g>';
    if (h === 'cap') return path('M-75 -30 C-76 -104 76 -104 75 -30 Z', oc, ink, 4.5) + path('M30 -36 Q92 -44 108 -24 Q72 -16 30 -26Z', shade(oc, -.18), ink, 4.5) + circ(0, -94, 6, shade(oc, -.18), ink, 3.5);
    if (h === 'crown') return path('M-46 -74 L-50 -120 L-25 -98 L0 -128 L25 -98 L50 -120 L46 -74 Z', '#FFC93C', ink, 4.5) + circ(0, -90, 6, '#EF5A36', ink, 3) + circ(-28, -86, 5, '#4EA8F5', ink, 3) + circ(28, -86, 5, '#3DBE8B', ink, 3);
    if (h === 'flower') {
      var f = '';
      for (var i = 0; i < 6; i++) f += '<ellipse cx="0" cy="-15" rx="8" ry="13" fill="#fff" stroke="' + ink + '" stroke-width="3.5" transform="rotate(' + (i * 60) + ')"/>';
      return '<g transform="translate(56 -60)">' + f + circ(0, 0, 9, '#FFC93C', ink, 3.5) + '</g>';
    }
    if (h === 'beanie') return path('M-79 -22 C-82 -108 82 -108 79 -22 Z', oc, ink, 4.5) + path('M-80 -38 L80 -38 L80 -20 L-80 -20Z', shade(oc, -.15), ink, 4.5) + circ(0, -104, 17, '#F7F3EA', ink, 4);
    if (h === 'headband') return path('M-76 -26 C-64 -96 64 -96 76 -26', 'none', ink, 18) + path('M-76 -26 C-64 -96 64 -96 76 -26', 'none', oc, 10) + star(42, -76, 17, '#FFC93C', ink, 3.5);
    if (h === 'elfhat') return path('M-78 -32 C-66 -96 34 -112 76 -158 C72 -112 80 -72 78 -32 Z', oc, ink, 4.5) + path('M-80 -42 L80 -42 L80 -26 L-80 -26Z', '#F7F3EA', ink, 4) + circ(76, -158, 13, '#FFC93C', ink, 4);
    if (h === 'feather') return path('M10 -104 C40 -150 76 -140 70 -126 C56 -128 34 -116 18 -96Z', '#EF5A36', ink, 3.5) + path('M-48 -70 L-40 -112 L40 -112 L48 -70Z', oc, ink, 4.5) + ell(0, -70, 82, 13, shade(oc, -.15), ink, 4.5);
    if (h === 'kerchief') return path('M-80 -10 C-86 -80 -46 -100 0 -100 C46 -100 86 -80 80 -10 C60 -40 30 -50 0 -50 C-30 -50 -60 -40 -80 -10Z', oc, ink, 4.5) + circ(-30, -76, 5, '#fff') + circ(16, -84, 5, '#fff') + circ(48, -60, 5, '#fff');
    return '';
  }
  function facial(l, hc, ink) {
    if (l.facial === 'beard') return path('M-70 6 C-70 70 -40 110 0 112 C40 110 70 70 70 6 C56 30 40 34 26 30 C12 22 -12 22 -26 30 C-40 34 -56 30 -70 6Z', hc, ink, 4.5);
    if (l.facial === 'moustache') return path('M-2 30 C-14 22 -34 24 -40 38 C-28 34 -14 40 -2 36 M2 30 C14 22 34 24 40 38 C28 34 14 40 2 36', hc, ink, 3.5);
    return '';
  }
  function head(l, o, ink) {
    var F = FACE[l.face] || FACE.round, skin = LH.COL.skin[l.skin], hc = LH.COL.hair[l.hairColor], oc = LH.COL.cloth[l.outfitColor];
    var ex = F.e[0], ey = F.e[1], mood = o.mood || 'happy';
    var bc = (l.hair === 'none' || l.hair === 'bald' || l.hair === 'fuzz') ? shade(skin, -.4) : shade(hc, -.3);
    if (o.ghost) {
      return circ(-F.hw + 3, 10, 15, skin, ink, 4) + circ(F.hw - 3, 10, 15, skin, ink, 4) + facePath(l.face, skin, ink) +
        '<text x="0" y="30" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="700" font-size="92" fill="#FFC93C" stroke="' + ink + '" stroke-width="4" paint-order="stroke">?</text>';
    }
    var s = circ(-F.hw + 3, 10, 15, skin, ink, 4) + circ(F.hw - 3, 10, 15, skin, ink, 4) +
      path('M' + (-F.hw + 3) + ' 4 q-5 6 0 12', 'none', shade(skin, -.25), 3) + path('M' + (F.hw - 3) + ' 4 q5 6 0 12', 'none', shade(skin, -.25), 3) +
      facePath(l.face, skin, ink);
    if (l.cheeks) s += circ(-ex - 20, ey + 26, 12, '#FF8FB8', null, 0, ' opacity=".5"') + circ(ex + 20, ey + 26, 12, '#FF8FB8', null, 0, ' opacity=".5"');
    if (l.freckles) [[-46, 20], [-38, 26], [-50, 28], [46, 20], [38, 26], [50, 28]].forEach(function (f) { s += circ(f[0], f[1] + ey - 4, 2.3, shade(skin, -.35)); });
    s += eyes(l, mood, ink, ex, ey) + brows(l, mood, bc, ex, ey);
    if (l.nose === 'button') s += ell(0, 22, 7, 5, shade(skin, -.16));
    else if (l.nose === 'dot') s += circ(0, 22, 3.6, shade(skin, -.35));
    s += facial(l, hc, ink) + mouth(l, mood, ink) + hairFront(l, hc, ink) + glasses(l, ink, ex, ey) + hat(l, oc, ink);
    return s;
  }

  /* ------------------------------------------------------------------ body + clothes */
  var ARMS = {
    // [left, right]: each [hand x, hand y, bend x, bend y] relative to the shoulder (x outward), as fractions of arm length
    stand: [[.18, 1, .26, .5], [.18, 1, .26, .5]],
    wave: [[.18, 1, .26, .5], [.48, -.8, .66, .1]],
    cheer: [[.44, -.82, .6, .02], [.44, -.82, .6, .02]],
    hold: [[-.62, .62, .22, .62], [-.62, .62, .22, .62]],
    point: [[.18, 1, .26, .5], [.98, -.3, .45, .02]],
    hips: [[-.06, .98, .48, .48], [-.06, .98, .48, .48]],
    shrug: [[.5, .2, .44, .62], [.5, .2, .44, .62]],
    walk: [[.04, .96, .3, .48], [.4, .86, .36, .4]],
    reach: [[1.2, .32, .7, .34], [1.06, .22, .6, .26]],
    climb: [[.3, -.9, .55, -.2], [.42, .1, .5, .55]]
  };
  function body(l, o, ink, P0) {
    var B = P0, w = B.bw / 2, sh = B.sh, hip = B.hip, pose = o.pose || 'stand';
    var skin = LH.COL.skin[l.skin], oc = LH.COL.cloth[l.outfitColor], out = l.outfit;
    if (o.ghost) { skin = '#FFFFFF'; oc = '#FFFFFF'; }
    var pants = '#3C5A99', legCol = pants, shoe = l.shoes || INK, sleeve = oc, sleeveFrac = .42, top = oc;
    var second = { tomato: '#4EA8F5', sky: '#FFC93C', sun: '#4EA8F5', grass: '#FFC93C', plum: '#FFC93C', pink: '#4EA8F5', orange: '#2FA39B', teal: '#FFC93C', navy: '#FFC93C', white: '#EF5A36' }[l.outfitColor] || '#4EA8F5';
    if (out === 'dress' || out === 'undies') legCol = skin;
    if (out === 'overalls' || out === 'pyjamas') legCol = oc;
    if (out === 'cape') { top = second; sleeve = second; legCol = '#3C4F8F'; }
    if (out === 'overalls') { top = '#F7F3EA'; sleeve = '#F7F3EA'; }
    if (out === 'hoodie' || out === 'pyjamas' || out === 'robe' || out === 'apron' || out === 'suit') sleeveFrac = 1;
    if (out === 'undies') { top = skin; sleeve = null; }
    if (out === 'apron') { legCol = '#5A4A3A'; }
    if (out === 'tunic') { legCol = '#3C4F8F'; sleeveFrac = .7; }
    if (out === 'suit') { legCol = shade(oc, -.25); }
    if (o.ghost) { legCol = '#FFFFFF'; top = '#FFFFFF'; sleeve = '#FFFFFF'; shoe = '#FFFFFF'; }

    var back = '', s = '';
    // the cape and robes hang behind
    if (out === 'cape') back += path('M' + (-w + 4) + ' ' + (sh + 6) + ' C' + (-w - 26) + ' ' + (hip + 10) + ' ' + (-w - 34) + ' -30 ' + (-w - 30) + ' -12 Q0 2 ' + (w + 30) + ' -12 C' + (w + 34) + ' -30 ' + (w + 26) + ' ' + (hip + 10) + ' ' + (w - 4) + ' ' + (sh + 6) + 'Z', oc, ink, 4.5);
    // legs + shoes
    var sit = pose === 'sit', walk = pose === 'walk';
    var lf = walk ? [-30, -2] : [-B.legx - 2, sit ? -4 : -2], rf = walk ? [28, -6] : [B.legx + 2, sit ? -4 : -2];
    var legTop = hip - 8;
    if (out !== 'robe') {
      s += limb([-B.legx, legTop], [(lf[0] - B.legx) / 2 - 2, (legTop + lf[1]) / 2], [lf[0], lf[1] - 6], B.lw, legCol, ink) +
        limb([B.legx, legTop], [(rf[0] + B.legx) / 2 + 2, (legTop + rf[1]) / 2], [rf[0], rf[1] - 6], B.lw, legCol, ink);
      if (out === 'pyjamas' && !o.ghost) s += circ(-B.legx, hip + 26, 3.5, '#fff') + circ(B.legx, hip + 40, 3.5, '#fff');
      if (out === 'tunic' && !o.ghost) s += path('M' + (-B.legx - 11) + ' ' + (hip + 30) + ' h22 M' + (B.legx - 11) + ' ' + (hip + 30) + ' h22', 'none', '#FFC93C', 5);
      s += ell(lf[0] - 4, lf[1] - 4, 19, 10, shoe, ink, 4) + ell(rf[0] + 4, rf[1] - 4, 19, 10, shoe, ink, 4);
    }
    // arms: which go behind the body
    var arms = ARMS[pose] || ARMS.stand, A = B.arm, aw = B.aw;
    function arm(side, spec) {
      var sx = side * (w - 8), sy = sh + 16;
      var hand = [sx + side * spec[0] * A, sy + spec[1] * A], bend = [sx + side * spec[2] * A, sy + spec[3] * A];
      if (pose === 'reach') { hand = [w + spec[0] * A * .7 - (side < 0 ? 30 : 0), sy + spec[1] * A]; bend = [w + spec[2] * A * .5, sy + spec[3] * A]; }
      var col = sleeveFrac >= 1 && sleeve ? sleeve : skin;
      return limb([sx, sy], bend, hand, aw, col, ink, sleeveFrac < 1 ? sleeve : null, sleeveFrac) + circ(hand[0], hand[1], aw * .62, skin, ink, 4);
    }
    var behind = pose === 'reach' ? arm(-1, arms[0]) : '';
    // torso
    var tl = 'M' + (-w + 10) + ' ' + sh + ' Q0 ' + (sh - 10) + ' ' + (w - 10) + ' ' + sh + ' Q' + w + ' ' + sh + ' ' + w + ' ' + (sh + 16) +
      ' L' + (w + 3) + ' ' + hip + ' Q0 ' + (hip + 9) + ' ' + (-w - 3) + ' ' + hip + ' L' + (-w) + ' ' + (sh + 16) + ' Q' + (-w) + ' ' + sh + ' ' + (-w + 10) + ' ' + sh + 'Z';
    var torso = '';
    if (out === 'robe') {
      torso += path('M' + (-w + 8) + ' ' + sh + ' Q0 ' + (sh - 10) + ' ' + (w - 8) + ' ' + sh + ' L' + (w + 26) + ' -4 Q0 6 ' + (-w - 26) + ' -4Z', oc, ink, 4.5) +
        path('M' + (-w - 26) + ' -4 Q0 6 ' + (w + 26) + ' -4 L' + (w + 24) + ' -18 Q0 -8 ' + (-w - 24) + ' -18Z', '#F7F3EA', ink, 4) +
        path('M-18 ' + sh + ' L18 ' + sh + ' L14 -16 L-14 -16Z', '#F7F3EA', ink, 3.5) + path('M' + (-w) + ' ' + (hip + 4) + ' L' + w + ' ' + (hip + 4), 'none', '#FFC93C', 9);
      [[-6, sh + 30], [6, sh + 60], [-4, sh + 100], [6, -40]].forEach(function (d) { torso += circ(d[0], d[1], 2.6, INK); });
    } else {
      torso += path(tl, top, ink, 4.5);
      if (out === 'stripes' && !o.ghost) {
        var cid = LH.uid('st');
        torso += '<clipPath id="' + cid + '"><path d="' + tl + '"/></clipPath><g clip-path="url(#' + cid + ')">';
        for (var y = sh + 14; y < hip; y += 20) torso += '<rect x="' + (-w - 6) + '" y="' + y + '" width="' + (B.bw + 12) + '" height="9" fill="#FFFFFF" opacity=".85"/>';
        torso += '</g>' + path(tl, 'none', ink, 4.5);
      }
      if (out === 'overalls' && !o.ghost) torso += path('M' + (-w + 14) + ' ' + (sh + 34) + ' L' + (w - 14) + ' ' + (sh + 34) + ' L' + (w + 3) + ' ' + hip + ' Q0 ' + (hip + 9) + ' ' + (-w - 3) + ' ' + hip + 'Z', oc, ink, 4) +
        path('M' + (-w + 16) + ' ' + (sh + 36) + ' L' + (-w + 10) + ' ' + (sh + 2) + ' M' + (w - 16) + ' ' + (sh + 36) + ' L' + (w - 10) + ' ' + (sh + 2), 'none', oc, 9) +
        circ(-w + 18, sh + 40, 4.5, '#FFC93C', ink, 2.5) + circ(w - 18, sh + 40, 4.5, '#FFC93C', ink, 2.5) + '<rect x="-14" y="' + (sh + 48) + '" width="28" height="18" rx="5" fill="' + shade(oc, -.12) + '" stroke="' + ink + '" stroke-width="3"/>';
      if (out === 'dress' && !o.ghost) torso += path('M' + (-w + 2) + ' ' + (hip - 22) + ' L' + (w - 2) + ' ' + (hip - 22) + ' L' + (w + 26) + ' ' + (hip + 34) + ' Q0 ' + (hip + 48) + ' ' + (-w - 26) + ' ' + (hip + 34) + 'Z', oc, ink, 4.5) +
        path('M' + (-w - 18) + ' ' + (hip + 30) + ' Q0 ' + (hip + 42) + ' ' + (w + 18) + ' ' + (hip + 30), 'none', '#FFFFFF', 4, ' opacity=".8" stroke-dasharray="2 9"') +
        path('M' + (-w + 4) + ' ' + (hip - 22) + ' L' + (w - 4) + ' ' + (hip - 22), 'none', shade(oc, -.2), 6);
      if (out === 'hoodie' && !o.ghost) torso += path('M-24 ' + (hip - 36) + ' L24 ' + (hip - 36) + ' L30 ' + (hip - 8) + ' L-30 ' + (hip - 8) + 'Z', shade(oc, -.14), ink, 3.5) +
        path('M-10 ' + (sh + 4) + ' l-3 34 M10 ' + (sh + 4) + ' l3 34', 'none', '#F7F3EA', 3.5);
      if (out === 'cape' && !o.ghost) torso += star(0, sh + 40, 20, oc, ink, 3.5) + path('M' + (-w - 3) + ' ' + (hip - 8) + ' L' + (w + 3) + ' ' + (hip - 8), 'none', '#FFC93C', 8);
      if (out === 'pyjamas' && !o.ghost) torso += [[-20, sh + 26], [18, sh + 44], [-14, sh + 66], [22, sh + 78], [-26, sh + 52], [4, sh + 24]].map(function (d) { return circ(d[0], d[1], 4, '#FFFFFF', null, 0, ' opacity=".9"'); }).join('') +
        path('M0 ' + (sh + 2) + ' L0 ' + (hip + 2), 'none', shade(oc, -.25), 3) + circ(5, sh + 34, 3, '#fff') + circ(5, sh + 60, 3, '#fff');
      if (out === 'tee' && !o.ghost) torso += path('M-16 ' + (sh - 3) + ' Q0 ' + (sh + 12) + ' 16 ' + (sh - 3), 'none', shade(oc, -.2), 4);
      if (out === 'apron' && !o.ghost) torso += path('M-28 ' + (sh + 20) + ' L28 ' + (sh + 20) + ' L36 ' + (hip + 30) + ' Q0 ' + (hip + 38) + ' -36 ' + (hip + 30) + 'Z', '#F7F3EA', ink, 4) + '<rect x="-16" y="' + (hip - 20) + '" width="32" height="22" rx="5" fill="' + shade(oc, .3) + '" stroke="' + ink + '" stroke-width="3"/>';
      if (out === 'suit' && !o.ghost) torso += path('M-20 ' + (sh - 2) + ' L0 ' + (sh + 46) + ' L20 ' + (sh - 2) + 'Z', '#F7F3EA', ink, 3.5) + path('M0 ' + (sh + 6) + ' L-7 ' + (sh + 18) + ' L0 ' + (sh + 50) + ' L7 ' + (sh + 18) + 'Z', '#EF5A36', ink, 3);
      if (out === 'tunic' && !o.ghost) torso += path('M' + (-w - 3) + ' ' + (hip - 4) + ' L' + (-w - 6) + ' ' + (hip + 22) + ' L' + (-w + 14) + ' ' + (hip + 12) + ' L-14 ' + (hip + 26) + ' L4 ' + (hip + 12) + ' L22 ' + (hip + 26) + ' L' + (w - 10) + ' ' + (hip + 12) + ' L' + (w + 6) + ' ' + (hip + 22) + ' L' + (w + 3) + ' ' + (hip - 4) + 'Z', oc, ink, 4) + path('M' + (-w) + ' ' + (hip - 10) + ' L' + w + ' ' + (hip - 10), 'none', '#8A5A3B', 7);
      if (out === 'undies' && !o.ghost) torso += circ(0, hip - 26, 2.6, shade(skin, -.35)) + path('M' + (-w - 4) + ' ' + (hip - 16) + ' L' + (w + 4) + ' ' + (hip - 16) + ' L' + (w + 6) + ' ' + (hip + 14) + ' Q' + (B.legx + 6) + ' ' + (hip + 18) + ' 0 ' + (hip + 4) + ' Q' + (-B.legx - 6) + ' ' + (hip + 18) + ' ' + (-w - 6) + ' ' + (hip + 14) + 'Z', '#FFFFFF', ink, 4) +
        [[-24, hip - 6], [-4, hip - 2], [18, hip - 8], [32, hip + 6], [-34, hip + 6]].map(function (d) { return circ(d[0], d[1], 4.5, '#EF5A36'); }).join('');
    }
    var front = arm(1, arms[1]) + (pose === 'reach' ? '' : arm(-1, arms[0]));
    // hood sits behind the head, on the shoulders
    var hood = (out === 'hoodie' && !o.ghost) ? ell(0, sh + 2, w - 6, 15, shade(oc, -.14), ink, 4) : '';
    return { back: back, s: behind + s + torso + hood + front };
  }

  /* ------------------------------------------------------------------ the figure */
  LH.figure = function (look, o) {
    o = o || {};
    var l = o.ghost ? LH.normal({ size: (look && look.size) || 'kid', hair: 'none', outfit: 'tee', skin: 's1' }) : LH.normal(look);
    if (o.ghost) { l.skin = 's1'; }
    var ink = o.ghost ? '#A99BDF' : INK;
    var B = BODY[l.size] || BODY.kid;
    var bd = body(l, o, ink, B);
    var hc = LH.COL.hair[l.hairColor], acc = LH.COL.cloth[l.outfitColor === 'sun' ? 'tomato' : 'sun'];
    var skinSave = LH.COL.skin.s1;
    if (o.ghost) LH.COL.skin.s1 = '#FFFFFF';
    var headT = '<g transform="translate(0 ' + B.head + ') scale(' + B.hs + ')">';
    var inner = (o.ghost ? '' : headT + hairBack(l, hc, ink, acc) + '</g>') + bd.back + bd.s + headT + head(l, o, ink) + '</g>';
    if (o.ghost) LH.COL.skin.s1 = skinSave;
    var s = o.s || 1, fx = o.flip ? -s : s;
    var t = 'translate(' + P(o.x || 0) + ' ' + P(o.y || 0) + ')' + (o.rot ? ' rotate(' + o.rot + ')' : '') + ' scale(' + P(fx * 100) / 100 + ' ' + P(s * 100) / 100 + ')';
    return '<g transform="' + t + '"' + (o.ghost ? ' opacity=".92"' : '') + '>' + inner + '</g>';
  };
  /* Where the head is, for scenes that need it (speech bubbles, hats). */
  LH.headY = function (look) { var B = BODY[(LH.normal(look)).size] || BODY.kid; return B.head; };

  LH.avatarSvg = function (look, o) {
    o = o || {};
    var l = LH.normal(look), B = BODY[l.size] || BODY.kid, vb;
    if (o.crop === 'head') {
      var cy = B.head * 1 + (l.size === 'toddler' ? 6 : 4);
      vb = [-128, cy - 132, 256, 256];
    } else vb = [-175, B.head - 150, 350, -B.head + 170];
    var bg = o.bg ? '<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="' + o.bg + '"/>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '" class="' + (o.cls || 'lh-av') + '" aria-hidden="true">' + bg +
      LH.figure(look, { pose: o.pose, mood: o.mood, ghost: o.ghost }) + '</svg>';
  };
})();

/* ===== _book.html ===== */
(function () {
  'use strict';
  var LH = window.LH = window.LH || {};
  var esc = function (s) { return UI.esc(s); };

  LH.confetti = function () {
    var box = document.createElement('div'), cs = ['#ef5a36', '#ffc93c', '#3dbe8b', '#4ea8f5', '#8a6bd8', '#ff8fb8'];
    box.className = 'lh-confetti';
    for (var i = 0; i < 70; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = cs[i % cs.length];
      p.style.animationDelay = (Math.random() * .5) + 's';
      p.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      p.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3200);
  };

  LH.title = function (story, hero) { return LH.fill(story.title, hero || LH.GENERIC); };

  LH.coverHtml = function (story, hero, o) {
    o = o || {};
    return '<div class="lh-cover" style="--cv:' + esc(story.color) + '"><div class="pic">' + LH.sceneSvg(story.key, 'cover', hero, { clip: LH.uid('cv') }) + '</div>' +
      '<div class="ttl"><span>' + esc(LH.title(story, hero)) + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span></div></div>';
  };

  LH.bookPages = function (book) {
    var pages = [{ kind: 'cover' }, { kind: 'dedication' }];
    for (var i = 0; i < book.story.text.length; i++) pages.push({ kind: 'story', i: i });
    pages.push({ kind: 'end' });
    return pages;
  };
  LH.dedication = function (book) {
    var h = book.hero || LH.GENERIC;
    return (book.dedication || '').trim() || (book.hero ? 'For ' + h.name + ', the hero of this story, with all our love.' : 'For our little hero, with all our love.');
  };
  LH.madeLine = function (book) {
    var d = book.created ? new Date(book.created) : new Date();
    return 'Made with Little Hero Books on ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
  };

  LH.pageHtml = function (book, p, n, total) {
    var hero = book.hero, st = book.story, clip = LH.uid('pg');
    if (p.kind === 'cover') {
      return '<div class="rd-cov" style="--cv:' + esc(st.color) + '"><div class="rd-pic">' + LH.sceneSvg(st.key, 'cover', hero, { clip: clip }) + '</div>' +
        '<h2>' + esc(LH.title(st, hero)) + '<small>A Little Hero Book</small></h2></div>';
    }
    if (p.kind === 'dedication') {
      var h = hero || LH.GENERIC;
      return '<div class="rd-ded"><div class="frame">' + (hero ? LH.avatarSvg(hero.look, { crop: 'head', mood: 'laugh' }) : LH.avatarSvg(null, { crop: 'head', ghost: true })) + '</div>' +
        '<div class="belongs">This book belongs to</div><div class="who">' + esc(h.name) + '</div><p class="msg">' + esc(LH.dedication(book)) + '</p></div>';
    }
    if (p.kind === 'end') {
      return '<div class="rd-end"><div class="fig">' + (hero ? LH.avatarSvg(hero.look, { pose: 'wave', mood: 'laugh' }) : LH.avatarSvg(null, { ghost: true })) + '</div>' +
        '<h2>The End</h2><p>' + esc(st.source) + '</p><p>' + esc(LH.madeLine(book)) + '</p></div>';
    }
    return '<div class="rd-pic">' + LH.sceneSvg(st.key, p.i, hero, { clip: clip }) + '</div><p class="rd-text">' + LH.fillHtml(st.text[p.i], hero) + '</p>' +
      '<div class="rd-num">' + (p.i + 1) + '</div>';
  };
  LH.pageSpeech = function (book, p) {
    var h = book.hero || LH.GENERIC;
    if (p.kind === 'cover') return LH.title(book.story, book.hero);
    if (p.kind === 'dedication') return 'This book belongs to ' + h.name + '. ' + LH.dedication(book);
    if (p.kind === 'end') return 'The End.';
    return LH.fill(book.story.text[p.i], book.hero);
  };

  /* ------------------------------------------------------------------ the reader */
  LH.reader = function (el, book, opts) {
    opts = opts || {};
    var pages = LH.bookPages(book), at = Math.min(opts.start || 0, pages.length - 1), seen = {}, reading = false, finished = false;
    el.innerHTML = '<div class="rd"><div class="rd-stage"><button class="rd-nav prev" data-rd="prev" aria-label="Previous page">' + UI.icon('back') + '</button>' +
      '<div class="rd-book" data-rd-book></div><button class="rd-nav next" data-rd="next" aria-label="Next page">' + UI.icon('arrow') + '</button></div>' +
      '<div class="rd-bar"><div class="rd-dots" data-rd-dots></div><div class="rd-tools">' +
      ('speechSynthesis' in window ? '<button class="ui-btn sm" data-rd="speak">' + UI.icon('chat') + '<span>Read to me</span></button>' : '') +
      (opts.tools || '') + '</div></div></div>';
    var bookEl = el.querySelector('[data-rd-book]'), dots = el.querySelector('[data-rd-dots]');
    function draw(dir) {
      seen[at] = true;
      bookEl.innerHTML = '<div class="rd-page' + (dir < 0 ? ' back' : '') + '">' + LH.pageHtml(book, pages[at], at, pages.length) + '</div>';
      el.querySelector('[data-rd=prev]').disabled = at === 0;
      el.querySelector('[data-rd=next]').disabled = at === pages.length - 1;
      dots.innerHTML = pages.map(function (p, i) { return '<button data-rd-go="' + i + '" class="' + (i === at ? 'on' : seen[i] ? 'seen' : '') + '" aria-label="Page ' + (i + 1) + '"></button>'; }).join('');
      if (at === pages.length - 1 && !finished) { finished = true; LH.confetti(); if (opts.onFinish) opts.onFinish(); }
      if (opts.onPage) opts.onPage(at, pages[at]);
      if (reading) speak();
    }
    function go(n) {
      var to = Math.max(0, Math.min(pages.length - 1, n));
      if (to === at) return;
      var dir = to > at ? 1 : -1;
      at = to;
      draw(dir);
    }
    function speak() {
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(LH.pageSpeech(book, pages[at]));
        u.rate = .9; u.pitch = 1.08;
        var mine = at;
        u.onend = function () { if (reading && mine === at) { if (at < pages.length - 1) setTimeout(function () { if (reading && mine === at) go(at + 1); }, 900); else stopSpeak(); } };
        speechSynthesis.speak(u);
      } catch (e) { stopSpeak(); }
    }
    function stopSpeak() {
      reading = false;
      try { speechSynthesis.cancel(); } catch (e) {}
      var b = el.querySelector('[data-rd=speak]');
      if (b) { b.classList.remove('on'); b.querySelector('span').textContent = 'Read to me'; }
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rd],[data-rd-go]');
      if (!b) return;
      if (b.hasAttribute('data-rd-go')) return go(+b.getAttribute('data-rd-go'));
      var k = b.getAttribute('data-rd');
      if (k === 'prev') go(at - 1);
      else if (k === 'next') go(at + 1);
      else if (k === 'speak') {
        if (reading) return stopSpeak();
        reading = true; b.classList.add('on'); b.querySelector('span').textContent = 'Stop reading'; speak();
      }
    });
    function key(e) {
      if (e.target.closest && e.target.closest('input, textarea, select') || document.querySelector('.ui-modal-wrap')) return;
      if (e.key === 'ArrowRight') go(at + 1);
      if (e.key === 'ArrowLeft') go(at - 1);
    }
    document.addEventListener('keydown', key);
    var sx = null;
    bookEl.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    bookEl.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 45) go(at + (dx < 0 ? 1 : -1));
    });
    draw(1);
    return {
      go: go, at: function () { return at; }, count: pages.length,
      destroy: function () { document.removeEventListener('keydown', key); stopSpeak(); }
    };
  };

  /* ------------------------------------------------------------------ PDF */
  var PX = 1500, INK = '#2B2350';
  function svgImage(svg) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('A picture could not be drawn.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function paper(ctx, bg) {
    ctx.fillStyle = bg || '#FFF8EC'; ctx.fillRect(0, 0, PX, PX);
    ctx.fillStyle = 'rgba(43,35,80,.06)';
    for (var y = 18; y < PX; y += 36) for (var x = 18; x < PX; x += 36) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(43,35,80,.12)'; ctx.fillRect(0, 0, 18, PX);
  }
  function framed(ctx, img, x, y, w, h, r) {
    ctx.save(); ctx.fillStyle = INK; rrect(ctx, x + 12, y + 12, w, h, r); ctx.fill(); ctx.restore();
    ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.drawImage(img, x, y, w, h); ctx.restore();
    ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = INK; rrect(ctx, x, y, w, h, r); ctx.stroke(); ctx.restore();
  }
  /* Word-wrapped, centred text; words that contain the hero's name are drawn in tomato. */
  function wrap(ctx, words, maxW) {
    var lines = [[]], w = 0, space = ctx.measureText(' ').width;
    words.forEach(function (wd) {
      var ww = ctx.measureText(wd.t).width;
      if (w + ww > maxW && lines[lines.length - 1].length) { lines.push([]); w = 0; }
      lines[lines.length - 1].push({ t: wd.t, hi: wd.hi, w: ww }); w += ww + space;
    });
    return lines;
  }
  function textBlock(ctx, text, name, box, o) {
    o = o || {};
    var size = o.size || 52, font = o.font || 'Nunito', weight = o.weight || 700, lh = o.lh || 1.42, lines;
    var words = text.split(/\s+/).filter(Boolean).map(function (t) { return { t: t, hi: !!(name && t.indexOf(name) >= 0) }; });
    for (; size > 24; size -= 2) {
      ctx.font = weight + ' ' + size + 'px "' + font + '", "Segoe UI", Arial, sans-serif';
      lines = wrap(ctx, words, box.w);
      if (lines.length * size * lh <= box.h) break;
    }
    var space = ctx.measureText(' ').width, total = lines.length * size * lh, y = box.y + (box.h - total) / 2 + size * .95;
    ctx.textBaseline = 'alphabetic';
    lines.forEach(function (line) {
      var lw = line.reduce(function (a, b) { return a + b.w; }, 0) + space * (line.length - 1), x = box.x + (box.w - lw) / 2;
      line.forEach(function (wd) {
        ctx.font = (wd.hi ? 800 : weight) + ' ' + size + 'px "' + font + '", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = wd.hi ? '#C23B1A' : (o.color || INK);
        ctx.fillText(wd.t, x, y);
        x += wd.w + space;
      });
      y += size * lh;
    });
  }
  function drawPage(book, p, num) {
    var c = document.createElement('canvas'); c.width = PX; c.height = PX;
    var ctx = c.getContext('2d'), st = book.story, hero = book.hero, h = hero || LH.GENERIC, name = h.name;
    if (p.kind === 'cover') {
      paper(ctx, st.color);
      return svgImage(LH.sceneSvg(st.key, 'cover', hero, { w: 1360, clip: 'pdf' })).then(function (img) {
        framed(ctx, img, 80, 80, 1340, 938, 46);
        ctx.fillStyle = INK; rrect(ctx, 92, 1092, 1340, 330, 40); ctx.fill();
        ctx.fillStyle = '#FFF8EC'; rrect(ctx, 80, 1080, 1340, 330, 40); ctx.fill();
        ctx.lineWidth = 7; ctx.strokeStyle = INK; rrect(ctx, 80, 1080, 1340, 330, 40); ctx.stroke();
        textBlock(ctx, LH.title(st, hero), null, { x: 130, y: 1100, w: 1240, h: 220 }, { font: 'Baloo 2', weight: 800, size: 104, lh: 1.02 });
        ctx.font = '800 34px Nunito, Arial, sans-serif'; ctx.fillStyle = '#C23B1A'; ctx.textAlign = 'center';
        ctx.fillText('A  L I T T L E   H E R O   B O O K', 750, 1376); ctx.textAlign = 'left';
        return c;
      });
    }
    if (p.kind === 'dedication') {
      paper(ctx);
      var face = hero ? LH.avatarSvg(hero.look, { crop: 'head', mood: 'laugh', bg: '#FFC93C' }) : LH.avatarSvg(null, { crop: 'head', ghost: true, bg: '#FFC93C' });
      return svgImage(face.replace('<svg ', '<svg width="640" height="640" ')).then(function (img) {
        ctx.save(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(762, 452, 320, 0, 7); ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(750, 440, 320, 0, 7); ctx.clip(); ctx.drawImage(img, 430, 120, 640, 640); ctx.restore();
        ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(750, 440, 320, 0, 7); ctx.stroke();
        ctx.textAlign = 'center'; ctx.font = '800 40px Nunito, Arial, sans-serif'; ctx.fillStyle = '#C23B1A';
        ctx.fillText('T H I S   B O O K   B E L O N G S   T O', 750, 880);
        ctx.font = '800 130px "Baloo 2", Arial, sans-serif'; ctx.fillStyle = INK; ctx.fillText(name, 750, 1020); ctx.textAlign = 'left';
        textBlock(ctx, LH.dedication(book), null, { x: 200, y: 1080, w: 1100, h: 300 }, { size: 52 });
        return c;
      });
    }
    if (p.kind === 'end') {
      paper(ctx);
      var fig = hero ? LH.avatarSvg(hero.look, { pose: 'wave', mood: 'laugh' }) : LH.avatarSvg(null, { ghost: true });
      return svgImage(fig.replace('<svg ', '<svg width="520" height="565" ')).then(function (img) {
        ctx.drawImage(img, 490, 120, 520, 565);
        ctx.textAlign = 'center'; ctx.font = '800 170px "Baloo 2", Arial, sans-serif'; ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
        ctx.strokeText('The End', 750, 900); ctx.fillStyle = '#EF5A36'; ctx.fillText('The End', 750, 900); ctx.textAlign = 'left';
        textBlock(ctx, st.source, null, { x: 220, y: 980, w: 1060, h: 200 }, { size: 38, weight: 600, color: '#5D5680' });
        textBlock(ctx, LH.madeLine(book), null, { x: 220, y: 1190, w: 1060, h: 120 }, { size: 36, weight: 700, color: '#5D5680' });
        return c;
      });
    }
    paper(ctx);
    return svgImage(LH.sceneSvg(st.key, p.i, hero, { w: 1340, clip: 'pdf' })).then(function (img) {
      framed(ctx, img, 80, 70, 1340, 938, 46);
      textBlock(ctx, LH.fill(st.text[p.i], hero), hero ? name : null, { x: 110, y: 1052, w: 1280, h: 360 }, { size: 54 });
      ctx.fillStyle = '#FFC93C'; ctx.beginPath(); ctx.arc(750, 1452, 30, 0, 7); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.font = '800 32px Nunito, Arial, sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(String(p.i + 1), 750, 1464); ctx.textAlign = 'left';
      return c;
    });
  }
  function jpeg(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (b) { b.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); }); }, 'image/jpeg', .9);
    });
  }
  /* A minimal PDF: one JPEG (DCTDecode) image per square page. */
  LH.writePdf = function (images, title) {
    var size = 576, chunks = [], len = 0, offsets = [];
    function bytes(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
    function add(x) { var b = typeof x === 'string' ? bytes(x) : x; chunks.push(b); len += b.length; }
    function obj(n, s) { offsets[n] = len; add(n + ' 0 obj\n' + s + '\nendobj\n'); }
    var n = images.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((4 + i * 3) + ' 0 R');
    add('%PDF-1.4\n%âãÏÓ\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    var safeTitle = String(title || 'Little Hero Book').replace(/[^\x20-\x7e]/g, '').replace(/([()\\])/g, '\\$1');
    obj(3, '<< /Title (' + safeTitle + ') /Creator (Little Hero Books) /Producer (Little Hero Books) >>');
    images.forEach(function (im, i) {
      var pg = 4 + i * 3, ct = pg + 1, ix = pg + 2, content = 'q ' + size + ' 0 0 ' + size + ' 0 0 cm /Im0 Do Q';
      obj(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + size + ' ' + size + '] /Resources << /XObject << /Im0 ' + ix + ' 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ' + ct + ' 0 R >>');
      obj(ct, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      offsets[ix] = len;
      add(ix + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.data.length + ' >>\nstream\n');
      add(im.data); add('\nendstream\nendobj\n');
    });
    var total = 4 + n * 3, xref = len, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var k = 1; k < total; k++) x += ('0000000000' + offsets[k]).slice(-10) + ' 00000 n \n';
    add(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  };
  LH.makePdf = function (book, progress) {
    var pages = LH.bookPages(book), out = [];
    var fonts = document.fonts && document.fonts.load ? Promise.all(['800 60px "Baloo 2"', '700 50px Nunito', '800 50px Nunito', '600 40px Nunito'].map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve();
    var chain = fonts;
    pages.forEach(function (p, i) {
      chain = chain.then(function () {
        if (progress) progress(i, pages.length);
        return drawPage(book, p, i).then(jpeg).then(function (data) { out.push({ data: data, w: PX, h: PX }); });
      });
    });
    return chain.then(function () { if (progress) progress(pages.length, pages.length); return LH.writePdf(out, LH.title(book.story, book.hero)); });
  };
  LH.drawPdfPage = drawPage;  // used by the flow test
  LH.fileName = function (book) { return LH.title(book.story, book.hero).replace(/[\\/:*?"<>|’']+/g, '').replace(/\s+/g, ' ').trim() + '.pdf'; };
  /* Make the PDF with a progress modal, then download it. */
  LH.downloadPdf = function (book) {
    var m = UI.modal('<h2>Printing your book…</h2><p class="muted" data-pdf-msg>Painting the cover</p><div class="lh-prog"><i data-pdf-bar></i></div>' +
      '<p class="small muted">Everything is drawn right here in your browser. Nothing is uploaded.</p>');
    var msg = m.el.querySelector('[data-pdf-msg]'), bar = m.el.querySelector('[data-pdf-bar]');
    return LH.makePdf(book, function (i, n) {
      bar.style.width = Math.round(i / n * 100) + '%';
      msg.textContent = i >= n ? 'Binding the pages…' : i === 0 ? 'Painting the cover' : 'Painting page ' + i + ' of ' + (n - 1);
    }).then(function (blob) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = LH.fileName(book); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      window.LH_LAST_PDF = blob;
      m.el.innerHTML = '<button class="ui-btn ghost icon ui-modal-x" data-close aria-label="Close">' + UI.icon('x') + '</button><h2>Your book is ready!</h2><p class="muted">' + esc(LH.fileName(book)) + ' (' + Math.max(1, Math.round(blob.size / 1048576)) + ' MB, ' + LH.bookPages(book).length +
        ' square pages) is in your downloads. Print it at home, or send it to a photo-book printer as an 8 × 8 inch book.</p><div class="ui-row end"><a class="ui-btn primary" href="' + url + '" target="_blank" rel="noopener">' + UI.icon('external') + 'Open it</a><button class="ui-btn" data-close>Done</button></div>';
      LH.confetti();
      return blob;
    }, function (e) {
      m.close(); UI.toast('The PDF could not be made: ' + (e && e.message || 'please try again.'), 'error');
    });
  };
})();

/* ===== _make.html ===== */
(function () {
  var esc = UI.esc;
  LH.heroFace = function (hero, cls) { return '<span class="' + (cls || 'face') + '">' + LH.avatarSvg(hero.look, { crop: 'head' }) + '</span>'; };
  var IDEAS = ['For {name}, our sunshine. Love, Mum & Dad', 'Happy birthday, {name}! Love from Grandma & Grandpa', 'For {name}, the bravest little hero we know.', 'Sweet dreams, {name}. We love you to the moon and back.'];

  LH.makeBookDialog = function (story, heroes, heroId) {
    if (!UI.me) { UI.after = '#library'; UI.toast('Make a free account to keep books on your shelf.'); UI.go('auth', 'signup'); return; }
    if (!heroes || !heroes.length) {
      UI.confirm({ title: 'First, make your hero', text: 'Design a cartoon look-alike of your child in the studio. It takes about a minute.', ok: 'Open the studio' }).then(function (y) { if (y) UI.go('studio', 'new'); });
      return;
    }
    var pick = heroes.filter(function (h) { return h.id === heroId; })[0] || heroes[0];
    var m = UI.modal('<h2 data-mk-title></h2><div class="mk-prev" data-mk-cover></div>' +
      (heroes.length > 1 ? '<div class="small muted" style="font-weight:800">Starring</div><div class="mk-heroes">' + heroes.map(function (h) {
        return '<button type="button" class="mk-hero" data-mk-hero="' + esc(h.id) + '">' + LH.heroFace(h) + esc(h.name) + '</button>'; }).join('') + '</div>' : '') +
      '<form data-mk-form class="ui-stack"><label class="ui-field"><span>Dedication <em>(optional, printed on the first page)</em></span><textarea name="dedication" maxlength="160" rows="3" data-mk-ded></textarea></label>' +
      '<div class="mk-chips" data-mk-chips></div><div class="ui-row end"><button type="button" class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn primary" type="submit">' + UI.icon('sparkle') + 'Make my book</button></div></form>', { wide: false });
    function draw() {
      m.el.querySelector('[data-mk-title]').textContent = LH.title(story, pick);
      m.el.querySelector('[data-mk-cover]').innerHTML = LH.coverHtml(story, pick, { sub: 'A Little Hero Book' });
      m.el.querySelectorAll('[data-mk-hero]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mk-hero') === pick.id); });
      m.el.querySelector('[data-mk-ded]').placeholder = 'For ' + pick.name + ', the hero of this story, with all our love.';
      m.el.querySelector('[data-mk-chips]').innerHTML = IDEAS.map(function (t, i) { return '<button type="button" data-mk-idea="' + i + '">' + esc(LH.fill(t, pick)) + '</button>'; }).join('');
    }
    m.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mk-hero]');
      if (b) { pick = heroes.filter(function (h) { return h.id === b.getAttribute('data-mk-hero'); })[0] || pick; draw(); return; }
      var idea = e.target.closest('[data-mk-idea]');
      if (idea) m.el.querySelector('[data-mk-ded]').value = LH.fill(IDEAS[+idea.getAttribute('data-mk-idea')], pick);
    });
    m.el.querySelector('[data-mk-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var ded = UI.formData(e.target).dedication;
      UI.busy(e.target.querySelector('[type=submit]'), UI.api('make_book', pick.id, story.key, ded)).then(function (r) {
        m.close();
        UI.toast(r.existed ? 'That book was already on your shelf. Here it is!' : 'Your book is ready!', 'ok');
        UI.go('book', r.book.id);
      });
    });
    draw();
    return m;
  };
})();

/* ===== _scenes.html ===== */
(function () {
  'use strict';
  var LH = window.LH = window.LH || {};
  var INK = '#2B2350';
  function D() { return LH.draw; }
  function P(n) { return Math.round(n * 10) / 10; }
  function circ(x, y, r, f, st, sw, ex) { return D().circ(x, y, r, f, st, sw, ex); }
  function ell(x, y, rx, ry, f, st, sw, ex) { return D().ell(x, y, rx, ry, f, st, sw, ex); }
  function path(d, f, st, sw, ex) { return D().path(d, f, st, sw, ex); }
  function blob(cs, f, st, sw) { return D().blob(cs, f, st, sw); }
  function star(x, y, r, f, st, sw) { return D().star(x, y, r, f, st, sw); }
  function rect(x, y, w, h, f, st, sw, rx) {
    return '<rect x="' + P(x) + '" y="' + P(y) + '" width="' + P(w) + '" height="' + P(h) + '"' + (rx ? ' rx="' + rx + '"' : '') + ' fill="' + f + '"' +
      (st ? ' stroke="' + st + '" stroke-width="' + (sw || 4) + '" stroke-linejoin="round"' : '') + '/>';
  }
  function g(t, inner) { return '<g transform="' + t + '">' + inner + '</g>'; }
  function at(x, y, s, inner, flip) { return g('translate(' + P(x) + ' ' + P(y) + ') scale(' + (flip ? -s : s) + ' ' + s + ')', inner); }
  function txt(x, y, size, s, fill, rot) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="' + size + '" fill="' + (fill || '#FFC93C') +
      '" stroke="' + INK + '" stroke-width="5" paint-order="stroke" stroke-linejoin="round"' + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : '') + '>' + s + '</text>';
  }
  var seed = 1;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  /* ================================================================== scenery */
  var C = { sky: '#BDE5FF', sky2: '#DDF2FF', grass: '#8ED37A', grass2: '#6CC46A', grass3: '#59B45E', dirt: '#B9875A', path: '#F2D9A6',
            wood: '#C98B4E', wood2: '#A86B3A', wall: '#FFE7C2', floor: '#E2B07A', night: '#2E2A63', night2: '#463E8C', cream: '#FFF8EC',
            red: '#EF5A36', sun: '#FFC93C', sky3: '#4EA8F5', pink: '#FF8FB8', plum: '#8A6BD8', stone: '#C9C3D9', stone2: '#A9A2C0', porridge: '#F3DDB0' };
  LH.SC = C;
  function sky(c) { return rect(0, 0, 1000, 700, c || C.sky) + ell(500, 720, 760, 330, c === C.night ? C.night2 : C.sky2, null, 0, ' opacity=".7"'); }
  function sun(x, y, r) {
    var rays = '';
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      rays += path('M' + P(x + Math.cos(a) * (r + 12)) + ' ' + P(y + Math.sin(a) * (r + 12)) + ' L' + P(x + Math.cos(a) * (r + 32)) + ' ' + P(y + Math.sin(a) * (r + 32)), 'none', '#FFB020', 8);
    }
    return rays + circ(x, y, r, C.sun, INK, 4) + path('M' + (x - 18) + ' ' + (y - 4) + ' q6 -8 12 0 M' + (x + 6) + ' ' + (y - 4) + ' q6 -8 12 0', 'none', INK, 4) +
      path('M' + (x - 14) + ' ' + (y + 12) + ' Q' + x + ' ' + (y + 26) + ' ' + (x + 14) + ' ' + (y + 12), 'none', INK, 4) + circ(x - 26, y + 10, 7, C.pink, null, 0, ' opacity=".6"') + circ(x + 26, y + 10, 7, C.pink, null, 0, ' opacity=".6"');
  }
  function moon(x, y, r) {
    return path('M' + (x + r * .3) + ' ' + (y - r) + ' A' + r + ' ' + r + ' 0 1 0 ' + (x + r * .3) + ' ' + (y + r) + ' A' + (r * .78) + ' ' + (r * .78) + ' 0 1 1 ' + (x + r * .3) + ' ' + (y - r) + 'Z', '#FFE9A8', INK, 4);
  }
  function stars(n, y1, sd) {
    seed = sd || 7; var s = '';
    for (var i = 0; i < n; i++) s += star(rnd() * 1000, 20 + rnd() * (y1 - 20), 6 + rnd() * 8, '#FFE9A8', null);
    return s;
  }
  function cloud(x, y, s, c) {
    s = s || 1;
    return blob([[x, y, 30 * s], [x + 38 * s, y - 16 * s, 40 * s], [x + 82 * s, y - 2 * s, 32 * s], [x + 44 * s, y + 10 * s, 32 * s], [x + 112 * s, y + 8 * s, 22 * s]], c || '#FFFFFF', INK, 4);
  }
  function hills(a, b, y) {
    y = y || 0;
    return path('M-10 ' + (470 + y) + ' Q240 ' + (360 + y) + ' 520 ' + (450 + y) + ' T1010 ' + (430 + y) + ' L1010 710 L-10 710Z', a || C.grass2, INK, 4) +
      path('M-10 ' + (545 + y) + ' Q300 ' + (470 + y) + ' 600 ' + (530 + y) + ' T1010 ' + (515 + y) + ' L1010 710 L-10 710Z', b || C.grass, INK, 4);
  }
  function ground(y, c) { return path('M-10 ' + y + ' Q500 ' + (y - 18) + ' 1010 ' + y + ' L1010 710 L-10 710Z', c || C.grass, INK, 4); }
  function tree(x, y, s, o) {
    o = o || {};
    var col = o.c || '#4FB65A', t = rect(x - 16 * s, y - 120 * s, 32 * s, 122 * s, C.wood2, INK, 4, 8);
    t += blob([[x, y - 190 * s, 70 * s], [x - 60 * s, y - 150 * s, 50 * s], [x + 60 * s, y - 150 * s, 52 * s], [x - 34 * s, y - 238 * s, 46 * s], [x + 36 * s, y - 232 * s, 48 * s]], col, INK, 4);
    if (o.apples) [[-30, -170], [26, -200], [50, -150], [-56, -140], [4, -240]].forEach(function (a) { t += circ(x + a[0] * s, y + a[1] * s, 9 * s, C.red, INK, 3); });
    return t;
  }
  function bush(x, y, s, c) { return blob([[x - 34 * s, y - 22 * s, 28 * s], [x, y - 38 * s, 36 * s], [x + 36 * s, y - 22 * s, 28 * s]], c || '#59B45E', INK, 4); }
  function flower(x, y, c, s) {
    s = s || 1; var f = path('M' + x + ' ' + y + ' L' + x + ' ' + (y - 34 * s), 'none', '#3E8E4E', 4);
    for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5; f += circ(x + Math.cos(a) * 9 * s, y - 34 * s + Math.sin(a) * 9 * s, 7 * s, c, INK, 2.5); }
    return f + circ(x, y - 34 * s, 6 * s, C.sun, INK, 2.5);
  }
  function flowers(n, y0, y1, sd) {
    seed = sd || 3; var s = '', cs = ['#FFFFFF', C.pink, C.sun, '#FF9A3C', '#A98BE8'];
    for (var i = 0; i < n; i++) s += flower(30 + rnd() * 940, y0 + rnd() * (y1 - y0), cs[i % cs.length], .8 + rnd() * .4);
    return s;
  }
  function grassTufts(n, y0, y1, sd) {
    seed = sd || 5; var s = '';
    for (var i = 0; i < n; i++) { var x = rnd() * 1000, y = y0 + rnd() * (y1 - y0); s += path('M' + P(x - 8) + ' ' + P(y) + ' l4 -14 l4 10 l4 -16 l4 20', 'none', '#3E8E4E', 3); }
    return s;
  }
  function house(x, y, w, h, o) {
    o = o || {};
    var wall = o.wall || '#FFD9A8', roof = o.roof || C.red, s = '';
    if (o.chimney !== false) s += rect(x + w * .66, y - h - h * .55, w * .14, h * .5, '#B5654A', INK, 4);
    s += rect(x, y - h, w, h, wall, INK, 4) + path('M' + (x - 18) + ' ' + (y - h + 4) + ' L' + (x + w / 2) + ' ' + (y - h - h * .62) + ' L' + (x + w + 18) + ' ' + (y - h + 4) + 'Z', roof, INK, 4);
    var dw = Math.min(64, w * .26), dh = Math.min(h * .62, 110);
    if (o.door !== false) s += path('M' + (x + w * .5 - dw / 2) + ' ' + y + ' L' + (x + w * .5 - dw / 2) + ' ' + (y - dh + dw / 2) + ' A' + dw / 2 + ' ' + dw / 2 + ' 0 0 1 ' + (x + w * .5 + dw / 2) + ' ' + (y - dh + dw / 2) + ' L' + (x + w * .5 + dw / 2) + ' ' + y + 'Z', o.doorC || C.red, INK, 4) + circ(x + w * .5 + dw / 4, y - dh * .45, 4, C.sun, INK, 2);
    if (o.open) s += path('M' + (x + w * .5 + dw / 2) + ' ' + y + ' L' + (x + w * .5 + dw / 2 + dw * .5) + ' ' + (y + 8) + ' L' + (x + w * .5 + dw / 2 + dw * .5) + ' ' + (y - dh * .9) + ' L' + (x + w * .5 + dw / 2) + ' ' + (y - dh + dw / 2 - 6) + 'Z', o.doorC || C.red, INK, 4) +
      path('M' + (x + w * .5 - dw / 2) + ' ' + y + ' L' + (x + w * .5 - dw / 2) + ' ' + (y - dh + dw / 2) + ' A' + dw / 2 + ' ' + dw / 2 + ' 0 0 1 ' + (x + w * .5 + dw / 2) + ' ' + (y - dh + dw / 2) + ' L' + (x + w * .5 + dw / 2) + ' ' + y + 'Z', '#5A3F2E', INK, 4);
    var ww = Math.min(54, w * .2);
    [[x + w * .2 - ww / 2, y - h * .72]].concat(w > 180 ? [[x + w * .8 - ww / 2, y - h * .72]] : []).forEach(function (p) {
      s += rect(p[0], p[1], ww, ww, o.lit ? '#FFE07A' : '#BDE5FF', INK, 4, 6) + path('M' + (p[0] + ww / 2) + ' ' + p[1] + ' v' + ww + ' M' + p[0] + ' ' + (p[1] + ww / 2) + ' h' + ww, 'none', INK, 3);
    });
    return s;
  }
  function fence(y, x0, x1, c) {
    var s = rect(x0, y - 52, x1 - x0, 12, c || '#FFFFFF', INK, 3.5) + rect(x0, y - 28, x1 - x0, 12, c || '#FFFFFF', INK, 3.5);
    for (var x = x0 + 6; x < x1 - 10; x += 46) s += path('M' + x + ' ' + y + ' L' + x + ' ' + (y - 70) + ' L' + (x + 11) + ' ' + (y - 84) + ' L' + (x + 22) + ' ' + (y - 70) + ' L' + (x + 22) + ' ' + y + 'Z', c || '#FFFFFF', INK, 3.5);
    return s;
  }
  function room(o) {
    o = o || {};
    var wall = o.wall || C.wall, fy = o.fy || 520, s = rect(0, 0, 1000, fy, wall);
    seed = o.seed || 11;
    if (o.paper !== false) for (var y = 30; y < fy - 40; y += 60) for (var x = (y / 60) % 2 ? 30 : 60; x < 1000; x += 60) s += circ(x, y, 5, o.dot || '#FFD08A', null, 0, ' opacity=".7"');
    s += rect(-5, fy, 1010, 200, o.floor || C.floor, INK, 4);
    for (var i = 1; i < 5; i++) s += path('M-5 ' + (fy + i * 38) + ' L1005 ' + (fy + i * 38), 'none', LH.shade(o.floor || C.floor, -.15), 3);
    s += rect(-5, fy - 18, 1010, 18, LH.shade(wall, -.12), INK, 4);
    if (o.window) {
      var wx = o.window[0], wy = o.window[1], ww = o.window[2] || 170, wh = o.window[3] || 150;
      s += rect(wx, wy, ww, wh, o.night ? C.night : '#BDE5FF', INK, 5, 10);
      if (o.night) s += moon(wx + ww * .66, wy + wh * .36, 22) + star(wx + ww * .25, wy + wh * .3, 8, '#FFE9A8') + star(wx + ww * .4, wy + wh * .7, 6, '#FFE9A8');
      else s += cloud(wx + 20, wy + wh * .45, .55);
      if (o.frost) s += rect(wx, wy, ww, wh, '#FFFFFF', null, 0, 10).replace('/>', ' opacity=".35"/>');
      s += path('M' + (wx + ww / 2) + ' ' + wy + ' v' + wh + ' M' + wx + ' ' + (wy + wh / 2) + ' h' + ww, 'none', INK, 4) +
        path('M' + (wx - 26) + ' ' + (wy - 14) + ' Q' + (wx + 10) + ' ' + (wy + wh / 2) + ' ' + (wx - 14) + ' ' + (wy + wh + 20) + ' L' + (wx - 40) + ' ' + (wy + wh + 20) + ' L' + (wx - 40) + ' ' + (wy - 14) + 'Z', o.curtain || C.red, INK, 4) +
        path('M' + (wx + ww + 26) + ' ' + (wy - 14) + ' Q' + (wx + ww - 10) + ' ' + (wy + wh / 2) + ' ' + (wx + ww + 14) + ' ' + (wy + wh + 20) + ' L' + (wx + ww + 40) + ' ' + (wy + wh + 20) + ' L' + (wx + ww + 40) + ' ' + (wy - 14) + 'Z', o.curtain || C.red, INK, 4) +
        rect(wx - 50, wy - 22, ww + 100, 12, C.wood2, INK, 3.5, 6);
    }
    if (o.picture) s += rect(o.picture[0], o.picture[1], 110, 86, '#FFFFFF', INK, 5, 6) + path('M' + (o.picture[0] + 12) + ' ' + (o.picture[1] + 74) + ' l30 -36 l22 22 l16 -14 l20 28z', '#6CC46A', INK, 3) + circ(o.picture[0] + 80, o.picture[1] + 26, 9, C.sun, INK, 3);
    return s;
  }
  function rain(n, sd) {
    seed = sd || 9; var s = '';
    for (var i = 0; i < n; i++) { var x = rnd() * 1060, y = rnd() * 640; s += path('M' + P(x) + ' ' + P(y) + ' l-10 26', 'none', '#9FD3FF', 5); }
    return s;
  }
  function bolt(x, y, s) { return path('M' + x + ' ' + y + ' l' + (-30 * s) + ' ' + (60 * s) + ' l' + (24 * s) + ' 0 l' + (-20 * s) + ' ' + (56 * s) + ' l' + (52 * s) + ' ' + (-76 * s) + ' l' + (-24 * s) + ' 0 l' + (20 * s) + ' ' + (-40 * s) + 'Z', C.sun, INK, 4); }
  function zzz(x, y) { return txt(x, y, 34, 'z', '#FFFFFF') + txt(x + 26, y - 30, 44, 'z', '#FFFFFF') + txt(x + 58, y - 68, 56, 'Z', '#FFFFFF'); }
  function sparkles(x, y, r, n, sd) {
    seed = sd || 13; var s = '';
    for (var i = 0; i < n; i++) { var a = rnd() * Math.PI * 2, d = r * (.4 + rnd() * .6); s += star(x + Math.cos(a) * d, y + Math.sin(a) * d, 7 + rnd() * 9, i % 2 ? '#FFFFFF' : C.sun, INK, 2.5); }
    return s;
  }
  function hearts(x, y, n) {
    var s = '';
    for (var i = 0; i < n; i++) { var hx = x + i * 46 - (n - 1) * 23, hy = y - (i % 2) * 24; s += path('M' + hx + ' ' + (hy + 14) + ' C' + (hx - 26) + ' ' + (hy - 6) + ' ' + (hx - 10) + ' ' + (hy - 24) + ' ' + hx + ' ' + (hy - 10) + ' C' + (hx + 10) + ' ' + (hy - 24) + ' ' + (hx + 26) + ' ' + (hy - 6) + ' ' + hx + ' ' + (hy + 14) + 'Z', C.pink, INK, 3.5); }
    return s;
  }
  function steam(x, y) { return path('M' + x + ' ' + y + ' q-12 -16 0 -32 q12 -16 0 -32 M' + (x + 22) + ' ' + (y - 4) + ' q-12 -16 0 -32 q12 -16 0 -32', 'none', '#FFFFFF', 6, ' opacity=".9"'); }
  function bunting(y, x0, x1) {
    var cs = [C.red, C.sun, '#3DBE8B', C.sky3, C.plum], s = path('M' + x0 + ' ' + y + ' Q' + ((x0 + x1) / 2) + ' ' + (y + 50) + ' ' + x1 + ' ' + y, 'none', INK, 3);
    for (var i = 0; i < 12; i++) {
      var t = (i + .5) / 12, x = x0 + (x1 - x0) * t, yy = y + 50 * 4 * t * (1 - t) * .5 + 2;
      s += path('M' + P(x - 18) + ' ' + P(yy) + ' L' + P(x + 18) + ' ' + P(yy) + ' L' + P(x) + ' ' + P(yy + 34) + 'Z', cs[i % 5], INK, 3);
    }
    return s;
  }

  /* ================================================================== furniture + things */
  function table(x, y, w, c) {
    c = c || C.wood;
    return rect(x - w / 2 + 16, y - 96, 18, 96, LH.shade(c, -.15), INK, 4) + rect(x + w / 2 - 34, y - 96, 18, 96, LH.shade(c, -.15), INK, 4) + rect(x - w / 2, y - 118, w, 26, c, INK, 4, 8);
  }
  function bowl(x, y, s, c, o) {
    o = o || {};
    var b = (o.full !== false ? ell(x, y - 30 * s, 50 * s, 12 * s, C.porridge, INK, 3.5) : '') +
      path('M' + (x - 54 * s) + ' ' + (y - 32 * s) + ' Q' + (x - 50 * s) + ' ' + y + ' ' + x + ' ' + y + ' Q' + (x + 50 * s) + ' ' + y + ' ' + (x + 54 * s) + ' ' + (y - 32 * s) + 'Z', c || C.sky3, INK, 4);
    if (o.full === false) b = ell(x, y - 31 * s, 52 * s, 9 * s, '#FFFFFF', INK, 3.5) + b;
    if (o.steam) b += steam(x - 10 * s, y - 46 * s);
    if (o.spoon) b += path('M' + (x + 20 * s) + ' ' + (y - 30 * s) + ' L' + (x + 54 * s) + ' ' + (y - 84 * s), 'none', INK, 9) + path('M' + (x + 20 * s) + ' ' + (y - 30 * s) + ' L' + (x + 54 * s) + ' ' + (y - 84 * s), 'none', '#C9C3D9', 5);
    return b;
  }
  function chair(x, y, s, c, broken) {
    c = c || C.wood;
    if (broken) return at(x, y, s, rect(-60, -24, 54, 18, c, INK, 4, 4).replace('<rect', '<rect transform="rotate(-14)"') + rect(10, -14, 16, 60, c, INK, 4, 4).replace('<rect', '<rect transform="rotate(64 18 16)"') +
      rect(-20, -60, 16, 64, c, INK, 4, 4).replace('<rect', '<rect transform="rotate(-38 -12 -28)"') + rect(30, -40, 60, 16, c, INK, 4, 4).replace('<rect', '<rect transform="rotate(22 60 -32)"') + txt(0, -110, 58, 'CRACK!', C.sun, -8));
    return at(x, y, s, rect(-48, -170, 16, 170, c, INK, 4, 6) + rect(32, -170, 16, 170, c, INK, 4, 6) + rect(-48, -168, 96, 18, c, INK, 4, 6) + rect(-48, -130, 96, 14, c, INK, 4, 6) +
      rect(-60, -86, 120, 22, LH.shade(c, .15), INK, 4, 6) + rect(-56, -66, 16, 66, c, INK, 4, 6) + rect(40, -66, 16, 66, c, INK, 4, 6));
  }
  function bed(x, y, w, h, c, quilt, o) {
    o = o || {};
    var s = rect(x - w / 2 - 14, y - h - 70, 24, h + 70, c, INK, 4, 8) + rect(x + w / 2 - 10, y - h - 20, 24, h + 20, c, INK, 4, 8) +
      rect(x - w / 2, y - h, w, h * .55, '#FFFFFF', INK, 4, 10) + ell(x - w / 2 + 50, y - h - 4, 40, 20, '#FFFFFF', INK, 4);
    if (!o.noQuilt) s += quiltOf(x, y, w, h, quilt);
    return s;
  }
  function quiltOf(x, y, w, h, quilt) {
    var s = path('M' + (x - w / 2 + 70) + ' ' + (y - h - 10) + ' L' + (x + w / 2 + 6) + ' ' + (y - h - 10) + ' L' + (x + w / 2 + 6) + ' ' + (y - h * .3) + ' L' + (x - w / 2 + 64) + ' ' + (y - h * .3) + 'Z', quilt, INK, 4);
    for (var i = 1; i < 4; i++) s += path('M' + P(x - w / 2 + 70 + (w - 64) * i / 4) + ' ' + (y - h - 8) + ' v' + P(h * .68), 'none', LH.shade(quilt, -.18), 3);
    return s;
  }
  function pot(x, y, s, o) {
    o = o || {};
    var b = path('M' + (x - 58 * s) + ' ' + (y - 70 * s) + ' Q' + (x - 66 * s) + ' ' + y + ' ' + x + ' ' + y + ' Q' + (x + 66 * s) + ' ' + y + ' ' + (x + 58 * s) + ' ' + (y - 70 * s) + 'Z', '#3A3355', INK, 4) +
      ell(x, y - 70 * s, 62 * s, 14 * s, '#4A4270', INK, 4) + path('M' + (x - 64 * s) + ' ' + (y - 60 * s) + ' q-18 6 -10 22 M' + (x + 64 * s) + ' ' + (y - 60 * s) + ' q18 6 10 22', 'none', INK, 6);
    if (o.full) b += blob([[x - 30 * s, y - 78 * s, 22 * s], [x, y - 90 * s, 28 * s], [x + 30 * s, y - 80 * s, 22 * s]], C.porridge, INK, 3.5);
    if (o.over) b += path('M' + (x - 50 * s) + ' ' + (y - 74 * s) + ' q-30 30 -16 70 q12 20 -4 30 M' + (x + 48 * s) + ' ' + (y - 74 * s) + ' q26 40 10 80', 'none', INK, 26 * s) + path('M' + (x - 50 * s) + ' ' + (y - 74 * s) + ' q-30 30 -16 70 q12 20 -4 30 M' + (x + 48 * s) + ' ' + (y - 74 * s) + ' q26 40 10 80', 'none', C.porridge, 18 * s);
    if (o.magic) b += sparkles(x, y - 80 * s, 110 * s, 7, 21);
    if (o.steam) b += steam(x - 10, y - 96 * s);
    return b;
  }
  function flood(y, sd) {
    seed = sd || 17; var s = 'M-10 ' + y;
    for (var x = 0; x <= 1040; x += 80) s += ' Q' + (x + 40) + ' ' + (y - 30 - rnd() * 20) + ' ' + (x + 80) + ' ' + y;
    s += ' L1010 710 L-10 710Z';
    var bubbles = '';
    for (var i = 0; i < 14; i++) bubbles += circ(rnd() * 1000, y + 30 + rnd() * (680 - y), 6 + rnd() * 10, '#FFF1D2', INK, 2.5);
    return path(s, C.porridge, INK, 4) + bubbles;
  }
  function turnip(x, y, s, o) {
    o = o || {};
    var leaves = '';
    [[-40, -250, -30], [0, -280, 0], [44, -250, 30], [-80, -220, -50], [84, -214, 50]].forEach(function (l) {
      leaves += path('M' + x + ' ' + (y - 150 * s) + ' Q' + (x + l[0] * s * .6) + ' ' + (y - 200 * s) + ' ' + (x + l[0] * s) + ' ' + (y + l[1] * s) + ' Q' + (x + (l[0] + l[2] * .5) * s) + ' ' + (y + (l[1] + 50) * s) + ' ' + x + ' ' + (y - 150 * s), '#4FB65A', INK, 4);
    });
    var body = path('M' + x + ' ' + (y + 40 * s) + ' C' + (x - 30 * s) + ' ' + (y + 10 * s) + ' ' + (x - 160 * s) + ' ' + (y - 20 * s) + ' ' + (x - 150 * s) + ' ' + (y - 100 * s) + ' C' + (x - 140 * s) + ' ' + (y - 170 * s) + ' ' + (x + 140 * s) + ' ' + (y - 170 * s) + ' ' + (x + 150 * s) + ' ' + (y - 100 * s) + ' C' + (x + 160 * s) + ' ' + (y - 20 * s) + ' ' + (x + 30 * s) + ' ' + (y + 10 * s) + ' ' + x + ' ' + (y + 40 * s) + 'Z', '#FFFFFF', INK, 4.5) +
      path('M' + (x - 146 * s) + ' ' + (y - 92 * s) + ' C' + (x - 140 * s) + ' ' + (y - 168 * s) + ' ' + (x + 140 * s) + ' ' + (y - 168 * s) + ' ' + (x + 146 * s) + ' ' + (y - 92 * s) + ' Q' + x + ' ' + (y - 60 * s) + ' ' + (x - 146 * s) + ' ' + (y - 92 * s) + 'Z', '#B05BC9', INK, 4) +
      path('M' + (x - 60 * s) + ' ' + (y - 30 * s) + ' q10 10 24 8 M' + (x + 40 * s) + ' ' + (y - 20 * s) + ' q10 6 22 2', 'none', '#C9C3D9', 3);
    if (o.buried) return leaves + body + path('M' + (x - 260 * s) + ' ' + (y + 60 * s) + ' Q' + (x - 230 * s) + ' ' + (y - 30 * s) + ' ' + (x - 150 * s) + ' ' + (y - 50 * s) + ' Q' + x + ' ' + (y - 74 * s) + ' ' + (x + 150 * s) + ' ' + (y - 50 * s) + ' Q' + (x + 230 * s) + ' ' + (y - 30 * s) + ' ' + (x + 260 * s) + ' ' + (y + 60 * s) + 'Z', '#A97A4E', INK, 4) + path('M' + (x - 120 * s) + ' ' + (y - 30 * s) + ' q14 -8 28 0 M' + (x + 70 * s) + ' ' + (y - 36 * s) + ' q14 -8 28 0', 'none', '#8A5F3A', 4);
    return leaves + body;
  }
  function wateringCan(x, y, s) {
    return at(x, y, s, path('M-40 0 L-36 -60 L36 -60 L40 0Z', C.sun, INK, 4) + path('M36 -46 L86 -86 L92 -78 L42 -30Z', C.sun, INK, 4) + ell(90, -84, 10, 6, C.sun, INK, 3.5) + path('M-30 -60 Q0 -100 30 -60', 'none', INK, 6));
  }
  function loom(x, y, s) {
    return at(x, y, s, rect(-90, -220, 18, 220, C.wood, INK, 4, 4) + rect(72, -220, 18, 220, C.wood, INK, 4, 4) + rect(-100, -230, 200, 20, C.wood2, INK, 4, 6) + rect(-100, -90, 200, 18, C.wood2, INK, 4, 6) +
      path('M-60 -210 v120 M-30 -210 v120 M0 -210 v120 M30 -210 v120 M60 -210 v120', 'none', '#C9C3D9', 2.5) + rect(-70, -8, 140, 14, C.wood2, INK, 3.5, 4));
  }
  function goldBag(x, y, s) {
    return at(x, y, s, path('M-34 0 Q-50 -40 -18 -58 L-24 -72 L24 -72 L18 -58 Q50 -40 34 0Z', '#D9A441', INK, 4) + path('M-20 -60 h40', 'none', INK, 5) + txt(0, -14, 30, '$', '#FFE9A8'));
  }
  function mirror(x, y, s) { return at(x, y, s, ell(0, -170, 70, 110, C.sun, INK, 5) + ell(0, -170, 54, 92, '#DDF2FF', INK, 4) + path('M-24 -230 l30 -30 M-30 -200 l50 -50', 'none', '#FFFFFF', 6) + rect(-12, -64, 24, 64, C.wood2, INK, 4)); }
  function trumpet(x, y, s, flip) { return at(x, y, s, path('M0 0 L70 -8 L70 8Z', C.sun, INK, 3.5) + path('M70 -8 L100 -26 L100 26 L70 8Z', C.sun, INK, 3.5) + txt(60, -40, 26, '♪', '#FFFFFF'), flip); }
  function flagPole(x, y, c) { return path('M' + x + ' ' + y + ' L' + x + ' ' + (y - 260), 'none', INK, 6) + path('M' + x + ' ' + (y - 256) + ' Q' + (x + 40) + ' ' + (y - 270) + ' ' + (x + 80) + ' ' + (y - 250) + ' L' + (x + 80) + ' ' + (y - 196) + ' Q' + (x + 40) + ' ' + (y - 216) + ' ' + x + ' ' + (y - 202) + 'Z', c, INK, 4); }
  function medal(x, y, s) { return at(x, y, s, path('M-14 -60 L0 -20 L14 -60', 'none', C.red, 10) + circ(0, 0, 24, C.sun, INK, 4) + star(0, 0, 13, '#FFFFFF', INK, 2.5)); }
  function beans(x, y, s) { var b = ''; [[-18, 0], [0, -12], [18, 2], [-6, 14], [12, 16]].forEach(function (p) { b += ell(x + p[0] * s, y + p[1] * s, 9 * s, 6 * s, '#5BCB6E', INK, 3); }); return b + sparkles(x, y, 50 * s, 5, 33); }
  function beanstalk(x, y0, y1, w) {
    var d = 'M' + x + ' ' + y0, s = '', n = 0;
    for (var y = y0; y > y1; y -= 120) { d += ' C' + (x + 70) + ' ' + (y - 30) + ' ' + (x - 70) + ' ' + (y - 90) + ' ' + x + ' ' + (y - 120); n++; }
    s += path(d, 'none', INK, w + 9) + path(d, 'none', '#4FB65A', w);
    for (var i = 0, yy = y0 - 50; yy > y1; yy -= 75, i++) {
      var side = i % 2 ? 1 : -1;
      s += path('M' + x + ' ' + yy + ' q' + (side * 40) + ' -30 ' + (side * 76) + ' -10 q' + (side * -26) + ' 26 ' + (side * -76) + ' 10Z', '#6CD07A', INK, 3.5);
    }
    return s;
  }
  function castle(x, y, s, o) {
    o = o || {};
    var st = o.c || C.stone, s2 = '';
    s2 += rect(-170, -200, 340, 200, st, INK, 4) + rect(-230, -300, 90, 300, st, INK, 4) + rect(140, -300, 90, 300, st, INK, 4) + rect(-60, -330, 120, 160, st, INK, 4);
    [-230, 140].forEach(function (tx) { s2 += path('M' + (tx - 10) + ' -296 L' + (tx + 45) + ' -380 L' + (tx + 100) + ' -296Z', o.roof || C.red, INK, 4) + flagPole(tx + 45, -376, C.sun).replace(/stroke-width="6"/, 'stroke-width="4"'); });
    s2 += path('M-70 -326 L0 -410 L70 -326Z', o.roof || C.red, INK, 4);
    for (var i = -170; i < 170; i += 40) s2 += rect(i, -224, 22, 26, st, INK, 4);
    s2 += path('M-46 0 L-46 -80 A46 46 0 0 1 46 -80 L46 0Z', o.gate || '#8A5A3B', INK, 4) + path('M-46 -60 h92 M-46 -30 h92 M-16 0 v-120 M16 0 v-120', 'none', LH.shade(o.gate || '#8A5A3B', -.2), 3);
    [[-185, -240], [185, -240], [0, -270]].forEach(function (w) { s2 += path('M' + (w[0] - 14) + ' ' + w[1] + ' v-20 a14 14 0 0 1 28 0 v20Z', o.lit ? '#FFE07A' : INK, INK, 3); });
    return at(x, y, s, s2);
  }
  function wheat(x, y, s) {
    var w = path('M' + x + ' ' + y + ' Q' + (x + 4 * s) + ' ' + (y - 80 * s) + ' ' + x + ' ' + (y - 150 * s), 'none', '#C9A23B', 4);
    for (var i = 0; i < 5; i++) w += ell(x - 8 * s, y - 150 * s + i * 14 * s, 6 * s, 11 * s, '#F0C24B', INK, 2.5).replace('/>', ' transform="rotate(-24 ' + P(x - 8 * s) + ' ' + P(y - 150 * s + i * 14 * s) + ')"/>') +
      ell(x + 8 * s, y - 146 * s + i * 14 * s, 6 * s, 11 * s, '#F0C24B', INK, 2.5).replace('/>', ' transform="rotate(24 ' + P(x + 8 * s) + ' ' + P(y - 146 * s + i * 14 * s) + ')"/>');
    return w;
  }
  function wheatField(x0, x1, y, s, sd) { seed = sd || 4; var w = ''; for (var x = x0; x < x1; x += 34 * s) w += wheat(x + rnd() * 10, y + rnd() * 16, s * (.9 + rnd() * .2)); return w; }
  function loaf(x, y, s) { return at(x, y, s, path('M-70 0 Q-80 -70 0 -74 Q80 -70 70 0Z', '#E0A458', INK, 4) + path('M-36 -50 q8 14 0 28 M0 -58 q8 14 0 30 M36 -50 q8 14 0 28', 'none', '#B9773A', 4) + steam(-12, -84)); }
  function oven(x, y, s, o) {
    o = o || {};
    return at(x, y, s, path('M-130 0 L-130 -150 Q0 -290 130 -150 L130 0Z', '#C96B4E', INK, 4.5) + path('M-60 0 L-60 -80 A60 60 0 0 1 60 -80 L60 0Z', o.lit ? '#FF9A3C' : '#3A2C40', INK, 4) +
      (o.lit ? blob([[-20, -24, 18], [12, -36, 22], [30, -20, 14]], '#FFC93C', INK, 3) : '') + path('M-100 -160 h30 M-40 -210 h30 M30 -200 h30 M80 -150 h30', 'none', '#A54E36', 4));
  }
  function windmill(x, y, s) {
    var b = '';
    for (var i = 0; i < 4; i++) b += '<g transform="rotate(' + (i * 90 + 20) + ')">' + rect(-14, -170, 28, 150, '#FFFFFF', INK, 4, 4) + path('M0 -170 v150', 'none', INK, 3) + '</g>';
    return at(x, y, s, path('M-70 0 L-44 -260 L44 -260 L70 0Z', '#F2D9A6', INK, 4) + path('M-54 -250 L0 -310 L54 -250Z', C.red, INK, 4) + rect(-20, -60, 40, 60, '#8A5A3B', INK, 4, 4) + g('translate(0 -260)', b + circ(0, 0, 14, C.sun, INK, 4)));
  }
  function cart(x, y, s) {
    return at(x, y, s, rect(-110, -120, 220, 70, '#C98B4E', INK, 4, 6) + blob([[-60, -130, 34], [-10, -140, 38], [44, -132, 34]], '#F2E6CF', INK, 4) +
      txt(-10, -126, 30, 'FLOUR', '#B9875A').replace('font-size="30"', 'font-size="22"') + circ(-60, -40, 36, '#8A5A3B', INK, 4) + circ(-60, -40, 8, INK) + circ(70, -40, 36, '#8A5A3B', INK, 4) + circ(70, -40, 8, INK) + path('M110 -100 L190 -80', 'none', INK, 8));
  }
  function workbench(x, y, w) {
    return rect(x - w / 2 + 14, y - 110, 22, 110, C.wood2, INK, 4) + rect(x + w / 2 - 36, y - 110, 22, 110, C.wood2, INK, 4) + rect(x - w / 2, y - 132, w, 30, C.wood, INK, 4, 6) +
      rect(x - w / 2 + 30, y - 60, w - 60, 14, C.wood2, INK, 3.5, 4);
  }
  function shoes(x, y, s, c) {
    c = c || '#C8372D';
    var one = path('M-36 0 Q-40 -30 -14 -34 L0 -50 L14 -50 Q16 -24 40 -14 Q44 0 30 0Z', c, INK, 3.5) + path('M-2 -46 l10 10 M2 -40 l8 8', 'none', '#FFFFFF', 2.5);
    return at(x - 26 * s, y, s, one) + at(x + 26 * s, y, s, one);
  }
  function shears(x, y) {
    return at(x, y, 1, circ(-10, 10, 11, 'none', INK, 9) + circ(-10, 10, 11, 'none', C.red, 5) + circ(12, 12, 11, 'none', INK, 9) + circ(12, 12, 11, 'none', C.red, 5) +
      path('M-2 0 L46 -70 L52 -64 L6 2Z', '#C9C3D9', INK, 3) + path('M4 2 L60 -56 L64 -48 L10 6Z', '#C9C3D9', INK, 3));
  }
  function leather(x, y, s) { return at(x, y, s, path('M-60 0 Q-70 -20 -50 -30 L40 -34 Q66 -20 56 0Z', '#A0623A', INK, 3.5) + path('M-40 -16 h70', 'none', '#FFFFFF', 2.5, ' stroke-dasharray="6 6"')); }
  function candle(x, y, s) {
    return at(x, y, s, ell(0, 0, 34, 10, C.sun, INK, 3.5) + rect(-12, -70, 24, 70, '#FFFFFF', INK, 3.5, 4) + path('M0 -70 v-10', 'none', INK, 3) +
      path('M0 -112 Q-14 -90 0 -80 Q14 -90 0 -112Z', '#FF9A3C', INK, 3) + circ(0, -92, 60, '#FFE07A', null, 0, ' opacity=".22"'));
  }
  function curtain(x, y, w, h, c) {
    var s = rect(x - 10, y - h - 20, w + 20, 16, C.wood2, INK, 4, 6), d = 'M' + x + ' ' + (y - h - 6);
    for (var i = 0; i <= 6; i++) d += ' L' + (x + w * i / 6) + ' ' + (y - h - 6);
    d = 'M' + x + ' ' + (y - h - 6) + ' L' + (x + w) + ' ' + (y - h - 6) + ' Q' + (x + w - 20) + ' ' + (y - h / 2) + ' ' + (x + w) + ' ' + y + ' L' + x + ' ' + y + ' Q' + (x + 20) + ' ' + (y - h / 2) + ' ' + x + ' ' + (y - h - 6) + 'Z';
    s += path(d, c || '#8A6BD8', INK, 4);
    for (i = 1; i < 5; i++) s += path('M' + (x + w * i / 5) + ' ' + (y - h) + ' Q' + (x + w * i / 5 + 10) + ' ' + (y - h / 2) + ' ' + (x + w * i / 5) + ' ' + y, 'none', LH.shade(c || '#8A6BD8', -.2), 3);
    return s;
  }
  function shelf(x, y, w, n, sd) {
    seed = sd || 19; var s = '', cs = ['#C8372D', '#4EA8F5', '#FFC93C', '#3DBE8B', '#8A6BD8', '#FF8FB8'];
    for (var r = 0; r < n; r++) {
      var yy = y + r * 90;
      s += rect(x, yy, w, 14, C.wood, INK, 4, 4);
      for (var xx = x + 40; xx < x + w - 20; xx += 80) s += shoes(xx, yy, .55, cs[Math.floor(rnd() * cs.length)]);
    }
    return s;
  }
  function tinyClothes(x, y) {
    return at(x, y, 1, path('M-70 0 L-70 -40 L-56 -50 L-40 -50 L-26 -40 L-26 0Z', C.red, INK, 3.5) + path('M-14 0 L-14 -40 L0 -50 L16 -50 L30 -40 L30 0Z', '#3DBE8B', INK, 3.5) +
      path('M44 -10 Q60 -40 76 -10Z', C.sky3, INK, 3.5) + circ(60, -36, 7, '#FFFFFF', INK, 3) + path('M88 -10 Q104 -40 120 -10Z', C.sun, INK, 3.5) + circ(104, -36, 7, '#FFFFFF', INK, 3) +
      shoes(160, 0, .4, '#8A5A3B'));
  }
  function mattresses(x, y, w, n, h) {
    var cs = [C.red, C.sun, '#3DBE8B', C.sky3, C.plum, C.pink, '#FF9A3C', '#2FA39B'], s = '';
    for (var i = 0; i < n; i++) {
      var yy = y - (i + 1) * h, off = ((i * 7) % 5 - 2) * 6;
      s += rect(x - w / 2 + off, yy, w, h, cs[i % cs.length], INK, 3.5, h / 2.4);
      if (i % 2) s += path('M' + (x - w / 2 + off + 20) + ' ' + (yy + h / 2) + ' h' + (w - 40), 'none', '#FFFFFF', 2.5, ' stroke-dasharray="4 10" opacity=".8"');
    }
    return s;
  }
  function pea(x, y, r) { return circ(x, y, r, '#6CD07A', INK, 3.5) + circ(x - r * .35, y - r * .35, r * .28, '#FFFFFF', null, 0, ' opacity=".8"'); }
  function ladder(x, y, h, lean) {
    var s = path('M' + x + ' ' + y + ' L' + (x + lean) + ' ' + (y - h) + ' M' + (x + 50) + ' ' + y + ' L' + (x + 50 + lean) + ' ' + (y - h), 'none', C.wood2, 10) +
      path('M' + x + ' ' + y + ' L' + (x + lean) + ' ' + (y - h) + ' M' + (x + 50) + ' ' + y + ' L' + (x + 50 + lean) + ' ' + (y - h), 'none', INK, 3, ' opacity=".5"');
    for (var i = 1; i < h / 44; i++) { var t = i * 44 / h; s += path('M' + P(x + lean * t) + ' ' + P(y - h * t) + ' h50', 'none', C.wood, 7); }
    return s;
  }
  function fireplace(x, y, s) {
    return at(x, y, s, rect(-130, -230, 260, 230, '#C96B4E', INK, 4.5) + rect(-150, -250, 300, 26, C.wood2, INK, 4, 6) + path('M-80 0 L-80 -110 A80 80 0 0 1 80 -110 L80 0Z', '#3A2C40', INK, 4) +
      blob([[-30, -30, 26], [6, -50, 34], [36, -30, 24]], '#FF9A3C', INK, 3) + blob([[-10, -28, 14], [12, -40, 16]], '#FFC93C', INK, 2.5) + rect(-56, -14, 112, 14, C.wood2, INK, 3.5, 6));
  }
  function mug(x, y, s) { return at(x, y, s, rect(-24, -50, 48, 50, '#FF8FB8', INK, 4, 8) + path('M24 -38 q22 4 0 26', 'none', INK, 5) + steam(-10, -56)); }
  function pedestal(x, y) {
    return rect(x - 70, y - 200, 140, 200, '#F7F3EA', INK, 4) + rect(x - 90, y - 220, 180, 26, '#E9E2D2', INK, 4, 6) + rect(x - 90, y - 10, 180, 18, '#E9E2D2', INK, 4, 6) +
      pea(x, y - 236, 16) + path('M' + (x - 70) + ' ' + (y - 220) + ' L' + (x - 70) + ' ' + (y - 290) + ' A70 70 0 0 1 ' + (x + 70) + ' ' + (y - 290) + ' L' + (x + 70) + ' ' + (y - 220), 'rgba(189,229,255,.35)', INK, 4) +
      path('M' + (x - 44) + ' ' + (y - 330) + ' q20 -16 40 -10', 'none', '#FFFFFF', 6) + rect(x - 60, y - 140, 120, 50, '#FFFFFF', INK, 3, 6) + txt(x, y - 104, 26, 'THE PEA', C.sky3).replace('font-size="26"', 'font-size="22"');
  }
  function speech(x, y, w, h, s, tailX) {
    return path('M' + (x - w / 2) + ' ' + (y - h / 2) + ' Q' + (x - w / 2) + ' ' + (y - h / 2 - 18) + ' ' + (x - w / 2 + 30) + ' ' + (y - h / 2 - 18) + ' L' + (x + w / 2 - 30) + ' ' + (y - h / 2 - 18) + ' Q' + (x + w / 2) + ' ' + (y - h / 2 - 18) + ' ' + (x + w / 2) + ' ' + (y - h / 2) +
      ' L' + (x + w / 2) + ' ' + (y + h / 2) + ' Q' + (x + w / 2) + ' ' + (y + h / 2 + 18) + ' ' + (x + w / 2 - 30) + ' ' + (y + h / 2 + 18) + ' L' + (tailX + 24) + ' ' + (y + h / 2 + 18) + ' L' + tailX + ' ' + (y + h / 2 + 60) + ' L' + (tailX - 8) + ' ' + (y + h / 2 + 18) +
      ' L' + (x - w / 2 + 30) + ' ' + (y + h / 2 + 18) + ' Q' + (x - w / 2) + ' ' + (y + h / 2 + 18) + ' ' + (x - w / 2) + ' ' + (y + h / 2) + 'Z', '#FFFFFF', INK, 4) + txt(x, y + 14, 40, s, C.red);
  }
  function blanket(x, y, w, h, c) { return path('M' + x + ' ' + y + ' Q' + (x + w / 2) + ' ' + (y - 26) + ' ' + (x + w) + ' ' + y + ' L' + (x + w + 6) + ' ' + (y + h) + ' L' + (x - 6) + ' ' + (y + h) + 'Z', c, INK, 4) + path('M' + (x + 10) + ' ' + (y + 18) + ' Q' + (x + w / 2) + ' ' + (y - 6) + ' ' + (x + w - 10) + ' ' + (y + 18), 'none', '#FFFFFF', 4, ' opacity=".7" stroke-dasharray="3 12"'); }

  /* ================================================================== animals */
  function bear(x, y, s, o) {
    o = o || {};
    var f = o.fur || '#8A5A3B', lt = LH.shade(f, .35), b = '';
    b += ell(-34, -18, 30, 22, f, INK, 4) + ell(34, -18, 30, 22, f, INK, 4) + ell(0, -112, 80, 98, f, INK, 4.5) + ell(0, -100, 50, 64, lt);
    var armL = o.wave ? 'M-64 -160 Q-110 -200 -100 -250' : 'M-64 -160 Q-96 -130 -86 -92', armR = o.walk ? 'M64 -160 Q100 -130 96 -96' : 'M64 -160 Q96 -130 86 -92';
    if (o.hold) armL = armR = null;
    [armL, armR].forEach(function (d) { if (d) b += path(d, 'none', INK, 40) + path(d, 'none', f, 32); });
    if (o.hold) b += path('M-64 -160 Q-70 -110 -24 -110', 'none', INK, 38) + path('M-64 -160 Q-70 -110 -24 -110', 'none', f, 30) + path('M64 -160 Q70 -110 24 -110', 'none', INK, 38) + path('M64 -160 Q70 -110 24 -110', 'none', f, 30);
    if (o.apron) b += path('M-44 -168 L44 -168 L56 -40 Q0 -26 -56 -40Z', o.apron, INK, 4) + path('M-30 -110 h60', 'none', '#FFFFFF', 3, ' stroke-dasharray="5 7"');
    b += circ(-52, -290, 24, f, INK, 4) + circ(52, -290, 24, f, INK, 4) + circ(-52, -290, 12, lt) + circ(52, -290, 12, lt) + circ(0, -232, 72, f, INK, 4.5) + ell(0, -212, 34, 25, lt, INK, 3.5) + ell(0, -224, 13, 9, INK);
    if (o.mood === 'wow') b += ell(0, -198, 8, 10, '#7A2638', INK, 3); else if (o.mood === 'sad') b += path('M-12 -194 Q0 -204 12 -194', 'none', INK, 4); else b += path('M-14 -206 Q0 -192 14 -206', 'none', INK, 4);
    if (o.mood === 'sleep') b += path('M-36 -250 q10 8 20 0 M16 -250 q10 8 20 0', 'none', INK, 4);
    else b += circ(-28, -252, 8, INK) + circ(28, -252, 8, INK) + circ(-25, -255, 3, '#FFFFFF') + circ(31, -255, 3, '#FFFFFF');
    b += circ(-48, -222, 10, C.pink, null, 0, ' opacity=".5"') + circ(48, -222, 10, C.pink, null, 0, ' opacity=".5"');
    if (o.tie) b += path('M0 -164 L-26 -178 L-26 -150Z M0 -164 L26 -178 L26 -150Z', o.tie, INK, 3.5) + circ(0, -164, 6, o.tie, INK, 3);
    if (o.hat) b += rect(-40, -330, 80, 16, INK, INK, 3, 4) + rect(-26, -380, 52, 54, INK, INK, 3, 6) + rect(-26, -346, 52, 10, C.red);
    if (o.flower) b += g('translate(48 -300)', [0, 72, 144, 216, 288].map(function (a) { return '<ellipse cx="0" cy="-12" rx="7" ry="11" fill="#FFFFFF" stroke="' + INK + '" stroke-width="3" transform="rotate(' + a + ')"/>'; }).join('') + circ(0, 0, 7, C.sun, INK, 3));
    return at(x, y, s, b, o.flip);
  }
  function dog(x, y, s, o) {
    o = o || {};
    var f = o.c || '#D09A5C', b = path('M30 -40 Q80 -60 70 -100', 'none', INK, 16) + path('M30 -40 Q80 -60 70 -100', 'none', f, 9) + ell(0, -60, 46, 58, f, INK, 4) + ell(0, -46, 28, 34, '#FFF1DE') +
      rect(-30, -50, 18, 50, f, INK, 4, 9) + rect(12, -50, 18, 50, f, INK, 4, 9) + circ(0, -136, 46, f, INK, 4) + ell(-44, -130, 16, 32, '#8A5A3B', INK, 4).replace('/>', ' transform="rotate(18 -44 -130)"/>') +
      ell(44, -130, 16, 32, '#8A5A3B', INK, 4).replace('/>', ' transform="rotate(-18 44 -130)"/>') + circ(-18, -112, 0.1, f) + ell(0, -118, 24, 18, '#FFF1DE', INK, 3) + ell(0, -128, 10, 7, INK) +
      circ(-17, -150, 6, INK) + circ(17, -150, 6, INK) + circ(-15, -152, 2.2, '#FFFFFF') + circ(19, -152, 2.2, '#FFFFFF') + ell(-28, -170, 12, 9, '#8A5A3B').replace('/>', ' opacity=".7"/>');
    if (o.mood === 'sleep') b = b.replace(/<circle cx="-17" cy="-150"[^>]*>/, '') + path('M-26 -150 q8 6 16 0 M10 -150 q8 6 16 0', 'none', INK, 3.5);
    if (o.tongue !== false) b += path('M-4 -112 q4 16 10 0Z', '#FF7F8E', INK, 2.5);
    if (o.swim) b = b.split('<rect')[0] + b.slice(b.indexOf('circle cx="0" cy="-136"') - 1);
    return at(x, y, s, b, o.flip);
  }
  function cat(x, y, s, o) {
    o = o || {};
    var f = o.c || '#F0A04B', b = path('M28 -16 Q90 -10 70 -80 Q64 -100 80 -110', 'none', INK, 15) + path('M28 -16 Q90 -10 70 -80 Q64 -100 80 -110', 'none', f, 8) +
      ell(0, -52, 40, 52, f, INK, 4) + ell(0, -40, 22, 30, '#FFF1DE') + ell(-18, -4, 14, 8, f, INK, 3.5) + ell(18, -4, 14, 8, f, INK, 3.5) +
      path('M-36 -140 L-30 -180 L-6 -156Z M36 -140 L30 -180 L6 -156Z', f, INK, 4) + circ(0, -126, 40, f, INK, 4) + path('M-12 -164 l4 14 M0 -166 l0 14 M12 -164 l-4 14', 'none', LH.shade(f, -.25), 4);
    if (o.mood === 'sleep') b += path('M-24 -126 q8 6 16 0 M8 -126 q8 6 16 0', 'none', INK, 3.5);
    else b += ell(-15, -128, 6, 8, '#3E8E4E', INK, 2.5) + ell(15, -128, 6, 8, '#3E8E4E', INK, 2.5) + ell(-15, -128, 2, 6, INK) + ell(15, -128, 2, 6, INK);
    b += path('M-5 -112 L5 -112 L0 -106Z', C.pink, INK, 2) + path('M0 -106 q-6 8 -12 4 M0 -106 q6 8 12 4', 'none', INK, 2.5) + path('M-14 -110 L-50 -116 M-14 -106 L-50 -100 M14 -110 L50 -116 M14 -106 L50 -100', 'none', INK, 2);
    return at(x, y, s, b, o.flip);
  }
  function mouse(x, y, s, o) {
    o = o || {};
    var b = path('M20 -14 Q60 -10 70 -40', 'none', '#FF8FB8', 4) + ell(0, -26, 26, 28, '#B9B4C9', INK, 3.5) + circ(-18, -78, 14, '#B9B4C9', INK, 3.5) + circ(18, -78, 14, '#B9B4C9', INK, 3.5) +
      circ(-18, -78, 7, '#FF8FB8') + circ(18, -78, 7, '#FF8FB8') + circ(0, -60, 22, '#B9B4C9', INK, 3.5) + circ(0, -50, 4, '#FF8FB8', INK, 2) + circ(-8, -64, 3.5, INK) + circ(8, -64, 3.5, INK) +
      path('M-4 -50 L-24 -54 M-4 -48 L-24 -44 M4 -50 L24 -54 M4 -48 L24 -44', 'none', INK, 1.5);
    if (o.bow) b += path('M10 -96 l-14 -8 v16Z M10 -96 l14 -8 v16Z', C.pink, INK, 2.5);
    if (o.spoon) b += path('M-20 -30 L-34 -110', 'none', INK, 7) + path('M-20 -30 L-34 -110', 'none', '#C9C3D9', 4) + ell(-35, -114, 9, 12, '#C9C3D9', INK, 3);
    return at(x, y, s, b, o.flip);
  }
  function hen(x, y, s, o) {
    o = o || {};
    var c = o.c || '#D9462B', b = path('M-40 -60 Q-90 -110 -70 -40Z', LH.shade(c, -.15), INK, 4) + path('M-14 -2 v-18 M14 -2 v-18', 'none', '#E9A23B', 5) + path('M-24 0 h18 M4 0 h18', 'none', '#E9A23B', 5) +
      ell(0, -58, 56, 44, c, INK, 4) + path('M-24 -64 Q0 -40 26 -66 Q8 -28 -24 -64Z', LH.shade(c, -.18), INK, 3) + circ(38, -106, 26, c, INK, 4) +
      blob([[30, -136, 8], [40, -140, 9], [50, -134, 8]], '#FF3D5A', INK, 3) + path('M62 -110 L82 -102 L62 -96Z', '#FFB020', INK, 3) + path('M58 -92 q6 14 -2 18 q-6 -6 2 -18Z', '#FF3D5A', INK, 2.5) + circ(44, -112, 4.5, INK) + circ(45.5, -113.5, 1.6, '#FFFFFF');
    if (o.apron) b += path('M-18 -88 L30 -82 L34 -30 Q4 -18 -24 -30Z', '#FFFFFF', INK, 3);
    if (o.egg) b += ell(-60, -14, 18, 22, '#FFD34A', INK, 3.5) + sparkles(-60, -20, 40, 4, 41);
    return at(x, y, s, b, o.flip);
  }
  function chick(x, y, s, flip) {
    return at(x, y, s, path('M-6 0 v-10 M6 0 v-10', 'none', '#E9A23B', 4) + circ(0, -30, 24, '#FFE36B', INK, 3.5) + circ(10, -56, 16, '#FFE36B', INK, 3.5) + path('M22 -58 L34 -54 L22 -50Z', '#FF9A3C', INK, 2.5) + circ(14, -60, 3, INK) + path('M-12 -36 q-12 -6 -8 8', 'none', INK, 3), flip);
  }
  function duck(x, y, s, o) {
    o = o || {};
    var b = path('M-14 -2 v-14 M12 -2 v-14', 'none', '#FF9A3C', 6) + path('M-26 0 h20 M2 0 h20', 'none', '#FF9A3C', 6) + path('M-60 -60 Q-80 -80 -66 -40', 'none', INK, 3) +
      ell(0, -50, 56, 38, '#FFFFFF', INK, 4) + path('M-30 -56 Q0 -36 24 -58 Q6 -26 -30 -56Z', '#EDE9F5', INK, 3) + circ(36, -100, 26, '#FFFFFF', INK, 4) + path('M58 -100 Q86 -100 84 -88 Q70 -84 56 -90Z', '#FF9A3C', INK, 3);
    b += o.mood === 'sleep' ? path('M36 -106 q6 5 12 0', 'none', INK, 3) : circ(42, -106, 4.5, INK) + circ(43.5, -107.5, 1.5, '#FFFFFF');
    return at(x, y, s, b, o.flip);
  }
  function cow(x, y, s, o) {
    o = o || {};
    var b = path('M-150 -150 Q-190 -150 -186 -90', 'none', INK, 6) + rect(-130, -80, 30, 80, '#FFFFFF', INK, 4, 10) + rect(-70, -80, 30, 80, '#FFFFFF', INK, 4, 10) + rect(60, -80, 30, 80, '#FFFFFF', INK, 4, 10) + rect(110, -80, 30, 80, '#FFFFFF', INK, 4, 10) +
      rect(-160, -200, 320, 140, '#FFFFFF', INK, 4.5, 60) + blob([[-90, -160, 26], [-70, -140, 20]], INK, INK, 0) + blob([[40, -150, 30], [70, -170, 22]], '#3A3355', INK, 0) + ell(10, -66, 30, 14, '#FF8FB8', INK, 3) +
      path('M146 -230 q-10 -36 14 -40 M210 -230 q10 -36 -14 -40', 'none', INK, 8) + path('M146 -230 q-10 -36 14 -40 M210 -230 q10 -36 -14 -40', 'none', '#F2E6CF', 4) + ell(126, -210, 22, 12, '#FFFFFF', INK, 4) + ell(230, -210, 22, 12, '#FFFFFF', INK, 4) +
      ell(178, -190, 52, 56, '#FFFFFF', INK, 4.5) + ell(178, -152, 44, 28, '#FF8FB8', INK, 4) + ell(162, -152, 6, 8, LH.shade('#FF8FB8', -.3)) + ell(194, -152, 6, 8, LH.shade('#FF8FB8', -.3)) +
      circ(158, -200, 7, INK) + circ(198, -200, 7, INK) + circ(160, -202, 2.5, '#FFFFFF') + circ(200, -202, 2.5, '#FFFFFF') + path('M150 -118 q28 18 56 0', 'none', INK, 0) + circ(178, -116, 14, C.sun, INK, 3.5);
    return at(x, y, s, b, o.flip);
  }
  function sheep(x, y, s) {
    return at(x, y, s, rect(-30, -40, 14, 40, INK, INK, 2, 6) + rect(16, -40, 14, 40, INK, INK, 2, 6) + blob([[-34, -60, 28], [0, -74, 34], [34, -60, 28], [0, -48, 30]], '#FFFFFF', INK, 4) + ell(46, -80, 18, 22, '#3A3355', INK, 3) + circ(50, -84, 3, '#FFFFFF'));
  }
  function bird(x, y, s, c) { return at(x, y, s, path('M-30 0 Q-15 -20 0 0 Q15 -20 30 0', 'none', c || INK, 5)); }

  /* ================================================================== the supporting cast (looks for LH.figure) */
  LH.PEOPLE = {
    grandpa: { size: 'adult', skin: 's2', face: 'oval', hair: 'tufts', hairColor: 'white', eyes: 'dot', facial: 'moustache', outfit: 'overalls', outfitColor: 'grass', hat: 'cap', nose: 'button' },
    grandma: { size: 'adult', skin: 's2', face: 'round', hair: 'bun', hairColor: 'grey', eyes: 'dot', glasses: 'round', outfit: 'apron', outfitColor: 'pink' },
    mother: { size: 'adult', skin: 's3', face: 'oval', hair: 'bun', hairColor: 'dark', eyes: 'almond', eyeColor: 'brown', outfit: 'dress', outfitColor: 'plum' },
    oldwoman: { size: 'adult', skin: 's4', face: 'round', hair: 'none', eyes: 'smiley', outfit: 'apron', outfitColor: 'teal', hat: 'kerchief' },
    mum: { size: 'adult', skin: 's3', face: 'heart', hair: 'long', hairColor: 'auburn', eyes: 'almond', eyeColor: 'green', outfit: 'apron', outfitColor: 'sky' },
    littleman: { size: 'toddler', skin: 's2', face: 'oval', hair: 'none', facial: 'beard', hairColor: 'white', eyes: 'dot', outfit: 'suit', outfitColor: 'plum', hat: 'feather' },
    emperor: { size: 'adult', skin: 's2', face: 'chubby', hair: 'tufts', hairColor: 'brown', eyes: 'dot', facial: 'moustache', outfit: 'robe', outfitColor: 'plum', hat: 'crown' },
    emperorU: { size: 'adult', skin: 's2', face: 'chubby', hair: 'tufts', hairColor: 'brown', eyes: 'dot', facial: 'moustache', outfit: 'undies', outfitColor: 'plum', hat: 'crown' },
    trick1: { size: 'adult', skin: 's4', face: 'square', hair: 'spiky', hairColor: 'black', eyes: 'almond', facial: 'moustache', outfit: 'suit', outfitColor: 'teal' },
    trick2: { size: 'adult', skin: 's2', face: 'oval', hair: 'swoop', hairColor: 'ginger', eyes: 'almond', eyeColor: 'green', outfit: 'suit', outfitColor: 'orange' },
    minister: { size: 'adult', skin: 's5', face: 'oval', hair: 'tufts', hairColor: 'grey', eyes: 'round', glasses: 'square', outfit: 'suit', outfitColor: 'navy' },
    giant: { size: 'adult', skin: 's4', face: 'square', hair: 'curly', hairColor: 'auburn', eyes: 'round', eyeColor: 'blue', facial: 'beard', outfit: 'tunic', outfitColor: 'grass' },
    dad: { size: 'adult', skin: 's5', face: 'square', hair: 'crop', hairColor: 'dark', eyes: 'round', facial: 'beard', outfit: 'apron', outfitColor: 'teal' },
    lady: { size: 'adult', skin: 's6', face: 'oval', hair: 'bob', hairColor: 'black', eyes: 'almond', outfit: 'dress', outfitColor: 'pink', hat: 'flower' },
    elf1: { size: 'toddler', skin: 's2', face: 'round', hair: 'none', eyes: 'dot', outfit: 'tunic', outfitColor: 'green', hat: 'elfhat', mouth: 'grin' },
    elf2: { size: 'toddler', skin: 's4', face: 'chubby', hair: 'none', eyes: 'dot', outfit: 'tunic', outfitColor: 'red', hat: 'elfhat', mouth: 'smile' },
    elf1d: { size: 'toddler', skin: 's2', face: 'round', hair: 'none', eyes: 'smiley', outfit: 'hoodie', outfitColor: 'tomato', hat: 'beanie', mouth: 'giggle' },
    elf2d: { size: 'toddler', skin: 's4', face: 'chubby', hair: 'none', eyes: 'smiley', outfit: 'hoodie', outfitColor: 'grass', hat: 'beanie', mouth: 'giggle' },
    king: { size: 'adult', skin: 's3', face: 'square', hair: 'tufts', hairColor: 'white', eyes: 'dot', facial: 'beard', outfit: 'robe', outfitColor: 'red', hat: 'crown' },
    queen: { size: 'adult', skin: 's6', face: 'oval', hair: 'bun', hairColor: 'black', eyes: 'almond', eyeColor: 'brown', outfit: 'robe', outfitColor: 'plum', hat: 'crown' },
    v1: { size: 'adult', skin: 's7', hair: 'afro', hairColor: 'black', outfit: 'tee', outfitColor: 'sun' },
    v2: { size: 'adult', skin: 's2', hair: 'ponytail', hairColor: 'blonde', outfit: 'dress', outfitColor: 'grass' },
    v3: { size: 'kid', skin: 's4', hair: 'spiky', hairColor: 'dark', outfit: 'stripes', outfitColor: 'sky' },
    v4: { size: 'adult', skin: 's3', hair: 'crop', hairColor: 'ginger', facial: 'beard', outfit: 'hoodie', outfitColor: 'orange' },
    v5: { size: 'kid', skin: 's6', hair: 'puffs', hairColor: 'black', outfit: 'overalls', outfitColor: 'pink' },
    v6: { size: 'adult', skin: 's5', hair: 'long', hairColor: 'dark', outfit: 'tee', outfitColor: 'teal', glasses: 'round' }
  };
  function per(key, x, y, s, o) { o = o || {}; o.x = x; o.y = y; o.s = s; return LH.figure(LH.PEOPLE[key], o); }
  function crowd(y, s, keys, x0, step) {
    var out = '';
    keys.forEach(function (k, i) { out += per(k, x0 + i * step, y + (i % 2) * 12, s, { pose: i % 3 === 0 ? 'cheer' : i % 3 === 1 ? 'wave' : 'stand', mood: 'happy', flip: i % 2 === 1 }); });
    return out;
  }

  /* ================================================================== the stories, page by page */
  var bearsRoom = function () { return room({ wall: '#FFE2C2', floor: '#D9A26C', window: [720, 90, 170, 150], picture: [110, 100], dot: '#FFC48A' }); };
  var bearsBed = function (night) { return room({ wall: '#DCEBFF', floor: '#C9A27A', dot: '#B8D3F5', window: [430, 70, 150, 130], night: night, curtain: C.sun }); };
  var PAPA = { fur: '#7A4E30', tie: '#3DBE8B', hat: true }, MAMA = { fur: '#A9734A', apron: C.pink, flower: true }, BABY = { fur: '#C99466', tie: C.sky3 };

  var S = {};
  S.bears = {
    cover: function (h) {
      return sky() + sun(860, 110, 50) + cloud(120, 120, 1) + cloud(560, 80, .8) + hills() + tree(80, 560, 1.1) + tree(940, 560, 1) +
        house(150, 560, 220, 170, { roof: C.red, wall: '#FFD9A8' }) + flowers(14, 590, 690, 4) +
        bear(700, 640, .78, PAPA) + bear(820, 650, .68, MAMA) + bear(600, 660, .46, Object.assign({ wave: true }, BABY)) + h({ x: 470, y: 660, s: .95, pose: 'wave', mood: 'laugh' });
    },
    pages: [
      function (h) {
        return sky() + sun(150, 110, 46) + cloud(640, 90, .9) + hills() + tree(60, 580, 1.1) + tree(930, 560, 1.15, { apples: true }) +
          house(300, 560, 300, 210, { roof: C.red, wall: '#FFD9A8', doorC: C.red }) + flowers(16, 590, 690, 9) +
          bear(700, 650, .9, PAPA) + bear(560, 660, .78, Object.assign({ wave: true }, MAMA)) + bear(820, 670, .55, Object.assign({ wave: true }, BABY));
      },
      function (h) {
        return sky() + cloud(240, 100, .9) + cloud(700, 70, .7) + tree(120, 520, 1.3) + tree(340, 480, 1) + tree(860, 500, 1.2) + ground(480, C.grass2) +
          path('M380 710 Q470 600 540 520 Q600 480 700 470', 'none', C.path, 90) + flowers(18, 560, 690, 22) +
          bear(240, 580, .5, Object.assign({ walk: true, flip: true }, PAPA)) + bear(310, 590, .44, Object.assign({ walk: true, flip: true }, MAMA)) + bear(372, 598, .3, Object.assign({ walk: true, flip: true }, BABY)) +
          h({ x: 720, y: 660, s: .95, pose: 'walk', mood: 'laugh' }) + flower(800, 520, '#FFFFFF', 1.2) + path('M760 470 q20 -20 40 0', 'none', INK, 3) + txt(830, 420, 40, '♪', '#FFFFFF') + txt(880, 380, 34, '♫', '#FFFFFF');
      },
      function (h) {
        return sky() + cloud(700, 90, .8) + hills('#7CCB6E', C.grass) + tree(900, 560, 1.1) + house(160, 600, 420, 330, { open: true, roof: C.red, wall: '#FFD9A8' }) +
          path('M400 300 q30 -30 0 -60 q-30 -30 0 -60', 'none', '#FFFFFF', 8, ' opacity=".9"') + path('M440 300 q30 -30 0 -60 q-30 -30 0 -60', 'none', '#FFFFFF', 8, ' opacity=".8"') +
          flowers(10, 610, 690, 31) + h({ x: 640, y: 670, s: 1, pose: 'point', mood: 'wow', flip: true });
      },
      function (h) {
        return bearsRoom() + table(500, 640, 640) + bowl(300, 522, 1.2, C.red, { steam: true }) + bowl(470, 522, 1, '#3DBE8B') + bowl(620, 522, .8, C.sky3, { full: false, spoon: true }) +
          h({ x: 760, y: 680, s: 1, pose: 'hips', mood: 'laugh' }) + txt(650, 400, 46, 'YUM!', C.sun, -6);
      },
      function (h) {
        return bearsRoom() + chair(200, 600, 1.1, '#A86B3A') + chair(420, 610, .9, C.pink) + h({ x: 700, y: 690, s: .95, pose: 'shrug', mood: 'oops', rot: 4 }) + chair(820, 650, .8, C.sky3, true) +
          path('M600 680 l-30 10 M790 690 l40 6', 'none', INK, 4);
      },
      function (h) {
        return bearsBed() + bed(200, 640, 260, 150, '#A86B3A', C.red) + bed(470, 650, 220, 120, C.pink, '#FFC93C') + bed(780, 660, 190, 100, C.sky3, '#3DBE8B', { noQuilt: true }) +
          h({ x: 880, y: 548, s: .62, pose: 'stand', mood: 'sleep', rot: -90 }) + quiltOf(780, 660, 190, 100, '#3DBE8B') + zzz(820, 400);
      },
      function (h) {
        return bearsBed(false) + bed(820, 660, 190, 100, C.sky3, '#3DBE8B', { noQuilt: true }) + h({ x: 920, y: 548, s: .62, pose: 'stand', mood: 'sleep', rot: -90 }) + quiltOf(820, 660, 190, 100, '#3DBE8B') +
          bear(220, 690, .86, Object.assign({ mood: 'wow' }, PAPA)) + bear(380, 690, .76, Object.assign({ mood: 'wow' }, MAMA)) + bear(540, 690, .52, Object.assign({ mood: 'wow' }, BABY)) + zzz(860, 420);
      },
      function (h) {
        return bearsBed() + bed(800, 660, 220, 110, C.sky3, '#3DBE8B') + bear(220, 690, .84, PAPA) + bear(380, 690, .76, MAMA) + bear(520, 690, .5, Object.assign({ wave: true }, BABY)) +
          h({ x: 700, y: 690, s: .95, pose: 'shrug', mood: 'oops', flip: true }) + hearts(520, 300, 1);
      },
      function (h) {
        return bearsRoom() + bear(150, 620, .7, Object.assign({ hold: true }, PAPA)) + bear(850, 620, .66, Object.assign({ hold: true }, MAMA)) + table(500, 690, 700) +
          bowl(260, 572, 1, C.red, { steam: true }) + bowl(740, 572, 1, '#3DBE8B', { steam: true }) + bear(370, 600, .42, Object.assign({ wave: true }, BABY)) + h({ x: 600, y: 610, s: .78, pose: 'cheer', mood: 'laugh' }) +
          table(500, 690, 700).split('<rect').slice(3).map(function (x) { return '<rect' + x; }).join('') + bowl(400, 572, .8, C.sky3) + bowl(600, 572, .8, C.sun) + hearts(500, 160, 3);
      }
    ]
  };

  var garden = function (o) {
    o = o || {};
    return sky() + sun(870, 100, 44) + cloud(120, 90, .8) + cloud(520, 70, .7) + hills('#7CCB6E', C.grass, -20) + (o.house !== false ? house(40, 470, 200, 150, { wall: '#FFE1B0', roof: C.sky3 }) : '') +
      fence(500, 240, 1000) + path('M-10 520 Q500 500 1010 520 L1010 710 L-10 710Z', C.dirt, INK, 4) +
      path('M60 590 Q500 570 960 590 M30 650 Q500 630 990 650', 'none', LH.shade(C.dirt, -.18), 6);
  };
  S.turnip = {
    cover: function (h) {
      return garden({ house: false }) + turnip(560, 600, 1.35) + dog(860, 680, .7) + mouse(250, 690, .9, { bow: true }) + h({ x: 330, y: 690, s: .95, pose: 'cheer', mood: 'laugh' });
    },
    pages: [
      function (h) {
        return garden() + per('grandpa', 380, 640, .78, { pose: 'wave' }) + per('grandma', 520, 650, .76, { pose: 'hold' }) + h({ x: 680, y: 670, s: .9, pose: 'hold', mood: 'laugh' }) + wateringCan(640, 590, .8) +
          dog(840, 680, .62) + cat(940, 690, .58) + mouse(200, 690, .8, { bow: true }) + path('M300 600 v-20 M330 610 v-20', 'none', '#4FB65A', 6);
      },
      function (h) {
        return garden() + turnip(620, 590, 1, { buried: true }) + sparkles(620, 320, 180, 8, 77) + txt(620, 220, 56, 'GROW!', '#3DBE8B', -4) + h({ x: 300, y: 680, s: .95, pose: 'cheer', mood: 'wow' }) + wateringCan(170, 680, .7);
      },
      function (h) {
        return garden({ house: false }) + turnip(680, 600, 1.1, { buried: true }) + per('grandpa', 380, 680, .85, { pose: 'reach', mood: 'oops' }) + txt(460, 220, 48, 'HEAVE!', C.sun, -6) + bush(120, 520, 1.1);
      },
      function (h) {
        return garden({ house: false }) + turnip(760, 600, 1, { buried: true }) + per('grandpa', 520, 680, .8, { pose: 'reach', mood: 'oops' }) + per('grandma', 380, 685, .78, { pose: 'reach', mood: 'oops' }) +
          h({ x: 140, y: 690, s: .8, pose: 'walk', mood: 'wow' }) + txt(380, 200, 44, 'PULL!', C.sun, -4);
      },
      function (h) {
        return garden({ house: false }) + turnip(800, 600, .95, { buried: true }) + per('grandpa', 580, 680, .76, { pose: 'reach', mood: 'oops' }) + per('grandma', 450, 685, .74, { pose: 'reach', mood: 'oops' }) +
          h({ x: 320, y: 690, s: .8, pose: 'reach', mood: 'oops' }) + dog(120, 690, .6) + txt(170, 470, 34, '♪', '#FFFFFF');
      },
      function (h) {
        return garden({ house: false }) + turnip(840, 600, .9, { buried: true }) + per('grandpa', 640, 680, .72, { pose: 'reach', mood: 'oops' }) + per('grandma', 520, 685, .7, { pose: 'reach', mood: 'oops' }) +
          h({ x: 400, y: 690, s: .76, pose: 'reach', mood: 'oops' }) + dog(250, 690, .55, { flip: true }) + cat(120, 690, .52, { flip: true }) + path('M840 450 l20 -10 M820 440 l-20 -14', 'none', INK, 4);
      },
      function (h) {
        return garden({ house: false }) + turnip(860, 600, .88, { buried: true }) + per('grandpa', 670, 680, .7, { pose: 'reach', mood: 'oops' }) + per('grandma', 555, 685, .68, { pose: 'reach', mood: 'oops' }) +
          h({ x: 440, y: 690, s: .72, pose: 'reach', mood: 'oops' }) + dog(310, 690, .5, { flip: true }) + cat(200, 690, .48, { flip: true }) + mouse(100, 690, .7, { bow: true, flip: true }) + bush(40, 560, .9);
      },
      function (h) {
        return garden({ house: false }) + g('rotate(-12 760 420)', turnip(760, 470, .9)) + txt(620, 200, 90, 'POP!', C.sun, -8) +
          per('grandpa', 600, 690, .66, { pose: 'cheer', mood: 'laugh', rot: -30 }) + per('grandma', 470, 700, .64, { pose: 'cheer', mood: 'laugh', rot: 20 }) +
          h({ x: 320, y: 690, s: .8, pose: 'cheer', mood: 'laugh' }) + dog(190, 690, .5, { flip: true }) + cat(90, 680, .46, { flip: true }) + mouse(900, 690, .7, { bow: true }) + sparkles(320, 300, 120, 6, 88);
      },
      function (h) {
        return room({ wall: '#FFEFD0', floor: '#D9A26C', window: [80, 90, 170, 140], night: true, picture: [800, 100] }) + table(500, 690, 760) + pot(500, 572, 1.3, { steam: true }) +
          per('grandpa', 170, 690, .62, { pose: 'hold', mood: 'laugh' }) + per('grandma', 830, 690, .62, { pose: 'hold', mood: 'laugh' }) + h({ x: 320, y: 690, s: .72, pose: 'cheer', mood: 'laugh' }) +
          table(500, 690, 760).split('<rect').slice(3).map(function (x) { return '<rect' + x; }).join('') + bowl(330, 568, .7, C.sky3) + bowl(670, 568, .7, C.red) + mouse(600, 572, .7, { bow: true, spoon: true }) + dog(940, 700, .45) + hearts(500, 230, 3);
      }
    ]
  };

  var town = function (o) {
    o = o || {};
    return sky(o.sky) + (o.sun !== false ? sun(880, 90, 40) : '') + cloud(80, 100, .8) + house(-20, 520, 170, 210, { wall: '#FFD0B0', roof: '#8A6BD8' }) + house(170, 520, 190, 250, { wall: '#FFE7A8', roof: C.red, lit: o.lit }) +
      house(390, 520, 160, 190, { wall: '#CDEBFF', roof: '#3DBE8B' }) + house(580, 520, 200, 240, { wall: '#FFD9E6', roof: C.sky3 }) + house(810, 520, 200, 200, { wall: '#E6DCFF', roof: '#FF9A3C' }) +
      rect(-10, 520, 1020, 200, '#D9CDB8', INK, 4) + (function () { var c = ''; seed = 8; for (var i = 0; i < 40; i++) c += ell(rnd() * 1000, 540 + rnd() * 160, 16 + rnd() * 10, 7, '#C6B89F', INK, 2); return c; })();
  };
  var kitchen = function (o) { o = o || {}; return room({ wall: '#E3F4E8', floor: '#C98B4E', dot: '#BFE3CA', window: [700, 90, 160, 140], curtain: C.pink, night: o.night }); };
  S.porridge = {
    cover: function (h) { return town() + flood(600, 3) + pot(700, 600, 1.2, { over: true }) + h({ x: 380, y: 670, s: 1, pose: 'cheer', mood: 'laugh' }) + sparkles(700, 450, 120, 6, 4); },
    pages: [
      function (h) {
        return town() + per('mother', 560, 650, .8, { pose: 'hold', mood: 'oops' }) + h({ x: 400, y: 660, s: .9, pose: 'shrug', mood: 'oops' }) + txt(300, 330, 44, 'RUMBLE', '#FFFFFF', -8) + cat(820, 640, .5);
      },
      function (h) {
        return sky('#CFEAD8') + tree(80, 600, 1.4, { c: '#3E9E58' }) + tree(300, 560, 1.1, { c: '#4FB65A' }) + tree(920, 600, 1.4, { c: '#3E9E58' }) + ground(560, '#6CC46A') +
          bush(700, 620, 1, '#4FB65A') + [[670, 570], [700, 560], [730, 575], [690, 590]].map(function (b) { return circ(b[0], b[1], 8, '#8A3B9E', INK, 2.5); }).join('') +
          per('oldwoman', 620, 680, .78, { pose: 'hold', mood: 'happy', flip: true }) + pot(560, 520, .55) + h({ x: 340, y: 680, s: .9, pose: 'hold', mood: 'wow' });
      },
      function (h) {
        return sky('#CFEAD8') + tree(120, 600, 1.4, { c: '#3E9E58' }) + tree(880, 600, 1.4, { c: '#3E9E58' }) + ground(560, '#6CC46A') + per('oldwoman', 280, 680, .78, { pose: 'wave', mood: 'happy' }) +
          h({ x: 600, y: 680, s: .95, pose: 'hold', mood: 'laugh' }) + pot(600, 520, .6, { magic: true });
      },
      function (h) {
        return kitchen({ night: true }) + table(500, 690, 600) + pot(500, 572, 1, { full: true, steam: true }) + per('mother', 230, 690, .7, { pose: 'hold', mood: 'laugh' }) +
          h({ x: 780, y: 690, s: .82, pose: 'cheer', mood: 'laugh', flip: true }) + bowl(340, 572, .8, C.sky3) + bowl(660, 572, .8, C.red) + hearts(500, 240, 2);
      },
      function (h) {
        return kitchen() + table(560, 690, 500) + pot(560, 572, 1, { full: true, over: true }) + per('mother', 260, 690, .8, { pose: 'shrug', mood: 'wow' }) + txt(620, 300, 50, 'BUBBLE!', '#FFFFFF', -8) + txt(780, 230, 40, 'BLOOP', C.sun, 6);
      },
      function (h) {
        return kitchen() + table(300, 690, 400) + pot(300, 572, 1, { over: true }) + flood(560, 12) + path('M560 520 Q760 380 1010 420 L1010 560 Q800 520 560 560Z', C.porridge, INK, 4) + rect(900, 260, 100, 260, '#5A3F2E', INK, 4) + txt(640, 220, 54, 'GLOOP!', C.sun, -6);
      },
      function (h) {
        return town({ sun: false }) + flood(470, 21) + per('v1', 265, 140, .42, { pose: 'cheer', mood: 'wow' }) + per('v2', 680, 150, .42, { pose: 'shrug', mood: 'oops' }) + per('v4', 910, 214, .4, { pose: 'wave', mood: 'wow' }) +
          dog(300, 600, .5, { swim: true }) + loaf(640, 600, .9) + cat(640, 560, .45) + txt(470, 120, 48, 'OH DEAR!', '#FFFFFF', -4);
      },
      function (h) {
        return town() + flood(590, 5) + h({ x: 380, y: 690, s: 1, pose: 'cheer', mood: 'wow' }) + speech(680, 220, 420, 90, 'STOP, LITTLE POT!', 470) + pot(820, 620, .9, { full: true });
      },
      function (h) {
        return town() + flood(520, 7) + h({ x: 330, y: 700, s: .95, pose: 'hold', mood: 'laugh' }) + path('M380 520 L470 380', 'none', INK, 16) + path('M380 520 L470 380', 'none', '#C9C3D9', 10) + ell(482, 360, 26, 34, '#C9C3D9', INK, 4) +
          per('v3', 640, 690, .7, { pose: 'hold', mood: 'laugh' }) + per('v5', 820, 690, .66, { pose: 'cheer', mood: 'laugh' }) + txt(680, 250, 52, 'YUM YUM!', C.sun, -6);
      }
    ]
  };

  var palace = function () { return room({ wall: '#F1E6FF', floor: '#E9C46A', dot: '#D9C6FF', paper: true, window: [420, 70, 160, 170], curtain: '#8A6BD8' }) + rect(-5, 560, 1010, 18, '#C8372D').replace('/>', ' opacity=".9"/>'); };
  var parade = function () { return town() + bunting(60, -20, 1020) + flagPole(60, 520, C.red) + flagPole(950, 520, C.sky3); };
  S.emperor = {
    cover: function (h) { return parade() + per('emperorU', 560, 650, .82, { pose: 'hips', mood: 'happy' }) + h({ x: 230, y: 690, s: .95, pose: 'point', mood: 'laugh' }) + crowd(690, .55, ['v2', 'v4'], 820, 110) + txt(560, 140, 40, 'TA-DA!', C.sun, -6); },
    pages: [
      function (h) { return parade() + per('emperor', 480, 640, .82, { pose: 'wave', mood: 'happy' }) + trumpet(700, 380, 1) + crowd(700, .52, ['v1', 'v2', 'v6'], 760, 90) + h({ x: 180, y: 700, s: .85, pose: 'cheer', mood: 'laugh' }); },
      function (h) { return palace() + per('emperor', 260, 650, .78, { pose: 'hips' }) + per('trick1', 580, 660, .75, { pose: 'shrug', mood: 'laugh' }) + per('trick2', 760, 660, .75, { pose: 'point', mood: 'laugh', flip: true }) + sparkles(670, 260, 100, 5, 61); },
      function (h) { return palace() + loom(320, 640, 1.1) + loom(680, 640, 1.1) + per('trick1', 470, 680, .66, { pose: 'hold', mood: 'laugh' }) + per('trick2', 860, 690, .64, { pose: 'cheer', mood: 'laugh', flip: true }) + goldBag(120, 650, 1.2) + goldBag(200, 670, 1) + goldBag(160, 600, .9); },
      function (h) { return palace() + loom(560, 640, 1.2) + per('minister', 300, 670, .78, { pose: 'shrug', mood: 'oops' }) + per('trick2', 800, 680, .7, { pose: 'point', mood: 'laugh', flip: true }) + txt(300, 160, 64, '?!', C.sun) + path('M360 230 q8 10 0 18', 'none', '#9FD3FF', 6); },
      function (h) { return palace() + mirror(720, 640, 1.2) + per('emperorU', 480, 660, .78, { pose: 'hips', mood: 'laugh' }) + per('trick1', 210, 680, .7, { pose: 'hold', mood: 'laugh' }) + sparkles(480, 300, 140, 6, 3); },
      function (h) { return parade() + per('emperorU', 500, 640, .8, { pose: 'wave', mood: 'happy' }) + trumpet(200, 380, 1, true) + trumpet(820, 380, 1) + crowd(700, .5, ['v1', 'v2', 'v3'], 60, 95) + crowd(700, .5, ['v6', 'v4', 'v5'], 730, 95); },
      function (h) { return parade() + per('emperorU', 640, 640, .78, { pose: 'hips', mood: 'happy' }) + crowd(690, .46, ['v1', 'v2'], 860, 100) + h({ x: 260, y: 690, s: 1, pose: 'point', mood: 'wow' }) + txt(260, 140, 56, '!!!', C.red); },
      function (h) { return parade() + per('emperorU', 560, 640, .78, { pose: 'shrug', mood: 'laugh' }) + crowd(700, .48, ['v1', 'v6'], 760, 100) + crowd(700, .48, ['v3'], 380, 100) + h({ x: 200, y: 690, s: .95, pose: 'cheer', mood: 'laugh' }) + txt(760, 160, 46, 'HA HA!', C.sun, 8) + txt(340, 220, 40, 'HEE!', '#FFFFFF', -8); },
      function (h) { return palace() + per('emperor', 640, 660, .82, { pose: 'hold', mood: 'laugh', flip: true }) + h({ x: 320, y: 680, s: 1, pose: 'cheer', mood: 'laugh' }) + medal(320, 580, 1) + sparkles(320, 360, 140, 8, 15) + hearts(500, 140, 3); }
    ]
  };

  var cottageScene = function (o) { o = o || {}; return sky(o.night ? C.night : undefined) + (o.night ? moon(820, 110, 44) + stars(30, 380, 3) : sun(880, 100, 44) + cloud(380, 90, .8)) + hills(o.night ? '#3E6E5A' : undefined, o.night ? '#4E8A62' : undefined) + house(80, 560, 240, 180, { wall: '#FFE1B0', roof: '#A86B3A', lit: o.night }) + fence(600, 380, 1000, o.night ? '#C9C3D9' : undefined); };
  var skyHigh = function () { return rect(0, 0, 1000, 700, '#9FD8FF') + cloud(80, 160, 1.2) + cloud(700, 120, 1) + blob([[100, 640, 120], [300, 610, 140], [520, 640, 130], [740, 610, 150], [940, 640, 120]], '#FFFFFF', INK, 4); };
  S.beanstalk = {
    cover: function (h) { return rect(0, 0, 1000, 700, '#9FD8FF') + cloud(80, 140, 1) + blob([[640, 160, 90], [800, 140, 110], [940, 170, 80]], '#FFFFFF', INK, 4) + castle(800, 158, .4) + beanstalk(420, 760, -40, 34) + h({ x: 470, y: 520, s: .85, pose: 'climb', mood: 'laugh', flip: true }) + bird(200, 300, 1) + bird(260, 340, .7); },
    pages: [
      function (h) { return cottageScene() + cow(560, 660, .8) + per('mum', 300, 660, .78, { pose: 'point', mood: 'happy' }) + h({ x: 470, y: 690, s: .85, pose: 'stand', mood: 'happy' }); },
      function (h) { return sky() + sun(120, 100, 40) + hills() + path('M-10 640 Q500 590 1010 630', 'none', C.path, 70) + tree(900, 560, 1.1) + per('littleman', 640, 670, 1, { pose: 'hold', mood: 'laugh', flip: true }) + beans(590, 575, 1.2) + h({ x: 380, y: 690, s: .9, pose: 'hold', mood: 'wow' }) + cow(140, 660, .58); },
      function (h) { return cottageScene({ night: true }) + per('mum', 420, 660, .7, { pose: 'point', mood: 'oops' }) + beans(640, 600, 1.2) + path('M520 460 Q580 420 640 580', 'none', '#FFFFFF', 4, ' stroke-dasharray="6 10"') + sparkles(700, 560, 120, 8, 91); },
      function (h) { return skyHigh().split('<circle cx="100" cy="640"')[0] + beanstalk(500, 760, -40, 40) + h({ x: 550, y: 470, s: .8, pose: 'climb', mood: 'laugh', flip: true }) + bird(200, 260, 1) + bird(780, 340, .8) + bird(820, 300, .6) + cloud(-20, 560, 1.4) + cloud(760, 600, 1.2); },
      function (h) { return skyHigh() + castle(330, 610, .9) + per('giant', 760, 1000, 2.1, { pose: 'stand', mood: 'wow', flip: true }) + h({ x: 380, y: 640, s: .62, pose: 'stand', mood: 'wow' }) + txt(560, 120, 60, 'BOOM!', C.sun, -8) + txt(200, 110, 46, 'BOOM!', '#FFFFFF', 6); },
      function (h) { return skyHigh() + per('giant', 700, 1030, 1.7, { pose: 'hold', mood: 'sad' }) + ell(742, 532, 8, 12, '#9FD3FF', INK, 3) + h({ x: 280, y: 650, s: .82, pose: 'wave', mood: 'happy' }) + hearts(300, 240, 1); },
      function (h) { return skyHigh() + flower(160, 660, '#FFFFFF', 7) + flower(860, 660, C.pink, 6) + h({ x: 330, y: 660, s: .7, pose: 'shrug', mood: 'laugh' }) + per('giant', 620, 980, 1.6, { pose: 'cheer', mood: 'laugh' }) + hen(820, 660, .7, { egg: true, flip: true }) + txt(500, 110, 50, 'HO HO HO!', C.sun, -4); },
      function (h) { return skyHigh() + per('giant', 720, 980, 1.65, { pose: 'hold', mood: 'happy', flip: true }) + h({ x: 330, y: 650, s: .85, pose: 'hold', mood: 'wow' }) + ell(330, 566, 24, 30, '#FFD34A', INK, 4) + sparkles(330, 560, 70, 5, 55) + hearts(520, 200, 2); },
      function (h) { return cottageScene() + beanstalk(940, 760, -40, 30) + cow(520, 670, .7) + per('mum', 300, 660, .76, { pose: 'cheer', mood: 'laugh' }) + h({ x: 760, y: 690, s: .85, pose: 'cheer', mood: 'laugh' }) + ell(818, 476, 20, 25, '#FFD34A', INK, 4) + sparkles(818, 476, 50, 4, 66); }
    ]
  };

  var farm = function () {
    return sky() + sun(110, 100, 42) + cloud(480, 80, .8) + hills('#7CCB6E', C.grass, -10) + path('M640 470 L640 300 L760 230 L880 300 L880 470Z', '#D9462B', INK, 4) + path('M630 306 L760 220 L890 306', 'none', '#FFFFFF', 8) +
      path('M720 470 L720 380 L800 380 L800 470Z', '#FFFFFF', INK, 4) + path('M720 380 L800 470 M800 380 L720 470', 'none', INK, 4) + fence(520, -10, 600) + grassTufts(20, 560, 690, 6);
  };
  S.hen = {
    cover: function (h) { return farm() + h({ x: 460, y: 680, s: 1, pose: 'hold', mood: 'laugh' }) + loaf(460, 560, .85) + hen(680, 680, .9, { flip: true }) + chick(240, 680, .9) + chick(300, 690, .8, true); },
    pages: [
      function (h) { return farm() + hen(500, 670, .9) + cat(160, 690, .55, { mood: 'sleep' }) + dog(290, 690, .55, { mood: 'sleep', tongue: false }) + duck(880, 690, .7, { flip: true }) + h({ x: 680, y: 690, s: .85, pose: 'hold', mood: 'laugh' }) + chick(600, 690, .7) + chick(560, 680, .6, true) + zzz(200, 470); },
      function (h) { return farm() + hen(360, 680, .9, { flip: true }) + [[300, 640], [312, 630], [290, 628]].map(function (p) { return ell(p[0], p[1], 5, 8, '#F0C24B', INK, 2); }).join('') + cat(80, 690, .5, { mood: 'sleep' }) + dog(190, 700, .5, { mood: 'sleep', tongue: false }) + duck(880, 690, .66, { mood: 'sleep', flip: true }) + h({ x: 620, y: 690, s: .95, pose: 'cheer', mood: 'laugh' }) + txt(620, 140, 54, 'I WILL!', C.sun, -6); },
      function (h) { return sky() + sun(860, 100, 46) + cloud(200, 80, .8) + ground(420, '#C9A270') + path('M-10 500 Q500 480 1010 500 M-10 580 Q500 560 1010 580 M-10 660 Q500 640 1010 660', 'none', '#A07A50', 8) + wheatField(-10, 1010, 460, .8, 2) + h({ x: 520, y: 690, s: .95, pose: 'stand', mood: 'wow' }) + wheatField(-10, 1010, 700, 1.3, 9) + hen(830, 690, .6, { flip: true }); },
      function (h) { return sky() + sun(150, 100, 46) + ground(440, '#E8C670') + wheatField(-10, 1010, 520, 1, 13) + h({ x: 520, y: 690, s: .95, pose: 'hold', mood: 'laugh' }) + shears(548, 600) + hen(760, 690, .7, { flip: true }) + cat(120, 690, .45, { mood: 'sleep' }) + duck(220, 690, .5, { mood: 'sleep' }) + zzz(150, 500); },
      function (h) { return sky() + cloud(560, 80, .8) + hills() + windmill(820, 560, .95) + path('M-10 650 Q500 600 1010 640', 'none', C.path, 80) + cart(330, 660, .9) + hen(320, 520, .5) + h({ x: 560, y: 690, s: .9, pose: 'reach', mood: 'laugh', flip: true }); },
      function (h) { return room({ wall: '#FFF0DA', floor: '#C98B4E', window: [720, 80, 170, 140], curtain: '#3DBE8B' }) + table(480, 690, 560) + blob([[480, 548, 46], [440, 556, 30], [520, 556, 30]], '#F6E3C2', INK, 4) + bowl(480, 572, 1.3, C.sky3, { full: false }).replace(/<ellipse[^>]*?fill="#FFFFFF"[^>]*>/, '') + hen(250, 690, .85, { apron: true }) + h({ x: 700, y: 690, s: .9, pose: 'hold', mood: 'laugh', flip: true }) + txt(480, 260, 46, 'KNEAD!', C.sun, -6); },
      function (h) { return room({ wall: '#FFF0DA', floor: '#C98B4E', window: [60, 80, 150, 130], curtain: '#3DBE8B' }) + oven(560, 600, 1, { lit: true }) + loaf(560, 510, .75) + hen(300, 680, .8) + cat(760, 690, .5) + dog(860, 700, .52) + duck(960, 700, .5, { flip: true }) + h({ x: 160, y: 690, s: .82, pose: 'cheer', mood: 'wow' }) + path('M560 400 q60 -40 120 0 q60 40 140 0', 'none', '#FFFFFF', 6, ' opacity=".8"'); },
      function (h) { return farm() + loaf(470, 560, .7) + hen(470, 690, .85) + cat(700, 690, .55) + dog(820, 690, .55) + duck(930, 690, .6, { flip: true }) + h({ x: 260, y: 690, s: .9, pose: 'hips', mood: 'happy' }) + txt(800, 180, 42, 'WE WILL!', '#FFFFFF', 4) + txt(470, 380, 54, 'NO!', C.red); },
      function (h) { return farm() + path('M120 690 L180 590 L840 590 L900 690Z', '#EF5A36', INK, 4) + path('M200 620 h600 M180 650 h640', 'none', '#FFFFFF', 4, ' opacity=".6" stroke-dasharray="20 20"') + loaf(500, 610, .8) + hen(300, 690, .7) + cat(640, 690, .5) + dog(740, 690, .5) + duck(860, 690, .55, { flip: true }) + h({ x: 160, y: 690, s: .85, pose: 'hold', mood: 'laugh' }) + hearts(500, 160, 3); }
    ]
  };

  var shop = function (o) {
    o = o || {};
    return room({ wall: o.night ? '#5D5394' : '#FCE7D0', floor: o.night ? '#7A5A50' : '#C98B4E', dot: o.night ? '#6E64A8' : '#F7CFA6', window: [740, 70, 170, 160], night: o.night, curtain: '#2FA39B', frost: o.frost }) +
      (o.shelf !== false ? shelf(40, 150, 280, 3, 5) : '') + (o.night ? rect(0, 0, 1000, 700, '#1E1A40', null, 0).replace('/>', ' opacity=".25"/>') : '');
  };
  S.elves = {
    cover: function (h) { return shop({ night: true, shelf: false }) + workbench(560, 690, 520) + candle(780, 556, .9) + per('elf1d', 450, 560, .5, { pose: 'cheer', mood: 'laugh' }) + per('elf2d', 610, 560, .5, { pose: 'cheer', mood: 'laugh', flip: true }) + h({ x: 200, y: 690, s: .95, pose: 'hold', mood: 'laugh' }) + shoes(200, 600, .85) + sparkles(530, 300, 130, 7, 12); },
    pages: [
      function (h) { return shop() + workbench(560, 690, 480) + leather(560, 556, 1.2) + per('dad', 700, 690, .78, { pose: 'hold', mood: 'oops', flip: true }) + h({ x: 400, y: 690, s: .85, pose: 'stand', mood: 'happy' }); },
      function (h) { return shop({ night: true }) + workbench(520, 690, 460) + leather(520, 556, 1.1) + candle(320, 556, .8) + per('dad', 820, 690, .72, { pose: 'hold', mood: 'sleep' }) + h({ x: 660, y: 690, s: .85, pose: 'wave', mood: 'happy', flip: true }) + txt(540, 150, 36, 'Goodnight!', '#FFFFFF'); },
      function (h) { return shop() + workbench(500, 690, 460) + shoes(500, 556, 1.3) + sparkles(500, 470, 110, 7, 5) + per('dad', 260, 690, .76, { pose: 'shrug', mood: 'wow' }) + h({ x: 720, y: 690, s: .85, pose: 'cheer', mood: 'wow' }) + per('lady', 900, 690, .7, { pose: 'point', mood: 'happy', flip: true }); },
      function (h) { return shop() + shelf(380, 150, 300, 3, 21) + per('lady', 160, 690, .66, { pose: 'wave' }) + per('v4', 600, 690, .64, { pose: 'hold', mood: 'laugh' }) + per('v6', 860, 690, .66, { pose: 'point', flip: true }) + per('dad', 420, 700, .66, { pose: 'cheer', mood: 'laugh' }) + h({ x: 740, y: 700, s: .76, pose: 'cheer', mood: 'laugh' }); },
      function (h) { return shop({ night: true }) + workbench(620, 690, 420) + leather(560, 556, .9) + candle(780, 556, .8) + per('elf1', 560, 556, .42, { pose: 'hold', mood: 'happy' }) + per('elf2', 680, 556, .42, { pose: 'hold', mood: 'happy', flip: true }) + per('dad', 140, 690, .7, { pose: 'hold', mood: 'wow' }) + curtain(40, 690, 230, 380, '#8A6BD8').replace(/<path[^>]*fill="#8A6BD8"[^>]*>/, function (m) { return m.replace('/>', ' opacity=".55"/>'); }) + txt(620, 140, 42, 'TAP TAP TAP', C.sun) + h({ x: 330, y: 690, s: .82, pose: 'stand', mood: 'wow', flip: true }); },
      function (h) { return shop({ night: true }) + workbench(640, 690, 400) + per('elf1', 580, 556, .44, { pose: 'shrug', mood: 'sad' }) + per('elf2', 700, 556, .44, { pose: 'hold', mood: 'sad', flip: true }) + path('M560 560 l-8 -14 M720 560 l8 -14', 'none', '#9FD3FF', 4) + h({ x: 300, y: 690, s: .9, pose: 'hold', mood: 'oops' }) + txt(640, 330, 32, 'brrr...', '#FFFFFF'); },
      function (h) { return shop() + table(520, 690, 600) + tinyClothes(380, 570) + per('dad', 820, 690, .74, { pose: 'hold', mood: 'happy', flip: true }) + h({ x: 220, y: 690, s: .86, pose: 'hold', mood: 'laugh' }) + path('M180 520 q20 -30 40 -10', 'none', C.red, 4) + hearts(520, 200, 2); },
      function (h) { return shop({ night: true }) + workbench(520, 690, 480) + per('elf1d', 440, 556, .46, { pose: 'cheer', mood: 'laugh' }) + per('elf2d', 610, 556, .46, { pose: 'wave', mood: 'laugh', flip: true }) + sparkles(520, 300, 160, 9, 8) + curtain(40, 690, 210, 380, '#8A6BD8').replace(/<path[^>]*fill="#8A6BD8"[^>]*>/, function (m) { return m.replace('/>', ' opacity=".55"/>'); }) + txt(530, 140, 40, 'HOORAY!', C.sun, -4) + h({ x: 300, y: 690, s: .8, pose: 'stand', mood: 'laugh', flip: true }); },
      function (h) { return shop({ frost: true }) + path('M790 150 Q825 105 860 150Z', '#FFFFFF', '#FFFFFF', 3, ' opacity=".9"') + circ(825, 106, 9, '#FFFFFF', null, 0, ' opacity=".9"') + path('M776 156 h98', 'none', '#FFFFFF', 4, ' opacity=".9"') + h({ x: 560, y: 690, s: .95, pose: 'point', mood: 'laugh' }) + per('dad', 340, 690, .76, { pose: 'hold', mood: 'laugh' }) + workbench(160, 690, 220) + shoes(160, 556, .7, C.sky3); }
    ]
  };

  var hall = function (o) { o = o || {}; return room({ wall: o.wall || '#E8E2FF', floor: '#B89DD8', dot: '#D2C8FF', window: o.win === false ? null : [420, 70, 160, 170], night: o.night, curtain: C.red }) + rect(-5, 560, 1010, 12, C.sun).replace('/>', ' opacity=".7"/>'); };
  S.pea = {
    cover: function (h) { return hall({ win: false }) + mattresses(520, 690, 300, 13, 32) + ladder(320, 690, 420, 60) + h({ x: 540, y: 274, s: .7, pose: 'wave', mood: 'laugh' }) + pea(520, 680, 8) + per('king', 160, 690, .62, { pose: 'cheer', mood: 'laugh' }) + per('queen', 850, 690, .62, { pose: 'wave', mood: 'laugh', flip: true }); },
    pages: [
      function (h) { return sky() + sun(140, 100, 42) + cloud(560, 90, .8) + hills('#7CCB6E', C.grass, 20) + castle(560, 560, .95) + per('king', 210, 670, .6, { pose: 'wave' }) + per('queen', 860, 670, .6, { pose: 'shrug', mood: 'happy', flip: true }) + flowers(10, 600, 690, 41); },
      function (h) { return sky('#4A4A7A') + cloud(80, 110, 1, '#9AA0C0') + cloud(600, 80, 1.1, '#9AA0C0') + bolt(420, 70, 1.2) + hills('#3E6E5A', '#4E8A62', 20) + castle(560, 640, 1.05, { c: '#9C96B8', lit: true }) + rain(80, 3) + h({ x: 280, y: 690, s: .9, pose: 'shrug', mood: 'oops' }) + path('M250 690 q-20 6 -40 0 M310 690 q20 6 40 0', 'none', '#9FD3FF', 6) + txt(800, 200, 44, 'KNOCK KNOCK', '#FFFFFF', 6); },
      function (h) { return hall() + per('king', 600, 690, .72, { pose: 'hips', mood: 'happy', flip: true }) + per('queen', 800, 690, .72, { pose: 'hold', mood: 'laugh', flip: true }) + h({ x: 280, y: 690, s: .88, pose: 'wave', mood: 'oops' }) + path('M250 690 q-20 6 -40 0 M320 690 q20 6 40 0', 'none', '#9FD3FF', 6) + circ(230, 380, 6, '#9FD3FF') + circ(330, 360, 5, '#9FD3FF'); },
      function (h) { return hall({ win: false }) + fireplace(200, 600, .9) + h({ x: 380, y: 690, s: .8, pose: 'hold', mood: 'laugh' }) + mug(380, 560, .8) + mattresses(740, 690, 260, 6, 30) + per('queen', 900, 690, .6, { pose: 'point', mood: 'laugh', flip: true }) + pea(740, 520, 9) + path('M760 510 L800 470', 'none', INK, 3, ' stroke-dasharray="5 6"'); },
      function (h) { return hall({ win: false }) + mattresses(560, 690, 300, 14, 30) + ladder(360, 690, 420, 60) + h({ x: 560, y: 270, s: .66, pose: 'wave', mood: 'laugh' }) + per('king', 170, 690, .55, { pose: 'wave', mood: 'happy' }) + per('queen', 860, 690, .55, { pose: 'wave', mood: 'happy', flip: true }); },
      function (h) { return hall({ win: false, wall: '#3C3670' }) + rect(0, 0, 1000, 700, '#1E1A40', null, 0).replace('/>', ' opacity=".35"/>') + moon(860, 120, 46) + stars(16, 260, 4) + mattresses(520, 690, 300, 13, 32) + h({ x: 520, y: 270, s: .66, pose: 'shrug', mood: 'oops', rot: 10 }) + blob([[200, 160, 60], [260, 130, 50], [140, 150, 44]], '#FFFFFF', INK, 4) + sheep(210, 190, .5) + circ(320, 220, 12, '#FFFFFF', INK, 3) + circ(350, 250, 8, '#FFFFFF', INK, 3) + pea(520, 680, 8) + txt(720, 330, 40, 'POKE!', C.sun, 8); },
      function (h) { return hall() + table(560, 690, 520) + bowl(460, 572, .8, C.red, { steam: true }) + bowl(640, 572, .8, C.sky3) + per('king', 820, 690, .66, { pose: 'cheer', mood: 'wow', flip: true }) + per('queen', 380, 690, .66, { pose: 'cheer', mood: 'wow' }) + h({ x: 180, y: 690, s: .88, pose: 'shrug', mood: 'oops' }) + txt(180, 220, 44, 'YAWN!', '#FFFFFF', -6); },
      function (h) { return hall() + table(560, 690, 560) + loaf(470, 572, .7) + bowl(620, 572, .8, C.sun, { steam: true }) + ell(720, 554, 30, 18, '#FF8FB8', INK, 3) + per('queen', 820, 690, .66, { pose: 'cheer', mood: 'laugh', flip: true }) + h({ x: 260, y: 690, s: .95, pose: 'cheer', mood: 'laugh', look: { hat: 'crown' } }) + sparkles(260, 300, 130, 8, 17); },
      function (h) { return room({ wall: '#F7F3EA', floor: '#C9C3D9', dot: '#E6E0F2', window: false }) + rect(80, 90, 140, 110, '#FFFFFF', INK, 5, 6) + rect(800, 90, 140, 110, '#FFFFFF', INK, 5, 6) + crownIcon(150, 170) + crownIcon(870, 170) + pedestal(520, 690) + h({ x: 260, y: 690, s: .9, pose: 'point', mood: 'laugh' }) + per('king', 780, 690, .6, { pose: 'hold', mood: 'happy', flip: true }); }
    ]
  };
  function crownIcon(x, y) { return path('M' + (x - 40) + ' ' + y + ' L' + (x - 44) + ' ' + (y - 50) + ' L' + (x - 20) + ' ' + (y - 28) + ' L' + x + ' ' + (y - 60) + ' L' + (x + 20) + ' ' + (y - 28) + ' L' + (x + 44) + ' ' + (y - 50) + ' L' + (x + 40) + ' ' + y + 'Z', C.sun, INK, 4); }
  LH.SCENES = S;

  /* The main character, or the "your hero here" outline in the generic book. */
  function heroDrawer(hero) {
    return function (o) {
      o = Object.assign({}, o);
      if (hero && hero.look) {
        var look = o.look ? Object.assign({}, hero.look, o.look) : hero.look;
        return LH.figure(look, o);
      }
      o.ghost = true; o.mood = 'happy';
      var s = o.s || 1, r = o.rot ? 0 : 1;
      return LH.figure(null, o) + (r ? star(o.x - 110 * s, o.y - 290 * s, 16 * s, C.sun, INK, 3) + star(o.x + 120 * s, o.y - 220 * s, 12 * s, '#FFFFFF', INK, 3) + star(o.x + 90 * s, o.y - 330 * s, 9 * s, C.sun, INK, 2.5) : '');
    };
  }
  LH.sceneSvg = function (key, page, hero, o) {
    o = o || {};
    var st = S[key];
    if (!st) return '';
    var fn = page === 'cover' ? st.cover : st.pages[page];
    if (!fn) return '';
    var inner;
    try { inner = fn(heroDrawer(hero)); } catch (e) { console.error('scene', key, page, e); inner = rect(0, 0, 1000, 700, '#FFE7C2'); }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"' + (o.w ? ' width="' + o.w + '" height="' + Math.round(o.w * .7) + '"' : '') + ' class="' + (o.cls || 'lh-scene') + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<clipPath id="' + (o.clip || 'lhc') + '"><rect width="1000" height="700"/></clipPath><g clip-path="url(#' + (o.clip || 'lhc') + ')">' + inner + '</g></svg>';
  };
  LH.pageCount = function (key) { return S[key] ? S[key].pages.length : 0; };
})();

/* ===== admin.html ===== */
(function () {
  var esc = UI.esc;
  var TABS = [['overview', 'Overview', 'grid'], ['library', 'Library', 'book'], ['feedback', 'Feedback', 'inbox'], ['users', 'Users', 'users'], ['demo', 'Demo data', 'database']];

  UI.page('admin', { title: 'Admin', auth: 'admin' }, function (view, ctx) {
    var tab = TABS.some(function (t) { return t[0] === ctx.args[0]; }) ? ctx.args[0] : 'overview';
    var fbFilter = 'new';
    view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><h1>Admin</h1><p class="muted">Only admins see this page.</p></div></div>' +
      '<nav class="ui-tabs">' + TABS.map(function (t) {
        return '<a href="#admin/' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + UI.icon(t[2]) + t[1] + '</a>';
      }).join('') + '</nav><div data-body><div class="ui-skel"></div></div></div>';
    var body = view.querySelector('[data-body]');

    function overview() {
      return UI.api('admin_overview').then(function (d) {
        var stat = function (n, label, go) { return '<a class="ui-card ui-stat" href="#admin/' + go + '" style="text-decoration:none;color:inherit"><b>' + n + '</b><span>' + label + '</span></a>'; };
        body.innerHTML = '<div class="ad-stats">' + stat(d.users, 'people signed up', 'users') + stat(d.admins, UI.plural(d.admins, 'admin').replace(/^\d+ /, ''), 'users') +
          stat(d.feedback_new, 'new feedback', 'feedback') + stat(d.heroes, 'heroes designed', 'library') + stat(d.books, 'books on shelves', 'library') + stat(d.shared, 'family links on', 'library') + '</div>' +
          '<p class="muted small" style="margin-top:18px">Demo data is <b>' + esc(d.demo.state) + '</b> (' + d.demo.counts.users + ' demo people). Manage it in the Demo data tab.</p>';
      });
    }

    function feedback() {
      return UI.api('list_feedback', null).then(function (d) {
        var items = d.items.filter(function (i) { return fbFilter === 'all' || i.status === fbFilter; });
        body.innerHTML = '<div class="ui-row" style="margin-bottom:16px"><div class="ui-seg">' + [['new', 'New'], ['read', 'Read'], ['done', 'Done'], ['all', 'All']].map(function (f) {
          var n = f[0] === 'all' ? d.items.length : d.counts[f[0]];
          return '<button data-filter="' + f[0] + '" class="' + (fbFilter === f[0] ? 'on' : '') + '">' + f[1] + ' (' + n + ')</button>';
        }).join('') + '</div></div>' +
          (items.length ? '<div class="ad-fb">' + items.map(function (i) {
            var c = i.context || {};
            return '<div class="ui-item" data-id="' + esc(i.id) + '"><div class="meta"><span class="ui-badge ' + (i.kind === 'bug' ? 'bad' : i.kind === 'idea' ? 'brand' : '') + '">' + esc(i.kind_label) + '</span>' +
              '<b>' + esc(i.name) + '</b>' + (i.email ? '<a href="mailto:' + esc(i.email) + '">' + esc(i.email) + '</a>' : '') + '<span>' + esc(UI.fmtDateTime(i.created)) + '</span></div>' +
              '<p class="msg">' + esc(i.message) + '</p>' +
              '<div class="ctx">' + esc([c.page, c.screen, c.theme, c.browser].filter(Boolean).join(' · ')) + '</div>' +
              '<textarea data-note placeholder="Private note (only admins see it)">' + esc(i.note) + '</textarea>' +
              '<div class="ui-row" style="margin-top:10px">' + ['new', 'read', 'done'].map(function (s) {
                return '<button class="ui-btn sm' + (i.status === s ? ' primary' : '') + '" data-status="' + s + '">' + s[0].toUpperCase() + s.slice(1) + '</button>';
              }).join('') + '<span class="ui-spacer"></span><button class="ui-btn sm danger" data-del-fb>' + UI.icon('trash') + 'Delete</button></div></div>';
          }).join('') + '</div>'
            : '<div class="ui-empty">' + UI.icon('inbox') + '<h3>No ' + (fbFilter === 'all' ? '' : fbFilter + ' ') + 'messages</h3><p>Messages from the "Send feedback" form show up here.</p></div>');
      });
    }

    function users(query) {
      return UI.api('list_users', query || null).then(function (d) {
        body.innerHTML = '<form class="ui-row" data-search style="margin-bottom:14px"><input type="search" name="q" placeholder="Search by name or email" value="' + esc(query || '') + '" style="max-width:360px">' +
          '<button class="ui-btn" type="submit">' + UI.icon('search') + 'Search</button><span class="muted small">' + UI.plural(d.total, 'person', 'people') + '</span></form>' +
          '<table class="ad-users"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Admin</th><th>Active</th></tr></thead><tbody>' +
          d.users.map(function (u) {
            return '<tr data-id="' + esc(u.id) + '"><td><b>' + esc(u.name) + '</b></td><td class="email">' + esc(u.email) + '</td><td class="joined muted">' + esc(UI.fmtDate(u.joined)) + '</td>' +
              '<td><label class="ui-check"><input type="checkbox" data-admin' + (u.is_admin ? ' checked' : '') + '> Admin</label></td>' +
              '<td><label class="ui-check"><input type="checkbox" data-enabled' + (u.enabled ? ' checked' : '') + '> Active</label></td></tr>';
          }).join('') + '</tbody></table>';
      });
    }

    function demo() {
      return UI.api('admin_overview').then(function (d) {
        var c = d.demo.counts;
        body.innerHTML = '<div class="ui-card ui-narrow" style="margin:0"><h3>Demo data</h3>' +
          '<p class="muted">Example people and content, so the app never looks empty for the first visitors. Demo rows are flagged, so removing them never touches real data. Once removed, it stays removed until you load it again.</p>' +
          '<p>Status: <b>' + esc(d.demo.state) + '</b> · ' + Object.keys(c).map(function (k) { return c[k] + ' ' + esc(k); }).join(', ') + '</p>' +
          '<div class="ui-row"><button class="ui-btn primary" data-demo="load">' + UI.icon('refresh') + (d.demo.state === 'loaded' ? 'Reload demo data' : 'Load demo data') + '</button>' +
          '<button class="ui-btn danger" data-demo="remove">' + UI.icon('trash') + 'Remove demo data</button></div></div>';
      });
    }

    function library() {
      return UI.api('admin_library').then(function (d) {
        body.innerHTML = '<p class="muted">The eight stories (server_code/Stories.py, pictures in web/pages/_scenes.html), with how many real books each has become. Example books are not counted.</p>' +
          '<table class="ad-users"><thead><tr><th>Story</th><th>Words</th><th>Books</th><th>Reads</th></tr></thead><tbody>' + d.stories.map(function (s) {
            return '<tr><td><b>' + esc(s.plain) + '</b><div class="small muted">' + esc(s.source) + '</div></td><td>' + s.words + '</td><td>' + s.made + '</td><td>' + s.reads + '</td></tr>';
          }).join('') + '</tbody></table>';
      });
    }

    var DRAW = { overview: overview, library: library, feedback: feedback, users: users, demo: demo };

    view.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]');
      if (f) { fbFilter = f.getAttribute('data-filter'); feedback(); return; }
      var st = e.target.closest('[data-status]');
      if (st) {
        var card = st.closest('[data-id]');
        UI.api('set_feedback_status', card.getAttribute('data-id'), st.getAttribute('data-status'), card.querySelector('[data-note]').value).then(function () { UI.toast('Saved', 'ok'); feedback(); });
        return;
      }
      var del = e.target.closest('[data-del-fb]');
      if (del) {
        UI.confirm({ title: 'Delete this message?', ok: 'Delete', danger: true }).then(function (yes) {
          if (yes) UI.api('delete_feedback', del.closest('[data-id]').getAttribute('data-id')).then(feedback);
        });
        return;
      }
      var dm = e.target.closest('[data-demo]');
      if (dm) {
        var load = dm.getAttribute('data-demo') === 'load';
        UI.confirm({ title: load ? 'Load the demo data?' : 'Remove the demo data?', text: load ? 'Demo people and content are added (any old demo rows are replaced).' : 'Every demo row is deleted. Real data stays.', ok: load ? 'Load' : 'Remove', danger: !load })
          .then(function (yes) { if (yes) UI.busy(dm, UI.api(load ? 'demo_load' : 'demo_remove')).then(function () { UI.toast('Done', 'ok'); demo(); }); });
      }
    });
    view.addEventListener('change', function (e) {
      var row = e.target.closest('tr[data-id]');
      if (!row) return;
      var id = row.getAttribute('data-id'), box = e.target;
      var fn = box.hasAttribute('data-admin') ? 'set_admin' : box.hasAttribute('data-enabled') ? 'set_enabled' : null;
      if (fn) UI.api(fn, id, box.checked).then(function () { UI.toast('Saved', 'ok'); }, function (err) { box.checked = !box.checked; UI.toast(err.message, 'error'); });
    });
    view.addEventListener('submit', function (e) {
      if (e.target.matches('[data-search]')) { e.preventDefault(); users(UI.formData(e.target).q); }
    });
    return DRAW[tab]();
  });
})();

/* ===== auth.html ===== */
(function () {
  var esc = UI.esc;
  function pw(name, auto) {
    return '<div class="au-pw"><input type="password" name="' + name + '" autocomplete="' + auto + '" required minlength="8">' +
      '<button type="button" data-show>Show</button></div>';
  }
  UI.page('auth', { title: 'Sign in', auth: 'guest' }, function (view, ctx) {
    var mode = ['signup', 'reset'].indexOf(ctx.args[0]) >= 0 ? ctx.args[0] : 'login';
    function draw(msg, isErr) {
      var heading = { login: 'Welcome back', signup: 'Create your account', reset: 'Reset your password' }[mode];
      var sub = { login: 'Sign in to continue to ' + esc(UI.config.name) + '.', signup: 'It\'s free and takes a few seconds.',
        reset: 'We\'ll email you a link to choose a new password.' }[mode];
      view.innerHTML = '<div class="au-wrap"><div class="ui-card au-card">' +
        '<h1>' + heading + '</h1><p class="muted">' + sub + '</p>' +
        (mode !== 'reset' ? '<div class="ui-seg" role="tablist"><button type="button" data-mode="login" class="' + (mode === 'login' ? 'on' : '') + '">Sign in</button>' +
          '<button type="button" data-mode="signup" class="' + (mode === 'signup' ? 'on' : '') + '">Create account</button></div>' : '<div style="height:14px"></div>') +
        '<form class="ui-stack" data-form="' + mode + '" novalidate>' +
        (mode === 'signup' ? '<label class="ui-field"><span>Your name</span><input type="text" name="name" autocomplete="name" required maxlength="60"></label>' : '') +
        '<label class="ui-field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>' +
        (mode === 'login' ? '<label class="ui-field"><span>Password</span>' + pw('password', 'current-password') + '</label>' : '') +
        (mode === 'signup' ? '<label class="ui-field"><span>Password <em>(at least 8 characters)</em></span>' + pw('password', 'new-password') + '</label>' +
          (window.LegalKit ? '<div>' + LegalKit.consentField() + '</div>' : '') : '') +
        '<div data-msg role="alert"' + (msg ? ' class="' + (isErr ? 'ui-error' : 'ui-note') + '">' + esc(msg) : ' hidden>') + '</div>' +
        '<button class="ui-btn primary block" type="submit">' + { login: 'Sign in', signup: 'Create account', reset: 'Send the link' }[mode] + '</button></form>' +
        '<div class="au-links">' + (mode === 'login' ? '<a data-mode="reset">Forgot your password?</a>' : '<a data-mode="login">' + UI.icon('back') + ' Back to sign in</a>') +
        '<a href="#landing" data-go="landing">About ' + esc(UI.config.name) + '</a></div></div></div>';
      var first = view.querySelector('input');
      if (first && !msg) first.focus();
    }
    view.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]');
      if (m) { e.preventDefault(); mode = m.getAttribute('data-mode'); history.replaceState(null, '', '#auth' + (mode === 'login' ? '' : '/' + mode)); draw(); return; }
      var s = e.target.closest('[data-show]');
      if (s) { var i = s.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; s.textContent = i.type === 'password' ? 'Show' : 'Hide'; }
    });
    view.addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target, v = UI.formData(form);
      var problem = !/^\S+@\S+\.\S+$/.test(v.email || '') ? 'Please enter a valid email address.'
        : mode !== 'reset' && (v.password || '').length < (mode === 'signup' ? 8 : 1) ? (mode === 'signup' ? 'Please choose a password of at least 8 characters.' : 'Please enter your password.')
        : mode === 'signup' && (v.name || '').trim().length < 2 ? 'Please tell us your name.' : null;
      if (problem) { say(problem, true); return; }
      if (mode === 'signup' && window.LegalKit && !LegalKit.consentChecked(form)) return;  // the kit shows its own message
      UI.busy(form.querySelector('[type=submit]'), UI.auth(mode, v)).then(function (r) {
        if (mode === 'reset' || (r && !r.me)) { mode = 'login'; draw(r && r.message, false); restore({ email: v.email }); }
        else UI.toast(mode === 'signup' ? 'Welcome to ' + UI.config.name + '!' : 'Welcome back!', 'ok');
      }, function (err) { say(err.message, true); });
    });
    function say(msg, isErr) {
      var box = view.querySelector('[data-msg]');
      box.className = isErr ? 'ui-error' : 'ui-note'; box.textContent = msg; box.hidden = false;
    }
    function restore(v) {
      ['name', 'email'].forEach(function (k) { var i = view.querySelector('[name=' + k + ']'); if (i && v[k]) i.value = v[k]; });
    }
    draw();
  });
})();

/* ===== book.html ===== */
(function () {
  var esc = UI.esc;
  function asBook(story, hero, extra) { return Object.assign({ story: story, hero: hero || null, dedication: '', created: null }, extra || {}); }
  function pdfBtn(label) { return '<button class="ui-btn sm primary" data-pdf>' + UI.icon('download') + (label || 'Download PDF') + '</button>'; }
  function signupBtn() { return '<a class="ui-btn sm primary" href="#auth/signup" data-go="auth/signup">' + UI.icon('download') + 'Sign up free to download</a>'; }
  function cta(hero) {
    return '<div class="ui-card bk-cta">' + (hero && hero.look ? LH.heroFace(hero) : '<span class="face"></span>') + '<div><h3>Make one starring your child</h3><p>Design a little cartoon look-alike in a minute, then pick from eight classic tales. Free.</p></div>' +
      '<a class="ui-btn primary" href="#studio" data-go="studio">' + UI.icon('wand') + 'Start the studio</a></div>';
  }

  function familyLink(book, onChange) {
    var m = UI.modal('<h2>Family link</h2><div data-fl></div>');
    function draw() {
      var url = book.share_key ? location.href.split('#')[0] + '#read/' + book.share_key : '';
      m.el.querySelector('[data-fl]').innerHTML = '<p class="muted">Send grandparents, aunts and uncles a link to <b>' + esc(LH.title(book.story, book.hero)) + '</b>. They can read it and download the PDF without an account. ' +
        'They see ' + esc(book.hero.name) + '’s name and cartoon, never your email.</p>' +
        (url ? '<div class="bk-link"><input type="text" readonly value="' + esc(url) + '" data-fl-url><button class="ui-btn" data-fl-copy>' + UI.icon('copy') + 'Copy</button></div>' +
          '<div class="ui-row between" style="margin-top:18px"><button class="ui-btn danger sm" data-fl-off>' + UI.icon('x') + 'Turn the link off</button><button class="ui-btn primary" data-close>Done</button></div>'
          : '<div class="ui-row end" style="margin-top:18px"><button class="ui-btn ghost" data-close>Not now</button><button class="ui-btn primary" data-fl-on>' + UI.icon('link') + 'Make a family link</button></div>');
    }
    m.el.addEventListener('click', function (e) {
      if (e.target.closest('[data-fl-on]') || e.target.closest('[data-fl-off]')) {
        var on = !!e.target.closest('[data-fl-on]');
        UI.busy(e.target.closest('button'), UI.api('share_book', book.id, on)).then(function (r) {
          book.share_key = r.book.share_key; book.shared = r.book.shared; draw(); if (onChange) onChange();
          UI.toast(on ? 'Link made. Copy it and send it to the family!' : 'The link is off. The old link no longer works.', 'ok');
        });
      }
      if (e.target.closest('[data-fl-copy]')) {
        var inp = m.el.querySelector('[data-fl-url]');
        inp.select();
        (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(function () { UI.toast('Copied!', 'ok'); }, function () { document.execCommand && document.execCommand('copy'); UI.toast('Copied!', 'ok'); });
      }
    });
    draw();
  }

  /* ---------------------------------------------------------------- #book/<id> */
  UI.page('book', { title: 'Book' }, function (view, ctx) {
    var rd = null, book;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:520px;max-width:760px;margin:0 auto"></div></div>';
    function draw(r) {
      var b = r.book;
      book = asBook(r.story, b.hero, { id: b.id, dedication: b.dedication, created: b.created, share_key: b.share_key, shared: b.shared });
      var tools = b.mine ? pdfBtn() + '<button class="ui-btn sm" data-share>' + UI.icon('link') + '<span data-share-label>' + (b.shared ? 'Family link: on' : 'Family link') + '</span></button>' +
        '<button class="ui-btn sm" data-ded>' + UI.icon('edit') + 'Dedication</button><button class="ui-btn ghost icon sm" data-remove aria-label="Remove this book">' + UI.icon('trash') + '</button>'
        : (ctx.me ? pdfBtn() : signupBtn()) + '<a class="ui-btn sm" href="#studio/copy/' + esc(b.hero.id) + '" data-go="studio/copy/' + esc(b.hero.id) + '">' + UI.icon('wand') + 'Make one like this</a>';
      view.innerHTML = '<div class="ui-wrap bk-wrap"><div class="bk-head"><div>' + (ctx.me ? '<a class="bk-back" href="#home" data-go="home">' + UI.icon('back') + 'Shelf</a>' : '<a class="bk-back" href="#library" data-go="library">' + UI.icon('back') + 'Library</a>') +
        '<h1>' + esc(LH.title(r.story, b.hero)) + '</h1><div class="ui-row">' + (b.demo ? '<span class="ui-badge">Example book</span>' : '<span class="ui-badge brand">' + UI.icon('star') + 'Read ' + UI.plural(b.times_read, 'time') + '</span>') +
        '<span class="ui-badge">' + r.story.pages + ' story pages</span></div></div></div><div data-reader></div>' + (b.mine ? '' : cta(b.hero)) + '</div>';
      rd = LH.reader(view.querySelector('[data-reader]'), book, { tools: tools, onFinish: function () { if (b.mine) UI.apiQuiet('book_read', b.id); } });
    }
    view.addEventListener('click', function (e) {
      if (e.target.closest('[data-pdf]')) { UI.busy(e.target.closest('[data-pdf]'), LH.downloadPdf(book)); return; }
      if (e.target.closest('[data-share]')) { familyLink(book, function () { var l = view.querySelector('[data-share-label]'); if (l) l.textContent = book.share_key ? 'Family link: on' : 'Family link'; }); return; }
      if (e.target.closest('[data-ded]')) {
        var m = UI.modal('<h2>Dedication</h2><p class="muted">Printed on the first page, under ' + esc(book.hero.name) + '’s portrait.</p><form class="ui-stack" data-dedf><textarea name="d" maxlength="160" rows="3" placeholder="' + esc(LH.dedication(Object.assign({}, book, { dedication: '' }))) + '">' + esc(book.dedication) + '</textarea>' +
          '<div class="ui-row end"><button type="button" class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn primary" type="submit">Save</button></div></form>');
        m.el.querySelector('[data-dedf]').addEventListener('submit', function (ev) {
          ev.preventDefault();
          UI.busy(ev.target.querySelector('[type=submit]'), UI.api('update_book', book.id, UI.formData(ev.target).d)).then(function (r) { book.dedication = r.book.dedication; m.close(); UI.toast('Saved', 'ok'); if (rd) rd.go(1); });
        });
        return;
      }
      if (e.target.closest('[data-remove]')) {
        UI.confirm({ title: 'Remove this book from your shelf?', text: 'You can make it again any time from the library.', ok: 'Remove', danger: true }).then(function (y) {
          if (y) UI.api('delete_book', book.id).then(function () { UI.toast('Removed', 'ok'); UI.go('home'); });
        });
      }
    });
    var ready = UI.api('get_book', ctx.args[0] || '').then(draw, function (e) {
      view.innerHTML = '<div class="ui-wrap ui-narrow"><div class="ui-empty">' + UI.icon('lock') + '<h3>This book is private</h3><p>' + esc(e.message) + ' Books can only be opened by the family who made them' +
        (ctx.me ? '.' : ', so try signing in.') + '</p><div class="ui-row" style="justify-content:center">' + (ctx.me ? '<a class="ui-btn primary" href="#home" data-go="home">Back to my shelf</a>'
        : '<a class="ui-btn primary" href="#auth" data-go="auth">Sign in</a><a class="ui-btn" href="#library" data-go="library">Browse the stories</a>') + '</div></div></div>';
    });
    return { ready: ready, destroy: function () { if (rd) rd.destroy(); } };
  });

  /* ---------------------------------------------------------------- #story/<key>/<heroRef> */
  UI.page('story', { title: 'Story' }, function (view, ctx) {
    var rd = null, book, lib, choice, key = ctx.args[0] || 'bears', ref = ctx.args[1] || null;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:520px;max-width:760px;margin:0 auto"></div></div>';
    function draw(story) {
      var hero = choice.hero;
      book = asBook(story, hero);
      var tools = '';
      if (choice.own) tools += '<button class="ui-btn sm primary" data-make>' + UI.icon('plus') + 'Add to my shelf</button>';
      if (choice.ref === 'draft') tools += '<a class="ui-btn sm primary" href="#studio" data-go="studio">' + UI.icon('check') + 'Save this hero</a>';
      if (hero) tools += ctx.me ? pdfBtn(choice.own ? 'PDF' : 'Download PDF') : signupBtn();
      view.innerHTML = '<div class="ui-wrap bk-wrap"><div class="bk-head"><div><a class="bk-back" href="#library" data-go="library">' + UI.icon('back') + 'Library</a><h1>' + esc(LH.title(story, hero)) + '</h1>' +
        '<p class="muted" style="margin:0">' + (hero ? (choice.own ? 'A preview with ' + esc(hero.name) + '. Add it to your shelf to keep it.' : choice.ref === 'draft' ? 'A preview with your studio draft.' : 'An example hero. Make your own in the studio!')
          : 'The blank book: every picture has a space where your hero goes.') + '</p></div></div>' +
        '<div class="bk-stars">' + LH.heroChoices(lib).map(function (c) {
          return '<button type="button" class="lb-pick' + (c.ref === choice.ref ? ' on' : '') + '" data-pick="' + esc(c.ref) + '">' + (c.hero ? LH.heroFace(c.hero) : '<span class="face ghost">?</span>') + esc(c.label) + '</button>';
        }).join('') + '</div><div data-reader></div>' + (ctx.me && lib.heroes.length ? '' : cta(hero)) + '</div>';
      if (rd) rd.destroy();
      rd = LH.reader(view.querySelector('[data-reader]'), book, { tools: tools });
    }
    var storyData;
    view.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pick]');
      if (p) { choice = LH.heroChoices(lib).filter(function (c) { return c.ref === p.getAttribute('data-pick'); })[0] || choice; history.replaceState(null, '', '#story/' + key + '/' + choice.ref); draw(storyData); return; }
      if (e.target.closest('[data-pdf]')) { UI.busy(e.target.closest('[data-pdf]'), LH.downloadPdf(book)); return; }
      if (e.target.closest('[data-make]')) LH.makeBookDialog(storyData, lib.heroes, choice.ref);
    });
    var ready = Promise.all([UI.api('get_story', key), UI.api('get_library')]).then(function (r) {
      storyData = r[0].story; lib = r[1];
      var cs = LH.heroChoices(lib);
      choice = cs.filter(function (c) { return c.ref === ref; })[0] || cs[0];
      draw(storyData);
    });
    return { ready: ready, destroy: function () { if (rd) rd.destroy(); } };
  });

  /* ---------------------------------------------------------------- #read/<shareKey> */
  UI.page('read', { title: 'A book for you' }, function (view, ctx) {
    var rd = null, book;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:520px;max-width:760px;margin:0 auto"></div></div>';
    view.addEventListener('click', function (e) { if (e.target.closest('[data-pdf]')) UI.busy(e.target.closest('[data-pdf]'), LH.downloadPdf(book)); });
    var ready = UI.api('get_shared_book', ctx.args[0] || '').then(function (r) {
      book = asBook(r.story, r.book.hero, { dedication: r.book.dedication, created: r.book.created });
      view.innerHTML = '<div class="ui-wrap bk-wrap"><div class="bk-head"><div><div class="eyebrow">A book made for ' + esc(r.book.hero.name) + '</div><h1>' + esc(LH.title(r.story, r.book.hero)) + '</h1>' +
        '<p class="muted" style="margin:0">Someone who loves ' + esc(r.book.hero.name) + ' shared this book with you. Read it together, or download it to print.</p></div></div><div data-reader></div>' + cta(r.book.hero) + '</div>';
      rd = LH.reader(view.querySelector('[data-reader]'), book, { tools: pdfBtn() });
    }, function (e) {
      view.innerHTML = '<div class="ui-wrap ui-narrow"><div class="ui-empty">' + UI.icon('link') + '<h3>This family link doesn’t work</h3><p>' + esc(e.message) + '</p><a class="ui-btn primary" href="#landing" data-go="landing">See Little Hero Books</a></div></div>';
    });
    return { ready: ready, destroy: function () { if (rd) rd.destroy(); } };
  });
})();

/* ===== home.html ===== */
(function () {
  var esc = UI.esc;
  var BG = ['#ffc93c', '#bde5ff', '#ffd6e4', '#c9f0d8', '#e3d9ff'];
  function stars(n) { var s = Math.min(5, n); return '<span class="sh-stars" title="Read ' + UI.plural(n, 'time') + '">' + (s ? new Array(s + 1).join('★') : '<span class="faint">new</span>') + '</span>'; }
  function bookCard(b, demo) {
    return '<a class="sh-book" href="#book/' + esc(b.id) + '" data-go="book/' + esc(b.id) + '">' + LH.coverHtml(b.story, b.hero) +
      '<span class="meta"><span>' + (demo ? esc(b.hero.name) + '’s book' : esc(UI.fmtDate(b.created, { day: 'numeric', month: 'short' }))) + '</span>' + stars(b.times_read) + '</span></a>';
  }
  function shelves(books, per) {
    var rows = [];
    for (var i = 0; i < books.length; i += per) rows.push(books.slice(i, i + per));
    return rows;
  }
  UI.page('home', { title: 'Your bookshelf', nav: 'Shelf', icon: 'book', auth: 'user', order: 10 }, function (view, ctx) {
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:300px"></div></div>';
    var data;
    function draw(d) {
      data = d;
      var first = (ctx.me.name || '').split(' ')[0], H = d.heroes, B = d.books;
      var made = {};
      B.forEach(function (b) { made[b.hero.id + ':' + b.story.key] = true; });
      var lead = H[0], next = [];
      if (lead) LH.NEXT_STORIES.forEach(function (s) { if (!made[lead.id + ':' + s.key] && next.length < 4) next.push(s); });
      var per = innerWidth < 720 ? 2 : innerWidth < 1000 ? 4 : 5;
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head sh-head"><div><div class="eyebrow">Your bookshelf</div><h1>Hello, ' + esc(first) + '! Story time?</h1>' +
        '<p class="muted">Every book here stars your little one. Tap a book to read it together, or download it as a PDF to print.</p></div>' +
        '<div class="ui-row"><a class="ui-btn" href="#studio/new" data-go="studio/new">' + UI.icon('wand') + 'New hero</a><a class="ui-btn primary" href="#library" data-go="library">' + UI.icon('book') + 'Pick a story</a></div></div>' +
        '<div class="sh-stats"><span class="sh-stat"><b>' + d.stats.books + '</b>' + (d.stats.books === 1 ? 'book' : 'books') + '</span><span class="sh-stat" style="--sc:#bde5ff"><b>' + d.stats.reads + '</b>story times</span>' +
        '<span class="sh-stat" style="--sc:#ffd6e4"><b>' + d.stats.heroes + '</b>' + (d.stats.heroes === 1 ? 'hero' : 'heroes') + '</span><span class="sh-stat" style="--sc:#c9f0d8"><b>' + d.stats.stories + '</b>stories to explore</span></div>' +
        (H.length ? '' : '<div class="ui-card sh-hello"><div><h2>Let’s make your first hero!</h2><p>Pick a face, hair, eyes and clothes until the little cartoon looks just like your child. Then every story stars them.</p>' +
          '<div class="ui-row" style="margin-top:14px"><a class="ui-btn primary" href="#studio/new" data-go="studio/new">' + UI.icon('wand') + 'Open the hero studio</a></div></div>' +
          '<div class="pals">' + d.example_heroes.slice(0, 4).map(function (h) { return LH.heroFace(h, ''); }).join('').replace(/<span class="">/g, '<span>') + '</div></div>') +
        '<div class="sh-sec"><h2>Your heroes</h2><span class="muted small">Up to 12. Each child (or cousin, or grandchild) gets their own.</span></div><div class="sh-heroes">' +
        H.map(function (h, i) {
          return '<div class="ui-card sh-hero" style="--hb:' + BG[i % BG.length] + '">' + LH.heroFace(h) + '<h3>' + esc(h.name) + '</h3><span class="muted small">' + (h.books ? 'Stars in ' + UI.plural(h.books, 'book') : 'No books yet') + '</span>' +
            '<div class="ui-row"><a class="ui-btn sm" href="#studio/' + esc(h.id) + '" data-go="studio/' + esc(h.id) + '">' + UI.icon('edit') + 'Edit</a><button class="ui-btn sm sun" data-make-for="' + esc(h.id) + '">' + UI.icon('plus') + 'Book</button></div></div>';
        }).join('') + '<a class="ui-card sh-hero sh-add" href="#studio/new" data-go="studio/new"><span class="plus">' + UI.icon('plus') + '</span><b>Add a hero</b></a></div>' +
        '<div class="sh-sec"><h2>Your books</h2>' + (B.length ? '<span class="muted small">★ = one story time, read to the last page</span>' : '') + '</div>' +
        (B.length ? shelves(B, per).map(function (row) { return '<div class="sh-row"><div class="sh-shelf">' + row.map(function (b) { return bookCard(b); }).join('') + '</div><div class="sh-plank"></div></div>'; }).join('')
          : '<div class="ui-empty">' + UI.icon('book') + '<h3>No books yet</h3><p>' + (H.length ? 'Pick a story from the library and ' + esc(H[0].name) + ' becomes the hero.' : 'Make a hero first, then pick a story.') + '</p>' +
            '<a class="ui-btn primary" href="#library" data-go="library">' + UI.icon('book') + 'Browse the stories</a></div>') +
        (next.length ? '<div class="sh-sec"><h2>Next adventures for ' + esc(lead.name) + '</h2><a href="#library" data-go="library" class="small" style="font-weight:800">All stories</a></div><div class="sh-next">' +
          next.map(function (s) { return '<button type="button" data-make-story="' + s.key + '">' + LH.coverHtml(s, lead) + '<span class="go">' + UI.icon('plus') + 'Make this book</span></button>'; }).join('') + '</div>' : '') +
        (d.examples.length ? '<div class="sh-sec"><h2>The example shelf</h2><span class="muted small">Books made by our example families. Have a peek!</span></div><div class="sh-row"><div class="sh-shelf">' +
          d.examples.slice(0, per).map(function (b) { return bookCard(b, true); }).join('') + '</div><div class="sh-plank"></div></div>' : '') + '</div>';
    }
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-make-for]');
      if (b) { UI.go('library', b.getAttribute('data-make-for')); return; }
      var s = e.target.closest('[data-make-story]');
      if (s) {
        var st = LH.NEXT_STORIES.filter(function (x) { return x.key === s.getAttribute('data-make-story'); })[0];
        LH.makeBookDialog(st, data.heroes, data.heroes[0].id);
      }
    });
    return Promise.all([UI.api('get_shelf'), LH.ensureStories()]).then(function (r) { draw(r[0]); });
  });

  /* Story list (no text) shared by the shelf and the library; loaded once per visit. */
  LH.NEXT_STORIES = [];
  LH.ensureStories = function () {
    if (LH.NEXT_STORIES.length) return Promise.resolve(LH.NEXT_STORIES);
    return UI.api('get_library').then(function (d) { LH.NEXT_STORIES = d.stories; LH._lib = d; return d.stories; });
  };
})();

/* ===== landing.html ===== */
(function () {
  var esc = UI.esc;
  var COPY = {
    eyebrow: 'Personalised picture books',
    title: 'Classic bedtime stories, <em>starring your child</em>',
    lead: 'Build a cartoon look-alike of your little one, from curls to freckles. Then watch them step into eight beloved fairy tales, and download each book as a PDF to read, print or share.',
    proof: ['Free', 'No photos needed', 'Print-ready PDF'],
    stepsTitle: 'From giggles to bedtime in three steps',
    stepsLead: 'About five minutes, start to finish.',
    steps: [['Design your hero', 'Pick skin tone, face, hair, eyes, a favourite outfit and maybe a crown. Add their name and pronouns.'],
            ['Pick a story', 'Goldilocks, the Beanstalk, the Magic Porridge Pot… every picture has a space waiting for your child.'],
            ['Read, print, share', 'Turn pages together on any screen, press “Read to me”, or download a square PDF for the fridge, Grandma or a photo-book printer.']],
    featuresTitle: 'Little touches, big smiles',
    features: [['wand', 'A hero studio', '14 hairstyles, 8 skin tones, 5 face shapes, sparkly eyes, freckles, glasses, capes and crowns. “Surprise me” for wild ideas.'],
               ['book', '8 classic tales', 'Public-domain stories retold short and kind: around 300 words and nine illustrated pages each.'],
               ['download', 'A real PDF book', 'Cover, dedication page, the story and “The End”: 12 square pages, made right in your browser.'],
               ['volume', 'Read to me', 'The app reads each page aloud and turns the pages by itself. Lovely for wind-down time.'],
               ['link', 'Family links', 'Share one book with grandparents. They can read and print it without an account.'],
               ['heart', 'A shelf that grows', 'Siblings, cousins, best friends: up to 12 heroes, with reading stars for every bedtime.']],
    faq: [['Is it free?', 'Yes. Designing heroes, making books and downloading the PDFs are all free.'],
          ['Do I need to upload a photo of my child?', 'No, never. You build the cartoon by picking features, so no photo of your child ever leaves your device.'],
          ['What does the PDF look like?', 'Twelve square pages: a cover with your child, a “This book belongs to” page with your dedication, nine illustrated story pages and a happy “The End”. It prints nicely at home or as an 8 × 8 inch photo book.'],
          ['Where do the stories come from?', 'They are fairy tales over a hundred years old and in the public domain (Robert Southey, the Brothers Grimm, Hans Christian Andersen, Joseph Jacobs and traditional folk tales). We retold them gently for ages 3 to 6: the bears make friends and the giant is just lonely.'],
          ['Who can see my child’s name and cartoon?', 'Only you, when you’re signed in. If you make a family link for a book, people with that link can see that one book. You can turn the link off any time.'],
          ['Can I try it before signing up?', 'Yes! Open the hero studio and read any story with your hero straight away. A free account lets you keep heroes, fill a bookshelf and download PDFs.']],
    bandTitle: 'Tonight’s story could star them',
    bandLead: 'Make a hero in a minute. No sign-up needed to try.'
  };
  var PALS = [
    { name: 'Juniper', pronoun: 'she', look: { size: 'kid', skin: 's2', face: 'round', hair: 'curly', hairColor: 'ginger', eyes: 'sparkle', eyeColor: 'green', mouth: 'grin', cheeks: true, freckles: true, glasses: 'round', outfit: 'overalls', outfitColor: 'sky' } },
    { name: 'Kofi', pronoun: 'he', look: { size: 'kid', skin: 's7', face: 'oval', hair: 'crop', hairColor: 'black', eyes: 'round', eyeColor: 'dark', brows: 'bold', mouth: 'toothy', outfit: 'cape', outfitColor: 'tomato' } },
    { name: 'Amara', pronoun: 'she', look: { size: 'toddler', skin: 's6', face: 'chubby', hair: 'puffs', hairColor: 'black', eyes: 'sparkle', mouth: 'giggle', outfit: 'dress', outfitColor: 'sun', hat: 'flower' } },
    { name: 'Sasha', pronoun: 'they', look: { size: 'kid', skin: 's3', face: 'heart', hair: 'swoop', hairColor: 'blonde', eyes: 'almond', eyeColor: 'blue', outfit: 'stripes', outfitColor: 'grass', hat: 'cap' } },
    { name: 'Leo', pronoun: 'he', look: { size: 'toddler', skin: 's4', face: 'chubby', hair: 'fuzz', hairColor: 'brown', mouth: 'giggle', outfit: 'pyjamas', outfitColor: 'plum' } }
  ];
  var STORIES = [['bears', '{name} and the Three Bears', '#ef5a36'], ['beanstalk', '{name} and the Beanstalk', '#4ea8f5'], ['turnip', '{name} and the Enormous Turnip', '#3dbe8b'], ['porridge', '{name} and the Magic Porridge Pot', '#ffc93c'],
                 ['emperor', '{name} and the Emperor’s New Clothes', '#8a6bd8'], ['hen', '{name} and the Little Red Hen', '#ff8fb8'], ['elves', '{name} and the Elves', '#2fa39b'], ['pea', '{name} and the Pea', '#5b8def']];
  var PAGE = '{name} tried the big bowl. “Too hot!” Then the middle bowl. “Too cold!” Then the wee bowl. “Just right!” said {name}, and before {he} knew it, the little bowl was empty. Oops!';

  function heroArt(p) {
    return '<div class="lp-art" aria-hidden="true"><div class="lpx-book lpx-fade"><div class="l"><div class="pic">' + LH.sceneSvg('bears', 3, p, { clip: 'lpa' }).replace('xMidYMid slice', 'xMaxYMid slice') + '</div></div>' +
      '<div class="r"><p>' + LH.fillHtml(PAGE, p) + '</p><div class="num">4</div></div></div>' +
      '<div class="lpx-sticker s1">' + LH.heroFace(p) + '<span>' + esc(p.name) + '<small>the hero of every page</small></span></div>' +
      '<div class="lpx-sticker s2">' + ['#6A4024', '#D9692A', '#EECB6E', '#231C24', '#FF8FB8'].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</div>' +
      '<div class="lpx-sticker s3">' + UI.icon('download') + 'PDF</div></div>';
  }
  function shelf(p) {
    return '<div class="lp-shelf">' + STORIES.map(function (s) { return LH.coverHtml({ key: s[0], title: s[1], color: s[2] }, p); }).join('') + '</div><div class="lp-plank"></div>';
  }

  UI.page('landing', { title: 'Welcome' }, function (view, ctx) {
    var me = ctx.me, C = COPY, at = 0, timer = null, paused = false;
    var primary = me ? '<a class="ui-btn primary lg" href="#home" data-go="home">Open my bookshelf ' + UI.icon('arrow') + '</a><a class="ui-btn lg sun" href="#library" data-go="library">The stories</a>'
      : '<a class="ui-btn primary lg" href="#studio" data-go="studio">' + UI.icon('wand') + 'Design your hero</a><a class="ui-btn lg sun" href="#library" data-go="library">Browse the stories</a>';
    view.innerHTML =
      '<section class="lp-hero"><div class="ui-wrap"><div>' +
        '<div class="eyebrow">' + esc(C.eyebrow) + '</div><h1>' + C.title + '</h1><p class="lp-lead">' + esc(C.lead) + '</p>' +
        '<div class="lp-cta">' + primary + '</div>' +
        (me ? '' : '<p class="small muted" style="margin:14px 0 0">No sign-up needed to try. <a href="#auth/signup" data-go="auth/signup"><b>Create a free account</b></a> to keep a bookshelf.</p>') +
        '<div class="lp-proof">' + C.proof.map(function (p) { return '<span>' + UI.icon('check') + esc(p) + '</span>'; }).join('') + '</div>' +
      '</div><div data-art></div></div></section>' +
      '<section class="lp-section" id="how"><div class="ui-wrap"><div class="lp-head"><h2>' + esc(C.stepsTitle) + '</h2><p>' + esc(C.stepsLead) + '</p></div>' +
        '<div class="lp-steps">' + C.steps.map(function (s) { return '<div class="ui-card lp-step"><h3>' + esc(s[0]) + '</h3><p class="muted">' + esc(s[1]) + '</p></div>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Eight stories, one little hero</h2><p>Tap a face to change who stars in the whole library.</p></div><div data-shelf></div>' +
        '<div class="lp-pals">' + PALS.map(function (p, i) { return '<button type="button" data-pal="' + i + '" aria-label="' + esc(p.name) + '">' + LH.avatarSvg(p.look, { crop: 'head' }) + '</button>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>' + esc(C.featuresTitle) + '</h2></div>' +
        '<div class="ui-grid lp-feats">' + C.features.map(function (f) { return '<div class="ui-card lp-feature">' + UI.icon(f[0]) + '<h3>' + esc(f[1]) + '</h3><p>' + esc(f[2]) + '</p></div>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Made for families, kind by design</h2></div><div class="lp-safe">' +
        '<div class="ui-card"><b>No photos, ever</b><p class="muted small" style="margin:0">Your child is a cartoon you build from choices. Nothing to upload, nothing to leak.</p></div>' +
        '<div class="ui-card"><b>A private shelf</b><p class="muted small" style="margin:0">Heroes and books are yours alone, unless you make a family link for one book.</p></div>' +
        '<div class="ui-card"><b>Gentle retellings</b><p class="muted small" style="margin:0">No scary wolves. The stories celebrate sharing, honesty, helping and saying sorry.</p></div></div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Questions parents ask</h2></div><div class="lp-faq">' +
        C.faq.map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-band"><div><h2>' + esc(C.bandTitle) + '</h2><p>' + esc(C.bandLead) + '</p></div>' +
        (me ? '<a class="ui-btn lg" href="#studio/new" data-go="studio/new">' + UI.icon('wand') + 'Make another hero</a>' : '<a class="ui-btn lg" href="#studio" data-go="studio">' + UI.icon('wand') + 'Design your hero</a>') +
      '</div></div></section>';
    function show(i) {
      at = (i + PALS.length) % PALS.length;
      view.querySelector('[data-art]').innerHTML = heroArt(PALS[at]);
      view.querySelector('[data-shelf]').innerHTML = shelf(PALS[at]);
      view.querySelectorAll('[data-pal]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-pal') === at); });
    }
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pal]');
      if (b) { paused = true; show(+b.getAttribute('data-pal')); }
    });
    show(0);
    if (!window.matchMedia || !matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(function () { if (!paused && !document.hidden) show(at + 1); }, 4200);
    return { ready: Promise.resolve(), destroy: function () { clearInterval(timer); } };
  });
})();

/* ===== library.html ===== */
(function () {
  var esc = UI.esc;
  /* Heroes you can read with: yours, your draft, the examples. ref = id | 'draft' | 'blank'. */
  LH.heroChoices = function (lib) {
    var out = (lib.heroes || []).map(function (h) { return { ref: h.id, hero: h, label: h.name, own: true }; });
    var d = LH.loadDraft();
    if (d && d.look && !d.id) out.push({ ref: 'draft', hero: { name: (d.name || '').trim() || 'Your hero', pronoun: d.pronoun || 'they', look: d.look }, label: (d.name || '').trim() || 'Your draft', note: 'not saved' });
    (lib.examples || []).forEach(function (h) { out.push({ ref: h.id, hero: h, label: h.name, note: 'example' }); });
    out.push({ ref: 'blank', hero: null, label: 'Blank book', note: 'no hero' });
    return out;
  };
  UI.page('library', { title: 'Story library', nav: 'Stories', icon: 'book', order: 30 }, function (view, ctx) {
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:300px"></div></div>';
    var lib, choices, pick;
    function draw() {
      var hero = pick.hero;
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><div class="eyebrow">The story library</div><h1>Eight classic tales, one little hero</h1>' +
        '<p class="muted">Fairy tales from the public domain, retold short (about 300 words) for ages 3 to 6. Every picture is drawn so your child can step right in.</p></div></div>' +
        '<div class="ui-card lb-star"><b>Starring</b>' + choices.map(function (c) {
          return '<button type="button" class="lb-pick' + (c.ref === pick.ref ? ' on' : '') + '" data-pick="' + esc(c.ref) + '">' +
            (c.hero ? LH.heroFace(c.hero) : '<span class="face ghost">?</span>') + esc(c.label) + (c.note ? ' <small>' + esc(c.note) + '</small>' : '') + '</button>';
        }).join('') + (ctx.me ? '<a class="lb-pick" href="#studio/new" data-go="studio/new"><span class="face ghost">+</span>New hero</a>' : '<a class="lb-pick" href="#studio" data-go="studio"><span class="face ghost">+</span>Make yours</a>') + '</div>' +
        '<div class="lb-grid">' + lib.stories.map(function (s) {
          return '<article class="lb-card"><div data-read="' + s.key + '">' + LH.coverHtml(s, hero) + '</div><div><p>' + esc(s.blurb) + '</p>' +
            '<div class="facts"><span class="ui-badge">' + s.pages + ' pages</span><span class="ui-badge">' + s.minutes + ' min</span><span class="ui-badge brand">Ages 3–6</span></div>' +
            '<div class="ui-row"><button class="ui-btn sm" data-read="' + s.key + '">' + UI.icon('book') + 'Read</button>' +
            (pick.own ? '<button class="ui-btn sm primary" data-make="' + s.key + '">' + UI.icon('plus') + 'Add to shelf</button>' : '') + '</div></div></article>';
        }).join('') + '</div>' +
        '<div class="ui-card flat lb-note">' + UI.icon('heart') + '<div><b>Where do the stories come from?</b><p class="muted small" style="margin:4px 0 0">Each tale is over a hundred years old and free for everyone: Robert Southey, the Brothers Grimm, Hans Christian Andersen, Joseph Jacobs and folk tales from England and Russia. ' +
        'We retold them gently for little ones: the bears make friends, the giant is lonely rather than scary, and everybody shares the bread.</p></div></div></div>';
    }
    view.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pick]');
      if (p) { pick = choices.filter(function (c) { return c.ref === p.getAttribute('data-pick'); })[0] || pick; UI.store.set('libPick', pick.ref); draw(); return; }
      var r = e.target.closest('[data-read]');
      if (r) { UI.go('story', r.getAttribute('data-read'), pick.ref); return; }
      var m = e.target.closest('[data-make]');
      if (m) {
        var s = lib.stories.filter(function (x) { return x.key === m.getAttribute('data-make'); })[0];
        LH.makeBookDialog(s, lib.heroes, pick.ref);
      }
    });
    return UI.api('get_library').then(function (d) {
      lib = d; LH.NEXT_STORIES = d.stories; choices = LH.heroChoices(d);
      var want = ctx.args[0] || UI.store.get('libPick', null);
      pick = choices.filter(function (c) { return c.ref === want; })[0] || choices[0];
      draw();
    });
  });
})();

/* ===== profile.html ===== */
(function () {
  var esc = UI.esc;
  UI.page('profile', { title: 'Your profile', auth: 'user' }, function (view, ctx) {
    var me = ctx.me;
    view.innerHTML = '<div class="ui-wrap ui-narrow"><div class="pf-head"><span class="ui-avatar">' + esc(UI.initials(me.name)) + '</span>' +
      '<div><h1>' + esc(me.name) + '</h1><div class="muted">' + esc(me.email) + (me.joined ? ' · member since ' + esc(UI.fmtDate(me.joined, { month: 'long', year: 'numeric' })) : '') + '</div></div></div>' +
      '<div class="pf-grid"><form class="ui-card ui-stack" data-name><h3>Your name</h3><label class="ui-field"><span>Shown to other people</span>' +
      '<input type="text" name="name" value="' + esc(me.name) + '" maxlength="60" required></label><button class="ui-btn primary" type="submit">Save</button></form>' +
      '<div class="ui-card ui-stack"><h3>Appearance</h3><p class="muted small">Follow your device, or pick one.</p><div data-theme-box></div>' +
      '<h3 style="margin-top:22px">Password</h3><p class="muted small">We\'ll email you a link to choose a new one.</p>' +
      '<button class="ui-btn" data-reset>' + UI.icon('mail') + 'Email me a reset link</button></div></div>' +
      '<div class="ui-card" style="margin-top:16px"><div class="pf-links">' +
      (me.is_admin ? '<a href="#admin" data-go="admin">' + UI.icon('shield') + 'Admin</a>' : '') +
      '<button data-feedback>' + UI.icon('chat') + 'Send feedback</button>' +
      '<button data-lk-open="overview">' + UI.icon('lock') + 'Privacy &amp; Terms, and your data</button>' +
      '<button data-signout-here>' + UI.icon('logout') + 'Sign out</button></div></div></div>';
    function themeBox() {
      var t = UI.theme();
      view.querySelector('[data-theme-box]').innerHTML = '<div class="ui-seg">' + [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
        return '<button type="button" data-theme-pick="' + o[0] + '" class="' + (t === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    }
    themeBox();
    view.addEventListener('click', function (e) {
      var t = e.target.closest('[data-theme-pick]');
      if (t) { UI.setTheme(t.getAttribute('data-theme-pick')); themeBox(); UI.renderChrome(); return; }
      if (e.target.closest('[data-reset]')) {
        UI.busy(e.target.closest('[data-reset]'), UI.auth('reset', { email: me.email })).then(function (r) { UI.toast(r.message, 'ok'); });
      }
      if (e.target.closest('[data-signout-here]')) UI.auth('logout');
    });
    view.querySelector('[data-name]').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = UI.formData(e.target);
      UI.busy(e.target.querySelector('[type=submit]'), UI.api('update_profile', v.name)).then(function (r) {
        UI.setMe(r.me); ctx.me = r.me; UI.toast('Saved', 'ok');
        view.querySelector('.pf-head h1').textContent = r.me.name;
      });
    });
  });
})();

/* ===== studio.html ===== */
(function () {
  var esc = UI.esc;
  var TABS = [['face', 'Face', 'smile'], ['hair', 'Hair', 'wand'], ['eyes', 'Eyes & mouth', 'sparkle'], ['clothes', 'Clothes', 'heart'], ['extras', 'Hats & glasses', 'star']];
  var GROUPS = {
    face: [['size', 'How big?', 'seg'], ['skin', 'Skin tone', 'sw'], ['face', 'Face shape', 'head'], ['marks', 'Cheeks & freckles', 'toggles'], ['nose', 'Nose', 'head']],
    hair: [['hair', 'Hairstyle', 'head'], ['hairColor', 'Hair colour', 'sw']],
    eyes: [['eyes', 'Eyes', 'head'], ['eyeColor', 'Eye colour', 'sw'], ['brows', 'Eyebrows', 'head'], ['mouth', 'Smile', 'head']],
    clothes: [['outfit', 'Outfit', 'body'], ['outfitColor', 'Favourite colour', 'sw']],
    extras: [['hat', 'On their head', 'head'], ['glasses', 'Glasses', 'head']]
  };
  var POSES = [['stand', 'Hello'], ['wave', 'Wave'], ['cheer', 'Hooray'], ['walk', 'Skip']];
  var STORIES = ['bears', 'beanstalk', 'turnip', 'porridge', 'emperor', 'hen', 'elves', 'pea'];
  function colorOf(key, v) { return key === 'skin' ? LH.COL.skin[v] : key === 'hairColor' ? LH.COL.hair[v] : key === 'eyeColor' ? LH.COL.eye[v] : LH.COL.cloth[v]; }
  var NAMES = { tomato: 'Tomato', orange: 'Orange', sun: 'Sunshine', grass: 'Grass', teal: 'Sea', sky: 'Sky', navy: 'Navy', plum: 'Plum', pink: 'Pink', white: 'Cream' };

  LH.loadDraft = function () { return UI.store.get('draft', null); };
  LH.saveDraft = function (d) { UI.store.set('draft', d); };

  UI.page('studio', { title: 'Hero studio', nav: 'Studio', icon: 'wand', order: 20 }, function (view, ctx) {
    var a = ctx.args, st = { id: null, name: '', pronoun: 'she', look: LH.normal(LH.DEFAULT_LOOK), mine: true }, tab = 'face', pose = 'wave', undo = [], storyAt = 0;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:420px"></div></div>';

    function draw() {
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><div class="eyebrow">Hero studio</div><h1>' + (st.id ? 'Edit ' + esc(st.name || 'your hero') : 'Make a hero who looks like your child') + '</h1>' +
        '<p class="muted">Pick a face, hair, eyes and clothes. Everything changes live, and every story you make will star this little one.</p></div></div>' +
        '<div class="st-wrap"><section class="ui-card st-stage"><div class="st-hero" data-preview></div><div class="st-name" data-name-out></div><div class="st-sub" data-sub-out></div>' +
        '<div class="st-poses"><div class="ui-seg" role="group" aria-label="Pose">' + POSES.map(function (p) { return '<button type="button" data-pose="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="ui-row st-dice" style="justify-content:center"><button class="ui-btn sm sun" data-random>' + UI.icon('dice') + 'Surprise me</button><button class="ui-btn sm" data-undo>' + UI.icon('back') + 'Undo</button></div>' +
        '<div class="st-try"><div class="lab"><span>' + UI.icon('book') + ' Try it in a story</span><span class="ui-row" style="gap:4px"><button class="ui-btn ghost icon sm" data-story="-1" aria-label="Previous story">' + UI.icon('back') + '</button><button class="ui-btn ghost icon sm" data-story="1" aria-label="Next story">' + UI.icon('arrow') + '</button></span></div><a class="mini" href="#" data-try></a></div></section>' +
        '<section class="st-panel"><div class="ui-card st-who"><label class="ui-field"><span>Your child’s name <em>(as it should appear in the stories)</em></span><input type="text" name="name" maxlength="24" placeholder="e.g. Mila" value="' + esc(st.name) + '" data-name autocomplete="off"></label>' +
        '<div class="ui-field"><span>In the story, call them</span><div class="ui-seg" role="group" aria-label="Pronouns">' + [['she', 'she / her'], ['he', 'he / him'], ['they', 'they / them']].map(function (p) {
          return '<button type="button" data-pronoun="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div></div></div>' +
        '<nav class="ui-tabs" data-tabs>' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '">' + UI.icon(t[2]) + t[1] + '</button>'; }).join('') + '</nav>' +
        '<div data-groups></div><div class="st-save">' + (st.mine ? '<button class="ui-btn primary lg" data-save>' + UI.icon('check') + (st.id ? 'Save changes' : 'Save my hero') + '</button>' : '') +
        (st.id && st.mine ? '<a class="ui-btn" href="#library" data-go="library">' + UI.icon('book') + 'Make a book</a><span class="ui-spacer"></span><button class="ui-btn danger sm" data-remove>' + UI.icon('trash') + 'Remove hero</button>' : '') +
        (!ctx.me ? '<span class="small muted">Free account needed to save, keep a bookshelf and download PDFs.</span>' : '') + '</div></section></div></div>';
      refresh();
    }
    function refresh() {
      var look = st.look, name = st.name.trim();
      view.querySelector('[data-preview]').innerHTML = LH.avatarSvg(look, { pose: pose, mood: pose === 'cheer' ? 'laugh' : 'happy' });
      view.querySelector('[data-name-out]').textContent = name || 'Your hero';
      view.querySelector('[data-sub-out]').textContent = (look.size === 'toddler' ? 'Little one' : 'Big kid') + ' · ' + ({ she: 'she / her', he: 'he / him', they: 'they / them' }[st.pronoun]);
      view.querySelectorAll('[data-pose]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-pose') === pose); });
      view.querySelectorAll('[data-pronoun]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-pronoun') === st.pronoun); });
      view.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
      view.querySelector('[data-undo]').disabled = !undo.length;
      var key = STORIES[storyAt], hero = { name: name || 'Your hero', pronoun: st.pronoun, look: look };
      var tr = view.querySelector('[data-try]');
      tr.innerHTML = LH.sceneSvg(key, 'cover', hero, { clip: 'stc' });
      tr.setAttribute('href', '#story/' + key + '/draft');
      tr.setAttribute('title', 'Read "' + LH.title({ title: STORYTITLES[key] }, hero) + '" with this hero');
      groups();
      LH.saveDraft({ id: st.id, name: st.name, pronoun: st.pronoun, look: look });
    }
    var STORYTITLES = { bears: '{name} and the Three Bears', beanstalk: '{name} and the Beanstalk', turnip: '{name} and the Enormous Turnip', porridge: '{name} and the Magic Porridge Pot',
                        emperor: '{name} and the Emperor’s New Clothes', hen: '{name} and the Little Red Hen', elves: '{name} and the Elves', pea: '{name} and the Pea' };
    function groups() {
      var look = st.look;
      view.querySelector('[data-groups]').innerHTML = GROUPS[tab].map(function (gr) {
        var key = gr[0], kind = gr[2], body = '';
        if (kind === 'sw') {
          body = '<div class="st-sw">' + LH.OPTIONS[key].map(function (v) {
            return '<button type="button" data-opt="' + key + '" data-val="' + v + '" class="' + (look[key] === v ? 'on' : '') + '" style="background:' + colorOf(key, v) + '" aria-label="' + esc(NAMES[v] || v) + '" title="' + esc(NAMES[v] || v) + '"></button>';
          }).join('') + '</div>';
        } else if (kind === 'seg') {
          body = '<div class="ui-seg">' + LH.OPTIONS[key].map(function (o) { return '<button type="button" data-opt="' + key + '" data-val="' + o[0] + '" class="' + (look[key] === o[0] ? 'on' : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
        } else if (kind === 'toggles') {
          body = '<div class="st-toggles">' + [['cheeks', 'Rosy cheeks'], ['freckles', 'Freckles']].map(function (t) {
            return '<button type="button" class="ui-btn sm' + (look[t[0]] ? ' on' : '') + '" data-tog="' + t[0] + '" aria-pressed="' + !!look[t[0]] + '">' + (look[t[0]] ? UI.icon('check') : UI.icon('plus')) + t[1] + '</button>';
          }).join('') + '</div>';
        } else {
          body = '<div class="st-opts' + (kind === 'body' ? ' body' : '') + '">' + LH.OPTIONS[key].map(function (o) {
            var l = Object.assign({}, look); l[key] = o[0];
            if (key === 'hat' && o[0] !== 'none' && l.hair === 'none') l.hair = 'fuzz';
            return '<button type="button" class="st-opt' + (look[key] === o[0] ? ' on' : '') + '" data-opt="' + key + '" data-val="' + o[0] + '"><span class="th">' +
              LH.avatarSvg(l, kind === 'body' ? {} : { crop: 'head', mood: key === 'mouth' || key === 'eyes' ? 'happy' : 'happy' }) + '</span>' + esc(o[1]) + '</button>';
          }).join('') + '</div>';
        }
        return '<div class="st-group"><h4>' + esc(gr[1]) + '</h4>' + body + '</div>';
      }).join('');
    }
    function change(fn) { undo.push(JSON.stringify(st.look)); if (undo.length > 40) undo.shift(); fn(); refresh(); }

    function save(btn) {
      var name = st.name.trim();
      if (!name) { UI.toast('Type your child’s name first, so the stories can use it.', 'error'); view.querySelector('[data-name]').focus(); return; }
      if (!ctx.me) {
        UI.store.set('saveAfterSignup', true);
        UI.after = '#studio';
        UI.toast('Make a free account and ' + name + ' is saved to your shelf.');
        UI.go('auth', 'signup');
        return;
      }
      return UI.busy(btn, UI.api('save_hero', st.id, name, st.pronoun, st.look)).then(function (r) {
        UI.store.set('draft', null); UI.store.set('saveAfterSignup', false);
        LH.confetti();
        UI.toast(r.hero.name + (st.id ? ' is updated!' : ' is ready for adventures!'), 'ok');
        UI.go('home');
      });
    }

    view.addEventListener('click', function (e) {
      var t = e.target.closest('[data-opt]');
      if (t) { var k = t.getAttribute('data-opt'), v = t.getAttribute('data-val'); change(function () { st.look[k] = v; }); return; }
      t = e.target.closest('[data-tog]');
      if (t) { var key = t.getAttribute('data-tog'); change(function () { st.look[key] = !st.look[key]; }); return; }
      t = e.target.closest('[data-tab]');
      if (t) { tab = t.getAttribute('data-tab'); refresh(); return; }
      t = e.target.closest('[data-pose]');
      if (t) { pose = t.getAttribute('data-pose'); refresh(); return; }
      t = e.target.closest('[data-pronoun]');
      if (t) { st.pronoun = t.getAttribute('data-pronoun'); refresh(); return; }
      t = e.target.closest('[data-story]');
      if (t) { storyAt = (storyAt + (+t.getAttribute('data-story')) + STORIES.length) % STORIES.length; refresh(); return; }
      if (e.target.closest('[data-try]')) { e.preventDefault(); UI.go('story', STORIES[storyAt], 'draft'); return; }
      if (e.target.closest('[data-random]')) { change(function () { st.look = LH.normal(LH.randomLook(st.look)); }); pose = 'cheer'; refresh(); return; }
      if (e.target.closest('[data-undo]')) { if (undo.length) { st.look = JSON.parse(undo.pop()); refresh(); } return; }
      if (e.target.closest('[data-save]')) { save(e.target.closest('[data-save]')); return; }
      if (e.target.closest('[data-remove]')) {
        UI.confirm({ title: 'Remove ' + (st.name || 'this hero') + '?', text: 'Their books are removed from your shelf too. PDFs you already downloaded stay yours.', ok: 'Remove', danger: true }).then(function (yes) {
          if (yes) UI.api('delete_hero', st.id).then(function (r) { UI.store.set('draft', null); UI.toast('Removed' + (r.removed_books ? ', with ' + UI.plural(r.removed_books, 'book') : ''), 'ok'); UI.go('home'); });
        });
      }
    });
    view.addEventListener('input', function (e) {
      if (e.target.matches('[data-name]')) {
        st.name = e.target.value;
        view.querySelector('[data-name-out]').textContent = st.name.trim() || 'Your hero';
        LH.saveDraft({ id: st.id, name: st.name, pronoun: st.pronoun, look: st.look });
      }
    });
    view.addEventListener('change', function (e) { if (e.target.matches('[data-name]')) refresh(); });

    function start() {
      // #studio/<id> = edit yours; #studio/copy/<id> = start from an example hero; #studio/new = blank; #studio = the draft (or a fresh hero)
      if (a[0] === 'copy' && a[1]) {
        return UI.api('get_hero', a[1]).then(function (r) { st.look = LH.normal(r.hero.look); st.pronoun = r.hero.pronoun; st.name = ''; draw(); UI.toast('Starting from ' + r.hero.name + '. Make it yours!'); });
      }
      if (a[0] && a[0] !== 'new') {
        return UI.api('get_hero', a[0]).then(function (r) {
          st.id = r.mine ? r.hero.id : null; st.name = r.mine ? r.hero.name : ''; st.pronoun = r.hero.pronoun; st.look = LH.normal(r.hero.look); st.mine = true; draw();
        });
      }
      var d = a[0] === 'new' ? null : LH.loadDraft();
      if (d && d.look && !d.id) { st.name = d.name || ''; st.pronoun = d.pronoun || 'she'; st.look = LH.normal(d.look); }
      else if (a[0] === 'new' || !d) { st.look = LH.normal(LH.randomLook()); st.look.outfitColor = 'tomato'; }
      draw();
      if (ctx.me && UI.store.get('saveAfterSignup', false) && st.name.trim()) {
        UI.store.set('saveAfterSignup', false);
        return save(view.querySelector('[data-save]'));
      }
      return Promise.resolve();
    }
    return start();
  });
})();
