/* ─────────────────────────────────────────────────────────────────────────────
   MESURES D'ACCESSIBILITÉ ET D'AFFICHAGE — côté Node

   Ce module ne décide rien : il mesure. Les tests qui l'utilisent formulent
   leurs propres exigences.

   Le code qui s'exécute dans la page vit dans tests/mesures-navigateur.js.
   Il est injecté à la demande, une fois par page.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_NAVIGATEUR = fs.readFileSync(
  path.join(__dirname, 'mesures-navigateur.js'),
  'utf8'
);

/* ── Couleurs et contraste (côté Node) ───────────────────────────────────── */

function parseRGB(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  if (p.length < 3 || p.some(Number.isNaN)) return null;
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

function luminance(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contraste(a, b) {
  if (!a || !b) return null;
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ── Injection ───────────────────────────────────────────────────────────── */

/**
 * Injecte le code de mesure dans la page, une seule fois.
 */
async function preparerMesures(page) {
  const deja = await page.evaluate(() => Boolean(window.__MESURES__));
  if (deja) return;
  await page.evaluate(SOURCE_NAVIGATEUR);
}

/* ── Mesures ─────────────────────────────────────────────────────────────── */

/**
 * Relève tous les textes visibles avec leur contraste réel.
 */
async function releverTextes(page, options = {}) {
  await preparerMesures(page);
  return page.evaluate((opts) => window.__MESURES__.releverTextes(opts), options || {});
}

/**
 * Relève les débordements horizontaux et le décalage du document.
 */
async function releverDebordements(page) {
  await preparerMesures(page);
  return page.evaluate(() => window.__MESURES__.releverDebordements());
}

/**
 * Mesure la hauteur utile : la place réellement disponible pour le contenu.
 */
async function mesurerHauteurUtile(page, selecteur) {
  await preparerMesures(page);
  return page.evaluate((sel) => window.__MESURES__.mesurerHauteurUtile(sel || null), selecteur || null);
}

/**
 * Vérifie que le focus clavier est visible.
 */
async function focusEstVisible(page, selecteur) {
  await preparerMesures(page);
  return page.evaluate((sel) => window.__MESURES__.focusEstVisible(sel || null), selecteur || null);
}

/**
 * Relève les animations et transitions encore actives.
 */
async function releverMouvements(page) {
  await preparerMesures(page);
  return page.evaluate(() => window.__MESURES__.releverMouvements());
}

/**
 * Relève la hiérarchie des repères (landmarks).
 */
async function releverLandmarks(page) {
  await preparerMesures(page);
  return page.evaluate(() => window.__MESURES__.releverLandmarks());
}

/**
 * Relève les éléments interactifs sans nom accessible.
 */
async function releverNomsManquants(page) {
  await preparerMesures(page);
  return page.evaluate(() => window.__MESURES__.releverNomsManquants());
}

/**
 * Relève la hiérarchie des titres et le nom accessible des images.
 */
async function releverStructure(page) {
  await preparerMesures(page);
  return page.evaluate(() => window.__MESURES__.releverStructure());
}

/**
 * Relève les textes tronqués alors que le contenu est plus long.
 */
async function releverTextesCoupes(page) {
  await preparerMesures(page);
  return page.evaluate(() => window.__MESURES__.releverTextesCoupes());
}

/**
 * Injecte axe-core dans la page et renvoie les violations.
 *
 * On retient les violations GRAVES et CRITIQUES : le catalogue (A02) demande
 * un scanner « sans violations graves connues ». Les violations modérées
 * sont signalées, pas bloquantes.
 */
async function scannerAxe(page, options = {}) {
  const chemin = require.resolve('axe-core/axe.min.js');
  const source = fs.readFileSync(chemin, 'utf8');
  await page.evaluate(source);

  const resultat = await page.evaluate(async (opts) => {
    const resultats = await window.axe.run(document, {
      runOnly: opts.runOnly || { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations'],
      elementRef: false,
    });
    return resultats.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      aide: v.help,
      description: v.description,
      noeuds: v.nodes.slice(0, 5).map((n) => ({
        cible: n.target.join(' '),
        resume: (n.failureSummary || '').split('\n').filter(Boolean).slice(0, 3).join(' | '),
      })),
      total: v.nodes.length,
    }));
  }, options || {});

  const graves = resultat.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const moderees = resultat.filter((v) => v.impact === 'moderate' || v.impact === 'minor');
  return { violations: resultat, graves, moderees };
}

/* ── Capture de référence ─────────────────────────────────────────────────── */

/**
 * Stabilise le rendu avant une capture : animations coupées, curseur
 * invisible. Deux captures de la même page doivent se ressembler.
 */
async function stabiliser(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      caret-color: transparent !important;
    }`,
  }).catch(() => {});
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}
  await page.waitForTimeout(500);
}

/**
 * Capture une page dans des conditions déterministes.
 */
async function capturer(page, cheminFichier, options = {}) {
  await stabiliser(page);
  const dossier = path.dirname(cheminFichier);
  fs.mkdirSync(dossier, { recursive: true });
  await page.screenshot({ path: cheminFichier, fullPage: options.fullPage !== false });
  return cheminFichier;
}

module.exports = {
  parseRGB,
  luminance,
  contraste,
  preparerMesures,
  releverTextes,
  releverDebordements,
  mesurerHauteurUtile,
  focusEstVisible,
  releverMouvements,
  releverLandmarks,
  releverNomsManquants,
  releverStructure,
  releverTextesCoupes,
  scannerAxe,
  capturer,
  stabiliser,
};
