/* Diagnostic temporaire (branche design/diag-cls, jamais fusionnée). */
const aide = require('../tests/aide-parcours.cjs');
(async () => {
  await aide.demarrerServeur(); const nav = await aide.demarrerNavigateur();
  console.log('Chromium', nav.version(), '| Playwright', require('playwright/package.json').version);
  for (const [nom, format] of [['bureau', aide.FORMATS.bureau], ['phone', aide.FORMATS.phone]]) {
    for (const mode of ['police-bloquee', 'normal']) {
      for (let i = 0; i < 4; i++) {
        const { ctx, page } = await aide.ouvrirPage(format);
        if (mode === 'police-bloquee') await page.route('**/assets/polices/*.woff2', (r) => r.abort());
        await page.addInitScript(() => { window.__e = [];
          new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue;
            window.__e.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime),
              hero: (e.sources || []).some((s) => s.node && s.node.closest && s.node.closest('.hero')),
              src: (e.sources || []).map((s) => { const n = s.node; return n && n.nodeType === 1 ? n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '') + ' ' + JSON.stringify(s.previousRect) + '->' + JSON.stringify(s.currentRect) : '?'; }) }); } }).observe({ type: 'layout-shift', buffered: true }); });
        await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
        await aide.attendre(page, 2000);
        const e = await page.evaluate(() => window.__e);
        const hero = e.filter((x) => x.hero).reduce((a, x) => a + x.v, 0);
        console.log(`${nom} ${mode} #${i} hero=${hero.toFixed(4)}`);
        e.filter((x) => x.hero).forEach((x) => console.log('   ', JSON.stringify(x)));
        await ctx.close();
      }
    }
  }
  await aide.arreterNavigateur(); await aide.arreterServeur();
})();
