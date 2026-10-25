// Changer d'offre ne doit pas ramener la fiche en haut.
//
// La fiche se lit en enchaînant les cartes : on garde l'en-tête collé et le
// même niveau de lecture. Sans cela, chaque sélection renvoie au début de
// l'offre et la comparaison devient impossible.
//
// Deux causes se cumulaient : un scrollTop remis à zéro dans le gestionnaire
// de clic, et l'écran « Chargement du détail… » qui vide la fiche pendant la
// requête — un contenu court ramène le défilement à zéro de lui-même.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');

const trouve = html.match(/el\.onclick = async \(\) => \{[\s\S]*?\n    \};/);
assert.ok(trouve, 'le gestionnaire de clic sur une carte doit exister');
const bloc = trouve[0];

assert.ok(
  !bloc.includes('prEl.scrollTop = 0'),
  "le clic ne doit plus ramener la fiche en haut"
);
assert.ok(
  bloc.includes('const lectureFiche = prEl.scrollTop;'),
  'la position de lecture est relevée avant le rendu'
);
assert.ok(
  bloc.includes('prEl.scrollTop = lectureFiche'),
  'et restaurée après, une fois le contenu définitif en place'
);
assert.ok(
  bloc.includes('const lectureListe = plEl.scrollTop;') && bloc.includes('plEl.scrollTop = lectureListe'),
  'la liste garde aussi sa position : on clique une carte voisine'
);

// La restauration vient après renderDetail : c'est lui qui installe l'écran
// de chargement, et restaurer avant ne servirait à rien.
const posRendu = bloc.indexOf('await renderDetail(j.id);');
const posRestauration = bloc.indexOf('prEl.scrollTop = lectureFiche');
assert.ok(
  posRendu >= 0 && posRestauration > posRendu,
  'la restauration doit suivre le rendu, pas le précéder'
);

// Ouvrir la fiche depuis la liste sur téléphone repart du haut : c'est un
// autre geste, le volet vient d'apparaître.
const openDetail = html.match(/function openDetail\(\) \{[\s\S]*?\n\}/)[0];
assert.ok(
  openDetail.includes('prEl.scrollTop = 0'),
  "l'ouverture mobile repart bien du haut de la fiche"
);

console.log('Defilement de la fiche conserve tests passed');
