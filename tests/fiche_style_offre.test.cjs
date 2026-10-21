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
// L'enveloppe suit la variable de lecture, et non une valeur recopiée :
// c'est elle qui décide de la largeur, et le calcul des marges s'y appuie.
assert.ok(dc.includes('max-width: var(--enveloppe-lecture)'),
  "l'enveloppe prend la largeur de lecture posée par la page");
const variable = html.match(/--enveloppe-lecture: ([\d.]+)rem/);
assert.ok(variable, 'la page déclare sa largeur de lecture');
assert.ok(parseFloat(variable[1]) >= 46 * 1.25 - 0.01,
  `la fiche garde au moins la largeur du modèle, majorée de 25 % (lu: ${variable[1]}rem)`);
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
// Le bloc laisse un demi-rem de vide au-dessus de lui : collé au bord, la
// fiche semblait plaquée contre le haut de la fenêtre. Ce vide doit être un
// décalage, et non un blanc qui s'étend jusqu'au bord — le blanc ne se voit
// pas, et l'espace disparaissait.
assert.ok(entete.includes('top: .5rem'),
  'le bloc se decale d un demi-rem sous le bord du volet');
assert.ok(entete.includes('padding: .35rem 1.25rem .5rem'),
  'et garde ses marges interieures, sans quoi le bloc grandirait');
assert.ok(entete.includes('background: #fff'),
  'un fond opaque est indispensable : le corps defile dessous');
assert.ok(entete.includes('margin: 0 -1.25rem'),
  'le fond couvre les gouttieres, sinon le texte defilerait a cote');
// Le vide est refermé par un aplat : sans lui, le texte de l'annonce
// traversait la bande en défilant.
assert.ok(/\.d-entete::before \{[\s\S]{0,300}bottom: 100%;/.test(html),
  'un aplat au dessus du bloc referme le vide laisse decouvert');
assert.ok(/\.d-entete::before \{[\s\S]{0,300}background: #f3f4f5;/.test(html),
  "l'aplat prend la teinte du champ, invisible au repos");
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
// Le blanc autour de la carte doit etre le meme des deux cotes. A gauche il
// vaut la marge de page plus la colonne des offres ; la marge de droite doit
// donc valoir exactement cette somme.
//
// C'est la mise en page de la fiche seule : la colonne des offres a gauche,
// la fiche recentree dans la place qui reste. La bande ne descend jamais sous
// zero — quand la fenetre se resserre, la fiche s'arrete plutot que de
// deborder sur la colonne.
// La largeur n'est pas recopiée ici : elle est déclarée une fois, en rem,
// et la fiche la prend telle quelle. Le calcul des marges s'appuie sur la
// même variable, donc les deux ne peuvent pas diverger.
const enveloppe = html.match(/--enveloppe-lecture:\s*([\d.]+)rem/);
assert.ok(enveloppe, "la largeur de l'enveloppe doit etre declaree");
assert.ok(parseFloat(enveloppe[1]) > 46, 'elle couvre au moins la largeur de lecture du modele');
assert.ok(dc.includes('max-width: var(--enveloppe-lecture)'), "et l'enveloppe du board s'y conforme");

// La marge de droite vaut la marge de page plus la colonne : c'est la seule
// valeur qui rende le blanc egal a gauche et a droite de la carte. La marge
// de page grandissant avec l'ecran, la somme est plafonnee a `--colonne-liste`
// — au-dela, la carte occupe le reste et son `margin: 0 auto` repartit le blanc.
// Le troisieme terme protege les ecrans moyens : la carte garde au moins
// 820 px, et la marge decroit jusqu'a zero plutot que de l'ecraser.
const bande = valeur(html, '.pr', 'margin-right');
assert.ok(bande.startsWith('max(0px,'), 'la bande ne descend jamais sous zero');
assert.ok(bande.includes('min(var(--colonne-liste)'), 'elle est plafonnee a la colonne');
assert.ok(/calc\(100% - var\(--colonne-liste\) - 820px\)/.test(bande),
  'la carte garde au moins 820 px avant que la marge ne s applique');
assert.ok(!bande.includes('var(--enveloppe-lecture)'),
  'le calcul ne porte plus sur l enveloppe de lecture');
assert.ok(!/\/\s*3\)/.test(bande), 'plus de division par trois');
assert.ok(!bande.includes('clamp('), 'la bande ne copie plus la colonne de gauche');

// Le rail a ete retire : la fiche garde son recentrage, et plus rien ne se
// detache en deux zones de ce cote. Ce qu'il ne doit pas laisser derriere lui
// : une regle orpheline.
assert.ok(!/\.rail\s*\{/.test(html),
  'plus aucune regle du rail ne doit subsister dans le board');
// ── L'espacement de la fiche ──
// Le padding de l'enveloppe n'a jamais été réglé par une variable : il vaut
// 1.25rem de part et d'autre, sur le board comme sur la page d'offre. C'est
// la seule distance qui compte encore depuis que le rail a été retiré.
assert.ok(/\.dc-wrap \{[^}]*padding: 1\.25rem 1\.25rem 3rem;/.test(html),
  "le padding de l'enveloppe reste 1.25rem, et n'a pas changé");
assert.ok(!/--gouttiere-fiche/.test(html),
  'plus aucune variable de gouttiere : le rail, seul a la consommer, est retire');

// ── Les marges de page ──
// A 1 920 px, la page prend 100 px de marge de chaque cote. Le reste est la
// colonne des offres, la fiche, et la marge blanche du texte : la fiche se
// recentre plutot que de s'etirer sans fin.
const largeurHaute = (nom) => {
  const m = html.match(new RegExp(nom + ': (\\d+)px;'));
  assert.ok(m, `${nom} doit etre declare en px`);
  return Number(m[1]);
};
const largeurBloc = Number(html.match(/100vw - (\d+)px/)[1]);
const margePage = (1920 - largeurBloc) / 2;
assert.equal(margePage, 100, 'a 1 920 px, la marge de page doit valoir 100 px');

const colonne = largeurHaute('--colonne-liste');
assert.equal(colonne, 420, 'la colonne des offres tient sa largeur mesuree');

const enveloppeLecture = html.match(/--enveloppe-lecture: ([^;]+);/);
assert.ok(enveloppeLecture, "la largeur de lecture de la fiche doit etre declaree");
assert.ok(enveloppeLecture[1].trim().endsWith('rem'),
  "elle est exprimee en rem, comme la page d'offre");


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


// ── Le rail a disparu, et n'a rien laisse ──
// Retire des deux surfaces. Ce qu'il ne doit pas laisser derriere lui : des
// media queries qui n'habillent plus rien, des variables mortes, un rendu.
assert.ok(!/@media \(min-width: 1280px\)/.test(html),
  "la media query des trois colonnes n'a plus de raison d'etre");
assert.ok(!/--rail-large/.test(html), 'les variables du rail sont retirees');
assert.ok(!/railOffreHtml/.test(html), 'la fonction de rendu du rail est retiree');

console.log("Fiche alignee sur le style de la page d'offre tests passed");
