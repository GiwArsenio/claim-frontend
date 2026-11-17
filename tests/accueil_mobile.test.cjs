/* ─────────────────────────────────────────────────────────────────────────────
   L'ACCUEIL SUR TELEPHONE

   Deux défauts signalés le 16 novembre :
     • les titres des cartes n'étaient pas découpés sur deux lignes — un
       titre de poste était coupé net au milieu de son premier mot utile ;
     • la rangée de filtres montrait les cinq critères du bureau, alors que
       le board a une rangée de trois.

   Ce fichier tient les deux. Il vérifie aussi le chemin : le bouton
   « Filtres » doit ouvrir le board avec son panneau déjà ouvert, sinon il
   ne mène à rien de plus que les deux listes.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

/** Ouvre l'accueil sur téléphone, consentement retiré. */
async function ouvrirAccueil(page) {
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.oc .ctitle', { timeout: 20000 });
  await aide.attendre(page, 1800);
  await page.evaluate(() => {
    const b = document.querySelector('#claim-consentement');
    if (b) b.remove();
  });
}

test('M10 — la rangée d\'entrées de l\'accueil tient sur l\'écran', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(PHONE);
    try {
      await ouvrirAccueil(page);

      const releve = await page.evaluate(() => {
        const rangee = document.querySelector('.filtres-entrees');
        if (!rangee) return null;
        const liens = [...rangee.querySelectorAll('.filtre-entree')]
          .filter((e) => e.getClientRects().length > 0);
        const rects = liens.map((e) => e.getBoundingClientRect());
        return {
          noms: liens.map((e) => e.textContent.trim()),
          nombre: liens.length,
          hauteurMini: Math.min(...rects.map((r) => Math.round(r.height))),
          gauche: Math.round(Math.min(...rects.map((r) => r.left))),
          droite: Math.round(Math.max(...rects.map((r) => r.right))),
          ecran: window.innerWidth,
          deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });

      /* L'accueil n'affiche plus trois boites de filtre mais une rangee
         d'entrees : « Filtres », puis un raccourci par critere. */
      assert.ok(releve, 'la rangée d\'entrées de l\'accueil est introuvable');
      /* Trois entrées tiennent à l'écran ; les autres sont dans le
         défilement de la rangée. */
      assert.ok(releve.nombre >= 3,
        `l'accueil montre ${releve.nombre} entrée(s) : ${JSON.stringify(releve.noms)}`);
      assert.ok(releve.noms.some((n) => /Filtres/.test(n)), 'l\'entrée « Filtres » manque');
      assert.equal(releve.deborde, false, 'la page déborde horizontalement');
      assert.ok(releve.gauche >= 0 && releve.droite <= releve.ecran + 1,
        `la rangée sort de l'écran : ${releve.gauche} → ${releve.droite} sur ${releve.ecran}`);
      assert.ok(releve.hauteurMini >= 24,
        `une entrée mesure ${releve.hauteurMini} px de haut — trop court au doigt`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('M11 — les titres des cartes de l\'accueil tiennent sur deux lignes', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(PHONE);
    try {
      await ouvrirAccueil(page);

      const titres = await page.evaluate(() => [...document.querySelectorAll('.oc .ctitle')].map((t) => {
        const s = getComputedStyle(t);
        const lh = parseFloat(s.lineHeight) || 18;
        return {
          texte: t.textContent.trim().slice(0, 40),
          lignes: Math.round(t.getBoundingClientRect().height / lh),
          clamp: s.webkitLineClamp,
        };
      }));

      assert.ok(titres.length >= 3, 'aucune carte à mesurer');

      for (const t of titres) {
        assert.equal(t.clamp, '2',
          `« ${t.texte} » n'est pas découpé sur deux lignes (clamp: ${t.clamp})`);
        assert.ok(t.lignes <= 2,
          `« ${t.texte} » occupe ${t.lignes} lignes au lieu de deux au plus`);
      }

      /* Au moins un titre doit réellement utiliser la seconde ligne : sinon
         le test passerait même avec une seule ligne autorisée. */
      assert.ok(titres.some((t) => t.lignes === 2),
        'aucun titre n\'utilise la deuxième ligne — la règle ne s\'applique pas');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('M12 — « Filtres » ouvre le board, panneau déjà ouvert', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(PHONE);
    try {
      await ouvrirAccueil(page);

      /* L'entrée « Filtres » est un lien vers le board, pas un bouton. */
      await page.click('.filtre-entree#btn-filtres, #btn-filtres');
      await aide.attendre(page, 2200);

      const releve = await page.evaluate(() => {
        const panneau = document.querySelector('#filtres-panneau');
        return {
          chemin: location.pathname,
          ancre: location.hash,
          ouvert: panneau ? panneau.classList.contains('ouvert') : false,
          /* Le board a change trois fois de controle de filtre aujourd'hui.
             Ce qu'on veut savoir reste stable : le panneau montre ses
             groupes de filtres. On compte les groupes, pas la balise. */
          champs: panneau
            ? [...panneau.querySelectorAll('.fp-groupe, .msel, select')]
              .filter((s) => s.getClientRects().length > 0).length
            : 0,
        };
      });

      assert.match(releve.chemin, /job-board\.html$/, `le bouton ne mène pas au board : ${releve.chemin}`);
      assert.equal(releve.ouvert, true, 'le panneau du board ne s\'est pas ouvert');
      assert.ok(releve.champs >= 4,
        `le panneau n'affiche que ${releve.champs} champ(s) — il n'est pas vraiment ouvert`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
