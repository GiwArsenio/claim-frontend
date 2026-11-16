/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A07 — tout element interactif reagit au survol.

   Le constat de depart : en mode nuit, les filtres sous la barre de
   recherche ne reagissent pas, alors que le bouton « Postuler » reagit
   bien — mais ce dernier change de couleur d'une facon qui rend son texte
   illisible.

   Ce fichier juge la REACTION : chaque element interactif doit produire un
   ecart perceptible (delta E >= 2,3). La lisibilite de ce survol est jugee
   par survol-a07-lisibilite.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const { PAGES, nomLisible, balayer, SEUIL_PERCEPTIBLE } = require('./survol-a07-aide.cjs');

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

