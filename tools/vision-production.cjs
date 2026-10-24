/* ─────────────────────────────────────────────────────────────────────────────
   VISION DE LA PRODUCTION — bureau et téléphone

   On regarde, on ne corrige pas. Le but est de voir ce que l'utilisateur
   voit, avant de decider quoi que ce soit.

   Pour chaque page et chaque format, on capture :
   - la page entiere, en entier ;
   - le pied de page, rapproche.

   Usage : node tools/vision-production.cjs [url]
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { chromium } = require('playwright');

const SITE = process.argv[2] || 'https://claimyourjob.fr';
const SORTIE = path.join(__dirname, '..', 'captures', 'vision');

const PAGES = [
  { nom: 'accueil', url: '/' },
  { nom: 'board', url: '/job-board.html' },
  { nom: 'entreprises', url: '/claim-entreprises.html' },
  { nom: 'observatoire', url: '/claim-observatoire.html' },
  { nom: 'a-propos', url: '/a-propos.html' },
  { nom: 'cgu', url: '/cgu.html' },
  { nom: 'confidentialite', url: '/confidentialite.html' },
  { nom: 'contact', url: '/contact.html' },
];

const FORMATS = [
  { nom: 'bureau', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { nom: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch();

  for (const format of FORMATS) {
    console.log(`\n${'═'.repeat(70)}\n  ${format.nom.toUpperCase()} (${format.viewport.width}×${format.viewport.height})\n${'═'.repeat(70)}`);

    const ctx = await nav.newContext({
      viewport: format.viewport,
      isMobile: format.isMobile,
      hasTouch: format.hasTouch,
      locale: 'fr-FR',
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    for (const p of PAGES) {
      await page.goto(SITE + p.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2800);

      /* On retire le bandeau de consentement : il masque le bas des pages
         et n'a rien a voir avec ce qu'on cherche a voir. */
      await page.evaluate(() => {
        const b = document.querySelector('#claim-consentement');
        if (b) b.remove();
      });
      await page.waitForTimeout(250);

      /* L'etat du pied, mesure. */
      const etat = await page.evaluate(() => {
        const ft = document.querySelector('footer#ft, footer.pied');
        if (!ft) return { present: false };

        const r = ft.getBoundingClientRect();
        const st = getComputedStyle(ft);

        /* Est-il visible a l'ecran ? On regarde ce que l'utilisateur voit. */
        let cacheur = null;
        let n = ft.parentElement;
        while (n && n !== document.documentElement) {
          const s = getComputedStyle(n);
          if (s.display === 'none' || n.hasAttribute('hidden')) {
            cacheur = n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') +
              (n.hasAttribute('hidden') ? '[hidden]' : '');
            break;
          }
          n = n.parentElement;
        }

        /* La position dans le flux : y vaut -1 si l'element est sorti du
           flux (position absolute/fixed). */
        const dansLeFlux = st.position !== 'absolute' && st.position !== 'fixed';

        const logo = ft.querySelector('.ft-logo, .logo');
        const rl = logo ? logo.getBoundingClientRect() : null;

        return {
          present: true,
          cacheur,
          visible: r.height > 0 && st.display !== 'none' && st.visibility === 'visible',
          h: Math.round(r.height),
          w: Math.round(r.width),
          x: Math.round(r.x),
          y: Math.round(r.y),
          fond: st.backgroundColor,
          align: st.alignItems,
          display: st.display,
          dansLeFlux,
          logoX: rl ? Math.round(rl.x) : null,
          logoTexte: logo ? (logo.textContent || '').trim() : null,
          nbLiens: ft.querySelectorAll('a').length,
          scrollH: document.documentElement.scrollHeight,
          scrollY: Math.round(window.scrollY),
        };
      });

      /* La capture du pied : on defile jusqu'a lui. */
      await page.evaluate(() => {
        const ft = document.querySelector('footer#ft, footer.pied');
        if (ft) ft.scrollIntoView({ block: 'end' });
      });
      await page.waitForTimeout(700);

      const pied = await page.evaluate(() => {
        const ft = document.querySelector('footer#ft, footer.pied');
        if (!ft) return null;
        const r = ft.getBoundingClientRect();
        return {
          x: 0,
          y: Math.max(0, Math.round(r.y) - 10),
          width: window.innerWidth,
          height: Math.min(Math.round(r.height) + 20, window.innerHeight),
          onEcran: r.height > 0,
        };
      });

      if (pied && pied.onEcran) {
        await page.screenshot({
          path: path.join(SORTIE, `${format.nom}-${p.nom}-pied.png`),
          clip: pied,
        });
      } else {
        await page.screenshot({
          path: path.join(SORTIE, `${format.nom}-${p.nom}-pied.png`),
        });
      }

      const etatLisible = etat.present
        ? `h=${String(etat.h).padStart(3)}px w=${etat.w} x=${etat.x} fond=${etat.fond} ` +
          `logoX=${etat.logoX} ${etat.nbLiens} lien(s)` +
          (etat.cacheur ? ` [MASQUÉ PAR ${etat.cacheur}]` : '')
        : 'ABSENT';

      console.log(`  ${p.nom.padEnd(16)} ${etatLisible}`);
    }

    await ctx.close();
  }

  await nav.close();
  console.log(`\nCaptures dans ${SORTIE}`);
})();
