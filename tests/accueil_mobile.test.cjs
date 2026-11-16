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

test('M10 — la rangée de filtres de l\'accueil montre trois boîtes, et tient', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(PHONE);
    try {
      await ouvrirAccueil(page);

      const releve = await page.evaluate(() => {
        const chips = document.querySelector('.chips');
        const visibles = [...chips.children].filter((e) => e.getClientRects().length > 0);
        const noms = visibles.map((e) => (e.textContent || '').trim().slice(0, 20));
        const b = document.querySelector('.btn-filtres-accueil').getBoundingClientRect();
        const sp = document.querySelector('#acc-specialite').getBoundingClientRect();
        const c = document.querySelector('#acc-contrat').getBoundingClientRect();
        return {
          noms,
          nombre: visibles.length,
          memeLigne: Math.abs(b.top - sp.top) <= 3 && Math.abs(sp.top - c.top) <= 3,
          deborde: chips.scrollWidth > chips.clientWidth + 1,
          gauche: Math.round(b.left),
          droite: Math.round(c.right),
          ecran: window.innerWidth,
        };
      });

      assert.equal(releve.nombre, 3,
        `l'accueil montre ${releve.nombre} boîtes de filtre : ${JSON.stringify(releve.noms)}`);
      assert.ok(releve.noms.some((n) => /Filtres/.test(n)), 'le bouton « Filtres » manque');
      assert.ok(releve.memeLigne, 'les trois boîtes ne sont pas sur une seule ligne');
      assert.equal(releve.deborde, false,
        'la rangée déborde de l\'écran — une boîte est coupée');
      assert.ok(releve.gauche >= 0 && releve.droite <= releve.ecran + 1,
        `la rangée sort de l'écran : ${releve.gauche} → ${releve.droite} sur ${releve.ecran}`);
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

      await page.click('.btn-filtres-accueil');
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
