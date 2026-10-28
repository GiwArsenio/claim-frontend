/* Les conteneurs du site suivent des REGLES, pas des valeurs isolees.
 *
 * Le defaut corrige : l'accueil s'arretait a 1180 px, le board occupait
 * tout l'ecran (1720 px), les pages de lecture a 776 px. Trois regles
 * pour trois fonctions, sans qu'on sache lesquelles etaient voulues.
 * Sur un grand ecran, l'accueil paraissait flotter au milieu.
 *
 * Le systeme retenu : trois familles explicites.
 *
 *   PRODUIT   accueil, board, surfaces ou la largeur sert. Semi-fluide :
 *             le contenu grandit avec l'ecran jusqu'a 1664 px utiles,
 *             puis se stabilise.
 *   LECTURE   fiche d'offre, pages legales. Largeur FIXE (776 px).
 *             Au-dela, les lignes deviennent trop longues pour l'oeil.
 *   PLEINE    fonds, en-tetes, pieds, bandes. La couleur occupe tout,
 *             le contenu suit un conteneur.
 *
 * Ce test verifie trois choses :
 *
 *   1. Les surfaces produit partagent le MEME axe vertical, a toutes
 *      les largeurs. C'est ce qui manquait : accueil et board
 *      commencaient a 32 px pres l'un de l'autre.
 *   2. Les pages de lecture ne s'elargissent PAS. Unifier ne veut pas
 *      dire tout etirer.
 *   3. Aucun scroll horizontal, et la gouttiere telephone ne bouge pas.
 *
 * Usage : node tests/axes_conteneurs.test.cjs
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const aide = require('./aide-parcours.cjs');

const TOLERANCE = 1; // px

test('les conteneurs suivent trois familles de largeur', async (t) => {
  const serveurPret = !process.env.CLAIM_BASE;
  if (serveurPret) await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();
  t.after(async () => {
    await aide.arreterNavigateur();
    if (serveurPret) await aide.arreterServeur();
  });

  const base = process.env.CLAIM_BASE || aide.baseTests();

  async function mesurer(page, selecteur) {
    return page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { gauche: Math.round(r.left), largeur: Math.round(r.width) };
    }, selecteur);
  }

  for (const largeur of [1280, 1920, 2560]) {
    await t.test(`a ${largeur} px`, async () => {
      // ── 1. Les surfaces produit partagent le meme axe ──────────────
      const pAccueil = await nav.newPage();
      await pAccueil.setViewportSize({ width: largeur, height: 900 });
      await pAccueil.goto(base + '/index.html', { waitUntil: 'load', timeout: 45000 });
      await pAccueil.waitForTimeout(600);
      const accueil = await mesurer(pAccueil, '.grille');
      await pAccueil.close();

      const pBoard = await nav.newPage();
      await pBoard.setViewportSize({ width: largeur, height: 900 });
      await pBoard.goto(base + '/job-board.html', { waitUntil: 'load', timeout: 45000 });
      await pBoard.waitForTimeout(1200);
      const board = await mesurer(pBoard, '.pl');

      const debord = await pBoard.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      await pBoard.close();

      assert.ok(accueil, 'l accueil doit exposer une grille de cartes');
      assert.ok(board, 'le board doit exposer sa colonne de liste');
      assert.equal(debord, false, `le board ne doit pas defiler horizontalement a ${largeur} px`);

      assert.ok(
        Math.abs(accueil.gauche - board.gauche) <= TOLERANCE,
        `accueil et board doivent partager le meme axe a ${largeur} px : ` +
        `accueil=${accueil.gauche}, board=${board.gauche}`);

      // ── 2. Les pages de lecture ne s'elargissent pas ───────────────
      const pLegal = await nav.newPage();
      await pLegal.setViewportSize({ width: largeur, height: 900 });
      await pLegal.goto(base + '/cgu.html', { waitUntil: 'load', timeout: 45000 });
      await pLegal.waitForTimeout(400);
      const lecture = await mesurer(pLegal, '.enveloppe');
      await pLegal.close();

      assert.ok(lecture, 'la page CGU doit exposer son enveloppe');
      assert.ok(
        lecture.largeur <= 800,
        `une page de lecture doit rester etroite (${lecture.largeur} px a ${largeur} px d ecran)`);
    });
  }

  // ── 3. Le telephone ne doit pas bouger ─────────────────────────────
  await t.test('a 390 px, la gouttiere reste de 20 px', async () => {
    const p = await nav.newPage();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + '/index.html', { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(600);
    const g = await mesurer(p, '.grille');
    const debord = await p.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    await p.close();

    assert.ok(g, 'la grille doit exister sur telephone');
    assert.equal(debord, false, 'pas de scroll horizontal sur telephone');
    assert.ok(
      Math.abs(g.gauche - 20) <= 2,
      `la gouttiere telephone doit rester de 20 px (lu : ${g.gauche})`);
  });
});
