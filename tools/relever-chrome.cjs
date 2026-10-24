/* ─────────────────────────────────────────────────────────────────────────────
   RELEVÉ DE L'EN-TÊTE ET DU PIED — toutes pages, bureau et téléphone

   L'en-tête de référence est celui de l'accueil ; le pied de référence est
   celui du board. On veut savoir, page par page, ce qui s'en approche — et
   ce qui s'en écarte.

   Ce script NE corrige rien. Il relève, et il capture. La correction vient
   après, à partir de ce que le relevé montre.

   Usage : node tools/relever-chrome.cjs
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const aide = require('../tests/aide-parcours.cjs');

const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'captures', 'chrome');

const PAGES = [
  { nom: 'accueil', url: '/index.html', refEntete: true },
  { nom: 'board', url: '/job-board.html', refPied: true },
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

/**
 * L'empreinte d'un en-tête ou d'un pied : ce qui doit être IDENTIQUE
 * d'une page à l'autre si l'élément est la référence.
 */
async function empreinte(page, selecteur) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { present: false };

    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    let fond = st.backgroundColor;
    const image = st.backgroundImage;
    if (image && image !== 'none' && /gradient/.test(image)) {
      const c = image.match(/rgba?\([^)]+\)/g) || [];
      if (c.length) fond = c[0];
    }

    const logo = el.querySelector('.logo, .ft-logo');
    const liens = Array.from(el.querySelectorAll('a')).map((a) => ({
      texte: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34),
      href: a.getAttribute('href'),
    }));

    const rLogo = logo ? logo.getBoundingClientRect() : null;

    /* Un element masque par un ancetre n'est pas affiche, meme si son
       style calcule est correct. */
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
      fond,
      position: st.position,
      hauteur: Math.round(r.height),
      largeur: Math.round(r.width),
      padding: st.paddingLeft,
      cacheur,
      logo: logo ? {
        tag: logo.tagName.toLowerCase(),
        href: logo.getAttribute('href'),
        texte: (logo.textContent || '').trim(),
        couleur: getComputedStyle(logo).color,
        taille: getComputedStyle(logo).fontSize,
        x: rLogo ? Math.round(rLogo.x) : null,
        y: rLogo ? Math.round(rLogo.y) : null,
      } : null,
      liens,
    };
  }, selecteur);
}

/* La comparaison avec la référence : ce qui diffère, nommé. */
function comparer(ref, page) {
  const ecarts = [];
  if (!ref) return ['la référence n\'a pas été relevée'];
  if (!ref.present) return ['la référence est absente'];
  if (!page.present) return ['ABSENT DE LA PAGE'];

  if (ref.balise !== page.balise) ecarts.push(`balise ${ref.balise} ≠ ${page.balise}`);
  if (ref.fond !== page.fond) ecarts.push(`fond ${ref.fond} ≠ ${page.fond}`);
  if (ref.position !== page.position) ecarts.push(`position ${ref.position} ≠ ${page.position}`);
  if (ref.cacheur) ecarts.push(`la référence est masquée par ${ref.cacheur}`);
  if (page.cacheur) ecarts.push(`MASQUÉE PAR ${page.cacheur}`);
  if (ref.largeur !== page.largeur) ecarts.push(`largeur ${ref.largeur} ≠ ${page.largeur}`);

  if (ref.logo && page.logo) {
    if (ref.logo.texte !== page.logo.texte) {
      ecarts.push(`logo « ${ref.logo.texte} » ≠ « ${page.logo.texte} »`);
    }
    if (ref.logo.couleur !== page.logo.couleur) {
      ecarts.push(`couleur du logo ${ref.logo.couleur} ≠ ${page.logo.couleur}`);
    }
    if (ref.logo.taille !== page.logo.taille) {
      ecarts.push(`taille du logo ${ref.logo.taille} ≠ ${page.logo.taille}`);
    }
    if (ref.logo.x !== page.logo.x) {
      ecarts.push(`position du logo x=${ref.logo.x} ≠ x=${page.logo.x}`);
    }
  }

  /* On compare les liens de NAVIGATION, pas tous les liens : le pied du
     board porte un lien Hunter de plus, et ce n'est pas un ecart. */
  const nav = (e) => e.liens.filter((l) => l.href && l.href.startsWith('/') &&
    !l.href.includes('hunter')).map((l) => l.texte + '→' + l.href).join(' | ');
  if (nav(ref) !== nav(page)) {
    ecarts.push(`liens : [${nav(ref)}] ≠ [${nav(page)}]`);
  }

  return ecarts;
}

(async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    fs.mkdirSync(SORTIE, { recursive: true });

    for (const format of FORMATS) {
      console.log(`\n${'═'.repeat(72)}\n  ${format.nom.toUpperCase()} (${format.viewport.width}×${format.viewport.height})\n${'═'.repeat(72)}`);

      const refEntete = {};
      const refPied = {};

      /* L'accueil porte l'en-tete de reference, le board le pied de
         reference : ils sont releves EN PREMIER. */
      const ordre = [
        ...PAGES.filter((p) => p.refEntete),
        ...PAGES.filter((p) => p.refPied),
        ...PAGES.filter((p) => !p.refEntete && !p.refPied),
      ];

      for (const p of ordre) {
        const { ctx, page } = await aide.ouvrirPage(format);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1400);

          await page.evaluate(() => {
            const b = document.querySelector('#claim-consentement');
            if (b) b.remove();
          });
          await page.waitForTimeout(200);

          const entete = await empreinte(page, 'header#hd, header.hd');
          const pied = await empreinte(page, 'footer#ft, footer.pied');

          if (p.refEntete) refEntete[format.nom] = entete;
          if (p.refPied) refPied[format.nom] = pied;

          const ecartsEntete = p.refEntete ? [] : comparer(refEntete[format.nom], entete);
          const ecartsPied = p.refPied ? [] : comparer(refPied[format.nom], pied);

          /* Les captures. */
          const haut = await page.evaluate(() => {
            const el = document.querySelector('header#hd, header.hd');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: 0, y: 0, width: window.innerWidth, height: Math.min(r.height + 16, window.innerHeight) };
          });
          if (haut) {
            await page.screenshot({ path: path.join(SORTIE, `${format.nom}-${p.nom}-entete.png`), clip: haut });
          }

          const bas = await page.evaluate(() => {
            const el = document.querySelector('footer#ft, footer.pied');
            if (!el) return null;
            el.scrollIntoView({ block: 'end' });
            const r = el.getBoundingClientRect();
            return {
              x: 0,
              y: Math.max(0, Math.round(r.y) - 8),
              width: window.innerWidth,
              height: Math.min(Math.round(r.height) + 16, window.innerHeight),
            };
          });
          if (bas) {
            await page.screenshot({ path: path.join(SORTIE, `${format.nom}-${p.nom}-pied.png`), clip: bas });
          }

          console.log(`\n  ── ${p.nom} ──`);
          console.log(`    en-tête : ${entete.present
            ? `${entete.balise} fond ${entete.fond} y=${entete.logo ? entete.logo.y : '—'} taille ${entete.largeur}x${entete.hauteur}` +
              (entete.cacheur ? ` [MASQUÉ PAR ${entete.cacheur}]` : '')
            : 'ABSENT'}`);
          if (ecartsEntete.length) {
            console.log('    ✖ ÉCART EN-TÊTE :');
            for (const e of ecartsEntete) console.log('        ' + e);
          }
          console.log(`    pied    : ${pied.present
            ? `${pied.balise} fond ${pied.fond} ${pied.largeur}x${pied.hauteur}` +
              (pied.cacheur ? ` [MASQUÉ PAR ${pied.cacheur}]` : '')
            : 'ABSENT'}`);
          if (ecartsPied.length) {
            console.log('    ✖ ÉCART PIED :');
            for (const e of ecartsPied) console.log('        ' + e);
          }
        } finally {
          await ctx.close();
        }
      }
    }

    console.log(`\nCaptures dans ${SORTIE}`);
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
})();
