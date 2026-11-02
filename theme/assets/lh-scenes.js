/* lh-scenes.js: the story pictures: LH.sceneSvg, scenery kits, animals, LH.PEOPLE, LH.outline.
   Plain JavaScript on purpose: Python forms call it through anvil.js (client_code/lh.py). */
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
