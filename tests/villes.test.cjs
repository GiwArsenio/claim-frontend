/* ─────────────────────────────────────────────────────────────────────────────
   LES VILLES DE L'ACCUEIL

   Quatre cartes en photo, les autres villes en pastilles. Ce fichier vérifie
   ce que la section promet :

     • quatre cartes, chacune avec son nom, son bouton et une photo qui
       charge vraiment (une image cassée laisse une case grise) ;
     • chaque carte et chaque pastille mène au board filtré par sa ville —
       « Voir les offres » sans destination ne serait qu'un décor ;
     • aucun chiffre : la section a été demandée sans compteurs ;
     • rien ne déborde sur téléphone.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function ouvrirAccueil(page) {
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.oc .ctitle', { timeout: 20000 });
  await aide.attendre(page, 1200);
  await page.evaluate(() => {
    const b = document.querySelector('#claim-consentement');
    if (b) b.remove();
  });
  await page.waitForSelector('#carte-france', { timeout: 10000 });
  /* Les images sont en chargement différé : on les force pour pouvoir
     mesurer leur taille réelle. */
  await page.evaluate(async () => {
    document.querySelectorAll('#carte-france img').forEach((i) => { i.loading = 'eager'; });
    await Promise.all([...document.querySelectorAll('#carte-france img')]
      .map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
  });
  await aide.attendre(page, 300);
}

test('V1 — quatre cartes en photo, nommées et cliquables', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);

      const releve = await page.evaluate(() => [...document.querySelectorAll('.ville-carte')].map((a) => {
        const img = a.querySelector('img');
        return {
          nom: (a.querySelector('.ville-nom') || {}).textContent || '',
          bouton: (a.querySelector('.ville-btn') || {}).textContent || '',
          href: a.getAttribute('href') || '',
          nomAccessible: a.textContent.replace(/\s+/g, ' ').trim(),
          largeur: img ? img.naturalWidth : 0,
          alt: img ? img.getAttribute('alt') : null,
        };
      }));

      assert.equal(releve.length, 4, `${releve.length} carte(s) au lieu de 4`);

      for (const c of releve) {
        assert.ok(c.nom.length > 2, 'une carte n\'a pas de nom');
        assert.match(c.bouton, /Voir les offres/i, `« ${c.nom} » n'a pas de bouton`);
        assert.match(c.href, /job-board\.html\?city=/, `« ${c.nom} » ne mène pas au board filtré : ${c.href}`);
        /* Le nom accessible vient du CONTENU : un aria-label qui ne reprend
           pas le texte visible est une violation (WCAG 2.5.3). */
        assert.match(c.nomAccessible, new RegExp(c.nom, 'i'),
          `« ${c.nom} » n'est pas nommée par son contenu`);
        assert.ok(c.largeur > 0, `la photo de « ${c.nom} » n'a pas chargé`);
        /* Une photo décorative : le nom de la ville est déjà dans le texte. */
        assert.equal(c.alt, '', `l'image de « ${c.nom} » ne devrait pas être annoncée`);
      }
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('V2 — les autres villes sont en pastilles, chacune vers son board', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);

      const puces = await page.evaluate(() => [...document.querySelectorAll('.ville-puce')].map((a) => ({
        nom: a.textContent.trim(),
        href: a.getAttribute('href') || '',
      })));

      assert.ok(puces.length >= 4, `seulement ${puces.length} pastille(s)`);
      for (const p of puces) {
        assert.ok(p.nom.length > 2, 'une pastille est vide');
        assert.match(p.href, /job-board\.html\?city=/, `« ${p.nom} » ne mène pas au board : ${p.href}`);
      }

      /* Aucune ville ne doit figurer deux fois : une carte et une pastille
         pour la même ville, c'est deux fois le même lien. */
      const cartes = await page.evaluate(() =>
        [...document.querySelectorAll('.ville-nom')].map((e) => e.textContent.trim().toLowerCase()));
      const doublons = puces.filter((p) => cartes.includes(p.nom.toLowerCase()));
      assert.deepEqual(doublons, [], `villes en double : ${doublons.map((d) => d.nom).join(', ')}`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('V3 — la section n\'affiche aucun chiffre', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);

      const textes = await page.evaluate(() => {
        const zone = (s) => [...document.querySelectorAll(s)]
          .map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' ');
        return {
          cartes: zone('.villes .ville-carte'),
          pastilles: zone('.villes-liste .ville-puce'),
          sousTitre: (document.querySelector('#carte-france .tete p') || {}).textContent || '',
        };
      });

      for (const [ou, texte] of Object.entries(textes)) {
        assert.doesNotMatch(texte, /\d/, `des chiffres traînent dans « ${ou} » : ${texte}`);
      }
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('V4 — sur téléphone, deux colonnes et rien qui déborde', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(PHONE);
    try {
      await ouvrirAccueil(page);

      const releve = await page.evaluate(() => {
        const cartes = [...document.querySelectorAll('.ville-carte')];
        const tops = cartes.map((c) => Math.round(c.getBoundingClientRect().top));
        return {
          document: document.documentElement.scrollWidth,
          ecran: document.documentElement.clientWidth,
          rangees: new Set(tops).size,
          largeur: Math.round(cartes[0].getBoundingClientRect().width),
          hauteur: Math.round(cartes[0].getBoundingClientRect().height),
        };
      });

      assert.ok(releve.document <= releve.ecran + 1,
        `la page déborde : ${releve.document} > ${releve.ecran}`);
      assert.equal(releve.rangees, 2, `les cartes tiennent sur ${releve.rangees} rangée(s) au lieu de 2`);
      assert.ok(releve.largeur > 130, `les cartes sont écrasées : ${releve.largeur} px de large`);
      assert.ok(releve.hauteur > 90, `les cartes sont écrasées : ${releve.hauteur} px de haut`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
