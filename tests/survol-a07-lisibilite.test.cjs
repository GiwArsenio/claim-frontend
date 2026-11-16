/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A07 — le survol ne degrade jamais la lisibilite.

   Un survol qui rend le texte illisible est un defaut, meme s'il est
   spectaculaire : c'est exactement ce que faisait « Postuler » en mode nuit.

   Ce fichier juge le CONTRASTE au survol, et compare les deux themes. La
   reaction elle-meme est jugee par survol-a07-reaction.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const { PAGES, nomLisible, balayer, SEUIL_PERCEPTIBLE, CONTRASTE_MINIMAL } = require('./survol-a07-aide.cjs');

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

