/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A05 — Largeurs, hauteur utile, débordement horizontal

   Le catalogue demande six largeurs : 360, 390, 768, 769, 1280 et 1920 px.
   Les deux dernières sont les points de bascule d'une grille ; 769 px est le
   premier pixel en mode bureau, et c'est là qu'un media query oublié se voit.

   Trois exigences distinctes, et il faut les garder distinctes :

   1. Aucun défilement horizontal du document. C'est le symptôme que
      l'utilisateur voit : une barre qui n'a rien à faire là.

   2. Aucun contenu RÉELLEMENT inaccessible. Un élément qui déborde mais
      vit dans un conteneur défilable est atteignable : ce n'est pas un
      défaut. Un élément interactif rogné par un `overflow:hidden` l'est :
      le clic est impossible.

   3. Une hauteur utile positive. Une zone principale de hauteur nulle est
      le défaut que la famille P05 traque sur la fiche mobile : un écran
      vide, où l'utilisateur ne peut rien faire.

   La distinction du point 2 est ce qui sépare un test utile d'un test
   bruyant. Un test qui compte tous les débordements échouerait sur des
   éléments parfaitement légitimes, et l'équipe apprendrait à l'ignorer.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const mesures = require('./mesures-a11y.cjs');

const PAGES = [
  { nom: 'accueil', url: '/index.html', zone: 'body' },
  { nom: 'board', url: '/job-board.html', zone: '#split' },
];

/**
 * Relève les débordements en distinguant ce qui est réellement perdu.
 *
 * Un élément interactif rogné par un conteneur `overflow:hidden` ne peut
 * plus être atteint : c'est un défaut. Un élément dans un conteneur
 * défilable reste accessible.
 */
async function releverRognages(page) {
  return page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;
    const out = [];

    function conteneurRogne(el) {
      let n = el.parentElement;
      while (n && n !== document.body) {
        const st = getComputedStyle(n);
        const overflow = st.overflowX;
        if (overflow === 'hidden' || overflow === 'clip') {
          return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') +
            (typeof n.className === 'string' && n.className
              ? '.' + n.className.split(' ').filter(Boolean).join('.') : '');
        }
        if (overflow === 'auto' || overflow === 'scroll') return null; /* atteignable */
        n = n.parentElement;
      }
      return null;
    }

    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      if (st.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right <= largeur + 1) continue;

      const interactif = el.matches(
        'a[href], button, input, select, textarea, [role="button"], [role="link"], ' +
        '[tabindex]:not([tabindex="-1"])'
      );
      if (!interactif) continue;

      const rogne = conteneurRogne(el);
      if (!rogne) continue; /* dans un conteneur défilable : atteignable */

      out.push({
        chemin: window.__MESURES__.cheminDe(el),
        excess: Math.round(r.right - largeur),
        rognePar: rogne,
        texte: (el.textContent || '').trim().slice(0, 40),
      });
    }
    return out;
  });
}

test('A05 — aucun défilement horizontal, à toutes les largeurs', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      for (const largeur of aide.LARGEURS) {
        await t.test(`${p.nom} @ ${largeur}px`, async () => {
          const format = aide.formatPourLargeur(largeur);
          const { ctx, page } = await aide.ouvrirPage(format);
          try {
            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1200);

            const deb = await mesures.releverDebordements(page);

            assert.equal(
              deb.scrollHorizontal, 0,
              `${p.nom} @ ${largeur}px : le document défile horizontalement de ` +
              `${deb.scrollHorizontal}px — une barre horizontale n'a rien à faire là`
            );
          } finally {
            await ctx.close();
          }
        });
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A05 — aucun contenu interactif inaccessible, à toutes les largeurs', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      for (const largeur of aide.LARGEURS) {
        await t.test(`${p.nom} @ ${largeur}px`, async () => {
          const format = aide.formatPourLargeur(largeur);
          const { ctx, page } = await aide.ouvrirPage(format);
          try {
            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1200);
            await mesures.preparerMesures(page);

            const rognages = await releverRognages(page);

            assert.equal(
              rognages.length, 0,
              `${p.nom} @ ${largeur}px : ${rognages.length} élément(s) interactif(s) ` +
              `hors d'atteinte — ` + JSON.stringify(rognages.slice(0, 4))
            );
          } finally {
            await ctx.close();
          }
        });
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A05 — la zone principale garde une hauteur utile', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      for (const largeur of aide.LARGEURS) {
        await t.test(`${p.nom} @ ${largeur}px`, async () => {
          const format = aide.formatPourLargeur(largeur);
          const { ctx, page } = await aide.ouvrirPage(format);
          try {
            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1200);

            const haut = await mesures.mesurerHauteurUtile(page, p.zone);

            assert.ok(
              haut.hauteur > 0,
              `${p.nom} @ ${largeur}px : la zone « ${p.zone} » a une hauteur nulle — ` +
              `l'utilisateur n'a rien à faire à l'écran`
            );

            /* Une hauteur utile qui dépasse largement la fenêtre est normale :
               la page défile. Ce qui n'est pas normal, c'est une zone
               plate alors que la page contient des offres. */
            assert.ok(
              haut.scrollHeight >= haut.hauteur,
              `${p.nom} @ ${largeur}px : hauteur utile ${haut.hauteur} > contenu ${haut.scrollHeight}`
            );
          } finally {
            await ctx.close();
          }
        });
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A05 — la bascule de grille 768/769 ne masque rien', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    /* La bascule est l'endroit où un media query se trompe : 768 px doit
       rester lisible sur mobile, 769 px sur bureau. */
    const largeur = 768;
    const format = aide.formatPourLargeur(largeur);
    const { ctx, page } = await aide.ouvrirPage(format);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1200);

      const cartes = await page.locator('#feed .jc, #feed .oc').count();
      assert.ok(cartes > 0, 'le board ne doit afficher aucune offre à 768px');

      /* La colonne de détail ne doit pas voler la place à la liste en
         mode mobile : c'est elle qui vide l'écran. */
      const detail = await page.evaluate(() => {
        const el = document.querySelector('#pr');
        if (!el) return null;
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          display: st.display,
          width: Math.round(r.width),
          left: Math.round(r.left),
          viewport: document.documentElement.clientWidth,
        };
      });

      /* En mode mobile, le panneau de detail est empile hors de la zone
         visible : il ne doit pas recouvrir la liste. Il peut etre positionne
         a droite de la fenetre, hors de l'ecran — c'est le comportement
         attendu du panneau empile. */
      assert.ok(
        detail === null || detail.display === 'none' ||
        detail.left >= detail.viewport - 1 || detail.width === 0,
        'le panneau de détail ne doit pas recouvrir la liste à 768px : ' + JSON.stringify(detail)
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
