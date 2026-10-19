// GA4 limite strictement les paramètres de mesure.
//
//  - Un paramètre ne peut être utilisé QUE comme dimension ou comme métrique,
//    jamais les deux : GA4 refuse l'événement au complet (HTTP 400).
//    `page` en était l'exemple concret ici.
//  - `item_id` et `item_name` sont réservés au e-commerce : ils n'existent
//    que dans un tableau `items[]`. Placés au premier niveau, ils sont
//    ignorés en silence — et GA4 n'avale aucun tableau hors `items[]`.
//
// Chaque objet de mesure est extrait par équilibrage d'accolades : un simple
// « grep » attrape le nom de variable `mesure` et ment.
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');

const RESERVES = ['page', 'page_location', 'page_title', 'page_path'];

const objet = (contenu, debut) => {
  if (debut === -1) return '';
  let d = 0, j = debut, dans = false, q = '';
  for (; j < contenu.length; j++) {
    const c = contenu[j];
    if (dans) { if (c === '\\') { j++; continue; } if (c === q) dans = false; continue; }
    if (c === '"' || c === "'" || c === '`') { dans = true; q = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break; }
  }
  return contenu.slice(debut, j + 1);
};

let echecs = 0;

// job-board.html : l'objet retourné par paramOffre.
{
  const contenu = fs.readFileSync(path.join(racine, 'job-board.html'), 'utf8');
  const bloc = objet(contenu, contenu.indexOf('function paramOffre('));
  if (!bloc) {
    console.error('✘ job-board.html : paramOffre introuvable.');
    echecs++;
  } else {
    for (const r of RESERVES) {
      if (new RegExp('^\\s*' + r + '\\s*:', 'm').test(bloc)) {
        console.error(`✘ job-board.html : le paramètre réservé « ${r} » est émis au premier niveau.`);
        console.error(`  GA4 le confond avec ses propres dimensions de page → HTTP 400 sur l'événement entier.`);
        echecs++;
      }
    }
    if (!/^\s{4}items\s*:/m.test(bloc)) {
      console.error('✘ job-board.html : paramOffre ne porte pas de tableau items[].');
      echecs++;
    }
  }
}

// api/offre.js : l'objet `mesure` sérialisé dans la page.
{
  const contenu = fs.readFileSync(path.join(racine, 'api/offre.js'), 'utf8');
  const bloc = objet(contenu, contenu.indexOf('const mesure = {'));
  if (!bloc) {
    console.error('✘ api/offre.js : objet mesure introuvable.');
    echecs++;
  } else {
    for (const r of RESERVES) {
      if (new RegExp('^\\s*' + r + '\\s*:', 'm').test(bloc)) {
        console.error(`✘ api/offre.js : le paramètre réservé « ${r} » est émis au premier niveau.`);
        echecs++;
      }
    }
    if (!/^\s{4}items\s*:/m.test(bloc)) {
      console.error('✘ api/offre.js : l\'objet mesure ne porte pas de tableau items[].');
      echecs++;
    }
  }
}

if (echecs) {
  console.error(`\n${echecs} problème(s) de paramètres de mesure.`);
  process.exit(1);
}
console.log('✓ aucun paramètre réservé au premier niveau ; items[] présent.');
