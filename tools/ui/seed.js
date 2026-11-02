/* For screenshots: sign up a fresh account, save a hero from the studio and make one book.
   Leaves window.SEED = {hero: '#studio/<id>', book: '#book/<id>'} and resolves to it. */
(async function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, what, ms) {
    const end = Date.now() + (ms || 30000);
    while (Date.now() < end) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for: ' + what);
  }
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  function type(input, value) {
    input.focus(); input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  try {
    if (location.hash !== '#studio/new') window.UI_READY = false;
    location.hash = '#studio/new';
    await until(() => window.UI_READY && $$('.st-opt').length > 3, 'studio');
    type($('.st-who input'), 'Juniper');
    $('.st-save .anvil-role-ic-check button').click();
    await until(() => location.hash === '#auth/signup' && window.UI_READY && $$('.au-card input').length >= 3, 'sign-up');
    const inputs = $$('.au-card input[type=text], .au-card input[type=email], .au-card input[type=password]');
    type(inputs[0], 'Sam Rivera'); type(inputs[1], 'shots' + Date.now() + '@example.com'); type(inputs[2], 'Hb-' + Math.random().toString(36).slice(2) + '-Kq7');
    const tick = $('.au-card input[type=checkbox]'); if (tick && !tick.checked) tick.click();
    $$('.anvil-role-btn-block button').find((b) => /Create account/.test(b.textContent)).click();
    await until(() => location.hash === '#home' && window.UI_READY && $$('.sh-next-item').length, 'shelf', 60000);
    const hero = $('.sh-hero a.ui-btn').getAttribute('href');
    $$('.sh-next-item')[0].click();
    await until(() => $('.mk-dialog'), 'make dialog');
    $('.mk-dialog .anvil-role-btn-primary button').click();
    await until(() => /^#book\//.test(location.hash) && window.UI_READY && $('.rd-book'), 'book', 60000);
    window.SEED = { hero: hero, book: location.hash };
    return window.SEED;
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
})();
