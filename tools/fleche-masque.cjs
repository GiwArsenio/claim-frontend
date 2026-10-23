/* Remplace la fleche des listes deroulantes par une fleche qui suit le theme.
 *
 * Ce que la fleche etait : une IMAGE SVG dont la couleur etait figee dans
 * le fichier (stroke=%23515f78). Deux problemes :
 *   - elle ne suivait ni le theme, ni le survol ;
 *   - a 2,64 de contraste sur le fond de pause en mode nuit, elle y etait
 *     presque invisible.
 *
 * Ce qu'elle devient : une IMAGE SVG dont l'URL est portee par une
 * variable CSS. La variable prend une valeur differente en mode nuit :
 * la fleche suit le theme, sans qu'on ait a dupliquer la regle de fond.
 *
 * Pourquoi PAS un masque : un masque ne garde que la forme, et la couleur
 * vient de l'element. Applique a la `select` elle-meme, il effacerait le
 * fond de la pastille — il n'y a pas de pseudo-element sur une `select`
 * pour porter l'arrow a part.
 *
 * Pourquoi le raccourci `background` est ecarte : il remet a zero
 * background-position et background-repeat. La fleche partait alors dans le
 * coin haut-gauche, repetee sur toute la pastille — 101 pixels de fleche
 * au repos, 464 au survol.
 */
'use strict';

const fs = require('node:fs');

const PAGES = [
  { chemin: 'index.html', nom: 'accueil' },
  { chemin: 'job-board.html', nom: 'board' },
];

/* L'URI du SVG, extraite telle quelle : aucune recopie, donc aucune
   possibilite d'abimer le Percent-encoding. */
const ANCIEN_DEBUT = 'select.chip {';
const ANCIEN_FIN = 'background-position: right .7rem center; }';

for (const page of PAGES) {
  let s = fs.readFileSync(page.chemin, 'utf8');

  if (s.includes('--fleche-pastille')) {
    console.log('  DEJA         fleche (' + page.nom + ')');
    continue;
  }

  const debutBloc = s.indexOf(ANCIEN_DEBUT);
  const finBloc = s.indexOf(ANCIEN_FIN);
  if (debutBloc === -1 || finBloc === -1) {
    console.log('  INTROUVABLE  bloc fleche (' + page.nom + ')');
    continue;
  }

  /* L'URI de la fleche, prise dans le bloc existant. */
  const m = s.slice(debutBloc, finBloc).match(/url\("([^"]+)"\)/);
  if (!m) {
    console.log('  INTROUVABLE  URI fleche (' + page.nom + ')');
    continue;
  }
  const uriJour = m[1];
  /* Le meme dessin, avec un trait plus clair pour le mode nuit. */
  const uriNuit = uriJour.replace(/%23515f78/g, '%238b9aa0');

  const remplacement =
`/* La fleche de la liste deroulante.
   Elle est une IMAGE dont l'URL est portee par une variable : la variable
   prend une autre valeur en mode nuit, et la fleche suit le theme.

   En image a couleur figee, elle ne suivait ni le theme, ni le survol, et
   son trait etait a 2,64 de contraste sur le fond de pause en mode nuit :
   elle y etait presque invisible.

   Ni raccourci \`background\`, ni \`background-color\` seul : le raccourci
   remet a zero background-position et background-repeat, et la fleche
   partait dans le coin haut-gauche, repetee sur toute la pastille —
   101 pixels de fleche au repos, 464 au survol. */
select.chip { appearance: none; -webkit-appearance: none; padding-right: 2rem;
  --fleche-pastille: url("${uriJour}");
  background-image: var(--fleche-pastille);
  background-repeat: no-repeat; background-position: right .7rem center; }
/* En mode nuit, la fleche s'eclaircit : sur une surface sombre, le trait
   d'origine tombait sous le seuil de lisibilite. */
html[data-theme="nuit"] select.chip {
  --fleche-pastille: url("${uriNuit}");
}`;

  s = s.slice(0, debutBloc) + remplacement + s.slice(finBloc + ANCIEN_FIN.length);
  fs.writeFileSync(page.chemin, s);
  console.log('  OK           fleche suivie du theme (' + page.nom + ')');
}
