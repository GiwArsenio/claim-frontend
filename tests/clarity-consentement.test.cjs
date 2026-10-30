/* ─────────────────────────────────────────────────────────────────────────────
   CLARITY — LE CONSENTEMENT DÉCIDE D'UN APPEL RÉSEAU, PAS D'UN TEXTE

   Les contrôles statiques (tests/clarity.test.cjs) lisent des fichiers. Ils
   ne peuvent pas prouver qu'un refus n'envoie rien : il faut regarder les
   requêtes.

   Ce test fixe un identifiant de projet factice avant le chargement des
   scripts, puis observe les tentatives de sortie que le harnais trace déjà.
   Deux cas, et le second compte autant que le premier :

     - refus  → aucune tentative vers clarity.ms ;
     - accord → au moins une tentative vers clarity.ms.

   Sans le second cas, un chargeur cassé passerait le test pour de
   mauvaises raisons : « rien ne sort » est aussi vrai quand rien ne
   fonctionne.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const PROJET = 'projet-de-test-clarity';

/* Pose l'identifiant de projet avant les scripts de la page. Le dépôt n'en
   contient aucun : c'est ce qui empêche un envoi réel depuis une suite
   locale. */
async function avecProjet(ctx) {
  await ctx.addInitScript((projet) => {
    window.CLAIM_CLARITY_PROJET = projet;
  }, PROJET);
}

function sortiesClarity(page) {
  return page.appelsExternes.filter((a) => a.url.includes('clarity.ms'));
}

test('refuser ne charge pas Clarity', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
  try {
    await avecProjet(ctx);
    await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await aide.attendre(page, 800);

    /* Le bandeau doit être visible : sinon on cliquerait dans le vide et le
       test conclurait « rien ne sort » sans avoir rien décidé. */
    const visible = await page.evaluate(() => {
      const b = document.querySelector('#claim-consentement');
      return !!b && !b.hidden;
    });
    assert.ok(visible, 'le bandeau de consentement n\'est pas affiché : le test ne décide rien.');

    await page.click('#claim-consentement .consent-refuser');
    await aide.attendre(page, 1200);

    assert.deepEqual(
      sortiesClarity(page).map((a) => a.url),
      [],
      'un refus a tout de même déclenché un appel vers clarity.ms'
    );

    const choix = await page.evaluate(() => localStorage.getItem('claim-consentement'));
    assert.equal(choix, 'rien', `le refus n'a pas été enregistré : "${choix}"`);
  } finally {
    await ctx.close();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('accepter charge Clarity, sans partage publicitaire', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
  try {
    await avecProjet(ctx);
    await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await aide.attendre(page, 800);

    await page.click('#claim-consentement .consent-accepter');
    await aide.attendre(page, 1200);

    const sorties = sortiesClarity(page);
    assert.ok(
      sorties.length > 0,
      'accepter n\'a déclenché aucun appel vers clarity.ms : le chargeur ne charge rien.'
    );
    assert.ok(
      sorties.some((a) => a.url.includes('/tag/' + PROJET)),
      `aucune requête ne porte l'identifiant du projet : ${JSON.stringify(sorties)}`
    );

    const choix = await page.evaluate(() => localStorage.getItem('claim-consentement'));
    assert.equal(choix, 'tout', `l'accord n'a pas été enregistré : "${choix}"`);

    /* La file d'attente du script officiel garde les appels passés avant son
       arrivée : le signal de consentement doit y être, avec le refus
       publicitaire. C'est le seul moyen de le vérifier sans réseau. */
    const signaux = await page.evaluate(() =>
      (window.clarity && window.clarity.q ? window.clarity.q : []).map((a) => Array.from(a))
    );
    const consentement = signaux.find((a) => a[0] === 'consentv2');
    assert.ok(consentement, 'aucun signal consentv2 n\'a été transmis à Clarity.');
    assert.equal(consentement[1].ad_Storage, 'denied', 'ad_Storage n\'est pas refusé.');
    assert.equal(
      consentement[1].analytics_Storage, 'granted',
      'analytics_Storage n\'est pas accordé alors que le visiteur a accepté.'
    );
  } finally {
    await ctx.close();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('le bouton de retrait efface le choix et prévient Clarity', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
  try {
    await avecProjet(ctx);
    await page.addInitScript(() => {
      try { localStorage.setItem('claim-consentement', 'tout'); } catch (e) { /* ignore */ }
    });

    await page.goto(aide.BASE + '/confidentialite.html', { waitUntil: 'domcontentloaded' });
    await aide.attendre(page, 800);

    const avant = await page.evaluate(() => localStorage.getItem('claim-consentement'));
    assert.equal(avant, 'tout', 'le choix initial n\'a pas été posé : le test ne prouve rien.');

    await page.click('#retirer-accord');
    await aide.attendre(page, 500);

    const apres = await page.evaluate(() => localStorage.getItem('claim-consentement'));
    assert.equal(apres, null, `le retrait n'a pas effacé le choix : "${apres}"`);

    const signaux = await page.evaluate(() =>
      (window.clarity && window.clarity.q ? window.clarity.q : []).map((a) => Array.from(a))
    );
    const refus = signaux.filter((a) => a[0] === 'consentv2').pop();
    assert.ok(refus, 'le retrait n\'a transmis aucun signal à Clarity.');
    assert.equal(
      refus[1].analytics_Storage, 'denied',
      'le retrait n\'a pas refusé le stockage analytique.'
    );
  } finally {
    await ctx.close();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
