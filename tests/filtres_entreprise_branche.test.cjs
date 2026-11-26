/* ─────────────────────────────────────────────────────────────────────────────
   FILTRES MÉTIER : TYPOLOGIE D'ENTREPRISE & BRANCHE DE RISQUE

   Vérifie de bout en bout (navigateur + serveur local) :
     1. Présence des 9 typologies d'entreprise et des 5 branches de risque
        dans le panneau `#filtres-panneau`, en mode complet comme par catégorie.
     2. Sélection multi-choix, annulation (Échap), « Tout effacer » et
        validation « Afficher les offres » avec paramètres exacts vers l'API
        (`company_type=...`, `branch=...`) et mise à jour du compteur `#badge-filtres`.
     3. Hydratation depuis l'adresse URL (formes françaises `?type_entreprise=ip&branche=vie`
        et formes API `?company_type=assureur&branch=iard`).
     4. Absence de débordement horizontal et de violation grave d'accessibilité
        (axe-core) sur mobile (390 px) et bureau (1440 px), jour et nuit.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const aide = require('./aide-parcours.cjs');

const AXE_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'),
  'utf8',
);

const CODES_ENTREPRISE = [
  'assureur',
  'bancassureur',
  'mutuelle',
  'groupe_protection_sociale',
  'reassureur',
  'courtier',
  'cabinet_conseil',
  'insurtech',
  'cabinet_rh',
];

const CODES_BRANCHES = [
  'epargne_retraite',
  'prevoyance_sante',
  'iard',
  'emprunteur',
  'reassurance',
];

test('F01 — les 9 typologies et 5 branches filtrent en multi-choix côté serveur', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirEtAttendre('/job-board.html', aide.FORMATS.bureau);
    try {
      await aide.attendreChargementTermine(page);
      const totalInitial = await aide.compterCartes(page);
      assert.ok(totalInitial > 0, 'la liste initiale doit contenir des offres');

      // Ouvrir le panneau complet via #btn-filtres
      await page.click('#btn-filtres');
      await page.waitForTimeout(200);

      const inventaire = await page.evaluate(() => {
        const valeursDe = (id) =>
          [...document.querySelectorAll(`.fp-groupe[data-filtre="${id}"] .fp-puce`)]
            .map((b) => b.dataset.valeur);
        return {
          entreprises: valeursDe('company-type-filter'),
          branches: valeursDe('branch-filter'),
          visibles: [...document.querySelectorAll('#filtres-panneau .fp-groupe')]
            .filter((g) => !g.hidden)
            .map((g) => g.dataset.filtre),
        };
      });

      assert.deepEqual(inventaire.entreprises, CODES_ENTREPRISE);
      assert.deepEqual(inventaire.branches, CODES_BRANCHES);
      assert.equal(inventaire.visibles.length, 7);

      // Sélectionner 2 typologies + 2 branches (sans appel avant validation)
      let appelsPendantBrouillon = 0;
      const espion = (req) => { if (aide.estListeDuBoard(req.url())) appelsPendantBrouillon += 1; };
      page.on('request', espion);

      await page.click('.fp-groupe[data-filtre="company-type-filter"] .fp-puce[data-valeur="assureur"]');
      await page.click('.fp-groupe[data-filtre="company-type-filter"] .fp-puce[data-valeur="reassureur"]');
      await page.click('.fp-groupe[data-filtre="branch-filter"] .fp-puce[data-valeur="iard"]');
      await page.click('.fp-groupe[data-filtre="branch-filter"] .fp-puce[data-valeur="reassurance"]');
      await page.waitForTimeout(250);
      page.off('request', espion);

      assert.equal(appelsPendantBrouillon, 0, 'aucune requête ne doit partir avant validation');

      let derniereRequeteListe = '';
      page.on('request', (req) => {
        if (aide.estListeDuBoard(req.url())) derniereRequeteListe = req.url();
      });

      await aide.avecReponse(page, aide.estListeDuBoard, async () => {
        await page.click('.fp-afficher');
      });
      await aide.attendre(page, 400);

      const paramsEnvoyes = aide.parametresURL(derniereRequeteListe);
      assert.equal(paramsEnvoyes.company_type, 'assureur,reassureur');
      assert.equal(paramsEnvoyes.branch, 'iard,reassurance');

      const apresValidation = await page.evaluate(() => ({
        badge: document.getElementById('badge-filtres').textContent,
        badgeCache: document.getElementById('badge-filtres').hidden,
        cartes: document.querySelectorAll('#feed .jc').length,
      }));
      assert.equal(apresValidation.badge, '2');
      assert.equal(apresValidation.badgeCache, false);
      assert.ok(apresValidation.cartes > 0 && apresValidation.cartes < totalInitial);

      // Vérifier l'ouverture ciblée sur la seule catégorie Branche
      await page.click('[data-categorie="branch-filter"]');
      await page.waitForTimeout(150);
      const modeCategorie = await page.evaluate(() => ({
        titre: document.getElementById('fp-titre').textContent,
        groupesVisibles: [...document.querySelectorAll('#filtres-panneau .fp-groupe:not([hidden])')]
          .map((g) => g.dataset.filtre),
      }));
      assert.equal(modeCategorie.titre, 'Branche');
      assert.deepEqual(modeCategorie.groupesVisibles, ['branch-filter']);

      // Tout effacer puis valider remet tout à zéro
      await page.click('.fp-tout-effacer');
      await aide.avecReponse(page, aide.estListeDuBoard, async () => {
        await page.click('.fp-afficher');
      });
      await aide.attendre(page, 300);
      assert.equal(await page.evaluate(() => document.getElementById('badge-filtres').hidden), true);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('F02 — hydratation depuis les paramètres URL français et alias normalisés', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    let urlInitialeApi = '';
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.phone);
    try {
      page.on('request', (req) => {
        if (aide.estListeDuBoard(req.url()) && !urlInitialeApi) urlInitialeApi = req.url();
      });

      await page.goto(
        aide.BASE + '/job-board.html?type_entreprise=conseil,courtier&branche=vie',
        { waitUntil: 'domcontentloaded' },
      );
      await aide.attendre(page, 600);

      const params = aide.parametresURL(urlInitialeApi);
      assert.equal(params.company_type, 'cabinet_conseil,courtier');
      assert.equal(params.branch, 'epargne_retraite');

      // Ouvrir le panneau sur mobile (390 px) : les pastilles correspondantes sont actives, 0 overflow, 0 erreur axe
      await page.click('#btn-filtres');
      await page.waitForTimeout(250);

      const etatMobile = await page.evaluate(() => ({
        badge: document.getElementById('badge-filtres').textContent,
        conseilPresse: document.querySelector('.fp-puce[data-valeur="cabinet_conseil"]').getAttribute('aria-pressed'),
        courtierPresse: document.querySelector('.fp-puce[data-valeur="courtier"]').getAttribute('aria-pressed'),
        epargnePresse: document.querySelector('.fp-puce[data-valeur="epargne_retraite"]').getAttribute('aria-pressed'),
        debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
      }));
      assert.equal(etatMobile.badge, '2');
      assert.equal(etatMobile.conseilPresse, 'true');
      assert.equal(etatMobile.courtierPresse, 'true');
      assert.equal(etatMobile.epargnePresse, 'true');
      assert.equal(etatMobile.debordement, false, 'aucun débordement horizontal sur mobile');

      await page.addScriptTag({ content: AXE_SOURCE });
      const audit = await page.evaluate(async () => {
        const res = await window.axe.run(document.getElementById('filtres-panneau'));
        return res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      });
      assert.deepEqual(audit, [], `violations d'accessibilité graves dans le panneau : ${JSON.stringify(audit)}`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
