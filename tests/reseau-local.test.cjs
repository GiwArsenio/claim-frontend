/* ─────────────────────────────────────────────────────────────────────────────
   VÉRIFICATION — Aucune sortie réseau dans les suites locales

   Le catalogue (4.2) l'exige : « Interdire le réseau externe dans les
   suites A et B ». Une suite locale qui joint la production ne verifie pas
   ce que la production fait au moment du test : elle verifie ce qu'elle
   faisait quand le test a passe. Le resultat depend alors d'un service
   que personne ne controle dans la chaine.

   Ce test ne se contente pas de dire que le garde existe. Il PROUVE
   qu'il fonctionne : on demande une ressource externe, et on verifie
   qu'elle est coupee et que la tentative est tracee.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

test('le garde réseau coupe toute sortie extérieure', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1500);

      /* Les tentatives sont tracees : c'est ce qui permet de dire
         "aucune sortie n'a ete tentee", et pas seulement "aucune sortie
         n'a abouti". */
      const avant = page.appelsExternes.length;

      const resultat = await page.evaluate(async () => {
        try {
          const r = await fetch('https://exemple-inexistant.test/sonde', {
            mode: 'no-cors',
          });
          return { ok: true, type: r.type };
        } catch (e) {
          return { ok: false, message: String(e.message || e) };
        }
      });

      assert.equal(
        resultat.ok, false,
        'la requete vers l\'exterieur a abouti : le garde reseau ne fonctionne pas'
      );

      const apres = page.appelsExternes.length;
      assert.ok(
        apres > avant,
        'la tentative de sortie n\'a pas ete tracee : on ne peut pas affirmer ' +
        'que le test n\'a rien tente'
      );

      const tracee = page.appelsExternes[apres - 1];
      assert.equal(
        tracee.autorise, false,
        'la ressource externe a ete consideree comme autorisee'
      );
      assert.ok(
        tracee.url.includes('exemple-inexistant.test'),
        `la trace ne correspond pas à la tentative : "${tracee.url}"`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('les pages ne sortent pas vers la production pendant une suite locale', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const url of ['/index.html', '/job-board.html']) {
      const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
      try {
        await page.goto(aide.BASE + url, { waitUntil: 'domcontentloaded' });
        await aide.attendre(page, 2000);

        /* Le garde trace TOUT ce qu'il coupe — polices, logos, mesure
           d'audience. C'est la preuve qu'il agit. Ce qu'on verifie ici,
           c'est qu'aucune sortie n'a abouti : tout ce qui a ete demande
           hors du serveur local a ete refuse. */
        const sorties = page.appelsExternes.filter((a) => !a.url.startsWith(aide.BASE));
        const abouties = sorties.filter((a) => a.autorise);
        assert.deepEqual(
          abouties.map((a) => a.url),
          [],
          `${url} : des ressources externes ont abouti : ${JSON.stringify(abouties)}`
        );

        /* Aucune demande ne doit avoir ete envoyee a la production. */
        const production = sorties.filter((a) => a.url.includes('railway.app'));
        assert.equal(
          production.length, 0,
          `${url} : des appels sont alles vers la production : ${JSON.stringify(production)}`
        );
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('la base d\'API injectée remplace bien la production', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 2000);

      const base = await page.evaluate(() => window.CLAIM_API_BASE);
      assert.ok(
        base && base.startsWith('http://127.0.0.1:'),
        `la base d'API injectee n'est pas le serveur local : "${base}"`
      );

      /* Aucun appel ne doit viser la production. */
      const production = page.appelsExternes.filter((a) =>
        a.url.includes('railway.app')
      );
      assert.equal(
        production.length, 0,
        `des appels sont alles vers la production : ${JSON.stringify(production)}`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
