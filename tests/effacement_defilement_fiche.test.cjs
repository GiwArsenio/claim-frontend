// En bureau, lire la fiche de poste efface le haut de la page : l'en-tête du
// site et le bandeau de recherche s'effacent, la fiche remonte et occupe
// l'écran. Tout revient dès qu'on remonte en haut de la fiche.
//
// L'effet déjà présent — replier le bandeau quand on défile dans la LISTE —
// doit rester intact : ce sont deux comportements distincts, sur deux volets.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');

// ── Les règles vivent dans la media query bureau ──
const debut = html.indexOf('@media (min-width: 769px) {');
const fin = html.indexOf('</style>', debut);
assert.ok(debut >= 0 && fin > debut, 'la media query bureau doit exister');
const bureau = html.slice(debut, fin);

assert.ok(/body\.fiche-defilee #hd \{/.test(bureau), "l'en-tête doit s'effacer en lecture");
assert.ok(/body\.fiche-defilee #hero \{/.test(bureau), 'le bandeau de recherche aussi');

// Hauteur nulle et non display:none : #app est une grille dont les rangées se
// remplissent dans l'ordre du DOM. Un élément retiré du flux ferait glisser
// #split sur une rangée « auto » et l'effondrerait — écran blanc.
const regleHd = bureau.match(/body\.fiche-defilee #hd \{[^}]*\}/)[0];
assert.ok(!regleHd.includes('display: none'), 'display:none effondrerait la grille');
assert.ok(regleHd.includes('max-height: 0'), "l'en-tête se replie par sa hauteur");
assert.ok(regleHd.includes('overflow: hidden'), 'et masque ce qu il contient');

const regleHero = bureau.match(/body\.fiche-defilee #hero \{[^}]*\}/)[0];
assert.ok(regleHero.includes('max-height: 0'), 'le bandeau se replie de la meme facon');
assert.ok(regleHero.includes('border-bottom-width: 0'),
  'la bordure basse retirerait sinon 1px au collage');

// ── Le suivi porte sur le volet de la fiche, pas sur la liste ──
const suiviFiche = html.match(/prEl\.addEventListener\('scroll', function \(\) \{[\s\S]*?\}\);/);
assert.ok(suiviFiche, 'le defilement de la fiche doit etre suivi');
assert.ok(suiviFiche[0].includes("classList.toggle('fiche-defilee'"),
  "c'est cette classe qui pilote l'effacement");
assert.ok(suiviFiche[0].includes('isMobile()'),
  "le suivi ne vaut qu'en bureau : sur telephone l'en-tete est deja efface");

// Pas de { once: true } : l'ancien code se retirait au premier defilement.
assert.ok(!suiviFiche[0].includes('once: true'),
  'le suivi doit rester actif a chaque defilement');
assert.ok(html.includes('SEUIL_LECTURE_FICHE'),
  'le seuil est nomme, donc reglable');

// ── L'effet existant sur la liste est preserve ──
const suiviListe = html.match(/plEl\.addEventListener\('scroll', function \(\) \{[\s\S]*?\}\);/);
assert.ok(suiviListe, "l'effet existant au defilement de la liste doit rester");
assert.ok(suiviListe[0].includes("hero.classList.toggle('collapsed'"),
  'la liste replie le bandeau, et seulement lui');
assert.ok(!suiviListe[0].includes('fiche-defilee'),
  "defiler la liste ne doit pas effacer l'en-tete du site");

// ── Fermer la fiche rend le haut de page ──
const fermeture = html.match(/function closeDetail\(\) \{[\s\S]*?\n\}/)[0];
assert.ok(fermeture.includes("classList.remove('fiche-defilee')"),
  'fermer la fiche doit rendre le haut de page');

console.log('Effacement du haut de page au defilement de la fiche tests passed');
