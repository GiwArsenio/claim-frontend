/* ─────────────────────────────────────────────────────────────────────────────
   CIBLES TACTILES DES BOUTONS PRINCIPAUX (téléphone)

   Au téléphone (768 px et moins), trois boutons étaient plus petits que le
   pouce : « Rechercher » (32 px de haut), la bascule de thème (34 px) et le
   burger (36 px). Ils doivent mesurer 44 px au moins, sans que l'en-tête
   grandisse de plus de 4 px, et sans que deux cibles se touchent (8 px d'air
   au moins entre elles).

   Ce que ce fichier NE change pas, et vérifie :
     • le bureau garde ses tailles (bascule 34 px, pas de burger) ;
     • les chips de filtre ne sont pas concernées (décision D3).

   Chaque page ouverte l'est sur le serveur de test local, jamais en ligne.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const TEL_390 = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
/* 768 px est la borne haute du palier téléphone : la règle y vaut encore. */
const TEL_768 = { viewport: { width: 768, height: 900 }, isMobile: true, hasTouch: true };
const BUREAU = { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false };

/* L'en-tête mesurait 58,8 px avant le changement. La limite demandée est de
   +4 px : au-delà, il faut justifier. */
const ENTETE_AVANT = 58.8;
const ENTETE_TOLERANCE = 4;

const PAGES_AVEC_RECHERCHE = ['/index.html', '/job-board.html'];
const PAGES_AVEC_ENTETE = [
  ...PAGES_AVEC_RECHERCHE,
  '/claim-entreprises.html', '/claim-observatoire.html', '/a-propos.html',
  '/contact.html', '/cgu.html', '/confidentialite.html',
];

/** Mesure les boutons, l'en-tête et les écarts, dans la page ouverte. */
async function mesurer(page) {
  return page.evaluate(() => {
    const visible = (el) => el && el.getClientRects().length > 0;
    const premier = (sel) => [...document.querySelectorAll(sel)].find(visible) || null;
    const boite = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
    };

    const rechercher = premier('.btn-srch');
    let ecartRecherche = null;
    if (rechercher) {
      /* L'élément visible juste au-dessus du bouton, dans la barre. */
      let voisin = rechercher.previousElementSibling;
      while (voisin && !visible(voisin)) voisin = voisin.previousElementSibling;
      if (voisin) ecartRecherche = rechercher.getBoundingClientRect().top - voisin.getBoundingClientRect().bottom;
    }

    const bascule = boite(premier('.bascule-theme'));
    const burger = boite(premier('.btn-burger'));
    const entete = document.querySelector('#hd');

    /* Écart horizontal entre la bascule et le burger, quand les deux sont là. */
    const ecartEntete = bascule && burger ? burger.l - bascule.r : null;

    return {
      rechercher: boite(rechercher),
      bascule,
      burger,
      ecartRecherche,
      ecartEntete,
      entete: entete ? entete.getBoundingClientRect().height : null,
      deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

/** Ouvre une page, retire le bandeau de consentement, et mesure. */
async function ouvrirEtMesurer(format, url) {
  const { ctx, page } = await aide.ouvrirPage(format);
  try {
    await page.goto(aide.BASE + url, { waitUntil: 'domcontentloaded' });
    await aide.attendre(page, 1200);
    await page.evaluate(() => {
      const b = document.querySelector('#claim-consentement');
      if (b) b.remove();
    });
    return await mesurer(page);
  } finally {
    await ctx.close();
  }
}

test('T07 — au téléphone, bascule et burger mesurent 44 px sur toutes les pages', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const [nom, format] of [['390 px', TEL_390], ['768 px', TEL_768]]) {
      for (const url of PAGES_AVEC_ENTETE) {
        const m = await ouvrirEtMesurer(format, url);
        const ou = `${url} à ${nom}`;

        assert.ok(m.bascule, `${ou} : la bascule de thème est introuvable`);
        assert.ok(m.bascule.w >= 44 && m.bascule.h >= 44,
          `${ou} : la bascule mesure ${m.bascule.w} × ${m.bascule.h} px, moins de 44`);

        assert.ok(m.burger, `${ou} : le burger est introuvable`);
        assert.ok(m.burger.w >= 44 && m.burger.h >= 44,
          `${ou} : le burger mesure ${m.burger.w} × ${m.burger.h} px, moins de 44`);

        assert.ok(m.ecartEntete >= 8,
          `${ou} : ${m.ecartEntete} px seulement entre la bascule et le burger (8 px au moins)`);

        assert.ok(m.entete <= ENTETE_AVANT + ENTETE_TOLERANCE,
          `${ou} : l'en-tête mesure ${m.entete} px, soit plus de ${ENTETE_TOLERANCE} px de plus qu'avant (${ENTETE_AVANT})`);
        assert.equal(m.deborde, false, `${ou} : la page déborde horizontalement`);
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T07 — au téléphone, « Rechercher » mesure 44 px et ne touche pas le champ voisin', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const [nom, format] of [['390 px', TEL_390], ['768 px', TEL_768]]) {
      for (const url of PAGES_AVEC_RECHERCHE) {
        const m = await ouvrirEtMesurer(format, url);
        const ou = `${url} à ${nom}`;
        assert.ok(m.rechercher, `${ou} : le bouton « Rechercher » est introuvable`);
        assert.ok(m.rechercher.h >= 44,
          `${ou} : « Rechercher » mesure ${m.rechercher.h} px de haut, moins de 44`);
        assert.ok(m.ecartRecherche >= 8,
          `${ou} : ${m.ecartRecherche} px seulement entre « Rechercher » et le champ au-dessus (8 px au moins)`);
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T07 — au bureau, rien ne change : bascule à 34 px, pas de burger, « Rechercher » à ≤ 36 px', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const url of PAGES_AVEC_ENTETE) {
      const m = await ouvrirEtMesurer(BUREAU, url);
      assert.ok(m.bascule, `${url} : la bascule de thème est introuvable au bureau`);
      assert.equal(Math.round(m.bascule.w), 34, `${url} : la bascule du bureau mesure ${m.bascule.w} px de large (34 attendu)`);
      assert.equal(Math.round(m.bascule.h), 34, `${url} : la bascule du bureau mesure ${m.bascule.h} px de haut (34 attendu)`);
      assert.equal(m.burger, null, `${url} : le burger doit rester caché au bureau`);
      if (PAGES_AVEC_RECHERCHE.includes(url)) {
        assert.ok(m.rechercher.h <= 36,
          `${url} : « Rechercher » mesure ${m.rechercher.h} px au bureau, il ne devait pas grandir`);
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
