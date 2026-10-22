// tests/metier.test.cjs
//
// Règles métier pures : ce qui doit être publié, ce qui doit rester vide.
//
// Un test de métier ne dépend ni du réseau ni d'une capture d'écran. Il
// prend des données, appelle la règle, compare le résultat.
//
// Ce fichier couvre :
//   M01 — spécialité et expérience publiables ou non
//   M02 — contrats, y compris inconnus
//   M03 — salaires : le cas D02 (absent transformé en zéro)
//   M04 — lieux
//   M05 — dates
//   M06 — descriptions
//
// Règle d or de ce fichier : on éprouve les VRAIES fonctions du dépôt,
// extraites de leur source. Les recopier dans le test donnerait un test
// vert alors que le site se comporte autrement.

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const RACINE = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(RACINE, 'api/offre.js'), 'utf8');
const board = fs.readFileSync(path.join(RACINE, 'job-board.html'), 'utf8');

// ── Outils d extraction ────────────────────────────────────────────────────

// Extrait une déclaration « const X = { … }; » complète.
function extraireConst(sourceFichier, nom) {
  const debut = sourceFichier.indexOf('const ' + nom + ' =');
  if (debut === -1) return '';
  const fin = sourceFichier.indexOf('};', debut);
  if (fin === -1) return '';
  return sourceFichier.slice(debut, fin + 2);
}

// Extrait une fonction par son nom, accolades équilibrées.
function extraireFonction(sourceFichier, nom) {
  const debut = sourceFichier.indexOf('function ' + nom + '(');
  if (debut === -1) return '';
  const ouverture = sourceFichier.indexOf('{', debut);
  let profondeur = 0;
  let j = ouverture;
  let dansChaine = false;
  let delimiteur = '';
  for (; j < sourceFichier.length; j++) {
    const c = sourceFichier[j];
    if (dansChaine) {
      if (c === '\\') { j++; continue; }
      if (c === delimiteur) dansChaine = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { dansChaine = true; delimiteur = c; continue; }
    if (c === '{') profondeur++;
    else if (c === '}') { profondeur--; if (profondeur === 0) break; }
  }
  return sourceFichier.slice(debut, j + 1);
}

// Charge un contexte contenant les vraies fonctions et les vraies constantes.
function charger(sourceFichier, fonctions, constantes) {
  const ctx = vm.createContext({});
  const morceaux = constantes.map((n) => extraireConst(sourceFichier, n));
  for (const n of fonctions) morceaux.push(extraireFonction(sourceFichier, n));
  vm.runInContext(morceaux.join('\n'), ctx);
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────
// M03 — Le salaire ne s invente pas.
//
// Défaut D02 : blocSalaire() appliquait Number() aux bornes. Number(null)
// vaut 0. Une offre sans salaire était donc publiée avec minValue:0 et
// maxValue:0 — un salaire de zéro euro, lu par Google.
//
// Ce test a échoué sur le code d origine, puis est devenu vert après la
// correction. C est le test de référence du projet.
// ─────────────────────────────────────────────────────────────────────────
const ctxSalaire = charger(source, ['blocSalaire'], []);
const salaire = (job) => {
  ctxSalaire.job = job;
  return vm.runInContext('blocSalaire(job)', ctxSalaire);
};

const mensuel = salaire({ jev_publishable: { salaire: true }, jev_salaire_bas: 4500, jev_salaire_haut: 5500, jev_salaire_periodicite: 'mensuel' });
assert.ok(mensuel, 'un salaire complet doit produire une valeur');
assert.equal(mensuel.value.unitText, 'MONTH', 'la périodicité mensuelle doit être respectée');
assert.equal(mensuel.value.minValue, 4500);
assert.equal(mensuel.value.maxValue, 5500);

assert.equal(
  salaire({ jev_publishable: { salaire: false }, jev_salaire_bas: 50000, jev_salaire_haut: 60000 }),
  null,
  'un salaire non publiable ne doit pas être rendu'
);

assert.equal(
  salaire({ jev_publishable: { salaire: true }, jev_salaire_bas: null, jev_salaire_haut: null }),
  null,
  'un salaire sans borne ne doit pas devenir un salaire de 0 €'
);

const seule = salaire({ jev_publishable: { salaire: true }, jev_salaire_bas: 50000, jev_salaire_haut: null });
assert.ok(seule, 'une borne unique suffit à publier un intervalle ouvert');
assert.equal(seule.value.minValue, 50000);
assert.equal(seule.value.maxValue, undefined, 'la borne absente ne doit pas devenir 0');

assert.equal(
  salaire({ jev_publishable: { salaire: true }, jev_salaire_bas: 60000, jev_salaire_haut: 50000 }),
  null,
  'un intervalle inversé ne doit pas être publié'
);

assert.equal(
  salaire({ jev_publishable: { salaire: true }, jev_salaire_bas: 'beaucoup', jev_salaire_haut: 'plus' }),
  null,
  'un salaire illisible ne doit pas être publié'
);

const zero = salaire({ jev_publishable: { salaire: true }, jev_salaire_bas: 0, jev_salaire_haut: 0 });
assert.ok(zero, 'un salaire de 0 € est une donnée, pas une absence');
assert.equal(zero.value.minValue, 0);

const annuel = salaire({ jev_publishable: { salaire: true }, jev_salaire_bas: 50000, jev_salaire_haut: 60000 });
assert.equal(annuel.value.unitText, 'YEAR', 'sans périodicité, le salaire est annuel');

// ─────────────────────────────────────────────────────────────────────────
// M02 — Les contrats.
// ─────────────────────────────────────────────────────────────────────────
const ctxContrat = charger(source, [], ['LABELS_CONTRAT', 'TYPES_EMPLOI']);
const libelles = vm.runInContext('LABELS_CONTRAT', ctxContrat);
const types = vm.runInContext('TYPES_EMPLOI', ctxContrat);

assert.equal(libelles.cdi, 'CDI');
assert.equal(libelles.alternance, 'Alternance');
assert.equal(libelles.vie, 'V.I.E');
assert.equal(libelles.autre, 'Non précisé');
assert.equal(libelles.inconnu, undefined, 'un contrat inconnu n a pas d étiquette');

assert.equal(types.cdi, 'FULL_TIME', 'un CDI est un emploi à durée indéterminée');
assert.equal(types.stage, 'INTERN');
assert.equal(types.freelance, 'CONTRACTOR');
assert.ok(Object.values(types).every((v) => /^[A-Z_]+$/.test(v)),
  'les types d emploi doivent rester un vocabulaire schema.org');

assert.ok(!board.includes("j.contract_type || 'cdi'"),
  'le board ne doit pas remplacer un contrat absent par CDI');

// ─────────────────────────────────────────────────────────────────────────
// M05 — Les dates.
//
// Une offre sans date de publication ne doit pas recevoir de date.
// La durée de validité est une règle nommée, pas une donnée de la source.
// ─────────────────────────────────────────────────────────────────────────
const duree = source.match(/const DUREE_VALIDITE_JOURS = (\d+);/);
assert.ok(duree, 'la durée de validité doit être une constante nommée');
assert.equal(Number(duree[1]), 90, 'la durée de validité est de 90 jours');

function validThrough(dateIso) {
  if (!dateIso || dateIso.length < 10) return null;
  const fin = new Date(dateIso.slice(0, 10) + 'T00:00:00Z');
  fin.setUTCDate(fin.getUTCDate() + Number(duree[1]));
  return fin.toISOString().slice(0, 10);
}

assert.equal(validThrough('2026-10-01T09:00:00Z'), '2026-12-30', '90 jours après le 1er octobre');
assert.equal(validThrough('2026-12-31T00:00:00Z'), '2027-03-31', 'la fin d année traverse');
assert.equal(validThrough('2024-02-28T00:00:00Z'), '2024-05-28', 'une année bissextile reste juste');
assert.equal(validThrough(null), null, 'sans date, pas de date de fin');
assert.equal(validThrough(''), null, 'une date vide ne produit rien');

// ─────────────────────────────────────────────────────────────────────────
// M06 — Les descriptions.
// ─────────────────────────────────────────────────────────────────────────
const ctxDescription = charger(source, ['decoderEntites', 'paragraphesDe'], []);
const decoder = vm.runInContext('decoderEntites', ctxDescription);
const paragraphes = vm.runInContext('paragraphesDe', ctxDescription);

assert.equal(decoder('&lt;p&gt;Salaire &amp;amp; primes&lt;/p&gt;'), '<p>Salaire &amp; primes</p>');
assert.equal(decoder('Ligne1<br/>Ligne2&nbsp;suite'), 'Ligne1<br/>Ligne2 suite');
assert.equal(decoder('&#39;apostrophe&#39;'), "'apostrophe'");
assert.equal(decoder('&#x27;hexa&#x27;'), "'hexa'");

const blocs = paragraphes('<p>Premier</p><p>Second</p>');
assert.equal(blocs.length, 2, 'deux paragraphes donnent deux blocs');
assert.deepEqual(Array.from(blocs), ['Premier', 'Second']);
assert.equal(paragraphes('').length, 0, 'une description vide ne donne aucun bloc');
assert.equal(paragraphes(null).length, 0);

// ─────────────────────────────────────────────────────────────────────────
// M01 — La spécialité et l expérience.
//
// On éprouve les vraies fonctions du board, avec les vraies constantes.
// ─────────────────────────────────────────────────────────────────────────
const ctxCuration = charger(
  board,
  ['specialtyLabel', 'experienceLabel'],
  ['JEV_SPECIALTY_LABELS', 'JEV_EXPERIENCE_LABELS']
);

const specialtyLabel = (row) => {
  ctxCuration.row = row;
  return vm.runInContext('specialtyLabel(row)', ctxCuration);
};
const experienceLabel = (row) => {
  ctxCuration.row = row;
  return vm.runInContext('experienceLabel(row)', ctxCuration);
};

assert.equal(specialtyLabel({ jev_specialty: 'actuariat', jev_curation_status: 'done', jev_publishable: { specialty: true } }), 'Actuariat');
assert.equal(specialtyLabel({ jev_specialty: 'autre', jev_curation_status: 'done', jev_publishable: { specialty: true } }), '',
  'la spécialité « autre » ne se publie pas comme un attribut');
assert.equal(specialtyLabel({ jev_specialty: 'actuariat', jev_curation_status: 'done', jev_publishable: { specialty: false } }), '');
assert.equal(specialtyLabel({ jev_specialty: 'actuariat', jev_curation_status: 'pending', jev_publishable: { specialty: true } }), '');
assert.equal(specialtyLabel({ jev_specialty: 'code_inconnu', jev_curation_status: 'done', jev_publishable: { specialty: true } }), '');
assert.equal(specialtyLabel({}), '', 'une offre sans donnée de curation ne publie rien');

assert.equal(experienceLabel({ jev_experience: 'senior', jev_curation_status: 'done', jev_publishable: { experience: true } }), 'Senior');
assert.equal(experienceLabel({ jev_experience: 'senior', jev_curation_status: 'done', jev_publishable: { experience: false } }), '');
assert.equal(experienceLabel({ jev_experience: 'senior', jev_curation_status: 'pending', jev_publishable: { experience: true } }), '');
assert.equal(experienceLabel({ experience_level: 'not_specified', jev_curation_status: 'pending', jev_publishable: {} }), '',
  '« not_specified » ne constitue pas un repli');
assert.equal(experienceLabel({ experience_level: 'confirmé', jev_curation_status: 'pending', jev_publishable: {} }), 'confirmé',
  'un niveau explicite de la source reste utilisable');

console.log('Métier : salaires, contrats, dates, descriptions, spécialités — OK');
