/* lh-book.js: books: LH.bookPages, LH.pageHtml, LH.reader (page turns, read aloud, colour me in, record my voice,
   painted pictures), LH.makePdf + LH.writePdf (the PDF made in the browser), LH.paintPicture (a page's picture as a
   PNG for the painting studio), LH.coverHtml, LH.confetti, LH.giftHtml + LH.giftCard (Gift it, 2026-11-20).
   Bedtime (2026-11-20): the reader's Bedtime switch dims the pages (class rd-night), reads slower, skips the confetti, plays
   the music quieter and adds a Goodnight page after The End (never in the PDF); Just listen reads to the end on an almost
   black screen, then goes dark and lets the screen sleep. Verse pages (a story text with line breaks, like the 1823
   Night Before Christmas) keep their lines on screen and in the PDF.
   The PDF options dialog and its progress window are Python forms (Dialogs.Pdf, Dialogs.PdfProgress). */
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
    // in full screen only the full-screen element is visible, so the confetti goes inside it
    (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(box);
    setTimeout(function () { box.remove(); }, 3200);
  };

  LH.title = function (story, hero) { return LH.fill(story.title, hero || LH.GENERIC); };

  LH.coverHtml = function (story, hero, o) {
    o = o || {};
    return '<div class="lh-cover' + (o.outline ? ' out' : '') + '" style="--cv:' + esc(story.color) + '"><div class="pic">' + LH.sceneSvg(story, 'cover', hero, { clip: LH.uid('cv'), outline: o.outline }) + '</div>' +
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

  /* ------------------------------------------------------------------ painted pictures
     The painting studio (Image Enhancer, server_code/Painting.py) repaints a book's pictures. Page numbers are the
     same as for recordings: 0 cover, 1 dedication, 2.. story pages, last The End. book.paint = {"<page>": {key}},
     book.paintBase + key is the picture's address. */
  LH.paintIndex = function (book, p) {
    if (p.kind === 'cover') return 0;
    if (p.kind === 'dedication') return 1;
    if (p.kind === 'story') return p.i + 2;
    if (p.kind === 'end') return book.story.text.length + 2;
    return -1;
  };
  LH.paintSrc = function (book, idx) {
    var p = book.paint && book.paint[idx];
    return p && p.key ? (book.paintBase || '') + p.key : '';
  };
  LH.hasPaint = function (book) { return !!(book.paint && Object.keys(book.paint).length); };

  /* ------------------------------------------------------------------ pictures and recordings kept for the visit
     Painted pictures and recorded pages are downloaded once and kept in memory (blob: addresses) until the tab
     closes, so turning back, reopening a book, reading it again or making its PDF downloads nothing again. A key
     changes whenever its content does (a repaint, a Redo), so a kept copy is never out of date. Up to ~200 MB; past
     that the longest-unused copies go first. load(src) -> Promise of the address to use; url(src) -> it, or ''. */
  LH.media = (function () {
    var LIMIT = 200 * 1024 * 1024, store = {}, order = [], bytes = 0, pending = {}, stats = { downloads: 0, reuses: 0 };
    // Anvil serves /_/api/ on every address of the app: fetch it from the one we're on, so no CORS is needed.
    function local(src) {
      try {
        var u = new URL(src, location.href);
        return u.origin !== location.origin && u.pathname.indexOf('/_/api/') >= 0 ? location.origin + u.pathname + u.search : u.href;
      } catch (e) { return src; }
    }
    function touch(src) { var i = order.indexOf(src); if (i >= 0) order.splice(i, 1); order.push(src); }
    function drop(src) {
      var e = store[src];
      if (!e) return;
      URL.revokeObjectURL(e.url); bytes -= e.size; delete store[src];
      var i = order.indexOf(src); if (i >= 0) order.splice(i, 1);
    }
    function put(src, blob) {
      drop(src);
      store[src] = { url: URL.createObjectURL(blob), size: blob.size || 0 };
      bytes += store[src].size; touch(src);
      while (bytes > LIMIT && order.length > 1) drop(order[0]);
      return store[src].url;
    }
    function url(src) {
      var e = src && store[src];
      if (!e) return '';
      touch(src); stats.reuses++;
      return e.url;
    }
    function load(src) {
      if (!src) return Promise.reject(new Error('no address'));
      if (store[src]) return Promise.resolve(url(src));
      if (pending[src]) return pending[src];
      return (pending[src] = fetch(local(src), { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      }).then(function (b) { delete pending[src]; stats.downloads++; return put(src, b); },
        function (e) { delete pending[src]; throw e; }));
    }
    /* Pictures drawn before they were in memory (data-lh-src): download once, then show. */
    function fill(root) {
      Array.prototype.forEach.call(root.querySelectorAll('img[data-lh-src]'), function (img) {
        var src = img.getAttribute('data-lh-src');
        img.removeAttribute('data-lh-src');
        load(src).then(function (u) { img.src = u; }, function () { img.src = src; });  // couldn't keep it: load it directly
      });
    }
    return { load: load, url: url, put: put, drop: drop, fill: fill, has: function (src) { return !!store[src]; },
      stats: function () { return { downloads: stats.downloads, reuses: stats.reuses, kept: order.length, bytes: bytes }; } };
  })();
  /* An <img> of a kept picture (or one that LH.media.fill downloads next). */
  function paintedImg(src) {
    var have = LH.media.url(src);
    return '<img class="rd-painted" ' + (have ? 'src="' + esc(have) + '"' : 'data-lh-src="' + esc(src) + '"') + ' alt="" decoding="async" draggable="false">';
  }

  LH.pageHtml = function (book, p, n, total, mode) {
    mode = mode || {};
    var hero = book.hero, st = book.story, clip = LH.uid('pg'), out = !!mode.outline, so = { clip: clip, outline: out, grain: !out };
    var src = mode.painted && !out ? LH.paintSrc(book, LH.paintIndex(book, p)) : '';
    if (p.kind === 'cover') {
      return '<div class="rd-cov" style="--cv:' + esc(st.color) + '"><div class="rd-pic">' + (src ? paintedImg(src) : LH.sceneSvg(st, 'cover', hero, so)) + '</div>' +
        '<h2>' + esc(LH.title(st, hero)) + '<small>' + (out ? 'A Little Hero colouring book' : 'A Little Hero Book') + '</small></h2></div>';
    }
    if (p.kind === 'dedication') {
      var h = hero || LH.GENERIC;
      return '<div class="rd-ded"><div class="frame">' + (src ? paintedImg(src) : portrait(hero, { crop: 'head', mood: 'laugh', outline: out })) + '</div>' +
        '<div class="belongs">' + (out ? 'This colouring book belongs to' : 'This book belongs to') + '</div><div class="who">' + esc(h.name) + '</div><p class="msg">' + esc(LH.dedication(book)) + '</p></div>';
    }
    if (p.kind === 'end') {
      return '<div class="rd-end"><div class="fig' + (src ? ' pp' : '') + '">' + (src ? paintedImg(src) : portrait(hero, { pose: 'wave', mood: 'laugh', outline: out })) + '</div>' +
        '<h2>The End</h2><p>' + esc(st.source) + '</p><p>' + esc(LH.madeLine(book)) + '</p></div>';
    }
    if (p.kind === 'goodnight') {
      var gh = hero || LH.GENERIC;
      return '<div class="rd-gn"><div class="rd-pic">' + LH.goodnightSvg(hero, { outline: out, grain: !out }) + '</div><h2>Goodnight, ' + esc(gh.name) + '.</h2><p>Sleep tight, little hero.</p></div>';
    }
    var words = st.text[p.i] || '', verse = words.indexOf('\n') >= 0;
    return '<div class="rd-pic">' + (src ? paintedImg(src) : LH.sceneSvg(st, p.i, hero, so)) + '</div><p class="rd-text' + (verse ? ' verse' : '') + '">' +
      (verse ? LH.fillHtml(words, hero).split('\n').map(function (l) { return '<span class="rd-line">' + l + '</span>'; }).join('') : LH.fillHtml(words, hero)) + '</p>' +
      '<div class="rd-num">' + (p.i + 1) + '</div>';
  };
  /* Words a speech voice reads well: the 1823 poem's thro', danc'd, rein-deer and St. Nick, and line breaks. */
  LH.speakable = function (t) {
    return String(t).replace(/\bthro’/g, 'through').replace(/([A-Za-z])’d\b/g, '$1ed').replace(/rein-deer/g, 'reindeer').replace(/\bjirk\b/g, 'jerk')
      .replace(/\bSt\. /g, 'Saint ').replace(/’(Twas|kerchief)/g, '$1').replace(/\s*\n\s*/g, ' ');
  };
  LH.pageSpeech = function (book, p) {
    var h = book.hero || LH.GENERIC;
    if (p.kind === 'cover') return LH.title(book.story, book.hero);
    if (p.kind === 'dedication') return 'This book belongs to ' + h.name + '. ' + LH.dedication(book);
    if (p.kind === 'end') return 'The End.';
    if (p.kind === 'goodnight') return 'Goodnight, ' + h.name + '. Sleep tight, little hero.';
    return LH.speakable(LH.fill(book.story.text[p.i], book.hero));
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

  /* ------------------------------------------------------------------ recorded voice
     A parent reads each page aloud and it is recorded in the browser (MediaRecorder). The recording goes to the
     server through opts.onVoiceSave(page, blob, seconds), which answers JSON {ok, voice, error}; "Read to me" then
     plays it, and pages without a recording fall back to the speech voice. book.voice = {"<page>": {key, seconds}};
     opts.voiceBase + key is the audio's address (Voice.py serves it with byte ranges). Each recording is downloaded
     once per visit and played from memory after that (LH.media); a page just recorded plays from memory at once. */
  LH.VOICE_MAX = 180;  // seconds per page (the server's limit too)
  LH.canRecord = function () { return !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); };
  /* MP4/AAC first (it plays everywhere, iPhones included), then WebM/Opus (Firefox, older Chrome). */
  LH.recordType = function () {
    var types = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < types.length; i++) { try { if (MediaRecorder.isTypeSupported(types[i])) return types[i]; } catch (e) {} }
    return '';
  };
  function clock(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function pageName(p) {
    if (p.kind === 'cover') return 'The cover';
    if (p.kind === 'dedication') return 'The dedication page';
    if (p.kind === 'end') return 'The End';
    if (p.kind === 'goodnight') return 'The Goodnight page';
    return 'Page ' + (p.i + 1);
  }
  function micError(err) {
    var n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'The browser didn’t allow the microphone. Allow it for this site (the icon next to the address) and press Record again.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No microphone was found. Plug one in, or use a phone or laptop with a microphone.';
    if (n === 'NotReadableError') return 'Another app is using the microphone. Close it and press Record again.';
    return 'The microphone couldn’t start. Please try again.';
  }

  /* ------------------------------------------------------------------ the reader */
  /* Story-time music: gentle tracks streamed by ArkMusic (web/pages/_arkmusic.html). Off until someone presses
     Music in the reader (remembered in this browser); it dips while "Read to me" reads. */
  UI.ICONS.music = UI.ICONS.music || '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>';
  LH.MUSIC = ['small-and-grand-wonder', 'toulouse', 'bright-road'];
  LH.music = {
    on: function () { return !!window.ArkMusic && !!UI.store.get('music', false); },
    set: function (v) { UI.store.set('music', !!v); if (v) LH.music.play(); else LH.music.stop(); },
    level: function () { return UI.store.get('bedtime', false) === true ? 0.15 : 0.35; },  // quieter at bedtime
    play: function () { if (window.ArkMusic) ArkMusic.play(LH.MUSIC, { volume: LH.music.level(), fade: 2 }); },
    stop: function () { if (window.ArkMusic) ArkMusic.stop(1.2); },
    duck: function (v) { if (window.ArkMusic) ArkMusic.duck(v ? 0.4 : 1, v ? 0.3 : 1); }
  };
  /* opts: start, colour (false hides Colour me in), onFinish(), onPage(i, page),
     record (true: the "Record my voice" button, for the book's owner), onVoiceSave(page, blob, seconds) and
     onVoiceDelete(page or -1 for all) -> JSON {ok, voice, error} (or null when cancelled), voiceBase.
     Painted pictures (book.paint) show instead of the drawings while the "Painted" switch is on (remembered).
     "Full screen" fills the screen with the book (the browser's full screen, or the whole window where there is none,
     as on iPhones); "Exit full screen" (top right), the same toolbar button or Esc leave it.
     "Bedtime" (remembered as UI.store "bedtime") dims every page, reads slower, skips the confetti and ends on a
     Goodnight page; after 18:30 a one-time chip offers it. "Just listen" (in Bedtime) reads to the end on an almost
     black screen with a small moon, "page 4 of 12" and Stop (or Esc), then goes dark and releases the wake lock. */
  var SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  LH.reader = function (el, book, opts) {
    opts = opts || {};
    var night = UI.store.get('bedtime', false) === true, listening = false, darkEl = null;
    var pages = [], at = 0, seen = {}, reading = false, finished = false;
    function buildPages() { pages = LH.bookPages(book); if (night) pages.push({ kind: 'goodnight' }); }
    buildPages();
    at = Math.min(opts.start || 0, pages.length - 1);
    var colouring = false, crayon = LH.CRAYONS[0], painted = {};
    var voice = {}, recMode = false, rec = null, stream = null, recState = {}, audio = null, playing = null, playSrc = '', playId = 0, unlocked = false, recFocus = false, alive = true;
    var full = false, wake = null;
    setVoice(book.voice || {});
    var canRec = !!opts.record && LH.canRecord() && !!opts.onVoiceSave;
    var paintOn = UI.store.get('painted', true) !== false;
    var canSpeak = 'speechSynthesis' in window;
    el.innerHTML = '<div class="rd' + (night ? ' rd-night' : '') + '"><button type="button" class="rd-exit" data-rd="full" hidden>' + UI.icon('shrink') + '<span>Exit full screen</span></button>' +
      '<div data-rd-ask></div><div data-rd-crayons></div><div data-rd-rec></div><div class="rd-stage"><button class="rd-nav prev" data-rd="prev" aria-label="Previous page">' + UI.icon('back') + '</button>' +
      '<div class="rd-book" data-rd-book></div><button class="rd-nav next" data-rd="next" aria-label="Next page">' + UI.icon('arrow') + '</button></div>' +
      '<div class="rd-bar"><div class="rd-dots" data-rd-dots></div><div class="rd-tools">' +
      (canSpeak || canRec || Object.keys(voice).length ? '<button class="ui-btn sm" data-rd="speak">' + UI.icon('chat') + '<span>Read to me</span></button>' : '') +
      (canRec ? '<button class="ui-btn sm" data-rd="rec" aria-pressed="false">' + UI.icon('mic') + '<span>Record my voice</span></button>' : '') +
      '<button class="ui-btn sm' + (night ? ' on' : '') + '" data-rd="night" aria-pressed="' + night + '">' + UI.icon('moon') + '<span>Bedtime</span></button>' +
      ((canSpeak || Object.keys(voice).length) ? '<button class="ui-btn sm" data-rd="listen"' + (night ? '' : ' hidden') + '>' + UI.icon('volume') + '<span>Just listen</span></button>' : '') +
      (window.ArkMusic ? '<button class="ui-btn sm' + (LH.music.on() ? ' on' : '') + '" data-rd="music" aria-pressed="' + LH.music.on() + '">' + UI.icon('music') + '<span>Music</span></button>' : '') +
      '<button class="ui-btn sm' + (paintOn ? ' on' : '') + '" data-rd="paint" aria-pressed="' + paintOn + '"' + (LH.hasPaint(book) ? '' : ' hidden') + '>' + UI.icon('palette') + '<span>Painted</span></button>' +
      (opts.colour === false ? '' : '<button class="ui-btn sm" data-rd="colour">' + UI.icon('brush') + '<span>Colour me in</span></button>') +
      '<button class="ui-btn sm rd-full-btn" data-rd="full" aria-pressed="false">' + UI.icon('expand') + '<span>Full screen</span></button>' +
      (opts.tools || '') + '</div></div></div>';
    var askEl = el.querySelector('[data-rd-ask]');
    var rdEl = el.querySelector('.rd'), bookEl = el.querySelector('[data-rd-book]'), dots = el.querySelector('[data-rd-dots]'), crayEl = el.querySelector('[data-rd-crayons]'), recEl = el.querySelector('[data-rd-rec]');
    function show(html) { bookEl.innerHTML = html; LH.media.fill(bookEl); }
    function drawCrayons() {
      crayEl.innerHTML = colouring ? '<div class="rd-crayons"><div class="hint">Pick a crayon, then tap the picture</div>' + LH.CRAYONS.map(function (c) {
        return '<button type="button" data-crayon="' + c + '" style="--cr:' + c + '" class="' + (c === crayon ? 'on' : '') + '" aria-label="Crayon ' + c + '"></button>';
      }).join('') + '<button type="button" data-crayon="#FFFFFF" style="--cr:#fff" class="' + (crayon === '#FFFFFF' ? 'on' : '') + '" aria-label="Rubber" title="Rubber">' + UI.icon('x') + '</button></div>' : '';
    }
    function drawDots() {
      dots.innerHTML = pages.map(function (p, i) {
        return '<button data-rd-go="' + i + '" class="' + (i === at ? 'on' : seen[i] ? 'seen' : '') + (voice[i] ? ' vo' : '') + '" aria-label="Page ' + (i + 1) + (voice[i] ? ', recorded' : '') + '"' + (i === at ? ' aria-current="page"' : '') + '></button>';
      }).join('');
    }
    function pageHtml() { return LH.pageHtml(book, pages[at], at, pages.length, { outline: colouring, painted: paintOn }); }
    function preload() {  // the next painted picture into memory, so turning the page doesn't flash
      if (!paintOn || at + 1 >= pages.length) return;
      var src = LH.paintSrc(book, LH.paintIndex(book, pages[at + 1]));
      if (src && !LH.media.has(src)) LH.media.load(src).catch(function () {});
    }
    function draw(dir) {
      seen[at] = true;
      bookEl.classList.toggle('out', colouring);
      show('<div class="rd-page' + (dir < 0 ? ' back' : '') + '">' + pageHtml() + '</div>');
      preload();
      if (colouring && painted[at]) {
        var list = bookEl.querySelectorAll(SHAPES);
        Object.keys(painted[at]).forEach(function (i) { var p = painted[at][i]; if (list[i]) list[i].setAttribute(p[0], p[1]); });
      }
      el.querySelector('[data-rd=prev]').disabled = at === 0;
      el.querySelector('[data-rd=next]').disabled = at === pages.length - 1;
      drawDots();
      drawRec();
      drawDark();
      var kind = pages[at].kind;
      if ((kind === 'end' || kind === 'goodnight') && !finished) { finished = true; if (!night) LH.confetti(); if (opts.onFinish) opts.onFinish(); }
      if (opts.onPage) opts.onPage(at, pages[at]);
      if (reading) speak();
    }
    function go(n) {
      var to = Math.max(0, Math.min(pages.length - 1, n));
      if (to === at) return;
      if (rec) recStop();  // turning the page finishes (and saves) the recording of the page being read
      stopAudio();
      var dir = to > at ? 1 : -1;
      at = to;
      draw(dir);
    }

    /* ---- reading aloud: the recorded voice where there is one, the speech voice elsewhere */
    function speak() {
      var mine = at;
      stopAudio();
      try { speechSynthesis.cancel(); } catch (e) {}
      LH.music.duck(true);
      var next = function () { if (reading && mine === at) { if (at < pages.length - 1) setTimeout(function () { if (reading && mine === at) go(at + 1); }, night ? 1800 : 900); else listenEnd(); } };
      if (voice[at]) playVoice(at, next, function () { if (reading && mine === at) synth(mine, next); });
      else synth(at, next);
      if (voice[at + 1] && !LH.media.has(voiceSrc(at + 1))) LH.media.load(voiceSrc(at + 1)).catch(function () {});  // the next page's voice, ready
    }
    function synth(p, next) {
      if (!canSpeak) { setTimeout(next, 1500); return; }
      try {
        var u = new SpeechSynthesisUtterance(LH.pageSpeech(book, pages[p]));
        u.rate = night ? .8 : .9; u.pitch = night ? 1 : 1.08;  // slower and calmer at bedtime
        LH.lastUtterance = { rate: u.rate, pitch: u.pitch, text: u.text };  // for the UI tests
        u.onend = next;
        speechSynthesis.speak(u);
      } catch (e) { stopSpeak(); }
    }
    function stopSpeak() {
      reading = false;
      try { speechSynthesis.cancel(); } catch (e) {}
      stopAudio();
      LH.music.duck(false);
      var b = el.querySelector('[data-rd=speak]');
      if (b) { b.classList.remove('on'); b.querySelector('span').textContent = 'Read to me'; }
      if (listening) closeDark();
    }

    /* ---- Bedtime: dim pages, slower reading, no confetti, quieter music, a Goodnight page at the end */
    function setNight(on) {
      on = !!on;
      UI.store.set('bedtime', on);
      if (on === night) { drawAsk(); return; }
      night = on;
      var kind = pages[at] && pages[at].kind;
      buildPages();
      if (at > pages.length - 1 || (!on && kind === 'goodnight')) at = pages.length - 1;
      rdEl.classList.toggle('rd-night', night);
      var b = el.querySelector('[data-rd=night]');
      if (b) { b.classList.toggle('on', night); b.setAttribute('aria-pressed', String(night)); }
      var lb = el.querySelector('[data-rd=listen]');
      if (lb) lb.hidden = !night;
      if (window.ArkMusic) ArkMusic.volume(LH.music.level());
      drawAsk();
      draw(1);
    }
    /* After 18:30 (or before 5 in the morning) a one-time chip offers Bedtime, until someone picks either way. */
    function drawAsk() {
      var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
      var ask = UI.store.get('bedtime', null) === null && (h >= 18.5 || h < 5) && !opts.noAsk;
      askEl.innerHTML = ask ? '<div class="rd-ask" role="group" aria-label="Bedtime reading">' + UI.icon('moon') + '<span>Bedtime? Dim the pages for a calm story.</span>' +
        '<button type="button" class="ui-btn sm primary" data-rd="night-yes">Dim the pages</button><button type="button" class="ui-btn sm ghost" data-rd="night-no">Not tonight</button></div>' : '';
    }
    /* ---- Just listen: reads to the end on an almost black screen; then dark, and the screen may sleep */
    function drawDark() {
      if (!darkEl) return;
      var n = darkEl.querySelector('[data-dark-page]');
      if (n) n.textContent = (pages[at].kind === 'goodnight' ? 'Goodnight' : 'Page ' + (at + 1) + ' of ' + pages.length);
    }
    function listen() {
      if (recMode) setRec(false);
      if (colouring) setColour(false);
      if (!night) setNight(true);
      if (at >= pages.length - 2) go(0);  // at the end: start again from the cover
      darkEl = document.createElement('div');
      darkEl.className = 'rd-dark';
      darkEl.setAttribute('role', 'dialog');
      darkEl.setAttribute('aria-label', 'Just listen');
      darkEl.innerHTML = '<div class="rd-dark-in"><svg class="rd-dark-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>' +
        '<p class="rd-dark-page" data-dark-page aria-live="polite"></p><button type="button" class="rd-dark-stop" data-rd="listen-stop">' + UI.icon('stop') + '<span>Stop</span></button>' +
        '<p class="rd-dark-bye">Sweet dreams. Tap to wake the screen.</p></div>';
      rdEl.appendChild(darkEl);
      listening = true;
      keepAwake(true);
      drawDark();
      unlockAudio();
      reading = true;
      var sb = el.querySelector('[data-rd=speak]');
      if (sb) { sb.classList.add('on'); sb.querySelector('span').textContent = 'Stop reading'; }
      speak();
      var st = darkEl.querySelector('.rd-dark-stop');
      if (st) st.focus();
    }
    function listenEnd() {  // the last page has been read
      if (!listening) { stopSpeak(); return; }
      listening = false;
      reading = false;
      LH.music.duck(false);
      var sb = el.querySelector('[data-rd=speak]');
      if (sb) { sb.classList.remove('on'); sb.querySelector('span').textContent = 'Read to me'; }
      if (darkEl) darkEl.classList.add('rd-dark-end');
      if (window.ArkMusic) ArkMusic.stop(4);
      keepAwake(full);  // the screen may sleep now
    }
    function closeDark() {
      var was = darkEl;
      listening = false;
      darkEl = null;
      if (was) was.remove();
      keepAwake(full);
      if (reading) stopSpeak();
      var lb = el.querySelector('[data-rd=listen]');
      if (lb && rdEl.contains(document.activeElement) === false) lb.focus();
    }
    function voiceSrc(p) { return (opts.voiceBase || '') + voice[p].key; }
    /* Called straight from a tap: Safari only lets an audio element play later (after a download) once it has
       started playing inside a tap, so a silent sound starts it here. */
    function unlockAudio() {
      if (!audio) { audio = new Audio(); audio.preload = 'auto'; }
      if (unlocked) return;
      unlocked = true;
      try { audio.src = SILENT; var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
    }
    /* Plays a page's recording from memory, downloading it first the first time (or straight from the server if
       keeping it fails). */
    function playVoice(p, onEnd, onFail) {
      stopAudio();
      if (!audio) { audio = new Audio(); audio.preload = 'auto'; }
      var src = voiceSrc(p), mine = playId;
      playing = p; playSrc = src;
      var start = function (u) {
        if (mine !== playId || !alive) return;  // stopped (or another page started) while it downloaded
        audio.onended = function () { playing = null; playSrc = ''; if (recMode) drawRec(); if (onEnd) onEnd(); };
        audio.onerror = function () { playing = null; playSrc = ''; if (onFail) onFail(); };
        audio.src = u;
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function (e) { if (e && e.name === 'AbortError') return; playing = null; playSrc = ''; if (onFail) onFail(); });
      };
      var have = LH.media.url(src);
      if (have) start(have);
      else LH.media.load(src).then(start, function () { start(src); });
    }
    function stopAudio() {
      playId++;
      if (audio) { audio.onended = audio.onerror = null; try { audio.pause(); } catch (e) {} }
      playing = null; playSrc = '';
    }

    /* ---- full screen */
    function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
    function keepAwake(on) {  // the screen stays on while the book fills it (where the browser allows)
      if (on && !wake && navigator.wakeLock) {
        wake = 'asking';
        navigator.wakeLock.request('screen').then(function (w) { if ((full || listening) && alive) wake = w; else { wake = null; w.release(); } }, function () { wake = null; });
      } else if (!on && wake) {
        if (wake.release) try { wake.release(); } catch (e) {}
        wake = null;
      }
    }
    function drawFull() {
      rdEl.classList.toggle('rd-full', full);
      document.documentElement.classList.toggle('rd-full-on', full);
      var exit = el.querySelector('.rd-exit'), b = el.querySelector('.rd-full-btn');
      exit.hidden = !full;
      if (b) { b.setAttribute('aria-pressed', String(full)); b.querySelector('span').textContent = full ? 'Exit full screen' : 'Full screen'; }
      keepAwake(full || listening);
    }
    function setFull(on) {
      if (on === full) return;
      full = on;
      if (on && recMode) setRec(false);  // recording (and its dialogs) stay on the normal page
      drawFull();
      if (on) {
        var req = rdEl.requestFullscreen || rdEl.webkitRequestFullscreen;
        if (req) try { var pr = req.call(rdEl); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}  // refused: the window-filling version stays
        el.querySelector('.rd-exit').focus();
      } else {
        if (fsEl() === rdEl) { var ex = document.exitFullscreen || document.webkitExitFullscreen; try { var r = ex.call(document); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
        var b = el.querySelector('.rd-full-btn');
        if (b && rdEl.contains(document.activeElement)) b.focus();
      }
    }
    function fsChange() { if (full && fsEl() !== rdEl) setFull(false); }  // Esc or the browser's own exit
    document.addEventListener('fullscreenchange', fsChange);
    document.addEventListener('webkitfullscreenchange', fsChange);

    /* ---- recording ("Record my voice", the owner only) */
    function setVoice(v) {
      var next = {};
      Object.keys(v || {}).forEach(function (k) { if (v[k] && v[k].key) next[k] = { key: v[k].key, seconds: +v[k].seconds || 0 }; });
      Object.keys(voice).forEach(function (k) { if (!next[k] || next[k].key !== voice[k].key) LH.media.drop(voiceSrc(k)); });  // deleted or redone
      voice = next;
      book.voice = next;
    }
    function getStream() {
      if (stream && stream.active) return Promise.resolve(stream);
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (s) {
        if (!alive || !recMode) { s.getTracks().forEach(function (t) { t.stop(); }); throw { name: 'Closed' }; }
        stream = s;
        return s;
      });
    }
    function releaseStream() {
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    function recStart() {
      if (rec || pages[at].kind === 'goodnight') return;
      var page = at;
      stopSpeak(); stopAudio();
      recState[page] = { s: 'starting' };
      drawRec();
      getStream().then(function (s) {
        if (!recMode || at !== page || rec) { delete recState[page]; drawRec(); return; }
        var type = LH.recordType(), mr;
        try { mr = new MediaRecorder(s, type ? { mimeType: type, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 }); } catch (e) { mr = new MediaRecorder(s); }
        var r = rec = { mr: mr, page: page, t0: Date.now(), chunks: [], type: mr.mimeType || type || 'audio/webm' };
        mr.ondataavailable = function (e) { if (e.data && e.data.size) r.chunks.push(e.data); };
        mr.onstop = function () { recDone(r); };
        mr.start(1000);
        r.timer = setInterval(function () {
          var secs = (Date.now() - r.t0) / 1000, t = el.querySelector('[data-rec-time]');
          if (t) t.textContent = clock(secs);
          if (secs >= LH.VOICE_MAX) recStop();
        }, 250);
        recState[page] = { s: 'recording' };
        drawRec();
      }, function (err) {
        if (err && err.name === 'Closed') { delete recState[page]; return; }
        recState[page] = { s: 'error', msg: micError(err) };
        drawRec();
      });
    }
    function recStop(discard) {
      var r = rec;
      if (!r) return;
      rec = null;
      clearInterval(r.timer);
      r.secs = (Date.now() - r.t0) / 1000;
      r.discard = !!discard;
      if (!discard) recState[r.page] = { s: 'saving' };
      try { r.mr.stop(); } catch (e) { recDone(r); }
      drawRec();
    }
    function recDone(r) {
      if (r.discard || !alive) return;
      var p = r.page;
      if (r.secs < 0.8 || !r.chunks.length) { recState[p] = { s: 'error', msg: 'That was very short. Press Record, then read the page aloud.' }; drawRec(); return; }
      var blob = new Blob(r.chunks, { type: r.type });
      var fail = function (msg) { recState[p] = { s: 'error', msg: msg || 'The recording couldn’t be saved. Check your connection and try again.' }; drawRec(); };
      Promise.resolve(opts.onVoiceSave(p, blob, Math.round(r.secs * 10) / 10)).then(function (json) {
        var res = JSON.parse(json || 'null');
        if (!res || !res.ok) return fail(res && res.error);
        setVoice(res.voice);
        if (voice[p]) LH.media.put(voiceSrc(p), blob);  // plays back from memory, no download
        recState[p] = { s: 'saved' };
        drawRec(); drawDots();
      }, function () { fail(); });
    }
    function voiceDelete(p) {
      stopAudio();
      Promise.resolve(opts.onVoiceDelete(p)).then(function (json) {
        var res = JSON.parse(json || 'null');
        if (!res) return;  // cancelled
        if (!res.ok) { recState[at] = { s: 'error', msg: res.error }; drawRec(); return; }
        if (p < 0) recState = {}; else delete recState[p];
        setVoice(res.voice);
        recFocus = true;
        drawRec(); drawDots();
      });
    }
    function setRec(on) {
      if (on === recMode) return;
      recMode = on;
      var b = el.querySelector('[data-rd=rec]');
      if (on) {
        if (colouring) setColour(false);
        stopSpeak();
        LH.music.stop();  // never play music while the microphone listens
      } else {
        recStop(); stopAudio(); releaseStream();
        if (LH.music.on()) LH.music.play();
      }
      if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('span').textContent = on ? 'Done recording' : 'Record my voice'; }
      drawRec();
      if (on && recEl.scrollIntoView) recEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function setColour(on) {
      if (on === colouring) return;
      if (on && recMode) setRec(false);
      colouring = on;
      var b = el.querySelector('[data-rd=colour]');
      if (b) { b.classList.toggle('on', colouring); b.querySelector('span').textContent = colouring ? 'Back to colour' : 'Colour me in'; }
      drawCrayons(); draw(1);
    }
    function recBtn(act, icon, label, cls) {
      return '<button type="button" class="ui-btn sm' + (cls ? ' ' + cls : '') + '" data-rec="' + act + '">' + UI.icon(icon) + '<span>' + label + '</span></button>';
    }
    function drawRec() {
      if (!recEl) return;
      if (!recMode) { recEl.innerHTML = ''; return; }
      var had = recFocus || (document.activeElement && recEl.contains(document.activeElement));
      recFocus = false;
      var p = at, name = pageName(pages[p]), st = rec && rec.page === p ? 'recording' : (recState[p] && recState[p].s) || 'idle';
      if (pages[p].kind === 'goodnight') {
        recEl.innerHTML = '<div class="rd-rec" data-state="empty" role="region" aria-label="Record your voice"><div class="rd-rec-say"><span class="rd-rec-dot" aria-hidden="true"></span>' +
          '<span role="status"><b>The Goodnight page</b> only shows in Bedtime reading, so it has no recording.</span></div></div>';
        return;
      }
      if (st === 'saved' || st === 'idle') st = voice[p] ? 'saved' : 'empty';
      var msg, btns = '';
      if (st === 'recording') {
        msg = '<b>Recording ' + esc(name.charAt(0).toLowerCase() + name.slice(1)) + '.</b> Read it aloud, then press Stop.';
        btns = recBtn('stop', 'stop', 'Stop', 'primary') + '<span class="rd-rec-time" data-rec-time aria-hidden="true">' + clock((Date.now() - rec.t0) / 1000) + '</span>';
      } else if (st === 'starting') {
        msg = 'Starting the microphone…';
      } else if (st === 'saving') {
        msg = 'Saving ' + esc(name.charAt(0).toLowerCase() + name.slice(1)) + '…';
      } else if (st === 'saved') {
        msg = '<b>' + esc(name) + '</b>: recorded (' + clock(voice[p].seconds) + ').';
        btns = recBtn('play', playing === p ? 'stop' : 'play', playing === p ? 'Stop playing' : 'Play', playing === p ? 'on' : '') + recBtn('redo', 'redo', 'Redo') +
          recBtn('delete', 'trash', 'Delete', 'ghost danger') + (p < pages.length - 1 ? recBtn('next', 'arrow', 'Next page', 'primary') : '');
      } else {
        msg = st === 'error' ? '<span class="rd-rec-bad">' + esc(recState[p].msg) + '</span>' : '<b>' + esc(name) + '</b>: not recorded yet. Press Record, then read it aloud.';
        btns = recBtn('start', 'mic', 'Record', 'primary') + (voice[p] ? recBtn('play', 'play', 'Play') : '');
      }
      var n = Object.keys(voice).length;
      recEl.innerHTML = '<div class="rd-rec" data-state="' + st + '" role="region" aria-label="Record your voice">' +
        '<div class="rd-rec-say"><span class="rd-rec-dot" aria-hidden="true"></span><span role="status">' + msg + '</span></div>' +
        (btns ? '<div class="rd-rec-btns">' + btns + '</div>' : '') +
        '<p class="rd-rec-note">' + (n ? n + ' of ' + pages.length + ' pages recorded. ' : '') +
        'Recordings are saved with this book, and anyone with its family link can hear them.' +
        (n ? ' <button type="button" class="rd-rec-clear" data-rec="clear">Delete all recordings</button>' : '') + '</p></div>';
      if (had) { var f = recEl.querySelector('.rd-rec-btns button'); if (f) f.focus(); else recFocus = true; }
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
    function onClick(e) {
      var c = e.target.closest('[data-crayon]');
      if (c) { crayon = c.getAttribute('data-crayon'); drawCrayons(); return; }
      if (colouring && e.target.closest('[data-rd-book] svg') && /^(path|circle|ellipse|rect|text)$/i.test(e.target.tagName)) { paint(e.target); return; }
      var rb = e.target.closest('[data-rec]');
      if (rb) {
        var a = rb.getAttribute('data-rec');
        recFocus = true;
        if (a === 'start' || a === 'redo') recStart();
        else if (a === 'stop') recStop();
        else if (a === 'play') {
          if (playing === at) stopAudio();
          else {
            unlockAudio();
            playVoice(at, null, function () { recState[at] = { s: 'error', msg: 'This recording couldn’t be played. Try Redo.' }; drawRec(); });
          }
          drawRec();
        } else if (a === 'delete') voiceDelete(at);
        else if (a === 'clear') voiceDelete(-1);
        else if (a === 'next') go(at + 1);
        return;
      }
      if (darkEl && darkEl.contains(e.target) && (darkEl.classList.contains('rd-dark-end') || e.target.closest('[data-rd=listen-stop]'))) { closeDark(); return; }
      var b = e.target.closest('[data-rd],[data-rd-go]');
      if (!b) return;
      if (b.hasAttribute('data-rd-go')) return go(+b.getAttribute('data-rd-go'));
      var k = b.getAttribute('data-rd');
      if (k === 'prev') go(at - 1);
      else if (k === 'next') go(at + 1);
      else if (k === 'colour') setColour(!colouring);
      else if (k === 'paint') {
        paintOn = !paintOn;
        UI.store.set('painted', paintOn);
        b.classList.toggle('on', paintOn); b.setAttribute('aria-pressed', String(paintOn));
        if (!colouring) { show('<div class="rd-page still">' + pageHtml() + '</div>'); preload(); }
      }
      else if (k === 'rec') setRec(!recMode);
      else if (k === 'full') setFull(!full);
      else if (k === 'night') setNight(!night);
      else if (k === 'night-yes') setNight(true);
      else if (k === 'night-no') { UI.store.set('bedtime', false); drawAsk(); }
      else if (k === 'listen') listen();
      else if (k === 'speak') {
        if (reading) return stopSpeak();
        if (recMode) setRec(false);
        unlockAudio();
        reading = true; b.classList.add('on'); b.querySelector('span').textContent = 'Stop reading'; speak();
      } else if (k === 'music') {
        var mOn = !LH.music.on();
        LH.music.set(mOn); b.classList.toggle('on', mOn); b.setAttribute('aria-pressed', String(mOn));
      }
    }
    el.addEventListener('click', onClick);  // removed in destroy(): a remounted reader reuses the same element
    function key(e) {
      if (e.target.closest && e.target.closest('input, textarea, select') || document.querySelector('.ui-modal-wrap, .anvil-modal-content')) return;
      if (e.key === 'Escape' && darkEl) { closeDark(); return; }
      if (e.key === 'Escape' && full) { setFull(false); return; }
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
    drawAsk();
    if (LH.music.on()) LH.music.play();
    var api = {
      go: go, at: function () { return at; }, get count() { return pages.length; }, colouring: function () { return colouring; },
      recording: function () { return recMode; }, voice: function () { return voice; }, audio: function () { return audio; },
      playing: function () { return playing; }, painted: function () { return paintOn; },
      playingSrc: function () { return playSrc; },  // the server address of the recording playing (it plays from memory)
      full: function () { return full; }, setFull: setFull,
      night: function () { return night; }, setNight: setNight, listening: function () { return listening; }, dark: function () { return !!darkEl; },
      pageKind: function () { return pages[at].kind; },
      /* New painted pictures arrived (the book page checks while the studio works): show them without a page turn. */
      setPaint: function (map) {
        var idx = LH.paintIndex(book, pages[at]), before = LH.paintSrc(book, idx);
        book.paint = map || {};
        var pb = el.querySelector('[data-rd=paint]');
        if (pb) pb.hidden = !LH.hasPaint(book);
        if (!colouring && paintOn && LH.paintSrc(book, idx) !== before) show('<div class="rd-page still">' + pageHtml() + '</div>');
        preload();
      },
      destroy: function () {
        alive = false;
        if (darkEl) { darkEl.remove(); darkEl = null; listening = false; }
        document.removeEventListener('keydown', key);
        el.removeEventListener('click', onClick);
        setFull(false);
        document.removeEventListener('fullscreenchange', fsChange);
        document.removeEventListener('webkitfullscreenchange', fsChange);
        recStop(true); stopSpeak(); releaseStream();  // kept pictures and recordings stay in LH.media for the visit
        LH.music.stop();
      }
    };
    el.lhReader = api;  // for the UI tests
    return api;
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
  function urlImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('A painted picture could not be loaded.')); };
      img.src = src;
    });
  }
  /* A painted picture for a canvas: the copy kept for the visit (downloaded once), else straight from the server. */
  function keptImage(src) { return LH.media.load(src).then(urlImage, function () { return urlImage(src); }); }
  /* The painted picture of a page when the PDF asks for them (opts.painted, not the colouring book), else the
     drawing (also when a painted picture fails to load). Resolves {img, painted}. */
  function pictureOf(book, p, opts, drawn) {
    var plain = function () { return drawn().then(function (img) { return { img: img, painted: false }; }); };
    var src = opts.painted && !opts.outline ? LH.paintSrc(book, LH.paintIndex(book, p)) : '';
    return src ? keptImage(src).then(function (img) { return { img: img, painted: true }; }, plain) : plain();
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
    var paras = String(text).split('\n').map(function (para) {
      return para.split(/\s+/).filter(Boolean).map(function (t) { return { t: t, hi: !!(name && t.indexOf(name) >= 0) }; });
    });
    for (; size > 24; size -= 2) {  // each line of a verse page starts a new line (lines too long for the box wrap)
      ctx.font = fontOf(weight, size, font);
      lines = [];
      paras.forEach(function (wds) { lines = lines.concat(wrap(ctx, wds, box.w)); });
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
      return pictureOf(book, p, opts, function () { return svgImage(LH.sceneSvg(st, 'cover', hero, sceneOpts(1340))); }).then(function (pic) { restore();
        framed(ctx, pic.img, 80, 80, 1340, 938, 64);
        card(ctx, 80, 1090, 1340, 320, 56);
        textBlock(ctx, LH.title(st, hero), null, { x: 130, y: 1106, w: 1240, h: 214 }, { font: 'Baloo 2', weight: 800, size: 104, lh: 1.02, outlined: OUT });
        spaced(ctx, OUT ? 'A Little Hero colouring book' : 'A Little Hero Book', 750, 1372, 34, '#D9532E');
        return c;
      });
    }
    if (p.kind === 'dedication') {
      paper(ctx);
      return pictureOf(book, p, opts, function () { return svgImage(sized(avatar({ crop: 'head', mood: 'laugh', bg: '#FFC93C' }), 640, 640)); }).then(function (pic) { restore();
        var img = pic.img;
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
      return pictureOf(book, p, opts, function () { return svgImage(sized(avatar({ pose: 'wave', mood: 'laugh' }), 520, 565)); }).then(function (pic) { restore();
        if (pic.painted) framed(ctx, pic.img, 470, 110, 560, 560, 48);  // a painted End picture is a square, framed
        else ctx.drawImage(pic.img, 490, 120, 520, 565);
        bigText(ctx, 'The End', 750, 900, '800 170px "Baloo 2", Arial, sans-serif', '#EF5A36');
        textBlock(ctx, st.source, null, { x: 220, y: 980, w: 1060, h: 200 }, { size: 40, weight: 400, color: OUT ? INK : '#6D6490' });
        textBlock(ctx, LH.madeLine(book), null, { x: 220, y: 1190, w: 1060, h: 120 }, { size: 38, weight: 500, color: OUT ? INK : '#6D6490' });
        return c;
      });
    }
    paper(ctx);
    var verse = (st.text[p.i] || '').indexOf('\n') >= 0;  // eight lines of a poem: a smaller picture, more room for the words
    return pictureOf(book, p, opts, function () { return svgImage(LH.sceneSvg(st, p.i, hero, sceneOpts(1340))); }).then(function (pic) { restore();
      if (verse) {
        framed(ctx, pic.img, 290, 66, 920, 644, 56);
        textBlock(ctx, LH.fill(st.text[p.i], hero), hero ? name : null, { x: 110, y: 760, w: 1280, h: 620 }, { size: 50, lh: 1.3 });
      } else {
        framed(ctx, pic.img, 80, 70, 1340, 938, 64);
        textBlock(ctx, LH.fill(st.text[p.i], hero), hero ? name : null, { x: 110, y: 1050, w: 1280, h: 330 }, { size: 56 });
      }
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

  /* One page's picture as a PNG Blob for the painting studio (about one megapixel, no text: the words stay crisp
     on the page). Scenes are 10 x 7, the dedication portrait is square on its yellow, the waving hero of The End
     stands on a square of warm paper. No paper grain: the painter adds its own texture. */
  /* The page's drawing on a canvas. skinMarker: draw the hero's skin in that colour instead (for the skin check: the
     pixels that differ from the normal drawing are exactly the hero's skin). The colour table is swapped only while
     the SVG text is built, like the engine's own "ghost" outline. */
  function pageCanvas(book, idx, skinMarker) {
    var st = book.story, hero = book.hero, n = st.text.length, w, h, svg, fig = null;
    var withSize = function (s, sw, sh) { return s.replace('<svg ', '<svg width="' + Math.round(sw) + '" height="' + Math.round(sh) + '" '); };
    var key = skinMarker && hero && hero.look ? LH.normal(hero.look).skin : null, saved = key ? LH.COL.skin[key] : null;
    if (key) LH.COL.skin[key] = skinMarker;
    try {
      if (idx === 0 || (idx >= 2 && idx < n + 2)) {
        w = 1216; h = 851;
        svg = LH.sceneSvg(st, idx === 0 ? 'cover' : idx - 2, hero, { w: w, clip: LH.uid('pp'), outline: false, grain: false });
      } else if (idx === 1) {
        w = h = 1024;
        svg = withSize(portrait(hero, { crop: 'head', mood: 'laugh', bg: '#FFC93C' }), w, h);
      } else if (idx === n + 2) {
        w = h = 1024; fig = { w: 760, h: 826 };
        svg = withSize(portrait(hero, { pose: 'wave', mood: 'laugh' }), fig.w, fig.h);
      } else {
        return Promise.reject(new Error('That page has no picture.'));
      }
    } finally {
      if (key) LH.COL.skin[key] = saved;
    }
    return svgImage(svg).then(function (img) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = fig ? '#FFF4DC' : '#FFFFFF'; ctx.fillRect(0, 0, w, h);
      if (fig) ctx.drawImage(img, (w - fig.w) / 2, h - fig.h - 40, fig.w, fig.h);
      else ctx.drawImage(img, 0, 0, w, h);
      return c;
    });
  }
  LH.paintPicture = function (book, idx, skinMarker) {  // skinMarker: tests only (a page with the skin recoloured)
    return pageCanvas(book, idx, skinMarker).then(function (c) {
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('The picture could not be made.')); }, 'image/png');
      });
    });
  };

  /* Skin check: does the painted child keep the drawn skin colour? Compares the lightness (CIE L*, 0-100) of the hero's
     skin pixels in the painting with the drawing, minus how much the whole picture got lighter or darker (3D, clay
     and fairy-tale lighting darken everything). Correct paintings stay within about +-16; a fair child painted dark
     (or the reverse) moves 40 or more. Resolves JSON {skipped} or {drawn, painted, picture, relative, pixels};
     the server decides (Painting.SKIN_TOLERANCE). */
  function lstar(r, g, b) {
    var f = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    var y = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
  }
  function trimmedMean(xs) {
    xs.sort(function (a, b) { return a - b; });
    var lo = Math.floor(xs.length * 0.2), hi = Math.ceil(xs.length * 0.8), s = 0;
    for (var i = lo; i < hi; i++) s += xs[i];
    return s / Math.max(1, hi - lo);
  }
  LH.skinCheck = function (book, idx, src) {
    if (!book.hero || !book.hero.look) return Promise.resolve(JSON.stringify({ skipped: 'no hero' }));
    return Promise.all([pageCanvas(book, idx), pageCanvas(book, idx, '#00FF00'), keptImage(src)]).then(function (r) {
      var a = r[0], w = a.width, h = a.height, pc = document.createElement('canvas');
      pc.width = w; pc.height = h; pc.getContext('2d').drawImage(r[2], 0, 0, w, h);
      var A = a.getContext('2d').getImageData(0, 0, w, h).data, B = r[1].getContext('2d').getImageData(0, 0, w, h).data,
        P = pc.getContext('2d').getImageData(0, 0, w, h).data;
      var skinD = [], skinP = [], restD = [], restP = [];
      for (var y = 0; y < h; y += 2) {
        for (var x = 0; x < w; x += 2) {
          var i = (y * w + x) * 4, diff = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
          if (diff > 90) { skinD.push(lstar(A[i], A[i + 1], A[i + 2])); skinP.push(lstar(P[i], P[i + 1], P[i + 2])); }
          else if (diff === 0 && (x % 6 === 0) && (y % 6 === 0)) { restD.push(lstar(A[i], A[i + 1], A[i + 2])); restP.push(lstar(P[i], P[i + 1], P[i + 2])); }
        }
      }
      if (skinD.length < 300) return JSON.stringify({ skipped: 'hero too small on this page', pixels: skinD.length });
      var d = trimmedMean(skinD), p = trimmedMean(skinP), pic = trimmedMean(restP) - trimmedMean(restD);
      var round = function (v) { return Math.round(v * 10) / 10; };
      return JSON.stringify({ drawn: round(d), painted: round(p), picture: round(pic), relative: round(p - d - pic), pixels: skinD.length });
    });
  };

  /* ------------------------------------------------------------------ Gift it (2026-11-20)
     A family link wrapped as a present. gift = {wrap, sender, open_on ('YYYY-MM-DD' or null = any time), opened}.
     The lock uses the viewer's own date (LH.today, or window.LH_TODAY in tests): it keeps a surprise, it isn't security.
     LH.giftHtml(hero, gift, state, story) draws the present (states: locked, ready, unwrapping, open; the Python
     Components/GiftBox switches them and plays the unwrap); LH.giftCard(book, gift, url) -> PNG Blob of the 5 x 7 in
     printable card with a QR code (qrcode-generator, theme/assets/lh-qr.js, loaded the first time a card is made). */
  LH.GIFT_WRAPS = {
    christmas: { bg: '#D8433A', rib: '#FFD25E', label: 'Christmas' },
    birthday: { bg: '#4EA8F5', rib: '#FF8FB8', label: 'Birthday' },
    stars: { bg: '#2E2A63', rib: '#E6E1F5', label: 'Starry night' },
    crayons: { bg: '#FFF3D6', rib: '#EF5A36', label: 'Crayons' }
  };
  function two(n) { return ('0' + n).slice(-2); }
  LH.today = function () {
    if (window.LH_TODAY) return window.LH_TODAY;
    var d = new Date();
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  };
  /* Sleeps (nights) until the day it opens: 0 = today or any time. */
  LH.giftSleeps = function (openOn) {
    if (!openOn) return 0;
    var a = LH.today().split('-'), b = String(openOn).split('-');
    return Math.max(0, Math.round((Date.UTC(+b[0], b[1] - 1, +b[2]) - Date.UTC(+a[0], a[1] - 1, +a[2])) / 86400000));
  };
  LH.giftDay = function (openOn, long) {
    if (!openOn) return '';
    var b = String(openOn).split('-'), d = new Date(+b[0], b[1] - 1, +b[2]);
    return d.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
  };
  function starPath(cx, cy, r) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .45 : r;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return d + 'Z';
  }
  /* The wrapping paper as an SVG <pattern> (id given). */
  function paperPattern(id, wrap, k) {
    k = k || 1;
    var w = LH.GIFT_WRAPS[wrap] || LH.GIFT_WRAPS.christmas, m = '', size = 60;
    if (wrap === 'birthday') {
      size = 50;
      m = '<rect x="6" y="8" width="10" height="5" rx="2" fill="#FFD25E" transform="rotate(30 11 10)"/><circle cx="34" cy="14" r="4" fill="#FFFFFF"/>' +
        '<rect x="28" y="34" width="10" height="5" rx="2" fill="#FF8FB8" transform="rotate(-25 33 36)"/><circle cx="12" cy="38" r="3.5" fill="#3DBE8B"/>';
    } else if (wrap === 'stars') {
      size = 56;
      m = '<path d="' + starPath(14, 14, 7) + '" fill="#FFD25E"/><path d="' + starPath(42, 40, 5) + '" fill="#FFE9A8"/><circle cx="40" cy="12" r="1.8" fill="#FFFFFF"/><circle cx="12" cy="44" r="1.5" fill="#FFFFFF"/>';
    } else if (wrap === 'crayons') {
      size = 80;
      m = '<path d="M6 16 l10 -8 l10 8 l10 -8 l10 8" fill="none" stroke="#EF5A36" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M34 46 q8 -10 16 0 t16 0" fill="none" stroke="#4EA8F5" stroke-width="3.5" stroke-linecap="round"/><circle cx="16" cy="48" r="5" fill="none" stroke="#3DBE8B" stroke-width="3.5"/>';
    } else {
      m = '<path d="M15 7 v16 M8 11 l14 8 M22 11 l-14 8" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>' +
        '<ellipse cx="41" cy="44" rx="8" ry="4" fill="#3E9E5E" transform="rotate(-30 41 44)"/><ellipse cx="52" cy="44" rx="8" ry="4" fill="#3E9E5E" transform="rotate(30 52 44)"/><circle cx="46" cy="47" r="3.5" fill="#FFD25E"/>';
    }
    return '<pattern id="' + id + '" width="' + size * k + '" height="' + size * k + '" patternUnits="userSpaceOnUse"><rect width="' + size * k + '" height="' + size * k + '" fill="' + w.bg + '"/>' +
      '<g transform="scale(' + k + ')">' + m + '</g></pattern>';
  }
  /* The present: lid, two halves of the box (they fall away when it is unwrapped), the bow and the "To <name>" tag. */
  LH.giftSvg = function (hero, gift, o) {
    o = o || {};
    var wrap = (gift && gift.wrap) || 'christmas', w = LH.GIFT_WRAPS[wrap] || LH.GIFT_WRAPS.christmas, id = LH.uid('gp'), fill = 'url(#' + id + ')', rib = w.rib;
    var name = (hero && hero.name) || 'You', fs = Math.max(18, Math.min(34, Math.floor(230 / Math.max(3, name.length + 1))));
    var face = hero && hero.look ? LH.avatarSvg(hero.look, { crop: 'head', mood: 'laugh' }).replace(' class="lh-av"', '').replace('<svg ', '<svg x="244" y="50" width="62" height="62" ') : '';
    var ln = 'stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"';
    return '<svg class="gf-svg" viewBox="0 0 400 430" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' + paperPattern(id, wrap) + '</defs>' +
      '<ellipse cx="200" cy="404" rx="150" ry="14" fill="rgba(43,35,80,.18)"/>' +
      '<g class="gf-left"><rect x="70" y="204" width="130" height="194" rx="10" fill="' + fill + '" ' + ln + '/><rect x="182" y="204" width="18" height="194" fill="' + rib + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<rect x="70" y="288" width="130" height="32" fill="' + rib + '" stroke="' + INK + '" stroke-width="3"/></g>' +
      '<g class="gf-right"><rect x="200" y="204" width="130" height="194" rx="10" fill="' + fill + '" ' + ln + '/><rect x="200" y="204" width="18" height="194" fill="' + rib + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<rect x="200" y="288" width="130" height="32" fill="' + rib + '" stroke="' + INK + '" stroke-width="3"/></g>' +
      '<g class="gf-lid"><rect x="52" y="160" width="296" height="60" rx="12" fill="' + fill + '" ' + ln + '/><rect x="181" y="160" width="38" height="60" fill="' + rib + '" stroke="' + INK + '" stroke-width="3"/></g>' +
      '<g class="gf-bow"><path d="M200 160 C160 112 118 118 128 146 C136 168 176 166 200 160Z" fill="' + rib + '" ' + ln + '/><path d="M200 160 C240 112 282 118 272 146 C264 168 224 166 200 160Z" fill="' + rib + '" ' + ln + '/>' +
      '<path d="M192 166 L170 206 L184 204 L190 216 L200 170Z M208 166 L230 206 L216 204 L210 216 L200 170Z" fill="' + rib + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><circle cx="200" cy="158" r="15" fill="' + rib + '" ' + ln + '/></g>' +
      (o.tag === false ? '' : '<g class="gf-tag"><path d="M212 150 C240 120 246 96 256 70" fill="none" stroke="' + INK + '" stroke-width="3"/>' +
      '<g transform="rotate(-8 310 92)"><rect x="236" y="40" width="148" height="112" rx="16" fill="#FFFAF0" ' + ln + '/><circle cx="252" cy="56" r="5" fill="none" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="275" cy="81" r="31" fill="#FFC93C" stroke="' + INK + '" stroke-width="3"/>' + face +
      '<text x="346" y="74" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="600" font-size="20" fill="#6D6490">To</text>' +
      '<text x="310" y="138" text-anchor="middle" font-family="\'Baloo 2\', Nunito, sans-serif" font-weight="800" font-size="' + fs + '" fill="#D9532E">' + esc(name) + '</text></g></g>') +
      '</svg>';
  };
  LH.giftHtml = function (hero, gift, state, story) {
    var wrap = (gift && gift.wrap) || 'christmas';
    return '<div class="gf gf-' + esc(wrap) + '" data-state="' + esc(state || 'locked') + '"><div class="gf-stage">' +
      (story ? '<div class="gf-book">' + LH.coverHtml(story, hero) + '</div>' : '') +
      '<button type="button" class="gf-hit" aria-label="' + esc(state === 'ready' ? 'Tap the bow to unwrap the present' : 'The wrapped present') + '">' + LH.giftSvg(hero, gift) + '</button></div></div>';
  };

  /* ---- the printable gift card: 5 x 7 in at 300 dpi, with a QR code that opens the family link */
  var qrLoading = null;
  LH.qrReady = function () {
    if (window.qrcode) return Promise.resolve(true);
    if (qrLoading) return qrLoading;
    return (qrLoading = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = '_/theme/lh-qr.js';
      sc.onload = function () { resolve(true); };
      sc.onerror = function () { qrLoading = null; reject(new Error('The QR code maker could not load. Check your connection and try again.')); };
      document.head.appendChild(sc);
    }));
  };
  function qrMatrix(text) {
    var q = window.qrcode(0, 'M');
    if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs['UTF-8']) window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
    q.addData(String(text));
    q.make();
    return q;
  }
  function fitText(ctx, s, x, y, maxW, size, weight, font, colour) {
    for (; size > 20; size -= 2) { ctx.font = fontOf(weight, size, font); if (ctx.measureText(s).width <= maxW) break; }
    ctx.fillStyle = colour; ctx.textAlign = 'center'; ctx.fillText(s, x, y); ctx.textAlign = 'left';
  }
  LH.giftCard = function (book, gift, url) {
    var W = 1500, H = 2100, hero = book.hero || LH.GENERIC, st = book.story, wrap = (gift && gift.wrap) || 'christmas';
    var fonts = document.fonts && document.fonts.load ? Promise.all(['800 60px "Baloo 2"', '500 50px Fredoka', '600 50px Fredoka', '800 40px Nunito', '700 40px Nunito'].map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve();
    var paperSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs>' + paperPattern('cardp', wrap, 2.4) + '</defs><rect width="' + W + '" height="' + H + '" fill="url(#cardp)"/></svg>';
    return Promise.all([fonts, LH.qrReady(), svgImage(paperSvg), svgImage(LH.sceneSvg(st, 'cover', book.hero, { w: 1100, clip: 'gcard', grain: true })),
      svgImage(LH.giftSvg(book.hero, gift, { tag: false }).replace('<svg ', '<svg width="200" height="215" '))]).then(function (r) {
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      OUT = false; PRINT = false; K = 1;
      ctx.drawImage(r[2], 0, 0);
      ctx.save(); shadow(ctx, 40, 14, .35); ctx.fillStyle = '#FFFAF0'; rrect(ctx, 80, 80, W - 160, H - 160, 60); ctx.fill(); ctx.restore();
      framed(ctx, r[3], 200, 170, 1100, 770, 48);
      ctx.drawImage(r[4], 1130, 820, 200, 215);  // a little present on the corner of the picture
      ctx.textBaseline = 'alphabetic';
      fitText(ctx, 'A book starring ' + hero.name, W / 2, 1070, 1180, 96, 800, 'Baloo 2', SOFT);
      fitText(ctx, LH.title(st, book.hero), W / 2, 1145, 1180, 50, 500, 'Fredoka', '#6D6490');
      fitText(ctx, 'From ' + ((gift && gift.sender) || 'your family') + ', with love', W / 2, 1250, 1180, 66, 600, 'Fredoka', '#D9532E');
      fitText(ctx, gift && gift.open_on ? 'Open on ' + LH.giftDay(gift.open_on, true) : 'Open it any time', W / 2, 1328, 1180, 46, 800, 'Nunito', SOFT);
      var q = qrMatrix(url), n = q.getModuleCount(), cell = Math.floor(400 / (n + 2)), size = cell * (n + 2), x0 = (W - size) / 2, y0 = 1390;
      ctx.save(); shadow(ctx, 24, 8, .2); ctx.fillStyle = '#FFFFFF'; rrect(ctx, x0 - 22, y0 - 22, size + 44, size + 44, 30); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#1E1A33';
      for (var row = 0; row < n; row++) for (var col = 0; col < n; col++) if (q.isDark(row, col)) ctx.fillRect(x0 + (col + 1) * cell, y0 + (row + 1) * cell, cell, cell);
      fitText(ctx, 'Scan to unwrap the book', W / 2, y0 + size + 100, 1180, 48, 600, 'Fredoka', SOFT);
      fitText(ctx, 'Little Hero Books', W / 2, y0 + size + 166, 1180, 36, 700, 'Nunito', '#6D6490');
      LH.lastQrText = String(url);
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { if (b) { window.LH_LAST_CARD = b; resolve(b); } else reject(new Error('The card could not be made.')); }, 'image/png');
      });
    });
  };

  /* Phones (a finger-first screen that can share files): the share sheet with the picture, so it goes straight to
     WhatsApp, Messages or Photos. Elsewhere it downloads. Resolves 'shared', 'cancelled' or 'saved'. */
  LH.shareOrSave = function (blob, name, title) {
    try {
      var file = new File([blob], name, { type: blob.type || 'image/png' });
      var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      if (coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: title }).then(function () { return 'shared'; }, function () { return 'cancelled'; });
      }
    } catch (e) {}
    LH.saveBlob(blob, name);
    return Promise.resolve('saved');
  };
  LH.shareLink = function (url, title, text) {
    if (!navigator.share) return Promise.resolve('none');
    return navigator.share({ url: url, title: title, text: text }).then(function () { return 'shared'; }, function () { return 'cancelled'; });
  };

  LH.DPI = DPI;
  /* Download a Blob under a file name; returns its object URL (kept for a minute, so "Open it" works). */
  LH.saveBlob = function (blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    window.LH_LAST_PDF = blob;
    return url;
  };
  LH.PRINT_SIZES = [{ key: '8in', label: '8 × 8 in', trim: 8 }, { key: '8.5in', label: '8.5 × 8.5 in', trim: 8.5 }, { key: '20cm', label: '20 × 20 cm', trim: 20 / 2.54 }];
  LH.BLEEDS = [{ key: 'in', label: '0.125 in (3.2 mm)', v: .125 }, { key: '3mm', label: '3 mm', v: 3 / 25.4 }, { key: '5mm', label: '5 mm', v: 5 / 25.4 }];
  function sizeLabel(inches, metric) { return metric ? (Math.round(inches * 25.4 * 10) / 100) + ' cm' : (Math.round(inches * 1000) / 1000) + ' in'; }
  LH.fileName = function (book, opts) {
    opts = opts || {};
    var extra = opts.outline ? ' - colouring book' : '';
    if (opts.print) extra += ' - print ' + (opts.print.label || '').replace(/[^\w.]+/g, '');
    return (LH.title(book.story, book.hero) + extra).replace(/[\\/:*?"<>|’']+/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
  };

})();
