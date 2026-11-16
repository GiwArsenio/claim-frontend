// Toutes les pages publiées doivent porter la balise GA4. Sans elle, le trafic
// n'est pas mesuré du tout — et le défaut est invisible : GA4 ne se plaint
// jamais d'une page silencieuse.
//
// Le fichier a longtemps exigé la variable PAGE, qu'aucun script ne lui
// passait : la famille `production` le declarait, le lanceur l'appelait, et
// il tombait sur `readFileSync(undefined)` en zero seconde. Personne ne l'a
// vu parce que la famille `production` n'etait pas executee en CI. Il sait
// desormais se passer de PAGE et balaie les pages publiees.
const fs = require('fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const MESURE = process.env.MESURE_ID || 'G-SKQQXZW4LH';

/* Les pages servies au visiteur. Toutes ne portent pas forcement la balise :
   les pages transactionnelles et le dashboard interne sont hors mesure. */
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

// Une page explicite reste possible : c'est ainsi qu'on verifie une page
// hors liste sans toucher au fichier.
const pages = process.env.PAGE ? [process.env.PAGE] : PAGES.map((p) => path.join(RACINE, p));

const ouverture = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + MESURE + '">';
const manquantes = [];

for (const page of pages) {
  const contenu = fs.readFileSync(page, 'utf8');
  const nom = path.basename(page);

  if (!contenu.includes(ouverture)) {
    manquantes.push(`${nom} : balise ${MESURE} absente — la page n'est pas mesurée`);
    continue;
  }

  const debut = contenu.indexOf(ouverture);
  const fin = contenu.indexOf('</head>');
  if (fin === -1 || debut > fin) {
    manquantes.push(`${nom} : balise ${MESURE} hors de <head>`);
    continue;
  }

  console.log(`✓ ${nom} : balise ${MESURE} présente dans <head>.`);
}

if (manquantes.length) {
  console.error(`✘ ${manquantes.length} page(s) sans mesure :`);
  for (const m of manquantes) console.error(`   ${m}`);
  process.exit(1);
}

console.log(`${pages.length} page(s) portent la mesure.`);
