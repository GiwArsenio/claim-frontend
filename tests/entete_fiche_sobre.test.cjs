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

// Deux gestes, et deux seulement : postuler à l'annonce d'origine, et
// partager l'offre. Ils vivent dans l'en-tête, donc dans le bloc figé.
const fiche = html.slice(html.indexOf("document.getElementById('detail').innerHTML"));
assert.ok(fiche.includes('class="bap"'), 'la fiche propose de postuler');
assert.ok(fiche.includes('Postuler</a>'), 'le bouton porte son libellé');
assert.ok(/class="bap"[^`]*j\.source_url/.test(fiche),
  "postuler mène à l'annonce d'origine, pas à une adresse inventée");
assert.ok(fiche.includes('j.source_url ?'),
  "sans adresse de source, le bouton ne s'affiche pas");
assert.ok(fiche.includes('class="bsh"') && fiche.includes('partagerOffre()'),
  'le partage reste accessible depuis la fiche');
// L'ancien habillage, lui, ne revient pas.
for (const retire of ['Postuler maintenant', "Lien de l'offre"]) {
  assert.ok(!fiche.includes(retire), `la fiche ne doit plus proposer « ${retire} »`);
}

console.log('En-tete de fiche sobre tests passed');
