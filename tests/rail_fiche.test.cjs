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

const board = fs.readFileSync(path.join(__dirname, '../claim-job-board.html'), 'utf8');
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

/* ── 4. Le rail rendu par le board ───────────────────────────────────────── */

function extraireFonction(source, nom) {
  const debut = source.indexOf('function ' + nom + '(');
  assert.ok(debut >= 0, `function ${nom} doit exister`);
  const fin = source.indexOf('\n}', debut) + 2;
  assert.ok(fin > debut, `function ${nom} doit être fermée`);
  return source.slice(debut, fin);
}

const contexte = vm.createContext({
  CLAIM_ENTREPRISES: annuaire,
  escapeHtml: (v) => String(v == null ? '' : v).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  companyColor: (s) => annuaire.couleurEntreprise(s),
  companyInitials: (n) => annuaire.initiales(n),
});
vm.runInContext(extraireFonction(board, 'railOffreHtml'), contexte);
// La fraîcheur est déléguée à l'annuaire : la page d'offre doit dater l'annonce
// exactement comme la fiche.
vm.runInContext(extraireFonction(board, 'publicationLabel'), contexte);

function railDe(offreTestee) {
  contexte.offreTestee = offreTestee;
  return vm.runInContext('railOffreHtml(offreTestee)', contexte);
}

const railProfilé = railDe({
  id: 'j1',
  title: 'Actuaire ALM',
  slug: 'actuaire-alm',
  source_published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  description_raw: PRESENTATION,
  companies: { name: 'AXA France', slug: 'axa' },
});

// Le bloc « Offres similaires » est posé vide puis rempli depuis la liste déjà
// chargée : son contenu se vérifie dans le code, pas dans le rendu initial.
for (const bloc of ['rail-bloc', 'rail-titre', 'rail-social', 'rail-tag', 'rail-pied', 'rail-similaires']) {
  assert.ok(railProfilé.includes(bloc), `le rail doit porter « ${bloc} »`);
}
assert.ok(board.includes('class="rail-offre"'), 'le board doit savoir lister les offres voisines');
assert.ok(offre.includes('class="rail-offre"'), "la page d'offre aussi");
for (const titre of ["L'employeur", "À propos de l'entreprise", 'Avantages', 'Offres similaires']) {
  assert.ok(railProfilé.includes(titre), `le rail doit porter le bloc « ${titre} »`);
}
assert.ok(railProfilé.includes('https://www.linkedin.com/company/axa-france'),
  "l'employeur doit pouvoir être retrouvé sur LinkedIn");
assert.ok(railProfilé.includes('claim-entreprises.html?entreprise=axa'),
  "« Découvrir l'entreprise » mène à la page Entreprises");
assert.ok(railProfilé.includes('publiée il y a 3 jours'), "l'offre doit être datée");

// Le rail informe : il ne propose ni filtre, ni navigation, ni autre liste.
for (const interdit of ['chip', 'filter', 'nav-links', 'burger', 'Postuler']) {
  assert.ok(!railProfilé.includes(interdit), `le rail ne doit pas contenir « ${interdit} »`);
}

// Une offre sans société connue ne doit pas faire tomber le rail.
const railNu = railDe({ id: 'j2', title: 'Offre', companies: {} });
assert.ok(railNu.includes('rail-bloc'), 'le rail tient même sans société');

/* ── 5. Le rail apparaît dans les deux surfaces ──────────────────────────── */

assert.ok(board.includes('${railOffreHtml(j)}'), 'la fiche du board doit rendre le rail');
assert.ok(board.includes('.rail { display: none; }'), 'le rail est masqué par défaut');
assert.ok(board.includes('display: contents'), 'sans place, le rail ne doit rien changer à la fiche');

assert.ok(offre.includes('railOffre(job, await offresVoisines(job, 4))'), 'la page d\'offre doit rendre le rail');
assert.ok(offre.includes('${rail}'), "le rail doit être posé dans la page d'offre");
assert.ok(offre.includes("require('../assets/companies-data.js')"),
  'la page d\'offre partage la source du board');

// Chaque surface a sa fenêtre : le board porte une colonne d'offres de 420 px
// en plus, la page d'offre non. Le seuil diffère, le comportement non.
assert.ok(/@media \(min-width: 1280px\)[\s\S]{0,4000}\.rail \{[\s\S]{0,600}display: block/.test(board),
  'sur le board, le rail s\'affiche quand la colonne et l\'enveloppe tiennent côte à côte');
assert.ok(/@media \(min-width: 1120px\)[\s\S]{0,4000}\.rail \{[\s\S]{0,600}display: block/.test(offre),
  'sur la page d\'offre, il tient plus tôt');

// Le rail est une carte, comme la fiche en face. Les deux surfaces doivent
// lui donner le même habillage : c'est lui qui délimite les deux zones.
function carteDuRail(source) {
  // La carte, et non le « display:none » de base : c'est la règle bureau qui
  // porte l'habillage, et c'est elle qui doit coïncider entre les surfaces.
  const regles = [...source.matchAll(/\.rail \{([^}]*)\}/g)].map((m) => m[1]);
  const carte = regles.find((r) => r.includes('position: sticky'));
  assert.ok(carte, 'le rail doit être habillé en carte au bureau');
  const sortie = {};
  for (const m of carte.matchAll(/([a-z-]+):\s*([^;]+)/g)) sortie[m[1]] = m[2].trim();
  return sortie;
}
for (const source of [board, offre]) {
  const rail = carteDuRail(source);
  assert.equal(rail['display'], 'block', 'le rail s\'affiche en bureau large');
  assert.equal(rail['position'], 'sticky', 'et suit la lecture');
  assert.equal(rail['background'], '#fff', 'le rail est une carte blanche');
  assert.equal(rail['border-radius'], '.75rem', 'aux angles de la fiche');
  assert.ok(rail['box-shadow'], 'il porte la même ombre que la fiche');
  assert.equal(rail['overflow'], 'hidden', 'ses blocs ne dépassent pas des angles');
}
assert.equal(carteDuRail(board)['box-shadow'], carteDuRail(offre)['box-shadow'],
  'la fiche et le rail se détachent du même gris de la même façon');


/* ── 6. Les deux rails portent les mêmes règles ──────────────────────────
   Le style du rail est écrit deux fois — une page est du HTML, l'autre du
   JavaScript. Ces règles comparent les valeurs une à une pour qu'aucune ne
   dérive en silence. */
const VARIABLES = { '--teal': '#006876', '--encre': '#191c1d', '--gris': '#515f78' };
const resoudre = (v) => v.replace(/var\((--[a-z]+)\)/g, (_, nom) => VARIABLES[nom] || nom);

function valeurs(source, selecteur) {
  const motif = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}';
  const trouve = source.match(new RegExp(motif));
  assert.ok(trouve, `${selecteur} doit être défini`);
  const sortie = {};
  for (const m of trouve[0].matchAll(/([a-z-]+):\s*([^;]+)/g)) {
    if (m[1] !== 'border') sortie[m[1]] = resoudre(m[2].trim());
  }
  return sortie;
}

const SELECTEURS = [
  '.rail-bloc', '.rail-titre', '.rail-texte', '.rail-lien', '.rail-entete', '.rail-logo',
  '.rail-nom', '.rail-sous', '.rail-faits', '.rail-sociaux', '.rail-social', '.rail-btn',
  '.rail-tags', '.rail-tag', '.rail-tag--avantage', '.rail-offre', '.rail-offre-titre',
  '.rail-offre-sous', '.rail-pied',
];

for (const selecteur of SELECTEURS) {
  const duBoard = valeurs(board, selecteur);
  const deLaPage = valeurs(offre, selecteur);
  assert.ok(Object.keys(duBoard).length >= 2, `${selecteur} doit déclarer ses règles`);
  for (const propriete of Object.keys(duBoard)) {
    assert.equal(deLaPage[propriete], duBoard[propriete],
      `${selecteur} → ${propriete} doit être identique sur la fiche et sur la page d'offre`);
  }
}


/* ── 7. Le rail ne disparaît jamais faute de place ────────────────────────
   C'est l'incident du 15/10/2026 : une mise à l'échelle de 125 % ramène un
   écran de 1 920 px à 1 536 px de large, et le rail — pourtant bien là —
   passait en « display: none ». Le lecteur perdait l'employeur, ses avantages
   et les offres voisines sans jamais savoir qu'ils existaient.

   Un contenu écrit ne doit pas s'évaporer parce que la fenêtre est étroite.
   Sous son seuil, le rail se replie sous la fiche. */
const repliBoard = board.match(
  /@media \(min-width: 769px\) and \(max-width: 1279\.98px\) \{\s*\.rail \{([^}]*)\}/);
assert.ok(repliBoard, 'le board doit replier le rail sous la fiche');
assert.match(repliBoard[1], /display:\s*block/, 'le rail replié reste visible');
assert.match(repliBoard[1], /max-width:\s*var\(--enveloppe-lecture\)/,
  'il reprend la largeur de lecture de la fiche');
assert.match(repliBoard[1], /margin:\s*1\.25rem auto 0/, 'et se pose sous elle, sur le même axe');

const repliOffre = offre.match(
  /@media \(min-width: 769px\) and \(max-width: 1119\.98px\) \{\s*\.page \{([^}]*)\}\s*\.rail \{([^}]*)\}/);
assert.ok(repliOffre, "la page d'offre doit replier le rail sous la fiche");
assert.match(repliOffre[1], /row-gap:\s*1\.25rem/, 'la gouttière sépare les deux zones');
assert.match(repliOffre[2], /display:\s*block/, 'le rail replié reste visible');
assert.match(repliOffre[2], /max-width:\s*46rem/, 'à la largeur de lecture de la fiche');
assert.match(repliOffre[2], /margin:\s*0 auto/, 'et sur le même axe qu elle');


// Pourquoi le seuil s'arrête là, et pas plus bas. Trois colonnes doivent tenir :
// la colonne des offres, la fiche et le rail. Au seuil, ce que laisse la
// colonne doit couvrir les deux planchers et leur gouttière — sinon le
// débordement ne se voit pas sur la page : il se cache dans le volet, qui
// défile. C'est ce qui est arrivé au premier essai (34 rem + 13 rem + 32 px
// pour 764 px de place).
const mediaTroisColonnes = [...board.matchAll(/@media \(min-width: (\d+)px\) \{([\s\S]*?)\n\}/g)]
  .find((m) => /\.dc-wrap \{[\s\S]*?display: flex/.test(m[2]));
assert.ok(mediaTroisColonnes, 'la mise en page à trois colonnes doit vivre dans une media query');
const seuil = Number(mediaTroisColonnes[1]);
assert.equal(seuil, 1280, 'trois colonnes tiennent à partir de 1 280 px');

const plancher = (selecteur) => {
  const motif = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}';
  const regle = mediaTroisColonnes[2].match(new RegExp(motif));
  assert.ok(regle, `${selecteur} doit poser son plancher dans le bloc à trois colonnes`);
  const m = regle[1].match(/min-width:\s*([\d.]+)rem/);
  assert.ok(m, `${selecteur} doit déclarer un plancher en rem`);
  return Number(m[1]) * 16;
};
assert.equal(plancher('.dc'), 512, 'la fiche ne descend pas sous 32 rem');
assert.equal(plancher('.rail'), 200, 'le rail ne descend pas sous 12,5 rem');

// --marge-page vaut son minimum (2 rem) tant que la fenêtre est sous 1 720 px.
const colonne = Number(board.match(/--colonne-liste: (\d+)px/)[1]);
const disponible = seuil - 2 * 32 - colonne - 32;
assert.equal(disponible, 764, 'ce que la colonne laisse au seuil');
assert.ok(plancher('.dc') + 32 + plancher('.rail') <= disponible,
  'au seuil, les deux planchers et leur gouttière doivent tenir dans la place laissée');

// Le replié est la même carte que le rail à côté de la fiche : un lecteur qui
// rétrécit sa fenêtre ne doit pas voir l'habillage changer.
for (const [nom, source, corps] of [
  ['le board', board, repliBoard[1]],
  ["la page d'offre", offre, repliOffre[2]],
]) {
  const sansEspaces = (s) => s.replace(/\s+/g, '');
  assert.ok(sansEspaces(corps).includes(sansEspaces(carteDuRail(source)['box-shadow'])),
    `${nom} : le rail replié porte l'ombre de la carte`);
  assert.match(corps, /background:\s*#fff/, `${nom} : et son fond blanc`);
  assert.match(corps, /border-radius:\s*\.75rem/, `${nom} : et ses angles arrondis`);
  assert.match(corps, /overflow:\s*hidden/, `${nom} : ses blocs ne dépassent pas des angles`);
}

// Ce qui reste masqué, et à quelle condition. Le seul « display: none » est
// celui du téléphone, posé avant toute media query : là, la fiche occupe tout
// l'écran et l'empilement n'aurait plus de fin. Aucune largeur de bureau n'a
// le droit de remasquer le rail.
for (const [nom, source] of [['le board', board], ["la page d'offre", offre]]) {
  const premiere = source.indexOf('@media');
  assert.ok(premiere > 0, `${nom} : le fichier déclare ses media queries`);
  assert.ok(/\.rail \{\s*display:\s*none;\s*\}/.test(source.slice(0, premiere)),
    `${nom} : le rail n'est masqué que par défaut`);
  assert.ok(!/\.rail \{[^}]*display:\s*none/.test(source.slice(premiere)),
    `${nom} : aucune largeur de bureau ne doit le masquer`);
}

console.log('Rail de la fiche tests passed —', annuaire.PROFILS.length, 'profils,', SELECTEURS.length, 'sélecteurs comparés');
