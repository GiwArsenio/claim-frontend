/* Diagnostic temporaire (branche design/diag-cls, jamais fusionnée). */
const aide = require('../tests/aide-parcours.cjs');
(async () => {
  await aide.demarrerServeur(); const nav = await aide.demarrerNavigateur();
  console.log('Chromium', nav.version());
  const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
  await page.route('**/assets/polices/*.woff2', (r) => r.abort());
  page.on('console', (m) => console.log('[page]', m.text().slice(0, 400)));
  await page.addInitScript(() => {
    const t0 = performance.now(); let last = '';
    const snap = (tag) => {
      const q = (s) => document.querySelector(s);
      const h1 = q('.hero h1'), sub = q('.hero .sub'), sb = q('.hero .sbar'), hero = q('.hero'), aside = q('.hero aside');
      if (!h1 || !sb) return;
      const r = (e) => e ? Math.round(e.getBoundingClientRect().height * 10) / 10 : null;
      const cs = getComputedStyle(h1);
      const s = JSON.stringify({ h1: r(h1), sub: r(sub), sbTop: Math.round(sb.getBoundingClientRect().top * 10) / 10, hero: r(hero), aside: r(aside),
        ff: cs.fontFamily.slice(0, 40), fs: cs.fontSize, lh: cs.lineHeight, ready: document.readyState, cls: document.documentElement.className, f: document.fonts.status });
      if (s !== last) { last = s; console.log(tag, Math.round(performance.now() - t0) + 'ms', s); }
    };
    const loop = () => { snap('frame'); if (performance.now() - t0 < 900) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) console.log('LS', Math.round(e.startTime) + 'ms', e.value.toFixed(4)); }).observe({ type: 'layout-shift', buffered: true });
    new MutationObserver((ms) => { for (const m of ms) { const n = m.target; console.log('MUT', Math.round(performance.now() - t0) + 'ms', m.type, (n.nodeType === 1 ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '') : n.nodeName), m.attributeName || ''); } })
      .observe(document, { subtree: true, attributes: true, childList: true, characterData: false, attributeFilter: ['class', 'style', 'hidden', 'data-theme', 'lang'] });
  });
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await aide.attendre(page, 1500);
  await ctx.close(); await aide.arreterNavigateur(); await aide.arreterServeur();
})();
