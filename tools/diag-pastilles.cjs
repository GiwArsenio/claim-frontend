/* Diagnostic temporaire (branche design/diag-pastilles, jamais fusionnée). */
const aide = require('../tests/aide-parcours.cjs');
(async () => {
  await aide.demarrerServeur(); const nav = await aide.demarrerNavigateur();
  console.log('Chromium', nav.version());
  for (const w of [320, 340, 350, 360, 375, 390, 414, 430, 600, 768, 900, 1024, 1100, 1180, 1280, 1440]) {
    const mobile = w < 768;
    const { ctx, page } = await aide.ouvrirPage({ viewport: { width: w, height: 900 }, isMobile: mobile, hasTouch: mobile });
    await page.route('**/stats/published*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jobs_online: 1243, companies_hiring: 58, sources_tracked: 61, last_collection_at: '2026-11-22T03:04:00Z', generated_at: '2026-11-22T07:30:00+00:00', by_specialty: { actuariat: 312, souscription_technique: 140, ia_data: 205 }, classified_jobs: 657 }) }));
    await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await aide.attendre(page, 1800);
    const r = await page.evaluate(() => {
      const li = [...document.querySelectorAll('.releve-pastilles li')];
      return { police: document.fonts.check('16px Inter'), lignes: new Set(li.map((e) => Math.round(e.getBoundingClientRect().top))).size,
        pastilles: li.map((e) => `${e.textContent.trim().replace(/\s+/g, ' ')}: ${e.scrollWidth}/${e.clientWidth}`), taille: getComputedStyle(li[0]).fontSize };
    });
    const coupees = r.pastilles.filter((p) => { const [a, b] = p.split(': ')[1].split('/').map(Number); return a > b + 1; });
    console.log(String(w).padStart(5), 'px', 'Inter', r.police, 'lignes', r.lignes, 'police', r.taille, '| coupées:', coupees.length ? coupees.join(' ; ') : 'aucune', '| tout:', r.pastilles.join(' ; '));
    await ctx.close();
  }
  await aide.arreterNavigateur(); await aide.arreterServeur();
})();
