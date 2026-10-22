// tests/parcours/parcours-defilement.test.cjs
//
// P05 : la lecture de la fiche.
//
//   - sur grand ecran, la fiche se lit dans son propre panneau ;
//   - le haut de page se masque quand le lecteur descend, et revient quand
//     il remonte ;
//   - la fiche se ferme, et le haut de page revient a sa place.
//
// La position de lecture est un effet observable : on la mesure dans le
// panneau qui defile, pas dans une variable interne.

const {
  test, expect, attendreListe, attendreDetail, ouvrirPage, fermerPage,
} = require('./helpers/cas.cjs');

const BOARD = '/job-board.html';
// ── D10 : apres fermeture, le haut de page revient ────────────────────────
//
// Fermer la fiche retire les classes du corps de la page. Mais le panneau
// garde sa position de defilement, et le listener de scroll peut alors
// remettre la fiche en mode defile. Le haut de page reste masque : la page
// parait cassee.
//
// Ce test est volontairement ROUGE avant la correction de D10.


test('P05 — sur telephone, la fiche occupe l ecran et le bouton retour existe', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    await page.locator('#feed .jc').nth(1).click();
    await attendreDetail(page, 'Actuaire confirme 102');
    await page.waitForTimeout(150);

    const corps = await page.evaluate(() => document.body.className);
    expect(corps).toContain('detail-view');

    const bouton = page.locator('#detail .btn-back').first();
    await expect(bouton).toBeVisible();
  } finally {
    await fermerPage(serveur);
  }
});

test('P05 — changer d offre garde la position de lecture', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    // Le lecteur descend dans la fiche.
    await page.locator('#pr').evaluate((el) => {
      el.scrollTop = 180;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(200);

    // Il choisit une autre offre : il ne doit pas perdre sa place.
    await page.locator('#feed .jc').nth(1).click();
    await attendreDetail(page, 'Actuaire confirme 102');
    await page.waitForTimeout(400);

    const position = await page.locator('#pr').evaluate((el) => el.scrollTop);
    expect(position).toBeGreaterThan(100);
  } finally {
    await fermerPage(serveur);
  }
});

// ── D10 : fermer la fiche sur grand ecran ─────────────────────────────────
//
// Sur telephone, un glissement vers la gauche ferme la fiche. Sur grand
// ecran, il n y a rien : le bouton de retour est masque. Le visiteur qui
// a ouvert une offre depuis une liste ne peut plus revenir a la liste.
//
// Ce test est volontairement ROUGE avant la correction de D10.



test('P05 — la fiche se lit dans son panneau sur grand ecran', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    const defilable = await page.locator('#pr').evaluate(
      (el) => el.scrollHeight > el.clientHeight
    );
    expect(defilable).toBe(true);
  } finally {
    await fermerPage(serveur);
  }
});

test('P05 — descendre dans la fiche masque le haut de page', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    await page.locator('#pr').evaluate((el) => {
      el.scrollTop = 200;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(150);

    const corps = await page.evaluate(() => document.body.className);
    expect(corps).toContain('fiche-defilee');
  } finally {
    await fermerPage(serveur);
  }
});

test('P05 — remonter dans la fiche rend le haut de page', async (page) => {
  const serveur = await ouvrirPage(page);
  try {
    await page.goto(serveur.url + BOARD);
    await attendreListe(page, 8);
    await attendreDetail(page, 'Actuaire confirme 101');

    await page.locator('#pr').evaluate((el) => {
      el.scrollTop = 200;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.body.className)).toContain('fiche-defilee');

    await page.locator('#pr').evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(150);

    const corps = await page.evaluate(() => document.body.className);
    expect(corps).not.toContain('fiche-defilee');
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
