/* Vérification en PRODUCTION de la pastille de filtre.
 *
 * C'est là que l'utilisateur voit le problème : le serveur de test simule
 * la production, il peut se tromper. Ce script teste le site réel.
 */
'use strict';

const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const SITE = process.argv[2] || 'https://claimyourjob.fr';

(async () => {
  const nav = await chromium.launch();

  for (const theme of ['jour', 'nuit']) {
    const ctx = await nav.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
    });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('claim-theme-v2', t); } catch (e) {}
    }, theme);

    const page = await ctx.newPage();
    try {
      for (const [nomPage, url, sel] of [
        ['board', '/job-board.html', '#contract-filter'],
        ['accueil', '/index.html', '#acc-contrat'],
      ]) {
        await page.goto(SITE + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3500);

        const z = await page.evaluate((c) => {
          const el = document.querySelector(c);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }, sel);
        if (!z) { console.log(`  ${theme}/${nomPage} : pastille introuvable`); continue; }

        const lire = () => page.evaluate((c) => {
          const el = document.querySelector(c);
          const st = getComputedStyle(el);
          return {
            fond: st.backgroundColor,
            position: st.backgroundPosition,
            repetition: st.backgroundRepeat,
            couleur: st.color,
            bordure: st.borderTopColor,
            ombre: st.boxShadow,
            trait: (/stroke='%23([0-9a-f]{6})'/i.exec(st.backgroundImage) || [])[1] || null,
          };
        }, sel);

        const a = await lire();
        await page.mouse.move(z.x + z.w / 2, z.y + z.h / 2);
        await page.waitForTimeout(450);
        const b = await lire();

        /* La fleche : pixels du trait dans la zone droite de la pastille,
           et dans la zone gauche (la ou elle NE doit pas etre). */
        const mesurer = async () => {
          const buf = await page.screenshot({ clip: { x: z.x, y: z.y, width: z.w, height: z.h } });
          const img = PNG.sync.read(buf);
          const cible = theme === 'nuit' ? [139, 154, 160] : [81, 95, 120];
          let droite = 0, gauche = 0;
          for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
              const i = (y * img.width + x) * 4;
              const proche =
                Math.abs(img.data[i] - cible[0]) < 30 &&
                Math.abs(img.data[i + 1] - cible[1]) < 30 &&
                Math.abs(img.data[i + 2] - cible[2]) < 30;
              if (!proche) continue;
              if (x >= z.w - 26) droite++;
              else if (x < 26) gauche++;
            }
          }
          return { droite, gauche };
        };

        const mRepos = await mesurer();
        await page.mouse.move(z.x + z.w / 2, z.y + z.h / 2);
        await page.waitForTimeout(200);
        const mSurvol = await mesurer();

        const lum = (hex) => {
          const v = [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16) / 255);
          const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
          return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
        };
        const ratio = (x, y) => {
          const lx = lum(x), ly = lum(y);
          return (Math.max(lx, ly) + 0.05) / (Math.min(lx, ly) + 0.05);
        };
        const hex = (s) => {
          const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s || '');
          return m ? '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('') : null;
        };

        const contrasteFleche = a.trait && hex(a.fond)
          ? ratio('#' + a.trait, hex(a.fond)) : null;

        console.log(`\n  ── ${theme} / ${nomPage} (${sel}) ──`);
        console.log(`  fond       : ${a.fond} -> ${b.fond}`);
        console.log(`  texte      : ${a.couleur} -> ${b.couleur}`);
        console.log(`  bordure    : ${a.bordure} -> ${b.bordure}`);
        console.log(`  ombre      : ${b.ombre === 'none' ? 'AUCUNE' : 'presente'}`);
        console.log(`  fleche pos : ${a.position === b.position ? 'STABLE' : `${a.position} -> ${b.position}`}`);
        console.log(`  fleche rep : ${a.repetition === b.repetition ? 'STABLE' : `${a.repetition} -> ${b.repetition}`}`);
        console.log(`  fleche px  : repos droite ${mRepos.droite} gauche ${mRepos.gauche} | ` +
          `survol droite ${mSurvol.droite} gauche ${mSurvol.gauche}` +
          `${mSurvol.gauche > 60 ? '  ← REPETEE' : ''}`);
        if (contrasteFleche) {
          console.log(`  contraste du trait : ${contrasteFleche.toFixed(2)} ` +
            `${contrasteFleche >= 3 ? 'OK' : 'TROP FAIBLE'}`);
        }
      }
    } finally {
      await ctx.close();
    }
  }

  await nav.close();
})();
