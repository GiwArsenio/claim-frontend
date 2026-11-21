/* Test statique de l'outil de mesure design (tools/audit-design.cjs).

   Aucun navigateur ici : on vérifie ce qui ne dépend pas de Playwright, c'est-à-dire
     - le contrat de l'outil (clés de mesure, cibles, scénarios) ;
     - la comparaison avant / après, en ligne de commande, sur des fichiers fabriqués ;
     - le jugement des états d'erreur (texte anglais, « Chargement… » + erreur) ;
     - la baseline commitée (baseline-design.json) : elle a toutes les clés attendues.
   La mesure elle-même, dans une vraie page, est testée par
   tests/audit_design_outil_mesure.test.cjs (famille navigateur).

   Usage : node tests/audit_design_outil.test.cjs */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..');
const OUTIL = path.join(RACINE, 'tools', 'audit-design.cjs');
const outil = require(OUTIL);

test('le contrat : chaque métrique de la fiche T00 est définie une seule fois, avec une cible valide', () => {
  const cles = outil.DEFINITIONS.map((d) => d.cle);
  assert.equal(new Set(cles).size, cles.length, 'clé en double');
  for (const attendue of [
    'contraste.min', 'contraste.echecs', 'texte.min_px', 'texte.sous_11px', 'texte.sous_12px_legal',
    'images.total', 'images.sans_dimensions', 'images.alt_vide_informatif',
    'a11y.lien_evitement', 'a11y.axe_violations', 'tactile.sous_44',
    'css.rayons_distincts', 'css.ombres_distinctes',
    'reseau.requetes_polices_tierces', 'reseau.poids_polices_octets', 'reseau.poids_images_octets',
    'erreur.texte_anglais_visible', 'erreur.chargement_et_erreur_simultanes',
  ]) assert.ok(cles.includes(attendue), `métrique manquante : ${attendue}`);
  for (const d of outil.DEFINITIONS) {
    assert.ok(d.def && d.libelle, `${d.cle} : définition ou libellé vide`);
    if (d.cible) assert.ok(['egal', 'max', 'min', 'pas_regression'].includes(d.cible.type), `${d.cle} : type de cible inconnu`);
  }
});

test('les scénarios couvrent accueil, board (liste et détail), a-propos, bureau et mobile', () => {
  const ids = outil.SCENARIOS.map((s) => s.id);
  for (const page of ['accueil', 'board-liste', 'board-detail', 'a-propos']) {
    assert.ok(ids.includes(`${page}@bureau`), `${page}@bureau absent`);
    assert.ok(ids.includes(`${page}@mobile`), `${page}@mobile absent`);
  }
});

test('l\'outil est branché dans package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(RACINE, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['audit:design'], 'node tools/audit-design.cjs');
});

test('la comparaison : cible atteinte, cible manquée, régression, information', () => {
  const synth = (o) => ({ synthese: o, scenarios: {} });
  const avant = synth({ 'images.sans_dimensions': 12, 'a11y.axe_violations': 3, 'css.ombres_distinctes': 5, 'a11y.lien_evitement': false, 'css.rayons_distincts': 10 });
  const apres = synth({ 'images.sans_dimensions': 0, 'a11y.axe_violations': 4, 'css.ombres_distinctes': 9, 'a11y.lien_evitement': true, 'css.rayons_distincts': 10 });
  const par = Object.fromEntries(outil.comparer(avant, apres).lignes.map((l) => [l.cle, l]));
  assert.equal(par['images.sans_dimensions'].statut, 'ok');
  assert.equal(par['a11y.axe_violations'].statut, 'ECART', 'une régression doit se voir');
  assert.equal(par['css.ombres_distinctes'].statut, 'info');
  assert.equal(par['a11y.lien_evitement'].statut, 'ok');
  assert.equal(par['css.rayons_distincts'].statut, 'ECART', '10 rayons > cible 6');
  assert.equal(par['images.sans_dimensions'].change, true);
  assert.equal(par['css.rayons_distincts'].change, false);
});

test('le contraste minimum ne peut pas baisser (régression), même au-dessus de 4,5', () => {
  const synth = (v) => ({ synthese: { 'contraste.min': v }, scenarios: {} });
  const ligne = (a, b) => outil.comparer(synth(a), synth(b)).lignes.find((l) => l.cle === 'contraste.min');
  assert.equal(ligne(5.72, 5.72).statut, 'ok');
  assert.equal(ligne(5.72, 6.1).statut, 'ok');
  assert.equal(ligne(5.72, 5.2).statut, 'ECART');
  assert.equal(ligne(5.72, 4.4).statut, 'ECART');
});

test('--comparer en ligne de commande : tableau lisible, code 0 ; sans argument, code 2', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-design-'));
  const fa = path.join(dossier, 'avant.json');
  const fb = path.join(dossier, 'apres.json');
  fs.writeFileSync(fa, JSON.stringify({ synthese: { 'images.sans_dimensions': 12 }, scenarios: {} }));
  fs.writeFileSync(fb, JSON.stringify({ synthese: { 'images.sans_dimensions': 0 }, scenarios: {} }));
  const r = spawnSync(process.execPath, [OUTIL, '--comparer', fa, fb], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Métrique\s+Avant\s+Après\s+Cible/);
  assert.match(r.stdout, /images\.sans_dimensions\s+12\s+0\s+0\s+ok \*/);
  const sans = spawnSync(process.execPath, [OUTIL], { encoding: 'utf8' });
  assert.equal(sans.status, 2);
});

test('états d\'erreur : l\'anglais et la double mention « Chargement… » + erreur sont détectés', () => {
  const mauvais = outil.jugerErreur(['CHARGEMENT…', 'Erreur : Failed to fetch']);
  assert.equal(mauvais.texte_anglais_visible, true);
  assert.equal(mauvais.chargement_et_erreur_simultanes, true);
  const http = outil.jugerErreur(['Erreur : HTTP 500']);
  assert.equal(http.texte_anglais_visible, true);
  const bon = outil.jugerErreur(['Les offres ne se chargent pas pour l’instant.', 'Réessayer']);
  assert.equal(bon.texte_anglais_visible, false);
  assert.equal(bon.chargement_et_erreur_simultanes, false);
  const seulChargement = outil.jugerErreur(['Chargement des offres…']);
  assert.equal(seulChargement.chargement_et_erreur_simultanes, false, 'un chargement normal n\'est pas une erreur');
});

test('la baseline commitée a toutes les clés de la fiche, pour chaque scénario', () => {
  const fichier = path.join(RACINE, 'baseline-design.json');
  assert.ok(fs.existsSync(fichier), 'baseline-design.json absent');
  const b = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  assert.equal(b.schema, outil.VERSION_SCHEMA);
  for (const d of outil.DEFINITIONS) assert.ok(d.cle in b.synthese, `synthèse : ${d.cle} absent`);
  for (const s of outil.SCENARIOS) {
    const m = b.scenarios[s.id];
    assert.ok(m, `scénario absent : ${s.id}`);
    for (const [groupe, cles] of Object.entries(outil.CLES_MESURE)) {
      for (const cle of cles) assert.ok(cle in m[groupe], `${s.id} : ${groupe}.${cle} absent`);
    }
  }
  for (const page of ['accueil', 'board-liste', 'board-detail']) {
    for (const variante of ['panne', 'reseau']) {
      const e = b.erreurs[page] && b.erreurs[page][variante];
      assert.ok(e, `erreur ${page}/${variante} absente`);
      assert.equal(typeof e.texte_anglais_visible, 'boolean');
      assert.equal(typeof e.chargement_et_erreur_simultanes, 'boolean');
    }
  }
  assert.ok(fs.statSync(fichier).size < 400 * 1024, 'la baseline doit rester petite');
});
