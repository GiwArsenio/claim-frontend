/* ─────────────────────────────────────────────────────────────────────────────
   ACCUEIL — états de chargement et d'erreur

   Le défaut : quand l'API tombe, « Chargement… » restait affiché à côté du
   message d'erreur (il n'était remplacé qu'en cas de succès), et rien ne
   permettait de réessayer.

   Ce qu'on vérifie, dans un vrai navigateur, sur le serveur de fixtures dont
   on provoque la panne par le canal /__controle__ :

   1. Panne des offres : UN seul message d'état visible, en français, sans
      « Chargement… » ni détail technique ; un bouton « Réessayer » atteint au
      clavier ; le conteneur n'est plus « occupé » (aria-busy).
   2. « Réessayer » relance le chargement et affiche les offres une fois la
      panne terminée ; un nouvel échec laisse un bouton et rend le focus.
   3. Pendant le chargement, le conteneur est « occupé » ; il ne l'est plus après.
   4. Panne des chiffres : « — » (ni vide, ni 0), et la mise en page ne bouge
      pas quand les chiffres reviennent.

   Usage : node tests/accueil_etat_erreur.test.cjs
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

/* La panne est provoquée par le test : le 500 et le message qui l'annonce sont
   attendus. Toute autre erreur serait un vrai défaut de la page. */
const attendue = (e) =>
  /500 \(Internal Server Error\)/.test(e) || /(offres|chiffres) indisponibles/.test(e);

async function etatSection(page) {
  return page.evaluate(() => {
    const section = document.getElementById('dernieres-offres');
    const liste = document.getElementById('liste');
    const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    return {
      texte: section.innerText,
      compte: document.getElementById('compte-offres').textContent.trim(),
      busy: liste.getAttribute('aria-busy'),
      cartes: liste.querySelectorAll('a.oc').length,
      bouton: !!document.getElementById('offres-reessayer'),
      boutonVisible: visible(document.getElementById('offres-reessayer')),
      messagesVides: liste.querySelectorAll('.vide').length,
    };
  });
}

async function ouvrir(format = aide.FORMATS.bureau) {
  const { ctx, page } = await aide.ouvrirPage(format);
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await aide.attendre(page, 600);
  return { ctx, page };
}

test('accueil — panne des offres : un seul message, en français, avec « Réessayer »', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    await aide.controler({ reset: true, pannes: ['/jobs/selection'] });
    const { ctx, page } = await ouvrir();
    try {
      const e = await etatSection(page);

      assert.ok(!/Chargement/i.test(e.texte),
        `« Chargement… » reste affiché pendant la panne : ${JSON.stringify(e.texte)}`);
      assert.equal(e.messagesVides, 1, 'il doit y avoir exactement un message d\'état dans la liste');
      assert.match(e.texte, /Les offres ne se chargent pas pour l'instant\./);
      assert.equal(e.compte, '', 'le compte du titre doit être vidé (un seul message visible)');
      assert.ok(!/HTTP|Failed|fetch|Error|Erreur|500|undefined/i.test(e.texte),
        `texte technique ou anglais visible : ${JSON.stringify(e.texte)}`);
      assert.equal(e.busy, null, 'aria-busy doit être retiré après l\'échec');
      assert.ok(e.bouton && e.boutonVisible, 'le bouton « Réessayer » est absent ou invisible');
      assert.equal(await page.locator('#offres-reessayer').evaluate((b) => b.tagName + ':' + b.type),
        'BUTTON:button');
      assert.equal((await page.locator('#offres-reessayer').textContent()).trim(), 'Réessayer');

      /* Le clavier atteint le bouton. */
      let atteint = false;
      for (let i = 0; i < 80 && !atteint; i++) {
        await page.keyboard.press('Tab');
        atteint = await page.evaluate(() => document.activeElement && document.activeElement.id === 'offres-reessayer');
      }
      assert.ok(atteint, 'le bouton « Réessayer » n\'est pas atteint au clavier');

      const inattendues = page.erreurs.filter((x) => !attendue(x));
      assert.deepEqual(inattendues, [], 'erreur inattendue : ' + inattendues.join(' | '));
    } finally { await ctx.close(); }
  } finally {
    await aide.reinitialiserControle();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('accueil — « Réessayer » relance et affiche les offres quand la panne cesse', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    await aide.controler({ reset: true, pannes: ['/jobs/selection'] });
    const { ctx, page } = await ouvrir();
    try {
      /* Réessai pendant que la panne dure : le bouton revient, avec le focus. */
      await aide.avecReponse(page, (r) => /\/jobs\/selection/.test(r.url()),
        () => page.click('#offres-reessayer'));
      await page.waitForFunction(() => document.getElementById('offres-reessayer') &&
        document.activeElement === document.getElementById('offres-reessayer'), null, { timeout: 5000 });
      let e = await etatSection(page);
      assert.ok(!/Chargement/i.test(e.texte), 'après un réessai raté, « Chargement… » est resté');
      assert.equal(e.messagesVides, 1);
      assert.equal(e.busy, null);

      /* La panne cesse : le réessai affiche les offres. */
      await aide.controler({ pannes: [] });
      await aide.avecReponse(page, (r) => /\/jobs\/selection/.test(r.url()),
        () => page.click('#offres-reessayer'));
      await page.waitForFunction(() => document.querySelectorAll('#liste a.oc').length > 0, null, { timeout: 5000 });
      e = await etatSection(page);
      assert.ok(e.cartes > 0, 'aucune offre affichée après le réessai');
      assert.equal(e.bouton, false, 'le bouton « Réessayer » doit disparaître après succès');
      assert.ok(!/ne se chargent pas|Chargement/i.test(e.texte), 'un message d\'état est resté après succès');
      assert.match(e.compte, /offres récentes|dernière offre/);
      assert.equal(e.busy, null);
    } finally { await ctx.close(); }
  } finally {
    await aide.reinitialiserControle();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('accueil — aria-busy pendant le chargement, retiré ensuite', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    await aide.controler({ reset: true, delais: { '/jobs/selection': 1500 } });
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      assert.equal(await page.locator('#liste').getAttribute('aria-busy'), 'true',
        'le conteneur doit être « occupé » pendant le chargement');
      await page.waitForFunction(() => document.querySelectorAll('#liste a.oc').length > 0, null, { timeout: 8000 });
      assert.equal(await page.locator('#liste').getAttribute('aria-busy'), null,
        'aria-busy doit être retiré après le succès');
    } finally { await ctx.close(); }
  } finally {
    await aide.reinitialiserControle();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('accueil — chiffres en panne : « — » sans saut de mise en page', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const mesurer = (page) => page.evaluate(() => {
      const c = document.querySelector('.chiffres').getBoundingClientRect();
      const suivant = document.getElementById('dernieres-offres').getBoundingClientRect();
      return {
        haut: Math.round(c.top), hauteur: Math.round(c.height),
        suivantHaut: Math.round(suivant.top),
        textes: ['f-offres', 'f-sources', 'f-employeurs', 'f-releve']
          .map((id) => document.getElementById(id).textContent.trim()),
      };
    });

    await aide.controler({ reset: true, statsKO: true });
    let panne;
    {
      const { ctx, page } = await ouvrir();
      try { panne = await mesurer(page); } finally { await ctx.close(); }
    }
    assert.deepEqual(panne.textes, ['—', '—', '—', '—'],
      'les chiffres en panne doivent afficher « — » (ni vide, ni 0)');

    await aide.controler({ reset: true });
    let ok;
    {
      const { ctx, page } = await ouvrir();
      try { ok = await mesurer(page); } finally { await ctx.close(); }
    }
    assert.ok(ok.textes.every((t) => /\d/.test(t)), 'les chiffres normaux ne sont pas posés : ' + ok.textes);
    assert.equal(panne.hauteur, ok.hauteur, 'la hauteur du bandeau de chiffres change entre panne et succès');
    assert.equal(panne.suivantHaut, ok.suivantHaut, 'la mise en page saute quand les chiffres reviennent');
  } finally {
    await aide.reinitialiserControle();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
