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

  /* ------------------------------------------------------------------ feedback (footer + menu)
     All feedback goes to Prepsto. The widget tag in head.html (data-prepsto="CODE") slides its panel in;
     any [data-feedback] or [data-prepsto-open] element opens it. If the widget hasn't loaded, the panel opens in a new tab.
     There is no in-app feedback form any more: Admin -> Feedback only lists older messages (and app requests). */
  UI.feedback = function () {
    if (window.Prepsto && window.Prepsto.open) { window.Prepsto.open(); return; }
    var tag = document.querySelector('script[data-prepsto]');
    var code = tag && tag.getAttribute('data-prepsto');
    if (code && code.indexOf('__') !== 0) window.open('https://prepsto.com/#f/' + encodeURIComponent(code), '_blank', 'noopener');
    else UI.toast('Feedback is not set up yet.', 'error');
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
  UI.ICONS.brush = '<path d="M14.5 4.5 19.5 9.5 11 18l-5-5z"/><path d="M6 13c-2 0-3 1.5-3 3.5S2 20 2 20s4 .5 5.5-1 1.5-3.5 1.5-3.5"/><path d="m16.5 3 4.5 4.5"/>';
  UI.ICONS.print = '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>';
  UI.ICONS.volume ='<path d="M5 10v4h3l4 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>';
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
      '<button type="button" data-feedback>' + UI.icon('chat') + 'Submit feedback</button>' +
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
        '<a href="https://prepsto.com/#f/qgsqghg" target="_blank" rel="noopener" data-prepsto-open>Submit feedback</a>' +
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
    skin: { s1: '#FFE5D0', s2: '#F9D2B4', s3: '#EFBF98', s4: '#DDA477', s5: '#C08558', s6: '#9A633D', s7: '#774A2C', s8: '#55331E',
            s9: '#FFF0E6', s10: '#F8DCCB', s11: '#F0CDA8', s12: '#E6B98C', s13: '#D3A979', s14: '#C99A6E', s15: '#B07A4F', s16: '#A86E52',
            s17: '#8A5634', s18: '#6A4128', s19: '#4F2F1D', s20: '#3E2417' },
    hair: { black: '#231C24', dark: '#3B2416', brown: '#6A4024', auburn: '#8E3B1F', ginger: '#D9692A', strawberry: '#E8A06A',
            blonde: '#EECB6E', platinum: '#F4E9C6', grey: '#BDB8C7', white: '#F4F2F7', pink: '#FF8FB8', blue: '#5BB2F7', purple: '#A98BE8',
            chestnut: '#86502B', caramel: '#A86F3C', honey: '#C9934A', golden: '#E3B04B', sandy: '#D8BC8E', ash: '#B5A68C', copper: '#B4542A',
            cherry: '#C8323C', mint: '#7FD8B8', teal: '#2FA39B', lilac: '#C9A8F0', silver: '#D5D7DE' },
    eye: { brown: '#7A4A22', dark: '#3A2416', hazel: '#9A7A35', green: '#4A9A62', blue: '#4A8BDB', grey: '#7F8B99', amber: '#C9861E',
           black: '#1E1820', lightbrown: '#A0652E', olive: '#7C8A3A', emerald: '#22A06B', teal: '#2A9C9C', aqua: '#53BFD9', sky: '#7DB8F0',
           navy: '#2F5DB8', violet: '#8A6BD8', silver: '#A9B4C2', steel: '#5E7690' },
    cloth: { tomato: '#EF5A36', sun: '#FFC93C', grass: '#3DBE8B', sky: '#4EA8F5', plum: '#8A6BD8', pink: '#FF8FB8', orange: '#FF9A3C',
             teal: '#2FA39B', navy: '#3C4F8F', white: '#F7F3EA', brown: '#8A5A3B', gold: '#E9B53B', green: '#3E8E4E', red: '#C8372D',
             lilac: '#C9A8F0', mint: '#8EDDC0', lemon: '#FFE66B', coral: '#FF7B6B', berry: '#C2337A', charcoal: '#4A4658', denim: '#4F74B3',
             lime: '#9BD447', peach: '#FFB889' }
  };
  /* Friendly names for the colour swatches (studio tooltips). */
  LH.COLOR_NAMES = {
    black: 'Black', dark: 'Dark brown', brown: 'Brown', chestnut: 'Chestnut', auburn: 'Auburn', copper: 'Copper', caramel: 'Caramel',
    ginger: 'Ginger', strawberry: 'Strawberry blonde', honey: 'Honey', golden: 'Golden', blonde: 'Blonde', sandy: 'Sandy', ash: 'Ash blonde',
    platinum: 'Platinum', silver: 'Silver', cherry: 'Cherry red', pink: 'Pink', lilac: 'Lilac', purple: 'Purple', blue: 'Blue', teal: 'Teal',
    mint: 'Mint', lightbrown: 'Light brown', amber: 'Amber', hazel: 'Hazel', olive: 'Olive', green: 'Green', emerald: 'Emerald',
    aqua: 'Aqua', sky: 'Sky', navy: 'Navy', steel: 'Steel blue', grey: 'Grey', violet: 'Violet', red: 'Red', tomato: 'Tomato',
    coral: 'Coral', orange: 'Orange', peach: 'Peach', sun: 'Sunshine', lemon: 'Lemon', gold: 'Gold', lime: 'Lime', grass: 'Grass',
    denim: 'Denim', plum: 'Plum', berry: 'Berry', white: 'Cream', charcoal: 'Charcoal'
  };
  LH.OPTIONS = {
    size: [['a1', 'Age 1'], ['toddler', 'Age 2'], ['a3', 'Age 3'], ['a4', 'Age 4'], ['a5', 'Age 5'], ['kid', 'Age 6'], ['a7', 'Age 7'],
           ['a8', 'Age 8'], ['a9', 'Age 9'], ['a10', 'Age 10'], ['a11', 'Age 11'], ['a12', 'Age 12']],
    skin: ['s9', 's1', 's10', 's2', 's11', 's3', 's12', 's13', 's4', 's14', 's5', 's15', 's16', 's6', 's17', 's7', 's18', 's8', 's19', 's20'],
    face: [['round', 'Round'], ['oval', 'Oval'], ['heart', 'Heart'], ['square', 'Square'], ['chubby', 'Chubby'], ['long', 'Long'],
           ['wide', 'Wide'], ['moon', 'Moon'], ['small', 'Petite'], ['egg', 'Egg'], ['pear', 'Pear'], ['apple', 'Apple cheeks'],
           ['diamond', 'Diamond'], ['elfin', 'Pointy chin'], ['rounded', 'Soft square'], ['jaw', 'Strong jaw']],
    hair: [['none', 'No hair yet'], ['fuzz', 'Baby fuzz'], ['buzz', 'Buzz cut'], ['crop', 'Short'], ['sidepart', 'Side part'], ['swoop', 'Swoop'],
           ['quiff', 'Quiff'], ['spiky', 'Spiky'], ['mohawk', 'Mohawk'], ['bowl', 'Bowl cut'], ['pixie', 'Pixie'], ['mop', 'Shaggy'],
           ['curly', 'Curly'], ['afro', 'Afro'], ['puff', 'Afro puff'], ['puffs', 'Puffs'], ['knots', 'Bantu knots'], ['cornrows', 'Cornrows'],
           ['locs', 'Locs'], ['bun', 'Top bun'], ['spacebuns', 'Space buns'], ['pigtails', 'Pigtails'], ['ponytail', 'Ponytail'],
           ['sidepony', 'Side pony'], ['bob', 'Bob'], ['wavy', 'Wavy'], ['long', 'Long'], ['longbangs', 'Long + fringe'],
           ['curlylong', 'Long curls'], ['braids', 'Braids']],
    hairColor: ['black', 'dark', 'brown', 'chestnut', 'auburn', 'copper', 'caramel', 'ginger', 'strawberry', 'honey', 'golden', 'blonde',
                'sandy', 'ash', 'platinum', 'silver', 'cherry', 'pink', 'lilac', 'purple', 'blue', 'teal', 'mint'],
    eyes: [['round', 'Round'], ['sparkle', 'Sparkly'], ['big', 'Big'], ['bright', 'Tall'], ['almond', 'Almond'], ['monolid', 'Monolid'],
           ['cat', 'Cat eye'], ['droopy', 'Gentle'], ['sleepy', 'Dreamy'], ['lashes', 'Lashes'], ['side', 'Side look'], ['dot', 'Button'],
           ['tiny', 'Tiny'], ['smiley', 'Smiley'], ['wink', 'Wink'], ['starry', 'Starry'], ['hearts', 'Heart eyes']],
    eyeColor: ['black', 'dark', 'brown', 'lightbrown', 'amber', 'hazel', 'olive', 'green', 'emerald', 'teal', 'aqua', 'sky', 'blue', 'navy',
               'steel', 'grey', 'silver', 'violet'],
    brows: [['soft', 'Soft'], ['bold', 'Bold'], ['arched', 'Arched'], ['thin', 'Thin'], ['thick', 'Thick'], ['bushy', 'Bushy'],
            ['straight', 'Straight'], ['round', 'Round'], ['angled', 'Angled'], ['tapered', 'Tapered'], ['flick', 'Flick'], ['wavy', 'Wavy'],
            ['brave', 'Brave'], ['high', 'Surprised'], ['short', 'Short'], ['dots', 'Dots'], ['none', 'None']],
    nose: [['button', 'Button'], ['dot', 'Dot'], ['wide', 'Wide'], ['snub', 'Snub'], ['pug', 'Pug'], ['nostrils', 'Nostrils'],
           ['curve', 'Curve'], ['line', 'Little line'], ['pointy', 'Pointy'], ['long', 'Long'], ['triangle', 'Triangle'], ['heart', 'Heart'],
           ['kitty', 'Kitty'], ['cherry', 'Clown'], ['none', 'None']],
    mark: [['none', 'None'], ['dimples', 'Dimples'], ['mole', 'Beauty spot'], ['birthmark', 'Birthmark'], ['plaster', 'Plaster'],
           ['stars', 'Star paint'], ['heart', 'Heart paint'], ['flower', 'Flower paint'], ['moon', 'Moon paint'], ['rainbow', 'Rainbow'],
           ['glitter', 'Glitter'], ['whiskers', 'Whiskers'], ['tiger', 'Tiger stripes']],
    mouth: [['smile', 'Smile'], ['grin', 'Big grin'], ['toothy', 'Toothy'], ['beam', 'Beaming'], ['cheesy', 'Cheese!'], ['gap', 'Gap tooth'],
            ['bunny', 'Bunny teeth'], ['braces', 'Braces'], ['giggle', 'Giggle'], ['tongue', 'Cheeky tongue'], ['smirk', 'Smirk'],
            ['tiny', 'Tiny smile'], ['cat', 'Kitty'], ['lips', 'Pink lips'], ['pout', 'Pout'], ['silly', 'Wiggly'], ['ooh', 'Ooh!']],
    glasses: [['none', 'None'], ['round', 'Round'], ['square', 'Square'], ['oval', 'Oval'], ['tiny', 'Little round'], ['big', 'Big owl'],
              ['bright', 'Bright frames'], ['browline', 'Browline'], ['cateye', 'Cat eye'], ['aviator', 'Aviator'], ['sun', 'Sunglasses'],
              ['heart', 'Hearts'], ['star', 'Party stars'], ['threed', '3D'], ['swim', 'Swim goggles'], ['visor', 'Sporty']],
    outfit: [['tee', 'T-shirt'], ['stripes', 'Stripes'], ['shorts', 'Tee + shorts'], ['overalls', 'Dungarees'], ['jumper', 'Jumper'],
             ['cardigan', 'Cardigan'], ['hoodie', 'Hoodie'], ['tracksuit', 'Tracksuit'], ['jersey', 'Football kit'], ['sailor', 'Sailor top'],
             ['uniform', 'School blazer'], ['raincoat', 'Raincoat'], ['dress', 'Dress'], ['skirt', 'Skirt'], ['tutu', 'Tutu'],
             ['gown', 'Party gown'], ['pyjamas', 'Pyjamas'], ['cape', 'Super cape'], ['dino', 'Dino suit'], ['astro', 'Astronaut']],
    outfitColor: ['red', 'tomato', 'coral', 'orange', 'peach', 'sun', 'lemon', 'gold', 'lime', 'grass', 'green', 'mint', 'teal', 'sky', 'denim',
                  'navy', 'lilac', 'plum', 'berry', 'pink', 'white', 'brown', 'charcoal'],
    hat: [['none', 'None'], ['bow', 'Bow'], ['flower', 'Flower'], ['clips', 'Hair clips'], ['headband', 'Star band'], ['tiara', 'Tiara'],
          ['cap', 'Cap'], ['beanie', 'Beanie'], ['sunhat', 'Sun hat'], ['beret', 'Beret'], ['helmet', 'Bike helmet'], ['cowboy', 'Cowboy hat'],
          ['party', 'Party hat'], ['crown', 'Crown'], ['wizard', 'Wizard hat'], ['pirate', 'Pirate hat'], ['bunny', 'Bunny ears'],
          ['cat', 'Cat ears'], ['hijab', 'Hijab'], ['turban', 'Patka'], ['kippah', 'Kippah']]
  };
  LH.DEFAULT_LOOK = { size: 'kid', skin: 's3', face: 'round', hair: 'crop', hairColor: 'brown', eyes: 'round', eyeColor: 'brown',
    brows: 'soft', nose: 'button', mouth: 'smile', cheeks: true, freckles: false, mark: 'none', glasses: 'none', outfit: 'tee',
    outfitColor: 'tomato', hat: 'none' };
  /* Head coverings hide the hair; a story's crown then sits on top of them (topHat). */
  var COVERS = LH.COVERS = { hijab: true, turban: true };
  var EXTRA = { size: ['adult'], hair: ['tufts', 'bald'], hairColor: ['grey', 'white'], outfit: ['apron', 'robe', 'undies', 'tunic', 'suit'],
                hat: ['elfhat', 'feather', 'kerchief'] };
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
    out.topHat = (typeof look.topHat === 'string' && allowed('hat', look.topHat)) ? look.topHat : null;
    return out;
  };
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function val(o) { return Array.isArray(o) ? o[0] : o; }
  LH.randomLook = function (keep) {
    var o = LH.OPTIONS, l = {};
    Object.keys(o).forEach(function (k) { l[k] = val(pick(o[k])); });
    l.hairColor = pick(['black', 'dark', 'brown', 'brown', 'chestnut', 'auburn', 'copper', 'caramel', 'ginger', 'honey', 'golden', 'blonde',
                        'blonde', 'sandy', 'platinum', 'dark', Math.random() < .15 ? pick(['pink', 'lilac', 'teal', 'mint', 'cherry']) : 'black']);
    if (Math.random() < .5) l.hat = 'none';
    if (Math.random() < .7) l.glasses = 'none';
    if (Math.random() < .7) l.mark = 'none';
    if (Math.random() < .5) l.nose = pick(['button', 'dot', 'snub', 'wide']);
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
  /* Ages 1-12: toddler (age 2) and kid (age 6) are the original two sizes; the others are in between or grow
     towards the adult body. */
  (function () {
    var A1 = { hip: -44, sh: -113, head: -191, hs: 1.07, bw: 94, legx: 18, arm: 52, lw: 25, aw: 18 };
    var anchors = [[1, A1], [2, BODY.toddler], [6, BODY.kid], [18, BODY.adult]];
    function at(age) {
      for (var i = 0; i < anchors.length - 1; i++) {
        var a = anchors[i], b = anchors[i + 1];
        if (age >= a[0] && age <= b[0]) {
          var t = (age - a[0]) / (b[0] - a[0]), out = {};
          Object.keys(a[1]).forEach(function (k) { out[k] = Math.round((a[1][k] + (b[1][k] - a[1][k]) * t) * 100) / 100; });
          return out;
        }
      }
    }
    [1, 3, 4, 5, 7, 8, 9, 10, 11, 12].forEach(function (n) { BODY['a' + n] = at(n); });
  })();
  LH.BODY = BODY;
  var FACE = {
    round: { hw: 74, d: null, e: [28, 4] }, oval: { hw: 66, e: [25, 4] }, heart: { hw: 72, e: [28, 2] },
    square: { hw: 70, e: [28, 4] }, chubby: { hw: 80, e: [30, 8] },
    long: { hw: 62, e: [24, 6] }, wide: { hw: 82, e: [31, 8] }, moon: { hw: 80, e: [30, 6] }, small: { hw: 64, e: [24, 10] },
    egg: { hw: 70, e: [27, 2] }, pear: { hw: 68, e: [26, 6] }, apple: { hw: 76, e: [28, 6] }, diamond: { hw: 72, e: [27, 4] },
    elfin: { hw: 68, e: [26, 0] }, rounded: { hw: 72, e: [28, 4] }, jaw: { hw: 72, e: [28, 4] }
  };
  var FACES = {
    heart: 'M0 80 C-30 78 -64 52 -71 12 C-78 -38 -46 -78 0 -78 C46 -78 78 -38 71 12 C64 52 30 78 0 80Z',
    square: 'M-70 -38 Q-70 -76 -32 -76 L32 -76 Q70 -76 70 -38 L70 30 Q70 76 24 78 L-24 78 Q-70 76 -70 30Z',
    egg: 'M0 -80 C48 -80 74 -44 72 2 C70 50 40 80 0 80 C-40 80 -70 50 -72 2 C-74 -44 -48 -80 0 -80Z',
    pear: 'M0 -76 C-40 -76 -60 -50 -64 -10 C-72 30 -62 76 0 78 C62 76 72 30 64 -10 C60 -50 40 -76 0 -76Z',
    apple: 'M0 -74 C40 -74 64 -54 74 -14 C84 30 60 78 0 78 C-60 78 -84 30 -74 -14 C-64 -54 -40 -74 0 -74Z',
    diamond: 'M0 -78 C-34 -78 -58 -46 -74 0 C-62 50 -30 80 0 80 C30 80 62 50 74 0 C58 -46 34 -78 0 -78Z',
    elfin: 'M0 86 C-18 84 -56 60 -68 20 C-78 -36 -46 -78 0 -78 C46 -78 78 -36 68 20 C56 60 18 84 0 86Z',
    rounded: 'M-72 -30 Q-72 -78 -24 -78 L24 -78 Q72 -78 72 -30 L72 22 Q72 78 0 78 Q-72 78 -72 22Z',
    jaw: 'M-70 -36 C-70 -70 -40 -80 0 -80 C40 -80 70 -70 70 -36 L72 34 Q60 76 0 78 Q-60 76 -72 34Z'
  };
  function facePath(shape, fill, ink) {
    if (shape === 'oval') return ell(0, 0, 66, 81, fill, ink, 4.5);
    if (shape === 'chubby') return ell(0, 4, 80, 72, fill, ink, 4.5);
    if (shape === 'long') return ell(0, 4, 62, 84, fill, ink, 4.5);
    if (shape === 'wide') return ell(0, 6, 82, 70, fill, ink, 4.5);
    if (shape === 'moon') return circ(0, 2, 80, fill, ink, 4.5);
    if (shape === 'small') return ell(0, 8, 64, 68, fill, ink, 4.5);
    if (FACES[shape]) return path(FACES[shape], fill, ink, 4.5);
    return ell(0, 0, 74, 76, fill, ink, 4.5);
  }

  /* ------------------------------------------------------------------ hair */
  var FRONT = {
    crop: 'M-77 -2 C-84 -62 -48 -92 0 -92 C48 -92 84 -62 77 -2 C72 -26 64 -38 52 -44 C44 -34 30 -36 20 -48 C10 -36 -10 -36 -20 -48 C-30 -36 -44 -34 -52 -44 C-64 -38 -72 -26 -77 -2Z',
    swoop: 'M-78 4 C-86 -60 -50 -94 4 -94 C56 -94 86 -60 78 -2 C74 -22 68 -32 60 -38 C34 -26 -6 -34 -36 -62 C-46 -38 -64 -20 -78 4Z',
    spiky: 'M-77 -2 C-80 -36 -72 -56 -62 -66 L-72 -96 L-42 -84 L-34 -114 L-10 -90 L4 -118 L20 -90 L44 -112 L48 -82 L76 -92 L66 -62 C78 -48 82 -28 77 -2 C70 -28 58 -42 42 -46 C22 -40 -20 -40 -42 -46 C-58 -42 -70 -28 -77 -2Z',
    sleek: 'M-76 0 C-82 -58 -48 -90 0 -90 C48 -90 82 -58 76 0 C68 -40 40 -58 0 -60 C-40 -58 -68 -40 -76 0Z',
    part: 'M-80 30 C-88 -58 -50 -94 0 -94 C50 -94 88 -58 80 30 C74 -18 52 -48 8 -60 L0 -48 L-8 -60 C-52 -48 -74 -18 -80 30Z',
    bangs: 'M-80 14 C-86 -58 -50 -96 0 -96 C50 -96 86 -58 80 14 C74 -6 70 -24 66 -32 C30 -26 -30 -26 -66 -32 C-70 -24 -74 -6 -80 14Z',
    buzz: 'M-76 -8 C-80 -60 -46 -86 0 -86 C46 -86 80 -60 76 -8 C70 -40 46 -60 0 -62 C-46 -60 -70 -40 -76 -8Z',
    mohawk: 'M-18 -66 L-24 -126 L-8 -110 L0 -136 L8 -110 L24 -124 L18 -66 Q0 -74 -18 -66Z',
    sidepart: 'M-80 10 C-88 -60 -52 -96 -24 -96 C30 -100 88 -70 78 -4 C72 -28 60 -42 46 -48 C20 -50 -10 -60 -26 -80 C-36 -50 -58 -24 -80 10Z',
    bowl: 'M-80 12 C-86 -62 -50 -98 0 -98 C50 -98 86 -62 80 12 L72 12 C72 -10 70 -22 68 -30 L-68 -30 C-70 -22 -72 -10 -72 12Z',
    quiff: 'M-77 -2 C-84 -62 -56 -90 -20 -94 C-30 -120 30 -136 62 -110 C40 -114 20 -108 14 -96 C56 -92 84 -62 77 -2 C72 -26 62 -40 50 -46 C30 -40 -30 -40 -50 -46 C-62 -40 -72 -26 -77 -2Z',
    mop: 'M-82 20 C-90 -60 -50 -98 0 -98 C50 -98 90 -60 82 20 L72 0 L66 -20 L52 -14 L44 -34 L28 -24 L16 -40 L0 -26 L-14 -40 L-28 -24 L-42 -36 L-52 -14 L-66 -22 L-72 0Z',
    pixie: 'M-78 4 C-84 -60 -48 -94 0 -94 C48 -94 84 -60 78 -6 C74 -30 62 -44 50 -48 C30 -40 10 -24 -24 -12 C-44 -4 -64 -6 -78 4Z'
  };
  var LONG = 'M-92 140 C-104 0 -72 -100 0 -100 C72 -100 104 0 92 140 Q60 150 40 136 L-40 136 Q-60 150 -92 140Z';
  function bunAt(x, y, r, hc, ink) { return blob(arc(x, y, r * .62, r * .9, 0, 330, 7).concat([[x, y, r]]), hc, ink, 4.5); }
  function hairBack(l, hc, ink, acc) {
    var h = l.hair;
    if (COVERS[l.hat]) return '';
    if (h === 'bob') return path('M-90 54 C-100 -40 -62 -100 0 -100 C62 -100 100 -40 90 54 Q84 62 74 56 L-74 56 Q-84 62 -90 54Z', hc, ink, 4.5);
    if (h === 'long' || h === 'longbangs') return path(LONG, hc, ink, 4.5);
    if (h === 'mop') return path('M-88 40 C-98 -40 -60 -100 0 -100 C60 -100 98 -40 88 40 L78 28 L72 48 L60 36 L-60 36 L-72 48 L-78 28Z', hc, ink, 4.5);
    if (h === 'wavy') return path('M-90 92 C-104 0 -72 -100 0 -100 C72 -100 104 0 90 92 Q80 106 68 92 Q58 106 46 94 L-46 94 Q-58 106 -68 92 Q-80 106 -90 92Z', hc, ink, 4.5);
    if (h === 'curlylong') {
      var cs = [[0, -30, 90]];
      for (var cy = -16; cy <= 112; cy += 26) { cs.push([-84, cy, 24]); cs.push([84, cy, 24]); }
      return blob(cs.concat(arc(0, -30, 88, 24, 180, 360, 9)), hc, ink, 4.5);
    }
    if (h === 'locs') {
      var L = path('M-86 30 C-98 -50 -60 -100 0 -100 C60 -100 98 -50 86 30Z', hc, ink, 4.5);
      [-92, -78, -64, 64, 78, 92].forEach(function (x, i) {
        var d = 'M' + x + ' -30 Q' + (x + (x < 0 ? -6 : 6)) + ' 40 ' + x + ' ' + (112 + (i % 2) * 12);
        L += path(d, 'none', ink, 21) + path(d, 'none', hc, 13);
      });
      return L;
    }
    if (h === 'spacebuns') return bunAt(-52, -92, 22, hc, ink) + bunAt(52, -92, 22, hc, ink);
    if (h === 'puff') return bunAt(0, -116, 36, hc, ink);
    if (h === 'sidepony') return path('M-56 -60 C-124 -48 -124 56 -100 116 C-90 74 -82 34 -66 -8Z', hc, ink, 4.5) + circ(-62, -54, 9, acc, ink, 3.5);
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
    if (h === 'none' || h === 'bald' || COVERS[l.hat]) return '';
    if (h === 'buzz' || h === 'sidepart' || h === 'bowl' || h === 'quiff' || h === 'mop' || h === 'pixie') return path(FRONT[h], hc, ink, h === 'buzz' ? 3.5 : 4.5);
    if (h === 'mohawk') return path(FRONT.buzz, hc, null, 0, ' opacity=".45"') + path(FRONT.mohawk, hc, ink, 4.5);
    if (h === 'wavy') return path(FRONT.part, hc, ink, 4.5);
    if (h === 'longbangs') return path(FRONT.bangs, hc, ink, 4.5);
    if (h === 'curlylong') return blob(arc(0, -10, 68, 22, 195, 345, 9).concat([[0, -66, 32], [-32, -60, 28], [32, -60, 28]]), hc, ink, 4.5);
    if (h === 'locs') return path(FRONT.sleek, hc, ink, 4.5) + [-74, 74].map(function (x) {
      var d = 'M' + x + ' -24 Q' + (x * 1.1) + ' 24 ' + (x * 1.06) + ' 66';
      return path(d, 'none', ink, 19) + path(d, 'none', hc, 11);
    }).join('');
    if (h === 'knots') return path(FRONT.sleek, hc, ink, 4.5) + [[-58, -70], [-30, -94], [0, -102], [30, -94], [58, -70]].map(function (k) {
      return circ(k[0], k[1], 14, hc, ink, 4) + path('M' + (k[0] - 6) + ' ' + (k[1] + 1) + ' Q' + k[0] + ' ' + (k[1] - 9) + ' ' + (k[0] + 6) + ' ' + (k[1] + 1), 'none', shade(hc, .35), 2.5);
    }).join('');
    if (h === 'cornrows') {
      var rows = '';
      [-2, -1, 0, 1, 2].forEach(function (i) {
        rows += path('M' + (i * 24) + ' ' + (-58 + Math.abs(i) * 6) + ' Q' + (i * 20) + ' -78 ' + (i * 11) + ' -89', 'none', shade(hc, .35), 3);
      });
      return path(FRONT.sleek, hc, ink, 4.5) + rows;
    }
    if (h === 'spacebuns' || h === 'sidepony' || h === 'puff') return path(FRONT.sleek, hc, ink, 4.5);
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
  /* An eye shape (white) with the iris clipped inside it. */
  function clipEye(d, inner, ink, sw) {
    var id = LH.uid('ey');
    return '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>' + path(d, '#fff') + '<g clip-path="url(#' + id + ')">' + inner + '</g>' + path(d, 'none', ink, sw || 3.5);
  }
  var KEEP_WOW = { sparkle: 1, big: 1, bright: 1, lashes: 1, starry: 1, hearts: 1 };
  function eyes(l, mood, ink, ex, ey) {
    // Side-specific shapes are drawn for the eye on the right of the picture (outer corner at +x) and mirrored for the other.
    var shape = l.eyes, ec = LH.COL.eye[l.eyeColor], one, right = null, mir = false, D = '#1B1530';
    var closed = path('M-12 4 Q0 -10 12 4', 'none', ink, 4.5);
    var round = ell(0, 0, 13, 14, '#fff', ink, 3.5) + circ(0, 1, 9, ec) + circ(0, 1, 4.6, D) + circ(3, -3, 3, '#fff');
    if (mood === 'sleep') one = path('M-12 0 Q0 10 12 0', 'none', ink, 4.5);
    else if (mood === 'laugh' || (shape === 'smiley' && mood !== 'wow')) one = closed;
    else {
      if (mood === 'wow' && !KEEP_WOW[shape]) shape = 'round';
      if (shape === 'wink') { right = closed; shape = 'round'; }
      if (shape === 'sparkle') one = ell(0, 0, 15, 17, '#fff', ink, 3.5) + circ(0, 2, 11.5, ec) + circ(0, 2, 6, D) + circ(4, -4, 4, '#fff') + circ(-4, 7, 2, '#fff');
      else if (shape === 'almond') one = path('M-15 2 Q0 -14 15 2 Q0 13 -15 2Z', '#fff', ink, 3.5) + circ(0, 1.5, 6.5, ec) + circ(0, 1.5, 3.4, D) + circ(2.4, -1.4, 2.2, '#fff');
      else if (shape === 'dot') one = circ(0, 0, 8.5, shade(ec, -.6)) + circ(2.6, -2.8, 2.6, '#fff');
      else if (shape === 'tiny') one = circ(0, 1, 5.5, shade(ec, -.6)) + circ(1.8, -.8, 1.8, '#fff');
      else if (shape === 'big') one = ell(0, -1, 17, 19, '#fff', ink, 3.5) + circ(0, 2, 12.5, ec) + circ(0, 2, 6.5, D) + circ(5, -4, 4.5, '#fff') + circ(-5, 8, 2.2, '#fff');
      else if (shape === 'bright') one = ell(0, 0, 11, 16, '#fff', ink, 3.5) + ell(0, 2, 8, 11.5, ec) + ell(0, 2, 4, 6, D) + circ(2.5, -3, 2.6, '#fff');
      else if (shape === 'lashes') { one = round + path('M9 -10 L15 -17 M12.5 -5 L19.5 -8 M4 -13 L6 -20', 'none', ink, 3.5); mir = true; }
      else if (shape === 'starry') one = ell(0, 0, 14, 15, '#fff', ink, 3.5) + circ(0, 1, 10, ec) + star(0, 1, 7.5, '#FFE27A', D, 1.5);
      else if (shape === 'hearts') one = ell(0, 0, 14, 15, '#fff', ink, 3.5) + circ(0, 1, 10, ec) +
        path('M0 7 C-8 1 -8 -5 -4 -5 C-1.5 -5 0 -3 0 -2 C0 -3 1.5 -5 4 -5 C8 -5 8 1 0 7Z', '#FF4F7E') + circ(3.5, -4.5, 1.8, '#fff');
      else if (shape === 'sleepy') one = clipEye('M-14 1 Q0 -7 14 1 Q0 14 -14 1Z', circ(0, 4, 8, ec) + circ(0, 4, 4, D) + circ(3, 1, 2.2, '#fff'), ink) + path('M-15 1 Q0 -8 15 1', 'none', ink, 5);
      else if (shape === 'monolid') one = clipEye('M-15 2 Q0 -8 15 2 Q0 11 -15 2Z', circ(0, 3, 6.5, ec) + circ(0, 3, 3.4, D) + circ(2, 1, 1.8, '#fff'), ink, 3) + path('M-16 1 Q0 -11 16 1', 'none', ink, 4.5);
      else if (shape === 'cat') { one = clipEye('M-15 3 Q-2 -11 16 -7 Q5 12 -15 3Z', circ(1, 1, 7, ec) + ell(1, 1, 2.2, 5.5, D) + circ(3, -2, 1.8, '#fff'), ink); mir = true; }
      else if (shape === 'droopy') { one = clipEye('M-15 -3 Q0 -12 15 3 Q-1 12 -15 -3Z', circ(-1, 1, 7, ec) + circ(-1, 1, 3.6, D) + circ(1, -2, 2, '#fff'), ink); mir = true; }
      else if (shape === 'side') one = clipEye('M-13 0 A13 14 0 1 0 13 0 A13 14 0 1 0 -13 0Z', circ(6, 1, 9, ec) + circ(7, 1, 4.6, D) + circ(9, -3, 2.6, '#fff'), ink);
      else one = round;
    }
    function put(x, flip, svg) { return '<g transform="translate(' + x + ' ' + ey + ')' + (flip ? ' scale(-1,1)' : '') + '">' + svg + '</g>'; }
    return put(-ex, mir, one) + put(ex, false, right || one);
  }
  /* Brows: [path, width, extra lift]. The left brow is drawn as is (outer end at -x), the right one mirrored. */
  var BROWS = {
    soft: [null, 4.5], bold: [null, 7], arched: ['M-13 4 Q-2 -10 13 0', 4.5], thin: [null, 3], thick: [null, 9],
    straight: ['M-12 0 L12 0', 5], round: ['M-13 5 Q0 -12 13 5', 5], angled: ['M12 2 L-3 -6 L-13 0', 5],
    bushy: ['M-15 3 Q0 -9 15 2', 11], short: ['M-6 1 Q0 -3 6 1', 6.5], wavy: ['M-13 2 Q-6 -6 0 0 Q6 5 13 -3', 4.5],
    high: [null, 4.5, -8], flick: ['M12 3 Q-2 -6 -10 -2 L-15 -8', 5], brave: ['M-12 -5 Q0 -3 12 3', 6]
  };
  function brows(l, mood, bc, ex, ey) {
    var b = l.brows;
    if (b === 'none') return '';
    var spec = BROWS[b] || BROWS.soft, w = spec[1] || 4.5, y = ey - 26 - (mood === 'wow' ? 7 : 0) + (spec[2] || 0);
    var d = spec[0] || 'M-12 2 Q0 -6 12 2', one;
    if ((mood === 'oops' || mood === 'sad') && b !== 'dots' && b !== 'tapered') d = 'M-12 2 Q2 0 12 -7';
    if (b === 'dots') one = ell(2, 0, 6, 4.5, bc);
    else if (b === 'tapered') one = path('M13 -1 Q0 -11 -13 -1 Q0 -3 13 5Z', bc, bc, 2);
    else one = path(d, 'none', bc, w);
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
    if (m === 'tongue') return path('M-7 41 Q-8 58 0 58 Q8 58 7 41Z', tongue, ink, 3.5) + path('M0 45 L0 52', 'none', shade(tongue, -.25), 2) + path('M-17 36 Q0 52 17 36', 'none', ink, 4.5);
    if (m === 'gap') return path('M-19 34 Q0 62 19 34 Z', red, ink, 4) + ell(0, 48, 9, 5, tongue) + path('M-12 35.5 L-3 35.5 L-3 42 L-11 42Z', '#fff') + path('M3 35.5 L12 35.5 L11 42 L3 42Z', '#fff');
    if (m === 'bunny') return '<rect x="-7" y="42.5" width="6.5" height="9" rx="1.5" fill="#fff" stroke="' + ink + '" stroke-width="2.5"/><rect x=".5" y="42.5" width="6.5" height="9" rx="1.5" fill="#fff" stroke="' + ink + '" stroke-width="2.5"/>' +
      path('M-17 36 Q0 50 17 36', 'none', ink, 4.5);
    if (m === 'smirk') return path('M-14 42 Q4 48 18 33', 'none', ink, 4.5);
    if (m === 'tiny') return path('M-7 40 Q0 45 7 40', 'none', ink, 4);
    if (m === 'cat') return path('M-14 37 Q-7 46 0 39 Q7 46 14 37', 'none', ink, 4.5);
    if (m === 'braces') return path('M-19 34 Q0 62 19 34 Z', red, ink, 4) + ell(0, 48, 9, 5, tongue) + path('M-12 35.5 L12 35.5 L11 42 L-11 42Z', '#fff') +
      path('M-12 39 L12 39', 'none', '#9AA3B5', 2.5) + [-9, -3.5, 2, 7.5].map(function (x) { return '<rect x="' + x + '" y="37.4" width="3.2" height="3.2" fill="#C5CBD8"/>'; }).join('');
    if (m === 'beam') return path('M-22 32 L22 32 Q21 64 0 64 Q-21 64 -22 32Z', red, ink, 4) + ell(0, 55, 11, 6, tongue) + path('M-19 34 L19 34 L18 40 L-18 40Z', '#fff');
    if (m === 'pout') return ell(0, 43, 7, 5.5, '#E06A80', ink, 3) + path('M-4 43 L4 43', 'none', '#A8435A', 1.5);
    if (m === 'lips') return path('M-16 38 Q-8 33 0 36.5 Q8 33 16 38 Q0 52 -16 38Z', '#E46F86', ink, 3.5) + path('M-14 38.5 Q0 42 14 38.5', 'none', '#A8435A', 2);
    if (m === 'silly') return path('M-18 40 Q-12 33 -6 40 Q0 47 6 40 Q12 33 18 40', 'none', ink, 4.5);
    if (m === 'cheesy') return path('M-20 35 Q0 58 20 35 Z', '#fff', ink, 3.5) + path('M-18 39 Q0 47 18 39', 'none', ink, 2) + path('M-7 37.5 L-7.5 46 M7 37.5 L7.5 46', 'none', ink, 1.8);
    return path('M-17 36 Q0 52 17 36', 'none', ink, 4.5);
  }
  function nose(l, skin, ink) {
    var n = l.nose, mid = shade(skin, -.16), dk = shade(skin, -.4);
    if (n === 'none') return '';
    if (n === 'dot') return circ(0, 22, 3.6, shade(skin, -.35));
    if (n === 'curve') return path('M-1 12 Q9 21 -1 27', 'none', dk, 3.5);
    if (n === 'line') return path('M-6 25 Q0 29 6 25', 'none', dk, 3.5);
    if (n === 'wide') return ell(0, 22, 12, 6.5, mid);
    if (n === 'snub') return ell(0, 20, 8, 6, mid) + circ(-3.5, 23, 1.8, dk) + circ(3.5, 23, 1.8, dk);
    if (n === 'nostrils') return circ(-4.5, 23, 2.4, dk) + circ(4.5, 23, 2.4, dk);
    if (n === 'pointy') return path('M3 6 Q-9 22 -3 26 Q2 28 6 25', 'none', dk, 3.5);
    if (n === 'triangle') return path('M0 13 L9 26 Q0 29 -9 26Z', mid);
    if (n === 'long') return path('M0 2 Q9 22 2 28 Q-3 30 -7 26', 'none', dk, 3.5);
    if (n === 'pug') return ell(0, 22, 12, 8, mid) + circ(-4.5, 24, 2.2, dk) + circ(4.5, 24, 2.2, dk);
    if (n === 'cherry') return circ(0, 20, 9, '#FF6F7D', ink, 3) + circ(-3, 16.5, 2.6, '#fff', null, 0, ' opacity=".8"');
    if (n === 'heart') return path('M0 28 C-11 21 -10 12 -5 12 C-2 12 0 14.5 0 16 C0 14.5 2 12 5 12 C10 12 11 21 0 28Z', shade(skin, -.22));
    if (n === 'kitty') return path('M-7 18 L7 18 L0 26Z', '#FF9FB2', ink, 2.5);
    return ell(0, 22, 7, 5, mid);
  }
  var HEART = 'M0 9 C-11 2 -12 -7 -6 -8 C-3 -8.5 -1 -6 0 -4 C1 -6 3 -8.5 6 -8 C12 -7 11 2 0 9Z';
  function spark(x, y, r, fill) { return path('M' + x + ' ' + (y - r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z', fill, INK, 1.5); }
  /* Face paint and little marks (look.mark), on the cheek on the right of the picture unless it comes in pairs. */
  function marks(l, skin, ink, ex, ey) {
    var m = l.mark, cx = ex + 20, cy = ey + 26, dk = shade(skin, -.45);
    function pair(svg) { return svg + mirror(svg); }
    if (!m || m === 'none') return '';
    if (m === 'dimples') return pair(path('M' + (-ex - 16) + ' ' + (ey + 34) + ' q1 5 5 6', 'none', dk, 2.5));
    if (m === 'mole') return circ(ex + 22, ey + 40, 3.2, shade(skin, -.55));
    if (m === 'birthmark') return path('M' + (-cx + 2) + ' ' + (ey + 8) + ' c6 -6 14 -3 13 3 c-1 7 -10 9 -15 5 c-3 -3 -2 -6 2 -8Z', shade(skin, -.2));
    if (m === 'plaster') return '<g transform="translate(' + cx + ' ' + (cy - 2) + ') rotate(-28)"><rect x="-17" y="-7" width="34" height="14" rx="6" fill="#F3CFA2" stroke="' + ink + '" stroke-width="2.5"/><rect x="-6" y="-5" width="12" height="10" rx="2" fill="#E3AE7C"/></g>';
    if (m === 'stars') return star(cx + 2, cy - 2, 11, '#FFC93C', ink, 2.5) + star(cx - 12, cy + 10, 6, '#4EA8F5', ink, 2);
    if (m === 'heart') return '<g transform="translate(' + cx + ' ' + cy + ')">' + path(HEART, '#FF5C8A', ink, 2.5) + '</g>';
    if (m === 'flower') return [0, 72, 144, 216, 288].map(function (a) { var r = a * Math.PI / 180; return circ(cx + 6 * Math.cos(r), cy + 6 * Math.sin(r), 4.6, '#FF8FB8', ink, 1.5); }).join('') + circ(cx, cy, 3.6, '#FFC93C', ink, 1.5);
    if (m === 'moon') return path('M' + (cx + 4) + ' ' + (cy - 10) + ' A10 10 0 1 0 ' + (cx + 4) + ' ' + (cy + 10) + ' A7.5 7.5 0 1 1 ' + (cx + 4) + ' ' + (cy - 10) + 'Z', '#FFE27A', ink, 2);
    if (m === 'rainbow') return [['#EF5A36', 12], ['#FFC93C', 8.5], ['#4EA8F5', 5]].map(function (c) {
      return path('M' + (cx - c[1]) + ' ' + (cy + 6) + ' A' + c[1] + ' ' + c[1] + ' 0 0 1 ' + (cx + c[1]) + ' ' + (cy + 6), 'none', c[0], 3.5);
    }).join('');
    if (m === 'glitter') return spark(ex + 24, ey - 4, 7, '#FFC93C') + spark(ex + 31, ey + 12, 4.5, '#B48CF0') + spark(ex + 18, ey + 19, 3.5, '#FFC93C');
    if (m === 'whiskers') return pair(path('M' + (-ex - 6) + ' ' + (ey + 28) + ' l-26 -5 M' + (-ex - 6) + ' ' + (ey + 34) + ' l-28 1 M' + (-ex - 6) + ' ' + (ey + 40) + ' l-25 7', 'none', ink, 2.5));
    if (m === 'tiger') return pair(path('M' + (-ex - 30) + ' ' + (ey + 18) + ' l16 5 M' + (-ex - 32) + ' ' + (ey + 30) + ' l18 2 M' + (-ex - 30) + ' ' + (ey + 42) + ' l15 -3', 'none', '#FF8A2A', 4.5));
    return '';
  }
  function glasses(l, ink, ex, ey, oc) {
    var g = l.glasses;
    if (g === 'none') return '';
    var tint = 'rgba(255,255,255,.22)';
    if (g === 'round') return circ(-ex, ey, 19, tint, ink, 4) + circ(ex, ey, 19, tint, ink, 4) + path('M' + (-ex + 19) + ' ' + ey + ' Q0 ' + (ey - 8) + ' ' + (ex - 19) + ' ' + ey, 'none', ink, 4);
    if (g === 'square') return '<rect x="' + (-ex - 21) + '" y="' + (ey - 16) + '" width="42" height="32" rx="9" fill="' + tint + '" stroke="' + ink + '" stroke-width="4"/>' +
      '<rect x="' + (ex - 21) + '" y="' + (ey - 16) + '" width="42" height="32" rx="9" fill="' + tint + '" stroke="' + ink + '" stroke-width="4"/>' + path('M' + (-ex + 21) + ' ' + ey + ' L' + (ex - 21) + ' ' + ey, 'none', ink, 4);
    if (g === 'star') return star(-ex, ey + 1, 26, 'rgba(255,201,60,.35)', '#EF5A36', 4.5) + star(ex, ey + 1, 26, 'rgba(255,201,60,.35)', '#EF5A36', 4.5) + path('M' + (-ex + 14) + ' ' + ey + ' L' + (ex - 14) + ' ' + ey, 'none', '#EF5A36', 4);
    function both(fn) { return fn(-ex, -1) + fn(ex, 1); }
    function at(x, s, svg, sc) { return '<g transform="translate(' + x + ' ' + ey + ')' + (s < 0 ? ' scale(-1,1)' : '') + (sc ? ' scale(' + sc + ')' : '') + '">' + svg + '</g>'; }
    function bridge(gap, col, w, dy) { dy = dy || 0; return path('M' + (-ex + gap) + ' ' + (ey + dy) + ' Q0 ' + (ey - 8 + dy) + ' ' + (ex - gap) + ' ' + (ey + dy), 'none', col || ink, w || 4); }
    if (g === 'oval') return both(function (x) { return ell(x, ey, 21, 15, tint, ink, 4); }) + bridge(21);
    if (g === 'big') return both(function (x) { return circ(x, ey, 25, tint, ink, 6); }) + bridge(25, ink, 5);
    if (g === 'tiny') return both(function (x) { return circ(x, ey + 2, 12, tint, ink, 3.5); }) + bridge(12, ink, 3, 2);
    if (g === 'bright') return both(function (x) { return circ(x, ey, 20, tint, ink, 9) + circ(x, ey, 20, 'none', oc, 4.5); }) + bridge(20, ink, 8) + bridge(20, oc, 4);
    if (g === 'cateye') return both(function (x, s) { return at(x, s, path('M-19 -6 Q-4 -14 26 -16 Q24 14 2 14 Q-19 14 -19 -6Z', tint, ink, 4.5)); }) + bridge(19);
    if (g === 'browline') return both(function (x) { return at(x, 1, path('M-20 -10 Q-20 15 0 15 Q20 15 20 -10', tint, ink, 2.5) + path('M-22 -11 L22 -11', 'none', ink, 8)); }) +
      path('M' + (-ex + 22) + ' ' + (ey - 9) + ' L' + (ex - 22) + ' ' + (ey - 9), 'none', ink, 4);
    if (g === 'aviator') {
      var gold = '#C99A2E', av = 'M-21 -12 L21 -12 Q23 6 11 14 Q0 18 -11 14 Q-23 6 -21 -12Z';
      return both(function (x) { return at(x, 1, path(av, 'rgba(120,180,240,.35)', ink, 7) + path(av, 'none', gold, 3.5)); }) +
        path('M' + (-ex + 21) + ' ' + (ey - 10) + ' L' + (ex - 21) + ' ' + (ey - 10), 'none', gold, 3.5) + bridge(21, gold, 3.5);
    }
    if (g === 'heart') return both(function (x) { return at(x, 1, path('M0 14 C-22 2 -24 -14 -12 -15 C-5 -16 -1 -11 0 -8 C1 -11 5 -16 12 -15 C24 -14 22 2 0 14Z', 'rgba(255,143,184,.35)', '#E8457A', 3.5), 1.15); }) + bridge(16, '#E8457A');
    if (g === 'sun') return both(function (x) { return '<rect x="' + (x - 22) + '" y="' + (ey - 14) + '" width="44" height="29" rx="12" fill="#2B2350" stroke="' + ink + '" stroke-width="4"/>' + path('M' + (x - 12) + ' ' + (ey - 6) + ' l8 -3', 'none', '#fff', 3, ' opacity=".7"'); }) + bridge(22);
    if (g === 'swim') {
      var strap = 'M-78 ' + ey + ' L' + (-ex - 20) + ' ' + ey + ' M' + (ex + 20) + ' ' + ey + ' L78 ' + ey;
      return path(strap, 'none', ink, 10) + path(strap, 'none', oc, 6) + both(function (x) { return ell(x, ey, 20, 15, 'rgba(120,200,245,.45)', ink, 4.5) + ell(x, ey, 20, 15, 'none', oc, 2.5); }) + bridge(20);
    }
    if (g === 'threed') return both(function (x, s) {
      var r = '<rect x="' + (x - 20) + '" y="' + (ey - 13) + '" width="40" height="27" rx="4" fill="';
      return r + (s < 0 ? 'rgba(239,90,54,.55)' : 'rgba(78,168,245,.55)') + '" stroke="' + ink + '" stroke-width="9"/>' + r + 'none" stroke="#F7F3EA" stroke-width="4.5"/>';
    }) + bridge(20, ink, 8) + bridge(20, '#F7F3EA', 4);
    if (g === 'visor') {
      var vx = ex + 26;
      return path('M' + (-vx) + ' ' + (ey - 14) + ' Q0 ' + (ey - 20) + ' ' + vx + ' ' + (ey - 14) + ' Q' + (vx + 2) + ' ' + (ey + 14) + ' ' + ex + ' ' + (ey + 14) + ' Q0 ' + (ey + 8) + ' ' + (-ex) + ' ' + (ey + 14) + ' Q' + (-vx - 2) + ' ' + (ey + 14) + ' ' + (-vx) + ' ' + (ey - 14) + 'Z', 'rgba(78,168,245,.45)', ink, 4.5) +
        path('M' + (-vx + 10) + ' ' + (ey - 8) + ' l14 -2', 'none', '#fff', 3, ' opacity=".8"');
    }
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
    var dk = shade(oc, -.22);
    if (h === 'hijab') {
      var outer = 'M0 -102 C64 -102 100 -58 98 10 C97 58 94 92 116 128 Q0 150 -116 128 C-94 92 -97 58 -98 10 C-100 -58 -64 -102 0 -102Z';
      var hole = 'M0 -72 C38 -72 62 -42 62 4 C62 48 36 76 0 76 C-36 76 -62 48 -62 4 C-62 -42 -38 -72 0 -72Z';
      return '<path d="' + outer + ' ' + hole + '" fill="' + oc + '" fill-rule="evenodd" stroke="' + ink + '" stroke-width="4.5" stroke-linejoin="round"/>' +
        path('M-74 92 Q0 120 74 92', 'none', dk, 3.5) + path('M-74 -30 Q-86 30 -70 76', 'none', dk, 3);
    }
    if (h === 'turban') return path('M-80 -14 C-90 -92 -42 -122 0 -122 C42 -122 90 -92 80 -14 C52 -34 -52 -34 -80 -14Z', oc, ink, 4.5) +
      path('M-72 -36 Q-10 -84 66 -96', 'none', dk, 4) + path('M-76 -24 Q0 -64 74 -58', 'none', dk, 4) + path('M-20 -32 L0 -50 L20 -32', 'none', dk, 3.5);
    if (h === 'kippah') return path('M-52 -80 Q0 -124 52 -80 Q0 -92 -52 -80Z', oc, ink, 4) + path('M-38 -87 Q0 -110 38 -87', 'none', shade(oc, .45), 3.5);
    if (h === 'sunhat') return ell(0, -60, 116, 20, shade(oc, .35), ink, 4.5) + path('M-58 -62 C-60 -122 60 -122 58 -62Z', shade(oc, .35), ink, 4.5) + path('M-57 -72 Q0 -62 57 -72', 'none', oc, 9);
    if (h === 'beret') return path('M-82 -44 C-100 -96 36 -128 94 -76 C86 -54 -36 -40 -82 -44Z', oc, ink, 4.5) + path('M2 -108 l3 -12', 'none', ink, 6);
    if (h === 'party') return '<g transform="translate(-26 -86) rotate(-16)">' + path('M-32 0 L0 -94 L32 0 Q0 8 -32 0Z', oc, ink, 4.5) + circ(-8, -22, 5, '#fff') + circ(10, -44, 5, '#FFC93C') +
      circ(-2, -66, 4, '#fff') + bunAt(0, -98, 10, '#FFC93C', ink) + '</g>';
    if (h === 'wizard') return path('M-52 -64 L22 -166 L54 -64Z', shade(oc, -.3), ink, 4.5) + star(14, -118, 12, '#FFC93C', ink, 3) + star(-16, -84, 8, '#FFC93C', ink, 2.5) +
      star(30, -86, 7, '#fff', ink, 2.5) + ell(0, -64, 96, 15, shade(oc, -.3), ink, 4.5);
    if (h === 'cowboy') return path('M-50 -72 C-56 -124 -22 -116 0 -124 C22 -116 56 -124 50 -72Z', oc, ink, 4.5) + path('M-50 -82 Q0 -76 50 -82', 'none', shade(oc, -.35), 7) +
      path('M-118 -78 Q-110 -54 -60 -62 Q0 -52 60 -62 Q110 -54 118 -78 Q96 -66 56 -74 Q0 -66 -56 -74 Q-96 -66 -118 -78Z', oc, ink, 4.5);
    if (h === 'pirate') return path('M-104 -58 Q-66 -136 0 -104 Q66 -136 104 -58 Q0 -86 -104 -58Z', '#2B2350', ink, 4.5) + path('M-94 -63 Q0 -88 94 -63', 'none', '#FFC93C', 4) +
      circ(0, -94, 10, '#fff') + circ(-3.5, -95, 2.4, '#2B2350') + circ(3.5, -95, 2.4, '#2B2350') + path('M-12 -78 L12 -86 M-12 -86 L12 -78', 'none', '#fff', 3.5);
    if (h === 'bunny') {
      var ear = ell(-30, -122, 17, 42, '#F7F3EA', ink, 4, ' transform="rotate(-14 -30 -122)"') + ell(-30, -120, 8, 29, '#FFB3C8', null, 0, ' transform="rotate(-14 -30 -120)"');
      return ear + mirror(ear) + path('M-76 -34 C-64 -96 64 -96 76 -34', 'none', ink, 14) + path('M-76 -34 C-64 -96 64 -96 76 -34', 'none', oc, 7);
    }
    if (h === 'cat') {
      var ce = path('M-66 -62 L-60 -122 L-20 -88Z', oc, ink, 4) + path('M-57 -76 L-54 -107 L-33 -89Z', '#FFB3C8');
      return ce + mirror(ce) + path('M-76 -34 C-64 -96 64 -96 76 -34', 'none', ink, 14) + path('M-76 -34 C-64 -96 64 -96 76 -34', 'none', oc, 7);
    }
    if (h === 'tiara') return path('M-46 -76 L-38 -104 L-20 -88 L0 -116 L20 -88 L38 -104 L46 -76 Q0 -88 -46 -76Z', '#E3E8F6', ink, 4) +
      circ(0, -96, 6, '#FF5C8A', ink, 2.5) + circ(-30, -88, 4, '#4EA8F5', ink, 2) + circ(30, -88, 4, '#4EA8F5', ink, 2);
    if (h === 'clips') return star(-54, -60, 13, '#FFC93C', ink, 3) + '<g transform="translate(-30 -82) rotate(-20) scale(1.2)">' + path(HEART, '#FF8FB8', ink, 2.5) + '</g>' +
      '<g transform="translate(54 -58) rotate(25)"><rect x="-12" y="-5" width="24" height="10" rx="5" fill="' + oc + '" stroke="' + ink + '" stroke-width="3"/></g>';
    if (h === 'helmet') return path('M-86 -22 C-92 -112 92 -112 86 -22 Q0 -42 -86 -22Z', oc, ink, 4.5) +
      path('M-40 -88 Q-48 -64 -54 -40 M0 -96 L0 -44 M40 -88 Q48 -64 54 -40', 'none', shade(oc, -.3), 7) +
      path('M-80 -22 Q-72 40 -34 62', 'none', ink, 3) + path('M80 -22 Q72 40 34 62', 'none', ink, 3);
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
    s += marks(l, skin, ink, ex, ey) + eyes(l, mood, ink, ex, ey) + brows(l, mood, bc, ex, ey) + nose(l, skin, ink);
    s += facial(l, hc, ink) + mouth(l, mood, ink) + hairFront(l, hc, ink) + glasses(l, ink, ex, ey, oc) + hat(l, oc, ink);
    if (l.topHat && l.topHat !== l.hat) s += '<g transform="translate(0 ' + (l.hat === 'turban' ? -46 : -28) + ')">' + hat({ hat: l.topHat }, oc, ink) + '</g>';
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
  /* Torso details of the newer outfits (k: w half width, sh shoulder y, hip y, oc colour, tl torso outline). */
  function outfitDetails(out, k) {
    var w = k.w, sh = k.sh, hip = k.hip, oc = k.oc, ink = k.ink, s = '';
    function clipped(inner) { var id = LH.uid('od'); return '<clipPath id="' + id + '"><path d="' + k.tl + '"/></clipPath><g clip-path="url(#' + id + ')">' + inner + '</g>' + path(k.tl, 'none', ink, 4.5); }
    if (out === 'shorts') s += path('M-16 ' + (sh - 3) + ' Q0 ' + (sh + 12) + ' 16 ' + (sh - 3), 'none', shade(oc, -.2), 4);
    if (out === 'skirt') s += path('M' + (-w + 2) + ' ' + (hip - 14) + ' L' + (w - 2) + ' ' + (hip - 14) + ' L' + (w + 22) + ' ' + (hip + 30) + ' Q0 ' + (hip + 42) + ' ' + (-w - 22) + ' ' + (hip + 30) + 'Z', oc, ink, 4.5) +
      path('M' + (-w + 2) + ' ' + (hip - 10) + ' L' + (w - 2) + ' ' + (hip - 10), 'none', shade(oc, -.25), 6) + circ(-10, sh + 26, 3, shade(oc, -.1)) + circ(-10, sh + 46, 3, shade(oc, -.1));
    if (out === 'tutu') {
      var tulle = function (y1, spread, col) {
        var x0 = w + spread, n = 6, step = 2 * x0 / n, d = 'M' + (-w + 2) + ' ' + (hip - 18) + ' L' + (w - 2) + ' ' + (hip - 18) + ' L' + x0 + ' ' + y1;
        for (var i = 0; i < n; i++) { var xa = x0 - step * (i + 1); d += ' Q' + P(xa + step / 2) + ' ' + (y1 + 14) + ' ' + P(xa) + ' ' + y1; }
        return path(d + 'Z', col, ink, 3.5);
      };
      s += tulle(hip + 16, 34, shade(oc, .35)) + tulle(hip + 6, 22, shade(oc, .6)) + path('M' + (-w) + ' ' + (hip - 16) + ' L' + w + ' ' + (hip - 16), 'none', shade(oc, -.2), 6);
    }
    if (out === 'jumper') {
      var zz = 'M' + (-w - 6) + ' ' + (sh + 36);
      for (var zx = -w - 6, up = true; zx < w + 6; zx += 12, up = !up) zz += ' L' + (zx + 12) + ' ' + (sh + (up ? 26 : 36));
      s += clipped(path(zz, 'none', k.second, 6) + path('M' + (-w - 6) + ' ' + (hip - 12) + ' L' + (w + 6) + ' ' + (hip - 12), 'none', shade(oc, -.2), 8));
    }
    if (out === 'cardigan') s += path('M-14 ' + (sh - 2) + ' L14 ' + (sh - 2) + ' L12 ' + (hip + 4) + ' L-12 ' + (hip + 4) + 'Z', '#F7F3EA', ink, 3.5) +
      [sh + 26, sh + 48, sh + 70].map(function (y) { return circ(-19, y, 4, '#FFC93C', ink, 2.5); }).join('');
    if (out === 'raincoat') s += path('M' + (-w - 3) + ' ' + (hip - 6) + ' L' + (w + 3) + ' ' + (hip - 6) + ' L' + (w + 14) + ' ' + (hip + 26) + ' Q0 ' + (hip + 34) + ' ' + (-w - 14) + ' ' + (hip + 26) + 'Z', oc, ink, 4.5) +
      path('M0 ' + (sh + 2) + ' L0 ' + (hip + 30), 'none', shade(oc, -.25), 3) +
      [sh + 30, sh + 56, hip + 6].map(function (y) { return '<rect x="-12" y="' + (y - 3) + '" width="10" height="6" rx="3" fill="#F7F3EA" stroke="' + ink + '" stroke-width="2.5"/>'; }).join('') +
      path('M' + (w - 26) + ' ' + (hip - 20) + ' l18 0', 'none', shade(oc, -.25), 4);
    if (out === 'jersey') s += path('M-14 ' + (sh - 2) + ' L0 ' + (sh + 16) + ' L14 ' + (sh - 2), 'none', '#FFFFFF', 5) +
      clipped(path('M' + (-w + 6) + ' ' + sh + ' L' + (-w + 6) + ' ' + hip + ' M' + (w - 6) + ' ' + sh + ' L' + (w - 6) + ' ' + hip, 'none', '#FFFFFF', 5)) +
      '<text x="0" y="' + (sh + 64) + '" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" stroke="' + ink + '" stroke-width="3" paint-order="stroke">7</text>';
    if (out === 'sailor') s += path('M-26 ' + (sh - 2) + ' L-30 ' + (sh + 30) + ' L0 ' + (sh + 44) + ' L30 ' + (sh + 30) + ' L26 ' + (sh - 2) + ' L0 ' + (sh + 24) + 'Z', oc, ink, 3.5) +
      path('M-24 ' + (sh + 26) + ' L0 ' + (sh + 38) + ' L24 ' + (sh + 26), 'none', '#FFFFFF', 2.5) +
      (function () { var bc = (oc === '#EF5A36' || oc === '#C8372D') ? '#FFC93C' : '#EF5A36', y = sh + 44; return path('M0 ' + y + ' L-14 ' + (y - 8) + ' L-14 ' + (y + 8) + 'Z M0 ' + y + ' L14 ' + (y - 8) + ' L14 ' + (y + 8) + 'Z', bc, ink, 3) + circ(0, y, 4.5, bc, ink, 2.5); })();
    if (out === 'tracksuit') s += path('M0 ' + (sh + 4) + ' L0 ' + hip, 'none', shade(oc, -.3), 3) + circ(0, sh + 14, 3.5, '#C5CBD8', ink, 2) +
      clipped(path('M' + (-w + 5) + ' ' + sh + ' L' + (-w + 5) + ' ' + hip + ' M' + (w - 5) + ' ' + sh + ' L' + (w - 5) + ' ' + hip, 'none', '#FFFFFF', 4));
    if (out === 'uniform') s += path('M-20 ' + (sh - 2) + ' L0 ' + (sh + 46) + ' L20 ' + (sh - 2) + 'Z', '#F7F3EA', ink, 3.5) +
      path('M0 ' + (sh + 6) + ' L-7 ' + (sh + 18) + ' L0 ' + (sh + 50) + ' L7 ' + (sh + 18) + 'Z', '#C8372D', ink, 3) + path('M-5 ' + (sh + 26) + ' L5 ' + (sh + 20) + ' M-5 ' + (sh + 38) + ' L5 ' + (sh + 32), 'none', '#FFC93C', 2.5) +
      path('M' + (w - 30) + ' ' + (sh + 34) + ' L' + (w - 12) + ' ' + (sh + 34) + ' L' + (w - 12) + ' ' + (sh + 46) + ' Q' + (w - 21) + ' ' + (sh + 56) + ' ' + (w - 30) + ' ' + (sh + 46) + 'Z', '#FFC93C', ink, 2.5);
    if (out === 'dino') s += ell(0, (sh + hip) / 2 + 6, w - 18, (hip - sh) / 2 - 10, shade(oc, .45), ink, 3.5) +
      [-10, 6, 22].map(function (dy) { return path('M-16 ' + ((sh + hip) / 2 + dy) + ' Q0 ' + ((sh + hip) / 2 + dy + 4) + ' 16 ' + ((sh + hip) / 2 + dy), 'none', shade(oc, .15), 2.5); }).join('');
    if (out === 'astro') s += '<rect x="-20" y="' + (sh + 30) + '" width="40" height="28" rx="5" fill="#D9DCE8" stroke="' + ink + '" stroke-width="3"/>' +
      circ(-10, sh + 44, 4, '#EF5A36') + circ(0, sh + 44, 4, '#FFC93C') + circ(10, sh + 44, 4, '#3DBE8B') +
      circ(-w + 18, sh + 22, 8, oc, ink, 2.5) + path('M' + (-w - 3) + ' ' + (hip - 8) + ' L' + (w + 3) + ' ' + (hip - 8), 'none', '#A9A6B5', 8);
    if (out === 'gown') s += path('M' + (-w + 2) + ' ' + (hip - 22) + ' L' + (w - 2) + ' ' + (hip - 22) + ' L' + (w + 34) + ' -8 Q0 4 ' + (-w - 34) + ' -8Z', oc, ink, 4.5) +
      path('M' + (-w - 26) + ' -16 Q0 -4 ' + (w + 26) + ' -16', 'none', '#FFFFFF', 4, ' opacity=".8" stroke-dasharray="2 10"') +
      path('M' + (-w + 4) + ' ' + (hip - 22) + ' L' + (w - 4) + ' ' + (hip - 22), 'none', shade(oc, -.25), 7) + star(-14, hip + 20, 6, '#FFFFFF') + star(18, hip + 40, 5, '#FFFFFF');
    return s;
  }
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
    // the newer outfits
    var legSleeve = null, legFrac = .5, overArms = '';
    if (out === 'shorts') { legCol = skin; legSleeve = '#3C5A99'; }
    if (out === 'jersey') { legCol = skin; legSleeve = shade(oc, -.3); }
    if (out === 'skirt') { legCol = skin; top = '#F7F3EA'; sleeve = '#F7F3EA'; }
    if (out === 'tutu') { legCol = '#FFE1EC'; sleeve = null; }
    if (out === 'sailor') { top = '#F7F3EA'; sleeve = '#F7F3EA'; legCol = '#3C4F8F'; }
    if (out === 'jumper' || out === 'cardigan' || out === 'raincoat' || out === 'tracksuit' || out === 'uniform' || out === 'dino' || out === 'astro') sleeveFrac = 1;
    if (out === 'tracksuit' || out === 'dino') legCol = oc;
    if (out === 'uniform') legCol = '#6E6A7A';
    if (out === 'astro') { top = '#F7F3EA'; sleeve = '#F7F3EA'; legCol = '#F7F3EA'; shoe = '#A9A6B5'; }
    if (out === 'gown') sleeveFrac = .3;
    if (o.ghost) { legCol = '#FFFFFF'; top = '#FFFFFF'; sleeve = '#FFFFFF'; shoe = '#FFFFFF'; legSleeve = null; }

    var back = '', s = '';
    // the cape and robes hang behind
    if (out === 'cape') back += path('M' + (-w + 4) + ' ' + (sh + 6) + ' C' + (-w - 26) + ' ' + (hip + 10) + ' ' + (-w - 34) + ' -30 ' + (-w - 30) + ' -12 Q0 2 ' + (w + 30) + ' -12 C' + (w + 34) + ' -30 ' + (w + 26) + ' ' + (hip + 10) + ' ' + (w - 4) + ' ' + (sh + 6) + 'Z', oc, ink, 4.5);
    // the dino suit: spikes peeking round the head, and a tail
    if (out === 'dino' && !o.ghost) {
      for (var sa = -160; sa <= -20; sa += 35) {
        var ra = sa * Math.PI / 180, R = 86 * B.hs, cxs = R * Math.cos(ra), cys = B.head + R * Math.sin(ra), nx = Math.cos(ra), ny = Math.sin(ra);
        back += path('M' + P(cxs - ny * 14) + ' ' + P(cys + nx * 14) + ' L' + P(cxs + nx * 26) + ' ' + P(cys + ny * 26) + ' L' + P(cxs + ny * 14) + ' ' + P(cys - nx * 14) + 'Z', shade(oc, -.25), ink, 4);
      }
      back += path('M' + (w - 6) + ' ' + (hip - 30) + ' Q' + (w + 50) + ' ' + (hip - 10) + ' ' + (w + 58) + ' ' + (hip + 34) + ' Q' + (w + 30) + ' ' + (hip + 8) + ' ' + (w - 6) + ' ' + (hip - 4) + 'Z', oc, ink, 4.5);
    }
    // legs + shoes
    var sit = pose === 'sit', walk = pose === 'walk';
    var lf = walk ? [-30, -2] : [-B.legx - 2, sit ? -4 : -2], rf = walk ? [28, -6] : [B.legx + 2, sit ? -4 : -2];
    var legTop = hip - 8;
    var legL = [[-B.legx, legTop], [(lf[0] - B.legx) / 2 - 2, (legTop + lf[1]) / 2], [lf[0], lf[1] - 6]];
    var legR = [[B.legx, legTop], [(rf[0] + B.legx) / 2 + 2, (legTop + rf[1]) / 2], [rf[0], rf[1] - 6]];
    if (out !== 'robe' && out !== 'gown') {
      s += limb(legL[0], legL[1], legL[2], B.lw, legCol, ink, legSleeve, legFrac) + limb(legR[0], legR[1], legR[2], B.lw, legCol, ink, legSleeve, legFrac);
      if (out === 'pyjamas' && !o.ghost) s += circ(-B.legx, hip + 26, 3.5, '#fff') + circ(B.legx, hip + 40, 3.5, '#fff');
      if (out === 'tunic' && !o.ghost) s += path('M' + (-B.legx - 11) + ' ' + (hip + 30) + ' h22 M' + (B.legx - 11) + ' ' + (hip + 30) + ' h22', 'none', '#FFC93C', 5);
      if (out === 'tracksuit' && !o.ghost) [[legL, -1], [legR, 1]].forEach(function (g) {
        var p = g[0], dx = g[1] * B.lw * .3;
        s += path('M' + P(p[0][0] + dx) + ' ' + P(p[0][1] + 4) + ' Q' + P(p[1][0] + dx) + ' ' + P(p[1][1]) + ' ' + P(p[2][0] + dx) + ' ' + P(p[2][1] - 4), 'none', '#FFFFFF', 3.5);
      });
    }
    if (out !== 'robe') s += ell(lf[0] - 4, lf[1] - 4, 19, 10, shoe, ink, 4) + ell(rf[0] + 4, rf[1] - 4, 19, 10, shoe, ink, 4);
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
      if (!o.ghost) torso += outfitDetails(out, { w: w, sh: sh, hip: hip, oc: oc, ink: ink, tl: tl, second: second, B: B });
      if (out === 'gown' && !o.ghost) overArms = [-1, 1].map(function (sd) { return ell(sd * (w - 6), sh + 14, 17, 15, shade(oc, .2), ink, 4); }).join('');
      if (out === 'undies' && !o.ghost) torso += circ(0, hip - 26, 2.6, shade(skin, -.35)) + path('M' + (-w - 4) + ' ' + (hip - 16) + ' L' + (w + 4) + ' ' + (hip - 16) + ' L' + (w + 6) + ' ' + (hip + 14) + ' Q' + (B.legx + 6) + ' ' + (hip + 18) + ' 0 ' + (hip + 4) + ' Q' + (-B.legx - 6) + ' ' + (hip + 18) + ' ' + (-w - 6) + ' ' + (hip + 14) + 'Z', '#FFFFFF', ink, 4) +
        [[-24, hip - 6], [-4, hip - 2], [18, hip - 8], [32, hip + 6], [-34, hip + 6]].map(function (d) { return circ(d[0], d[1], 4.5, '#EF5A36'); }).join('');
    }
    var front = arm(1, arms[1]) + (pose === 'reach' ? '' : arm(-1, arms[0])) + overArms;
    // hood sits behind the head, on the shoulders (the astronaut gets a collar ring)
    var hood = ((out === 'hoodie' || out === 'raincoat' || out === 'dino') && !o.ghost) ? ell(0, sh + 2, w - 6, 15, shade(oc, -.14), ink, 4) :
      (out === 'astro' && !o.ghost) ? ell(0, sh + 2, w - 10, 12, '#A9A6B5', ink, 4) : '';
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
    var cy = B.head * 1 + (l.size === 'toddler' ? 6 : 4);
    if (o.crop === 'head') vb = [-128, cy - 132, 256, 256];
    else if (o.crop === 'hat') vb = [-150, cy - 176, 300, 300];          // room for tall hats and ears
    else if (o.fit === 'tallest') vb = [-175, BODY.a12.head - 150, 350, -BODY.a12.head + 170];  // same scale for every age
    else vb = [-175, B.head - 150, 350, -B.head + 170];
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
  var INK = '#2B2350', SOFT = '#4A3F6B';

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
    return '<div class="lh-cover' + (o.outline ? ' out' : '') + '" style="--cv:' + esc(story.color) + '"><div class="pic">' + LH.sceneSvg(story.key, 'cover', hero, { clip: LH.uid('cv'), outline: o.outline }) + '</div>' +
      '<div class="ttl"><span>' + esc(LH.title(story, hero)) + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span></div></div>';
  };

  LH.bookPages = function (book) {
    var pages = [{ kind: 'cover' }, { kind: 'dedication' }];
    for (var i = 0; i < book.story.text.length; i++) pages.push({ kind: 'story', i: i });
    pages.push({ kind: 'end' });
    return pages;
  };
  /* The PDF's pages: a colouring book always gets a "draw your favourite part" page, and a print-ready book gets it
     when needed to make the inside pages an even number (printers bind sheets, two pages each). */
  LH.pdfPages = function (book, opts) {
    var pages = LH.bookPages(book);
    opts = opts || {};
    if (opts.outline || (opts.print && (pages.length - 1) % 2)) pages.splice(pages.length - 1, 0, { kind: 'draw' });
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
  function portrait(hero, o) { return hero ? LH.bookAvatar(hero.look, o) : (o.outline ? LH.outline : LH.soften)(LH.avatarSvg(null, Object.assign({}, o, { ghost: true }))); }

  LH.pageHtml = function (book, p, n, total, mode) {
    mode = mode || {};
    var hero = book.hero, st = book.story, clip = LH.uid('pg'), out = !!mode.outline, so = { clip: clip, outline: out, grain: !out };
    if (p.kind === 'cover') {
      return '<div class="rd-cov" style="--cv:' + esc(st.color) + '"><div class="rd-pic">' + LH.sceneSvg(st.key, 'cover', hero, so) + '</div>' +
        '<h2>' + esc(LH.title(st, hero)) + '<small>' + (out ? 'A Little Hero colouring book' : 'A Little Hero Book') + '</small></h2></div>';
    }
    if (p.kind === 'dedication') {
      var h = hero || LH.GENERIC;
      return '<div class="rd-ded"><div class="frame">' + portrait(hero, { crop: 'head', mood: 'laugh', outline: out }) + '</div>' +
        '<div class="belongs">' + (out ? 'This colouring book belongs to' : 'This book belongs to') + '</div><div class="who">' + esc(h.name) + '</div><p class="msg">' + esc(LH.dedication(book)) + '</p></div>';
    }
    if (p.kind === 'end') {
      return '<div class="rd-end"><div class="fig">' + portrait(hero, { pose: 'wave', mood: 'laugh', outline: out }) + '</div>' +
        '<h2>The End</h2><p>' + esc(st.source) + '</p><p>' + esc(LH.madeLine(book)) + '</p></div>';
    }
    return '<div class="rd-pic">' + LH.sceneSvg(st.key, p.i, hero, so) + '</div><p class="rd-text">' + LH.fillHtml(st.text[p.i], hero) + '</p>' +
      '<div class="rd-num">' + (p.i + 1) + '</div>';
  };
  LH.pageSpeech = function (book, p) {
    var h = book.hero || LH.GENERIC;
    if (p.kind === 'cover') return LH.title(book.story, book.hero);
    if (p.kind === 'dedication') return 'This book belongs to ' + h.name + '. ' + LH.dedication(book);
    if (p.kind === 'end') return 'The End.';
    return LH.fill(book.story.text[p.i], book.hero);
  };

  /* ------------------------------------------------------------------ colour me in (on screen) */
  LH.CRAYONS = ['#EF5A36', '#FF9A3C', '#FFC93C', '#FFE36B', '#8ED37A', '#3DBE8B', '#7FC8F8', '#4EA8F5', '#8A6BD8', '#FF8FB8', '#C98B4E', '#F6CFAE', '#9C98AE', '#2B2350'];
  var SHAPES = 'svg path, svg circle, svg ellipse, svg rect, svg text';
  /* What a tap colours: a filled shape's fill, or the white middle of an outlined thick line. Ink stays ink. */
  function paintable(el) {
    if (el.closest('clipPath, defs')) return null;
    var f = (el.getAttribute('fill') || '').toUpperCase(), s = (el.getAttribute('stroke') || '').toUpperCase();
    if (f && f !== 'NONE' && f !== INK && f.indexOf('URL') < 0) return 'fill';
    if ((!f || f === 'NONE') && s && s !== INK) return 'stroke';
    return null;
  }
  /* A tap on one circle of a cloud or bush colours the whole puff (blob() draws its circles side by side). */
  function puff(el) {
    var group = [el];
    if (el.tagName.toLowerCase() !== 'circle' || el.hasAttribute('stroke')) return group;
    var same = function (n) { return n && n.tagName && n.tagName.toLowerCase() === 'circle' && !n.hasAttribute('stroke') && (n.getAttribute('fill') || '').toUpperCase() !== INK; };
    for (var a = el.previousElementSibling; same(a); a = a.previousElementSibling) group.push(a);
    for (var b = el.nextElementSibling; same(b); b = b.nextElementSibling) group.push(b);
    return group;
  }

  /* ------------------------------------------------------------------ the reader */
  LH.reader = function (el, book, opts) {
    opts = opts || {};
    var pages = LH.bookPages(book), at = Math.min(opts.start || 0, pages.length - 1), seen = {}, reading = false, finished = false;
    var colouring = false, crayon = LH.CRAYONS[0], painted = {};
    el.innerHTML = '<div class="rd"><div data-rd-crayons></div><div class="rd-stage"><button class="rd-nav prev" data-rd="prev" aria-label="Previous page">' + UI.icon('back') + '</button>' +
      '<div class="rd-book" data-rd-book></div><button class="rd-nav next" data-rd="next" aria-label="Next page">' + UI.icon('arrow') + '</button></div>' +
      '<div class="rd-bar"><div class="rd-dots" data-rd-dots></div><div class="rd-tools">' +
      ('speechSynthesis' in window ? '<button class="ui-btn sm" data-rd="speak">' + UI.icon('chat') + '<span>Read to me</span></button>' : '') +
      (opts.colour === false ? '' : '<button class="ui-btn sm" data-rd="colour">' + UI.icon('brush') + '<span>Colour me in</span></button>') +
      (opts.tools || '') + '</div></div></div>';
    var bookEl = el.querySelector('[data-rd-book]'), dots = el.querySelector('[data-rd-dots]'), crayEl = el.querySelector('[data-rd-crayons]');
    function drawCrayons() {
      crayEl.innerHTML = colouring ? '<div class="rd-crayons"><div class="hint">Pick a crayon, then tap the picture</div>' + LH.CRAYONS.map(function (c) {
        return '<button type="button" data-crayon="' + c + '" style="--cr:' + c + '" class="' + (c === crayon ? 'on' : '') + '" aria-label="Crayon ' + c + '"></button>';
      }).join('') + '<button type="button" data-crayon="#FFFFFF" style="--cr:#fff" class="' + (crayon === '#FFFFFF' ? 'on' : '') + '" aria-label="Rubber" title="Rubber">' + UI.icon('x') + '</button></div>' : '';
    }
    function draw(dir) {
      seen[at] = true;
      bookEl.classList.toggle('out', colouring);
      bookEl.innerHTML = '<div class="rd-page' + (dir < 0 ? ' back' : '') + '">' + LH.pageHtml(book, pages[at], at, pages.length, { outline: colouring }) + '</div>';
      if (colouring && painted[at]) {
        var list = bookEl.querySelectorAll(SHAPES);
        Object.keys(painted[at]).forEach(function (i) { var p = painted[at][i]; if (list[i]) list[i].setAttribute(p[0], p[1]); });
      }
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
    function paint(t) {
      var list = Array.prototype.slice.call(bookEl.querySelectorAll(SHAPES));
      puff(t).forEach(function (s) {
        var how = paintable(s);
        if (!how) return;
        s.setAttribute(how, crayon);
        (painted[at] = painted[at] || {})[list.indexOf(s)] = [how, crayon];
      });
    }
    el.addEventListener('click', function (e) {
      var c = e.target.closest('[data-crayon]');
      if (c) { crayon = c.getAttribute('data-crayon'); drawCrayons(); return; }
      if (colouring && e.target.closest('[data-rd-book] svg') && /^(path|circle|ellipse|rect|text)$/i.test(e.target.tagName)) { paint(e.target); return; }
      var b = e.target.closest('[data-rd],[data-rd-go]');
      if (!b) return;
      if (b.hasAttribute('data-rd-go')) return go(+b.getAttribute('data-rd-go'));
      var k = b.getAttribute('data-rd');
      if (k === 'prev') go(at - 1);
      else if (k === 'next') go(at + 1);
      else if (k === 'colour') {
        colouring = !colouring;
        b.classList.toggle('on', colouring); b.querySelector('span').textContent = colouring ? 'Back to colour' : 'Colour me in';
        drawCrayons(); draw(1);
      } else if (k === 'speak') {
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
      go: go, at: function () { return at; }, count: pages.length, colouring: function () { return colouring; },
      destroy: function () { document.removeEventListener('keydown', key); stopSpeak(); }
    };
  };

  /* ------------------------------------------------------------------ PDF
     Pages are laid out on a 1500 x 1500 grid (an 8 x 8 in page). For home printing that grid is the canvas; for a
     print-ready book the canvas is the trim size plus bleed at 300 dpi and the grid is scaled into it, with the
     background running out into the bleed. Keep text and faces at least ~50 grid units inside the edge. */
  var PX = 1500, DPI = 300, K = 1, OUT = false, PRINT = false;
  function ink() { return OUT ? INK : SOFT; }
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
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
  function shadow(ctx, blur, dy, a) { ctx.shadowColor = 'rgba(74,63,107,' + a + ')'; ctx.shadowBlur = blur * K; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = dy * K; }
  function paper(ctx, bg) {
    ctx.fillStyle = OUT ? '#FFFFFF' : (bg || '#FFFAF0'); ctx.fillRect(-300, -300, PX + 600, PX + 600);
    if (OUT) return;
    if (!bg) {
      // soft pastel light in the corners and a faint dot grid, like the app's paper
      [[0, 0, '#FFC93C'], [PX, 0, '#FF8FB8'], [0, PX, '#3DBE8B'], [PX, PX, '#4EA8F5']].forEach(function (c) {
        var gr = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 560); gr.addColorStop(0, rgba(c[2], .16)); gr.addColorStop(1, rgba(c[2], 0));
        ctx.fillStyle = gr; ctx.fillRect(-300, -300, PX + 600, PX + 600);
      });
      ctx.fillStyle = 'rgba(74,63,107,.045)';
      for (var y = 18; y < PX; y += 36) for (var x = 18; x < PX; x += 36) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
    } else {
      var hi = ctx.createRadialGradient(PX * .3, PX * .18, 0, PX * .3, PX * .18, PX * .75); hi.addColorStop(0, 'rgba(255,255,255,.34)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi; ctx.fillRect(-300, -300, PX + 600, PX + 600);
    }
    if (!PRINT) { var sp = ctx.createLinearGradient(0, 0, 30, 0); sp.addColorStop(0, 'rgba(74,63,107,.16)'); sp.addColorStop(1, 'rgba(74,63,107,0)'); ctx.fillStyle = sp; ctx.fillRect(0, 0, 30, PX); }
  }
  /* A picture on a rounded white mat with a soft shadow (or a plain ink line in the colouring book). */
  function framed(ctx, img, x, y, w, h, r) {
    if (OUT) {
      ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.drawImage(img, x, y, w, h); ctx.restore();
      ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = INK; rrect(ctx, x, y, w, h, r); ctx.stroke(); ctx.restore();
      return;
    }
    ctx.save(); shadow(ctx, 40, 16, .3); ctx.fillStyle = '#FFFFFF'; rrect(ctx, x - 16, y - 16, w + 32, h + 32, r + 14); ctx.fill(); ctx.restore();
    ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore();
  }
  function card(ctx, x, y, w, h, r, fill) {
    if (OUT) { ctx.fillStyle = '#fff'; rrect(ctx, x, y, w, h, r); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); return; }
    ctx.save(); shadow(ctx, 34, 12, .24); ctx.fillStyle = fill || '#FFFAF0'; rrect(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
  }
  /* Big letters: soft colour with a white edge, or white outlined letters to colour in. */
  function bigText(ctx, s, x, y, font, colour) {
    ctx.save(); ctx.font = font; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    if (OUT) { ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = '#FFFFFF'; ctx.fillText(s, x, y); }
    else { ctx.lineWidth = 18; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(s, x, y); shadow(ctx, 0, 8, .14); ctx.fillStyle = colour; ctx.fillText(s, x, y); }
    ctx.restore();
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
  function fontOf(weight, size, font) { return weight + ' ' + size + 'px "' + font + '", "Segoe UI", Arial, sans-serif'; }
  function textBlock(ctx, text, name, box, o) {
    o = o || {};
    var size = o.size || 52, font = o.font || 'Fredoka', weight = o.weight || 500, lh = o.lh || 1.42, lines;
    var words = text.split(/\s+/).filter(Boolean).map(function (t) { return { t: t, hi: !!(name && t.indexOf(name) >= 0) }; });
    for (; size > 24; size -= 2) {
      ctx.font = fontOf(weight, size, font);
      lines = wrap(ctx, words, box.w);
      if (lines.length * size * lh <= box.h) break;
    }
    var space = ctx.measureText(' ').width, total = lines.length * size * lh, y = box.y + (box.h - total) / 2 + size * .95;
    ctx.textBaseline = 'alphabetic';
    lines.forEach(function (line) {
      var lw = line.reduce(function (a, b) { return a + b.w; }, 0) + space * (line.length - 1), x = box.x + (box.w - lw) / 2;
      line.forEach(function (wd) {
        ctx.font = fontOf(wd.hi ? Math.max(600, weight) : weight, size, font);
        if (o.outlined) { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.strokeText(wd.t, x, y); ctx.restore(); }
        ctx.fillStyle = o.outlined ? '#FFFFFF' : wd.hi && !OUT ? '#D9532E' : (o.color || ink());
        ctx.fillText(wd.t, x, y);
        x += wd.w + space;
      });
      y += size * lh;
    });
  }
  function spaced(ctx, s, x, y, size, colour) {
    ctx.save(); ctx.font = '800 ' + size + 'px Nunito, Arial, sans-serif'; ctx.fillStyle = OUT ? INK : colour; ctx.textAlign = 'center';
    ctx.fillText(s.toUpperCase().split('').join(String.fromCharCode(8202)), x, y); ctx.restore();
  }
  function drawPage(book, p, num, opts) {
    opts = opts || {};
    OUT = !!opts.outline; PRINT = !!opts.print;
    var size = PX, off = 0;
    K = 1;
    if (PRINT) { var trim = Math.round(opts.print.trim * DPI); size = Math.round((opts.print.trim + 2 * opts.print.bleed) * DPI); off = (size - trim) / 2; K = trim / PX; }
    var c = document.createElement('canvas'); c.width = size; c.height = size;
    var ctx = c.getContext('2d'), st = book.story, hero = book.hero, h = hero || LH.GENERIC, name = h.name, res = Math.max(1, K);
    ctx.setTransform(K, 0, 0, K, off, off);
    var o1 = OUT, p1 = PRINT, k1 = K, restore = function () { OUT = o1; PRINT = p1; K = k1; };  // pages may be drawn side by side
    var sceneOpts = function (w) { return { w: Math.round(w * res), clip: 'pdf', outline: OUT, grain: !OUT }; };
    var avatar = function (o) { return portrait(hero, Object.assign({ outline: OUT }, o)); };
    function sized(svg, w, hgt) { return svg.replace('<svg ', '<svg width="' + Math.round(w * res) + '" height="' + Math.round(hgt * res) + '" '); }
    if (p.kind === 'cover') {
      paper(ctx, st.color);
      return svgImage(LH.sceneSvg(st.key, 'cover', hero, sceneOpts(1340))).then(function (img) { restore();
        framed(ctx, img, 80, 80, 1340, 938, 64);
        card(ctx, 80, 1090, 1340, 320, 56);
        textBlock(ctx, LH.title(st, hero), null, { x: 130, y: 1106, w: 1240, h: 214 }, { font: 'Baloo 2', weight: 800, size: 104, lh: 1.02, outlined: OUT });
        spaced(ctx, OUT ? 'A Little Hero colouring book' : 'A Little Hero Book', 750, 1372, 34, '#D9532E');
        return c;
      });
    }
    if (p.kind === 'dedication') {
      paper(ctx);
      return svgImage(sized(avatar({ crop: 'head', mood: 'laugh', bg: '#FFC93C' }), 640, 640)).then(function (img) { restore();
        ctx.save(); if (!OUT) shadow(ctx, 40, 16, .26); ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(750, 440, OUT ? 320 : 338, 0, 7); ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(750, 440, 320, 0, 7); ctx.clip(); ctx.drawImage(img, 430, 120, 640, 640); ctx.restore();
        if (OUT) { ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(750, 440, 320, 0, 7); ctx.stroke(); }
        spaced(ctx, OUT ? 'This colouring book belongs to' : 'This book belongs to', 750, 880, 40, '#D9532E');
        bigText(ctx, name, 750, 1020, '800 130px "Baloo 2", Arial, sans-serif', ink());
        textBlock(ctx, LH.dedication(book), null, { x: 200, y: 1080, w: 1100, h: 290 }, { size: 54 });
        return c;
      });
    }
    if (p.kind === 'draw') {
      paper(ctx);
      textBlock(ctx, 'Draw your favourite part of the story!', null, { x: 120, y: 90, w: 1260, h: 140 }, { size: 68, weight: 600 });
      ctx.save(); ctx.fillStyle = '#FFFFFF'; if (!OUT) shadow(ctx, 30, 10, .18); rrect(ctx, 110, 250, 1280, 1000, 60); ctx.fill(); ctx.restore();
      ctx.save(); ctx.setLineDash([26, 20]); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = OUT ? INK : 'rgba(74,63,107,.45)'; rrect(ctx, 110, 250, 1280, 1000, 60); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.strokeStyle = ink(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(420, 1380); ctx.lineTo(1080, 1380); ctx.stroke(); ctx.restore();
      ctx.font = fontOf(500, 46, 'Fredoka'); ctx.fillStyle = ink(); ctx.textAlign = 'right'; ctx.fillText('by', 400, 1376); ctx.textAlign = 'left';
      return svgImage(sized(avatar({ pose: 'wave', mood: 'laugh' }), 220, 239)).then(function (img) { restore(); ctx.drawImage(img, 1150, 1000, 220, 239); return c; });
    }
    if (p.kind === 'end') {
      paper(ctx);
      return svgImage(sized(avatar({ pose: 'wave', mood: 'laugh' }), 520, 565)).then(function (img) { restore();
        ctx.drawImage(img, 490, 120, 520, 565);
        bigText(ctx, 'The End', 750, 900, '800 170px "Baloo 2", Arial, sans-serif', '#EF5A36');
        textBlock(ctx, st.source, null, { x: 220, y: 980, w: 1060, h: 200 }, { size: 40, weight: 400, color: OUT ? INK : '#6D6490' });
        textBlock(ctx, LH.madeLine(book), null, { x: 220, y: 1190, w: 1060, h: 120 }, { size: 38, weight: 500, color: OUT ? INK : '#6D6490' });
        return c;
      });
    }
    paper(ctx);
    return svgImage(LH.sceneSvg(st.key, p.i, hero, sceneOpts(1340))).then(function (img) { restore();
      framed(ctx, img, 80, 70, 1340, 938, 64);
      textBlock(ctx, LH.fill(st.text[p.i], hero), hero ? name : null, { x: 110, y: 1050, w: 1280, h: 330 }, { size: 56 });
      ctx.save(); ctx.fillStyle = OUT ? '#FFFFFF' : '#FFE7A3'; ctx.beginPath(); ctx.arc(750, 1424, 30, 0, 7); ctx.fill(); if (OUT) { ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); } ctx.restore();
      ctx.font = fontOf(600, 32, 'Fredoka'); ctx.fillStyle = ink(); ctx.textAlign = 'center'; ctx.fillText(String(p.i + 1), 750, 1435); ctx.textAlign = 'left';
      return c;
    });
  }
  function jpeg(canvas, q) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (b) { b.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); }); }, 'image/jpeg', q || .9);
    });
  }
  /* A minimal PDF: one JPEG (DCTDecode) image per square page. A page can say its size in points (pt) and its bleed
     (bleedPt): then it also gets a TrimBox and BleedBox, which print shops read to know where to cut. */
  LH.writePdf = function (images, title) {
    var chunks = [], len = 0, offsets = [];
    function bytes(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
    function add(x) { var b = typeof x === 'string' ? bytes(x) : x; chunks.push(b); len += b.length; }
    function obj(n, s) { offsets[n] = len; add(n + ' 0 obj\n' + s + '\nendobj\n'); }
    function num(v) { return String(Math.round(v * 100) / 100); }
    var n = images.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((4 + i * 3) + ' 0 R');
    add('%PDF-1.4\n%âãÏÓ\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    var safeTitle = String(title || 'Little Hero Book').replace(/[^\x20-\x7e]/g, '').replace(/([()\\])/g, '\\$1');
    obj(3, '<< /Title (' + safeTitle + ') /Creator (Little Hero Books) /Producer (Little Hero Books) >>');
    images.forEach(function (im, i) {
      var pg = 4 + i * 3, ct = pg + 1, ix = pg + 2, size = num(im.pt || 576), b = im.bleedPt || 0, content = 'q ' + size + ' 0 0 ' + size + ' 0 0 cm /Im0 Do Q';
      var boxes = b ? ' /BleedBox [0 0 ' + size + ' ' + size + '] /TrimBox [' + num(b) + ' ' + num(b) + ' ' + num((im.pt || 576) - b) + ' ' + num((im.pt || 576) - b) + ']' : '';
      obj(pg, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + size + ' ' + size + ']' + boxes + ' /Resources << /XObject << /Im0 ' + ix + ' 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ' + ct + ' 0 R >>');
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
  LH.makePdf = function (book, progress, opts) {
    opts = opts || {};
    var pages = LH.pdfPages(book, opts), out = [], pr = opts.print;
    var pt = pr ? (pr.trim + 2 * pr.bleed) * 72 : 576, bleedPt = pr ? pr.bleed * 72 : 0;
    var fonts = document.fonts && document.fonts.load ? Promise.all(['800 60px "Baloo 2"', '500 50px Fredoka', '600 50px Fredoka', '400 40px Fredoka', '800 40px Nunito'].map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve();
    var chain = fonts;
    pages.forEach(function (p, i) {
      chain = chain.then(function () {
        if (progress) progress(i, pages.length);
        return drawPage(book, p, i, opts).then(function (cv) { return jpeg(cv, pr ? .92 : .9).then(function (data) { out.push({ data: data, w: cv.width, h: cv.height, pt: pt, bleedPt: bleedPt }); }); });
      });
    });
    return chain.then(function () { if (progress) progress(pages.length, pages.length); return LH.writePdf(out, LH.title(book.story, book.hero) + (opts.outline ? ' (colouring book)' : '')); });
  };
  LH.drawPdfPage = drawPage;  // used by the flow test

  LH.PRINT_SIZES = [{ key: '8in', label: '8 × 8 in', trim: 8 }, { key: '8.5in', label: '8.5 × 8.5 in', trim: 8.5 }, { key: '20cm', label: '20 × 20 cm', trim: 20 / 2.54 }];
  LH.BLEEDS = [{ key: 'in', label: '0.125 in (3.2 mm)', v: .125 }, { key: '3mm', label: '3 mm', v: 3 / 25.4 }, { key: '5mm', label: '5 mm', v: 5 / 25.4 }];
  function sizeLabel(inches, metric) { return metric ? (Math.round(inches * 25.4 * 10) / 100) + ' cm' : (Math.round(inches * 1000) / 1000) + ' in'; }
  LH.fileName = function (book, opts) {
    opts = opts || {};
    var extra = opts.outline ? ' - colouring book' : '';
    if (opts.print) extra += ' - print ' + (opts.print.label || '').replace(/[^\w.]+/g, '');
    return (LH.title(book.story, book.hero) + extra).replace(/[\\/:*?"<>|’']+/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
  };

  /* "Download a PDF": which book (pictures or colour-me-in) and where it will be printed. */
  LH.pdfDialog = function (book) {
    var saved = UI.store.get('pdfopts', {}) || {}, kind = saved.kind === 'outline' ? 'outline' : 'colour', use = saved.use === 'print' ? 'print' : 'home';
    var m = UI.modal('<h2>Download a PDF</h2><form class="ui-stack" data-lhp>' +
      '<div class="lhp-label">Which book?</div><div class="lhp-cards">' +
      '<label class="lhp-card" data-k="colour"><input type="radio" name="kind" value="colour">' + LH.coverHtml(book.story, book.hero) + '<b>Picture book</b><small>Full colour, just like on screen</small></label>' +
      '<label class="lhp-card" data-k="outline"><input type="radio" name="kind" value="outline">' + LH.coverHtml(book.story, book.hero, { outline: true }) + '<b>Colour-me-in book</b><small>Outlines for crayons, plus a page to draw on</small></label></div>' +
      '<div class="lhp-label">Where will you print it?</div><div class="lhp-list">' +
      '<label class="lhp-row" data-u="home"><input type="radio" name="use" value="home">' + UI.icon('print') + '<span><b>Screen or home printer</b><small>8 × 8 in pages that fit on Letter or A4 paper. A smaller file.</small></span></label>' +
      '<label class="lhp-row" data-u="print"><input type="radio" name="use" value="print">' + UI.icon('book') + '<span><b>Photo-book printer</b><small>Print-ready: 300 dpi pages with the extra bleed edge that printers trim off.</small></span></label></div>' +
      '<div class="lhp-print" data-lhp-print><label>Book size<select name="size">' + LH.PRINT_SIZES.map(function (s) { return '<option value="' + s.key + '"' + (saved.size === s.key ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') + '</select></label>' +
      '<label>Bleed<select name="bleed">' + LH.BLEEDS.map(function (s) { return '<option value="' + s.key + '"' + (saved.bleed === s.key ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') + '</select></label>' +
      '<p class="small muted" data-lhp-note></p></div>' +
      '<div class="ui-row end"><button type="button" class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn primary" type="submit">' + UI.icon('download') + 'Make my PDF</button></div></form>');
    var form = m.el.querySelector('[data-lhp]');
    function choice() {
      var f = UI.formData(form), sz = LH.PRINT_SIZES.filter(function (s) { return s.key === f.size; })[0] || LH.PRINT_SIZES[0], bl = LH.BLEEDS.filter(function (s) { return s.key === f.bleed; })[0] || LH.BLEEDS[0];
      return { kind: kind, use: use, size: sz.key, bleed: bl.key, opts: { outline: kind === 'outline', print: use === 'print' ? { trim: sz.trim, bleed: bl.v, label: sz.label } : null } };
    }
    function sync() {
      m.el.querySelectorAll('[data-k]').forEach(function (l) { var on = l.getAttribute('data-k') === kind; l.classList.toggle('on', on); l.querySelector('input').checked = on; });
      m.el.querySelectorAll('[data-u]').forEach(function (l) { var on = l.getAttribute('data-u') === use; l.classList.toggle('on', on); l.querySelector('input').checked = on; });
      var pr = m.el.querySelector('[data-lhp-print]');
      pr.hidden = use !== 'print';
      if (use === 'print') {
        var c = choice(), o = c.opts.print, metric = c.size === '20cm', full = o.trim + 2 * o.bleed, n = LH.pdfPages(book, c.opts).length;
        m.el.querySelector('[data-lhp-note]').textContent = 'Each page is ' + sizeLabel(full, metric) + ' square (' + sizeLabel(o.trim, metric) + ' plus the bleed), ' + Math.round(full * DPI) + ' × ' + Math.round(full * DPI) +
          ' pixels. ' + n + ' pages: the cover, then ' + (n - 1) + ' inside pages (an even number, as printers like). Pick the same size and bleed your printer asks for.';
      }
    }
    m.el.addEventListener('click', function (e) {
      var k = e.target.closest('[data-k]'), u = e.target.closest('[data-u]');
      if (k) { kind = k.getAttribute('data-k'); sync(); }
      if (u) { use = u.getAttribute('data-u'); sync(); }
    });
    form.addEventListener('change', sync);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = choice();
      UI.store.set('pdfopts', { kind: c.kind, use: c.use, size: c.size, bleed: c.bleed });
      m.close();
      LH.downloadPdf(book, c.opts);
    });
    sync();
    return m;
  };
  /* Make the PDF with a progress modal, then download it. */
  LH.downloadPdf = function (book, opts) {
    opts = opts || {};
    var m = UI.modal('<h2>' + (opts.outline ? 'Drawing your colouring book…' : 'Printing your book…') + '</h2><p class="muted" data-pdf-msg>Painting the cover</p><div class="lh-prog"><i data-pdf-bar></i></div>' +
      '<p class="small muted">Everything is drawn right here in your browser. Nothing is uploaded.</p>');
    var msg = m.el.querySelector('[data-pdf-msg]'), bar = m.el.querySelector('[data-pdf-bar]'), n = LH.pdfPages(book, opts).length;
    return LH.makePdf(book, function (i, total) {
      bar.style.width = Math.round(i / total * 100) + '%';
      msg.textContent = i >= total ? 'Binding the pages…' : i === 0 ? (opts.outline ? 'Drawing the cover' : 'Painting the cover') : (opts.outline ? 'Drawing' : 'Painting') + ' page ' + i + ' of ' + (total - 1);
    }, opts).then(function (blob) {
      var url = URL.createObjectURL(blob), a = document.createElement('a'), name = LH.fileName(book, opts);
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      window.LH_LAST_PDF = blob;
      var how = opts.print ? 'Upload it to your photo-book printer as a square ' + opts.print.label + ' book. The printer trims off the bleed edge, so nothing important sits near it.'
        : opts.outline ? 'Print it on plain paper (it fits Letter and A4), then get the crayons out!'
        : 'Print it at home, or read it together on a tablet.';
      m.el.innerHTML = '<button class="ui-btn ghost icon ui-modal-x" data-close aria-label="Close">' + UI.icon('x') + '</button><h2>' + (opts.outline ? 'Your colouring book is ready!' : 'Your book is ready!') + '</h2><p class="muted">' + esc(name) +
        ' (' + Math.max(1, Math.round(blob.size / 1048576)) + ' MB, ' + n + ' square pages) is in your downloads. ' + esc(how) + '</p><div class="ui-row end"><a class="ui-btn primary" href="' + url + '" target="_blank" rel="noopener">' + UI.icon('external') + 'Open it</a><button class="ui-btn" data-close>Done</button></div>';
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
    // soft corners by default on everything smaller than a whole wall or sky
    if (rx == null && Math.abs(w) < 600) rx = P(Math.min(8, Math.abs(w) / 4, Math.abs(h) / 4));
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
    var dc = o.c || '#FFFFFF';
    var b = (o.sit ? '' : path('M-14 -2 v-14 M12 -2 v-14', 'none', '#FF9A3C', 6) + path('M-26 0 h20 M2 0 h20', 'none', '#FF9A3C', 6)) + path('M-60 -60 Q-80 -80 -66 -40', 'none', INK, 3) +
      ell(0, -50, 56, 38, dc, INK, 4) + path('M-30 -56 Q0 -36 24 -58 Q6 -26 -30 -56Z', LH.shade(dc, -.08), INK, 3) + circ(36, -100, 26, dc, INK, 4) + path('M58 -100 Q86 -100 84 -88 Q70 -84 56 -90Z', '#FF9A3C', INK, 3);
    if (o.mood === 'wow') b += ell(70, -84, 5, 6, '#7A2638', INK, 2);
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

  /* ================================================================== kits for the newer tales (Nov 2026) */
  function tube(d, w, c) { return path(d, 'none', INK, w + 8) + path(d, 'none', c, w); }   // an outlined thick line (limbs, tails, necks)
  function snowfall(n, sd) { seed = sd || 23; var s = ''; for (var i = 0; i < n; i++) s += circ(rnd() * 1000, rnd() * 680, 4 + rnd() * 6, '#FFFFFF', INK, 1.5); return s; }
  function windowSnow(wx, wy, ww, wh) { seed = 61; var s = ''; for (var i = 0; i < 9; i++) s += circ(wx + 14 + rnd() * (ww - 28), wy + 14 + rnd() * (wh - 28), 4 + rnd() * 3, '#FFFFFF', INK, 1.5); return s; }
  function waves(x0, x1, y0, y1, n, sd) {
    seed = sd || 11; var s = '';
    for (var i = 0; i < n; i++) { var x = x0 + rnd() * (x1 - x0 - 50), y = y0 + rnd() * (y1 - y0); s += path('M' + P(x) + ' ' + P(y) + ' q12 -10 24 0 t24 0', 'none', '#FFFFFF', 4, ' opacity=".85"'); }
    return s;
  }
  function riverBand(y0, y1) { return path('M-10 ' + y0 + ' Q500 ' + (y0 - 16) + ' 1010 ' + y0 + ' L1010 ' + y1 + ' L-10 ' + y1 + 'Z', '#7FC8F8', INK, 4) + waves(0, 1000, y0 + 16, y1 - 24, 10, 7); }
  function waterFront(y) { return path('M-10 ' + y + ' Q120 ' + (y - 12) + ' 250 ' + y + ' T500 ' + y + ' T750 ' + y + ' T1010 ' + y + ' L1010 710 L-10 710Z', '#7FC8F8', INK, 4) + waves(0, 1000, y + 24, 690, 6, 19); }
  function reeds(x, y, s) {
    return at(x, y, s, path('M-10 0 Q-60 -50 -70 -90 M10 0 Q50 -40 70 -70', 'none', '#59B45E', 6) + path('M-20 0 Q-26 -90 -40 -150 M0 0 Q2 -110 -4 -180 M20 0 Q30 -80 46 -130', 'none', '#3E8E4E', 6) +
      ell(-4, -172, 9, 24, '#8A5A3B', INK, 3) + ell(44, -128, 8, 20, '#8A5A3B', INK, 3).replace('/>', ' transform="rotate(20 44 -128)"/>'));
  }
  function mountains() {
    return path('M-10 430 L170 170 L300 330 L460 120 L640 360 L800 200 L1010 430Z', '#B9B2D3', INK, 4) +
      path('M131 226 L170 170 L210 224 L190 238 L170 224 L150 240Z M420 178 L460 120 L504 182 L482 196 L460 180 L440 198Z M762 254 L800 200 L840 254 L818 264 L800 252 L782 266Z', '#FFFFFF', INK, 3.5);
  }
  function hay(x, y, s) { return at(x, y, s, path('M-90 0 Q-84 -120 0 -130 Q84 -120 90 0Z', '#F0C24B', INK, 4) + path('M-50 -20 l10 -40 M-10 -10 l6 -60 M30 -24 l-6 -50 M60 -16 l-10 -30', 'none', '#C99A2E', 4)); }
  function rollingPin(x, y) { return rect(x - 50, y - 10, 100, 20, '#E8C08A', INK, 3.5, 10) + rect(x - 76, y - 6, 28, 12, C.wood2, INK, 3, 6) + rect(x + 48, y - 6, 28, 12, C.wood2, INK, 3, 6); }
  function daisy(x, y, r) {
    var d = '';
    for (var i = 0; i < 8; i++) d += ell(x, y - r * .9, r * .36, r * .62, '#FFFFFF', INK, 2.5).replace('/>', ' transform="rotate(' + i * 45 + ' ' + P(x) + ' ' + P(y) + ')"/>');
    return d + circ(x, y, r * .46, C.sun, INK, 2.5);
  }
  function leaves(n, sd) {
    seed = sd || 29; var s = '', cs = ['#F0A040', '#E8742A', '#FFC93C', '#C8372D'];
    for (var i = 0; i < n; i++) { var x = rnd() * 1000, y = 60 + rnd() * 520; s += ell(x, y, 12, 7, cs[i % 4], INK, 2.5).replace('/>', ' transform="rotate(' + Math.round(rnd() * 180) + ' ' + P(x) + ' ' + P(y) + ')"/>'); }
    return s;
  }
  function scarf(x, y) { return tube('M' + (x - 54) + ' ' + y + ' Q' + x + ' ' + (y + 26) + ' ' + (x + 54) + ' ' + y, 16, C.red) + path('M' + (x - 30) + ' ' + (y + 8) + ' v14 M' + x + ' ' + (y + 12) + ' v14 M' + (x + 30) + ' ' + (y + 8) + ' v14', 'none', '#FFFFFF', 4) + rect(x + 46, y - 4, 18, 46, C.red, INK, 3.5, 6); }
  function openBook(x, y, s) {
    return at(x, y, s, path('M0 0 Q-40 -18 -84 -6 L-84 -64 Q-40 -76 0 -58Z', '#FFFFFF', INK, 3.5) + path('M0 0 Q40 -18 84 -6 L84 -64 Q40 -76 0 -58Z', '#FFFFFF', INK, 3.5) +
      path('M-70 -46 q30 -8 56 2 M-70 -32 q30 -8 56 2 M14 -44 q30 -10 56 -2 M14 -30 q30 -10 56 -2', 'none', '#C9C3D9', 3));
  }
  function picnic(x, y, s) {
    return at(x, y, s, path('M-60 0 L-50 -50 L50 -50 L60 0Z', '#C98B4E', INK, 4) + path('M-40 -50 Q0 -100 40 -50', 'none', INK, 6) + path('M-52 -34 h104 M-56 -18 h112', 'none', '#A86B3A', 3) +
      path('M80 -6 L132 -6 L106 -46Z', '#FFE7A8', INK, 3.5) + path('M86 -16 L126 -16', 'none', '#6CC46A', 4) +
      circ(162, -18, 17, C.red, INK, 3.5) + path('M162 -35 q4 -10 10 -10', 'none', '#3E8E4E', 3) +
      path('M192 -4 L252 -4 L252 -46Z', '#FFE2C2', INK, 3.5) + path('M252 -46 L252 -58 L188 -16 L192 -4Z', '#FF8FB8', INK, 3) + circ(240, -62, 7, C.red, INK, 2.5));
  }
  function carrot(x, y, s, rot) { return g('translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ') scale(' + s + ')', path('M-14 0 L0 80 L14 0Z', '#FF9A3C', INK, 3.5) + path('M-6 0 q-12 -26 -2 -34 M0 0 q0 -30 8 -36 M6 0 q14 -20 22 -20', 'none', '#3E8E4E', 5)); }
  function hammer(x, y, s, rot) { return g('translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ') scale(' + s + ')', rect(-6, -10, 12, 80, C.wood2, INK, 3.5, 4) + rect(-26, -26, 52, 22, '#A9A2C0', INK, 3.5, 4)); }

  /* the Gingerbread Man: feet at (0,0), about 205 tall */
  function gingerbread(x, y, s, o) {
    o = o || {};
    var c = o.raw ? '#F3D7A8' : '#C9803F', b = '';
    var legs = o.run ? ['M-12 -64 Q-30 -40 -48 -12', 'M12 -64 Q36 -44 44 -8'] : ['M-12 -64 L-22 -6', 'M12 -64 L22 -6'];
    var arms = o.cheer ? ['M-30 -112 L-70 -160', 'M30 -112 L70 -160'] : o.run ? ['M-30 -112 L-72 -136', 'M30 -112 L74 -92'] : ['M-30 -112 L-74 -98', 'M30 -112 L74 -98'];
    legs.concat(arms).forEach(function (d) {
      b += tube(d, 30, c);
      if (!o.raw) { var n = d.match(/-?\d+/g), ex = +n[n.length - 2], ey = +n[n.length - 1]; b += path('M' + (ex - 10) + ' ' + (ey - 4) + ' q5 8 10 0 q5 8 10 0', 'none', '#FFFFFF', 4); }
    });
    b += ell(0, -90, 40, 46, c, INK, 4) + circ(0, -160, 40, c, INK, 4);
    if (!o.raw) b += circ(0, -160, 31, 'none', '#FFFFFF', 3, ' stroke-dasharray="7 8"') + circ(0, -114, 6, C.red, INK, 2.5) + circ(0, -93, 6, '#3DBE8B', INK, 2.5) + circ(0, -72, 6, C.sun, INK, 2.5);
    b += circ(-13, -167, 5.5, '#4A2A18') + circ(13, -167, 5.5, '#4A2A18') + circ(0, -155, 6, C.red, INK, 2.5) + circ(-25, -150, 6, C.pink, null, 0, ' opacity=".7"') + circ(25, -150, 6, C.pink, null, 0, ' opacity=".7"');
    b += o.mood === 'wow' ? ell(0, -138, 7, 8, '#7A2638', INK, 2.5) : o.mood === 'oops' ? path('M-10 -139 Q0 -145 10 -139', 'none', '#FFFFFF', 4.5) : path('M-14 -145 Q0 -130 14 -145', 'none', '#FFFFFF', 5);
    return at(x, y, s, b, o.flip);
  }
  /* a fox standing, facing right; mood sly (default), wow, sad */
  function fox(x, y, s, o) {
    o = o || {};
    var f = '#E8742A', w = '#FFF4E6', b = '';
    b += path('M-50 -70 C-120 -60 -184 -110 -150 -184 C-130 -132 -96 -112 -46 -100Z', f, INK, 4) + path('M-150 -184 C-170 -150 -160 -126 -138 -120 C-148 -140 -148 -162 -150 -184Z', w, INK, 3);
    [-46, -20, 28, 52].forEach(function (lx) { b += rect(lx, -58, 16, 58, f, INK, 4, 8) + rect(lx - 2, -14, 20, 14, '#3A3355', INK, 3, 6); });
    b += ell(0, -80, 70, 40, f, INK, 4.5) + ell(52, -84, 20, 26, w, INK, 3);
    b += path('M44 -166 L42 -212 L72 -176Z', f, INK, 4) + path('M78 -176 L104 -210 L102 -164Z', f, INK, 4) + path('M50 -178 L49 -200 L62 -182Z', '#3A3355');
    b += circ(70, -140, 38, f, INK, 4.5) + path('M92 -152 Q138 -142 140 -128 Q118 -112 88 -120Z', w, INK, 4) + circ(140, -130, 7, INK);
    if (o.mood === 'wow') b += circ(84, -152, 7, INK) + circ(86, -154, 2.4, '#FFFFFF') + ell(116, -116, 6, 6, '#7A2638', INK, 2.5);
    else if (o.mood === 'sad') b += path('M76 -150 q8 6 16 0', 'none', INK, 4) + path('M74 -164 l18 6', 'none', INK, 3.5) + path('M104 -116 q12 -8 24 0', 'none', INK, 3.5);
    else b += path('M74 -154 q9 -7 18 0', 'none', INK, 4.5) + circ(83, -150, 4, INK) + path('M100 -121 q16 10 32 -2', 'none', INK, 3.5) + path('M108 -118 l3 7 l3 -6 M118 -117 l3 7 l3 -7', '#FFFFFF', INK, 2);
    return at(x, y, s, b, o.flip);
  }
  function horse(x, y, s, o) {
    o = o || {};
    var c = o.c || '#B87A47', m = '#5A3420', b = tube('M-140 -184 Q-200 -164 -186 -88', 14, m);
    [-120, -84, 70, 106].forEach(function (lx, i) { var r = o.run ? (i % 2 ? 14 : -14) : 0; b += g('rotate(' + r + ' ' + (lx + 13) + ' -112)', rect(lx, -120, 26, 112, c, INK, 4, 10) + rect(lx - 2, -18, 30, 18, '#3A3355', INK, 3, 5)); });
    b += rect(-156, -232, 296, 122, c, INK, 4.5, 58) + path('M84 -204 L140 -304 L192 -280 L146 -190Z', c, INK, 4.5) + tube('M150 -334 Q118 -282 92 -216', 14, m) + path('M160 -330 L166 -368 L184 -332Z', c, INK, 4);
    b += ell(186, -288, 32, 58, c, INK, 4.5).replace('/>', ' transform="rotate(-50 186 -288)"/>') + ell(222, -254, 22, 20, LH.shade(c, .25), INK, 3.5) + circ(232, -254, 3.5, INK) + circ(178, -302, 6, INK) + circ(180, -304, 2, '#FFFFFF');
    return at(x, y, s, b, o.flip);
  }
  /* swans and the grey duckling: ugly = the duckling; swim = no legs, on the water line; sad = head bowed; flap = wings up */
  function swan(x, y, s, o) {
    o = o || {};
    var c = o.c || '#FFFFFF', ugly = !!o.ugly, b = '';
    var nk = o.sad ? 'M34 -66 Q76 -72 80 -40' : ugly ? 'M36 -68 Q56 -98 46 -124' : 'M40 -66 Q96 -110 56 -160 Q38 -186 60 -200';
    var e = nk.match(/-?\d+/g), hx = +e[e.length - 2], hy = +e[e.length - 1], hr = ugly ? 22 : 18;
    if (!o.swim) b += path('M-12 -8 v-22 M14 -8 v-22', 'none', '#FF9A3C', 6) + ell(-16, -4, ugly ? 22 : 16, 6, '#FF9A3C', INK, 2.5) + ell(14, -4, ugly ? 22 : 16, 6, '#FF9A3C', INK, 2.5);
    if (o.flap) b += path('M-20 -70 Q-60 -170 -124 -150 Q-84 -120 -40 -60Z', c, INK, 4);
    b += path('M-58 -60 Q-88 -76 -80 -46Z', c, INK, 3.5) + ell(0, -50, 62, 36, c, INK, 4);
    b += o.flap ? path('M0 -74 Q-10 -184 -70 -194 Q-50 -132 -16 -66Z', LH.shade(c, -.05), INK, 4) : path('M-36 -58 Q4 -30 30 -60 Q6 -18 -36 -58Z', LH.shade(c, -.08), INK, 3);
    b += tube(nk, ugly ? 22 : 16, c) + circ(hx, hy, hr, c, INK, 4);
    b += path('M' + (hx + 14) + ' ' + (hy - 6) + ' Q' + (hx + 44) + ' ' + (hy - 2) + ' ' + (hx + 46) + ' ' + (hy + 6) + ' Q' + (hx + 30) + ' ' + (hy + 12) + ' ' + (hx + 12) + ' ' + (hy + 6) + 'Z', ugly ? '#7D7890' : '#FF9A3C', INK, 3);
    if (!ugly) b += circ(hx + 13, hy - 1, 5, INK);
    b += o.sad ? path('M' + (hx - 4) + ' ' + (hy - 6) + ' q6 5 12 0', 'none', INK, 3) : circ(hx + 4, hy - 6, 4, INK) + circ(hx + 5.5, hy - 7.5, 1.4, '#FFFFFF');
    if (ugly) b += path('M' + (hx - 6) + ' ' + (hy - 20) + ' l-6 -12 M' + (hx + 4) + ' ' + (hy - 22) + ' l2 -13', 'none', INK, 3);
    if (o.swim) b += path('M-84 -14 q20 -10 40 0 t40 0 t40 0 t40 0', 'none', '#FFFFFF', 4);
    return at(x, y, s, b, o.flip);
  }
  function flyer(x, y, s) {
    return at(x, y, s, path('M-10 -4 Q-20 -70 -70 -86 Q-36 -40 10 -4Z', '#FFFFFF', INK, 3.5) + ell(0, 0, 46, 15, '#FFFFFF', INK, 3.5) + tube('M36 -4 L96 -14', 7, '#FFFFFF') +
      circ(100, -15, 9, '#FFFFFF', INK, 3) + path('M108 -18 L124 -14 L108 -10Z', '#FF9A3C', INK, 2) + path('M10 -2 Q30 -60 0 -82 Q-4 -40 -16 -2Z', '#F4F2F7', INK, 3.5));
  }
  function nest(x, y, s, o) {
    o = o || {};
    var b = '';
    if (o.egg) b += ell(0, -40, 30, 38, '#F4F1E4', INK, 4);
    if (o.shells) b += path('M-70 -30 Q-74 -64 -48 -70 l6 12 l8 -14 l8 12 Q-30 -40 -38 -30Z', '#F4F1E4', INK, 3) + path('M44 -28 Q40 -52 58 -60 l6 10 l8 -12 l6 12 Q86 -44 80 -26Z', '#F4F1E4', INK, 3);
    b += path('M-110 -30 Q-100 10 0 12 Q100 10 110 -30 Q60 -10 0 -12 Q-60 -10 -110 -30Z', '#C9A270', INK, 4) + path('M-90 -14 l40 6 M-30 -4 l50 -2 M40 -6 l40 -10 M-70 4 l36 -12 M20 6 l40 -14', 'none', '#8A6A45', 3);
    return at(x, y, s, b);
  }
  function turkey(x, y, s, o) {
    o = o || {};
    var b = '', cs = ['#C8372D', '#FF9A3C', '#FFC93C', '#8A5A3B', '#C8372D', '#FF9A3C', '#FFC93C'];
    for (var i = 0; i < 7; i++) b += ell(-30, -150, 18, 70, cs[i], INK, 3.5).replace('/>', ' transform="rotate(' + (-75 + i * 25) + ' -30 -90)"/>');
    b += path('M-14 -2 v-24 M14 -2 v-24', 'none', '#E9A23B', 5) + ell(-8, -70, 52, 48, '#7A4E30', INK, 4) + tube('M24 -104 Q40 -132 36 -150', 9, '#A9C9E8') + circ(38, -156, 16, '#A9C9E8', INK, 3.5) +
      path('M52 -160 L66 -155 L52 -150Z', '#FFB020', INK, 2.5) + path('M47 -150 q8 16 -2 22 q-6 -8 2 -22Z', '#FF3D5A', INK, 2.5) + circ(42, -161, 3.5, INK);
    return at(x, y, s, b, o.flip);
  }
  function pond(cx, cy, rx, ry, o) {
    o = o || {};
    var s = ell(cx, cy, rx, ry, o.ice ? '#DDF3FF' : '#86CCF2', INK, 4.5);
    if (o.ice) s += path('M' + (cx - rx * .55) + ' ' + (cy - 8) + ' l60 18 l50 -24 l70 20 M' + (cx + 60) + ' ' + (cy + 30) + ' l40 -16 l60 12', 'none', '#FFFFFF', 5) + ell(cx - rx * .3, cy - ry * .3, 70, 12, '#FFFFFF', null, 0, ' opacity=".7"');
    else s += waves(cx - rx * .75, cx + rx * .75, cy - ry * .5, cy + ry * .55, 6, o.sd || 31);
    if (o.pads) s += ell(cx - rx * .62, cy + ry * .35, 30, 10, '#59B45E', INK, 3) + ell(cx + rx * .55, cy - ry * .25, 26, 9, '#59B45E', INK, 3) + circ(cx + rx * .55 + 10, cy - ry * .25 - 6, 7, C.pink, INK, 2);
    return s;
  }
  /* the troll: friendly underneath; mood grumpy|sad|happy|laugh, arms down|up|hold */
  function troll(x, y, s, o) {
    o = o || {};
    var sk = '#8CC48A', dk = LH.shade(sk, -.2), b = '', mood = o.mood || 'grumpy';
    b += ell(-40, -10, 44, 18, dk, INK, 4) + ell(40, -10, 44, 18, dk, INK, 4) + path('M-90 -30 Q-112 -200 0 -212 Q112 -200 90 -30 Q0 -12 -90 -30Z', '#A0623A', INK, 4.5) +
      path('M-50 -90 h30 v30 h-30Z', '#C98B4E', INK, 3) + path('M-50 -90 l30 30 M-20 -90 l-30 30', 'none', INK, 2);
    var aL = o.arms === 'up' ? 'M-80 -170 Q-140 -230 -128 -292' : o.arms === 'hold' ? 'M-80 -170 Q-96 -110 -30 -112' : 'M-80 -170 Q-128 -120 -118 -70';
    var aR = aL.replace(/(-?\d+)( -?\d+)/g, function (m0, a, rest) { return (-a) + rest; });
    b += tube(aL, 32, sk) + tube(aR, 32, sk);
    b += ell(-92, -272, 24, 36, sk, INK, 4).replace('/>', ' transform="rotate(-24 -92 -272)"/>') + ell(92, -272, 24, 36, sk, INK, 4).replace('/>', ' transform="rotate(24 92 -272)"/>');
    b += tube('M-34 -348 q-10 -26 4 -40 M0 -352 q0 -34 14 -42 M30 -348 q12 -24 28 -24', 7, '#6A4024') + circ(0, -270, 82, sk, INK, 4.5);
    b += mood === 'grumpy' ? path('M-52 -308 L-14 -292 M52 -308 L14 -292', 'none', INK, 8) : mood === 'sad' ? path('M-52 -292 L-14 -306 M52 -292 L14 -306', 'none', INK, 7) : path('M-50 -304 q16 -12 32 -2 M50 -304 q-16 -12 -32 -2', 'none', INK, 6);
    b += mood === 'laugh' ? path('M-42 -282 q12 -12 24 0 M18 -282 q12 -12 24 0', 'none', INK, 5) : circ(-30, -280, 13, '#FFFFFF', INK, 3.5) + circ(30, -280, 13, '#FFFFFF', INK, 3.5) + circ(-27, -277, 6.5, INK) + circ(27, -277, 6.5, INK);
    b += ell(0, -248, 28, 24, dk, INK, 4) + circ(14, -256, 4, LH.shade(sk, .3));
    if (mood === 'grumpy') b += path('M-40 -206 Q0 -224 40 -206', 'none', INK, 5) + path('M-24 -213 l6 14 l6 -14Z', '#FFFFFF', INK, 3);
    else if (mood === 'sad') b += path('M-30 -206 Q0 -224 30 -206', 'none', INK, 5) + ell(48, -262, 7, 11, '#9FD3FF', INK, 2.5);
    else b += path('M-46 -222 Q0 -168 46 -222Z', '#7A2638', INK, 4) + path('M-20 -219 l6 12 l6 -12Z', '#FFFFFF', INK, 2.5);
    b += circ(-56, -236, 11, C.pink, null, 0, ' opacity=".55"') + circ(56, -236, 11, C.pink, null, 0, ' opacity=".55"');
    return at(x, y, s, b, o.flip);
  }
  function bridge(x0, x1, y) {
    var mid = (x0 + x1) / 2, s = '', dy = function (x) { var t = (x - x0) / (x1 - x0); return y - 200 * t * (1 - t); };
    [x0 + 50, mid - 15, x1 - 80].forEach(function (px) { s += rect(px, dy(px) + 10, 30, 250, C.wood2, INK, 4, 6); });
    s += path('M' + x0 + ' ' + y + ' Q' + mid + ' ' + (y - 100) + ' ' + x1 + ' ' + y + ' L' + x1 + ' ' + (y + 26) + ' Q' + mid + ' ' + (y - 74) + ' ' + x0 + ' ' + (y + 26) + 'Z', C.wood, INK, 4.5);
    for (var x = x0 + 36; x < x1 - 20; x += 36) s += path('M' + P(x) + ' ' + P(dy(x) + 2) + ' v22', 'none', C.wood2, 3);
    for (x = x0 + 10; x <= x1 - 4; x += 70) s += tube('M' + P(x) + ' ' + P(dy(x)) + ' v-58', 6, C.wood2);
    return s + tube('M' + x0 + ' ' + (y - 56) + ' Q' + mid + ' ' + (y - 156) + ' ' + x1 + ' ' + (y - 56), 8, C.wood);
  }
  function goat(x, y, s, o) {
    o = o || {};
    var c = o.c || '#FFFFFF', fat = o.round ? 1.3 : 1, b = tube('M-72 -118 l-18 -16', 6, c);
    [-52, -24, 28, 54].forEach(function (lx) { b += rect(lx, -74, 15, 74, c, INK, 4, 6) + rect(lx - 1, -12, 17, 12, '#5A3F2E', INK, 3, 3); });
    b += ell(0, -104, 78, 40 * fat, c, INK, 4.5);
    var hd = path('M46 -124 L74 -176 L104 -164 L84 -110Z', c, INK, 4);
    if (o.horns === 'curly') hd += tube('M86 -204 C70 -252 140 -262 132 -212 C128 -194 110 -198 114 -214', 9, '#E6D5AE');
    else if (o.horns !== false) hd += tube(o.horns === 'mid' ? 'M90 -204 q2 -36 26 -44' : 'M92 -204 q4 -22 18 -26', 6, '#E6D5AE');
    hd += path('M86 -192 L52 -198 L80 -176Z', c, INK, 3.5) + ell(100, -184, 30, 24, c, INK, 4).replace('/>', ' transform="rotate(28 100 -184)"/>') + ell(120, -168, 16, 13, LH.shade(c, -.07), INK, 3.5) +
      path('M114 -158 l-4 28 l14 -14Z', LH.shade(c, -.2), INK, 3) + circ(127, -172, 2.5, INK);
    hd += o.mood === 'happy' ? path('M92 -192 q6 -6 12 0', 'none', INK, 3.5) : circ(98, -192, o.mood === 'wow' ? 6 : 4.5, INK) + circ(99.5, -193.5, 1.8, '#FFFFFF');
    b += o.down ? g('rotate(30 70 -130)', hd) : hd;
    return at(x, y, s, b, o.flip);
  }
  function tortoise(x, y, s, o) {
    o = o || {};
    var sk = '#A8D27E', sh = '#5FA052', st = o.step ? 10 : 0, b = '';
    b += ell(-50 - st, -12, 18, 16, sk, INK, 3.5) + ell(36 + st, -12, 18, 16, sk, INK, 3.5) + path('M-82 -30 l-22 8 l20 6Z', sk, INK, 3) + tube('M56 -44 Q88 -54 96 -80', 22, sk);
    b += path('M-84 -26 Q-84 -128 0 -132 Q84 -128 84 -26Z', sh, INK, 4.5) + tube('M-92 -26 L92 -26', 8, '#8FC46A') + path('M-44 -32 L-32 -86 L32 -86 L44 -32 M-32 -86 L0 -118 L32 -86 M-32 -86 L-70 -66 M32 -86 L70 -66', 'none', LH.shade(sh, -.25), 4);
    b += ell(-20 + st, -6, 18, 14, sk, INK, 3.5) + ell(58 - st, -6, 18, 14, sk, INK, 3.5) + circ(104, -92, 28, sk, INK, 4);
    b += o.mood === 'happy' ? path('M104 -102 q7 -6 14 0', 'none', INK, 3.5) : circ(112, -100, 5.5, INK) + circ(113.5, -101.5, 2, '#FFFFFF');
    b += path('M108 -80 q10 6 18 -4', 'none', INK, 3.5) + circ(120, -86, 6, C.pink, null, 0, ' opacity=".6"');
    if (o.medal) b += path('M86 -68 L96 -40 L106 -66', 'none', C.red, 6) + daisy(96, -36, 14);
    return at(x, y, s, b, o.flip);
  }
  /* the hare: pose stand (sitting up), run, sleep; hips; blush */
  function hare(x, y, s, o) {
    o = o || {};
    var c = o.c || '#C9A483', w = '#FFF6EA', b = '', pose = o.pose || 'stand';
    function face(hx, hy, r) {
      var f = (o.mood === 'sleep' ? path('M' + (hx + 2) + ' ' + (hy - 6) + ' q7 5 14 0', 'none', INK, 3.5) : circ(hx + 9, hy - 6, o.mood === 'wow' ? 7 : 5.5, INK) + circ(hx + 10.5, hy - 7.5, 2, '#FFFFFF')) +
        ell(hx + r - 4, hy + 6, 6, 5, C.pink, INK, 2) + path('M' + (hx + r - 8) + ' ' + (hy + 12) + ' q-6 8 -14 4', 'none', INK, 2.5) + rect(hx + r - 16, hy + 14, 10, 10, '#FFFFFF', INK, 2, 2) +
        path('M' + (hx + r - 2) + ' ' + (hy + 6) + ' l26 -6 M' + (hx + r - 2) + ' ' + (hy + 8) + ' l26 6', 'none', INK, 1.5);
      if (o.blush || o.mood === 'wow') f += circ(hx - 2, hy + 10, 9, C.pink, null, 0, ' opacity=".7"');
      return f;
    }
    function ears(hx, hy, rot) {
      return [-10, 14].map(function (dx, i) { var ex = hx + dx; return g('rotate(' + (rot + (i ? 12 : -6)) + ' ' + ex + ' ' + (hy - 20) + ')', ell(ex, hy - 56, 12, 44, c, INK, 3.5) + ell(ex, hy - 52, 5, 30, C.pink)); }).join('');
    }
    if (pose === 'run') {
      b += tube('M-50 -60 Q-100 -40 -140 -22', 22, c) + tube('M50 -70 Q100 -60 140 -42', 16, c) + path('M-176 -96 h-60 M-166 -66 h-80 M-176 -36 h-50', 'none', '#9FC7F0', 6);
      b += circ(-80, -84, 16, '#FFFFFF', INK, 3.5) + ell(0, -72, 76, 34, c, INK, 4) + ell(14, -60, 40, 14, w) + ears(80, -100, -70) + circ(80, -100, 32, c, INK, 4) + face(80, -100, 32);
    } else if (pose === 'sleep') {
      b += circ(-90, -42, 14, '#FFFFFF', INK, 3) + ell(0, -34, 90, 34, c, INK, 4) + ell(10, -22, 44, 11, w) + ell(36, -86, 46, 11, c, INK, 3.5) + ell(30, -72, 46, 11, c, INK, 3.5) + circ(80, -56, 32, c, INK, 4) + face(80, -56, 32);
    } else {
      b += circ(-46, -36, 15, '#FFFFFF', INK, 3) + ell(0, -70, 46, 64, c, INK, 4) + ell(12, -62, 26, 42, w) + ell(30, -8, 34, 11, c, INK, 3.5);
      b += tube(o.hips ? 'M16 -104 Q-14 -84 -2 -62' : 'M24 -104 Q46 -86 40 -64', 13, c) + ears(24, -158, 0) + circ(24, -158, 38, c, INK, 4) + face(24, -158, 38);
    }
    return at(x, y, s, b, o.flip);
  }
  function hedgehog(x, y, s, flip) {
    return at(x, y, s, path('M-56 0 L-62 -20 L-50 -26 L-54 -46 L-36 -44 L-30 -62 L-14 -52 L0 -66 L10 -50 L26 -58 L28 -40 L40 -40 L36 -20 L30 0Z', '#8A5A3B', INK, 3.5) +
      ell(34, -16, 22, 15, '#F2D9A6', INK, 3) + circ(56, -16, 4.5, INK) + circ(38, -22, 3, INK) + ell(-20, -2, 10, 5, '#F2D9A6', INK, 2.5) + ell(16, -2, 10, 5, '#F2D9A6', INK, 2.5), flip);
  }
  function finish(x0, x1, y, broken) {
    var s = tube('M' + x0 + ' ' + y + ' v-170 M' + x1 + ' ' + y + ' v-170', 8, C.wood2) + path('M' + x0 + ' ' + (y - 170) + ' l40 12 l-40 12Z M' + x1 + ' ' + (y - 170) + ' l40 12 l-40 12Z', C.sun, INK, 3);
    if (!broken) s += tube('M' + x0 + ' ' + (y - 120) + ' Q' + ((x0 + x1) / 2) + ' ' + (y - 96) + ' ' + x1 + ' ' + (y - 120), 7, C.red);
    else s += tube('M' + x0 + ' ' + (y - 120) + ' Q' + (x0 + 40) + ' ' + (y - 70) + ' ' + (x0 + 16) + ' ' + (y - 30), 7, C.red) + tube('M' + x1 + ' ' + (y - 120) + ' Q' + (x1 - 50) + ' ' + (y - 80) + ' ' + (x1 - 24) + ' ' + (y - 40), 7, C.red);
    return s;
  }
  function thought(x, y, inner) { return blob([[x - 70, y, 50], [x, y - 24, 62], [x + 70, y, 50], [x, y + 26, 50]], '#FFFFFF', INK, 4) + circ(x - 100, y + 80, 14, '#FFFFFF', INK, 3.5) + circ(x - 122, y + 116, 9, '#FFFFFF', INK, 3) + inner; }

  /* ------------------------------------------------------------------ The Gingerbread Man */
  var gbKitchen = function (o) {
    o = o || {};
    var s = room({ wall: '#FFF0DA', floor: '#C98B4E', dot: '#FFD8A8', window: [690, 80, 170, 140], curtain: C.red }) + windowSnow(690, 80, 170, 140);
    if (o.door) s += rect(880, 250, 130, 270, '#DDF2FF', INK, 4, 4) + path('M880 470 Q940 450 1010 466 L1010 520 L880 520Z', '#F4F8FF', INK, 3) + path('M880 250 L842 272 L842 536 L880 520Z', '#A86B3A', INK, 4);
    return s;
  };
  var gbBank = function () { return sky() + sun(860, 100, 40) + cloud(140, 90, .8) + hills('#7CCB6E', C.grass2, -90) + riverBand(420, 560) + ground(560, C.grass) + reeds(80, 620, .8) + reeds(930, 640, .9); };
  S.gingerbread = {
    cover: function (h) {
      return sky() + sun(860, 100, 46) + cloud(150, 90, .8) + hills() + tree(920, 540, 1) + flowers(10, 600, 640, 12) + path('M-10 660 Q500 600 1010 640', 'none', C.path, 80) +
        h({ x: 360, y: 690, s: .95, pose: 'walk', mood: 'laugh' }) + gingerbread(700, 660, .85, { run: true }) + txt(700, 330, 46, 'RUN, RUN!', C.sun, -6);
    },
    pages: [
      function (h) {
        return gbKitchen() + table(500, 690, 620) + rect(330, 556, 340, 16, '#F3E2C2', INK, 3.5, 8) + gingerbread(500, 556, .5, { raw: true }) + rollingPin(640, 546) + circ(380, 546, 14, '#F3D7A8', INK, 3) + circ(416, 548, 12, '#F3D7A8', INK, 3) +
          per('grandma', 180, 690, .8, { pose: 'hold', mood: 'laugh' }) + h({ x: 820, y: 690, s: .9, pose: 'hold', mood: 'happy', flip: true });
      },
      function (h) {
        return gbKitchen() + oven(560, 640, 1.1, { lit: true }) + path('M520 340 q-20 -30 0 -60 q20 -30 0 -60 M600 340 q-20 -30 0 -60 q20 -30 0 -60', 'none', '#FFFFFF', 7, ' opacity=".9"') +
          h({ x: 330, y: 690, s: .9, pose: 'reach', mood: 'wow' }) + per('grandma', 820, 690, .8, { pose: 'point', mood: 'happy', flip: true }) + txt(560, 170, 50, 'SNIFF!', C.sun, -6);
      },
      function (h) {
        return gbKitchen({ door: true }) + table(330, 690, 420) + per('grandma', 140, 690, .78, { pose: 'shrug', mood: 'wow' }) + h({ x: 520, y: 690, s: .9, pose: 'shrug', mood: 'wow' }) +
          gingerbread(790, 690, .7, { run: true }) + txt(640, 220, 42, 'CATCH ME!', C.sun, -6);
      },
      function (h) {
        return sky() + sun(150, 100, 44) + cloud(600, 80, .8) + hills('#7CCB6E', C.grass, -10) + fence(520, 560, 1010) + cow(700, 560, .55) + txt(840, 330, 40, 'MOO!', '#FFFFFF', 6) +
          path('M-10 660 Q500 610 1010 650', 'none', C.path, 70) + per('grandma', 110, 680, .7, { pose: 'walk', mood: 'wow' }) + h({ x: 330, y: 690, s: .9, pose: 'walk', mood: 'laugh' }) + gingerbread(620, 670, .6, { run: true });
      },
      function (h) {
        return sky() + cloud(200, 80, .8) + cloud(700, 100, .7) + hills('#D9C86A', '#E8D47A', -10) + hay(110, 560, .8) + hay(930, 540, .6) + horse(660, 590, .5, { run: true }) +
          per('v4', 870, 650, .6, { pose: 'cheer', mood: 'wow' }) + per('grandpa', 420, 630, .6, { pose: 'walk', mood: 'laugh' }) + cow(70, 690, .4) + per('grandma', 270, 690, .62, { pose: 'walk', mood: 'laugh' }) +
          h({ x: 560, y: 690, s: .85, pose: 'walk', mood: 'laugh' }) + gingerbread(780, 690, .55, { run: true }) + txt(500, 160, 44, 'RUN, RUN!', C.sun, -4);
      },
      function (h) { return gbBank() + gingerbread(290, 660, .7, { mood: 'oops' }) + fox(680, 660, .9, { flip: true }) + txt(290, 380, 56, '?!', C.sun); },
      function (h) {
        return sky() + sun(150, 100, 40) + cloud(560, 90, .8) + hills('#7CCB6E', C.grass2, -100) + riverBand(400, 710) + fox(460, 690, .9) + waterFront(620) +
          path('M1010 470 Q840 450 720 500 Q750 600 790 710 L1010 710Z', C.grass, INK, 4) + reeds(950, 560, .7) + h({ x: 870, y: 650, s: .8, pose: 'cheer', mood: 'wow', flip: true }) +
          gingerbread(460 + 136 * .9, 690 - 142 * .9, .42, { cheer: true, mood: 'wow' }) + txt(380, 220, 50, 'SNIP, SNAP!', C.sun, -6) + txt(840, 330, 44, 'JUMP!', '#FFFFFF', 6);
      },
      function (h) {
        return gbBank() + fox(760, 660, .85, { mood: 'sad', flip: true }) + circ(610, 650, 16, C.red, INK, 3.5) + path('M610 634 q4 -10 10 -10', 'none', '#3E8E4E', 3) +
          h({ x: 330, y: 690, s: .95, pose: 'hold', mood: 'laugh' }) + gingerbread(330, 690 - 92, .4, { cheer: true }) + hearts(330, 240, 2) + txt(760, 330, 34, 'oh well…', '#FFFFFF');
      },
      function (h) {
        var cookies = '';
        [[300, .36], [390, .34], [600, .36], [690, .34]].forEach(function (c, i) { cookies += gingerbread(c[0], 572, c[1], { cheer: i % 2 === 0, mood: 'happy' }); });
        return gbKitchen() + bunting(64, -20, 1020) + table(500, 690, 640) + cookies + gingerbread(495, 572, .44, { cheer: true }) + per('grandma', 860, 690, .76, { pose: 'cheer', mood: 'laugh', flip: true }) +
          h({ x: 150, y: 690, s: .85, pose: 'cheer', mood: 'laugh' }) + txt(500, 250, 54, 'PARTY!', C.sun, -4) + txt(250, 390, 34, '♪', '#FFFFFF') + txt(760, 380, 34, '♫', '#FFFFFF');
      }
    ]
  };

  /* ------------------------------------------------------------------ The Ugly Duckling */
  var GREY = '#9C98AE';
  var pondScene = function (o) {
    o = o || {};
    var season = o.season || 'spring', s = sky({ autumn: '#FFE2BC', winter: '#DCE9F5' }[season]);
    if (season === 'winter') s += cloud(120, 110, 1) + cloud(640, 80, .9) + hills('#E9F1FA', '#F4F8FF');
    else if (season === 'autumn') s += sun(860, 110, 44) + hills('#D9B060', '#E8C670') + tree(90, 520, 1.1, { c: '#F0A040' }) + tree(920, 500, 1, { c: '#E8742A' });
    else s += sun(870, 100, 44) + cloud(160, 90, .8) + hills() + tree(80, 520, 1.1) + tree(940, 510, 1.05, { c: '#6CC46A' });
    s += pond(520, 612, 420, 82, { ice: season === 'winter', pads: season === 'spring' });
    if (season !== 'winter') s += reeds(140, 600, .9) + reeds(890, 590, .8);
    return s;
  };
  S.duckling = {
    cover: function (h) { return pondScene() + swan(620, 640, .95, { swim: true }) + chick(820, 690, .6) + chick(870, 680, .5, true) + h({ x: 290, y: 690, s: .95, pose: 'wave', mood: 'laugh' }) + hearts(620, 330, 2); },
    pages: [
      function (h) {
        return pondScene() + duck(450, 666, .8, { sit: true }) + nest(560, 692, 1.1, { egg: true }) + chick(680, 690, .55) + chick(730, 684, .5, true) + chick(380, 690, .5, true) +
          h({ x: 870, y: 690, s: .88, pose: 'hold', mood: 'wow', flip: true });
      },
      function (h) {
        return pondScene() + duck(290, 680, .8, { mood: 'wow' }) + nest(520, 692, 1.1, { shells: true }) + swan(500, 676, .72, { ugly: true, c: GREY }) + chick(650, 690, .5) + chick(160, 690, .5, true) +
          h({ x: 830, y: 690, s: .88, pose: 'wave', mood: 'happy', flip: true }) + txt(520, 230, 60, 'CRACK!', C.sun, -6);
      },
      function (h) {
        return farm() + hen(170, 690, .8) + turkey(380, 690, .8) + chick(540, 690, .5) + chick(590, 690, .45, true) + swan(690, 690, .62, { ugly: true, c: GREY, sad: true }) +
          h({ x: 850, y: 690, s: .85, pose: 'hold', mood: 'sad', flip: true }) + hearts(770, 330, 1) + txt(300, 190, 44, 'TOO BIG!', '#FFFFFF', -6) + txt(560, 140, 44, 'TOO GREY!', C.sun, 6);
      },
      function (h) {
        var r = '';
        seed = 37;
        for (var i = 0; i < 7; i++) r += reeds(40 + i * 150 + rnd() * 40, 560 + rnd() * 40, .6 + rnd() * .4);
        return sky('#CFE3EA') + cloud(150, 100, 1) + cloud(620, 80, .9) + ground(470, '#9CC98A') + ell(250, 600, 140, 26, '#A9DAF2', INK, 3) + ell(780, 560, 110, 20, '#A9DAF2', INK, 3) + r +
          bird(330, 170, 1.2) + bird(400, 210, 1) + bird(470, 250, .9) + bird(260, 210, 1) + bird(190, 250, .9) + txt(720, 200, 40, 'HONK!', '#FFFFFF', 6) +
          h({ x: 520, y: 690, s: .95, pose: 'point', mood: 'oops' }) + txt(520, 330, 36, 'WHERE ARE YOU?', '#FFFFFF');
      },
      function (h) {
        return pondScene({ season: 'autumn' }) + leaves(16, 41) + flyer(260, 160, .7) + flyer(380, 210, .7) + flyer(500, 150, .65) + flyer(620, 200, .6) +
          swan(800, 610, .45, { ugly: true, c: GREY, swim: true }) + reeds(860, 630, .6) + h({ x: 330, y: 690, s: .95, pose: 'point', mood: 'wow' });
      },
      function (h) {
        return pondScene({ season: 'winter' }) + snowfall(40, 3) + swan(580, 630, .62, { ugly: true, c: GREY, swim: true, sad: true }) + h({ x: 300, y: 690, s: .92, pose: 'hold', mood: 'oops' }) +
          scarf(300, 690 - 96) + txt(600, 420, 34, 'brrr…', '#FFFFFF');
      },
      function (h) {
        return room({ wall: '#FFE7C9', floor: '#C98B4E', dot: '#FFD3A0', window: [690, 80, 170, 140], night: true, curtain: '#3DBE8B' }) + windowSnow(690, 80, 170, 140) + fireplace(210, 600, .9) +
          ell(520, 660, 300, 38, '#EF5A36', INK, 4) + ell(520, 660, 240, 26, '#FFC93C', INK, 3) + swan(500, 660, .66, { ugly: true, c: '#D8D4E4' }) + [[600, 650], [620, 662], [640, 648]].map(function (p) { return circ(p[0], p[1], 5, '#E0A458', INK, 2); }).join('') +
          h({ x: 790, y: 690, s: .88, pose: 'hold', mood: 'laugh', flip: true }) + openBook(790, 604, .7) + mug(940, 690, .8);
      },
      function (h) {
        return pondScene() + swan(220, 610, .62, { swim: true }) + swan(360, 630, .55, { swim: true }) + '<g opacity=".3">' + g('translate(0 1236) scale(1 -1)', swan(620, 618, .78, { swim: true, sad: true })) + '</g>' +
          swan(620, 618, .78, { swim: true, sad: true }) + sparkles(640, 440, 110, 6, 72) + h({ x: 880, y: 690, s: .88, pose: 'cheer', mood: 'wow', flip: true });
      },
      function (h) {
        return pondScene() + swan(260, 620, .7, { swim: true, flap: true }) + swan(440, 600, .6, { swim: true, flap: true }) + swan(640, 630, .78, { swim: true }) +
          h({ x: 870, y: 690, s: .9, pose: 'wave', mood: 'laugh', flip: true }) + hearts(640, 330, 2);
      }
    ]
  };

  /* ------------------------------------------------------------------ The Three Billy Goats Gruff */
  var BX0 = 300, BX1 = 740, BY = 470, LITTLE = { c: '#FFFFFF' }, MIDDLE = { c: '#EFE4D2', horns: 'mid' }, BIG = { c: '#C9B496', horns: 'curly' };
  function deckY(x) { var t = (x - BX0) / (BX1 - BX0); return BY - 200 * t * (1 - t) + 4; }
  function gt(base, extra) { return Object.assign({}, base, extra || {}); }
  var hillside = function () { return sky() + sun(150, 100, 44) + cloud(560, 80, .8) + mountains() + hills('#8ED37A', '#7CCB6E', -20) + flowers(10, 600, 690, 71) + grassTufts(14, 560, 690, 72); };
  var goatRiver = function (o) {
    o = o || {};
    seed = 83;
    var fl = '';
    for (var i = 0; i < 9; i++) fl += flower(720 + rnd() * 260, 470 + rnd() * 220, ['#FFFFFF', C.sun, C.pink][i % 3], .8 + rnd() * .3);
    return sky() + sun(880, 90, 40) + cloud(120, 90, .8) + mountains() + path('M-10 404 Q240 384 520 404 L520 710 L-10 710Z', o.bare ? '#CFC48A' : '#8ED37A', INK, 4) +
      path('M500 404 Q780 380 1010 398 L1010 710 L500 710Z', '#7CCB6E', INK, 4) + fl +
      path('M470 400 Q460 480 420 560 Q390 640 380 710 L700 710 Q680 620 640 540 Q600 470 570 400Z', '#7FC8F8', INK, 4) + waves(420, 660, 520, 680, 5, 9) +
      bridge(BX0, BX1, BY) + (o.eyes ? ell(525, BY + 62, 60, 26, '#2E2A63', null, 0, ' opacity=".55"') + circ(506, BY + 60, 7, '#FFE07A') + circ(544, BY + 60, 7, '#FFE07A') : '');
  };
  function trollUp(x, mood, arms) { return troll(x, 772, .6, { mood: mood, arms: arms }) + path('M' + (x - 150) + ' 652 Q' + x + ' 626 ' + (x + 150) + ' 652 L' + (x + 170) + ' 710 L' + (x - 170) + ' 710Z', '#7FC8F8', INK, 4) + waves(x - 120, x + 120, 668, 690, 3, 5); }
  var trollBank = function () { return sky() + sun(860, 100, 40) + cloud(160, 90, .8) + mountains() + hills('#8ED37A', '#7CCB6E', -60) + riverBand(440, 540) + ground(540, C.grass) + flowers(8, 600, 690, 74); };
  S.goats = {
    cover: function (h) {
      return goatRiver() + goat(410, deckY(410), .3, LITTLE) + goat(560, deckY(560), .38, MIDDLE) + trollUp(600, 'happy', 'up') + h({ x: 160, y: 690, s: .95, pose: 'cheer', mood: 'laugh' }) + txt(520, 150, 46, 'TRIP, TRAP!', C.sun, -6);
    },
    pages: [
      function (h) {
        return hillside() + goat(210, 630, .45, gt(LITTLE, { down: true })) + goat(420, 660, .6, gt(MIDDLE, { down: true })) + goat(680, 680, .8, gt(BIG, { mood: 'happy' })) +
          h({ x: 880, y: 690, s: .88, pose: 'wave', mood: 'laugh', flip: true }) + txt(330, 330, 36, 'MUNCH!', '#FFFFFF', -6) + txt(560, 290, 36, 'CRUNCH!', C.sun, 6);
      },
      function (h) {
        return goatRiver({ bare: true, eyes: true }) + goat(250, 540, .36, LITTLE) + goat(150, 580, .46, MIDDLE) + goat(120, 690, .6, BIG) + h({ x: 300, y: 690, s: .85, pose: 'point', mood: 'laugh' });
      },
      function (h) {
        return goatRiver({ bare: true }) + goat(470, deckY(470), .34, gt(LITTLE, { mood: 'wow' })) + trollUp(560, 'grumpy', 'up') + goat(150, 580, .46, MIDDLE) + goat(110, 690, .6, BIG) +
          h({ x: 280, y: 690, s: .78, pose: 'shrug', mood: 'wow' }) + txt(360, 150, 40, 'TRIP, TRAP!', C.sun, -6) + txt(760, 230, 34, 'WHO’S THAT?', '#FFFFFF', 6);
      },
      function (h) {
        return goatRiver({ bare: true }) + goat(860, 600, .38, gt(LITTLE, { down: true })) + goat(480, deckY(480), .42, gt(MIDDLE, { mood: 'wow' })) + trollUp(580, 'grumpy', 'up') + goat(120, 690, .6, BIG) +
          h({ x: 280, y: 690, s: .78, pose: 'hold', mood: 'oops' }) + txt(360, 150, 44, 'TRIP, TRAP!', C.sun, -6);
      },
      function (h) {
        return goatRiver({ bare: true }) + goat(860, 620, .38, gt(LITTLE, { down: true })) + goat(930, 690, .44, gt(MIDDLE, { down: true })) + goat(470, deckY(470), .52, gt(BIG, { down: true })) +
          trollUp(620, 'grumpy', 'up') + h({ x: 340, y: deckY(340) + 2, s: .62, pose: 'cheer', mood: 'wow' }) + txt(330, 150, 60, 'STOP!', C.red, -6);
      },
      function (h) {
        return trollBank() + troll(720, 690, .72, { mood: 'sad' }) + h({ x: 360, y: 690, s: .92, pose: 'shrug', mood: 'happy' }) + goat(110, 640, .4, LITTLE) + txt(760, 120, 36, 'rumble…', '#FFFFFF');
      },
      function (h) {
        return trollBank() + goat(120, 600, .4, LITTLE) + goat(930, 610, .44, MIDDLE) + blanket(250, 600, 500, 80, '#EF5A36') + picnic(330, 660, .9) +
          troll(820, 690, .66, { mood: 'laugh', arms: 'hold' }) + path('M790 590 L830 590 L830 566Z', '#FFE2C2', INK, 3) + h({ x: 190, y: 690, s: .85, pose: 'hold', mood: 'laugh' }) + hearts(820, 160, 2);
      },
      function (h) {
        return goatRiver() + goat(840, 600, .44, gt(MIDDLE, { round: true, down: true })) + goat(920, 690, .58, gt(BIG, { round: true })) + goat(760, 680, .36, gt(LITTLE, { round: true, down: true })) +
          trollUp(540, 'happy', 'hold') + hammer(600, 560, .9, -30) + h({ x: 380, y: deckY(380), s: .66, pose: 'hold', mood: 'laugh' }) + txt(520, 150, 46, 'TAP, TAP!', C.sun, -6);
      },
      function (h) {
        return goatRiver() + goat(390, deckY(390), .32, LITTLE) + troll(520, deckY(520), .4, { mood: 'laugh', arms: 'up' }) + h({ x: 640, y: deckY(640), s: .62, pose: 'wave', mood: 'laugh', flip: true }) +
          goat(130, 690, .56, BIG) + goat(250, 640, .42, MIDDLE) + blanket(780, 620, 200, 60, '#4EA8F5') + picnic(820, 670, .55) + hearts(520, 140, 3);
      }
    ]
  };

  /* ------------------------------------------------------------------ The Tortoise and the Hare */
  var meadow = function (o) { o = o || {}; return sky() + sun(860, 100, 44) + cloud(140, 90, .8) + cloud(520, 70, .7) + hills('#7CCB6E', C.grass, o.dy || 0) + (o.trees === false ? '' : tree(70, 500, .75, { c: '#6CC46A' }) + bush(300, 512, .7) + bush(640, 505, .6, '#4FB65A')) + flowers(o.n == null ? 10 : o.n, 600, 690, o.sd || 51) + grassTufts(16, 560, 690, (o.sd || 51) + 1); };
  S.tortoise = {
    cover: function (h) {
      return meadow() + finish(760, 960, 690) + hare(170, 560, .45, { pose: 'run' }) + h({ x: 380, y: 690, s: .95, pose: 'cheer', mood: 'laugh' }) + tortoise(620, 690, .9, { step: true, mood: 'happy' });
    },
    pages: [
      function (h) {
        return meadow() + path('M380 600 C380 500 740 500 740 600 C740 680 380 680 380 600', 'none', '#FFFFFF', 5, ' stroke-dasharray="14 14"') + hare(560, 520, .5, { pose: 'run' }) +
          tortoise(220, 690, .8, { mood: 'happy' }) + cloud(170, 380, .5) + path('M250 600 L210 420', 'none', '#FFFFFF', 3, ' stroke-dasharray="6 10"') + h({ x: 830, y: 690, s: .9, pose: 'wave', mood: 'laugh', flip: true });
      },
      function (h) {
        return meadow({ sd: 53 }) + hedgehog(90, 690, .6) + hare(330, 690, .8, { hips: true }) + tortoise(610, 690, .85) + h({ x: 860, y: 690, s: .85, pose: 'shrug', mood: 'wow', flip: true }) +
          txt(330, 170, 38, 'I’M THE FASTEST!', C.sun, -4) + txt(620, 420, 34, 'Let’s race!', '#FFFFFF');
      },
      function (h) {
        return meadow({ n: 0, sd: 55, trees: false }) + tree(830, 560, .8) + tree(980, 560, .8) + finish(840, 980, 560) + path('M60 660 L620 660', 'none', '#FFFFFF', 8, ' stroke-dasharray="22 14"') +
          hare(330, 650, .62) + tortoise(480, 655, .7) + hedgehog(700, 690, .5) + hedgehog(770, 690, .4, true) + hare(640, 610, .3, { c: '#E8DCC8' }) + hare(900, 680, .34, { c: '#B9B4C9', flip: true }) + bird(700, 300, .8) +
          h({ x: 140, y: 690, s: .85, pose: 'cheer', mood: 'laugh' }) + txt(380, 200, 70, 'GO!', C.red, -6);
      },
      function (h) {
        return meadow({ sd: 57 }) + hare(860, 520, .35, { pose: 'run' }) + blob([[760, 520, 20], [730, 510, 14], [790, 530, 12]], '#F2E6CF', INK, 3) + tortoise(500, 690, .85, { step: true }) +
          h({ x: 250, y: 690, s: .9, pose: 'cheer', mood: 'laugh' }) + txt(770, 300, 48, 'WHOOSH!', '#FFFFFF', -6) + txt(500, 420, 32, 'slow and steady!', C.sun);
      },
      function (h) {
        return meadow({ sd: 59 }) + tree(620, 600, 1.4) + hare(620, 650, .75, { pose: 'sleep', mood: 'sleep' }) + zzz(700, 430) + thought(860, 230, carrot(860, 210, .8, 70)) + tortoise(110, 620, .4, { step: true });
      },
      function (h) {
        return sky() + sun(150, 100, 44) + cloud(600, 80, .8) + path('M-10 520 Q300 290 620 470 Q800 560 1010 540 L1010 710 L-10 710Z', C.grass, INK, 4) +
          path('M-10 640 Q200 600 400 640 T800 630 T1010 650', 'none', INK, 40) + path('M-10 640 Q200 600 400 640 T800 630 T1010 650', 'none', '#7FC8F8', 32) + tortoise(380, 430, .6, { step: true }) +
          h({ x: 700, y: 690, s: .9, pose: 'cheer', mood: 'laugh', flip: true }) + hedgehog(870, 690, .5, true) + hare(940, 690, .32, { c: '#E8DCC8', flip: true }) + txt(560, 240, 40, '♪', '#FFFFFF') + txt(640, 200, 40, '♫', C.sun) + txt(870, 300, 40, '♪', '#FFFFFF');
      },
      function (h) {
        return meadow({ sd: 61 }) + tree(770, 600, 1.4) + hare(770, 650, .7, { pose: 'sleep', mood: 'sleep' }) + zzz(840, 430) + tortoise(470, 690, .8, { step: true }) +
          h({ x: 200, y: 690, s: .9, pose: 'hold', mood: 'happy' }) + txt(200, 230, 52, 'SHHH!', '#FFFFFF', -6);
      },
      function (h) {
        return meadow({ sd: 63 }) + finish(560, 860, 690, true) + hare(240, 600, .55, { pose: 'run', mood: 'wow' }) + tortoise(700, 690, .85, { mood: 'happy' }) +
          h({ x: 930, y: 690, s: .8, pose: 'cheer', mood: 'laugh', flip: true }) + sparkles(700, 470, 130, 7, 64) + txt(560, 170, 50, 'HOORAY!', C.sun, -6);
      },
      function (h) {
        return meadow({ sd: 65 }) + hedgehog(130, 690, .5) + hedgehog(200, 690, .4, true) + tortoise(420, 690, .85, { medal: true, mood: 'happy' }) + hare(620, 690, .75, { blush: true }) +
          h({ x: 840, y: 690, s: .9, pose: 'hold', mood: 'laugh', flip: true }) + hearts(500, 200, 3);
      }
    ]
  };
  LH.SCENES = S;

  /* The main character, or the "your hero here" outline in the generic book. */
  function heroDrawer(hero) {
    return function (o) {
      o = Object.assign({}, o);
      if (hero && hero.look) {
        var look = o.look ? Object.assign({}, hero.look, o.look) : hero.look;
        // a crown in the story goes on top of a hijab or patka instead of replacing it
        if (o.look && o.look.hat && LH.COVERS[hero.look.hat]) { look.hat = hero.look.hat; look.topHat = o.look.hat; }
        return LH.figure(look, o);
      }
      o.ghost = true; o.mood = 'happy';
      var s = o.s || 1, r = o.rot ? 0 : 1;
      return LH.figure(null, o) + (r ? star(o.x - 110 * s, o.y - 290 * s, 16 * s, C.sun, INK, 3) + star(o.x + 120 * s, o.y - 220 * s, 12 * s, '#FFFFFF', INK, 3) + star(o.x + 90 * s, o.y - 330 * s, 9 * s, C.sun, INK, 2.5) : '');
    };
  }
  /* The storybook finish: a softer plum ink instead of the near-black outline. */
  var SOFT = '#4A3F6B';
  LH.SOFT_INK = SOFT;
  LH.soften = function (svg) { return String(svg).split(INK).join(SOFT); };
  /* Colour-me-in: every coloured fill turns white, the ink stays. Thick outlined lines (limbs, tails, beanstalks) are
     drawn as an ink stroke plus a coloured stroke with the same path: the coloured twin turns white so the line stays
     an outlined tube to colour in. A coloured line with no twin (grass, rain, steam) becomes a thin ink line. */
  LH.outline = function (svg) {
    var counts = {}, seen = {};
    svg = String(svg);
    svg.replace(/ d="([^"]*)"/g, function (m, d) { counts[d] = (counts[d] || 0) + 1; return m; });
    return svg.replace(/<(path|circle|ellipse|rect|text)\b([^>]*?)(\/?)>/g, function (all, tag, attrs, close) {
      var dm = attrs.match(/ d="([^"]*)"/), d = dm && dm[1], k = 0, noFill = / fill="none"/.test(attrs);
      if (d) { k = seen[d] || 0; seen[d] = k + 1; }
      attrs = attrs.replace(/ fill="([^"]*)"/, function (mm, f) {
        if (f === 'none' || f.indexOf('url(') === 0 || f.toUpperCase() === INK) return mm;
        return f.indexOf('rgba') === 0 ? ' fill="none"' : ' fill="#FFFFFF"';
      });
      attrs = attrs.replace(/ stroke="([^"]*)"( stroke-width="([^"]*)")?/, function (mm, st, sww, sw) {
        if (st === 'none' || st.toUpperCase() === INK) return mm;
        if (d && noFill && counts[d] > 1) return (k > 0 ? ' stroke="#FFFFFF"' : ' stroke="' + INK + '"') + (sww || '');
        return ' stroke="' + INK + '" stroke-width="' + Math.min(+(sw || 4), 4) + '"';
      });
      return '<' + tag + attrs + close + '>';
    });
  };
  LH.sceneSvg = function (key, page, hero, o) {
    o = o || {};
    var st = S[key];
    if (!st) return '';
    var fn = page === 'cover' ? st.cover : st.pages[page];
    if (!fn) return '';
    var inner, id = o.clip || 'lhc', defs = '', over = '';
    try { inner = fn(heroDrawer(hero)); } catch (e) { console.error('scene', key, page, e); inner = rect(0, 0, 1000, 700, '#FFE7C2'); }
    if (o.outline) inner = LH.outline(inner);
    else {
      // a warm pastel wash, a soft glow in the middle and gently darker corners, like a painted page
      inner = LH.soften(inner);
      defs = '<radialGradient id="' + id + 'v" cx="50%" cy="44%" r="72%"><stop offset="0" stop-color="#FFFBEF" stop-opacity=".22"/><stop offset=".55" stop-color="#FFF4DC" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#C98B4E" stop-opacity=".2"/></radialGradient>';
      over = '<rect width="1000" height="700" fill="#FFF8EC" opacity=".1"/><rect width="1000" height="700" fill="url(#' + id + 'v)"/>';
      if (o.grain) {
        defs += '<filter id="' + id + 'g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/>' +
          '<feColorMatrix values="0 0 0 0 .42  0 0 0 0 .3  0 0 0 0 .2  0 0 0 .16 0"/></filter>';
        over += '<rect width="1000" height="700" filter="url(#' + id + 'g)"/>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"' + (o.w ? ' width="' + o.w + '" height="' + Math.round(o.w * .7) + '"' : '') + ' class="' + (o.cls || 'lh-scene') + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs>' + defs + '<clipPath id="' + id + '"><rect width="1000" height="700"/></clipPath></defs><g clip-path="url(#' + id + ')">' + inner + over + '</g></svg>';
  };
  /* A portrait or figure for the book pages, in the same finish as the scenes. */
  LH.bookAvatar = function (look, o) {
    var svg = LH.avatarSvg(look, o);
    return o && o.outline ? LH.outline(svg) : LH.soften(svg);
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
            : '<div class="ui-empty">' + UI.icon('inbox') + '<h3>No ' + (fbFilter === 'all' ? '' : fbFilter + ' ') + 'messages</h3><p>New feedback goes to Prepsto (prepsto.com). Older messages and requests from the app show up here.</p></div>');
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
        body.innerHTML = '<p class="muted">The twelve stories (server_code/Stories.py, pictures in web/pages/_scenes.html), with how many real books each has become. Example books are not counted.</p>' +
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
    return '<div class="ui-card bk-cta">' + (hero && hero.look ? LH.heroFace(hero) : '<span class="face"></span>') + '<div><h3>Make one starring your child</h3><p>Design a little cartoon look-alike in a minute, then pick from twelve classic tales. Free.</p></div>' +
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
      if (e.target.closest('[data-pdf]')) { LH.pdfDialog(book); return; }
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
      if (e.target.closest('[data-pdf]')) { LH.pdfDialog(book); return; }
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
    view.addEventListener('click', function (e) { if (e.target.closest('[data-pdf]')) LH.pdfDialog(book); });
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
    lead: 'Build a cartoon look-alike of your little one, from curls to freckles. Then watch them step into twelve beloved fairy tales, and download each book as a PDF to read, print, colour in or share.',
    proof: ['Free', 'No photos needed', 'Print-ready PDF'],
    stepsTitle: 'From giggles to bedtime in three steps',
    stepsLead: 'About five minutes, start to finish.',
    steps: [['Design your hero', 'Pick skin tone, face, hair, eyes, a favourite outfit and maybe a crown. Add their name and pronouns.'],
            ['Pick a story', 'Goldilocks, the Gingerbread Man, the Ugly Duckling… every picture has a space waiting for your child.'],
            ['Read, print, share', 'Turn pages together on any screen, press “Read to me”, or download a square PDF for the fridge, Grandma, a photo-book printer or the crayon box.']],
    featuresTitle: 'Little touches, big smiles',
    features: [['wand', 'A hero studio', '14 hairstyles, 8 skin tones, 5 face shapes, sparkly eyes, freckles, glasses, capes and crowns. “Surprise me” for wild ideas.'],
               ['book', '12 classic tales', 'Public-domain stories retold short and kind: around 300 words and nine illustrated pages each.'],
               ['download', 'A real PDF book', 'Cover, dedication page, the story and “The End”, made right in your browser. Print-ready with bleed for photo-book printers.'],
               ['brush', 'Colour me in', 'Every book also comes as an outline colouring book: colour the pages on screen, or print them for the crayons.'],
               ['volume', 'Read to me', 'The app reads each page aloud and turns the pages by itself. Lovely for wind-down time.'],
               ['link', 'Family links', 'Share one book with grandparents. They can read and print it without an account.'],
               ['heart', 'A shelf that grows', 'Siblings, cousins, best friends: up to 12 heroes, with reading stars for every bedtime.']],
    faq: [['Is it free?', 'Yes. Designing heroes, making books and downloading the PDFs are all free.'],
          ['Do I need to upload a photo of my child?', 'No, never. You build the cartoon by picking features, so no photo of your child ever leaves your device.'],
          ['What does the PDF look like?', 'Twelve square pages: a cover with your child, a “This book belongs to” page with your dedication, nine illustrated story pages and a happy “The End”. It prints nicely at home. For a photo-book printer, choose the print-ready version: 300 dpi pages in 8 × 8 in, 8.5 × 8.5 in or 20 × 20 cm, with the extra 3 mm bleed edge printers ask for. There is a colour-me-in outline version too.'],
          ['Where do the stories come from?', 'They are fairy tales over a hundred years old and in the public domain (Robert Southey, the Brothers Grimm, Hans Christian Andersen, Joseph Jacobs, Aesop and traditional folk tales). We retold them gently for ages 3 to 6: the bears make friends, the giant is just lonely and the troll only needed a picnic.'],
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
                 ['emperor', '{name} and the Emperor’s New Clothes', '#8a6bd8'], ['hen', '{name} and the Little Red Hen', '#ff8fb8'], ['elves', '{name} and the Elves', '#2fa39b'], ['pea', '{name} and the Pea', '#5b8def'],
                 ['gingerbread', '{name} and the Gingerbread Man', '#d9823b'], ['duckling', '{name} and the Ugly Duckling', '#5fb8e0'], ['goats', '{name} and the Billy Goats Gruff', '#8cc04b'], ['tortoise', '{name} and the Great Race', '#e9a23b']];
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
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Twelve stories, one little hero</h2><p>Tap a face to change who stars in the whole library.</p></div><div data-shelf></div>' +
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
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><div class="eyebrow">The story library</div><h1>Twelve classic tales, one little hero</h1>' +
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
        '<div class="ui-card flat lb-note">' + UI.icon('heart') + '<div><b>Where do the stories come from?</b><p class="muted small" style="margin:4px 0 0">Each tale is over a hundred years old and free for everyone: Robert Southey, the Brothers Grimm, Hans Christian Andersen, Joseph Jacobs, Aesop, St. Nicholas Magazine and folk tales from England, Norway and Russia. ' +
        'We retold them gently for little ones: the bears make friends, the giant is lonely rather than scary, the troll only needed a picnic, nobody eats the Gingerbread Man, and everybody shares the bread.</p></div></div></div>';
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
      '<button data-feedback>' + UI.icon('chat') + 'Submit feedback</button>' +
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
    face: [['size', 'How old?', 'size'], ['skin', 'Skin tone', 'sw'], ['face', 'Face shape', 'head'], ['nose', 'Nose', 'head'], ['marks', 'Cheeks & freckles', 'toggles'],
           ['mark', 'Face paint & little marks', 'head']],
    hair: [['hair', 'Hairstyle', 'head'], ['hairColor', 'Hair colour', 'sw']],
    eyes: [['eyes', 'Eyes', 'head'], ['eyeColor', 'Eye colour', 'sw'], ['brows', 'Eyebrows', 'head'], ['mouth', 'Smile', 'head']],
    clothes: [['outfit', 'Outfit', 'body'], ['outfitColor', 'Favourite colour', 'sw']],
    extras: [['hat', 'On their head', 'hat'], ['glasses', 'Glasses', 'head']]
  };
  var POSES = [['stand', 'Hello'], ['wave', 'Wave'], ['cheer', 'Hooray'], ['walk', 'Skip']];
  var STORIES = ['bears', 'beanstalk', 'turnip', 'porridge', 'emperor', 'hen', 'elves', 'pea', 'gingerbread', 'duckling', 'goats', 'tortoise'];
  function colorOf(key, v) { return key === 'skin' ? LH.COL.skin[v] : key === 'hairColor' ? LH.COL.hair[v] : key === 'eyeColor' ? LH.COL.eye[v] : LH.COL.cloth[v]; }
  function swName(key, v, i) { return key === 'skin' ? 'Skin tone ' + (i + 1) : (LH.COLOR_NAMES[v] || v); }
  function sizeLabel(v) { var o = LH.OPTIONS.size.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : 'Age 6'; }

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
      view.querySelector('[data-sub-out]').textContent = sizeLabel(look.size) + ' · ' + ({ she: 'she / her', he: 'he / him', they: 'they / them' }[st.pronoun]);
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
                        emperor: '{name} and the Emperor’s New Clothes', hen: '{name} and the Little Red Hen', elves: '{name} and the Elves', pea: '{name} and the Pea',
                        gingerbread: '{name} and the Gingerbread Man', duckling: '{name} and the Ugly Duckling', goats: '{name} and the Billy Goats Gruff', tortoise: '{name} and the Great Race' };
    function groups() {
      var look = st.look;
      view.querySelector('[data-groups]').innerHTML = GROUPS[tab].map(function (gr) {
        var key = gr[0], kind = gr[2], body = '';
        if (kind === 'sw') {
          body = '<div class="st-sw">' + LH.OPTIONS[key].map(function (v, i) {
            var nm = esc(swName(key, v, i));
            return '<button type="button" data-opt="' + key + '" data-val="' + v + '" class="' + (look[key] === v ? 'on' : '') + '" style="background:' + colorOf(key, v) + '" aria-label="' + nm + '" title="' + nm + '"></button>';
          }).join('') + '</div>';
        } else if (kind === 'seg') {
          body = '<div class="ui-seg">' + LH.OPTIONS[key].map(function (o) { return '<button type="button" data-opt="' + key + '" data-val="' + o[0] + '" class="' + (look[key] === o[0] ? 'on' : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
        } else if (kind === 'toggles') {
          body = '<div class="st-toggles">' + [['cheeks', 'Rosy cheeks'], ['freckles', 'Freckles']].map(function (t) {
            return '<button type="button" class="ui-btn sm' + (look[t[0]] ? ' on' : '') + '" data-tog="' + t[0] + '" aria-pressed="' + !!look[t[0]] + '">' + (look[t[0]] ? UI.icon('check') : UI.icon('plus')) + t[1] + '</button>';
          }).join('') + '</div>';
        } else {
          body = '<div class="st-opts' + (kind === 'body' ? ' body' : kind === 'size' ? ' sizes' : '') + '">' + LH.OPTIONS[key].map(function (o) {
            var l = Object.assign({}, look); l[key] = o[0];
            if (key === 'hat' && o[0] !== 'none' && l.hair === 'none') l.hair = 'fuzz';
            return '<button type="button" class="st-opt' + (look[key] === o[0] ? ' on' : '') + '" data-opt="' + key + '" data-val="' + o[0] + '"><span class="th">' +
              LH.avatarSvg(l, kind === 'body' ? {} : kind === 'size' ? { fit: 'tallest' } : { crop: kind === 'hat' ? 'hat' : 'head' }) + '</span>' + esc(o[1]) + '</button>';
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
