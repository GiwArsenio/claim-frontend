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
  test, expect, attendreListe, attendreDetail, ouvrirPage, fermerPage,
  lireGa4, ga4ParNom,
} = require('./helpers/cas.cjs');

const BOARD = '/job-board.html';



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
// ── Mode autonome ────────────────────────────────────────────────────────
//
// Execute directement par node, le fichier joue lui-meme ses cas.
const { lancerAutonomie } = require('./helpers/cas.cjs');
if (require.main === module) {
  lancerAutonomie();
}
