/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A07 — les aides communes aux deux fichiers de survol.

   Le test a ete coupe en deux : « tout element reagit » prend 80 s a lui
   seul, « la lisibilite ne se degrade pas » une soixantaine. Reunis, ils
   formaient le fichier le plus long de la suite et fixaient le plancher du
   shard le plus lent. Separes, ils se repartissent entre deux shards.

   Ce fichier ne porte aucun cas : il est lu par les deux autres. Sans le
   suffixe .test.cjs, le lanceur ne l'execute pas seul.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const survol = require('./mesures-survol.cjs');

/* Le seuil de perception. 2,3 est le seuil classique du « juste
   perceptible » : en dessous, l'utilisateur ne voit rien. */
const SEUIL_PERCEPTIBLE = 2.3;

/* Le contraste minimal du texte informatif, WCAG AA. */
const CONTRASTE_MINIMAL = 4.5;

const PAGES = [
  { nom: 'accueil', url: '/index.html' },
  { nom: 'board', url: '/job-board.html' },
];

/**
 * L'identifiant de l'élément, pour le message d'échec.
 */
function nomLisible(el) {
  const texte = (el.texte || '').replace(/\s+/g, ' ').trim();
  return texte ? `"${texte.slice(0, 34)}"` : el.chemin.slice(-40);
}

/**
 * Balaye tous les éléments interactifs d'une page et relit leur réaction.
 */
async function balayer(page) {
  await survol.preparerSurvol(page);

  const elements = await page.evaluate(() => window.__SURVOL__.elementsInteractifs());
  const resultats = [];

  for (const el of elements) {
    const cible = `[data-survol="${el.id}"]`;

    /* Ce qui est réellement sous la souris. Un overlay peut capter le
       survol : l'élément ne reçoit alors aucun :hover, et conclure
       « il ne réagit pas » serait faux — il ne peut pas réagir, on ne le
       survole pas. */
    const sous = await page.evaluate((c) => {
      const cible = document.querySelector(c);
      if (!cible) return null;
      const r = cible.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top) return { bloque: true, par: 'rien' };
      /* On accepte aussi le cas ou un PARENT recouvre l'element : le
         rail de detail passe au-dessus des cartes de la liste, et la
         souris atteint le rail. La carte est bien la, mais elle n'est
         pas survolable — on ne peut pas juger un element qu'on ne peut
         pas atteindre. */
      /* L'element vise, ou un de ses DESCENDANTS. Un ancetre ne prouve
         rien : elementFromPoint renvoie #app quand le pointeur est dans
         une zone vide de la carte — la carte passe alors le controle de
         blocage, et le test conclut ensuite qu'elle ne reagit pas.
         La carte est bien la, mais elle n'est pas survolable : on ne
         peut pas juger un element qu'on ne peut pas atteindre. */
      const atteint = top === cible || cible.contains(top);
      return { bloque: !atteint, par: window.__SURVOL__.cheminDe(top) };
    }, cible);

    /* L'etat de REPOS. Apres un clic, la souris est encore posee sur
       l'element : le relever sur place donnerait un « avant » qui est
       deja en survol, et la comparaison ne verrait aucun changement.
       On sort la souris avant de relever. */
    await page.mouse.move(2, 2);
    await page.waitForTimeout(220);

    const avant = await page.evaluate((c) => {
      const cible = document.querySelector(c);
      return cible ? window.__SURVOL__.relever(cible) : null;
    }, cible);
    if (!avant) continue;

    /* La position est RELUE juste avant le survol. Les coordonnees
       capturees au debut du balayage peuvent etre perimees : la page
       defile pendant le parcours (le detail qui s'ouvre pousse la
       liste), et la souris atterrit alors a cote de la cible. */
    const pos = await page.evaluate((c) => {
      const cible = document.querySelector(c);
      if (!cible) return null;
      const r = cible.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, cible);
    if (!pos) continue;

    /* On RECONTROLE ce qui est reellement sous la souris, maintenant.
       Le premier controle pouvait avoir ete fait avant un defilement : la
       carte du bas sortait alors de la fenetre, et la souris atterrissait
       dans le vide. Un element qu'on ne peut pas survoler n'est pas un
       element qui ne reagit pas. */
    const sousNow = await page.evaluate((c) => {
      const cible = document.querySelector(c);
      if (!cible) return { bloque: true, par: 'rien' };
      const r = cible.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top) return { bloque: true, par: 'rien' };
      const atteint = top === cible || cible.contains(top);
      return { bloque: !atteint, par: window.__SURVOL__.cheminDe(top) };
    }, cible);
    if (sousNow.bloque) {
      resultats.push({ ...el, avant, apres: avant, bloque: true, bloquePar: sousNow.par,
                       dFond: 0, dTexte: 0, dBord: 0, dBordBas: 0,
                       dSoulignement: false, dFiltre: false, dDecalage: false });
      continue;
    }

    await page.mouse.move(pos.x, pos.y);
    /* On laisse passer la transition : .15 s suffisent, avec une marge. */
    await page.waitForTimeout(260);

    const apres = await page.evaluate((c) => {
      const cible = document.querySelector(c);
      return cible ? window.__SURVOL__.relever(cible) : null;
    }, cible);

    /* On retire la souris : l'élément doit revenir à son état de repos. */
    await page.mouse.move(2, 2);
    await page.waitForTimeout(150);

    if (!apres) continue;

    const i = survol.intensite({ avant, apres });
    resultats.push({
      ...el,
      avant,
      apres,
      bloque: sous ? sous.bloque : false,
      bloquePar: sous ? sous.par : null,
      ...i,
    });
  }

  return resultats;
}


module.exports = { PAGES, nomLisible, balayer, SEUIL_PERCEPTIBLE, CONTRASTE_MINIMAL };
