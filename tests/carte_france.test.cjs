/* ─────────────────────────────────────────────────────────────────────────────
   LA CARTE DE FRANCE

   La section dit « partout en France ». Elle doit le prouver : des points
   aux coordonnées des villes, une taille qui suit le nombre d'offres, et des
   nombres qui viennent de l'API — pas d'une illustration décorative.

   Ce fichier vérifie trois choses :
     • la section n'apparaît que si les données arrivent (sinon elle reste
       cachée, plutôt que d'afficher une carte vide) ;
     • points et liste racontent la même chose, dans le même ordre ;
     • le plus gros pôle a le plus gros point, et rien ne déborde.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function ouvrirAccueil(page) {
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.oc .ctitle', { timeout: 20000 });
  await aide.attendre(page, 2000);
  await page.evaluate(() => {
    const b = document.querySelector('#claim-consentement');
    if (b) b.remove();
  });
  /* La carte demande un total par ville : treize requetes. On laisse le
     temps qu'elles reviennent avant de mesurer. */
  await page.waitForFunction(
    () => {
      const s = document.getElementById('carte-france');
      return s && !s.hidden;
    },
    { timeout: 20000 },
  );
  await aide.attendre(page, 300);
}

test('C1 — la carte apparaît, avec un point par pôle', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);

      const releve = await page.evaluate(() => {
        const points = [...document.querySelectorAll('#fr-points .fr-point')];
        const lignes = [...document.querySelectorAll('#fr-liste li')];
        return {
          points: points.length,
          lignes: lignes.length,
          rayons: points.map((c) => Number(c.getAttribute('r'))),
          titres: points.map((c) => (c.querySelector('title') || {}).textContent || ''),
          noms: lignes.map((li) => (li.querySelector('.fr-nom') || {}).textContent || ''),
          nombres: lignes.map((li) => Number((li.querySelector('.fr-n') || {}).textContent)),
        };
      });

      assert.ok(releve.points >= 3, `la carte n'affiche que ${releve.points} point(s)`);
      assert.equal(releve.lignes, releve.points,
        `${releve.points} points mais ${releve.lignes} lignes : les deux ne racontent pas la même chose`);

      /* Chaque ligne porte un nombre, et chaque point le même dans son
         infobulle. */
      for (let i = 0; i < releve.points; i += 1) {
        const attendu = releve.nombres[i];
        assert.ok(Number.isFinite(attendu) && attendu > 0,
          `« ${releve.noms[i]} » n'a pas de nombre : ${releve.nombres[i]}`);
        assert.ok(releve.titres[i].includes(String(attendu)),
          `l'infobulle du point ${i} ne porte pas le nombre de la ligne : "${releve.titres[i]}"`);
      }

      /* Le plus gros pôle a le plus gros point, et le plus petit le plus
         petit — la taille veut dire quelque chose. */
      const rayons = releve.rayons;
      assert.equal(rayons[0], Math.max(...rayons), 'le premier pôle n\'a pas le plus gros point');
      assert.ok(rayons[0] > rayons[rayons.length - 1],
        `les points ne varient pas avec le nombre : ${JSON.stringify(rayons)}`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('C2 — la carte ne déborde pas sur téléphone', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(PHONE);
    try {
      await ouvrirAccueil(page);

      const releve = await page.evaluate(() => {
        const section = document.getElementById('carte-france');
        const r = section.getBoundingClientRect();
        const svg = section.querySelector('svg').getBoundingClientRect();
        return {
          document: document.documentElement.scrollWidth,
          ecran: document.documentElement.clientWidth,
          sectionDroite: Math.round(r.right),
          svgDroite: Math.round(svg.right),
          svgGauche: Math.round(svg.left),
          hauteur: Math.round(svg.height),
        };
      });

      assert.ok(releve.document <= releve.ecran + 1,
        `la page déborde horizontalement : ${releve.document} > ${releve.ecran}`);
      assert.ok(releve.svgGauche >= 0 && releve.svgDroite <= releve.ecran,
        `la carte sort de l'écran : ${releve.svgGauche} → ${releve.svgDroite} sur ${releve.ecran}`);
      assert.ok(releve.hauteur > 150,
        `la carte est écrasée : ${releve.hauteur} px de haut`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
