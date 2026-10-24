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
      await page.evaluate(() => {
        const hd = document.querySelector('header#hd, header.hd');
        if (hd && hd.dataset.posAvant !== undefined) {
          hd.style.position = hd.dataset.posAvant;
          delete hd.dataset.posAvant;
        }
      });

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

      /* LA CAPTURE DU PIED.
         On capture l'ELEMENT lui-meme : Playwright gere le defilement, le
         cadrage et la mise a l'echelle. Calculer un clip a la main
         etait fragile — sur l'accueil, le clip attrapait l'en-tete, et la
         comparaison pixel par pixel comparait du teal a du blanc. */
      const rectPied = await page.evaluate(() => {
        const ft = document.querySelector('footer#ft, footer.pied');
        if (!ft) return null;
        const r = ft.getBoundingClientRect();
        return { x: r.x + window.scrollX, y: r.y + window.scrollY,
                 w: r.width, h: r.height };
      });

      const pied = rectPied ? {
        x: 0,
        y: Math.max(0, Math.round(rectPied.y) - 10),
        width: Math.min(rectPied.w, 1440),
        height: Math.round(rectPied.h) + 20,
        onEcran: rectPied.h > 0,
      } : null;

      /* On descend jusqu'EN BAS de la page, ET on neutralise l'en-tete
         collant pendant la capture.

         Playwright capture l'element dans le viewport. L'en-tete est
         collant (position: sticky) : il recouvre le haut du pied, et la
         capture attrapait du teal au lieu du pied. Sur l'accueil, la
         page defile de 1192 px, donc le pied passe sous l'en-tete ; sur
         les pages a chantier, elle ne defile que de 94 px, et le pied
         reste en dessous — d'ou des captures qui concordaient entre
         elles mais pas avec la reference.

         On retire donc l'en-tete du flux le temps de la capture. */
      await page.evaluate(() => {
        const de = document.documentElement;
        const av = de.style.scrollBehavior;
        de.style.scrollBehavior = 'auto';
        window.scrollTo(0, de.scrollHeight);

        const hd = document.querySelector('header#hd, header.hd');
        if (hd) { hd.dataset.posAvant = hd.style.position; hd.style.position = 'static'; }
        de.style.scrollBehavior = av;
      });
      await page.waitForTimeout(600);

      const elementPied = await page.$('footer.pied, footer#ft');
      /* L'en-tete est restaure juste apres la capture. */
      if (elementPied) {
        try {
          await elementPied.screenshot({
            path: path.join(SORTIE, `${format.nom}-${p.nom}-pied.png`),
          });
        } catch (e) {
          /* L'element n'a pas pu etre capture : on prend la page entiere. */
          await page.screenshot({
            path: path.join(SORTIE, `${format.nom}-${p.nom}-pied.png`),
            fullPage: true,
          });
        }
      } else {
        await page.screenshot({
          path: path.join(SORTIE, `${format.nom}-${p.nom}-pied.png`),
          fullPage: true,
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
