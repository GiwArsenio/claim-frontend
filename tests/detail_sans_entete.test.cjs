// Fiche de poste plein écran sur mobile : l'en-tête du site (logo Claim!
// et menu burger) ne doit plus occuper le haut de l'écran quand une offre
// est ouverte. Le retour reste porté par le bouton de la fiche.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');

// Le bloc mobile : entre son ouverture et la media query suivante.
const debut = html.indexOf('@media (max-width: 768px) {');
const fin = html.indexOf('@media (min-width: 769px) {');
assert.ok(debut >= 0 && fin > debut, 'les deux media queries doivent exister');
const mobile = html.slice(debut, fin);

// Hauteur nulle, et surtout PAS display:none : #app est une grille dont
// les rangees se remplissent dans l ordre du DOM. Un element en display:none
// n occupe plus de rangee, #split glisse sur la rangee « auto » au lieu de
// « 1fr » et s effondre a zero — ecran blanc sur telephone. Regression vue
// en production avant correction, d ou ce verrou.
const regle = mobile.match(/body\.detail-view #hd \{[^}]*\}/);
assert.ok(regle, "sur mobile, la fiche ouverte doit masquer l'en-tete (#hd)");
assert.ok(
  regle[0].includes('height: 0'),
  "l'en-tete doit etre mis a hauteur nulle"
);
assert.ok(
  !regle[0].includes('display: none'),
  "display:none retirerait #hd de la grille et effondrerait #split : ecran blanc"
);
// La grille est la cause : si elle change un jour, ce test doit le dire.
assert.ok(
  html.includes('grid-template-rows: auto auto 1fr'),
  "#app doit rester une grille de trois rangees : #hd, #hero, #split"
);

// La classe est posée sur <body> : l'en-tête est un frère de #split, une
// classe posée sur #split ne pourrait pas l'atteindre en CSS.
const open = html.match(/function openDetail\(\)[\s\S]*?\n\}/)[0];
const close = html.match(/function closeDetail\(\)[\s\S]*?\n\}/)[0];

assert.ok(
  open.includes("document.body.classList.add('detail-view')"),
  "openDetail doit poser l'etat sur body"
);
assert.ok(
  close.includes("document.body.classList.remove('detail-view')"),
  'closeDetail doit retirer cet etat'
);
assert.ok(
  open.includes('isMobile()'),
  'le masquage ne concerne que le mobile : le bureau garde sa liste et sa navigation'
);

// Le retour doit rester possible sans l'en-tête.
assert.ok(html.includes('class="btn-back"'), 'le bouton retour de la fiche doit rester present');

// Rien ne doit masquer le logo sur bureau : les liens de navigation y vivent.
const bureau = html.slice(fin);
assert.ok(
  !bureau.includes('body.detail-view'),
  'sur bureau, la liste et l en-tete restent visibles cote a cote'
);

console.log('Detail sans en-tete tests passed');
