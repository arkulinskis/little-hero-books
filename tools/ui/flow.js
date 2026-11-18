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
  const rdr = () => { const r = $('.rd'); return r && r.parentNode.lhReader; };  // the reader's controller (lh-book.js)
  const playing = (part) => { const a = rdr() && rdr().audio(); return a && !a.paused && a.currentTime > 0.15 && (a.src.indexOf(part) >= 0 || rdr().playingSrc().indexOf(part) >= 0); };  // recordings play from memory (blob:)
  const voiceUrl = (key) => location.origin + '/_/api/voice/' + key;

  try {
    // ---- landing
    await page('#landing', () => $$('.lh-cover').length >= 18, 'landing covers');
    ok($$('.lp-pal').length === 5, 'landing: 18 covers and 5 example kids');
    $$('.lp-pal')[2].click();
    await until(() => $('.lpx-sticker.s1') && /Amara/.test($('.lpx-sticker.s1').textContent), 'landing switches hero');
    ok(true, 'landing: tapping a kid redraws the shelf');
    ok($('.ytf .ytf-cover') && !$('.ytf iframe'), 'landing: the Watch section shows the video cover, no YouTube player yet');
    $('.ytf .ytf-cover').click();
    await until(() => $('.ytf iframe[src*="youtube-nocookie.com/embed/GGIkFuY4_pc"]'), 'video player');
    ok(true, 'landing: pressing play loads the YouTube player');

    // ---- library as a guest
    await page('#library', () => $$('.lb-card').length === 18, 'library');
    ok(!/Your stories/.test($('.ui-wrap').innerText) && $('.wr-cta a[href="#write"]') && $$('.anvil-role-badge-new').filter((b) => b.offsetParent && /New story/.test(b.textContent)).length === 3,
      'library: 18 stories, 3 marked New story, a Write your own story card');
    ok($$('.lb-pick').length >= 2, 'library: starring chips');
    $$('.lb-star button.lb-pick').pop().click();
    await until(() => $$('.lb-card').length === 18, 'library redraw');
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

    // ---- full screen (headless Chrome refuses the real one for a script's click, so this is the window-filling one)
    await click('[data-rd=full]');
    await until(() => rdr().full() && $('.rd.rd-full') && $('.rd-exit').offsetWidth > 0, 'full screen');
    const fr = $('.rd').getBoundingClientRect();
    ok(getComputedStyle($('.rd')).position === 'fixed' && fr.width >= innerWidth - 1 && fr.height >= innerHeight - 1 &&
      /Exit full screen/.test($('.rd-exit').textContent) && document.activeElement === $('.rd-exit') &&
      /Exit full screen/.test($('.rd-full-btn').textContent) && $('.rd-full-btn').getAttribute('aria-pressed') === 'true',
      'full screen: the book fills the screen, "Exit full screen" button top right (focused)');
    ok($('.rd-tools .anvil-role-ic-download').offsetParent === null && $('.rd-book').offsetWidth > 300,
      'full screen: the page buttons (PDF, family link...) step aside');
    $('.rd-nav.prev').click();
    await until(() => rdr().at() === rdr().count - 2, 'page turn in full screen');
    await click('.rd-exit');
    await until(() => !rdr().full() && !$('.rd.rd-full') && !document.documentElement.classList.contains('rd-full-on') && $('.rd-exit').offsetWidth === 0, 'exit full screen');
    ok(getComputedStyle($('.rd')).position !== 'fixed' && $('.rd-tools .anvil-role-ic-download').offsetParent !== null,
      'full screen: Exit full screen brings the page back');
    await click('[data-rd=full]');
    await until(() => rdr().full(), 'full screen again');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await until(() => !rdr().full() && !$('.rd.rd-full'), 'Esc leaves full screen');
    ok(true, 'full screen: Esc leaves it too');

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

    // ---- painted edition: the dialog (sending is tested end to end by paint.js with a real Image Enhancer)
    await click('.rd-tools .anvil-role-ic-palette button');
    await until(() => $$('.pt-style').length === 6, 'paint dialog styles');
    const start = byText('.anvil-modal-content .anvil-role-btn-primary button', 'Paint my book');
    const closed = /isn.t open yet/.test($('.anvil-role-pt-queue-text').textContent);
    ok(start && (closed ? start.disabled : !start.disabled), 'paint: dialog with 6 styles; ' + (closed ? 'studio not set up here, so Paint my book is off' : 'studio set up, Paint my book is on'));
    const loaded = (img) => img && img.complete && img.naturalWidth > 0;
    await until(() => loaded($('.pt-preview-img')) && loaded($('.pt-drawn img')) && $$('.pt-thumb').every(loaded), 'style previews load');
    ok(/paint-kids_book\.jpg(\?|$)/.test($('.pt-preview-img').src) && /Storybook/.test($('.anvil-role-pt-preview-name').textContent),
      'paint: a sample of every style, Storybook large with the drawing in the corner');
    $$('.pt-style')[3].click();
    await until(() => $$('.pt-style')[3].classList.contains('on') && /paint-claymation\.jpg(\?|$)/.test($('.pt-preview-img').src), 'style picked');
    ok(/Clay/.test($('.anvil-role-pt-preview-name').textContent) && /clay/i.test($('.anvil-role-pt-preview-note').textContent),
      'paint: picking Clay shows its sample and description');
    await click('.anvil-modal-content button', 'Close');
    await until(() => !$('.anvil-modal-content'), 'paint dialog closes');
    ok(!$('.bk-paint') || $('.bk-paint').offsetParent === null, 'paint: picking a style and closing sends nothing');
    // the skin check measures what it should: the drawing itself scores ~0, the same page with only the child's skin
    // made dark scores far past the limit (Painting.SKIN_TOLERANCE = 25), and so does a dark child made fair
    const skinBook = (skin) => ({ story: { key: 'bears', text: new Array(9).fill('x'), title: 'x', color: '#ef5a36' },
      hero: { name: 'Test', pronoun: 'she', look: { size: 'kid', skin: skin, hair: 'curly', hairColor: 'ginger', outfit: 'overalls', outfitColor: 'sky' } } });
    const asUrl = async (bk, marker) => URL.createObjectURL(await LH.paintPicture(bk, 0, marker));
    const fair = skinBook('s2'), darkKid = skinBook('s19');
    const same = JSON.parse(await LH.skinCheck(fair, 0, await asUrl(fair)));
    const flipped = JSON.parse(await LH.skinCheck(fair, 0, await asUrl(fair, LH.COL.skin.s19)));
    const reverse = JSON.parse(await LH.skinCheck(darkKid, 0, await asUrl(darkKid, LH.COL.skin.s2)));
    const near = JSON.parse(await LH.skinCheck(fair, 0, await asUrl(fair, LH.COL.skin.s3)));
    ok(Math.abs(same.relative) < 2 && flipped.relative < -25 && reverse.relative > 25 && Math.abs(near.relative) < 25 && same.pixels > 1000,
      'skin check: same picture ' + same.relative + ', fair child made dark ' + flipped.relative + ', dark child made fair ' +
      reverse.relative + ', a near shade ' + near.relative + ' (' + same.pixels + ' skin pixels)');

    // ---- record my voice (drive.mjs gives Chrome a fake microphone that beeps)
    await click('[data-rd=rec]');
    await until(() => $('.rd-rec'), 'record panel');
    ok(/anyone with its family link can hear them/.test($('.rd-rec').textContent) && $('[data-rd=rec]').getAttribute('aria-pressed') === 'true',
      'record: the panel opens and says who can hear the recordings');
    $$('.rd-dots button')[2].click();
    await until(() => rdr().at() === 2 && /Page 1: not recorded yet/.test($('.rd-rec').textContent), 'page 1, not recorded');
    await click('[data-rec=start]');
    await until(() => $('.rd-rec[data-state=recording]') && $('[data-rec=stop]'), 'recording', 20000);
    await sleep(1800);
    await click('[data-rec=stop]');
    await until(() => $('.rd-rec[data-state=saved]'), 'saved', 30000);
    const v1 = rdr().voice()['2'];
    ok(v1 && v1.key && v1.seconds >= 1 && $$('.rd-dots button.vo').length === 1 && /Your voice on 1 page/.test($('.bk-head').innerText),
      'record: page 1 recorded and saved (marked dot, "Your voice" badge)');
    const d0 = LH.media.stats().downloads;
    await click('[data-rec=play]');
    await until(() => playing('blob:'), 'plays back from memory', 15000);
    ok(LH.media.stats().downloads === d0, 'record: Play plays the new recording straight from memory (nothing downloaded)');
    await click('[data-rec=redo]');
    await until(() => $('.rd-rec[data-state=recording]'), 'recording again', 20000);
    await sleep(1300);
    await click('[data-rec=stop]');
    await until(() => $('.rd-rec[data-state=saved]') && rdr().voice()['2'].key !== v1.key, 'redo saved', 30000);
    const key2 = rdr().voice()['2'].key;
    ok($$('.rd-dots button.vo').length === 1, 'record: Redo replaces the page recording');
    await click('[data-rec=next]');
    await until(() => rdr().at() === 3 && $('[data-rec=start]'), 'next page');
    await click('[data-rec=start]');
    await until(() => $('.rd-rec[data-state=recording]'), 'recording page 2', 20000);
    await sleep(1300);
    $('.rd-nav.next').click();
    await until(() => rdr().voice()['3'], 'saved on page turn', 30000);
    ok(rdr().at() === 4 && $$('.rd-dots button.vo').length === 2 && /Your voice on 2 pages/.test($('.bk-head').innerText),
      'record: turning the page while recording saves it');
    let res = await fetch(voiceUrl(key2), { headers: { Range: 'bytes=0-99' } });
    const ctype = res.headers.get('content-type') || '';
    ok(res.status === 206 && /^audio\//.test(ctype) && (await res.arrayBuffer()).byteLength === 100 && /^bytes 0-99\//.test(res.headers.get('content-range') || ''),
      'voice address: answers a byte range with 206 (' + ctype + ')');
    res = await fetch(voiceUrl(key2));
    ok(res.status === 200 && (await res.arrayBuffer()).byteLength > 1000, 'voice address: the whole recording');
    ok((await fetch(voiceUrl(v1.key))).status === 404, 'voice address: a replaced recording is gone');
    const vsrc = voiceUrl(key2) + '?t=cache';
    const dl = LH.media.stats().downloads, u1 = await LH.media.load(vsrc), u2 = await LH.media.load(vsrc);
    ok(u1 === u2 && /^blob:/.test(u1) && LH.media.stats().downloads === dl + 1, 'kept for the visit: a recording is downloaded once, then reused');
    LH.media.drop(vsrc);
    await click('[data-rd=rec]');
    await until(() => !$('.rd-rec'), 'panel closes');
    ok($('[data-rd=rec]').textContent.trim() === 'Record my voice', 'record: Done recording closes the panel');

    // ---- reload: the recordings come from the server and Read to me plays them
    await page('#library', () => $$('.lb-card').length === 18, 'library');
    ok(!/Your stories/.test($('.ui-wrap').innerText) && $('.wr-cta a[href="#write"]') && $$('.anvil-role-badge-new').filter((b) => b.offsetParent && /New story/.test(b.textContent)).length === 3,
      'library: 18 stories, 3 marked New story, a Write your own story card');
    await page(bookHash, () => $('.rd-book') && rdr(), 'book reloaded');
    ok(Object.keys(rdr().voice()).sort().join() === '2,3' && $$('.rd-dots button.vo').length === 2, 'reload: the recorded pages are back');
    $$('.rd-dots button')[2].click();
    await until(() => rdr().at() === 2, 'page 1');
    const d1 = LH.media.stats().downloads;
    await click('[data-rd=speak]');
    await until(() => playing('/_/api/voice/' + key2), 'Read to me plays the recorded voice', 20000);
    ok(true, 'Read to me: plays the recorded voice from the server');
    await until(() => rdr().at() === 3 && playing('/_/api/voice/'), 'turns the page and plays the next recording', 20000);
    ok(true, 'Read to me: turns the page by itself and plays the next one');
    ok(LH.media.stats().downloads === d1 && /^blob:/.test(rdr().audio().src), 'Read to me: recordings already received this visit play from memory (nothing downloaded again)');
    await click('[data-rd=speak]');
    await until(() => !rdr().playing(), 'stops');

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
    ok(/recorded themselves reading it/.test(document.body.textContent) && $$('.rd-dots button.vo').length === 2 && !$('[data-rd=rec]'),
      'family link page: the recorded pages are there, no Record button');
    $$('.rd-dots button')[3].click();
    await until(() => rdr().at() === 3, 'page 2');
    await click('[data-rd=speak]');
    await until(() => playing('/_/api/voice/'), 'family hears the voice', 20000);
    await click('[data-rd=speak]');
    ok(true, 'family link page: Read to me plays the recorded voice');

    // ---- story preview with the blank book
    await page('#story/goats/blank', () => $('.rd-book'), 'story preview');
    ok(/Little Hero and the Billy Goats Gruff/.test(document.body.textContent), 'story preview: blank book title');

    // ---- profile
    await page('#profile', () => $('.pf-grid'), 'profile');
    type($('.pf-grid input'), 'Flow Tester Two');
    await click('.pf-grid .anvil-role-btn-primary button', 'Save');
    await until(() => /Flow Tester Two/.test($('.pf-head').textContent), 'name saved');
    ok(true, 'profile: name saved');

    // ---- write a story: start from a library story, change it, save, preview, make a book, delete
    await page('#write', () => $$('.wr-start').length === 18, 'write hub');
    ok(!$('.wr-start').closest('[style*="display: none"]') && /A blank page/.test(document.body.innerText), 'write: the hub offers a blank page and 18 stories to start from');
    $$('.wr-start button')[0].click();
    await until(() => window.UI_READY && /^#write\/new\/bears$/.test(location.hash) && $$('.wr-page').length === 9, 'editor with 9 pages', 30000);
    ok(/Starting from/.test($('.anvil-role-bk-intro').textContent) && $$('.wr-page svg').length === 9, 'write: starting from The Three Bears copies its 9 pages and pictures');
    type($('.wr-meta input'), '{name} and the Brave Bears');
    const ta0 = $$('.wr-page textarea')[0];
    type(ta0, 'Hello there.');
    ta0.focus(); ta0.setSelectionRange(ta0.value.length, ta0.value.length);
    await click('.wr-tokens button', '+ she / he');
    await until(() => /Hello there\. \{He\}/.test($$('.wr-page textarea')[0].value), 'token inserted');
    ok(/Reads: Hello there\. (He|She|They)/.test($$('.wr-page')[0].innerText), 'write: + she / he puts a capital {He} after a full stop, and the page shows how it reads');
    $$('.wr-page .anvil-role-ic-trash button')[8].click();
    const rm = await until(() => $$('.anvil-modal button, .modal button').find((b) => b.textContent.trim() === 'Remove' && b.offsetParent), 'remove confirm');
    rm.click();
    await until(() => $$('.wr-page').length === 8, 'page removed');
    ok(true, 'write: removing a page with words asks first');
    const pic0 = $$('.wr-page .wr-pic-art')[0].innerHTML;
    $$('.wr-page .anvil-role-ic-image button')[0].click();
    await until(() => $$('.wr-tile').length === 10, 'picture tiles');
    const sel = $('.wr-picker select');
    sel.value = Array.from(sel.options).find((o) => /Hiccupy/.test(o.textContent)).value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => /Page 4/.test($$('.wr-tile')[4].textContent) && $$('.wr-tile').length === 10, 'dragon tiles');
    $$('.wr-tile')[4].click();
    await until(() => !$('.wr-picker') && $$('.wr-page .wr-pic-art')[0].innerHTML !== pic0, 'picture changed');
    ok(true, 'write: Pick a picture shows any story\'s cover + pages and swaps the page picture');
    await click('.wr-add button', 'Add a page');
    await until(() => $$('.wr-page').length === 9, 'page added');
    type($$('.wr-page textarea')[8], 'And they all lived happily ever after.');
    ok(/Not saved yet/.test($('.anvil-role-wr-status').textContent), 'write: adding a page; the bar says Not saved yet');
    await click('.wr-bar button', 'Save');
    await until(() => /^#write\/u-/.test(location.hash) && /All changes saved/.test($('.anvil-role-wr-status').textContent), 'saved', 30000);
    const storyHash = location.hash;
    ok(true, 'write: Save stores the story and the address becomes ' + storyHash);
    await click('.wr-bar button', 'Preview');
    await until(() => $('.wr-preview .rd-book') && rdr(), 'preview reader');
    ok(/Brave Bears/.test($('.wr-preview').innerText), 'write: Preview opens the reader with the new title');
    await click('.wr-bar button', 'Make it a book');
    await click('.mk-dialog .anvil-role-btn-primary button', 'Make my book');
    await until(() => /^#book\//.test(location.hash) && window.UI_READY && $('.rd-book'), 'book from the written story', 30000);
    ok(/Brave Bears/.test(document.body.innerText), 'write: Make it a book puts it on the shelf and opens it');
    await page('#library', () => $$('.lb-card').length === 19, 'library with your story');
    ok(/Your stories/.test($('.ui-wrap').innerText) && $$('.anvil-role-badge-new').some((b) => b.offsetParent && /Your story/.test(b.textContent)), 'library: Your stories shows the written story');
    await page(storyHash, () => $$('.wr-page').length === 9, 'editor again');
    ok(/\{He\}/.test($$('.wr-page textarea')[0].value) && $('.wr-meta input').value === '{name} and the Brave Bears', 'write: reopening keeps the words and title');
    await click('.wr-bar button', 'Delete');
    const del = await until(() => $$('.anvil-modal button, .modal button').find((b) => b.textContent.trim() === 'Delete' && b.offsetParent), 'delete confirm');
    ok(/1 book made from it/.test(document.body.innerText), 'write: Delete warns about the book made from it');
    del.click();
    await until(() => location.hash === '#write' && window.UI_READY && $$('.wr-start').length === 18 && !/Your stories/.test($('.ui-wrap').innerText), 'deleted', 30000);
    ok(true, 'write: Delete removes the story (and its book)');

    // ---- back to the book: shelf shows it, then remove it
    await page('#home', () => $$('.sh-book').length >= 1, 'book on the shelf');
    ok(true, 'shelf: the new book is on it');
    await page(bookHash, () => $('.rd-book') && rdr(), 'book again');

    // ---- delete recordings: one page, then all (asks first)
    await click('[data-rd=rec]');
    $$('.rd-dots button')[2].click();
    await until(() => rdr().at() === 2 && $('[data-rec=delete]'), 'delete button');
    const gone = rdr().voice()['2'].key;
    await click('[data-rec=delete]');
    await until(() => !rdr().voice()['2'] && $('[data-rec=start]'), 'page deleted', 20000);
    const goneStatus = (await fetch(voiceUrl(gone))).status;
    ok($$('.rd-dots button.vo').length === 1 && goneStatus === 404, 'record: Delete removes that page and its audio (' + goneStatus + ')');
    const last = rdr().voice()['3'].key;
    await click('[data-rec=clear]');
    const yes = await until(() => $$('.anvil-modal button, .modal button').find((b) => b.textContent.trim() === 'Delete all' && b.offsetParent), 'confirm');
    yes.click();
    await until(() => Object.keys(rdr().voice()).length === 0 && !$('.rd-rec-clear'), 'all deleted', 20000);
    ok(!/Your voice on/.test($('.bk-head').innerText) && (await fetch(voiceUrl(last))).status === 404 && !$$('.rd-dots button.vo').length,
      'record: Delete all recordings (after asking) removes every page');

    say('PASSED');
    return { ok: true, log: log };
  } catch (e) {
    say(String(e && e.message || e));
    return { ok: false, log: log };
  }
})();
