/* lh-avatar.js: the cartoon people engine: LH.avatarSvg, LH.figure, looks, options, LH.fill.
   Plain JavaScript on purpose: Python forms call it through anvil.js (client_code/lh.py). */
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
