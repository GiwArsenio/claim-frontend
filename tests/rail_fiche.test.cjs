// Le rail latéral de la fiche de poste.
//
// Deux surfaces le portent : la fiche du job board et la page d'offre rendue
// côté serveur. Elles doivent dire la même chose de la même façon — sinon le
// lecteur change de page en changeant d'adresse.
//
// Le rail ne parle que de cette offre : l'employeur, ce qu'il propose, les
// offres voisines. Rien de ce qui navigue ailleurs n'a le droit d'y entrer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const board = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');
const offre = fs.readFileSync(path.join(__dirname, '../api/offre.js'), 'utf8');
const annuaire = require('../assets/companies-data.js');

/* ── 1. Le module de données ─────────────────────────────────────────────── */

assert.ok(annuaire.PROFILS.length >= 12, "l'annuaire doit couvrir les principaux employeurs");

// Chaque profil doit être complet et cohérent avec le vocabulaire des avantages.
for (const profil of annuaire.PROFILS) {
  assert.ok(profil.slug && profil.nom, `un profil sans slug ni nom : ${JSON.stringify(profil.slug)}`);
  assert.ok(annuaire.TYPES[profil.type], `${profil.slug} : type inconnu « ${profil.type} »`);
  ['aPropos', 'avantages'].forEach((champ) => {
    assert.ok(profil[champ] !== undefined, `${profil.slug} : ${champ} manquant`);
  });
  for (const code of profil.avantages) {
    assert.ok(annuaire.AVANTAGES[code], `${profil.slug} : avantage inconnu « ${code} »`);
  }
  // Un lien social déclaré doit être une adresse vérifiable, jamais un mot.
  for (const lien of [profil.linkedin, profil.site]) {
    if (lien) assert.match(lien, /^https:\/\//, `${profil.slug} : lien non absolu « ${lien} »`);
  }
}

// Les alias confondent les écritures d'un même employeur.
assert.equal(annuaire.profilEntreprise('bnp_cardif').nom, 'BNP Paribas Cardif');
assert.equal(annuaire.profilEntreprise('malakoff_humanis').nom, 'Malakoff Humanis');
assert.equal(annuaire.profilEntreprise('mlm-inconnu'), null, 'un slug inconnu ne doit rien inventer');

// La même entreprise porte la même couleur, quelle que soit l'écriture du slug.
assert.equal(annuaire.couleurEntreprise('swiss_life'), annuaire.couleurEntreprise('swiss-life'));

/* ── 2. Ce que le rail a le droit de dire ────────────────────────────────
   La présentation de l'employeur ouvre presque toujours l'annonce. Mais
   l'annonce commence aussi par le fil d'Ariane du site carrières, et son
   premier paragraphe parle souvent des missions. Rien de tout cela n'est une
   présentation : ces cas doivent être refusés, pas approximés. */
const FIL_ARIANE = "Accueil / Offres d'emploi / Expert IA F/H Expert IA F/H Partager sur : Et si révéler chaque potentiel c'était faire progresser tout le monde ? Nous sommes un acteur majeur de la protection sociale en France et nous recrutons.";
assert.equal(annuaire.accrocheEntreprise(FIL_ARIANE).slice(0, 6), 'Et si ',
  "le fil d'Ariane doit être retiré avant d'extraire la présentation");

const MISSIONS = "=== Missions === seront : - Etablir et analyser les résultats sur les périmètres des dossiers à fort enjeu pour le Groupe, sur les risques prévoyance et santé.";
assert.equal(annuaire.accrocheEntreprise(MISSIONS), '',
  "un paragraphe de missions n'est pas une présentation d'entreprise");

const VITRINE = "Matmut - Référent QDD RH F/H Site carrière Matmut : toutes nos offres d'emploi Suivez-nous Accueil Déposer une candidature spontanée Ma recherche, mon alerte La carte des offres Retour Pages RH Groupe.";
assert.equal(annuaire.accrocheEntreprise(VITRINE), '',
  'la navigation du site carrières ne doit jamais devenir une présentation');

const LEADERSHIP = 'Working closely with business stakeholders, the Principal AI Engineer provides hands-on technical leadership and is accountable for the quality of the deliverables of the team.';
assert.equal(annuaire.accrocheEntreprise(LEADERSHIP), '',
  '« leadership » n\'est pas « leader » : le propos doit porter sur l\'entreprise');

const PRESENTATION = "Leader français de l'assurance auto en ligne depuis 1992, Direct Assurance propose des offres d'assurance habitation, moto et santé. Plus de deux millions de clients nous font confiance. VOTRE RÔLE ET VOS MISSIONS Au sein de l'équipe Data & AI, vous serez responsable de la cohérence des données.";
const presentation = annuaire.accrocheEntreprise(PRESENTATION);
assert.ok(presentation.startsWith("Leader français de l'assurance"), 'la présentation doit être reconnue');
assert.ok(!presentation.includes('VOTRE RÔLE'), "l'extrait doit s'arrêter au poste");

/* ── 3. Les avantages ne se devinent pas ─────────────────────────────────
   « prévoyance », « mutuelle » et « formation » sont aussi des métiers : une
   annonce d'actuaire santé les emploie sans rien promettre. Ils ne comptent
   que dans une liste d'avantages annoncée comme telle. */
const ANNONCE_METIER = "Nous recherchons un actuaire spécialiste de la prévoyance collective et de la santé. Vous travaillerez sur des sujets de formation et de qualité de données.";
assert.deepEqual(annuaire.avantagesDe(ANNONCE_METIER, null), [],
  'un mot du métier ne doit pas devenir un avantage');

const ANNONCE_AVANTAGES = 'Ce que nous vous offrons : télétravail 3 jours, tickets restaurant, intéressement, mutuelle et RTT.';
const avantages = annuaire.avantagesDe(ANNONCE_AVANTAGES, null);
['Tickets restaurant', 'Intéressement', 'RTT', 'Télétravail', 'Mutuelle'].forEach((attendu) => {
  assert.ok(avantages.includes(attendu), `« ${attendu} » devrait être relevé`);
});

// Le profil déclare ses avantages : ils passent devant ceux qu'on déduit.
const declares = annuaire.avantagesDe('', annuaire.profilEntreprise('axa'));
assert.ok(declares.includes('PEE') && declares.length <= 6, 'le profil doit alimenter la liste');

// La fraîcheur se dit en clair, jamais en date brute.
assert.equal(annuaire.publicationLabel(new Date().toISOString()), "publiée aujourd'hui");
assert.equal(annuaire.publicationLabel(''), '');

/* ── 4. Le rail n'existe plus ────────────────────────────────────────────
   Retire des deux surfaces le 16/10/2026. Ce test est le contraire de ce
   qu'il etait : il ne verrouille plus ce que le rail porte, mais ce qu'il
   ne doit plus laisser derriere lui. Un bloc supprime qui laisse ses
   regles se reinstalle tout seul. */

for (const [nom, source] of [['le board', board], ["la page d'offre", offre]]) {
  // Ni rendu, ni gabarit.
  for (const trace of ['railOffreHtml', 'railOffre(', 'class="rail', '<aside class="rail',
                       '${rail}', 'rail-similaires']) {
    assert.ok(!source.includes(trace), `${nom} ne doit plus contenir « ${trace} »`);
  }
  // Ni style : aucune regle du rail ne doit survivre.
  assert.ok(!/\.rail\s*\{/.test(source), `${nom} : plus aucune regle .rail`);
  assert.ok(!/\.rail-[a-z-]+\s*\{/.test(source), `${nom} : plus aucune regle .rail-*`);
  // Ni media query qui l'habillait.
  assert.ok(!/@media \(min-width: 1280px\)/.test(board), "le seuil des trois colonnes est retire");
  assert.ok(!/@media \(min-width: 1120px\)[\s\S]{0,4000}\.rail/.test(offre),
    "la media query du bureau n'habille plus de rail");
  // Ni variable morte.
  assert.ok(!/--rail-large/.test(source), `${nom} : plus de variable --rail-large`);
}

// La fiche, elle, n'a pas bouge : les deux surfaces gardent chacune leur
// enveloppe, les pastilles et le pied. Ce sont les derniers points qu'elles
// partagent — le rail etait le reste.
const PARTAGE = ['.pastilles', '.pastille', '.pied'];
for (const selecteur of PARTAGE) {
  const motif = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}';
  assert.ok(board.match(new RegExp(motif)), `${selecteur} doit etre defini sur le board`);
  assert.ok(offre.match(new RegExp(motif)), `${selecteur} doit etre defini sur la page d'offre`);
}

// La fiche reste une carte blanche, angles arrondis, et son en-tete se fige.
assert.ok(/\.dc \{[\s\S]{0,300}border-radius: \.75rem;/.test(board),
  'la fiche reste une carte, angles arrondis');
assert.ok(/\.d-entete \{[\s\S]{0,400}position: sticky;/.test(board),
  "et son en-tete se fige toujours au defilement");
assert.ok(/\.enveloppe \{[\s\S]{0,300}border-radius: \.75rem;/.test(offre),
  "la page d'offre garde sa carte");

console.log('Rail de la fiche tests passed —', annuaire.PROFILS.length,
  'profils,', PARTAGE.length, 'selecteurs partages, rail retire');
