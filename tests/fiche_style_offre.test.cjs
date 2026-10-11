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

// ── Défilement : l'en-tête de la fiche se fige, et lui seul ──
// Le sujet et ses repères restent sous les yeux pendant la lecture. Le bloc
// s'arrête après les pastilles : le corps défile dessous.
const entete = bloc(html, '.d-entete');
assert.ok(entete.includes('position: sticky'), "l'en-tête de la fiche se fige au défilement");
assert.ok(entete.includes('top: 0'), 'il se cale en haut du volet');
assert.ok(entete.includes('background: #fff'),
  'un fond opaque est indispensable : le corps defile dessous');
assert.ok(entete.includes('margin: 0 -1.25rem'),
  'le fond doit couvrir les gouttieres, sinon le texte defilerait a cote');
// L ancien en-tete collant du board reste retire, lui.
assert.ok(!html.includes('d-sticky'), "l'ancien en-tête collant n'est pas revenu");

// Ce qui est figé : le titre, l'entreprise et les pastilles, rien de plus.
const fiche = html.slice(html.indexOf("document.getElementById('detail').innerHTML"));
const debutEntete = fiche.indexOf('<div class="d-entete">');
const finEntete = fiche.indexOf('${summary}');
assert.ok(debutEntete >= 0 && finEntete > debutEntete,
  "le bloc fige doit preceder le corps de l'annonce");
const zone = fiche.slice(debutEntete, finEntete);
for (const dans of ['dtitle', 'dco', 'pastilles', 'dact']) {
  assert.ok(zone.includes(dans), `${dans} doit etre dans la partie figee`);
}
assert.ok(!zone.includes('desc-source') && !zone.includes('pied'),
  'le corps et le pied ne doivent pas etre figes');

// ── La fiche suit l'ordre du modèle ──
const ordre = ['dtitle', 'dco', 'pastilles', 'pied'].map(c => fiche.indexOf('class="' + c));
assert.ok(ordre.every(i => i >= 0), 'les quatre blocs doivent être présents');
assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b),
  "l'ordre est titre, entreprise, pastilles, puis corps et pied");

// ── La page blanche reprend exactement la colonne de gauche en marge droite ──
// La fiche se recentre dans la fenêtre : autant de gris de part et d'autre.
assert.equal(valeur(html, '.pl', 'width'), 'var(--colonne-liste)',
  'la colonne de gauche tient sa largeur d une seule variable');
const racine = html.match(/:root \{ --colonne-liste: ([^;]+);/);
assert.ok(racine, 'la variable de largeur doit etre declaree');
assert.equal(racine[1].trim(), '420px', 'et valoir la largeur mesuree de la colonne');

// La marge droite n'est pas la colonne : c'est la marge blanche du texte.
// L'enveloppe se centrant dans la page, « bande = marge blanche » se resout
// en bande = (fenetre - colonne - enveloppe + 2 x padding) / 3.
const enveloppe = html.match(/:root \{[^}]*--enveloppe-lecture: ([^;]+);/);
assert.ok(enveloppe, "la largeur de l'enveloppe doit etre declaree");
assert.equal(enveloppe[1].trim(), '46rem', 'elle reprend celle de la page d offre');
assert.ok(dc.includes('max-width: 46rem'), "et l'enveloppe du board s'y conforme");

const bande = valeur(html, '.pr', 'margin-right');
assert.ok(bande.startsWith('max(0px,'), 'la bande ne descend jamais sous zero');
assert.ok(bande.includes('var(--colonne-liste)') && bande.includes('var(--enveloppe-lecture)'),
  'elle se deduit de la colonne et de l enveloppe');
assert.ok(/\)\s*\/\s*3\)/.test(bande),
  'et vaut le tiers de ce qui reste : c est la marge du texte, des deux cotes');
assert.ok(bande.includes('2.5rem'), 'les deux paddings de l enveloppe sont comptes');
assert.ok(!bande.includes('clamp('), 'la bande ne copie plus la colonne de gauche');

// ── Les deux gestes de la fiche ──
for (const geste of ['class="dact"', 'class="bap"', 'class="bsh', 'Postuler', 'partagerOffre()']) {
  assert.ok(fiche.includes(geste), `la fiche doit porter « ${geste} »`);
}
// Le geste abandonné, lui, ne revient pas.
for (const retire of ['Postuler maintenant', "Lien de l'offre", '${jevProposalHtml(j)}']) {
  assert.ok(!fiche.includes(retire), `la fiche ne doit plus contenir « ${retire} »`);
}
// ...et les fonctions restent dans le code.
for (const conserve of ['function jevProposalHtml(', 'function partagerOffre(']) {
  assert.ok(html.includes(conserve), `${conserve} doit rester défini`);
}

// ── Le pied reprend celui du modèle ──
for (const propriete of ['margin-top', 'padding-top', 'font-size', 'color']) {
  assert.equal(valeur(html, '.pied', propriete), valeur(modele, '.pied', propriete),
    `.pied → ${propriete} doit être identique au modèle`);
}

console.log("Fiche alignee sur le style de la page d'offre tests passed");
