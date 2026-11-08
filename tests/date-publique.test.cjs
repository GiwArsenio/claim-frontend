const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const chemin = require('node:path').join(__dirname, '../job-board.html');
const html = fs.readFileSync(chemin, 'utf8');

// La fiche utilise bien la date publique, dans l'ordre convenu.
assert.match(html, /j\.published_at \|\| j\.source_published_at \|\| j\.first_seen_at/);

// ── Extraction de la fonction de production ─────────────────────────────
// Le test NE COPIE PAS formatDate : il exécute celle réellement employée
// par le board. Une copie peut diverger en silence (c'est arrivé). Ici, si
// la fonction disparaît ou devient ambiguë, le test ÉCHOUE — il ne passe pas
// sur une fonction fantôme.
const depart = html.indexOf('function formatDate(iso)');
assert.notEqual(depart, -1, 'formatDate introuvable dans job-board.html');
const fin = html.indexOf('\n}', depart);
assert.notEqual(fin, -1, 'fin de formatDate introuvable');
const source = html.slice(depart, fin + 2);   // inclut la accolade fermante

// Une seule définition de formatDate dans le fichier : sinon la borne
// ci-dessus serait arbitraire.
assert.equal((html.match(/function formatDate\(/g) || []).length, 1,
  'formatDate doit être défini exactement une fois dans job-board.html');

// ── Horloge fixe ────────────────────────────────────────────────────────
// formatDate lit `new Date()` pour « maintenant ». On gèle le temps pour que
// les cas soient déterministes, quel que soit le moment du lancement.
const MAINTENANT = Date.parse('2026-11-08T12:00:00Z');
class DateFige extends Date {
  constructor(...args) {
    if (args.length === 0) super(MAINTENANT);   // new Date() = maintenant
    else super(...args);
  }
  static now() { return MAINTENANT; }
}

const context = vm.createContext({ Date: DateFige, Math });
vm.runInContext(source, context);
const formatDate = (iso) => vm.runInContext(`formatDate(${JSON.stringify(iso)})`, context);

// ── Cas aux bornes ──────────────────────────────────────────────────────
// Paliers du board : 30 j = 1 mois, 60 j = 2 mois, 90 j = 3 mois (30 j/mois).
const jour = (n) => new Date(MAINTENANT - n * 86400000).toISOString();
const cas = [
  [0,   "Aujourd'hui"],
  [1,   'Il y a 1 jour'],
  [2,   'Il y a 2 jours'],
  [6,   'Il y a 6 jours'],
  [7,   'Il y a 1 semaine'],
  [13,  'Il y a 1 semaine'],
  [14,  'Il y a 2 semaines'],
  [21,  'Il y a 3 semaines'],
  [29,  'Il y a 4 semaines'],
  [30,  'Il y a 1 mois'],
  [59,  'Il y a 1 mois'],
  [60,  'Il y a 2 mois'],
  [89,  'Il y a 2 mois'],
  [90,  'Il y a 3 mois'],
  [360, 'Il y a 12 mois'],
  [365, 'Il y a 12 mois'],
];
for (const [jours, attendu] of cas) {
  assert.equal(formatDate(jour(jours)), attendu, `${jours} jours`);
}

// ── Valeurs absentes / invalides ────────────────────────────────────────
// Jamais « NaN », « undefined » ni « Invalid Date ».
assert.equal(formatDate(null), '');
assert.equal(formatDate(undefined), '');
assert.equal(formatDate(''), '');
assert.equal(formatDate('date-invalide'), '', 'date invalide → chaîne vide');
assert.ok(!/NaN|undefined|Invalid/.test(formatDate('date-invalide')));

// ── Date future ─────────────────────────────────────────────────────────
// Un diff négatif ne doit produire aucun libellé « Il y a N … » trompeur.
const futur = formatDate(new Date(MAINTENANT + 3 * 86400000).toISOString());
assert.ok(!/Il y a/.test(futur), `une date future ne doit pas afficher « Il y a… » (obtenu: ${futur})`);

console.log('date publique : fonction de production testée,', cas.length, 'bornes + invalides + future — OK');
