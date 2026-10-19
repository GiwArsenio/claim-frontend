// Les événements e-commerce (view_item, select_item, job_apply_click) doivent
// porter un tableau items[]. C'est la seule façon que GA4 accepte item_id et
// item_name — ils n'existent pas au premier niveau.
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');

// Extraction d'un objet littéral par équilibrage d'accolades : le simple
// « grep items » attrape le nom de variable `mesure` et ment.
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

const cibles = [
  ['job-board.html', 'function paramOffre('],
  ['api/offre.js', 'const mesure = {'],
];

let echecs = 0;
for (const [fichier, ancre] of cibles) {
  const contenu = fs.readFileSync(path.join(racine, fichier), 'utf8');
  const bloc = objet(contenu, contenu.indexOf(ancre));
  if (!bloc) {
    console.error(`✘ ${fichier} : le point d'entrée « ${ancre} » est introuvable.`);
    echecs++;
    continue;
  }
  if (!/\bitems\s*:/.test(bloc)) {
    console.error(`✘ ${fichier} : l'objet de mesure ne porte pas de tableau items[].`);
    console.error(`  Sans lui, item_id et item_name sont ignorés en silence par GA4.`);
    echecs++;
  }
}
if (echecs) process.exit(1);
console.log('✓ items[] présent sur les deux surfaces.');
