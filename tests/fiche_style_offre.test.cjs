// La fiche du board converge vers la page d'offre (/offre/{slug}) : fond,
// pastilles, défilement, échelle de titres, marges. Les valeurs sont
// comparées une à une à api/offre.js pour qu'aucune ne dérive en silence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../claim-job-board.html'), 'utf8');
const modele = fs.readFileSync(path.join(__dirname, '../api/offre.js'), 'utf8');

// Le modèle nomme ses couleurs par variable (--gris, --teal, --encre). On les
// résout avant de comparer : sinon la comparaison porterait sur l'écriture et
// non sur la couleur rendue.
const VARIABLES = { '--teal': '#006876', '--encre': '#191c1d', '--gris': '#515f78' };
const resoudre = v => v.replace(/var\((--[a-z]+)\)/g, (_, nom) => VARIABLES[nom] || nom);

function bloc(source, selecteur) {
  const motif = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}';
  const trouve = source.match(new RegExp(motif));
  assert.ok(trouve, `${selecteur} doit exister`);
  return trouve[0];
}

function valeur(source, selecteur, propriete) {
  const m = bloc(source, selecteur).match(new RegExp(propriete + ':\\s*([^;]+)'));
  assert.ok(m, `${propriete} doit être défini dans ${selecteur}`);
  return resoudre(m[1].trim());
}

function proprietes(source, selecteur) {
  return [...bloc(source, selecteur).matchAll(/([a-z-]+):\s*([^;]+)/g)]
    .map(m => m[1]).filter(p => p !== 'border');
}

// ── Pastilles : mêmes valeurs des deux côtés ──
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
assert.equal(valeur(html, '.pastille', 'border-radius'), '9999px', 'une pastille est une pilule');

// ── Échelle de titres et espacements ──
assert.equal(valeur(html, '.dtitle', 'font-size'), valeur(modele, 'h1', 'font-size'),
  'le titre reprend la taille du h1 de la page d offre');
assert.equal(valeur(html, '.dtitle', 'margin'), valeur(modele, 'h1', 'margin'),
  'la marge du titre est celle du h1');
assert.equal(valeur(html, '.dco', 'font-size'), valeur(modele, '.societe', 'font-size'),
  'le nom de l entreprise reprend la taille du modele');
assert.equal(valeur(html, '.dco', 'margin-bottom'), valeur(modele, '.societe', 'margin-bottom'),
  'son espacement aussi');
assert.equal(valeur(html, '.pastilles', 'margin-bottom'), valeur(modele, '.pastilles', 'margin-bottom'),
  'les pastilles gardent le meme espacement bas');

// Le corps suit la page d'offre : mêmes marges de paragraphes et de listes.
assert.equal(valeur(html, '.ds p, .desc-source p, .mi', 'margin'), valeur(modele, 'p', 'margin'),
  'les paragraphes ont la marge du modele');
assert.equal(valeur(html, '.ds p, .desc-source p, .mi', 'color'), valeur(modele, 'p', 'color'),
  'et la couleur de texte du modele');
assert.equal(valeur(html, '.desc-source ul, .desc-source ol, .pb ul', 'padding-left'),
  valeur(modele, 'ul, ol', 'padding-left'), 'les listes ont le retrait du modele');

// ── Fond : la fiche est une page, pas une carte grise ──
const pr = bloc(html, '.pr ');
assert.ok(pr.includes('background: #fff'), 'la fiche repose sur fond blanc');
assert.ok(!pr.includes('#f3f4f5'), 'le fond gris de carte est abandonné');
assert.ok(pr.includes('system-ui'), 'la fiche prend la police de la page d offre');
assert.ok(pr.includes('line-height: 1.65'), 'et son interligne');

const dc = bloc(html, '.dc');
assert.ok(dc.includes('max-width: 46rem'), "l'enveloppe tient la largeur de lecture du modèle");
assert.ok(dc.includes('padding: 1.5rem 1.25rem 4rem'), 'et ses marges');

// ── Défilement : rien ne colle ──
assert.ok(!html.includes('position: sticky'), 'aucun élément de la fiche ne colle au défilement');
assert.ok(!html.includes('d-sticky'), "l'en-tête collant est retiré, pas seulement désactivé");

// ── La fiche suit l'ordre du modèle ──
const fiche = html.slice(html.indexOf("document.getElementById('detail').innerHTML"));
const ordre = ['dtitle', 'dco', 'pastilles', 'pied'].map(c => fiche.indexOf('class="' + c));
assert.ok(ordre.every(i => i >= 0), 'les quatre blocs doivent être présents');
assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b),
  "l'ordre est titre, entreprise, pastilles, puis corps et pied");

// ── Aucun geste qui n'existe pas sur la page d'offre ──
for (const retire of ['class="dact"', 'class="bap"', 'class="bsh', 'Postuler maintenant',
                      'Partager', "Lien de l'offre", '${jevProposalHtml(j)}']) {
  assert.ok(!fiche.includes(retire), `la fiche ne doit plus contenir « ${retire} »`);
}
// ...mais les fonctions restent dans le code, prêtes à être réactivées.
for (const conserve of ['function jevProposalHtml(', 'function partagerOffre(']) {
  assert.ok(html.includes(conserve), `${conserve} doit rester défini`);
}

// ── Le pied reprend celui du modèle ──
for (const propriete of ['margin-top', 'padding-top', 'font-size', 'color']) {
  assert.equal(valeur(html, '.pied', propriete), valeur(modele, '.pied', propriete),
    `.pied → ${propriete} doit être identique au modèle`);
}

console.log("Fiche alignee sur le style de la page d'offre tests passed");
