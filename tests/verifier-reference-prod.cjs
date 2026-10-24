/* Vérification finale en PRODUCTION : l'en-tête et le pied, sur le site réel.
 *
 * C'est là que l'utilisateur voit le problème. Le serveur de test simule
 * la production ; il peut se tromper.
 *
 * Usage : node tests/verifier-reference-prod.cjs
 */
'use strict';

const { chromium } = require('playwright');

const SITE = process.argv[2] || 'https://claimyourjob.fr';

const PAGES = [
  { nom: 'accueil', url: '/index.html' },
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

async function empreinte(page, selecteur) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { present: false };
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const logo = el.querySelector('.logo, .ft-logo');
    const rLogo = logo ? logo.getBoundingClientRect() : null;

    let n = el.parentElement, cacheur = null;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || n.hasAttribute('hidden')) {
        cacheur = n.tagName.toLowerCase() + (n.id ? '#' + n.id : '');
        break;
      }
      n = n.parentElement;
    }

    return {
      present: true,
      balise: el.tagName.toLowerCase(),
      fond: st.backgroundColor,
      position: st.position,
      largeur: Math.round(r.width),
      hauteur: Math.round(r.height),
      y: Math.round(r.y),
      cacheur,
      logo: logo ? {
        texte: (logo.textContent || '').trim(),
        href: logo.getAttribute('href'),
        couleur: getComputedStyle(logo).color,
        x: rLogo ? Math.round(rLogo.x) : null,
      } : null,
      liens: Array.from(el.querySelectorAll('a'))
        .filter((a) => a.getAttribute('href') && a.getAttribute('href').startsWith('/'))
        .filter((a) => !a.getAttribute('href').includes('hunter'))
        .map((a) => (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '→' + a.getAttribute('href')),
    };
  }, selecteur);
}

function ecarts(ref, page) {
  const out = [];
  if (!page.present) return ['ABSENT'];
  if (page.cacheur) out.push(`MASQUÉ PAR ${page.cacheur}`);
  if (ref.balise !== page.balise) out.push(`balise ${ref.balise} ≠ ${page.balise}`);
  if (ref.fond !== page.fond) out.push(`fond ${ref.fond} ≠ ${page.fond}`);
  if (ref.position !== page.position) out.push(`position ${ref.position} ≠ ${page.position}`);
  if (ref.largeur !== page.largeur) out.push(`largeur ${ref.largeur} ≠ ${page.largeur}`);
  if (ref.hauteur !== page.hauteur) out.push(`hauteur ${ref.hauteur} ≠ ${page.hauteur}`);
  if (ref.logo && page.logo) {
    if (ref.logo.couleur !== page.logo.couleur) out.push(`couleur logo ${ref.logo.couleur} ≠ ${page.logo.couleur}`);
    if (ref.logo.x !== page.logo.x) out.push(`logo x=${ref.logo.x} ≠ x=${page.logo.x}`);
  }
  const lr = ref.liens.join(' | '), lp = page.liens.join(' | ');
  if (lr !== lp) out.push(`liens : [${lr}] ≠ [${lp}]`);
  return out;
}

(async () => {
  const nav = await chromium.launch();
  let total = 0;

  for (const format of FORMATS) {
    console.log(`\n${'═'.repeat(70)}\n  ${format.nom.toUpperCase()} — production réelle\n${'═'.repeat(70)}`);

    const ctx = await nav.newContext({
      viewport: format.viewport,
      isMobile: format.isMobile,
      hasTouch: format.hasTouch,
      locale: 'fr-FR',
    });
    const page = await ctx.newPage();

    const rel = {};
    try {
      for (const p of PAGES) {
        await page.goto(SITE + p.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2500);
        await page.evaluate(() => {
          const b = document.querySelector('#claim-consentement');
          if (b) b.remove();
        });
        await page.waitForTimeout(200);

        rel[p.nom] = {
          entete: await empreinte(page, 'header#hd, header.hd'),
          pied: await empreinte(page, 'footer#ft, footer.pied'),
        };
      }

      /* L'accueil est la référence de l'en-tête, le board celle du pied. */
      const refE = rel['accueil'].entete;
      const refP = rel['board'].pied;

      for (const p of PAGES) {
        const ecE = ecarts(refE, rel[p.nom].entete);
        const ecP = ecarts(refP, rel[p.nom].pied);
        const e = rel[p.nom].entete, pi = rel[p.nom].pied;

        const enTeteOk = ecE.length === 0;
        const piedOk = ecP.length === 0;
        if (!enTeteOk || !piedOk) total++;

        console.log(`  ${enTeteOk ? '✔' : '✖'} ${p.nom.padEnd(16)} en-tête ${String(e.hauteur).padStart(3)}px y=${String(e.y).padStart(4)}  ` +
          `${enTeteOk ? 'identique' : 'ÉCART: ' + ecE.join(' · ')}`);
        console.log(`  ${piedOk ? '✔' : '✖'} ${''.padEnd(16)} pied    ${String(pi.hauteur).padStart(3)}px       ` +
          `${piedOk ? 'identique' : 'ÉCART: ' + ecP.join(' · ')}`);
      }
    } finally {
      await ctx.close();
    }
  }

  await nav.close();
  console.log(total === 0
    ? '\n  Aucun écart : en-tête et pied identiques à la référence, partout, en production.'
    : `\n  ${total} écart(s) en production.`);
})();
