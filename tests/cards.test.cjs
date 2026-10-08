const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../claim-job-board.html'), 'utf8');
const funcs = ['specialtyLabel', 'experienceLabel', 'cardExperienceHtml', 'cardFactHtml', 'cardSalaryHtml', 'cardMetadataHtml', 'salaryLabel', 'cardLocationHtml', 'skillLabels', 'skillChips', 'skillsHtml'].map(name => {
 const start = html.indexOf('function ' + name + '(');
 const end = html.indexOf('\n}', start) + 2;
 assert.ok(start >= 0 && end > start);
 return html.slice(start, end);
}).join('\n');
const context = vm.createContext({});
vm.runInContext(`const JEV_SPECIALTY_LABELS = {"actuariat": "Actuariat", "ia_data": "IA / Data", "souscription_technique": "Souscription technique", "autre": "Autre"}; const JEV_EXPERIENCE_LABELS = {senior:"Senior"}; const CONTRACT_LABELS = {cdi:"CDI"}; function escapeHtml(x){return x;} ${funcs}`, context);

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
const filter = html.match(/<select id="specialty-filter"[\s\S]*?<\/select>/)[0];
for (const name of ['actuariat','ia_data','souscription_technique']) assert.ok(filter.includes(`value="${name}"`));
assert.ok(!filter.includes('actuariat_iard'));
console.log('Cards Jev regression tests passed');

// Le libellé de lieu vient de l'API (champ ville) : la carte ne doit plus
// concaténer la région, qui n'est jamais renseignée en base.
assert.ok(!html.includes('j.region'), 'la region ne doit plus etre affichee');
assert.ok(!html.includes("' \u00b7 ' + escapeHtml(j.ville)"), 'la ville ne doit plus suivre le nom de l entreprise');
assert.ok(!html.includes('${j.city'), 'la carte ne doit plus utiliser city brut');
console.log('Ville display tests passed');

// Typography aligned across page; resting cards have visible border and shadow.
assert.ok(html.includes('.kl { font-size: 10px;'));
assert.ok(html.includes('border: 1.5px solid #d5dfe3; box-shadow:'));
assert.ok(html.includes('background: #e9eef1; border-right:'));
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
assert.ok(!html.includes('.card-fact + .card-fact'));
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
assert.ok(bandeau.includes('location_on'), 'la localisation doit porter une icone');
assert.ok(bandeau.includes('aria-label="Localisation : Nanterre"'));
// Sans ville, aucune pastille vide.
context.row = {contract_type:'cdi', ville:'', jev_publishable:{}};
const sansVille = vm.runInContext('cardMetadataHtml(row)', context);
assert.ok(!sansVille.includes('location_on'), 'pas de pastille de localisation sans ville');
assert.ok(sansVille.includes('CDI'));
console.log('Location pill tests passed');

// Couleur propre à la localisation, et badges de spécialité rehaussés.
context.row = {ville:'Nanterre', jev_publishable:{}};
const loc = vm.runInContext('cardLocationHtml(row)', context);
assert.ok(loc.includes('card-fact--loc'), 'la localisation doit porter sa propre classe');
assert.ok(!vm.runInContext("cardFactHtml('Contrat','CDI')", context).includes('card-fact--loc'));
assert.ok(html.includes('.card-fact--loc { background: #e9f6f8; border-color: #bfe2e8; }'));
assert.ok(html.includes('.card-fact--loc .ms { color: #006876; }'));
assert.ok(html.includes('.jc .ctags .tag { font-size: 9px; padding: 3px 6px; }'));
console.log('Location colour and badge height tests passed');
