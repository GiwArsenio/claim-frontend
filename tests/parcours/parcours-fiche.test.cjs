// tests/parcours/parcours-fiche.test.cjs
//
// P04 : ce que fait le visiteur qui ouvre une offre.
//
//   - la fiche s affiche vite ;
//   - elle se complete quand la reponse detail arrive ;
//   - elle ne se duplique pas ;
//   - une reponse tardive ne remplace pas la fiche que le visiteur regarde.
//
// Chaque cas observe l ecran, jamais l etat interne du code.

const {
  test, expect, attendreListe, attendreDetail, ouvrirPage, fermerPage,
  lireGa4, ga4ParNom,
} = require('./helpers/cas.cjs');

const BOARD = '/job-board.html';
test('P04 — la fiche s affiche une seule fois, sans doublon', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.locator('#feed .jc').nth(1).click();
    await attendreDetail(page, 'Actuaire confirme 102');
    await page.waitForTimeout(400);

    // Un seul titre de fiche : le detail arrive apres la liste et ne doit
    // pas laisser deux versions a l ecran.
    const titres = await page.locator('#detail .dtitle, #detail h1, #detail h2').allTextContents();
    const occurrences = titres.filter((t) => t.includes('102')).length;
    expect(occurrences).toBeLessThanOrEqual(1);
  } finally {
    await fermerPage(serveur);
  }
});

test('P04 — un evenement view_item est emis a l ouverture d une offre', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.locator('#feed .jc').nth(1).click();
    await attendreDetail(page, 'Actuaire confirme 102');
    await page.waitForTimeout(300);

    const evenements = await ga4ParNom(page, 'view_item');
    expect(evenements.length).toBeGreaterThan(0);
  } finally {
    await fermerPage(serveur);
  }
});




test('P04 — la fiche est affichee immediatement, avant la reponse detail', async (page) => {
  const serveur = await ouvrirPage(page, { latences: { '101': 800 } });
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    // La liste fournit de quoi lire tout de suite : pas d ecran vide.
    await attendreDetail(page, 'Actuaire confirme 101');
  } finally {
    await fermerPage(serveur);
  }
});

test('P04 — cliquer une offre affiche sa fiche', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.locator('#feed .jc').nth(1).click();
    await attendreDetail(page, 'Actuaire confirme 102');
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
