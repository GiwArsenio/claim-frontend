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
// ── D09 : une reponse tardive ne doit pas ecraser la fiche lue ────────────
//
// Le visiteur clique vite deux offres. La reponse de la premiere peut
// arriver apres celle de la seconde. Si elle est acceptee, l ecran affiche
// une offre qui n est plus celle que le visiteur regarde, et qui ne
// correspond plus a l adresse.
//
// Ce test est volontairement ROUGE avant la correction de D09.

test('D09 — une reponse tardive ne remplace pas la fiche affichee', async (page) => {
  const serveur = await ouvrirPage(page, { latences: { '102': 1200 } });
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    // On ouvre la 102 : sa reponse met 1,2 s.
    await page.locator('#feed .jc').nth(1).click();
    // Puis la 103, qui repond tout de suite.
    await page.locator('#feed .jc').nth(2).click();
    await attendreDetail(page, 'Actuaire confirme 103');

    // La reponse tardive de la 102 arrive. Elle ne doit pas s afficher.
    await page.waitForTimeout(1600);
    const texte = await page.locator('#detail').innerText();
    expect(texte).toContain('Actuaire confirme 103');
    expect(texte).not.toContain('Actuaire confirme 102');
  } finally {
    await fermerPage(serveur);
  }
});

test('D09 — l offre courante reste celle que le visiteur regarde', async (page) => {
  const serveur = await ouvrirPage(page, { latences: { '102': 1200 } });
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.locator('#feed .jc').nth(1).click();
    await page.locator('#feed .jc').nth(2).click();
    await attendreDetail(page, 'Actuaire confirme 103');

    await page.waitForTimeout(1600);

    // Le bouton Postuler doit pointer vers l offre affichee, pas vers celle
    // dont la reponse est arrivee en retard.
    const href = await page.locator('#detail a.bap').first().getAttribute('href');
    expect(href).toContain('/offre/103');
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
