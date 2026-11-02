/* lh-book.js: books: LH.bookPages, LH.pageHtml, LH.reader (page turns, read aloud, colour me in),
   LH.makePdf + LH.writePdf (the PDF made in the browser), LH.coverHtml, LH.confetti.
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
  /* Story-time music: gentle tracks streamed by ArkMusic (web/pages/_arkmusic.html). Off until someone presses
     Music in the reader (remembered in this browser); it dips while "Read to me" reads. */
  UI.ICONS.music = UI.ICONS.music || '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>';
  LH.MUSIC = ['small-and-grand-wonder', 'toulouse', 'bright-road'];
  LH.music = {
    on: function () { return !!window.ArkMusic && !!UI.store.get('music', false); },
    set: function (v) { UI.store.set('music', !!v); if (v) LH.music.play(); else LH.music.stop(); },
    play: function () { if (window.ArkMusic) ArkMusic.play(LH.MUSIC, { volume: 0.35, fade: 2 }); },
    stop: function () { if (window.ArkMusic) ArkMusic.stop(1.2); },
    duck: function (v) { if (window.ArkMusic) ArkMusic.duck(v ? 0.4 : 1, v ? 0.3 : 1); }
  };
  LH.reader = function (el, book, opts) {
    opts = opts || {};
    var pages = LH.bookPages(book), at = Math.min(opts.start || 0, pages.length - 1), seen = {}, reading = false, finished = false;
    var colouring = false, crayon = LH.CRAYONS[0], painted = {};
    el.innerHTML = '<div class="rd"><div data-rd-crayons></div><div class="rd-stage"><button class="rd-nav prev" data-rd="prev" aria-label="Previous page">' + UI.icon('back') + '</button>' +
      '<div class="rd-book" data-rd-book></div><button class="rd-nav next" data-rd="next" aria-label="Next page">' + UI.icon('arrow') + '</button></div>' +
      '<div class="rd-bar"><div class="rd-dots" data-rd-dots></div><div class="rd-tools">' +
      ('speechSynthesis' in window ? '<button class="ui-btn sm" data-rd="speak">' + UI.icon('chat') + '<span>Read to me</span></button>' : '') +
      (window.ArkMusic ? '<button class="ui-btn sm' + (LH.music.on() ? ' on' : '') + '" data-rd="music" aria-pressed="' + LH.music.on() + '">' + UI.icon('music') + '<span>Music</span></button>' : '') +
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
        LH.music.duck(true);
        var mine = at;
        u.onend = function () { if (reading && mine === at) { if (at < pages.length - 1) setTimeout(function () { if (reading && mine === at) go(at + 1); }, 900); else stopSpeak(); } };
        speechSynthesis.speak(u);
      } catch (e) { stopSpeak(); }
    }
    function stopSpeak() {
      reading = false;
      try { speechSynthesis.cancel(); } catch (e) {}
      LH.music.duck(false);
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
      } else if (k === 'music') {
        var mOn = !LH.music.on();
        LH.music.set(mOn); b.classList.toggle('on', mOn); b.setAttribute('aria-pressed', String(mOn));
      }
    });
    function key(e) {
      if (e.target.closest && e.target.closest('input, textarea, select') || document.querySelector('.ui-modal-wrap, .anvil-modal-content')) return;
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
    if (LH.music.on()) LH.music.play();
    return {
      go: go, at: function () { return at; }, count: pages.length, colouring: function () { return colouring; },
      destroy: function () { document.removeEventListener('keydown', key); stopSpeak(); LH.music.stop(); }
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
