/* ─────────────────────────────────────────────────────────────────────────────
   AUDIT DE SURVOL — tous les éléments interactifs, un par un

   Le constat de départ : en mode nuit, les filtres sous la barre de
   recherche ne reagissent pas, alors que le bouton « Postuler » reagit
   bien. Deux exemples ne suffisent pas : il faut parcours TOUS les
   elements interactifs et mesurer ce qui change reellement.

   Cet outil balaie la page, survole chaque element SEUL (jamais deux a
   la fois : deux survols qui se chevauchent fausseraient la lecture), et
   classe la reaction par intensite.

   Usage : node tests/audit-survol.cjs [jour|nuit]
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const aide = require('./aide-parcours.cjs');
const survol = require('./mesures-survol.cjs');

const PAGES = [
  { nom: 'accueil', url: '/index.html' },
  { nom: 'board', url: '/job-board.html' },
];

const THEME = process.argv[2] || 'nuit';

(async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      const options = THEME === 'nuit' ? { theme: 'nuit' } : {};
      const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, options);

      try {
        await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
        await aide.attendre(page, 1800);
        await survol.preparerSurvol(page);

        /* On ouvre une fiche sur le board : le bouton « Postuler » n'est
           visible que dans la fiche. C'est un des deux elements signales,
           il doit etre mesure comme les autres. */
        if (p.nom === 'board') {
          const carte = page.locator('#feed .jc, #feed .oc').first();
          if (await carte.count()) {
            await carte.click();
            await aide.attendre(page, 1800);
          }
        }

        const elements = await page.evaluate(() => window.__SURVOL__.elementsInteractifs());
        console.log(`\n════════ ${p.nom} / ${THEME} — ${elements.length} élément(s) interactif(s) ════════`);

        const resultats = [];

        for (const el of elements) {
          const chemin = el.chemin;
          /* L'element est designe par son identifiant unique : le chemin
             ne distingue pas deux liens de navigation identiques. */
          const cible = `[data-survol="${el.id}"]`;

          /* Ce qui est RÉELLEMENT sous la souris.
             Un overlay — le bandeau de consentement, un tiroir — peut
             capter le survol : le pointeur est alors sur l'overlay, et
             l'element d'en dessous ne recoit aucun :hover. Conclure
             « cet element ne reagit pas » serait faux : il ne peut pas
             reagir, on ne le survole pas. */
          const sous = await page.evaluate((c) => {
            const el = document.querySelector(c);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const top = document.elementFromPoint(x, y);
            if (!top) return { bloque: true, par: 'rien', element: el.id };
            /* Le survol atteint l'element si le point touche l'element
               lui-meme, un descendant, ou un ancetre. */
            const atteint = top === el || el.contains(top) || top.contains(el);
            return {
              bloque: !atteint,
              par: window.__SURVOL__.cheminDe(top),
              element: el.id,
            };
          }, cible);

          /* On relève l'état de repos puis on survole. */
          const avant = await page.evaluate((c) => {
            const el = document.querySelector(c);
            return el ? window.__SURVOL__.relever(el) : null;
          }, cible);

          if (!avant) continue;

          await page.mouse.move(el.x, el.y);
          await page.waitForTimeout(260);

          const apres = await page.evaluate((c) => {
            const el = document.querySelector(c);
            return el ? window.__SURVOL__.relever(el) : null;
          }, cible);

          await page.mouse.move(2, 2);
          await page.waitForTimeout(140);

          if (!apres) continue;

          const i = survol.intensite({ avant, apres, selecteur: chemin });
          resultats.push({
            chemin, texte: el.texte, balise: el.balise, avant, apres, ...i,
            bloque: sous ? sous.bloque : false,
            bloquePar: sous ? sous.par : null,
          });
        }

        /* Classement : du plus visible au plus invisible. */
        const ordre = { marquante: 0, perceptible: 1, invisible: 2 };
        resultats.sort((a, b) => (ordre[a.classe] - ordre[b.classe]) ||
          (Math.max(b.dFond, b.dTexte, b.dBord, b.dBordBas) -
           Math.max(a.dFond, a.dTexte, a.dBord, a.dBordBas)));

        for (const r of resultats) {
          const details = [];
          if (r.dFond > 0.5) details.push(`fond ${r.avant.fond}→${r.apres.fond} (ΔE ${r.dFond.toFixed(1)})`);
          if (r.dTexte > 0.5) details.push(`texte ${r.avant.texte}→${r.apres.texte} (ΔE ${r.dTexte.toFixed(1)})`);
          if (r.dBord > 0.5) details.push(`bord ${r.avant.bordCouleur}→${r.apres.bordCouleur} (ΔE ${r.dBord.toFixed(1)})`);
          if (r.dBordBas > 0.5) details.push(`bord du bas ${r.avant.bordBasCouleur}→${r.apres.bordBasCouleur} (ΔE ${r.dBordBas.toFixed(1)})`);
          if (r.dDecalage) details.push('decalage/ombre');
          if (r.dSoulignement) details.push('soulignement');
          if (r.dFiltre) details.push(`filtre ${r.apres.filter}`);

          const marque = r.classe === 'invisible' ? '✖' : (r.classe === 'marquante' ? '●' : '○');
          const bloquant = r.bloque ? ` [SURVOL MASQUÉ par ${r.bloquePar}]` : '';
          console.log(
            `  ${marque} [${r.classe.padEnd(11)}] ${r.chemin.slice(0, 52).padEnd(52)} ` +
            `"${r.texte.slice(0, 22)}"` +
            (details.length ? ' → ' + details.join(', ') : ' → AUCUNE CHANGEMENT') +
            bloquant
          );
        }

        const stats = {
          marquante: resultats.filter((r) => r.classe === 'marquante').length,
          perceptible: resultats.filter((r) => r.classe === 'perceptible').length,
          invisible: resultats.filter((r) => r.classe === 'invisible').length,
          masques: resultats.filter((r) => r.bloque).length,
        };
        console.log(`  ── marquante ${stats.marquante} · perceptible ${stats.perceptible} · ` +
          `invisible ${stats.invisible} · dont survol masqué ${stats.masques}`);

        /* LES MUETS : aucun changement perceptible. */
        /* La bordure du BAS compte aussi : c'est elle qui distingue le
           lien de navigation actif, dont la couleur de texte ne change
           pas. Sans elle, le rapport concluait a tort qu'un element ne
           reagissait pas. */
        const muets = resultats.filter((r) => !r.bloque &&
          Math.max(r.dFond, r.dTexte, r.dBord, r.dBordBas) < 2.3 &&
          !r.dSoulignement && !r.dFiltre && !r.dDecalage);
        if (muets.length) {
          console.log('  ▸ SANS RÉACTION :');
          for (const r of muets) {
            console.log(`      ${r.chemin.slice(-46).padEnd(46)} "${(r.texte||'').replace(/\s+/g,' ').trim().slice(0,24)}"`);
          }
        }

        /* LES ILLISIBLES : le survol fait passer le texte sous 4,5. */
        const illisibles = resultats.filter((r) => !r.bloque &&
          r.apres.contrasteTexte < 4.5 && r.avant.contrasteTexte >= 4.5);
        if (illisibles.length) {
          console.log('  ▸ SURVOL REND ILLISIBLE :');
          for (const r of illisibles) {
            console.log(`      ${r.chemin.slice(-46).padEnd(46)} ` +
              `contraste ${r.avant.contrasteTexte}→${r.apres.contrasteTexte} ` +
              `fond ${r.avant.fond}→${r.apres.fond}`);
          }
        }
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
})();
