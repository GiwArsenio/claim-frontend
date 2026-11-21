/* ─────────────────────────────────────────────────────────────────────────────
   BOARD — États de chargement et de panne

   Avant : quand l'API tombait, la colonne des offres affichait « Erreur :
   Failed to fetch » en rouge (anglais, technique), le compteur restait sur
   « CHARGEMENT… » et rien ne permettait de réessayer. Même défaut pour la fiche.

   Ce que ce test verrouille, en agissant dans un vrai navigateur :

   1. Panne de la liste : un message français sans jargon, un bouton
      « Réessayer » atteignable au clavier, un compteur qui ne dit plus
      « Chargement… ».
   2. Jamais « Chargement » et message d'erreur en même temps.
   3. « Réessayer » relance, et réussit une fois le service rétabli ; si la
      panne dure, l'erreur revient et le focus reste sur le bouton.
   4. Panne de la fiche (aucune donnée de liste pour la montrer) : message,
      « Réessayer », « Retour aux offres » — et la reprise fonctionne.
   5. Aucun texte anglais ou technique ne s'affiche, nulle part.
   6. Garde-fous de code : plus de style en ligne ni de message brut dans
      les états, aria-busy pendant le chargement.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const aide = require('./aide-parcours.cjs');

const JARGON = /Failed to fetch|NetworkError|HTTP \d{3}|Erreur\s*:|TypeError|undefined|Panne simul/i;

/** Le texte que voit le visiteur dans les zones concernées. */
async function textesVisibles(page) {
  return page.evaluate(() => ({
    compteur: (document.querySelector('.pl-hd') || {}).textContent || '',
    liste: (document.querySelector('#feed') || {}).innerText || '',
    fiche: (document.querySelector('#detail') || {}).innerText || '',
  }));
}

function aucunJargon(textes, contexte) {
  for (const [zone, texte] of Object.entries(textes)) {
    assert.ok(!JARGON.test(texte), `${contexte} : texte technique visible dans « ${zone} » : « ${texte.slice(0, 120)} »`);
  }
}

async function avecBoard(format, preparer, corps) {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    await aide.reinitialiserControle();
    if (preparer) await preparer();
    const { ctx, page } = await aide.ouvrirPage(format);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1500);
      await corps(page);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.reinitialiserControle();
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
}

/** Atteint le bouton « Réessayer » en tabulant : la preuve que le clavier y arrive. */
async function tabulerJusqua(page, selecteur) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const ok = await page.evaluate((sel) => !!document.activeElement && document.activeElement.matches(sel), selecteur);
    if (ok) return true;
  }
  return false;
}

test('liste en panne : message français, compteur honnête, bouton au clavier', async () => {
  await avecBoard(aide.FORMATS.bureau, () => aide.controler({ pannes: ['/jobs'] }), async (page) => {
    const t = await textesVisibles(page);

    assert.match(t.liste, /Les offres ne se chargent pas pour l'instant\./, 'le message d\'erreur attendu est absent');
    assert.equal(t.compteur.trim(), 'Offres indisponibles', 'le compteur doit refléter la panne');
    aucunJargon(t, 'panne de la liste');

    // Jamais les deux à la fois.
    assert.ok(!/Chargement/i.test(t.compteur), 'le compteur affiche encore « Chargement… » après la panne');
    assert.ok(!/Chargement/i.test(t.liste), 'la liste affiche « Chargement » en même temps que l\'erreur');

    // Plus d'attente affichée à un lecteur d'écran.
    assert.equal(await page.getAttribute('#feed', 'aria-busy'), null, 'aria-busy doit être levé après la panne');

    // Le clavier atteint le bouton.
    assert.ok(await page.locator('#feed .btn-reessayer').isVisible(), 'le bouton « Réessayer » doit être visible');
    assert.ok(await tabulerJusqua(page, '#feed .btn-reessayer'), 'la touche Tab n\'atteint pas « Réessayer »');
  });
});

test('« Réessayer » relance : chargement sans erreur, puis les offres', async () => {
  await avecBoard(aide.FORMATS.bureau, () => aide.controler({ pannes: ['/jobs'] }), async (page) => {
    // Le service est rétabli, mais lent : on a le temps de voir l'attente.
    await aide.controler({ pannes: [], delais: { '/jobs': 1500 } });

    await tabulerJusqua(page, '#feed .btn-reessayer');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const pendant = await textesVisibles(page);
    assert.match(pendant.liste, /Chargement des offres/, 'l\'attente n\'est pas affichée pendant la reprise');
    assert.equal(pendant.compteur.trim(), 'Chargement…');
    assert.ok(!/ne se chargent pas/i.test(pendant.liste), 'l\'erreur reste affichée pendant le chargement');
    assert.equal(await page.getAttribute('#feed', 'aria-busy'), 'true', 'aria-busy absent pendant le chargement');
    // Le focus ne tombe pas sur <body> : le clavier garde sa place.
    assert.notEqual(
      await page.evaluate(() => document.activeElement && document.activeElement.tagName), 'BODY',
      'le focus est perdu sur <body> pendant la reprise'
    );

    await aide.attendreChargementTermine(page, 15000);
    await page.waitForTimeout(500);

    const apres = await textesVisibles(page);
    assert.match(apres.compteur, /\d+ offres? disponibles?/, 'le compteur doit annoncer les offres après la reprise');
    assert.ok(await aide.compterCartes(page) > 0, 'aucune offre affichée après « Réessayer »');
    assert.ok(!/ne se chargent pas/i.test(apres.liste), 'le message d\'erreur reste après la reprise');
    aucunJargon(apres, 'reprise de la liste');
    assert.equal(await page.getAttribute('#feed', 'aria-busy'), null, 'aria-busy doit être levé après la reprise');
    assert.notEqual(
      await page.evaluate(() => document.activeElement && document.activeElement.tagName), 'BODY',
      'le focus est perdu sur <body> après la reprise'
    );
  });
});

test('« Réessayer » alors que la panne dure : l\'erreur revient, le focus reste sur le bouton', async () => {
  await avecBoard(aide.FORMATS.bureau, () => aide.controler({ pannes: ['/jobs'] }), async (page) => {
    await tabulerJusqua(page, '#feed .btn-reessayer');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);

    const t = await textesVisibles(page);
    assert.match(t.liste, /Les offres ne se chargent pas pour l'instant\./);
    assert.ok(!/Chargement/i.test(t.liste + ' ' + t.compteur));
    aucunJargon(t, 'panne persistante');
    assert.ok(
      await page.evaluate(() => document.activeElement && document.activeElement.matches('#feed .btn-reessayer')),
      'le focus doit rester sur « Réessayer » quand la panne persiste'
    );
  });
});

/** Retire l'offre de la liste en mémoire : la fiche n'a alors plus que le réseau. */
async function ouvrirFicheSansDonneesDeListe(page, id) {
  await page.evaluate((cible) => {
    const i = ALL_JOBS.findIndex((x) => x.id === cible);
    if (i >= 0) ALL_JOBS.splice(i, 1);
    delete detailCache[cible];
    activeId = cible;
    renderDetail(cible);
  }, id);
  await page.waitForTimeout(900);
}

test('fiche en panne : message, « Réessayer », retour — et la reprise réussit', async () => {
  const id = 'syn-1';
  await avecBoard(aide.FORMATS.bureau, null, async (page) => {
    await aide.controler({ pannes: ['/jobs/' + id] });
    await ouvrirFicheSansDonneesDeListe(page, id);

    const t = await textesVisibles(page);
    assert.match(t.fiche, /Impossible d'ouvrir cette offre\./, 'le message d\'erreur de la fiche est absent');
    assert.ok(!/Chargement/i.test(t.fiche), 'la fiche affiche « Chargement » en même temps que l\'erreur');
    aucunJargon(t, 'panne de la fiche');
    assert.equal(await page.getAttribute('#detail', 'aria-busy'), null, 'aria-busy doit être levé après la panne');

    assert.ok(await page.locator('#detail .btn-reessayer').isVisible(), '« Réessayer » absent de la fiche');
    assert.ok(await tabulerJusqua(page, '#detail .btn-reessayer'), 'Tab n\'atteint pas « Réessayer » dans la fiche');

    // Service rétabli : « Réessayer » ouvre la fiche.
    await aide.controler({ pannes: [] });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);

    const apres = await textesVisibles(page);
    assert.ok(!/Impossible d'ouvrir/i.test(apres.fiche), 'le message d\'erreur reste après la reprise');
    assert.ok(await page.locator('#detail .dtitle').count() > 0, 'la fiche ne s\'ouvre pas après « Réessayer »');
    assert.equal(await page.getAttribute('#detail', 'aria-busy'), null);
    aucunJargon(apres, 'reprise de la fiche');
  });
});

test('fiche en panne sur téléphone : « Retour aux offres » ferme la fiche', async () => {
  const id = 'syn-1';
  await avecBoard(aide.FORMATS.phone, null, async (page) => {
    await aide.controler({ pannes: ['/jobs/' + id] });
    await ouvrirFicheSansDonneesDeListe(page, id);
    await page.evaluate(() => openDetail());
    await page.waitForTimeout(300);

    const retour = page.locator('#detail .etat-actions .btn-back');
    assert.ok(await retour.isVisible(), '« Retour aux offres » doit être visible sur téléphone');
    assert.match((await retour.innerText()).trim(), /Retour aux offres/);

    await retour.click();
    assert.ok(
      !(await page.evaluate(() => document.getElementById('split').classList.contains('detail-open'))),
      'la fiche reste ouverte après « Retour aux offres »'
    );
  });
});

test('fiche en panne alors que la liste a déjà le texte : pas de jargon, pas d\'attente infinie', async () => {
  await avecBoard(aide.FORMATS.bureau, null, async (page) => {
    await aide.controler({ pannes: ['/jobs/syn-2'] });
    const cartes = page.locator('#feed .jc, #feed .oc');
    await cartes.nth(1).click();
    await page.waitForTimeout(1200);

    const t = await textesVisibles(page);
    aucunJargon(t, 'fiche dégradée');
    assert.ok(!/Chargement du détail/i.test(t.fiche), 'l\'attente de la fiche ne s\'arrête jamais');
    assert.ok(t.fiche.trim().length > 60, 'la fiche est vide alors que la liste porte le texte');
  });
});

test('garde-fous du code : messages français, classes plutôt que styles en ligne, aria-busy', () => {
  const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');

  assert.ok(!html.includes('Erreur : ${e.message}'), 'le message technique est encore montré au visiteur');
  assert.ok(!/class="dc"[^>]*style=/.test(html), 'la fiche utilise encore un style en ligne pour ses états');
  assert.ok(!/<div style="padding:1\.5rem;/.test(html), 'la liste utilise encore un style en ligne pour ses états');

  assert.ok(html.includes('Les offres ne se chargent pas pour l\'instant.'));
  assert.ok(html.includes('Impossible d\'ouvrir cette offre.'));
  assert.ok(html.includes('Offres indisponibles'), 'le compteur ne dit pas la panne');
  assert.ok(/feedEl\.setAttribute\('aria-busy', 'true'\)/.test(html), 'aria-busy absent de la liste');
  assert.ok(/detailEl\.setAttribute\('aria-busy', 'true'\)/.test(html), 'aria-busy absent de la fiche');
  assert.ok(/\.btn-reessayer:focus-visible/.test(html), 'le bouton « Réessayer » n\'a pas d\'anneau de focus');
});
