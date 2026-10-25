const aide = require('./aide-parcours.cjs');
const survol = require('./mesures-survol.cjs');
(async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();
  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil:'domcontentloaded' });
      await aide.attendre(page, 1800);
      await page.evaluate(() => { const b=document.querySelector('#claim-consentement'); if(b) b.remove(); });
      const carte = page.locator('#feed .jc, #feed .oc').first();
      if (await carte.count()) { await carte.click(); await aide.attendre(page, 1800); }

      await survol.preparerSurvol(page);
      const infos = await page.evaluate(() => window.__SURVOL__.elementsInteractifs()
        .filter(e => e.chemin && e.chemin.includes('.jc'))
        .map(e => ({ id: e.id, x: e.x, y: e.y, texte: e.texte })));
      const info = infos[0];
      const cible = `[data-survol="${info.id}"]`;
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      const avant = await page.evaluate((c) => window.__SURVOL__.relever(document.querySelector(c)), cible);
      await page.mouse.move(info.x, info.y);
      await page.waitForTimeout(300);
      const apres = await page.evaluate((c) => window.__SURVOL__.relever(document.querySelector(c)), cible);
      console.log('AVANT  transform:', avant.transform);
      console.log('APRES  transform:', apres.transform);
      console.log('AVANT  borderTop:', await page.evaluate((c) => getComputedStyle(document.querySelector(c)).borderTopColor + ' ' + getComputedStyle(document.querySelector(c)).borderTopWidth, cible));
      console.log('APRES  borderTop:', await page.evaluate((c) => {
        const el = document.querySelector(c);
        el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
        const s = getComputedStyle(el);
        return s.borderTopColor + ' ' + s.borderTopWidth + ' | transform=' + s.transform;
      }, cible));
      const i = survol.intensite({ avant, apres });
      console.log('intensite:', JSON.stringify({ dFond:i.dFond, dBord:i.dBord, dDecalage:i.dDecalage, change:i.change }));
    } finally { await ctx.close(); }
  } finally {
    await aide.arreterNavigateur(); await aide.arreterServeur();
  }
})();
