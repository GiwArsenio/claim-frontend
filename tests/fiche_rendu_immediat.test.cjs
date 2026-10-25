// Cliquer une offre ne doit pas laisser la fiche vide le temps de l'API.
//
// La réponse de liste porte déjà description_raw : tout le texte y est. Seule
// la structure éditoriale (description_html, sections) manque, et le détail
// met 300 à 1 600 ms à l'apporter.
//
// Deux exigences, et la seconde a changé :
//
//   1. L'EN-TÊTE s'affiche tout de suite — titre, entreprise, pastilles,
//      actions. C'est ce qui donne la sensation d'ouverture immédiate.
//
//   2. LE CORPS attend le détail. Peindre le texte de la liste puis le
//      remplacer par la structure d'origine faisait voir, sous les yeux du
//      lecteur, un texte sans mise en forme pendant la requête. On peint
//      donc un squelette, et jamais le texte brut.
//
// La règle est vérifiable sans navigateur : la signature de dessinerDetail
// porte le drapeau, l'appel le transmet, et le corps est conditionnel.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');

// Le dessin est séparé du chargement, et le préchargement existe.
assert.ok(html.includes('function dessinerDetail(j, sansCorps)'),
  'le dessin de la fiche est une fonction à part, et sait ne pas peindre le corps');
assert.ok(html.includes('function prechargerDetail(id)'), 'le préchargement doit exister');

// Le corps est conditionnel : le squelette remplace le texte de la liste.
assert.ok(html.includes('.desc-attente'),
  'un squelette est prévu pour l\'attente du détail');
assert.ok(/const summary = sansCorps[\s\S]{0,200}desc-attente/.test(html),
  'le corps n\'est pas peint quand la fiche vient de la liste');

const debut = html.indexOf('async function renderDetail(id) {');
assert.ok(debut >= 0, 'renderDetail doit exister');
const renderDetail = html.slice(debut, html.indexOf('\n}\n', debut));

// On dessine avant d'attendre : c'est tout l'intérêt. L'en-tête apparaît
// pendant que la requête court, même si le corps attend.
const posDessin = renderDetail.indexOf('dessinerDetail(depart, !enCache)');
const posAttente = renderDetail.indexOf('await fetchDetail(id)');
assert.ok(
  posDessin >= 0 && posDessin < posAttente,
  "la fiche est dessinée depuis la liste avant d'attendre le détail"
);

// Le corps n'est peint d'emblée que si le cache a déjà servi.
assert.ok(renderDetail.includes('dessinerDetail(depart, !enCache)'),
  'le corps n\'est peint tout de suite que si le détail est déjà en cache');

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

// Si la requête échoue, on peint le texte de la liste : mieux vaut une fiche
// sans structure qu'un squelette qui ne s'arrêterait jamais.
assert.ok(renderDetail.includes('} else if (!enCache) {'),
  'un repli est prévu quand la requête échoue');
