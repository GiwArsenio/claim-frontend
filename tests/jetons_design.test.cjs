/* ─────────────────────────────────────────────────────────────────────────────
   T08 — Échelle d'arrondis et d'ombres

   Le site avait dix rayons de bordure et jusqu'à six ombres. Ce test verrouille
   l'échelle posée dans assets/theme.css et appliquée par
   tools/codemod-jetons-design.cjs :

     rayons  --r-s 4 px · --r-m 8 px · --r-l 12 px, plus 0, inherit, 50 % (cercle)
             et 9999 px (pastille) ; aucune autre valeur en dur ;
     ombres  --ombre-1 · --ombre-2 · --ombre-forte, plus l'anneau d'une carte
             sélectionnée ; deux ombres laissées en l'état et nommées ici
             (bandeau de consentement exclu de la feuille de route ; liséré de
             l'en-tête de fiche collé, qui n'est pas une élévation).

   Test statique : il lit les fichiers, il ne lance aucun navigateur. La mesure
   en pixels (computed styles) est faite par tools/audit-design.cjs.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..');
const codemod = require('../tools/codemod-jetons-design.cjs');
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');

const PERIMETRE = ['index.html', 'job-board.html', 'assets/theme.css', 'assets/accueil-releve.css', 'assets/accueil-pourquoi.css'];

// ── 1. Les jetons existent, dans les deux thèmes quand ils changent ──
const theme = lire('assets/theme.css');
const jour = theme.slice(theme.indexOf(':root {'), theme.indexOf('html[data-theme="nuit"] {'));
const nuit = theme.slice(theme.indexOf('html[data-theme="nuit"] {'));
for (const [nom, valeur] of [['--r-s', '4px'], ['--r-m', '8px'], ['--r-l', '12px']]) {
  assert.ok(new RegExp(nom + ':\\s*' + valeur + ';').test(jour), `${nom} vaut ${valeur} dans :root`);
}
for (const nom of ['--ombre-1', '--ombre-2', '--ombre-forte']) {
  assert.ok(new RegExp(nom + ':').test(jour), `${nom} est défini pour le thème jour`);
  assert.ok(new RegExp(nom + ':').test(nuit), `${nom} est redéfini pour le thème nuit`);
}
assert.ok(/--ombre:\s*var\(--ombre-1\);/.test(jour),
  "--ombre reste un alias de --ombre-1 (claim-entreprises et claim-observatoire l'utilisent encore)");

// ── 2. Rayons : rien d'autre que l'échelle ──
const AUTORISES = /^(0|inherit|50%|9999px|var\(--r-[sml]\))(\s+(0|var\(--r-[sml]\)))*$/;
for (const rel of PERIMETRE) {
  const texte = lire(rel);
  for (const m of texte.matchAll(/border-radius\s*:\s*([^;}"']+)/g)) {
    const valeur = m[1].trim();
    assert.ok(AUTORISES.test(valeur), `${rel} : border-radius « ${valeur} » n'est pas sur l'échelle (--r-s/m/l, 0, 50%, 9999px)`);
  }
}

// ── 3. Ombres : trois jetons, un anneau, deux exceptions nommées ──
const ANNEAU = /^0 0 0 3px rgba\(0, ?104, ?118, ?\.\d+\)(, var\(--ombre-[12]\))?$/;
const JETON = /^var\(--ombre-(1|2|forte)\)$/;
const LAISSEES = [
  '0 -10px 30px rgba(25, 44, 52, .10)',   // bandeau de consentement (exclu, point 12)
  '0 8px 12px -10px rgba(0,0,0,.28)',     // liséré de l'en-tête de fiche collé
];
const utilises = new Set();
for (const rel of PERIMETRE) {
  for (const m of lire(rel).matchAll(/(?<![\w-])box-shadow\s*:\s*([^;}"']+)/g)) {
    const valeur = m[1].trim().replace(/\s+/g, ' ');
    if (valeur === 'none' || valeur === 'inherit') continue;
    if (JETON.test(valeur)) { utilises.add(valeur); continue; }
    if (ANNEAU.test(valeur)) continue;
    assert.ok(LAISSEES.includes(valeur), `${rel} : box-shadow « ${valeur} » n'est pas un jeton d'ombre`);
  }
}
assert.ok([...utilises].every((u) => JETON.test(u)), 'seuls les jetons d\'ombre sont utilisés');
assert.ok(utilises.size <= 3, `au plus trois ombres distinctes (jetons), trouvé ${utilises.size}`);
assert.ok(utilises.has('var(--ombre-1)') && utilises.has('var(--ombre-2)'), 'les deux jetons principaux servent');

// ── 4. Les valeurs verrouillées par d'autres tests restent ce qu'elles sont ──
assert.ok(/\.pastille \{[^}]*border-radius: 9999px/.test(lire('job-board.html')), 'la pastille reste une pilule (9999px)');

// ── 5. Le codemod : table, idempotence, refus des valeurs inconnues ──
const rayon = (v) => codemod.convertirRayon(v).valeur;
assert.equal(rayon('4px'), 'var(--r-s)');
assert.equal(rayon('3px'), 'var(--r-s)');
assert.equal(rayon('.25rem'), 'var(--r-s)');
assert.equal(rayon('6px'), 'var(--r-m)');
assert.equal(rayon('.4rem'), 'var(--r-m)');      // 6,4 px
assert.equal(rayon('.5rem'), 'var(--r-m)');
assert.equal(rayon('10px'), 'var(--r-l)');
assert.equal(rayon('.625rem'), 'var(--r-l)');    // 10 px
assert.equal(rayon('999px'), '9999px');
assert.equal(rayon('50%'), '50%');
assert.equal(rayon('.625rem .625rem 0 0'), 'var(--r-l) var(--r-l) 0 0');
assert.equal(rayon('var(--r-l, .625rem)'), 'var(--r-l)', 'le repli en dur disparaît');
assert.ok(codemod.convertirRayon('5px').erreur, 'une valeur entre deux crans demande un choix humain');
assert.ok(codemod.convertirRayon('1em').erreur, 'une unité inconnue est signalée');
assert.equal(codemod.convertirOmbre('0 5px 16px rgba(25,44,52,.14)').valeur, 'var(--ombre-2)');
assert.equal(codemod.convertirOmbre('var(--ombre-1, var(--ombre))').valeur, 'var(--ombre-1)');
assert.ok(codemod.convertirOmbre('0 3px 9px red').erreur, 'une ombre inconnue est signalée');

for (const rel of PERIMETRE) {
  const texte = lire(rel);
  const r = codemod.transformer(texte);
  assert.equal(r.erreurs.length, 0, `${rel} : aucune valeur hors table`);
  assert.equal(r.texte, texte, `${rel} : le codemod est idempotent (rien à changer sur un fichier déjà converti)`);
}
const synthese = codemod.transformer('.a { border-radius: .625rem; box-shadow: 0 5px 16px rgba(25,44,52,.14); }');
assert.equal(synthese.texte, '.a { border-radius: var(--r-l); box-shadow: var(--ombre-2); }');
assert.equal(codemod.transformer(synthese.texte).texte, synthese.texte, 'deuxième passage : identique');

const cli = spawnSync(process.execPath, [path.join(RACINE, 'tools/codemod-jetons-design.cjs'), '--verifier'], { encoding: 'utf8' });
assert.equal(cli.status, 0, `« codemod --verifier » doit réussir : ${cli.stdout}${cli.stderr}`);

console.log('Jetons de design tests passed — rayons et ombres sur l\'échelle,', PERIMETRE.length, 'fichiers');
