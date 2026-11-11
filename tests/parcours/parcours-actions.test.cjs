// tests/parcours/parcours-actions.test.cjs
//
// P06 : ce que fait le visiteur une fois sur la fiche.
//
//   - il postule : la page source s'ouvre ;
//   - il partage : le lien est copie ;
//   - il revient en arriere : la liste est la.
//
// Le partage natif n existe pas dans un navigateur de test. On verifie donc
// le repli : le lien doit etre copie dans le presse-papiers. C'est le chemin
// que prennent les visiteurs qui n ont pas de partage systeme.

const {
  expect, attendreListe, attendreDetail, ouvrirPage, fermerPage,
  lireGa4, ga4ParNom, modeRunner, adapter,
} = require('./helpers/cas.cjs');

const BOARD = '/job-board.html';

// Le `test` local : l appel a test() doit avoir lieu dans ce fichier, sinon
// le rapport de la CI rattache tous les cas au module des helpers, et un
// echec ne dit pas quel parcours il vient.
const { test: testPlaywright } = require('@playwright/test');

function test(nom, corps) {
  if (modeRunner()) {
    testPlaywright(nom, { description: nom }, adapter(corps));
    return;
  }
  require('./helpers/cas.cjs').enregistrerCasAutonome(nom, corps);
}

test('P06 — une annulation de partage ne remonte pas d erreur', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.addInitScript(() => {
      navigator.share = () => Promise.reject(new Error('annule'));
    });
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    await page.locator('#detail button:has-text("Partager")').first().click();
    await page.waitForTimeout(400);

    // L annulation doit rester silencieuse : aucune erreur visible.
    const corps = await page.evaluate(() => document.body.innerText);
    expect(corps).not.toContain('annule');
  } finally {
    await fermerPage(serveur);
  }
});

test('P06 — l adresse suit l offre ouverte', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.locator('#feed .jc').nth(1).click();
    await attendreDetail(page, 'Actuaire confirme 102');
    await page.waitForTimeout(200);

    const url = new URL(page.url());
    expect(url.pathname).toBe('/offre/actuaire-102-parcours');
  } finally {
    await fermerPage(serveur);
  }
});

test('P06 — revenir en arriere rend la liste', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.locator('#feed .jc').nth(1).click();
    await attendreDetail(page, 'Actuaire confirme 102');
    await page.waitForTimeout(200);

    await page.goBack();
    await page.waitForTimeout(400);

    const url = new URL(page.url());
    expect(url.pathname).toBe('/job-board.html');
  } finally {
    await fermerPage(serveur);
  }
});


test('P06 — le bouton Postuler renvoie vers la source de l offre', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    const lien = page.locator('#detail a.bap').first();
    await expect(lien).toBeVisible();
    await expect(lien).toHaveAttribute('href', 'https://exemple.test/offre/101');
  } finally {
    await fermerPage(serveur);
  }
});

test('P06 — le clic Postuler est mesure', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    await page.locator('#detail a.bap').first().click({ modifiers: ['Control'] });
    await page.waitForTimeout(300);

    const evenements = await ga4ParNom(page, 'job_apply_click');
    expect(evenements.length).toBeGreaterThan(0);
  } finally {
    await fermerPage(serveur);
  }
});

test('P06 — le partage copie le lien de l offre', async (page, context) => {
  const serveur = await ouvrirPage(page);
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    await page.locator('#detail button:has-text("Partager")').first().click();
    await page.waitForTimeout(400);

    const presse = await page.evaluate(() => navigator.clipboard.readText());
    expect(presse).toContain('/offre/actuaire-101-parcours');
  } finally {
    await fermerPage(serveur);
  }
});
// ── D08 : le contexte filtre survit a l ouverture d une offre ─────────────
//
// Le visiteur filtre la liste, ouvre une offre. L adresse devient
// /offre/<slug> : les filtres disparaissent. Le bouton "precedent" du
// navigateur ramene alors a une liste non filtree, alors que le visiteur
// l avait filtree.
//
// Ce test est volontairement ROUGE avant la correction de D08.

test('D08 — ouvrir une offre conserve les filtres dans l adresse', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdd');
    await attendreListe(page, 2);

    await page.locator('#feed .jc').nth(0).click();
    await attendreDetail(page, 'Actuaire confirme 104');
    await page.waitForTimeout(200);

    const url = new URL(page.url());
    expect(url.searchParams.get('contract')).toBe('cdd');
  } finally {
    await fermerPage(serveur);
  }
});

test('D08 — revenir en arriere restitue la liste filtree', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdd');
    await attendreListe(page, 2);

    await page.locator('#feed .jc').nth(0).click();
    await attendreDetail(page, 'Actuaire confirme 104');
    await page.waitForTimeout(200);

    await page.goBack();
    await page.waitForTimeout(500);

    // La liste restituee doit etre celle que le visiteur avait filtree.
    const url = new URL(page.url());
    expect(url.searchParams.get('contract')).toBe('cdd');
    await attendreListe(page, 2);
    expect(await page.locator('#feed .jc').count()).toBe(2);
  } finally {
    await fermerPage(serveur);
  }
});

// ── Mode autonome ────────────────────────────────────────────────────────
//
// Execute directement par node, le fichier joue lui-meme ses cas.
const { lancerAutonomie } = require('./helpers/cas.cjs');
if (require.main === module) {
  lancerAutonomie();
}
