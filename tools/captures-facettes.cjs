#!/usr/bin/env node
/* Captures des facettes : panneau ouvert, jour et nuit, bureau et mobile. */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const aide = require('../tests/aide-parcours.cjs');

(async () => {
  const dossier = process.argv[2] || '/tmp/facettes';
  fs.mkdirSync(dossier, { recursive: true });
  await aide.demarrerServeur();

  for (const [nom, format] of [['bureau', aide.FORMATS.bureau], ['phone', aide.FORMATS.phone]]) {
    for (const theme of ['jour', 'nuit']) {
      const { ctx, page } = await aide.ouvrirPage(format, { theme });
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#feed .jc');
      await aide.attendreChargementTermine(page).catch(() => {});

      // La bannière de consentement masque le bas : on l'écarte pour la capture.
      await page.evaluate(() => {
        document.querySelectorAll('#consentement, [class*="consent"]').forEach((e) => e.remove());
      });

      await page.click('#btn-contract');
      await page.waitForSelector('#pop-contract');
      await page.waitForTimeout(900);
      await page.check('#pop-contract input[value="cdi"]');
      await page.check('#pop-contract input[value="stage"]');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(dossier, `${nom}-${theme}-panneau.png`) });

      await page.click('#pop-contract .fpop-ok');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(dossier, `${nom}-${theme}-applique.png`) });
      await ctx.close();
    }
  }

  await aide.arreterNavigateur();
  await aide.arreterServeur();
  console.log('captures dans ' + dossier);
})();
