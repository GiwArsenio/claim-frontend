/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A04 — Confort visuel

   Cinq exigences distinctes, qui ne se mesurent pas de la même façon :

   1. Le contraste du texte informatif. Un texte normal exige 4,5:1 ; un
      texte de grande taille (18,66 px, ou 14 px en gras) exige 3:1. La
      mesure se fait sur le fond RÉELLEMENT affiché : un fond translucide
      doit être composé avec ce qu'il recouvre, et un dégradé doit être lu
      dans backgroundImage — backgroundColor y vaut transparent.

   2. Le focus clavier visible. Un élément focalisé sans contour ni ombre
      est un défaut : l'utilisateur clavier ne sait plus où il se trouve.

   3. Le mouvement réduit respecté. Quand le système demande moins de
      mouvement, les ANIMATIONS doivent s'arrêter. Les transitions de
      couleur ne sont pas des mouvements : elles restent acceptables.

   4. Le zoom à 200 % doit rester utilisable. C'est l'exigence de
      reflow : à 200 %, le contenu doit se réorganiser, pas disparaître.

   5. Le texte long doit rester lisible. Un titre tronqué avec des points de
      suspension est un choix assumé ; un titre qui déborde de son cadre et
      écrase le texte voisin ne l'est pas.

   Ce que la famille A04 NE couvre pas : les couleurs de marque d'un
   employeur. Elles sont littérales par choix, et l'audit ne les juge pas.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const mesures = require('./mesures-a11y.cjs');

const PAGES = [
  { nom: 'accueil', url: '/index.html' },
  { nom: 'board', url: '/job-board.html' },
];

/* Les couleurs de marque d'un employeur restent littérales : l'audit ne les
   juge pas. On les écarte donc de la mesure de contraste, explicitement et
   non par hasard.

   Le critère est marqué DANS LA PAGE : le code pose la teinte d'un employeur
   en dur, dans un style inline. C'est la seule trace fiable d'une couleur de
   marque. Les jetons du thème ne sont pas marqués, et restent mesurés : le
   bouton « Rechercher » et le compteur du board doivent, eux, être
   vérifiables. */
function estCouleurDeMarque(releve) {
  return releve.marque === true;
}

test('A04 — le texte informatif garde son contraste, jour et nuit', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      for (const theme of ['jour', 'nuit']) {
        await t.test(`${p.nom} / ${theme}`, async () => {
          const options = theme === 'nuit' ? { theme: 'nuit' } : {};
          const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, options);
          try {
            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1200);

            const textes = await mesures.releverTextes(page);
            const insuffisants = textes
              .filter((x) => x.ratio < x.seuil)
              .filter((x) => !estCouleurDeMarque(x));

            assert.equal(
              insuffisants.length, 0,
              `${p.nom} / ${theme} : ${insuffisants.length} texte(s) sous le seuil — ` +
              JSON.stringify(insuffisants.slice(0, 6))
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

test('A04 — le focus clavier est visible', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    /* On parcourt les elements focalisables du premier ecran et on verifie
       que chacun affiche un focus. Un element masque par le CSS (burger
       mobile sur bureau) n'est pas testable : on l'ignore explicitement. */
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1200);
      await mesures.preparerMesures(page);

      const cibles = await page.evaluate(() => {
        const selecteur = 'a[href]:not([tabindex="-1"]), button:not([tabindex="-1"]), ' +
          'input:not([tabindex="-1"]), select:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';
        const out = [];
        for (const el of document.querySelectorAll(selecteur)) {
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          out.push({
            chemin: window.__MESURES__.cheminDe(el),
            nom: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
          });
        }
        return out.slice(0, 12);
      });

      assert.ok(cibles.length > 0, 'aucun element focalisable trouve : le test ne prouve rien');

      const invisibles = [];
      for (const cible of cibles) {
        await page.evaluate((chemin) => {
          const el = document.querySelector(chemin);
          if (el) el.focus();
        }, cible.chemin);

        const f = await mesures.focusEstVisible(page);
        if (!f.visible) invisibles.push({ ...cible, raison: f.raison, outline: f.outline });
      }

      assert.equal(
        invisibles.length, 0,
        `${invisibles.length} element(s) focalisable(s) sans focus visible — ` +
        JSON.stringify(invisibles.slice(0, 5))
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A04 — le mouvement réduit arrête les animations', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, { reducedMotion: 'reduce' });
    try {
      await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1200);

      const mouvements = await mesures.releverMouvements(page);

      /* Une transition de couleur n'est pas un mouvement : seule une
         ANIMATION (un deplacement, une rotation, un fondu) doit s'arreter.
         Les transitions de fond et de couleur restent acceptees. */
      const animations = mouvements.filter((m) => m.animation && m.animation !== 'none');

      assert.equal(
        animations.length, 0,
        `${animations.length} animation(s) encore active(s) en mouvement réduit — ` +
        JSON.stringify(animations.slice(0, 5))
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A04 — le zoom à 200 % ne perd aucun contenu', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          /* Le zoom a 200 % est applique au document : c'est ce que fait le
             navigateur quand l'utilisateur zoome. */
          await page.addStyleTag({ content: 'html { zoom: 2 !important; }' });
          await page.waitForTimeout(700);

          const deb = await mesures.releverDebordements(page);

          assert.equal(
            deb.scrollHorizontal, 0,
            `${p.nom} : à 200 % le document défile horizontalement de ` +
            `${deb.scrollHorizontal}px — le contenu doit se réorganiser, pas déborder`
          );

          /* Le contenu principal reste visible et dimensionné. */
          const haut = await mesures.mesurerHauteurUtile(page, 'body');
          assert.ok(
            haut.hauteur > 0,
            `${p.nom} : à 200 % la page n'a plus de hauteur utile`
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

test('A04 — un titre très long ne fait pas déborder sa carte', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html?q=reference_longue', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1500);

      const cartes = await page.locator('#feed .jc, #feed .oc').count();
      assert.ok(cartes > 0, 'la fixture au titre long n\'a pas été trouvée : le test ne prouve rien');

      const info = await page.evaluate(() => {
        const carte = document.querySelector('#feed .jc, #feed .oc');
        const titre = carte.querySelector('.ctitle');
        if (!titre) return null;
        const r = titre.getBoundingClientRect();
        const st = getComputedStyle(titre);
        return {
          largeur: Math.round(r.width),
          scrollWidth: titre.scrollWidth,
          clientWidth: titre.clientWidth,
          tronque: st.textOverflow === 'ellipsis',
          deborde: r.right > document.documentElement.clientWidth + 1,
          texte: titre.textContent.trim().slice(0, 50),
        };
      });

      assert.ok(info, 'aucun titre de carte trouvé');

      assert.equal(
        info.deborde, false,
        `le titre long déborde de sa carte : "${info.texte}"`
      );

      /* Un titre tronque doit l'etre proprement : c'est un choix assume.
         Un titre qui deborde de son cadre sans ellipsis, lui, n'en est pas
         un : le texte voisin est ecrase. */
      if (info.scrollWidth > info.clientWidth + 1) {
        assert.equal(
          info.tronque, true,
          `le titre "${info.texte}" est plus large que sa carte (${info.scrollWidth} > ` +
          `${info.clientWidth}) sans être tronqué : il écrase le texte voisin`
        );
      }
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
