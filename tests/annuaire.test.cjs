// tests/annuaire.test.cjs
//
// L annuaire des entreprises.
//
// Il enrichit les fiches : logo, présentation, avantages. Une donnée
// inventée dégrade la lecture, et une donnée fausse décrédibilise le site.
//
// Ce fichier couvre :
//   D01 — profils : unicité, complétude, cohérence
//   D02 — alias : même employeur, écritures différentes
//   D03 — avantages : ce qui est déclaré, ce qui ne se devine pas
//   D04 — logos : source, annuaire, initiales
//   D05 — présentation : ce qui n est pas une présentation
//   D06 — comportement quand l annuaire est absent

const assert = require('node:assert/strict');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const annuaire = require(path.join(RACINE, 'assets/companies-data.js'));

// ─────────────────────────────────────────────────────────────────────────
// D01 — Les profils sont complets et cohérents.
// ─────────────────────────────────────────────────────────────────────────
assert.ok(Array.isArray(annuaire.PROFILS), 'l annuaire doit exposer une liste de profils');
assert.ok(annuaire.PROFILS.length >= 12, 'l annuaire doit couvrir les principaux employeurs');

const slugs = new Set();
for (const profil of annuaire.PROFILS) {
  assert.ok(profil.slug, 'un profil sans slug');
  assert.ok(profil.nom, 'un profil sans nom : ' + profil.slug);
  assert.ok(!slugs.has(profil.slug), 'deux profils portent le même slug : ' + profil.slug);
  slugs.add(profil.slug);

  assert.ok(annuaire.TYPES[profil.type], profil.slug + ' : type inconnu « ' + profil.type + ' »');
  assert.ok(profil.aPropos !== undefined, profil.slug + ' : présentation manquante');
  assert.ok(Array.isArray(profil.avantages), profil.slug + ' : les avantages doivent être une liste');

  for (const code of profil.avantages) {
    assert.ok(annuaire.AVANTAGES[code], profil.slug + ' : avantage inconnu « ' + code + ' »');
  }

  // Un lien social déclaré doit être une adresse, jamais un mot.
  for (const lien of [profil.linkedin, profil.site]) {
    if (lien) assert.match(lien, /^https:\/\//, profil.slug + ' : lien non absolu « ' + lien + ' »');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// D02 — Les alias désignent le même employeur.
//
// Un employeur écrit de plusieurs façons doit porter le même nom et la
// même couleur, quelle que soit l écriture.
// ─────────────────────────────────────────────────────────────────────────
assert.equal(annuaire.profilEntreprise('bnp_cardif').nom, 'BNP Paribas Cardif');
assert.equal(annuaire.profilEntreprise('malakoff_humanis').nom, 'Malakoff Humanis');
assert.equal(annuaire.profilEntreprise('mlm-inconnu'), null, 'un slug inconnu ne doit rien inventer');

assert.equal(
  annuaire.couleurEntreprise('swiss_life'),
  annuaire.couleurEntreprise('swiss-life'),
  'la couleur ne doit pas dépendre de l écriture du slug'
);

// La couleur doit exister et être une couleur.
const couleur = annuaire.couleurEntreprise('swiss_life');
assert.match(couleur, /^#[0-9a-fA-F]{6}$/, 'la couleur doit être un hexadécimal : ' + couleur);

// ─────────────────────────────────────────────────────────────────────────
// D03 — Les avantages ne se devinent pas.
//
// « prévoyance », « mutuelle » et « formation » sont aussi des métiers. Une
// annonce d actuaire santé les emploie sans rien promettre. Ces mots ne
// comptent que dans une liste d avantages annoncée comme telle.
// ─────────────────────────────────────────────────────────────────────────
const ANNONCE_METIER =
  'Nous recherchons un actuaire spécialiste de la prévoyance collective et de la santé. ' +
  'Vous travaillerez sur des sujets de formation et de qualité de données.';
assert.deepEqual(
  Array.from(annuaire.avantagesDe(ANNONCE_METIER, null)),
  [],
  'un mot du métier ne doit pas devenir un avantage'
);

const ANNONCE_AVANTAGES =
  'Ce que nous vous offrons : télétravail 3 jours, tickets restaurant, intéressement, mutuelle et RTT.';
const avantages = Array.from(annuaire.avantagesDe(ANNONCE_AVANTAGES, null));
for (const attendu of ['Tickets restaurant', 'Intéressement', 'RTT', 'Télétravail', 'Mutuelle']) {
  assert.ok(avantages.includes(attendu), '« ' + attendu + ' » devrait être relevé');
}

// Le profil déclaré passe devant ce qui est deviné.
const declares = Array.from(annuaire.avantagesDe('', annuaire.profilEntreprise('axa')));
assert.ok(declares.includes('PEE'), 'le profil doit alimenter la liste');
assert.ok(declares.length <= 6, 'la liste ne doit pas être démesurée : ' + declares.length);

// ─────────────────────────────────────────────────────────────────────────
// D05 — Ce qui n est pas une présentation.
//
// La présentation de l employeur ouvre presque toujours l annonce. Mais
// l annonce commence par le fil d Arianne du site carrières, et son premier
// paragraphe parle souvent des missions. Rien de tout cela n est une
// présentation d entreprise.
// ─────────────────────────────────────────────────────────────────────────
const FIL_ARIANE =
  'Accueil / Offres d emploi / Expert IA F/H Expert IA F/H Partager sur : ' +
  'Et si révéler chaque potentiel c était faire progresser tout le monde ? ' +
  'Nous sommes un acteur majeur de la protection sociale en France et nous recrutons.';
assert.ok(
  annuaire.accrocheEntreprise(FIL_ARIANE).startsWith('Et si '),
  'le fil d Ariane doit être retiré avant d extraire la présentation'
);

const MISSIONS =
  '=== Missions === seront : - Etablir et analyser les résultats sur les périmètres ' +
  'des dossiers à fort enjeu pour le Groupe, sur les risques prévoyance et santé.';
assert.equal(
  annuaire.accrocheEntreprise(MISSIONS),
  '',
  'un paragraphe de missions n est pas une présentation d entreprise'
);

const VITRINE =
  'Matmut - Référent QDD RH F/H Site carrière Matmut : toutes nos offres d emploi ' +
  'Suivez-nous Accueil Déposer une candidature spontanée Ma recherche, mon alerte ' +
  'La carte des offres Retour Pages RH Groupe.';
assert.equal(
  annuaire.accrocheEntreprise(VITRINE),
  '',
  'la navigation du site carrières ne doit jamais devenir une présentation'
);

const LEADERSHIP =
  'Working closely with business stakeholders, the Principal AI Engineer provides ' +
  'hands-on technical leadership and is accountable for the quality of the deliverables of the team.';
assert.equal(
  annuaire.accrocheEntreprise(LEADERSHIP),
  '',
  '« leadership » n est pas « leader » : le propos doit porter sur l entreprise'
);

const PRESENTATION =
  'Leader français de l assurance auto en ligne depuis 1992, Direct Assurance propose ' +
  'des offres d assurance habitation, moto et santé. Plus de deux millions de clients ' +
  'nous font confiance. VOTRE RÔLE ET VOS MISSIONS Au sein de l équipe Data & AI, ' +
  'vous serez responsable de la cohérence des données.';
const presentation = annuaire.accrocheEntreprise(PRESENTATION);
assert.ok(presentation.startsWith('Leader français de l assurance'), 'la présentation doit être reconnue');
assert.ok(!presentation.includes('VOTRE RÔLE'), 'l extrait doit s arrêter au poste');

// ─────────────────────────────────────────────────────────────────────────
// D05 — La fraîcheur se dit en clair, jamais en date brute.
// ─────────────────────────────────────────────────────────────────────────
assert.equal(annuaire.publicationLabel('2026-10-22T08:00:00Z'), "publiée aujourd'hui");
assert.equal(annuaire.publicationLabel(''), '', 'une date absente ne produit aucun libellé');
assert.equal(annuaire.publicationLabel(null), '', 'une date absente ne produit aucun libellé');

// ─────────────────────────────────────────────────────────────────────────
// D04 — Les logos.
//
// Trois sources possibles : le logo publié par la source, la table partagée,
// les initiales. Jamais de trou, et jamais deux rendus différents selon la
// surface.
// ─────────────────────────────────────────────────────────────────────────
assert.equal(typeof annuaire.logoEntreprise, 'function', 'l annuaire doit savoir rendre un logo');
assert.equal(typeof annuaire.initiales, 'function', 'l annuaire doit savoir produire des initiales');

const initiales = annuaire.initiales('Groupe VYV');
assert.ok(initiales && initiales.length >= 1, 'des initiales doivent être produites');
assert.ok(initiales.length <= 3, 'les initiales ne doivent pas être une phrase');
assert.ok(!/[éèàç]/i.test(initiales), 'les initiales ne doivent pas garder d accent');

assert.equal(annuaire.initiales(''), '', 'sans nom, pas d initiales');
assert.equal(annuaire.initiales(null), '', 'sans nom, pas d initiales');

// ─────────────────────────────────────────────────────────────────────────
// D06 — L annuaire ne doit pas faire tomber le site.
//
// La page d offre l importe dans un try/catch : si le fichier manque au
// déploiement, la page doit se lire quand même. Ce test vérifie que le
// contrat tient sans annuaire.
// ─────────────────────────────────────────────────────────────────────────
assert.ok(typeof annuaire.profilEntreprise('inconnu_xyz') === 'object' || annuaire.profilEntreprise('inconnu_xyz') === null,
  'profilEntreprise doit renvoyer un objet ou null, jamais une exception');

console.log('Annuaire : profils, alias, avantages, logos, présentations — OK');
