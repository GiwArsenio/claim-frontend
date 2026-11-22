const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../job-board.html'), 'utf8');
const funcs = ['specialtyLabel', 'experienceLabel', 'cardExperienceHtml', 'cardFactHtml', 'cardSalaryHtml', 'cardMetadataHtml', 'salaryLabel', 'cardLocationHtml', 'cardPlusHtml', 'cardTagsHtml', 'descriptionBlocks', 'descriptionHtml', 'decodeBasicEntities', 'descriptionSectionsHtml', 'prefMarche', 'urlOffre', 'skillLabels', 'cardSpecialtyHtml', 'skillsHtml'].map(name => {
 const start = html.indexOf('function ' + name + '(');
 const end = html.indexOf('\n}', start) + 2;
 assert.ok(start >= 0 && end > start);
 return html.slice(start, end);
}).join('\n');
const context = vm.createContext({});
// Le module d'icones : les gabarits appellent ICONES.icone(...).
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/icones.js'), 'utf8'), context);
// Le formateur de lieu (T04) : la carte l'appelle, il est charge par la page.
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/lieu.js'), 'utf8'), context);
// La règle des lignes (4 par ligne au plus, 2 au moins, « +N » de 2 au plus) : la carte l'appelle.
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/cartes-lignes.js'), 'utf8'), context);
vm.runInContext(`const JEV_SPECIALTY_LABELS = {"actuariat": "Actuariat", "ia_data": "IA / Data", "souscription_technique": "Souscription technique", "autre": "Autre"}; const JEV_EXPERIENCE_LABELS = {senior:"Senior"}; const CONTRACT_LABELS = {cdi:"CDI"}; const DESCRIPTION_PREVIEW_CHARS = 600; let descExpanded = {}; let descSections = []; const SECTION_ICONS = { "Le poste": "briefcase", "Missions": "list-checks", "Profil recherché": "person" }; function escapeHtml(x){return x;} const location={origin:"https://claimyourjob.com",href:"https://claimyourjob.com/fr/job-board.html",pathname:"/fr/job-board.html"}; ${funcs}`, context);

function label(row){context.row = row;return vm.runInContext('specialtyLabel(row)', context);}
assert.equal(label({specialty:'actuariat_iard',jev_specialty:'ia_data',jev_curation_status:'done',jev_publishable:{specialty:true}}), 'IA / Data');
for (const row of [
 {jev_specialty:'autre',jev_curation_status:'done',jev_publishable:{specialty:true}},
 {jev_specialty:'actuariat',jev_curation_status:'done',jev_publishable:{specialty:false}},
 {specialty:'actuariat_vie'},
 {jev_specialty:'actuariat',jev_curation_status:'pending',jev_publishable:{specialty:true}}
]) assert.equal(label(row), '');
assert.ok(!html.includes('id="category-filter"'));
assert.ok(!html.includes("j.contract_type || 'cdi'"));
assert.ok(!html.includes('const domainTags = extractDomainTags(j)'));
assert.ok(!html.includes('specialty_tags'), 'les tags errones ne doivent plus etre affiches');
const skillsBlock = html.match(/function skillsHtml\(j\)[\s\S]*?\n\}/)[0];
assert.ok(skillsBlock.includes("Repérés dans le texte de l'offre"), 'le bloc doit rester prudent');
assert.ok(html.includes('Non précisé'));
// Le filtre est desormais une liste a cases : on lit le bloc .msel et ses
// valeurs de case, pas un <select> qui n'existe plus.
// Le filtre est un groupe de pastilles : on lit le bloc et ses valeurs.
const filter = html.match(/<section class="fp-groupe" data-filtre="specialty-filter"[\s\S]*?<\/section>/)[0];
for (const name of ['actuariat','ia_data','souscription_technique']) assert.ok(filter.includes(`data-valeur="${name}"`));
assert.ok(!filter.includes('actuariat_iard'));
console.log('Cards Jev regression tests passed');

// Le libellé de lieu vient de l'API (champ ville) : la carte ne doit plus
// concaténer la région, qui n'est jamais renseignée en base.
assert.ok(!html.includes('j.region'), 'la region ne doit plus etre affichee');
// La carte ne colle pas la ville au nom de l entreprise. L assertion porte sur
// le rendu de la carte et non sur tout le fichier (T04 : la fiche n ecrit plus
// « Societe · Ville » non plus, la ville n y figure que dans la pastille).
const carte = html.match(/const el = document\.createElement\('div'\);[\s\S]*?feedEl\.appendChild\(el\);/)[0];
assert.ok(!carte.includes('escapeHtml(j.ville)'), 'la carte ne doit pas coller la ville au nom');
assert.ok(!html.includes('${j.city'), 'la carte ne doit plus utiliser city brut');
console.log('Ville display tests passed');

// Typography aligned across page; resting cards have visible border and shadow.
// T05 : l'étiquette .kl passe de 10 à 11 px (plancher de lisibilité du site).
assert.ok(html.includes('.kl { font-size: 11px;'));
// Les couleurs viennent des jetons du theme : la carte et la colonne
// doivent rester sur les memes roles de couleur (bordure de carte, fond de
// colonne), quel que soit le theme actif.
assert.ok(html.includes('border: 1.5px solid var(--bord-carte); box-shadow:'));
assert.ok(html.includes('background: var(--surface-liste); border-right:'));
assert.ok(html.includes('.ctitle { font-size: .875rem;'));
console.log('Typography and card contrast tests passed');

context.row = {contract_type:'cdi',jev_experience:'senior',jev_curation_status:'done',jev_publishable:{experience:true},salary_min:50000};
const metadata = vm.runInContext('cardMetadataHtml(row)', context);
assert.ok(metadata.includes('Contrat') && metadata.includes('CDI'));
assert.ok(metadata.includes('Expérience') && metadata.includes('Senior'));
assert.ok(!metadata.includes('description</span>') && !metadata.includes('trending_up'));
assert.ok(!metadata.includes('50000') && !metadata.includes('Salaire'));
context.row.jev_publishable.experience = false;
assert.ok(!vm.runInContext('cardMetadataHtml(row)', context).includes('Expérience'));
assert.equal(vm.runInContext('cardSalaryHtml(row)', context), '');
console.log('Contract/experience extensible metadata tests passed');

// Compact independent pills: no visible labels, no full-width band.
assert.ok(!metadata.includes('card-fact-label'));
assert.ok(metadata.includes('title="Contrat : CDI"'));
assert.ok(metadata.includes('aria-label="Expérience : Senior"'));
assert.ok(html.includes('padding: 2px 8px;'));
assert.ok(html.includes('line-height: 16px;'));
// Le sélecteur « .card-fact + .card-fact » ne sert qu'au trait (T10) : jamais d'espace ajouté entre voisins.
assert.equal((html.match(/\.card-fact \+ \.card-fact/g) || []).length, 1);
context.row = {contract_type:'cdi'};
const single = vm.runInContext('cardMetadataHtml(row)', context);
assert.equal((single.match(/class="card-fact"/g) || []).length, 1);
console.log('Compact pills tests passed');

// Salaire : affiché uniquement si l'API le déclare publiable.
context.row = {jev_salaire_libelle:'45–55 k€/an', jev_publishable:{salaire:true}};
assert.equal(vm.runInContext('salaryLabel(row)', context), '45–55 k€/an');
assert.ok(vm.runInContext('cardSalaryHtml(row)', context).includes('45–55 k€/an'));
// Sous le seuil, contradiction, ou montant absent : aucune pastille.
for (const row of [
  {jev_salaire_libelle:'≥ 46 k€/an', jev_publishable:{salaire:false}},
  {jev_salaire_libelle:'45–55 k€/an', jev_publishable:{}},
  {jev_salaire_libelle:null, jev_publishable:{salaire:true}},
  {jev_publishable:{salaire:true}}
]) {
  context.row = row;
  assert.equal(vm.runInContext('salaryLabel(row)', context), '');
  assert.equal(vm.runInContext('cardSalaryHtml(row)', context), '');
}
context.row = {contract_type:'cdi', jev_salaire_libelle:'45–55 k€/an', jev_publishable:{salaire:true}};
const avecSalaire = vm.runInContext('cardMetadataHtml(row)', context);
assert.ok(avecSalaire.includes('45–55 k€/an') && avecSalaire.includes('CDI'));
assert.ok(avecSalaire.indexOf('CDI') < avecSalaire.indexOf('45–55 k€/an'), 'le salaire vient apres le contrat');
console.log('Salary pill tests passed');

// Localisation dans le bandeau, en tete, avec une icone.
context.row = {contract_type:'cdi', ville:'Nanterre', jev_publishable:{}};
const bandeau = vm.runInContext('cardMetadataHtml(row)', context);
const posVille = bandeau.indexOf('Nanterre');
const posContrat = bandeau.indexOf('CDI');
assert.ok(posVille >= 0 && posVille < posContrat, 'la localisation doit preceder le contrat');
// L'icone est desormais un SVG Lucide (MapPin), plus une ligature texte.
const MARQUEUR = 'M20 10c0 4.993';
assert.ok(bandeau.includes(MARQUEUR), 'la localisation doit porter une icone');
assert.ok(bandeau.includes('class="ic"'), 'et cette icone est un SVG, pas une police');
assert.ok(bandeau.includes('aria-label="Localisation : Nanterre"'));
// Sans ville, aucune pastille vide.
context.row = {contract_type:'cdi', ville:'', jev_publishable:{}};
const sansVille = vm.runInContext('cardMetadataHtml(row)', context);
assert.ok(!sansVille.includes(MARQUEUR), 'pas de pastille de localisation sans ville');
assert.ok(sansVille.includes('CDI'));
console.log('Location pill tests passed');

// T10 (cahier des charges du propriétaire) : ligne 1 sans pastille, une icône par
// élément ; ligne 2 en pastilles (spécialité cyan, compétences grises).
context.row = {ville:'Nanterre', jev_publishable:{}};
const loc = vm.runInContext('cardLocationHtml(row)', context);
assert.ok(!loc.includes('card-fact--loc'), 'le lieu ne porte plus de teinte propre');
assert.ok(loc.includes('class="card-fact"') && loc.includes('class="ic"') && loc.includes('aria-hidden="true"'), 'une icone decorative');
for (const [libelle, valeur, icone] of [['Contrat', 'CDI', 'briefcase'], ['Expérience', 'Senior', 'signal'], ['Salaire', '45 k€', 'euro']]) {
  const fait = vm.runInContext(`cardFactHtml('${libelle}','${valeur}','${icone}')`, context);
  assert.ok(fait.includes('class="ic"') && fait.includes(`aria-label="${libelle} : ${valeur}"`), libelle + ' : icone et nom accessible');
}
assert.ok(!vm.runInContext("cardFactHtml('Contrat','CDI')", context).includes('class="ic"'), 'sans icone demandee, pas de svg');
// Ligne 1 : ni fond, ni bordure ; le trait entre deux éléments est un pseudo-élément.
assert.ok(/\.card-fact \{[^}]*position: relative;[^}]*\}/.test(html) && !/\.card-fact \{[^}]*(background|border)[^}]*\}/.test(html),
  'la ligne 1 n\'a ni fond ni bordure');
assert.ok(html.includes('.card-fact + .card-fact::before { content: ""; position: absolute; left: -9px;'), 'le trait separateur : entre deux elements voisins d\'une meme ligne');
assert.ok(!html.includes('.card-fact::before { display: none; }') && !html.includes('max-width: 480px) {\n  .cm {'), 'le trait n\'est plus cache sur telephone');
assert.ok(html.includes('.cm-l { display: flex; flex-wrap: nowrap;') && html.includes('.ctags-l { display: flex; flex-wrap: nowrap;'), 'chaque ligne est un bloc qui ne passe jamais a la ligne d\'elle-meme');
// T05 : aucun texte lisible ne descend sous 11 px ; T10 : les anciennes étiquettes ne reviennent pas.
assert.ok(html.includes('.etq { display: block;') && html.includes('font-size: 12px; font-weight: 600; line-height: 16px;'));
assert.ok(html.includes('.etq--spec { background: var(--teal-clair); border-color: var(--teal-bord); color: var(--teal-texte); }') && html.includes('.etq--comp { background: var(--surface-2); border-color: var(--bord-carte);'));
assert.ok(!/\.tag\s*\{/.test(html) && !/\.tm\s*\{/.test(html) && !/\.tn\s*\{/.test(html) && !/\.ccomp\s*\{/.test(html),
  'les anciennes etiquettes (.tag, .tm, .tn, .ccomp) ne reviennent pas');

// Ligne 2 : la spécialité est une pastille cyan, les compétences des pastilles grises.
// Règle des lignes (assets/cartes-lignes.js) : 4 par ligne au plus, 2 au moins ; « +N » ne cache jamais
// plus de 2 éléments, et seulement s'il fait gagner une ligne ; sinon tout s'affiche (3 lignes ou plus).
// Ici, le HTML produit avant mesure : le plafond de 4 ; la mesure (moins par ligne si un texte est coupé) est testée en navigateur.
const specialite = vm.runInContext("cardSpecialtyHtml('IA / Data')", context);
assert.ok(specialite.includes('etq etq--spec') && specialite.includes('>IA / Data</span>'));
assert.ok(specialite.includes('aria-label="Spécialité : IA / Data"'));
assert.equal(vm.runInContext("cardSpecialtyHtml('')", context), '');
vm.runInContext("const SKILLS_FAMILIES = {outils: 'Outils', data: 'Données et BI', reglementation: 'Réglementation'}", context);
// Lignes d'un bloc d'étiquettes : le nombre d'éléments de chacune.
const lignes = (h) => h.split('<div class="ctags-l">').slice(1).map((l) => (l.match(/<span class="etq/g) || []).length);
const etiquettes = (sp, skills) => { context.row = { skills }; context.sp = sp; return vm.runInContext('cardTagsHtml(sp, row)', context); };

// Spécialité + 5 compétences = 6 éléments : 3 + 3, aucun « +N ».
let h = etiquettes('IA / Data', {outils: ['Python', 'SQL', 'Excel', 'VBA'], reglementation: ['IFRS 17']});
assert.deepEqual(lignes(h), [3, 3], 'six éléments : 3 + 3 : ' + h);
assert.ok(!h.includes('etq--plus') && h.includes('>VBA</span>') && h.includes('>IFRS 17</span>'), 'tout est affiché');
// 7 → 4 + 3 ; 8 → 4 + 4 : tous affichés.
assert.deepEqual(lignes(etiquettes('IA / Data', {outils: 'ABCDEF'.split('')})), [4, 3]);
h = etiquettes('IA / Data', {outils: 'ABCDEFG'.split('')});
assert.deepEqual(lignes(h), [4, 4], 'huit éléments : 4 + 4');
assert.ok(!h.includes('etq--plus') && h.includes('>G</span>'), 'huit éléments : pas de +N');
// Neuf éléments : 7 affichés + « +2 » (2 lignes au lieu de 3).
h = etiquettes('IA / Data', {outils: 'ABCDEFGH'.split('')});
assert.deepEqual(lignes(h), [4, 4], 'neuf éléments : 7 + « +2 » : 4 + 4');
assert.ok(h.includes('>+2</span>') && h.includes('title="Autres compétences : G, H"'), 'le reste est compté et listé : ' + h);
assert.ok(h.includes('>F</span>') && !h.includes('>G</span>'), 'les 7 premiers sont affichés, pas les suivants');
// Dix éléments : tous affichés, 3 lignes (4 + 3 + 3) ; un « +N » ne ferait pas gagner de ligne.
h = etiquettes('IA / Data', {outils: 'ABCDEFGHI'.split('')});
assert.deepEqual(lignes(h), [4, 3, 3], 'dix éléments : tous affichés');
assert.ok(!h.includes('etq--plus'));
for (let n = 1; n <= 30; n++) {
  const m = etiquettes('', {outils: Array.from({length: n}, (_, i) => 'C' + i)}).match(/>\+(\d+)<\/span>/);
  assert.ok(!m || +m[1] <= 2, n + ' compétences : « +' + (m && m[1]) + ' » dépasse +2');
}
// Sans spécialité : 8 compétences tiennent, 9 donnent « +2 ».
assert.ok(!etiquettes('', {outils: 'ABCDEFGH'.split('')}).includes('etq--plus'));
assert.ok(etiquettes('', {outils: 'ABCDEFGHI'.split('')}).includes('>+2</span>'));
// Petits nombres : 1 → 1 ; 2 → 2 ; 3 → 3 ; 4 → 4 ; 5 → 3 + 2 (jamais une ligne d'un seul élément à partir de 2).
for (const [n, attendu] of [[1, [1]], [2, [2]], [3, [3]], [4, [4]], [5, [3, 2]]]) {
  const comps = ['A', 'B', 'C', 'D', 'E'].slice(0, n - 1);
  assert.deepEqual(lignes(etiquettes('IA / Data', {outils: comps})), attendu, n + ' éléments');
}
assert.ok(!etiquettes('IA / Data', {outils: ['Python']}).includes('+'), 'deux éléments : pas de +N');
// Rien à afficher : pas de bloc vide.
assert.equal(etiquettes('', {}), '');
// Une compétence longue porte son titre en entier (le texte peut être coupé par « … »).
assert.ok(etiquettes('', {outils: ['Solvabilité II']}).includes('title="Solvabilité II"'));

// Ligne 1 : 1 → 1, 2 → 2, 3 → 3, 4 → 4 (la mesure en navigateur la repasse à 2 + 2 si 4 coupent un texte).
const faits = (row) => { context.row = row; const m = vm.runInContext('cardMetadataHtml(row)', context);
  return m.split('<div class="cm-l">').slice(1).map((l) => (l.match(/class="card-fact"/g) || []).length); };
const SAL = { jev_salaire_libelle: '45 k€', jev_publishable: { salaire: true, experience: true }, jev_curation_status: 'done', jev_experience: 'senior' };
assert.deepEqual(faits({ contract_type: 'cdi' }), [1]);
assert.deepEqual(faits({ contract_type: 'cdi', ville: 'Paris' }), [2]);
assert.deepEqual(faits({ contract_type: 'cdi', ville: 'Paris', ...SAL, jev_salaire_libelle: '' }), [3]);
assert.deepEqual(faits({ contract_type: 'cdi', ville: 'Paris', ...SAL }), [4], 'quatre faits : une ligne de 4');
console.log('Card line 1 and line 2 tests passed');

// Description : aperçu dépliable, paragraphes conservés. Le texte long ne doit
// plus être coupé définitivement à 600 caractères.
context.long = Array.from({length: 12}, (_, i) => 'Paragraphe ' + (i + 1) + ' ' + 'x'.repeat(180)).join('\n');
context.blocks = vm.runInContext('descriptionBlocks(long)', context);
assert.ok(context.blocks.length >= 10, 'les paragraphes doivent etre conserves');
context.apercu = vm.runInContext('descriptionHtml(blocks, false)', context);
assert.ok(context.apercu.includes('Lire la suite'), 'un apercu tronque doit proposer la suite');
assert.ok(context.apercu.length < context.long.length / 2, 'l apercu doit rester court');
assert.ok(!context.apercu.includes('Paragraphe 12'), 'les derniers paragraphes restent masques');
context.complet = vm.runInContext('descriptionHtml(blocks, true)', context);
assert.ok(context.complet.includes('Paragraphe 12'), 'le texte complet doit etre atteignable');
assert.ok(context.complet.includes('R\u00e9duire'));
assert.ok(context.complet.length > context.apercu.length * 2, 'le depliage doit rendre bien plus de texte');
// Une description courte s'affiche entièrement, sans bouton.
context.blocks = vm.runInContext("descriptionBlocks('Une seule phrase courte.')", context);
context.court = vm.runInContext('descriptionHtml(blocks, false)', context);
assert.ok(!context.court.includes('Lire la suite'), 'pas de bouton quand tout est visible');
// Les balises de bloc deviennent des paragraphes.
context.blocks = vm.runInContext("descriptionBlocks('<p>Premier</p><p>Second</p>')", context);
assert.equal(context.blocks.length, 2);
// Le résumé généré ne remplace plus la description.
assert.ok(!html.includes('cleanDescription.slice(0, 600)'), 'la troncature a 600 caracteres doit disparaitre');
console.log('Description preview tests passed');

// Décodage pur, vérifiable sans navigateur.
context.brut = "&lt;p&gt;Salaire &amp;amp; primes&lt;/p&gt;";
assert.equal(vm.runInContext('decodeBasicEntities(brut)', context), '<p>Salaire &amp; primes</p>');
context.brut = 'Ligne1<br/>Ligne2&nbsp;suite';
context.blocks = vm.runInContext('descriptionBlocks(brut)', context);
// Array.from replacer dans le domaine hote : un tableau cree dans le contexte
// vm n a pas le meme prototype, et le comparateur strict le refuse.
assert.deepEqual(Array.from(context.blocks), ['Ligne1', 'Ligne2 suite']);
console.log('Entity decoding tests passed');

// Sections : ordre respecté, chacune dépliable, icône propre.
// Les variables déclarées par « let » dans le contexte masquent les propriétés
// qu'on y déposerait : on les assigne depuis l'intérieur du contexte.
vm.runInContext(`descSections = [
  {titre:'Le poste', paragraphes:['Un rôle.']},
  {titre:'Missions', paragraphes:Array.from({length:10},(_,i)=>'Mission '+(i+1)+' '+'x'.repeat(150))},
  {titre:'Profil recherché', paragraphes:['Un Master 2.']},
]; descExpanded = {};`, context);
const htmlSections = vm.runInContext('descriptionSectionsHtml()', context);
assert.ok(htmlSections.indexOf('Le poste') < htmlSections.indexOf('Missions'), 'ordre: poste avant missions');
assert.ok(htmlSections.indexOf('Missions') < htmlSections.indexOf('Profil recherché'), 'ordre: missions avant profil');
// Chaque section porte son icone : trois SVG distincts, pas une ligature.
assert.equal((htmlSections.match(/class="ic/g) || []).length, 3, 'une icone par section');
assert.ok(htmlSections.includes('width="20" height="14"'), 'le briefcase du poste');
assert.ok(htmlSections.includes('m3 17 2 2 4-4'), 'la liste cochee des missions');
assert.ok(htmlSections.includes('cy=\"8\" r=\"4\"'), 'la personne du profil');
assert.ok(htmlSections.includes('desc-body-0') && htmlSections.includes('desc-body-2'));
assert.ok(!htmlSections.includes('Aperçu du poste'), 'le titre generique disparait quand les sections existent');
// Le bouton cible bien la section concerne.
vm.runInContext("descSections = [{titre:'Missions', paragraphes:Array.from({length:8},(_,i)=>'M'+i+' '+'y'.repeat(160))}]; descExpanded = {};", context);
const une = vm.runInContext('descriptionSectionsHtml()', context);
assert.ok(une.includes('onclick="toggleDescription(0)"'), 'le depliage doit viser la section');
assert.ok(!html.includes('toggleDescription()'), 'plus de depliage sans index');
console.log('Description sections tests passed');


// Adresse et partage d'une offre : ouvrir un poste ne changeait pas l'adresse,
// et le bouton Partager copiait l'adresse du board, qui ne désigne aucune offre.
context.row = {slug:'actuaire-senior-h-f-42cf9f9e7942'};
assert.equal(
  vm.runInContext('urlOffre(row.slug)', context),
  'https://claimyourjob.com/fr/offre/actuaire-senior-h-f-42cf9f9e7942'
);
// Les slugs accentués doivent être encodés, sinon l'adresse ne résout pas.
context.row = {slug:'chargé-d-études-actuarielles-h-f-1234'};
const enc = vm.runInContext('urlOffre(row.slug)', context);
assert.ok(enc.includes('%C3%A9'), 'les accents doivent être encodés');
assert.ok(!enc.includes('chargé'), 'aucun caractère accentué brut');

// Le partage ne doit plus dépendre de l'adresse courante.
assert.ok(!html.includes('navigator.clipboard?.writeText(window.location.href)'),
  'le bouton ne doit plus copier window.location.href');
// Le partage vit dans l'en-tete de la fiche : l'en-tete le porte, et la
// feuille native reste tentee en premier.
assert.ok(html.includes('function partagerOffre('), 'la fonction de partage reste definie');
assert.ok(html.slice(html.indexOf("document.getElementById('detail').innerHTML")).includes('partagerOffre()'),
  'la fiche propose de nouveau le partage');
assert.ok(html.includes('id=\'toast-claim\'') || html.includes("'toast-claim'"),
  'un retour visuel est attendu apres la copie');
assert.ok(html.includes('navigator.share'), 'la feuille de partage native doit etre tentee');
assert.ok(html.includes('offreCourante = j;'), 'l offre affichee doit etre memorisee');
console.log('Offer link tests passed');


// Structure editoriale dans le board : la page d'offre la rendait, pas le
// detail du board. La mise a jour n'y apparaissait donc pas.
const boardHtml = require('node:fs').readFileSync(__dirname + '/../job-board.html', 'utf8');
assert.ok(boardHtml.includes('descHtmlSource'), 'le board doit suivre la structure d origine');
assert.ok(boardHtml.includes('desc-source'), 'un conteneur dedie est attendu');
assert.ok(
  boardHtml.indexOf('descHtmlSource') < boardHtml.indexOf('descriptionSectionsHtml()'),
  'la structure d origine passe avant la decoupe automatique'
);
// Le HTML n'est jamais evalue : il est insere tel quel, apres nettoyage a la
// collecte. Aucun eval, aucune fonction construite dynamiquement.
assert.ok(!boardHtml.includes('eval('), 'aucune evaluation de HTML');
assert.ok(!boardHtml.includes('new Function'), 'aucune fonction construite a la volee');
// Styles des listes et emphases.
assert.ok(boardHtml.includes('.desc-source ul'), 'les listes doivent etre stylisees');
assert.ok(boardHtml.includes('.desc-source strong'), 'les emphases doivent etre stylisees');
console.log('Board editorial structure tests passed');
