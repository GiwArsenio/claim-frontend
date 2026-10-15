// La fiche du board converge vers la page d'offre (/offre/{slug}) : fond,
// pastilles, défilement, échelle de titres, marges. Les valeurs sont
// comparées une à une à api/offre.js pour qu'aucune ne dérive en silence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');
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

// ── Fond : la fiche est une carte sur le champ gris ──
//
// C'est la delimitation reprise du modele : deux cartes blanches, une
// gouttiere entre elles, un champ gris dessous. Le volet reste blanc sur
// telephone — la fiche y occupe tout l'ecran, il n'y a rien a delimiter.
const pr = bloc(html, '.pr ');
assert.ok(pr.includes('background: #fff'), 'le volet reste blanc sur telephone');
assert.ok(pr.includes('system-ui'), 'la fiche prend la police de la page d offre');
assert.ok(pr.includes('line-height: 1.65'), 'et son interligne');
assert.ok(/@media \(min-width: 769px\)[\s\S]{0,6000}\.pr \{ background: #f3f4f5; \}/.test(html),
  'en bureau, le volet prend le gris du bandeau : la fiche et le rail s y detachent');

const dc = bloc(html, '.dc');
assert.ok(dc.includes('max-width: 46rem'), "l'enveloppe tient la largeur de lecture du modèle");
assert.ok(dc.includes('padding: 1.5rem 1.25rem 4rem'), 'et ses marges');
assert.ok(/\.dc \{[\s\S]{0,400}border-radius: \.75rem;/.test(html),
  'la fiche est une carte : angles arrondis');
assert.ok(/\.d-entete \{[\s\S]{0,900}border-radius: \.75rem \.75rem 0 0;/.test(html),
  "l'en-tete fige reprend les angles hauts de la carte");

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
const racine = html.match(/:root \{\s*--colonne-liste: ([^;]+);/);
assert.ok(racine, 'la variable de largeur doit etre declaree');
assert.equal(racine[1].trim(), '420px', 'et valoir la largeur mesuree de la colonne');

// La marge droite n'est pas la colonne : c'est la marge blanche du texte.
// L'enveloppe se centrant dans la page, « bande = marge blanche » se resout
// en bande = (fenetre - colonne - enveloppe + 2 x padding) / 3.
//
// C'est la mise en page de la fiche seule, sans rail : celui-ci ne parait que
// lorsque la colonne, l'enveloppe ET le rail tiennent cote a cote. Des que le
// rail s'affiche, la bande n'a plus lieu d'etre — elle disparait au profit de
// la deuxieme colonne (les regles du rail elles-memes sont verrouillees par
// tests/rail_fiche.test.cjs).
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

// Le rail prend la place de cette bande quand la fenetre le permet : la fiche
// n'est alors plus centree, elle est ancree pres de la liste.
assert.ok(/@media \(min-width: 1280px\)[\s\S]{0,4000}\.pr \{ margin-right: 0; \}/.test(html),
  "quand le rail s'affiche, la bande de recentrage s'efface");
assert.ok(/\.dc \{[\s\S]{0,260}flex-grow: 1;/.test(html),
  'la fiche grandit dans la place laissee par la liste');
assert.ok(/\.rail \{[\s\S]{0,260}flex-grow: 1;/.test(html),
  'le rail grandit de la meme facon, a parts egales');
// ── La gouttière : une seule distance, trois endroits ──
// Entre la liste et la fiche, entre la fiche et le rail, et entre le rail et
// le bord de défilement du volet. L'égalité des trois se voit à l'œil nu :
// c'est elle qui fait lire le bloc comme un ensemble. Elle se règle donc d'un
// seul chiffre — et ce chiffre vaut 20 % de moins que les 2 rem d'origine.
const GOUTTIERE_REM = (() => {
  const m = html.match(/--gouttiere-fiche: ([\d.]+)rem;/);
  assert.ok(m, 'la gouttière de la fiche doit être déclarée en rem');
  return Number(m[1]);
})();
assert.equal(GOUTTIERE_REM, 1.6, 'la gouttière vaut 1,6 rem : 2 rem moins 20 %');
const GOUTTIERE = GOUTTIERE_REM * 16;

assert.ok(/\.dc-wrap \{[\s\S]{0,240}gap: var\(--gouttiere-fiche\);/.test(html),
  'la gouttière entre la fiche et le rail est la gouttière de la fiche');
assert.ok(/\.dc-wrap \{[\s\S]{0,240}padding: 1\.25rem var\(--gouttiere-fiche\) 3rem var\(--gouttiere-fiche\);/.test(html),
  'la même sépare la liste de la fiche, et décolle le rail du bord de défilement');

// ── La répartition à la largeur de référence ──
// À 1 920 px : 100 px de marge de chaque côté, la colonne des offres, trois
// gouttières, puis la fiche et le rail qui grandissent à parts égales depuis
// leurs largeurs de lecture. La somme doit tomber juste — sinon une zone
// déborde, ou il reste un trou.
const largeurHaute = (nom) => {
  const m = html.match(new RegExp(nom + ': (\\d+)px;'));
  assert.ok(m, `${nom} doit etre declare en px`);
  return Number(m[1]);
};
const largeurBloc = Number(html.match(/100vw - (\d+)px/)[1]);
const margePage = (1920 - largeurBloc) / 2;
assert.equal(margePage, 100, 'a 1 920 px, la marge de page doit valoir 100 px');

const colonne = largeurHaute('--colonne-liste');
const enveloppeLarge = largeurHaute('--enveloppe-large');
const railLarge = largeurHaute('--rail-large');
const ENVELOPPE_LECTURE = 736;
const RAIL_LECTURE = 288;
const arrondi = (n) => Number(n.toFixed(1));

// Ce que la colonne laisse à la fiche et au rail : trois gouttières en moins.
const place = arrondi(1920 - (2 * margePage + colonne + 3 * GOUTTIERE));
assert.equal(place, 1223.2, 'ce qui reste pour la fiche et le rail');

// Le flexbox partage le surplus à parts égales depuis les largeurs de lecture.
const surplus = arrondi(place - (ENVELOPPE_LECTURE + RAIL_LECTURE));
assert.equal(arrondi(ENVELOPPE_LECTURE + surplus / 2), 835.6,
  'la fiche grandit de la moitié du surplus');
assert.equal(arrondi(RAIL_LECTURE + surplus / 2), 387.6, 'le rail aussi');
assert.equal(arrondi(ENVELOPPE_LECTURE + surplus / 2 + RAIL_LECTURE + surplus / 2), place,
  'et les deux remplissent exactement la place laissée');
assert.ok(ENVELOPPE_LECTURE + surplus / 2 <= enveloppeLarge,
  'la fiche reste sous sa largeur haute');
assert.ok(RAIL_LECTURE + surplus / 2 <= railLarge, 'le rail aussi');
assert.equal(enveloppeLarge - ENVELOPPE_LECTURE, 106, 'la fiche dispose de 106 px de plus');
assert.equal(railLarge - RAIL_LECTURE, 106, 'et le rail aussi');

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


// ── Sous son seuil, le rail ne quitte pas la page ──
// Il se replie sous la fiche, à la même largeur de lecture et sur le même axe.
// C'est la leçon du 15/10/2026 : sous le seuil des trois colonnes, le rail
// s'empilait sous la fiche — et une mise à l'échelle de 125 % suffisait à
// déclencher ce seuil sans que rien ne le signale.
const railReplie = html.match(
  /@media \(min-width: 769px\) and \(max-width: 1279\.98px\) \{\s*\.rail \{([^}]*)\}/);
assert.ok(railReplie, 'le rail se replie sous la fiche en dessous de son seuil');
assert.match(railReplie[1], /max-width: var\(--enveloppe-lecture\)/,
  "il garde la largeur de lecture de la fiche, pas celle de la bande perdue");
assert.match(railReplie[1], /margin: 1\.25rem auto 0/, 'et se centre sur son axe');
assert.match(railReplie[1], /display: block/, 'il reste lu : il n est plus masqué');

console.log("Fiche alignee sur le style de la page d'offre tests passed");
