const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../claim-job-board.html'), 'utf8');
const funcs = ['specialtyLabel', 'experienceLabel', 'cardExperienceHtml', 'skillLabels', 'skillChips', 'skillsHtml'].map(name => {
 const start = html.indexOf('function ' + name + '(');
 const end = html.indexOf('\n}', start) + 2;
 assert.ok(start >= 0 && end > start);
 return html.slice(start, end);
}).join('\n');
const context = vm.createContext({});
vm.runInContext(`const JEV_SPECIALTY_LABELS = {"actuariat": "Actuariat", "ia_data": "IA / Data", "souscription_technique": "Souscription technique", "autre": "Autre"}; const JEV_EXPERIENCE_LABELS = {senior:"Senior"}; function escapeHtml(x){return x;} ${funcs}`, context);

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

// Ordre des métadonnées : localisation puis contrat, sans icône sur le contrat.
const meta = html.match(/<div class="cm">[\s\S]*?<\/div>\n        \$\{cardExperienceHtml/)[0];
assert.ok(meta.indexOf('j.ville') < meta.indexOf('CONTRACT_LABELS'), 'la ville doit preceder le contrat');
assert.ok(!/description<\/span>/.test(meta), 'le contrat ne doit plus porter d icone');
console.log('Card metadata order tests passed');
