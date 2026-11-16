/* ─────────────────────────────────────────────────────────────────────────────
   LA CARTE DE FRANCE

   La carte porte les noms, pas les nombres : le nombre arrive au clic. Ce
   fichier vérifie ce contrat, et pas seulement que « ça s'affiche » :

     • un point par pôle, et chaque point porte le nom de sa ville ;
     • aucun nom n'en recouvre un autre — huit étiquettes sur 300 px se
       chevauchent vite, et un nom illisible ne vaut pas mieux qu'un absent ;
     • le clic (et la touche Entrée) ouvrent la bulle avec le bon nombre ;
     • l'ancienne liste chiffrée ne revient pas.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function ouvrirCarte(page) {
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.oc .ctitle', { timeout: 20000 });
  await aide.attendre(page, 2000);
  await page.evaluate(() => {
    const b = document.querySelector('#claim-consentement');
    if (b) b.remove();
  });
  await page.waitForFunction(
    () => {
      const s = document.getElementById('carte-france');
      return s && !s.hidden;
    },
    { timeout: 20000 },
  );
  /* L'en-tête est collant : sans ce défilement, un clic sur une ville du haut
     de la carte tombe sur la navigation. */
  await page.evaluate(() => {
    const s = document.getElementById('carte-france');
    window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 110);
  });
  await aide.attendre(page, 400);
}

test('C1 — chaque ville de la carte porte son nom, et les noms ne se recouvrent pas', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirCarte(page);

      const releve = await page.evaluate(() => {
        const villes = [...document.querySelectorAll('.fr-ville')];
        const boites = [...document.querySelectorAll('.fr-etiquette')].map((t) => {
          const b = t.getBBox();
          return { nom: t.textContent, x: b.x, y: b.y, l: b.width, h: b.height };
        });
        const heurts = [];
        for (let i = 0; i < boites.length; i += 1) {
          for (let j = i + 1; j < boites.length; j += 1) {
            const a = boites[i];
            const b = boites[j];
            const croise = a.x < b.x + b.l && b.x < a.x + a.l
              && a.y < b.y + b.h && b.y < a.y + a.h;
            if (croise) heurts.push(`${a.nom} / ${b.nom}`);
          }
        }
        return {
          villes: villes.length,
          noms: boites.map((b) => b.nom),
          heurts,
          liste: Boolean(document.getElementById('fr-liste')),
          libelles: villes.map((v) => v.getAttribute('aria-label')),
        };
      });

      assert.ok(releve.villes >= 3, `la carte n'affiche que ${releve.villes} ville(s)`);
      assert.equal(releve.liste, false, 'l\'ancienne liste chiffrée est revenue');
      assert.equal(releve.noms.length, releve.villes,
        `${releve.villes} villes mais ${releve.noms.length} noms : une ville est muette`);
      assert.deepEqual(releve.heurts, [],
        `des noms se recouvrent : ${releve.heurts.join(', ')}`);

      /* Le nombre reste accessible sans clic : il est dans le libellé
         annoncé par le lecteur d'écran. */
      for (const libelle of releve.libelles) {
        assert.match(libelle || '', /:\s*\d+\s*offre/,
          `l'infobulle d'une ville ne porte pas son nombre : « ${libelle} »`);
      }
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('C2 — un clic sur une ville affiche son nombre', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirCarte(page);

      const cible = await page.evaluate(() => {
        const g = document.querySelector('.fr-ville');
        return { nom: g.dataset.ville, libelle: g.getAttribute('aria-label') };
      });
      const attendu = Number(/: (\d+) offre/.exec(cible.libelle)[1]);

      await page.click(`.fr-ville[data-ville="${cible.nom}"] .fr-point`);
      await aide.attendre(page, 300);

      const apres = await page.evaluate(() => {
        const b = document.getElementById('fr-bulle');
        const r = b.getBoundingClientRect();
        return {
          visible: !b.hidden,
          texte: b.textContent.replace(/\s+/g, ' ').trim(),
          dansEcran: r.left >= -1 && r.right <= window.innerWidth + 1,
        };
      });

      assert.equal(apres.visible, true, 'la bulle ne s\'est pas ouverte');
      assert.ok(apres.texte.includes(String(attendu)),
        `la bulle affiche « ${apres.texte} » au lieu de ${attendu} offre(s)`);
      assert.ok(apres.texte.includes(cible.nom), `la bulle ne nomme pas ${cible.nom}`);
      assert.equal(apres.dansEcran, true, 'la bulle sort de l\'écran');

      /* Un clic ailleurs la referme : une bulle qui reste est un panneau. */
      await page.click('h2#titre-france');
      await aide.attendre(page, 300);
      assert.equal(await page.evaluate(() => document.getElementById('fr-bulle').hidden), true,
        'la bulle reste ouverte après un clic ailleurs');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('C3 — au clavier, Entrée ouvre la même bulle', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirCarte(page);

      await page.evaluate(() => document.querySelector('.fr-ville').focus());
      await page.keyboard.press('Enter');
      await aide.attendre(page, 300);

      const apres = await page.evaluate(() => {
        const b = document.getElementById('fr-bulle');
        return { visible: !b.hidden, texte: b.textContent.replace(/\s+/g, ' ').trim() };
      });
      assert.equal(apres.visible, true, 'Entrée n\'ouvre pas la bulle');
      assert.match(apres.texte, /\d+\s*offre/, `la bulle est vide : « ${apres.texte} »`);

      await page.keyboard.press('Escape');
      await aide.attendre(page, 200);
      assert.equal(await page.evaluate(() => document.getElementById('fr-bulle').hidden), true,
        'Échap ne referme pas la bulle');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('C4 — la carte ne déborde pas sur téléphone', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(PHONE);
    try {
      await ouvrirCarte(page);

      const releve = await page.evaluate(() => {
        const section = document.getElementById('carte-france');
        const svg = section.querySelector('svg').getBoundingClientRect();
        return {
          document: document.documentElement.scrollWidth,
          ecran: document.documentElement.clientWidth,
          svgGauche: Math.round(svg.left),
          svgDroite: Math.round(svg.right),
          hauteur: Math.round(svg.height),
        };
      });

      assert.ok(releve.document <= releve.ecran + 1,
        `la page déborde horizontalement : ${releve.document} > ${releve.ecran}`);
      assert.ok(releve.svgGauche >= 0 && releve.svgDroite <= releve.ecran,
        `la carte sort de l'écran : ${releve.svgGauche} → ${releve.svgDroite} sur ${releve.ecran}`);
      assert.ok(releve.hauteur > 200, `la carte est écrasée : ${releve.hauteur} px de haut`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
