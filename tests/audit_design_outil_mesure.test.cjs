/* Test de la mesure de tools/audit-design.cjs sur un HTML minimal.

   La fonction mesureDansPage est exécutée dans un vrai navigateur, sur une page
   de quelques lignes dont on connaît les défauts à l'avance : une image sans
   dimensions, un texte de 9 px, un texte gris clair, deux rayons, un lien
   d'évitement absent. L'outil doit les trouver, et seulement eux.

   Usage : node tests/audit_design_outil_mesure.test.cjs */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const outil = require('../tools/audit-design.cjs');

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const PAGE_DEFAUTS = `<!doctype html><html lang="fr"><body style="margin:0;background:#fff">
  <header><nav><a href="/x">Accueil</a></nav></header>
  <main>
    <h1>Titre</h1>
    <p style="color:#222;font-size:16px">Un texte lisible, sombre sur fond blanc.</p>
    <p class="gris" style="color:#bbb;font-size:16px">Un texte gris clair, illisible.</p>
    <p class="minuscule" style="color:#222;font-size:9px">Mini</p>
    <img src="${PIXEL}" alt="">
    <img src="${PIXEL}" alt="Logo" width="10" height="10">
    <img src="${PIXEL}" alt="Demi-dimensions" width="10">
    <div style="border-radius:4px;box-shadow:0 1px 2px #000;width:20px;height:20px"></div>
    <div style="border-radius:12px;width:20px;height:20px"></div>
    <button style="width:30px;height:30px">OK</button>
  </main>
  <footer><p style="color:#222;font-size:10px">© Claim!</p></footer>
</body></html>`;

const PAGE_PROPRE = `<!doctype html><html lang="fr"><body style="margin:0;background:#fff">
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  <header><nav><a href="/x">Accueil</a></nav></header>
  <main id="contenu"><h1>Titre</h1>
    <p style="color:#222;font-size:16px">Texte lisible.</p>
    <img src="${PIXEL}" alt="" width="1" height="1" aria-hidden="true"></main>
  <footer><p style="color:#222;font-size:13px">© Claim!</p></footer>
</body></html>`;

let nav;
test.before(async () => { nav = await chromium.launch(); });
test.after(async () => { await nav.close(); });

async function mesurer(html, mobile) {
  const ctx = await nav.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.setContent(html);
  const m = await page.evaluate(outil.mesureDansPage, { mobile });
  await ctx.close();
  return m;
}

test('la mesure produit toutes les clés du contrat', async () => {
  const m = await mesurer(PAGE_DEFAUTS, false);
  for (const [groupe, cles] of Object.entries(outil.CLES_MESURE)) {
    // `reseau`, `focus_visible` et `axe_violations` sont ajoutés par l'outil côté Node, pas par la fonction de page.
    if (groupe === 'reseau') continue;
    for (const cle of cles.filter((c) => !['focus_visible', 'axe_violations'].includes(c))) {
      assert.ok(cle in m[groupe], `${groupe}.${cle} absent`);
    }
  }
});

test('elle trouve les défauts connus de la page piégée', async () => {
  const m = await mesurer(PAGE_DEFAUTS, false);
  assert.equal(m.images.total, 3);
  assert.equal(m.images.sans_dimensions, 2, 'une image qui n\'a que width compte aussi comme sans dimensions');
  assert.equal(m.images.alt_vide, 1);
  assert.equal(m.a11y.lien_evitement, false);
  assert.equal(m.a11y.h1_count, 1);
  assert.deepEqual(m.a11y.reperes, { header: 1, nav: 1, main: 1, footer: 1 });
  assert.equal(m.texte.min_px, 9);
  assert.deepEqual(m.texte.sous_11px.map((t) => t.px), [9, 10]);
  assert.deepEqual(m.texte.sous_12px_legal.map((t) => t.px), [10], 'seul le pied de page (légal) compte, pas le « Mini » court');
  assert.equal(m.contraste.echecs.length, 1);
  assert.equal(m.contraste.echecs[0].el, 'p.gris');
  assert.ok(m.contraste.min < 2, `le gris clair doit tirer le minimum vers le bas (${m.contraste.min})`);
  assert.equal(m.css.rayons_distincts, 2);
  assert.equal(m.css.ombres_distinctes, 1);
  assert.deepEqual(m.tactile.sous_44, [], 'les cibles tactiles ne se mesurent qu\'en mobile');
});

test('en mobile, une cible de 30 px est signalée', async () => {
  const m = await mesurer(PAGE_DEFAUTS, true);
  const noms = m.tactile.sous_44.map((t) => t.nom);
  assert.ok(noms.includes('OK'), JSON.stringify(m.tactile.sous_44));
});

test('une page propre : lien d\'évitement vu, aucune alerte', async () => {
  const m = await mesurer(PAGE_PROPRE, false);
  assert.equal(m.a11y.lien_evitement, true);
  assert.equal(m.images.sans_dimensions, 0);
  assert.equal(m.images.alt_vide_informatif, 0, 'une image décorative aria-hidden n\'est pas informative');
  assert.equal(m.texte.sous_11px.length, 0);
  assert.equal(m.texte.sous_12px_legal.length, 0);
  assert.equal(m.contraste.echecs.length, 0);
});
