/* ─────────────────────────────────────────────────────────────────────────────
   HIÉRARCHIE TYPOGRAPHIQUE DU DÉTAIL D'OFFRE

   Les annonces AXA, Generali et d'autres écrivent leurs sections en <h2>
   et en capitales (« VOTRE RÔLE ET VOS MISSIONS »). Sans règle de style, le
   navigateur rend un <h2> à 1,5 fois le corps : 24 px, presque le titre de
   l'offre (25,6 px), et sur deux lignes en téléphone.

   La règle `.ds h2, .desc-source h2` existe déjà (job-board.html). Ce test
   la verrouille par la mesure, sur l'offre « sections en capitales » des
   fixtures, à deux formats : bureau 1440 px et téléphone 390 px.

   Critère de défaut (feuille de route T11) : h2 > titre, OU h2 >= 1,5 x corps.
   On exige en plus l'ordre titre > h2 >= h3 > 0 et h2 > corps, pour qu'une
   section reste visiblement un intitulé.

   Les caractères par ligne sont mesurés et affichés (diagnostic) mais pas
   verrouillés : la largeur de lecture relève de la décision D2.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const SLUG_TITRE = 'sections en capitales';

/** Ouvre le détail de l'offre aux sections en capitales et mesure. */
async function mesurerDetail(format) {
  const { ctx, page } = await aide.ouvrirPage(format);
  try {
    await page.goto(aide.BASE + '/job-board.html?q=capitales', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.jc', { timeout: 20000 });
    await aide.attendre(page, 600);
    await page.click(`.jc:has-text("${SLUG_TITRE}")`);
    await page.waitForSelector('.dtitle', { timeout: 15000 });
    await page.waitForSelector('.desc-source h2', { timeout: 15000 });
    await aide.attendre(page, 800);

    return await page.evaluate(() => {
      const px = (el) => parseFloat(getComputedStyle(el).fontSize);
      const titre = document.querySelector('.dtitle');
      const corps = document.querySelector('.desc-source p');
      const h2 = [...document.querySelectorAll('.desc-source h2')];
      const h3 = [...document.querySelectorAll('.desc-source h3')];

      /* Caractères de la première ligne du premier paragraphe. */
      let cpl = 0;
      const marcheur = document.createTreeWalker(corps, NodeFilter.SHOW_TEXT);
      const plage = document.createRange();
      let haut = null;
      let n;
      parcours: while ((n = marcheur.nextNode())) {
        for (let i = 0; i < n.length; i++) {
          plage.setStart(n, i);
          plage.setEnd(n, i + 1);
          const r = plage.getClientRects()[0];
          if (!r) continue;
          if (haut === null) haut = r.top;
          if (Math.abs(r.top - haut) > 4) break parcours;
          cpl++;
        }
      }

      return {
        titre: px(titre),
        corps: px(corps),
        h2: h2.map((e) => ({ texte: e.textContent.trim(), px: px(e) })),
        h3: h3.map((e) => px(e)),
        largeurCorps: Math.round(corps.getBoundingClientRect().width),
        cpl,
        debordement: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
  } finally {
    await ctx.close();
  }
}

function verifier(m, nom) {
  assert.ok(m.h2.length >= 2, `${nom} : l'offre doit porter au moins deux <h2> (reçu ${m.h2.length})`);
  for (const h of m.h2) {
    assert.ok(
      h.px < m.titre,
      `${nom} : le <h2> « ${h.texte} » (${h.px} px) ne doit pas dépasser le titre de l'offre (${m.titre} px)`
    );
    assert.ok(
      h.px < 1.5 * m.corps,
      `${nom} : le <h2> « ${h.texte} » (${h.px} px) ne doit pas atteindre 1,5 x le corps (${m.corps} px) : c'est la taille par défaut du navigateur`
    );
    assert.ok(
      h.px > m.corps,
      `${nom} : le <h2> (${h.px} px) doit rester plus grand que le corps (${m.corps} px)`
    );
    for (const t3 of m.h3) {
      assert.ok(h.px >= t3, `${nom} : le <h2> (${h.px} px) ne doit pas être plus petit qu'un <h3> (${t3} px)`);
    }
  }
  assert.equal(m.debordement, false, `${nom} : aucun défilement horizontal`);
}

test('hiérarchie du détail : le <h2> en capitales reste sous le titre (bureau 1440 px)', async (t) => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const m = await mesurerDetail(aide.FORMATS.bureau);
    t.diagnostic(`bureau 1440 : titre ${m.titre} px, corps ${m.corps} px, h2 ${m.h2.map((h) => h.px).join('/')} px, ${m.cpl} car. sur la 1re ligne (corps ${m.largeurCorps} px)`);
    verifier(m, 'bureau');
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('hiérarchie du détail : le <h2> en capitales reste sous le titre (téléphone 390 px)', async (t) => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const m = await mesurerDetail(aide.FORMATS.phone);
    t.diagnostic(`téléphone 390 : titre ${m.titre} px, corps ${m.corps} px, h2 ${m.h2.map((h) => h.px).join('/')} px, ${m.cpl} car. sur la 1re ligne (corps ${m.largeurCorps} px)`);
    verifier(m, 'téléphone');
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
