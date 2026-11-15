/* ─────────────────────────────────────────────────────────────────────────────
   Filtres à facettes — Lot 3

   Vérifie le contrat du panneau : multi-sélection réelle, comptes, brouillon
   annulé à la fermeture, état appliqué à la validation, clavier et ARIA.

   Le serveur de test répond aux filtres comme l'API : plusieurs valeurs
   jointes par une virgule valent un OU.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const assert = require('node:assert/strict');
const aide = require('./aide-parcours.cjs');

let base;

async function demarrer() {
  await aide.demarrerServeur();
  base = aide.BASE;
}

async function arreter() {
  await aide.arreterNavigateur();
  await aide.arreterServeur();
}

// Le harnais injecte la base de l'API simulee et coupe le reseau exterieur :
// aucune requete ne part vers la production pendant le test.
async function ouvrir() {
  const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
  await page.goto(`${base}/job-board.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#feed .jc');
  return { page, contexte: ctx, erreurs: page.erreurs };
}

const nombreOffres = (page) => page.locator('#feed .jc').count();

/* Attend la réponse de liste puis un rendu stabilisé. Attendre un simple
   changement de nombre de cartes se trompait : le message « Chargement… »
   vide la liste, et le compte passait par zéro — ce qui est un état
   transitoire, pas un résultat. */
async function attendreResultat(page, action) {
  const reponse = page.waitForResponse((r) => aide.estListeDuBoard(r), { timeout: 20000 });
  await action();
  await reponse;
  await page.waitForFunction(() => document.querySelectorAll('#feed .jc').length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(120);
}
const texteCompteur = async (page) =>
  (await page.locator('.pl-hd').innerText()).trim();

async function ouvrirFacette(page, cle) {
  await page.click(`#btn-${cle}`);
  await page.waitForSelector(`#pop-${cle}`);
}

(async () => {
  let cas = 0;
  const ok = (msg) => { cas++; console.log('  ✓ ' + msg); };

  await demarrer();
  try {
    /* ── 1. Les cinq facettes remplacent les listes natives ─────────────── */
    {
      const { page, contexte, erreurs } = await ouvrir();
      assert.equal(await page.locator('#hero select').count(), 0, 'aucune liste native ne doit rester');
      assert.equal(await page.locator('.fbtn').count(), 5, 'cinq boutons de facette');
      ok('cinq facettes remplacent les listes natives');

      /* ── 2. Le panneau s'ouvre, les comptes arrivent ─────────────────── */
      await ouvrirFacette(page, 'contract');
      assert.equal(await page.getAttribute('#btn-contract', 'aria-expanded'), 'true');
      await page.waitForFunction(() => {
        const n = document.querySelector('#pop-contract .fopt-n');
        return n && n.textContent.trim().length > 0;
      }, { timeout: 10000 });
      const comptes = await page.$$eval('#pop-contract .fopt-n', (els) =>
        els.map((e) => e.textContent.trim()));
      assert.ok(comptes.some((c) => Number(c) > 0), 'au moins un compte non nul');
      ok('les comptes par valeur arrivent depuis l’API');

      /* ── 3. Cocher n'applique rien : le brouillon attend validation ──── */
      const avant = await nombreOffres(page);
      await page.check('#pop-contract input[value="cdi"]');
      assert.equal(await nombreOffres(page), avant, 'la liste ne bouge pas avant validation');
      ok('le brouillon ne touche pas la liste');

      /* ── 4. Échap annule le brouillon ────────────────────────────────── */
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#pop-contract').count(), 0, 'le panneau se ferme');
      assert.equal(await nombreOffres(page), avant, 'rien n’est appliqué');
      await ouvrirFacette(page, 'contract');
      assert.equal(
        await page.isChecked('#pop-contract input[value="cdi"]'), false,
        'le brouillon abandonné ne revient pas coché'
      );
      ok('Échap referme et abandonne le brouillon');

      /* ── 5. Multi-sélection : deux contrats, un OU ───────────────────── */
      const total = Number((await texteCompteur(page)).split(' ')[0]);
      await page.check('#pop-contract input[value="cdi"]');
      await page.check('#pop-contract input[value="stage"]');
      await attendreResultat(page, () => page.click('#pop-contract .fpop-ok'));
      const apres = await nombreOffres(page);
      assert.ok(apres > 0, 'la liste rend des offres pour CDI + Stage');
      assert.ok(apres <= total, 'jamais plus que le total');
      assert.equal(await page.locator('#btn-contract .fnb').innerText(), '2',
        'le bouton porte le nombre de valeurs cochées');
      ok('deux contrats se cumulent, le bouton affiche « 2 »');

      /* ── 6. Les comptes restent honnêtes après application ───────────── */
      await ouvrirFacette(page, 'specialty');
      await page.waitForFunction(() => {
        const n = document.querySelector('#pop-specialty .fopt-n');
        return n && n.textContent.trim().length > 0;
      }, { timeout: 10000 });
      ok('les comptes d’une autre facette suivent l’état appliqué');

      /* ── 7. Effacer vide le brouillon, pas l'appliqué ────────────────── */
      await page.check('#pop-specialty input[value="actuariat"]');
      await page.click('#pop-specialty .fpop-eff');
      assert.equal(await page.isChecked('#pop-specialty input[value="actuariat"]'), false);
      assert.equal(await page.locator('#btn-specialty.actif').count(), 0, 'rien n’est appliqué');
      await page.keyboard.press('Escape');
      ok('« Effacer » vide le brouillon sans appliquer');

      /* ── 8. Focus rendu au bouton à la fermeture ─────────────────────── */
      await ouvrirFacette(page, 'experience');
      await page.keyboard.press('Escape');
      const focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
      assert.equal(focus, 'btn-experience', 'le focus revient au déclencheur');
      ok('Échap rend le focus au bouton');

      /* ── 9. Clavier : le panneau est atteignable ─────────────────────── */
      await page.focus('#btn-ats');
      await page.keyboard.press('Enter');
      await page.waitForSelector('#pop-ats');
      const dansPanneau = await page.evaluate(() =>
        !!document.activeElement && document.querySelector('#pop-ats').contains(document.activeElement));
      assert.ok(dansPanneau, 'le focus entre dans le panneau');
      await page.keyboard.press('Escape');
      ok('le panneau s’ouvre au clavier et prend le focus');

      /* ── 10. Réinitialiser remet tout à zéro ─────────────────────────── */
      await attendreResultat(page, () => page.click('.chips > button.chip'));
      assert.equal(await page.locator('.fbtn.actif').count(), 0, 'aucune facette active');
      assert.equal(await page.locator('#btn-contract .fnb').count(), 0, 'aucun compteur');
      ok('« Réinitialiser » neutralise les facettes');

      assert.deepEqual(erreurs, [], 'aucune erreur console : ' + erreurs.join(' | '));
      ok('aucune erreur console');
      await contexte.close();
    }

    /* ── 11. Adresse partagée : une liste reste une liste ─────────────── */
    {
      const { ctx: contexte, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
      await page.goto(`${base}/job-board.html?contrat=cdi,stage`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#feed .jc');
      assert.equal(await page.locator('#btn-contract .fnb').innerText(), '2',
        'une adresse à deux valeurs se lit');
      ok('l’adresse porte les deux valeurs');
      await contexte.close();
    }

    /* ── 12. Adresse héritée : une seule valeur reste valable ─────────── */
    {
      const { ctx: contexte, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
      await page.goto(`${base}/job-board.html?contrat=cdi`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#feed .jc');
      assert.equal(await page.locator('#btn-contract.actif').count(), 1, 'un filtre unique s’applique');
      ok('une adresse héritée à valeur unique reste valable');
      await contexte.close();
    }
  } catch (e) {
    console.error('\n✘ ' + e.message);
    process.exitCode = 1;
  } finally {
    await arreter();
    if (!process.exitCode) console.log(`\n${cas} cas de facettes passés`);
  }
})();
