// Cliquer une offre ne doit pas laisser la fiche vide le temps de l'API.
//
// La réponse de liste porte déjà description_raw : tout le texte y est. Seule
// la structure éditoriale (description_html, sections) manque, et le détail
// met 300 à 1 600 ms à l'apporter. On dessine donc d'abord ce que la liste
// contient, puis on affine — au lieu d'afficher « Chargement du détail… »
// pendant toute la requête.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');

// Le dessin est séparé du chargement, et le préchargement existe.
assert.ok(html.includes('function dessinerDetail(j)'), 'le dessin de la fiche est une fonction à part');
assert.ok(html.includes('function prechargerDetail(id)'), 'le préchargement doit exister');

const debut = html.indexOf('async function renderDetail(id) {');
assert.ok(debut >= 0, 'renderDetail doit exister');
const renderDetail = html.slice(debut, html.indexOf('\n}\n', debut));

// On dessine avant d'attendre : c'est tout l'intérêt.
const posDessin = renderDetail.indexOf('dessinerDetail(depart)');
const posAttente = renderDetail.indexOf('await fetchDetail(id)');
assert.ok(
  posDessin >= 0 && posDessin < posAttente,
  "la fiche est dessinée depuis la liste avant d'attendre le détail"
);

// Et on ne redessine pas ce qui est déjà à l'écran.
assert.ok(
  renderDetail.includes('if (j === depart) return;'),
  'inutile de redessiner quand le cache a déjà servi'
);

// L'affinage ne déplace pas le lecteur.
assert.ok(
  renderDetail.includes('prEl.scrollTop = lecture'),
  'la position de lecture est reposée après l\'affinage'
);

// Le survol précharge : la requête part avant le clic.
assert.ok(html.includes("el.addEventListener('pointerenter'"), 'le survol précharge la fiche');
assert.ok(html.includes("el.addEventListener('pointerdown'"), 'le toucher précharge aussi');
assert.ok(html.includes('minuteurPrechargement'), 'un minuteur évite de précharger chaque carte traversée');
assert.ok(/prechargerDetail\(j\.id\), 80\)/.test(html), 'le délai de survol reste court');

// Le repli subsiste : sans liste ni cache, l'écran de chargement existe encore.
assert.ok(renderDetail.includes('Chargement du détail'), 'le cas sans donnée garde son écran');

console.log('Fiche rendue immediatement tests passed');
