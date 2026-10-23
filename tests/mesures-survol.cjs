/* ─────────────────────────────────────────────────────────────────────────────
   MESURES DE SURVOL — ce qui change réellement quand la souris passe

   Le constat de départ : en mode nuit, les filtres sous la barre de
   recherche ne reagissent pas, alors que le bouton « Postuler » reagit
   bien. Deux exemples ne suffisent pas a conclure : il faut parcours
   TOUS les elements interactifs, un par un, et mesurer ce qui change
   reellement.

   Ce module mesure quatre choses au survol :

   1. Le fond effectif — compose sur toute la cascade, degrade compris.
   2. La couleur du texte.
   3. La bordure.
   4. Le decalage (transform) et l'ombre.

   L'intensite de la reaction est ensuite classee par la difference de
   contraste du fond avant/apres. C'est ce qui distingue un survol
   PERCEPTIBLE d'un survol theorique : un fond qui passe de #1d262a a
   #1d262a+epsilon ne se voit pas.

   Point d'attention : la mesure se fait element par element, jamais en
   meme temps. Deux survols qui se chevauchent modifieraient les
   couleurs d'autrui et fausseraient la lecture.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(
  path.join(__dirname, 'mesures-survol.js'),
  'utf8'
);

/* Le code qui s'exécute dans la page est un fichier séparé : il se relit,
   se corrige et se débogue comme du JavaScript ordinaire. */
async function preparerSurvol(page) {
  const deja = await page.evaluate(() => Boolean(window.__SURVOL__));
  if (deja) return;
  await page.evaluate(SOURCE);
}

/**
 * L'état visuel d'un élément, au survol.
 *
 * On relève l'état REPOS (aucun survol), puis l'état SURVOL. La
 * comparaison se fait sur les memes proprietes, donc elle mesure
 * exactement ce que l'oeil peut percevoir.
 */
async function releverSurvol(page, selecteur, options = {}) {
  await preparerSurvol(page);

  const avant = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return window.__SURVOL__.relever(el);
  }, selecteur);

  if (!avant) return null;

  /* Le survol est reellement declenche : on deplace reellement la souris
     sur le centre de l'element. Injecter un pseudo-class :hover serait
     plus simple, mais ne declenche pas les transitions, et ne reproduit
     pas ce que fait le navigateur. */
  const position = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selecteur);

  if (!position) return null;

  await page.mouse.move(position.x, position.y);
  /* On laisse passer la transition : .15 s suffisent, mais on laisse une
     marge — une transition plus longue serait lue a mi-parcours. */
  await page.waitForTimeout(options.delai ?? 260);

  const apres = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return window.__SURVOL__.relever(el);
  }, selecteur);

  /* On retire la souris : l'element doit revenir a son etat de repos. */
  await page.mouse.move(2, 2);
  await page.waitForTimeout(180);

  return { avant, apres, selecteur };
}

/**
 * L'intensité de la réaction : la différence de contraste du fond.
 *
 * C'est la mesure qui parle a l'oeil. Une différence de fond de 0,02
 * n'est pas visible ; une différence de 0,20 se voit.
 */
function deltaE(a, b) {
  if (!a || !b) return 0;
  const dl = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * L'intensité de la réaction : l'écart PERCEPTIF entre l'état de repos et
 * l'état survolé.
 *
 * On ne compare pas des luminances. Sur un fond sombre, une variation de
 * luminance de 0,02 est visible ; sur un fond clair, elle ne se voit pas.
 * Le ΔE (CIE Lab) est l'écart perceptif standardisé :
 *
 *   ΔE < 2,3    -> juste perceptible
 *   ΔE > 2,3    -> se voit
 *   ΔE > 10     -> reaction marquante
 *
 * Le plus grand ΔE parmi le fond, le texte, la bordure et la
 * décoration détermine la classe : c'est ce que l'oeil Perçoit en premier.
 */
function intensite(releve) {
  if (!releve || !releve.avant || !releve.apres) return null;

  const dFond = deltaE(releve.avant.fondLab, releve.apres.fondLab);
  const dTexte = deltaE(releve.avant.texteLab, releve.apres.texteLab);
  const dBord = deltaE(releve.avant.bordLab, releve.apres.bordLab);
  /* La bordure du bas : c'est elle qui distingue le lien de navigation
     actif, dont la couleur de texte ne change pas. */
  const dBordBas = releve.avant.bordBasLab && releve.apres.bordBasLab
    ? deltaE(releve.avant.bordBasLab, releve.apres.bordBasLab) : 0;

  /* Un soulignement est une réaction réelle et visible. */
  const dSoulignement = releve.apres.textDecorationLine !== releve.avant.textDecorationLine;
  /* Un filtre modifie l'affichage sans toucher aux couleurs déclarées. */
  const dFiltre = releve.apres.filter !== releve.avant.filter;
  const dDecalage = releve.apres.transform !== releve.avant.transform ||
    releve.apres.boxShadow !== releve.avant.boxShadow;

  const max = Math.max(dFond, dTexte, dBord, dBordBas);
  const dominant = dFond >= dTexte && dFond >= dBord && dFond >= dBordBas ? 'fond'
    : (dTexte >= dBord && dTexte >= dBordBas ? 'texte'
      : (dBord >= dBordBas ? 'bordure' : 'bordure du bas'));

  let classe = 'invisible';
  if (max >= 2.3 || dSoulignement || dFiltre || dDecalage) classe = 'perceptible';
  if (max >= 10) classe = 'marquante';

  return {
    dFond,
    dTexte,
    dBord,
    dBordBas,
    dominant,
    dSoulignement,
    dFiltre,
    dDecalage,
    classe,
    change: max > 0.5 || dSoulignement || dFiltre || dDecalage,
  };
}

module.exports = { preparerSurvol, releverSurvol, intensite, deltaE };
