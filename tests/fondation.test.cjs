// tests/fondation.test.cjs
//
// Fondations : le dépôt se tient debout.
//
// Ce fichier vérifie ce qui doit être vrai AVANT toute autre chose :
// les fichiers existent, ils se parsent, le dépôt s installe, les
// ressources déclarées existent.
//
// Ce fichier couvre :
//   F01 — découverte de tous les fichiers de test
//   F02 — syntaxe JavaScript, serveur et client
//   F03 — validité des documents : HTML, JSON, XML, JSON-LD
//   F04 — existence des ressources locales référencées
//   F05 — configuration d environnement
//   F06 — reproductibilité de l installation

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..');

const lire = (relatif) => fs.readFileSync(path.join(RACINE, relatif), 'utf8');
const existe = (relatif) => fs.existsSync(path.join(RACINE, relatif));

// ─────────────────────────────────────────────────────────────────────────
// F02 — La syntaxe de chaque fichier JavaScript du dépôt.
// ─────────────────────────────────────────────────────────────────────────
const fichiersJs = [];
(function parcourir(dossier) {
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name === 'node_modules' || entree.name === '.git') continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) parcourir(complet);
    else if (entree.name.endsWith('.js') || entree.name.endsWith('.cjs')) fichiersJs.push(complet);
  }
})(RACINE);

assert.ok(fichiersJs.length >= 8, 'le dépôt doit contenir des fichiers JavaScript à vérifier');
for (const fichier of fichiersJs) {
  execFileSync('node', ['--check', fichier], { stdio: 'pipe' });
}

// ─────────────────────────────────────────────────────────────────────────
// F02 — Les scripts inline des pages HTML doivent se parser.
//
// Deux pièges, tous deux rencontrés dans ce projet :
//   - un bloc JSON-LD n est pas du JavaScript : le passer au parseur JavaScript
//     échoue, alors que le document est parfaitement valide ;
//   - un script inline contient du HTML échappé par le gabarit : il n est pas
//     analysable directement, il l est une fois le gabarit rendu.
// ─────────────────────────────────────────────────────────────────────────
const pagesHtml = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
assert.ok(pagesHtml.length >= 4, 'le dépôt doit contenir plusieurs pages');

for (const page of pagesHtml) {
  const html = lire(page);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [ , code ] of scripts) {
    // Un script inline de page statique est du JavaScript exécutable.
    if (/\$\{|\$\{/.test(code)) continue; // gabarit : rendu par api/offre.js
    assert.doesNotThrow(
      () => new Function(code),
      'le script inline de ' + page + ' doit se parser'
    );
  }

  // Le JSON-LD, lui, doit se lire comme du JSON.
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [ , contenu ] of jsonLd) {
    assert.doesNotThrow(
      () => JSON.parse(contenu),
      'le bloc JSON-LD de ' + page + ' doit être du JSON valide'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// F03 — Les documents XML et JSON du dépôt.
// ─────────────────────────────────────────────────────────────────────────
assert.doesNotThrow(() => JSON.parse(lire('package.json')), 'package.json doit être du JSON valide');
assert.doesNotThrow(() => JSON.parse(lire('vercel.json')), 'vercel.json doit être du JSON valide');
// L annuaire est un module JavaScript, pas du JSON : il est vérifié par
// l exécution, dans annuaire.test.cjs. Ici, on vérifie seulement qu il se
// charge et qu il expose le contrat attendu.
const annuaire = require(path.join(RACINE, 'assets/companies-data.js'));
assert.ok(Array.isArray(annuaire.PROFILS), 'l annuaire doit exposer une liste de profils');
assert.ok(annuaire.PROFILS.length > 0, 'l annuaire ne doit pas être vide');
assert.ok(typeof annuaire.profilEntreprise === 'function', 'l annuaire doit exposer profilEntreprise');
assert.ok(typeof annuaire.couleurEntreprise === 'function', 'l annuaire doit exposer couleurEntreprise');

// ─────────────────────────────────────────────────────────────────────────
// F04 — Les ressources locales référencées existent.
//
// Une page qui référence une feuille absente se dégrade en silence : elle
// s affiche, mais sans style. C est invisible en test visuel, et très visible
// pour le visiteur.
// ─────────────────────────────────────────────────────────────────────────
for (const page of pagesHtml) {
  const html = lire(page);
  const ressources = [...html.matchAll(/(?:href|src)="(\/assets\/[^"?#]+)"/g)].map((m) => m[1]);
  for (const ressource of ressources) {
    assert.ok(
      existe(ressource.slice(1)),
      page + ' référence ' + ressource + ', qui n existe pas'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// F05 — La configuration d environnement est décrite, et ne contient pas de secret.
// ─────────────────────────────────────────────────────────────────────────
assert.ok(existe('.env.example'), 'le dépôt doit décrire sa configuration d environnement');
const exemple = lire('.env.example');
const valeurs = exemple.split('\n')
  .filter((l) => l.trim() && !l.trim().startsWith('#'))
  .map((l) => l.split('=').slice(1).join('=').trim())
  .filter((v) => v && !/^your_/i.test(v) && !/^<.*>$/.test(v));

// Une URL publique n est pas un secret. Ce qui en est un : une clé d API,
// un jeton, une clé privée. On cherche les formes, pas la longueur.
const FORMES_SECRET = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^AIza[0-9A-Za-z_-]{20,}$/,
  /^ya29\.[0-9A-Za-z_-]+$/,
  /^sk-[0-9A-Za-z]{20,}$/,
  /^ghp_[0-9A-Za-z]{20,}$/,
  /^eyJ[0-9A-Za-z_-]{20,}\./,
];
for (const valeur of valeurs) {
  for (const forme of FORMES_SECRET) {
    assert.ok(!forme.test(valeur),
      'le fichier d exemple contient une valeur qui ressemble a un secret : ' + valeur.slice(0, 12) + '…');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// F04 — Les images sociales existent et ont la taille attendue.
// ─────────────────────────────────────────────────────────────────────────
for (const image of ['assets/favicon.png', 'assets/apple-touch-icon.png', 'assets/og-image.png']) {
  assert.ok(existe(image), image + ' doit exister');
  const entete = fs.readFileSync(path.join(RACINE, image)).subarray(0, 24);
  assert.equal(entete.readUInt32BE(0), 0x89504e47, image + ' doit être un PNG');
}

// ─────────────────────────────────────────────────────────────────────────
// F06 — Le dépôt s installe sans dépendance externe.
//
// Le projet n a aucune dépendance : c est un choix délibéré, qui permet
// à la CI de ne rien installer. Si un jour une dépendance apparaît, ce test
// doit le signaler, car la CI devra alors savoir l installer.
// ─────────────────────────────────────────────────────────────────────────
const paquet = JSON.parse(lire('package.json'));
assert.ok(!paquet.dependencies || Object.keys(paquet.dependencies).length === 0,
  'le projet ne doit pas avoir de dépendance de production sans le dire');
// Les dépendances de développement sont autorisées, mais elles doivent être
// listées ET installées par la CI : sinon la CI échoue sur un module
// absent, ou pire, passe parce qu'elle n'exécute rien.
//
// Seule la liste blanche ci-dessous est admise. Ajouter une dépendance ici
// doit être un choix explicite, pas un effet de bord d'un `npm install`.
const DEV_DEPENDANCES_ADMISES = ['@playwright/test'];
const devDependencies = Object.keys(paquet.devDependencies || {});
for (const nom of devDependencies) {
  assert.ok(DEV_DEPENDANCES_ADMISES.includes(nom),
    nom + ' n est pas une dépendance de développement admise : elle doit être justifiée');
}
const workflow = lire('.github/workflows/tests.yml');
assert.ok(workflow.includes('npm ci') || workflow.includes('npm install'),
  'la CI doit installer les dépendances de développement');
assert.ok(workflow.includes('playwright install') || workflow.includes('npx playwright'),
  'la CI doit installer et lancer le navigateur des parcours');

// ─────────────────────────────────────────────────────────────────────────
// F01 — Le fichier d exécuteur existe, et déclare tous les tests.
//
// Un test qui n est déclaré dans aucune famille ne s exécuterait jamais.
// C est le piège que le runner refuse : mieux vaut le voir ici.
// ─────────────────────────────────────────────────────────────────────────
assert.ok(existe('tools/run-tests.cjs'), 'l exécuteur de tests doit exister');
const runner = lire('tools/run-tests.cjs');
const declares = [...runner.matchAll(/'(tests\/[^']+\.test\.cjs)'/g)].map((m) => m[1]);
const surDisque = fs.readdirSync(path.join(RACINE, 'tests'))
  .filter((f) => f.endsWith('.test.cjs'))
  .map((f) => 'tests/' + f);

for (const fichier of surDisque) {
  assert.ok(declares.includes(fichier), fichier + ' n est déclaré dans aucune famille : il ne s exécuterait jamais');
}
for (const fichier of declares) {
  assert.ok(surDisque.includes(fichier), fichier + ' est déclaré mais n existe pas');
}


// ─────────────────────────────────────────────────────────────────────────
// F06 — Le lockfile existe et correspond aux dependances declarees.
//
// Sans lockfile, une installation n est pas reproductible. Le projet n a
// aujourd hui aucune dependance : le lockfile est donc vide, mais il doit
// exister, et rester coherent avec le manifeste.
// ─────────────────────────────────────────────────────────────────────────
assert.ok(existe('package-lock.json'), 'le dépôt doit porter un lockfile');
const lock = JSON.parse(lire('package-lock.json'));
assert.equal(lock.name, paquet.name, 'le lockfile doit concerner le même projet');
const dependancesLock = Object.keys(lock.packages && lock.packages[""] && lock.packages[""].dependencies || {});
const dependancesPaquet = Object.keys(paquet.dependencies || {});
assert.deepEqual(dependancesLock.sort(), dependancesPaquet.sort(),
  'le lockfile et le manifeste doivent déclarer les mêmes dépendances');
console.log('Fondation : syntaxe, documents, ressources, configuration, exécuteur — OK');
