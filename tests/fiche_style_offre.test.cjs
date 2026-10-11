// La fiche du board converge vers le style de la page d'offre (/offre/{slug}) :
// fond de page, pastilles, défilement. Les valeurs sont recopiées du modèle,
// ce test les compare une à une pour qu'aucune ne dérive en silence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../claim-job-board.html'), 'utf8');
const modele = fs.readFileSync(path.join(__dirname, '../api/offre.js'), 'utf8');

// ── Les pastilles existent des deux côtés, avec les mêmes valeurs ──
const valeur = (source, selecteur, propriete) => {
  const bloc = source.match(new RegExp(selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}'));
  assert.ok(bloc, `${selecteur} doit exister`);
  const m = bloc[0].match(new RegExp(propriete + ':\\s*([^;]+)'));
  assert.ok(m, `${propriete} doit être défini dans ${selecteur}`);
  return m[1].trim();
};

// On compare exactement ce que le modèle déclare : les variantes n'ont que
// leurs trois couleurs, le reste vient de .pastille.
const proprietes = (source, selecteur) => {
  const bloc = source.match(new RegExp(selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}'));
  assert.ok(bloc, `${selecteur} doit exister`);
  return [...bloc[0].matchAll(/([a-z-]+):\s*([^;]+)/g)].map(m => m[1]).filter(p => p !== 'border');
};

for (const selecteur of ['.pastille', '.pastille-ville', '.pastille-salaire', '.pastille-specialite']) {
  const attendues = proprietes(modele, selecteur);
  assert.ok(attendues.length >= 3, `${selecteur} doit déclarer au moins ses couleurs`);
  for (const propriete of attendues) {
    assert.equal(
      valeur(html, selecteur, propriete),
      valeur(modele, selecteur, propriete),
      `${selecteur} → ${propriete} doit être identique à la page d'offre`
    );
  }
}

// Une pastille est une pilule, pas un rectangle arrondi.
assert.equal(valeur(html, '.pastille', 'border-radius'), '9999px');

// ── Fond : la fiche est une page, pas une carte grise ──
const pr = html.match(/\.pr \{[^}]*\}/)[0];
assert.ok(pr.includes('background: #fff'), 'la fiche repose sur fond blanc');
assert.ok(!pr.includes('#f3f4f5'), 'le fond gris de carte est abandonné');

// L'enveloppe reprend celle du modèle : 46rem centrées.
const dc = html.match(/\.dc \{[^}]*\}/)[0];
assert.ok(dc.includes('max-width: 46rem'), "l'enveloppe tient la largeur de lecture du modèle");
assert.ok(!dc.includes('border-radius'), "il n'y a plus de carte arrondie");
assert.ok(!dc.includes('box-shadow'), "il n'y a plus d'ombre de carte");

// ── Défilement : le titre défile avec la page ──
const sticky = html.match(/\.d-sticky \{[^}]*\}/)[0];
assert.ok(!sticky.includes('position: sticky'), "l'en-tête ne colle plus : le sujet défile comme une page");

// ── L'en-tête suit l'ordre du modèle : titre, entreprise, pastilles ──
const corps = html.slice(html.indexOf("document.getElementById('detail').innerHTML"));
const ordre = ['dtitle', 'dco', 'pastilles', 'dact'].map(c => corps.indexOf('class="' + c));
assert.ok(ordre.every(i => i >= 0), 'les quatre blocs doivent être présents');
assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b), "l'ordre est titre, entreprise, pastilles, actions");

// ── L'encadré de proposition IA est conservé ──
assert.ok(html.includes('${jevProposalHtml(j)}'), "l'encadré de proposition IA reste affiché");
assert.ok(html.includes('function jevProposalHtml('), 'sa fonction reste en place');

console.log('Fiche alignee sur le style de la page d offre tests passed');
