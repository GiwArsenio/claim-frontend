// tests/contrats_ga4.test.cjs
//
// Le contrat de mesure, entre le code du site et GA4.
//
// Ce fichier ne regarde pas la syntaxe : il vérifie que les événements
// émis portent les paramètres attendus, et que les paramètres interdits
// n apparaissent pas.
//
// Ce qui a été appris à l usage, et qu il faut conserver :
//   - GA4 n accepte qu un paramètre comme dimension OU comme métrique ;
//   - item_id et item_name n existent que dans le tableau items[] ;
//   - les dimensions de page de GA4 s appelent page_location, page_title ;
//   - une chaîne est tronquée à 100 caractères, un objet ne l est pas.
//
// Ce fichier couvre :
//   G01 — la mesure est déclarée sur les pages attendues
//   G02 — forme des paramètres
//   G03 — noms des événements

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const lire = (relatif) => fs.readFileSync(path.join(RACINE, relatif), 'utf8');

// ─────────────────────────────────────────────────────────────────────────
// G01 — La mesure est présente sur les pages publiées.
//
// Chaque page doit porter la balise, dans le <head>. Une page sans mesure
// n est pas visible dans les rapports : et rien ne le signale.
// ─────────────────────────────────────────────────────────────────────────
const PAGES_MESUREES = [
  'index.html',
  'job-board.html',
  'claim-entreprises.html',
  'claim-observatoire.html',
  'api/offre.js',
];

const BALISE = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-SKQQXZW4LH"></script>';

for (const page of PAGES_MESUREES) {
  const contenu = lire(page);
  assert.ok(contenu.includes(BALISE), page + ' ne porte pas la balise de mesure');
  assert.ok(contenu.includes("gtag('config', 'G-SKQQXZW4LH')"),
    page + ' ne configure pas la mesure');
}

// La page de révision est privée : elle ne doit pas être mesurée.
const revision = lire('claim-review.html');
assert.ok(!revision.includes('G-SKQQXZW4LH'),
  'la page de révision ne doit pas être mesurée : elle est privée');

// Chaque page ne doit porter la balise qu une fois.
for (const page of PAGES_MESUREES) {
  const contenu = lire(page);
  const occurrences = (contenu.match(new RegExp(BALISE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  assert.equal(occurrences, 1, page + ' porte ' + occurrences + ' balises de mesure, il en faut une');
}

// ─────────────────────────────────────────────────────────────────────────
// G03 — Les noms des événements.
//
// Le plan d événements est un document. Il doit correspondre au code, sinon
// les rapports ne quierement rien.
// ─────────────────────────────────────────────────────────────────────────
const EVENEMENTS = [
  'search',
  'filter_apply',
  'view_item_list',
  'select_item',
  'view_item',
  'job_apply_click',
  'share',
];

const board = lire('job-board.html');
const offre = lire('api/offre.js');

for (const nom of EVENEMENTS) {
  // Un événement peut être émis par un appel direct, ou mis en attente
  // puis émis plus tard — c est le cas de search et de filter_apply, dont
  // l émission attend la fin de la requête.
  const direct = board.includes("mesurer('" + nom + "'") || offre.includes("gtag('event', '" + nom + "'");
  const differe = board.includes("nom: '" + nom + "'") || board.includes('"' + nom + '",');
  assert.ok(direct || differe, 'l événement ' + nom + ' n est émis nulle part');
}

// view_item_list n existe que sur le board : la page d offre est une
// consultation, pas une liste.
assert.ok(board.includes("mesurer('view_item_list'"), 'le board doit émettre view_item_list');
assert.ok(!offre.includes("'view_item_list'"), 'la fiche ne doit pas émettre view_item_list');

// ─────────────────────────────────────────────────────────────────────────
// G02 — Les paramètres du board.
//
// Le board construit ses paramètres par paramOffre(). Le contrat est fixe :
// il ne doit pas changer sans que les rapports soient reconstruits.
// ─────────────────────────────────────────────────────────────────────────
const ATTENDU_BOARD = [
  'items',
  'company_name',
  'job_specialty',
  'contract_type',
  'experience_level',
  'job_source',
  'view_context',
];

const debutParam = board.indexOf('function paramOffre(');
const finParam = board.indexOf('\n}', debutParam) + 2;
const corpsParam = board.slice(debutParam, finParam);

for (const cle of ATTENDU_BOARD) {
  assert.ok(corpsParam.includes(cle + ':'), 'paramOffre ne produit pas la clé ' + cle);
}

// Les dimensions personnalisées créées côté GA4 doivent avoir un
// correspondant dans le code. Sinon la dimension reste vide à jamais.
const DIMENSIONS = [
  'job_specialty',
  'contract_type',
  'experience_level',
  'job_source',
  'view_context',
  'filtre_contrat',
  'filtre_specialite',
  'filtre_experience',
  'filtre_source',
  'filtre_ville',
];

for (const dimension of DIMENSIONS) {
  assert.ok(
    board.includes(dimension) || offre.includes(dimension),
    'la dimension ' + dimension + ' est créée dans GA4 mais le code ne l émet jamais'
  );
}

// Le compteur de filtres est une métrique, pas une dimension.
assert.ok(board.includes('filters_count'), 'le compteur de filtres doit être émis');
assert.ok(board.includes('function compteFiltres()'), 'le compteur de filtres doit être calculé par une fonction nommée');

// ─────────────────────────────────────────────────────────────────────────
// G02 — Les paramètres interdits.
//
// Un paramètre qui porte un nom réservé à GA4 crée une ambiguïté. Le
// code ne doit en produire aucun.
// ─────────────────────────────────────────────────────────────────────────
const RESERVES = ['page_location', 'page_title', 'page_path'];

for (const page of ['job-board.html', 'api/offre.js']) {
  const contenu = lire(page);
  for (const reserve of RESERVES) {
    const motif = new RegExp('(^|[{,{\\s])' + reserve + '\\s*:', 'm');
    assert.ok(!motif.test(contenu), page + ' émet le paramètre réservé ' + reserve);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// G02 — La troncature.
//
// Les chaînes longues doivent être tronquées, pour ne pas gonfler les
// rapports. Les objets, eux, doivent passer intacts.
// ─────────────────────────────────────────────────────────────────────────
assert.ok(board.includes('tronquer('), 'le board doit tronquer ses chaînes');
const mesure = board.slice(board.indexOf('function mesurer('), board.indexOf('\n}', board.indexOf('function mesurer(')) + 2);
assert.ok(/typeof v === 'string' \? tronquer\(v, 100\) : v/.test(mesure),
  'mesurer() doit tronquer les chaînes et laisser passer les objets');

// ─────────────────────────────────────────────────────────────────────────
// G03 — L événement de candidature.
//
// C est l intention de candidature, pas une candidature envoyée. Claim! ne
// voit pas ce qui se passe ensuite chez l employeur. Le code doit le dire.
// ─────────────────────────────────────────────────────────────────────────
assert.ok(board.includes('job_apply_click'), 'le board doit émettre job_apply_click');
assert.ok(offre.includes('job_apply_click'), 'la fiche doit émettre job_apply_click');

// Le commentaire qui explique la nature de l evenement precede la
// fonction. C est lui qui empeche de lire job_apply_click comme une
// candidature envoyee.
const commentaire = board.slice(
  Math.max(0, board.indexOf('mesurerClicPostuler') - 700),
  board.indexOf('mesurerClicPostuler')
);
assert.ok(/intention/i.test(commentaire),
  'le code doit rappeler que c est une intention, pas une candidature envoyee');

console.log('Contrats GA4 : balises, événements, paramètres, dimensions, troncature — OK');
