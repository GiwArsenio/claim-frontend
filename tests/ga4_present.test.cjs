// Toutes les pages publiées doivent porter la balise GA4. Sans elle, le trafic
// n'est pas mesuré du tout — et le défaut est invisible : GA4 ne se plaint
// jamais d'une page silencieuse.
const fs = require('fs');

const PAGE = process.env.PAGE;
const MESURE = process.env.MESURE_ID || 'G-SKQQXZW4LH';

const contenu = fs.readFileSync(PAGE, 'utf8');

// Le bloc porteur doit exister — et il doit être dans <head>.
const ouverture = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + MESURE + '">';
if (!contenu.includes(ouverture)) {
  console.error(`✘ ${PAGE} : la balise ${MESURE} est absente. La page n'est pas mesurée.`);
  process.exit(1);
}

const debut = contenu.indexOf(ouverture);
const fin = contenu.indexOf('</head>');
if (fin === -1 || debut > fin) {
  console.error(`✘ ${PAGE} : la balise ${MESURE} n'est pas dans <head>.`);
  process.exit(1);
}

console.log(`✓ ${PAGE} : balise ${MESURE} présente dans <head>.`);
