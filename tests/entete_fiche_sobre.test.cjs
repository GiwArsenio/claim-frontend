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
// Il reste légitime sur la carte, qui doit rester identifiable dans la liste.
assert.ok(html.includes("renderCompanyLogo(co, 'clogo')"), 'la carte garde son logo');

// Le nom de l'entreprise suit le gris de la page d'offre, pour ne pas
// rivaliser avec le titre.
const dco = html.match(/\.dco \{[^}]*\}/)[0];
assert.ok(dco.includes('#515f78'), "le nom de l'entreprise reprend le gris de la page d'offre");
assert.ok(!dco.includes('#006876'), "le nom de l'entreprise n'est plus en teal");

// Le titre tient son rôle par sa taille : c'est le h1 du modèle, au gras
// par défaut (700), et non plus un 900 propre au board.
const dtitle = html.match(/\.dtitle \{[^}]*\}/)[0];
assert.ok(dtitle.includes('font-size: 1.6rem'), 'le titre reprend la taille du h1 de la page d offre');
assert.ok(!dtitle.includes('font-weight: 900'), 'le board ne force plus son propre gras');

// La fiche ne porte plus d action propre : elle suit la page d offre, qui
// n en a aucune. Le retour et le lien de source restent ses seuls gestes.
const fiche = html.slice(html.indexOf("document.getElementById('detail').innerHTML"));
for (const action of ['Postuler maintenant', 'Partager', "Lien de l'offre"]) {
  assert.ok(!fiche.includes(action), `la fiche ne doit plus proposer « ${action} »`);
}

console.log('En-tete de fiche sobre tests passed');
