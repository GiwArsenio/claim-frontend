/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A07 — Réactions au survol

   Le constat de départ : en mode nuit, les filtres sous la barre de
   recherche ne réagissent pas, alors que le bouton « Postuler » réagit
   bien — mais ce dernier change de couleur d'une façon qui rend son
   texte illisible.

   Deux exemples ne suffisent pas à conclure. Ce test balaie TOUS les
   éléments interactifs des deux pages, en mode jour ET en mode nuit, et
   exige de chacun :
   - une réaction PERCEPTIBLE (ΔE >= 2,3 en CIE Lab) ;
   - une lisibilité qui ne se dégrade pas au survol (contraste >= 4,5).

   La seconde exigence est la plus importante. Un survol qui rend le texte
   illisible est un défaut, même s'il est spectaculaire : c'est
   exactement ce que fait « Postuler » en mode nuit.

   Le seuil ΔE et non une soustraction de luminance : sur un fond sombre,
   une variation de 0,02 de luminance se voit ; sur un fond clair, elle
   ne se voit pas. Le ΔE est l'écart perceptif standardisé.

   L'audit teste l'INTERACTION, pas une couleur : il déplace réellement la
   souris et relit l'état calculé. Un test qui comparerait des chaînes de
   style ne verrait pas un survol qui n'existe pas.
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

/* ── 1. Tout élément interactif réagit au survol ────────────────────────── */

test('A07 — tout élément interactif réagit au survol', async (t) => {
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
            await aide.attendre(page, 1800);

            /* Le bandeau de consentement masque le bas de la page. Il
               n'est pas un défaut de survol : on l'accepte, et on mesure
               ce qui est réellement atteignable. */
            await page.evaluate(() => {
              const b = document.querySelector('#claim-consentement');
              if (b) b.remove();
            });
            await page.waitForTimeout(300);

            if (p.nom === 'board') {
              const carte = page.locator('#feed .jc, #feed .oc').first();
              if (await carte.count()) {
                await carte.click();
                await aide.attendre(page, 1800);
              }
            }

            const resultats = await balayer(page);

            /* Les éléments dont le survol est masqué par un overlay ne
               sont pas jugés : on ne peut pas les survoler. */
            const jouables = resultats.filter((r) => !r.bloque);

            /* Un champ de saisie reagit au FOCUS, pas au survol.
               Changer d'apparence au passage de la souris sur un champ
               serait un anti-pattern : l'utilisateur ne peut pas agir
               sur ce qu'il ne peut pas voir. Le focus est verifie par la
               famille A04 — ici, on ne juge pas les champs sur le
               survol. */
            const muets = jouables.filter((r) => {
              if (r.estChamp) return false;
              const max = Math.max(r.dFond, r.dTexte, r.dBord, r.dBordBas);
              return max < SEUIL_PERCEPTIBLE && !r.dSoulignement &&
                     !r.dFiltre && !r.dDecalage;
            });

            assert.equal(
              muets.length, 0,
              `${p.nom} / ${theme} : ${muets.length} élément(s) ne réagissent PAS au survol — ` +
              JSON.stringify(muets.map((r) => ({
                element: nomLisible(r),
                chemin: r.chemin.slice(-60),
                dFond: Math.round(r.dFond * 10) / 10,
                dTexte: Math.round(r.dTexte * 10) / 10,
                dBord: Math.round(r.dBord * 10) / 10,
              })))
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

/* ── 2. Le survol ne rend jamais le texte illisible ──────────────────────── */

test('A07 — le survol ne dégrade jamais la lisibilité', async (t) => {
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
            await aide.attendre(page, 1800);

            await page.evaluate(() => {
              const b = document.querySelector('#claim-consentement');
              if (b) b.remove();
            });
            await page.waitForTimeout(300);

            if (p.nom === 'board') {
              const carte = page.locator('#feed .jc, #feed .oc').first();
              if (await carte.count()) {
                await carte.click();
                await aide.attendre(page, 1800);
              }
            }

            const resultats = await balayer(page);
            const jouables = resultats.filter((r) => !r.bloque);

            /* Un élément dont le texte est déja illisible au repos n'est
               pas l'objet de ce test : c'est la famille A04 qui le juge.
               On ne signale que ce que le SURVOL dégrade. */
            const degrades = jouables.filter(
              (r) => !r.estChamp &&
                     r.apres.contrasteTexte < CONTRASTE_MINIMAL &&
                     r.avant.contrasteTexte >= CONTRASTE_MINIMAL
            );

            assert.equal(
              degrades.length, 0,
              `${p.nom} / ${theme} : le survol rend ${degrades.length} texte(s) ` +
              `illisible(s) — ` +
              JSON.stringify(degrades.map((r) => ({
                element: nomLisible(r),
                contrasteAvant: r.avant.contrasteTexte,
                contrasteApres: r.apres.contrasteTexte,
                fondApres: r.apres.fond,
              })))
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

/* ── 3. La réaction de survol est comparable entre les deux thèmes ──────── */

test('A07 — un élément réagit aussi bien en nuit qu\'en jour', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    /* Un élément qui réagit fort le jour et à peine la nuit est un
       défaut du thème, pas uneFatalité : l'utilisateur qui bascule en
       mode nuit perd le signal. */
    const parPage = {};

    for (const p of PAGES) {
      parPage[p.nom] = {};

      for (const theme of ['jour', 'nuit']) {
        const options = theme === 'nuit' ? { theme: 'nuit' } : {};
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, options);

        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1800);

          await page.evaluate(() => {
            const b = document.querySelector('#claim-consentement');
            if (b) b.remove();
          });
          await page.waitForTimeout(300);

          if (p.nom === 'board') {
            const carte = page.locator('#feed .jc, #feed .oc').first();
            if (await carte.count()) {
              await carte.click();
              await aide.attendre(page, 1800);
            }
          }

          const resultats = await balayer(page);

          for (const r of resultats) {
            if (r.bloque) continue;
            const max = Math.max(r.dFond, r.dTexte, r.dBord, r.dBordBas);
            const cle = r.chemin + '|' + (r.texte || '').slice(0, 20);
            const precedent = parPage[p.nom][cle];
            if (precedent === undefined || max > precedent.max) {
              parPage[p.nom][cle] = { max, theme, element: nomLisible(r), chemin: r.chemin };
            }
          }
        } finally {
          await ctx.close();
        }
      }
    }

    /* On compare les éléments présents dans les deux mesures. */
    const ecarts = [];

    for (const p of PAGES) {
      /* On re-mesure pour apparier : le balayage de chaque thème a
         produit son propre jeu. On refait une passe par thème en
         gardant les éléments. */
      const parTheme = {};

      for (const theme of ['jour', 'nuit']) {
        const options = theme === 'nuit' ? { theme: 'nuit' } : {};
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, options);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1800);
          await page.evaluate(() => {
            const b = document.querySelector('#claim-consentement');
            if (b) b.remove();
          });
          await page.waitForTimeout(300);
          if (p.nom === 'board') {
            const carte = page.locator('#feed .jc, #feed .oc').first();
            if (await carte.count()) {
              await carte.click();
              await aide.attendre(page, 1800);
            }
          }

          const resultats = await balayer(page);
          parTheme[theme] = new Map();
          for (const r of resultats) {
            if (r.bloque) continue;
            const cle = r.chemin + '|' + (r.texte || '').slice(0, 20);
            parTheme[theme].set(cle, {
              max: Math.max(r.dFond, r.dTexte, r.dBord, r.dBordBas),
              dFond: r.dFond,
              element: nomLisible(r),
              chemin: r.chemin,
            });
          }
        } finally {
          await ctx.close();
        }
      }

      for (const [cle, nuit] of parTheme.nuit) {
        const jour = parTheme.jour.get(cle);
        if (!jour) continue;

        /* Le lien de navigation ACTIF porte deja un soulignement de
           2 px : c'est lui qui dit a l'utilisateur qu'il est sur la page
           courante. Le survol n'a pas a le reaffirmer - il doit juste ne
           pas le supprimer. On ne le juge donc pas sur ce critere. */
        if (nuit.chemin.indexOf('nav-links a.on') !== -1) continue;

        /* On ne juge que ce qui réagit nettement le jour : un élément
           marginal le jour ne peut pas être « encore plus marginal »
           la nuit sans que ce soit un défaut. */
        if (jour.max < 6) continue;

        /* Le rapport de la nuit ne doit pas s'effondrer. On tolère que la
           nuit soit un peu moins vive : ce qui compte est qu'elle reste
           visible. */
        if (nuit.max < Math.max(SEUIL_PERCEPTIBLE, jour.max * 0.5)) {
          ecarts.push({
            page: p.nom,
            element: nuit.element,
            chemin: nuit.chemin.slice(-50),
            jour: Math.round(jour.max * 10) / 10,
            nuit: Math.round(nuit.max * 10) / 10,
          });
        }
      }
    }

    assert.equal(
      ecarts.length, 0,
      `${ecarts.length} élément(s) réagissent nettement moins en mode nuit qu'en jour — ` +
      JSON.stringify(ecarts.slice(0, 8))
    );
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
