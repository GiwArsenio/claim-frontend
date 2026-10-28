/* Régression de composition du board, distincte de l'alignement de l'axe gauche.
 * L'ancien test ne voyait que l'axe .pl; il ne détectait pas le volet droit
 * arrêté avant la limite du conteneur produit, laissant une bande vide.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const aide = require('./aide-parcours.cjs');

function rect(page, selector) {
  return page.evaluate(s => { const el = document.querySelector(s); if (!el) return null;
    const r = el.getBoundingClientRect();
    return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom}; }, selector);
}
test('board : la surface de fiche occupe la largeur produit sans étirer le texte', async t => {
  const ownServer = !process.env.CLAIM_BASE;
  if (ownServer) await aide.demarrerServeur();
  const base = process.env.CLAIM_BASE || aide.baseTests();
  const browser = await chromium.launch();
  t.after(async () => { await browser.close(); if (ownServer) await aide.arreterServeur(); });
  for (const w of [1024,1280,1440,1885,1920,2560]) {
    await t.test(`${w}px`, async () => {
      const p = await browser.newPage({viewport:{width:w,height:900}});
      try {
        await p.goto(base+'/job-board.html',{waitUntil:'domcontentloaded'});
        // Existing layout is CSS-driven; the detail card is populated asynchronously.
        await p.waitForSelector('.dc',{timeout:15000});
        const split=await rect(p,'#split'), list=await rect(p,'.pl'), panel=await rect(p,'.pr'), card=await rect(p,'.dc');
        const end=split.right-parseFloat(await p.locator('#split').evaluate(el => getComputedStyle(el).paddingRight));
        assert.ok(Math.abs(panel.right-end)<=2, `volet arrêté à ${panel.right}, axe droit produit ${end}`);
        assert.ok(Math.abs(panel.left-list.right)<=2,'la fiche commence après la liste');
        // La carte remplit le volet jusqu'a son plafond (70rem). Elle ne
        // doit ni flotter au milieu (59 % avant correction) ni s'etirer
        // sans fin sur un ecran tres large.
        assert.ok(card.width<=1121,'la carte garde un plafond');
        const ratio=card.width/panel.width;
        assert.ok(ratio>=0.85,`la carte occupe au moins 85 % du volet (lu : ${(ratio*100).toFixed(1)} %)`);
        const leftGap=card.left-panel.left, rightGap=panel.right-card.right;
        assert.ok(Math.abs(leftGap-rightGap)<=2, `fiche décentrée dans son volet : ${leftGap}/${rightGap}`);
        assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth+1));
      } finally { await p.close(); }
    });
  }
  for (const w of [390,768]) {
    await t.test(`mobile ${w}px`, async () => {
      const p=await browser.newPage({viewport:{width:w,height:844}});
      try {
        await p.goto(base+'/job-board.html',{waitUntil:'domcontentloaded'});
        const list=await rect(p,'.pl');
        assert.ok(Math.abs(list.width-w)<2,'la liste garde toute la largeur');
        assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth+1));
      } finally {await p.close();}
    });
  }
});
