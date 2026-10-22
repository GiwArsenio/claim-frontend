// tests/parcours/parcours-recherche.test.cjs
//
// P01 et P02 : ce que fait le visiteur qui arrive et qui cherche.
//
//   P01 - la page se charge, la liste s'affiche, la fiche s'ouvre.
//   P02 - la recherche et les filtres produisent le bon resultat.
//
// Chaque cas verifie un effet observable (ce qui est affiche, ce que devient
// l'adresse, ce qu'on a emis vers GA4), jamais une ligne de code.

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

test('P01 — la liste affiche les 8 offres du backend simule', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    const titres = await page.locator('#feed .jc .ctitle').allTextContents();
    expect(titres).toHaveLength(8);
    expect(titres[0]).toContain('Actuaire');
  } finally {
    await fermerPage(serveur);
  }
});

test('P01 — la fiche de la premiere offre est ouverte au chargement', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');
  } finally {
    await fermerPage(serveur);
  }
});

test('P01 — le compteur annonce le nombre d offres', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    const entete = await page.locator('.pl-hd').innerText();
    expect(entete).toContain('8');
  } finally {
    await fermerPage(serveur);
  }
});

test('P01 — un evenement view_item_list est emis avec le nombre de resultats', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    const evenements = await ga4ParNom(page, 'view_item_list');
    expect(evenements.length).toBeGreaterThan(0);
    expect(evenements[0].params.results_count).toBe(8);
  } finally {
    await fermerPage(serveur);
  }
});

// ── P02 : la recherche et les filtres ────────────────────────────────────

test('P02 — le filtre sur le contrat ne garde que les offres correspondantes', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdd');
    await attendreListe(page, 2);

    const offres = await page.locator('#feed .jc').count();
    expect(offres).toBe(2);
  } finally {
    await fermerPage(serveur);
  }
});

test('P02 — le filtre sur la ville ne garde que les offres correspondantes', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdd');
    await attendreListe(page, 2);
    await page.fill('#city-input', 'Lyon');
    await page.click('.btn-srch');
    await attendreListe(page, 0);

    expect(await page.locator('#feed .jc').count()).toBe(0);
  } finally {
    await fermerPage(serveur);
  }
});

test('P02 — la reinitialisation rend toutes les offres', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdd');
    await attendreListe(page, 2);

    await page.click('button[onclick="resetFilters()"]');
    await attendreListe(page, 8);

    expect(await page.locator('#feed .jc').count()).toBe(8);
  } finally {
    await fermerPage(serveur);
  }
});

test('P02 — les filtres combines donnent le bon nombre', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdi');
    await attendreListe(page, 5);
    await page.selectOption('#experience-filter', 'senior');
    await attendreListe(page, 2);

    expect(await page.locator('#feed .jc').count()).toBe(2);
  } finally {
    await fermerPage(serveur);
  }
});

// ── D07 : les filtres actifs doivent se lire dans l adresse ──────────────
//
// Un visiteur qui filtre, puis copie l adresse, doit retrouver sa recherche.
// Sans cela, une adresse partagee ne porte aucun filtre : le destinataire
// voit la liste complete et ne comprend pas ce qu il a recu.
//
// Ce test est volontairement ROUGE avant la correction de D07.

test('D07 — les filtres actifs apparaissent dans l adresse', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdd');
    await attendreListe(page, 2);

    const url = new URL(page.url());
    expect(url.searchParams.get('contract')).toBe('cdd');
  } finally {
    await fermerPage(serveur);
  }
});

test('P02 — une adresse avec filtre restitue la liste filtree', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD + '?contract=cdd');
    await attendreListe(page, 2);

    expect(await page.locator('#feed .jc').count()).toBe(2);
  } finally {
    await fermerPage(serveur);
  }
});

test('D07 — reinitialiser retire les filtres de l adresse', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdd');
    await attendreListe(page, 2);
    expect(new URL(page.url()).searchParams.get('contract')).toBe('cdd');

    await page.click('button[onclick="resetFilters()"]');
    await attendreListe(page, 8);

    const url = new URL(page.url());
    expect(url.searchParams.get('contract')).toBe(null);
  } finally {
    await fermerPage(serveur);
  }
});

test('D07 — l adresse ne porte que les filtres actifs', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);

    await page.selectOption('#contract-filter', 'cdi');
    await attendreListe(page, 5);
    await page.selectOption('#experience-filter', 'senior');
    await attendreListe(page, 2);

    const url = new URL(page.url());
    expect(url.searchParams.get('contract')).toBe('cdi');
    expect(url.searchParams.get('experience')).toBe('senior');
    // Un filtre inactif ne laisse pas de trace.
    expect(url.searchParams.get('city')).toBe(null);
    expect(url.searchParams.get('ats')).toBe(null);
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
