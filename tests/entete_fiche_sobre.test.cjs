// En-tête de la fiche : sobre, pour laisser la place à la lecture de l'offre.
// Le repère est la page d'offre (/offre/{slug}), qui porte déjà ce traitement :
// titre, puis nom de l'entreprise seul, sans logo.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../claim-job-board.html'), 'utf8');

// Le logo d'entreprise ne doit plus être rendu dans l'en-tête de la fiche.
assert.ok(
  !html.includes("renderCompanyLogo(co, 'dlogo')"),
  "la fiche ne doit plus afficher le logo de l'entreprise"
);
// Il reste légitime sur la carte et dans le bloc entreprise.
assert.ok(html.includes("renderCompanyLogo(co, 'clogo')"), 'la carte garde son logo');
assert.ok(html.includes("renderCompanyLogo(co, 'cblogo')"), 'le bloc entreprise garde le sien');

// Le nom de l'entreprise suit le gris de la page d'offre, pour ne pas
// rivaliser avec le titre.
const dco = html.match(/\.dco \{[^}]*\}/)[0];
assert.ok(dco.includes('#515f78'), "le nom de l'entreprise reprend le gris de la page d'offre");
assert.ok(!dco.includes('#006876'), "le nom de l'entreprise n'est plus en teal");

// Les actions tiennent sur une ligne : empilées en colonne, elles faisaient
// à elles seules la hauteur de l'en-tête.
const dact = html.match(/\.dact \{[^}]*\}/)[0];
assert.ok(!dact.includes('column'), 'les actions ne sont plus empilées en colonne');
assert.ok(dact.includes('flex-wrap: wrap'), 'elles passent à la ligne si la place manque');
assert.ok(!dact.includes('min-width: 170px'), 'la largeur imposée est retirée');

// Le titre garde la priorité visuelle.
const dtitle = html.match(/\.dtitle \{[^}]*\}/)[0];
assert.ok(dtitle.includes('font-weight: 900'), 'le titre reste le point d entree du regard');

// Les trois actions restent accessibles : on ne simplifie pas en amputant.
for (const action of ['Postuler maintenant', 'Partager', "Lien de l'offre"]) {
  assert.ok(html.includes(action), `l'action « ${action} » doit rester proposée`);
}

console.log('En-tete de fiche sobre tests passed');
