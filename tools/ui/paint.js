/* The painted edition, end to end: Little Hero Books -> Image Enhancer -> its worker -> back into the reader.
   Needs a local Image Enhancer with a worker running and the App Secrets set: tools/testing/paint_e2e.py starts it all
   and runs `ui_test.py --only paint.js`. Runs after seed.js (a fresh account with a hero and one book, window.SEED).
   Resolves to {ok, log}. Keep log lines ASCII (the Windows console). */
(async function () {
  const log = [], t0 = Date.now();
  const say = (m) => log.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, what, ms) {
    const end = Date.now() + (ms || 20000);
    while (Date.now() < end) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(200); }
    throw new Error('timed out waiting for: ' + what);
  }
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const byText = (sel, text) => $$(sel).find((e) => e.textContent.trim().replace(/\s+/g, ' ') === text);
  async function click(sel, text) {
    const el = await until(() => (text ? byText(sel, text) : $(sel)), sel + (text ? ' "' + text + '"' : ''));
    el.scrollIntoView({ block: 'center' });
    el.click();
    return el;
  }
  async function page(hash, ready, what) {
    if (location.hash !== hash) window.UI_READY = false;
    location.hash = hash;
    await until(() => window.UI_READY && location.hash === hash && ready(), what || hash, 30000);
    await sleep(300);
  }
  const ok = (cond, msg) => { if (!cond) throw new Error('FAILED: ' + msg); say('ok   ' + msg); };
  const rdr = () => { const r = $('.rd'); return r && r.parentNode.lhReader; };
  const shown = (e) => !!(e && e.offsetParent !== null && !e.hidden);
  const text = (sel) => ($(sel) ? $(sel).innerText.replace(/\s+/g, ' ').trim() : '');
  const imgOk = (img) => !!(img && img.complete && img.naturalWidth > 0);
  const paintBtn = () => $('.rd-tools .anvil-role-ic-palette button');

  try {
    const seed = window.SEED;
    if (!seed || !seed.book) throw new Error('seed.js made no book: ' + JSON.stringify(seed));
    await page(seed.book, () => $('.rd-book') && rdr(), 'the seeded book');
    ok(shown(paintBtn()) && /Paint this book/.test(paintBtn().textContent), 'book: "Paint this book" in the reader toolbar');
    ok(!shown($('[data-rd=paint]')) && !shown($('.bk-paint')), 'reader: no Painted switch and no strip before painting');

    // ---- the dialog: styles, the studio's queue, send every page
    paintBtn().click();
    await until(() => $$('.pt-style').length === 6, 'six styles');
    const queue = text('.anvil-role-pt-queue-text');
    ok(/should be ready in/.test(queue), 'dialog: the studio is open and gives an estimate ("' + queue.slice(0, 70) + '")');
    ok($$('.pt-style')[0].classList.contains('on'), 'dialog: Storybook is picked first');
    $$('.pt-style')[1].click();
    await until(() => $$('.pt-style')[1].classList.contains('on') && !$$('.pt-style')[0].classList.contains('on'), 'style picked');
    ok($$('.pt-style')[1].getAttribute('aria-pressed') === 'true', 'dialog: tapping Watercolour picks it (aria-pressed)');
    await click('.anvil-modal-content .anvil-role-btn-primary button', 'Paint my book');
    await until(() => shown($('.pt-send')) && /Sending picture \d+ of \d+/.test(text('.anvil-role-pt-send-text')), 'sending progress');
    ok(true, 'dialog: "Sending picture n of N" with a progress bar');
    await until(() => !$('.anvil-modal-content'), 'every page sent', 180000);
    await until(() => shown($('.bk-paint')) || /Painted/.test(text('.bk-head')), 'the strip (or already painted)', 20000);
    if (shown($('.bk-paint'))) {
      ok(/Painting your book in Watercolour style/.test(text('.bk-paint')) && /of \d+ pages painted/.test(text('.bk-paint')),
        'book: the strip says "Painting your book in Watercolour style" with pages painted');
    }

    // ---- pictures arrive while the page is open (paint_status every 15 s)
    await until(() => !shown($('.bk-paint')) && /Painted: Watercolour/.test(text('.bk-head')), 'every page painted', 300000);
    ok(/Painted edition/.test(paintBtn().textContent), 'book: every page painted, badge "Painted: Watercolour", button "Painted edition"');
    await until(() => imgOk($('.rd-pic img.rd-painted')), 'painted cover', 15000);
    const cover = $('.rd-pic img.rd-painted');
    ok(cover.naturalWidth >= 600 && Math.abs(cover.naturalWidth / cover.naturalHeight - 10 / 7) < 0.05,
      'reader: the cover is the painted picture (' + cover.naturalWidth + 'x' + cover.naturalHeight + ', 10:7)');
    const res = await fetch(cover.src);
    ok(res.status === 200 && /^image\//.test(res.headers.get('content-type')), 'painting endpoint: 200 ' + res.headers.get('content-type'));
    ok(shown($('[data-rd=paint]')) && $('[data-rd=paint]').getAttribute('aria-pressed') === 'true', 'reader: the Painted switch is on');

    // every kind of page: dedication portrait, a story page, The End
    $$('.rd-dots button')[1].click();
    await until(() => imgOk($('.rd-ded .frame img.rd-painted')), 'painted dedication portrait');
    ok(true, 'reader: the dedication portrait is painted');
    $$('.rd-dots button')[4].click();
    await until(() => imgOk($('.rd-pic img.rd-painted')) && $('.rd-text'), 'painted story page');
    ok(true, 'reader: story page 3 is painted, its words still text');
    const dots = $$('.rd-dots button');
    dots[dots.length - 1].click();
    await until(() => imgOk($('.rd-end .fig.pp img.rd-painted')), 'painted End');
    ok(true, 'reader: The End shows the painted hero');

    // the switch, and Colour me in still uses the drawings
    $$('.rd-dots button')[2].click();
    await until(() => imgOk($('.rd-pic img.rd-painted')), 'page 1 painted');
    $('[data-rd=paint]').click();
    await until(() => $('.rd-pic svg') && !$('.rd-pic img'), 'drawing back');
    ok($('[data-rd=paint]').getAttribute('aria-pressed') === 'false', 'reader: switching Painted off shows the drawing');
    $('[data-rd=paint]').click();
    await until(() => imgOk($('.rd-pic img.rd-painted')), 'painted again');
    $('[data-rd=colour]').click();
    await until(() => $('.rd-book.out .rd-pic svg') && !$('.rd-pic img'), 'outline drawing');
    ok(true, 'reader: Colour me in shows the outline drawing, not the painting');
    $('[data-rd=colour]').click();
    await until(() => imgOk($('.rd-pic img.rd-painted')), 'painted after colouring');

    // ---- the PDF dialog offers the painted pictures; a painted page draws into the PDF canvas
    await click('.rd-tools .anvil-role-ic-download button');
    await until(() => $('.lhp-dialog'), 'pdf dialog');
    const row = byText('.lhp-row b', 'Use the painted pictures');
    ok(row && shown(row.closest('.lhp-row')) && row.closest('.lhp-row').classList.contains('on'), 'pdf: "Use the painted pictures" is offered and on');
    $('.lhp-card[data-k=outline]').click();
    await until(() => !shown(byText('.lhp-row b', 'Use the painted pictures').closest('.lhp-row')), 'hidden for the colouring book');
    ok(true, 'pdf: not offered for the colour-me-in book');
    await click('.anvil-modal-content .anvil-role-btn-ghost button', 'Cancel');
    await until(() => !$('.anvil-modal-content'), 'pdf dialog closed');

    // ---- leave and open the book again: the painting comes back from the server (get_book)
    await page('#home', () => $$('.sh-book').length >= 1, 'shelf');
    await page(seed.book, () => $('.rd-book') && rdr(), 'the book again');
    await until(() => imgOk($('.rd-pic img.rd-painted')), 'painted cover again', 30000);
    ok(/Painted: Watercolour/.test(text('.bk-head')), 'reopened: the painted pictures come back from the server');

    // ---- the dialog for a painted book: paint again / back to the drawings
    paintBtn().click();
    await until(() => $$('.pt-style').length === 6 && /The painted edition/.test(text('.anvil-modal-content')), 'painted dialog');
    ok($$('.pt-style')[1].classList.contains('on') && /Saved/.test($$('.pt-style')[1].textContent) &&
      byText('.anvil-modal-content button', 'Paint it fresh'),
      'dialog: "The painted edition", Watercolour picked and Saved, "Paint it fresh"');
    await click('.anvil-modal-content button', 'Back to the drawings');
    const yes = await until(() => $$('.anvil-modal button').find((b) => b.textContent.trim() === 'Show the drawings' && b.offsetParent), 'confirm');
    yes.click();
    await until(() => !$('.anvil-modal-content') && $('.rd-pic svg') && !$('.rd-painted'), 'drawings back', 30000);
    await until(() => !/Painted/.test(text('.bk-head .ui-row')), 'badge gone');
    ok(!shown($('[data-rd=paint]')) && /Paint this book/.test(paintBtn().textContent) && (await fetch(cover.src)).status === 404,
      'back to the drawings: switch and badge gone, the old picture address is 404');

    // ---- paint again in Storybook for the screenshots, and leave it painted
    paintBtn().click();
    await until(() => $$('.pt-style').length === 6, 'dialog again');
    await click('.anvil-modal-content .anvil-role-btn-primary button', 'Paint my book');
    await until(() => !$('.anvil-modal-content'), 'sent again', 180000);
    await until(() => /Painted: Storybook/.test(text('.bk-head')) && !shown($('.bk-paint')), 'painted in Storybook', 300000);
    ok(true, 'painted again in Storybook');

    // ---- switch back to the saved Watercolour pictures: instant, nothing painted again
    paintBtn().click();
    await until(() => $$('.pt-style').length === 6, 'dialog with saved styles');
    ok(/Saved/.test($$('.pt-style')[0].textContent) && /Saved/.test($$('.pt-style')[1].textContent) && !/Saved/.test($$('.pt-style')[2].textContent),
      'dialog: Storybook and Watercolour say Saved, 3D cartoon does not');
    $$('.pt-style')[1].click();
    const switchBtn = await until(() => byText('.anvil-modal-content button', 'Switch to Watercolour'), 'switch button');
    ok(/no painting or waiting/.test(text('.anvil-role-pt-queue-text')) && shown(byText('.anvil-modal-content button', 'Paint fresh')),
      'dialog: "Switch to Watercolour" with no waiting, and "Paint fresh" offered');
    const t1 = Date.now();
    switchBtn.click();
    await until(() => !$('.anvil-modal-content') && /Painted: Watercolour/.test(text('.bk-head')) && imgOk($('.rd-pic img.rd-painted')), 'switched back', 20000);
    ok(!shown($('.bk-paint')), 'switched back to the saved Watercolour pictures in ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s, nothing painted');
    say('PASSED');
    return { ok: true, log: log };
  } catch (e) {
    say(String(e && e.message || e));
    return { ok: false, log: log };
  }
})();
