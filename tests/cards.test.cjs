const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../claim-job-board.html'), 'utf8');
const funcs = ['specialtyLabel', 'experienceLabel', 'cardExperienceHtml', 'cardFactHtml', 'cardSalaryHtml', 'cardMetadataHtml', 'skillLabels', 'skillChips', 'skillsHtml'].map(name => {
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
assert.ok(html.includes("j.ville ? ' \u00b7 ' + escapeHtml(j.ville)"), 'la carte doit afficher la ville');
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
