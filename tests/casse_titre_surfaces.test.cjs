/* ─────────────────────────────────────────────────────────────────────────────
   LA CASSE DE TITRE, SUR CHAQUE SURFACE

   La règle est unique (assets/casse-titre.js), mais elle ne s'applique que
   là où on l'appelle. Le 16 novembre, l'accueil ne l'appelait pas : ses six
   offres affichaient le titre brut de la source, alors que le board et la
   fiche le mettaient en casse. Ce fichier tient cette liste à jour.

   Les titres viennent des fixtures (tests/fixtures/offres.cjs) :
   « Actuaire confirmé (H/F) — risques Non-Vie », « Chargé d’études
   actuarielles » — de quoi éprouver la majuscule initiale, l'apostrophe
   typographique et les sigles.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

/** Ouvre une page et rend les titres d'offres qu'elle affiche. */
async function titresAffiches(page, url, selecteur, attente = 2200) {
  await page.goto(aide.BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(selecteur, { timeout: 20000 });
  await aide.attendre(page, attente);
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((t) => t.textContent.trim()), selecteur);
}

/** Les défauts qu'on ne veut plus voir sur aucun titre. */
function defauts(titres) {
  const constats = [];
  for (const t of titres) {
    if (!t) continue;
    const premier = [...t][0];
    if (premier && premier !== premier.toLocaleUpperCase('fr')) {
      constats.push(`ne commence pas par une majuscule : « ${t} »`);
    }
    if (t.length > 3 && t === t.toLocaleUpperCase('fr')) {
      constats.push(`reste tout en capitales : « ${t} »`);
    }
    /* Après une élision, le nom prend la majuscule : « d'Études ». */
    const elision = /[dlsncmjt]['’]([a-zà-ÿ])/u.exec(t);
    if (elision) {
      constats.push(`minuscule après une élision : « ${t} »`);
    }
  }
  return constats;
}

test("A — les titres de l'accueil passent par la casse de titre", async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      const titres = await titresAffiches(page, '/index.html', '.oc .ctitle');
      assert.ok(titres.length >= 3, `l'accueil n'affiche pas ses offres : ${JSON.stringify(titres)}`);

      const constats = defauts(titres);
      assert.deepEqual(constats, [], `l'accueil affiche des titres non mis en casse :\n  ${constats.join('\n  ')}`);

      /* Le cas qui a motivé ce fichier : l'apostrophe typographique. */
      assert.ok(
        titres.some((t) => /d['’]É/u.test(t)),
        `aucun titre n'illustre la règle d'élision : ${JSON.stringify(titres)}`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A — les titres du board passent par la casse de titre', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      const titres = await titresAffiches(page, '/job-board.html', '.jc .ctitle');
      assert.ok(titres.length >= 3, `le board n'affiche pas ses offres : ${JSON.stringify(titres)}`);

      const constats = defauts(titres);
      assert.deepEqual(constats, [], `le board affiche des titres non mis en casse :\n  ${constats.join('\n  ')}`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
