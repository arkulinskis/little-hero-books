/* The main user journey, run inside the real app (Anvil App Server) by tools/ui_test.py through tools/live/drive.mjs.
   Resolves to {ok, log}. Keep log lines ASCII (the Windows console). */
(async function () {
  const log = [], t0 = Date.now();
  const say = (m) => log.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, what, ms) {
    const end = Date.now() + (ms || 20000);
    while (Date.now() < end) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for: ' + what);
  }
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const byText = (sel, text) => $$(sel).find((e) => e.textContent.trim().replace(/\s+/g, ' ') === text);
  async function click(sel, text) {
    const el = await until(() => (text ? byText(sel, text) : $(sel)), sel + (text ? ' "' + text + '"' : ''));
    el.scrollIntoView({ block: 'center' });
    el.click();
    return el;
  }
  function type(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }
  async function page(hash, ready, what) {
    if (location.hash !== hash) window.UI_READY = false;  // the old page stays until the router runs
    location.hash = hash;
    await until(() => window.UI_READY && location.hash === hash && ready(), what || hash, 30000);
    await sleep(300);
  }
  const ok = (cond, msg) => { if (!cond) throw new Error('FAILED: ' + msg); say('ok   ' + msg); };

  try {
    // ---- landing
    await page('#landing', () => $$('.lh-cover').length >= 12, 'landing covers');
    ok($$('.lp-pal').length === 5, 'landing: 12 covers and 5 example kids');
    $$('.lp-pal')[2].click();
    await until(() => $('.lpx-sticker.s1') && /Amara/.test($('.lpx-sticker.s1').textContent), 'landing switches hero');
    ok(true, 'landing: tapping a kid redraws the shelf');
    ok($('.ytf .ytf-cover') && !$('.ytf iframe'), 'landing: the Watch section shows the video cover, no YouTube player yet');
    $('.ytf .ytf-cover').click();
    await until(() => $('.ytf iframe[src*="youtube-nocookie.com/embed/lpY_f2LUTdI"]'), 'video player');
    ok(true, 'landing: pressing play loads the YouTube player');

    // ---- library as a guest
    await page('#library', () => $$('.lb-card').length === 12, 'library');
    ok($$('.lb-pick').length >= 2, 'library: starring chips');
    $$('.lb-star button.lb-pick').pop().click();
    await until(() => $$('.lb-card').length === 12, 'library redraw');
    ok(true, 'library: picking the blank book redraws the covers');

    // ---- studio as a guest
    await page('#studio/new', () => $$('.st-opt').length > 3, 'studio tiles');
    const before = $('.st-hero').innerHTML;
    await click('.ui-tabs button', 'Hair');
    await until(() => $$('.st-opt').length > 10, 'hair tiles');
    $$('.st-opt').filter((t) => !t.classList.contains('on'))[5].click();  // a hairstyle the hero doesn't have yet
    await until(() => $('.st-hero').innerHTML !== before, 'preview changes');
    ok(true, 'studio: a hairstyle tile changes the preview');
    await click('.anvil-role-ic-dice button');
    await until(() => !$('.anvil-role-ic-back button').disabled, 'undo enabled');
    ok(true, 'studio: Surprise me + undo enabled');
    type($('.st-who input'), 'Mila');
    await until(() => /Mila/.test($('.anvil-role-st-name').textContent), 'name shows');
    ok(true, 'studio: the name appears under the hero');
    await click('.st-save .anvil-role-ic-check button');
    await until(() => location.hash === '#auth/signup', 'save as guest goes to sign-up');
    ok(true, 'studio: saving as a guest asks to sign up');

    // ---- sign up (then the studio saves the hero by itself)
    await until(() => window.UI_READY && $$('.au-card input').length >= 3, 'sign-up form');
    const email = 'flow' + Date.now() + '@example.com';
    const inputs = $$('.au-card input[type=text], .au-card input[type=email], .au-card input[type=password]');
    type(inputs[0], 'Flow Tester'); type(inputs[1], email); type(inputs[2], 'Hb-' + Math.random().toString(36).slice(2) + '-Kq7');
    const tick = $('.au-card input[type=checkbox]');
    if (tick && !tick.checked) tick.click();
    await click('.anvil-role-btn-block button', 'Create account');
    await until(() => location.hash === '#home' && window.UI_READY && $$('.sh-hero').length >= 2, 'hero saved, shelf open', 40000);
    ok(/Mila/.test($('.sh-heroes').textContent), 'sign-up: the draft hero was saved and the shelf opened');

    // ---- make a book from "Next adventures"
    ok($$('.sh-next-item').length === 4, 'shelf: 4 next adventures for Mila');
    $$('.sh-next-item')[0].click();
    await until(() => $('.mk-dialog'), 'make-book dialog');
    await click('.mk-dialog .anvil-role-btn-primary button');
    await until(() => /^#book\//.test(location.hash) && window.UI_READY && $('.rd-book'), 'book opens', 30000);
    const bookHash = location.hash;
    ok(true, 'make book: the dialog makes it and opens the reader');

    // ---- reader
    ok($('.rd-tools .anvil-role-ic-download') && $('.rd-tools .anvil-role-ic-link'), 'reader: our buttons sit in its toolbar');
    for (let i = 0; i < 12; i++) { const n = $('.rd-nav.next'); if (n && !n.disabled) n.click(); await sleep(60); }
    await until(() => $('.rd-end'), 'last page');
    ok(true, 'reader: turned to The End');

    // ---- family link
    await click('.anvil-role-ic-link button');
    await click('.anvil-modal-content .anvil-role-btn-primary button', 'Make a family link');
    const link = await until(() => { const i = $('.bk-link input'); return i && i.value.indexOf('#read/') > 0 && i.value; }, 'family link url');
    await click('.anvil-modal-content .anvil-role-btn-primary button', 'Done');
    await until(() => !$('.anvil-modal-content'), 'dialog closes');
    ok(/Family link: on/.test($('.anvil-role-ic-link').textContent), 'family link: made, and the button says it is on');

    // ---- dedication
    await click('.anvil-role-ic-edit button');
    const ta = await until(() => $('.anvil-modal-content textarea'), 'dedication box');
    type(ta, 'For Mila, from the flow test');
    await click('.anvil-modal-content .anvil-role-btn-primary button', 'Save');
    await until(() => $('.rd-ded') && /from the flow test/.test($('.rd-ded').textContent), 'dedication page shows it');
    ok(true, 'dedication: saved and shown on page 2');

    // ---- PDF (drawn in the browser)
    window.LH_LAST_PDF = null;
    await click('.anvil-role-ic-download button');
    await until(() => $('.lhp-dialog'), 'pdf dialog');
    await click('.lhp-dialog .anvil-role-btn-primary button', 'Make my PDF');
    await until(() => window.LH_LAST_PDF && window.LH_LAST_PDF.size > 50000, 'pdf made', 120000);
    ok(true, 'pdf: made in the browser (' + Math.round(window.LH_LAST_PDF.size / 1024) + ' KB)');
    await click('.anvil-modal-content .anvil-role-btn button', 'Done');
    await until(() => !$('.anvil-modal-content'), 'pdf dialog closes');

    // ---- the family link as a visitor would see it (same browser, but the page is public)
    await page('#' + link.split('#')[1], () => $('.rd-book'), 'shared book');
    ok(/A book made for Mila/.test(document.body.textContent), 'family link page: opens the book');

    // ---- story preview with the blank book
    await page('#story/goats/blank', () => $('.rd-book'), 'story preview');
    ok(/Little Hero and the Billy Goats Gruff/.test(document.body.textContent), 'story preview: blank book title');

    // ---- profile
    await page('#profile', () => $('.pf-grid'), 'profile');
    type($('.pf-grid input'), 'Flow Tester Two');
    await click('.pf-grid .anvil-role-btn-primary button', 'Save');
    await until(() => /Flow Tester Two/.test($('.pf-head').textContent), 'name saved');
    ok(true, 'profile: name saved');

    // ---- back to the book: shelf shows it, then remove it
    await page('#home', () => $$('.sh-book').length >= 1, 'book on the shelf');
    ok(true, 'shelf: the new book is on it');
    await page(bookHash, () => $('.rd-book'), 'book again');

    say('PASSED');
    return { ok: true, log: log };
  } catch (e) {
    say(String(e && e.message || e));
    return { ok: false, log: log };
  }
})();
