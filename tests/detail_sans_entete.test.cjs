// Fiche de poste plein écran sur mobile : l'en-tête du site (logo Claim!
// et menu burger) ne doit plus occuper le haut de l'écran quand une offre
// est ouverte. Le retour reste porté par le bouton de la fiche.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../claim-job-board.html'), 'utf8');

// Le bloc mobile : entre son ouverture et la media query suivante.
const debut = html.indexOf('@media (max-width: 768px) {');
const fin = html.indexOf('@media (min-width: 769px) {');
assert.ok(debut >= 0 && fin > debut, 'les deux media queries doivent exister');
const mobile = html.slice(debut, fin);

assert.ok(
  mobile.includes('body.detail-view #hd { display: none; }'),
  "sur mobile, la fiche ouverte doit masquer l'en-tete (#hd)"
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
