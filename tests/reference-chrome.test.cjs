/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A08 (suite) — L'en-tête et le pied sont LA RÉFÉRENCE

   L'en-tête de référence est celui de l'ACCUEIL. Le pied de référence est
   celui du BOARD. Le test le vérifie page par page, en bureau et en
   téléphone, en comparant ce que l'utilisateur voit :

   - la balise sémantique : <header> et <footer> ;
   - le fond, la position, la taille ;
   - la position et la couleur du logo ;
   - les liens de navigation, et leurs destinations ;
   - et surtout : que l'élément ne soit pas masqué par un ancêtre.

   Ce dernier point est celui qui a failli passer. Un <footer> dans un
   <div hidden> a un style calculé parfaitement correct — le fond est le
   bon, la taille est bonne — et ne s'affiche pas. Un test qui compare
   des styles calculés passe ; un test qui regarde ce qui est visible,
   non.

   Le test est rouge avant les corrections, vert après. C'est ce qui
   empêche la régression.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

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
  { nom: 'bureau', format: 'bureau' },
  { nom: 'phone', format: 'phone' },
];

/**
 * L'empreinte d'un en-tête ou d'un pied, et ce qui doit être identique.
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
    const rLogo = logo ? logo.getBoundingClientRect() : null;

    /* Un élément masqué par un ancêtre a un style calculé correct et ne
       s'affiche pas. C'est le piège principal de cette famille. */
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
      largeur: Math.round(r.width),
      hauteur: Math.round(r.height),
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
        .map((a) => (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) +
          '→' + a.getAttribute('href')),
    };
  }, selecteur);
}

/* La comparaison, énoncée en écarts nommés. */
function ecarts(ref, page) {
  const out = [];
  if (!ref) return ['référence absente'];
  if (!page.present) return ['ABSENT DE LA PAGE'];
  if (page.cacheur) out.push(`MASQUÉ PAR ${page.cacheur}`);
  if (ref.balise !== page.balise) out.push(`balise ${ref.balise} ≠ ${page.balise}`);
  if (ref.fond !== page.fond) out.push(`fond ${ref.fond} ≠ ${page.fond}`);
  if (ref.position !== page.position) out.push(`position ${ref.position} ≠ ${page.position}`);
  if (ref.largeur !== page.largeur) out.push(`largeur ${ref.largeur} ≠ ${page.largeur}`);
  if (ref.hauteur !== page.hauteur) out.push(`hauteur ${ref.hauteur} ≠ ${page.hauteur}`);
  if (ref.logo && page.logo) {
    if (ref.logo.couleur !== page.logo.couleur) {
      out.push(`couleur du logo ${ref.logo.couleur} ≠ ${page.logo.couleur}`);
    }
    if (ref.logo.x !== page.logo.x) out.push(`logo à x=${ref.logo.x} ≠ x=${page.logo.x}`);
  }
  const lr = ref.liens.join(' | ');
  const lp = page.liens.join(' | ');
  if (lr !== lp) out.push(`liens : [${lr}] ≠ [${lp}]`);
  return out;
}

test('A08 — l\'en-tête est identique à celui de l\'accueil, partout', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const f of FORMATS) {
      await t.test(f.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS[f.format]);
        try {
          await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1400);
          const ref = await empreinte(page, 'header#hd, header.hd');

          const ecartsVus = [];

          for (const p of PAGES) {
            if (p.nom === 'accueil') continue;

            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1400);

            const e = await empreinte(page, 'header#hd, header.hd');
            const ec = ecarts(ref, e);
            if (ec.length) ecartsVus.push({ page: p.nom, ecarts: ec });
          }

          assert.deepEqual(
            ecartsVus, [],
            `${f.nom} : ${ecartsVus.length} en-tête(s) diffèrent de la référence (l'accueil) — ` +
            JSON.stringify(ecartsVus)
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A08 — le pied est identique à celui du board, partout', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const f of FORMATS) {
      await t.test(f.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS[f.format]);
        try {
          await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1400);
          const ref = await empreinte(page, 'footer#ft, footer.pied');

          const ecartsVus = [];

          for (const p of PAGES) {
            if (p.nom === 'board') continue;

            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1400);

            const e = await empreinte(page, 'footer#ft, footer.pied');
            const ec = ecarts(ref, e);
            if (ec.length) ecartsVus.push({ page: p.nom, ecarts: ec });
          }

          assert.deepEqual(
            ecartsVus, [],
            `${f.nom} : ${ecartsVus.length} pied(s) diffèrent de la référence (le board) — ` +
            JSON.stringify(ecartsVus)
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A08 — l\'en-tête est en haut de page, et visible', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1400);

          const etat = await page.evaluate(() => {
            const el = document.querySelector('header#hd, header.hd');
            if (!el) return { present: false };
            const r = el.getBoundingClientRect();
            return {
              present: true,
              y: Math.round(r.y),
              h: Math.round(r.height),
              visible: r.height > 0 && getComputedStyle(el).display !== 'none',
            };
          });

          assert.ok(etat.present, `${p.nom} : pas d'en-tête`);
          assert.ok(etat.visible, `${p.nom} : l'en-tête n'est pas visible`);
          assert.ok(
            etat.y < 40,
            `${p.nom} : l'en-tête est à y=${etat.y} — il est sous le contenu de la page, ` +
            `et non en haut. Un en-tête doit être en haut, toujours.`
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
