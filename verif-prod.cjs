/* Vérification finale en PRODUCTION — le pied du 23 octobre, partout.
 * Bureau et téléphone.
 */
'use strict';

const { chromium } = require('playwright');

const SITE = 'https://claimyourjob.fr';
const PAGES = [
  ['accueil', '/'],
  ['board', '/job-board.html'],
  ['entreprises', '/claim-entreprises.html'],
  ['observatoire', '/claim-observatoire.html'],
  ['a-propos', '/a-propos.html'],
  ['cgu', '/cgu.html'],
  ['confidentialite', '/confidentialite.html'],
  ['contact', '/contact.html'],
];
const FORMATS = [
  { nom: 'BUREAU', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { nom: 'PHONE', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

(async () => {
  const nav = await chromium.launch();

  for (const fmt of FORMATS) {
    console.log(`\n${'═'.repeat(70)}\n  ${fmt.nom} — production réelle\n${'═'.repeat(70)}`);
    const ctx = await nav.newContext({
      viewport: fmt.viewport, isMobile: fmt.isMobile, hasTouch: fmt.hasTouch, locale: 'fr-FR',
    });
    const page = await ctx.newPage();

    for (const [nom, url] of PAGES) {
      await page.goto(SITE + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        const b = document.querySelector('#claim-consentement');
        if (b) b.remove();
      });

      const e = await page.evaluate(() => {
        const ft = document.querySelector('footer#ft');
        if (!ft) return { present: false };
        const st = getComputedStyle(ft);
        const r = ft.getBoundingClientRect();

        let cacheur = null, n = ft.parentElement;
        while (n && n !== document.documentElement) {
          const s = getComputedStyle(n);
          if (s.display === 'none' || n.hasAttribute('hidden')) {
            cacheur = n.tagName.toLowerCase() + (n.id ? '#' + n.id : '');
            break;
          }
          n = n.parentElement;
        }

        /* On défile : la colonne du board, ou la page. */
        const pl = document.querySelector('.pl');
        if (pl) pl.scrollTop = pl.scrollHeight;
        else {
          document.documentElement.style.scrollBehavior = 'auto';
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
        const r2 = ft.getBoundingClientRect();

        const logo = ft.querySelector('.ft-logo');
        const rl = logo ? logo.getBoundingClientRect() : null;

        return {
          present: true,
          fond: st.backgroundColor,
          h: Math.round(r2.height),
          logoX: rl ? Math.round(rl.x) : null,
          liens: ft.querySelectorAll('a').length,
          cacheur,
          atteint: r2.top < window.innerHeight && r2.bottom > 0,
        };
      });

      const etat = !e.present ? 'ABSENT'
        : `h=${String(e.h).padStart(3)} liens=${e.liens} logoX=${String(e.logoX).padStart(3)} ` +
          `fond=${e.fond}` +
          (e.cacheur ? ` [MASQUÉ PAR ${e.cacheur}]` : '') +
          (e.atteint ? ' ✓' : ' [hors écran]');

      console.log(`  ${nom.padEnd(17)} ${etat}`);
    }

    await ctx.close();
  }

  await nav.close();
})();
