/* ─────────────────────────────────────────────────────────────────────────────
   CORRECTION DES CONTRASTES DU PIED DE PAGE

   Le pied repose sur l'aplat de marque, qui est SOMBRE : en mode jour,
   #006876. Un blanc semi-transparent y perd vite en contraste.

   Les opacités d'origine :
     .35  -> 2,10 de contraste le jour  (signature de bas de page)
     .5   -> 2,82                        (tagline)
     .6   -> 3,39                        (liens de menu)

   Le seuil est 4,5 pour un texte informatif, et 0,7 rem (11,2 px) est
   très en dessous des 18,66 px qui autoriseraient 3. Aucun de ces textes
   n'est un grand texte : ils ont tous droit au seuil plein.

   À 0,85 : 5,15 le jour, 10,67 la nuit.

   Le pied du board a le même défaut que celui des autres pages. Il
   passait le scanner par hasard : il est hors du viewport, et axe ne
   teste pas ce qu'il ne voit pas. Un défaut caché par la position de
   l'élément n'est pas un défaut corrigé.

   Usage : node tools/contraste-pied.cjs
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

const PAGES = [
  'index.html',
  'job-board.html',
  'claim-entreprises.html',
  'claim-observatoire.html',
  'a-propos.html',
  'cgu.html',
  'confidentialite.html',
  'contact.html',
];

/* Les opacites remontees. On garde une legere hierarchie : le texte
   secondaire reste un cran plus discret que le texte principal, mais
   les deux passent le seuil. */
for (const page of PAGES) {
  const chemin = path.join(RACINE, page);
  if (!fs.existsSync(chemin)) continue;

  let s = fs.readFileSync(chemin, 'utf8');
  let touches = 0;

  /* On capture l'OPACITE en entier, pour la lire ensuite. */
  const REGLE = /(#ft[^{]*\{[^}]*?)(rgba\(255,\s*255,\s*255,\s*\.\d+\))/g;

  s = s.replace(REGLE, (tout, avant, complet) => {
    touches++;
    /* On lit l'opacite trouvee pour choisir la valeur de remplacement :
       le texte principal garde son poids, le texte secondaire garde un
       cran de discret, et les deux restent au-dessus de 4,5. */
    const v = parseFloat(complet.match(/\.(\d+)/)[1]);
    let nouveau = 0.85;
    if (v <= 0.4) nouveau = 0.8;   /* la signature : 4,77 le jour */
    else if (v <= 0.55) nouveau = 0.85;
    else if (v <= 0.7) nouveau = 0.85;
    else nouveau = 0.9;
    return avant + `rgba(255,255,255,${nouveau})`;
  });

  if (touches) {
    fs.writeFileSync(chemin, s, 'utf8');
    console.log(`  ${page.padEnd(26)} ${touches} opacité(s) corrigée(s)`);
  } else {
    console.log(`  ${page.padEnd(26)} aucune`);
  }
}
