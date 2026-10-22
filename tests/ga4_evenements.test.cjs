// tests/ga4_evenements.test.cjs
//
// Ce que GA4 reçoit réellement.
//
// Défaut D01 : la fiche autonome sérialise ses paramètres avec String().
// Un tableau items[] devient donc la chaîne "[object Object]". GA4 ignore
// alors silencieusement item_id et item_name : l événement part, mais sans
// donnée d offre.
//
// Les tests existants cherchaient la présence de « items: » dans le code.
// C était une illusion : la clé existait, sa valeur était perdue en route.
//
// Ce test capte l argument RÉELLEMENT reçu par gtag, en exécutant le script
// de mesure dans un contexte isolé.
//
// Ce fichier couvre :
//   G02 — arguments réellement transmis
//   G03 — noms et paramètres des événements
//   G04 — pas de double comptage

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const RACINE = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(RACINE, 'api/offre.js'), 'utf8');
const board = fs.readFileSync(path.join(RACINE, 'job-board.html'), 'utf8');

// ── Exécution réelle du script de mesure de la fiche ──────────────────────
//
// Le script est celui embarqué dans la page d offre. On l exécute avec un
// gtag factice qui enregistre ses appels, puis on regarde ce qu il a reçu.

function capturerFiche(mesure, options = {}) {
  const appels = [];

  // Le script de mesure est celui de la page : il lit window.__claimMesure,
  // appelle gtag, et pose un écouteur sur le lien de sortie.
  //
  // On capture la FONCTION ENTIERE, enveloppée dans son appel : un simple
  // découpage à partir de « var d = » laisserait un return hors fonction.
  const debut = source.indexOf('(function () {', source.indexOf('__claimMesure'));
  const fin = source.indexOf('})();', debut) + 5;
  const script = source.slice(debut, fin);

  const sortie = { ajoute: [] };
  const elements = {
    querySelector(selector) {
      if (selector === 'a[data-sortie="annonce"]') {
        if (options.sansSortie) return null;
        return {
          addEventListener(nom, fn) { if (nom === 'click') sortie.ajoute.push(fn); },
        };
      }
      return null;
    },
  };

  const ctx = vm.createContext({
    window: { __claimMesure: mesure },
    document: { querySelector: elements.querySelector },
    gtag: (...args) => { appels.push(args); },
    String,
    Object,
  });
  ctx.window.gtag = ctx.gtag;

  vm.runInContext(script, ctx);

  return { appels, declencheurSortie: () => { sortie.ajoute.forEach((fn) => fn({})); } };
}

// ─────────────────────────────────────────────────────────────────────────
// G02 — Les arguments de view_item doivent porter un tableau items[].
//
// C est le test qui a détecté D01.
// ─────────────────────────────────────────────────────────────────────────
const mesureComplete = {
  items: [{ item_id: 'abc123', item_name: 'Actuaire senior H/F' }],
  company_name: 'AXA',
  job_specialty: 'actuariat',
  contract_type: 'cdi',
  experience_level: 'senior',
  job_source: 'axa',
  view_context: 'standalone',
};

const fiche = capturerFiche(mesureComplete);

assert.ok(fiche.appels.length >= 1, 'la fiche doit émettre au moins un événement');
const evenement = fiche.appels[0];
assert.equal(evenement[0], 'event', 'le premier argument est le type');
assert.equal(evenement[1], 'view_item', 'l événement de consultation');

const params = evenement[2];
assert.ok(params, 'des paramètres doivent être transmis');

assert.ok(Array.isArray(params.items),
  'items doit rester un tableau : il est currently ' + typeof params.items);
assert.equal(params.items.length, 1, 'le tableau porte une offre');
assert.equal(params.items[0].item_id, 'abc123', 'l identifiant de l offre passe');
assert.equal(params.items[0].item_name, 'Actuaire senior H/F', 'le titre de l offre passe');

assert.equal(params.company_name, 'AXA');
assert.equal(params.job_specialty, 'actuariat');
assert.equal(params.contract_type, 'cdi');
assert.equal(params.experience_level, 'senior');
assert.equal(params.job_source, 'axa');
assert.equal(params.view_context, 'standalone');

// Les valeurs absentes ne doivent pas être transmises : une chaîne vide
// devient une dimension vide dans GA4.
const ficheVide = capturerFiche({ items: [{ item_id: 'x', item_name: 'y' }], job_specialty: '', contract_type: null });
const paramsVides = ficheVide.appels[0][2];
assert.ok(!('job_specialty' in paramsVides), 'une spécialité vide ne se transmet pas');
assert.ok(!('contract_type' in paramsVides), 'un contrat absent ne se transmet pas');

// ─────────────────────────────────────────────────────────────────────────
// G03 — Le clic de sortie émet l intention de candidature.
//
// Un clic sur le lien vers l annonce d origine est une INTENTION de
// candidature. Ce n est pas une candidature envoyée : Claim! ne voit pas ce
// qui se passe ensuite chez l employeur. Le nom de l événement et le
// commentaire du code doivent le dire.
// ─────────────────────────────────────────────────────────────────────────
const avecClic = capturerFiche(mesureComplete);
assert.equal(avecClic.appels.length, 1, 'la consultation seule ne fait pas d événement de clic');
avecClic.declencheurSortie();
assert.equal(avecClic.appels.length, 2, 'le clic de sortie émet un événement');
assert.equal(avecClic.appels[1][1], 'job_apply_click', 'le nom de l événement de candidature');
assert.ok(Array.isArray(avecClic.appels[1][2].items),
  'le clic de sortie porte aussi un tableau items[]');

// Une page sans lien de sortie n’émet rien au clic : il n y a rien à cliquer.
const sansSortie = capturerFiche(mesureComplete, { sansSortie: true });
assert.equal(sansSortie.appels.length, 1, 'sans lien de sortie, seul view_item est émis');
sansSortie.declencheurSortie();
assert.equal(sansSortie.appels.length, 1, 'et le clic ne peut rien déclencher');

// ─────────────────────────────────────────────────────────────────────────
// Le board doit produire la même forme d arguments.
//
// Un écart entre le board et la fiche rendrait les rapports illisibles : on
// ne pourrait pas comparer les deux surfaces.
// ─────────────────────────────────────────────────────────────────────────
const ctxBoard = vm.createContext({});
// paramOffre appelle tronquer : les dépendances réelles sont chargées
// avec elle, sinon le test éprouve un contexte Different du site.
const debutParam = board.indexOf('function paramOffre(');
const finParam = board.indexOf('\n}', debutParam) + 2;
const debutTronquer = board.indexOf('function tronquer(');
const finTronquer = board.indexOf('\n}', debutTronquer) + 2;
vm.runInContext(board.slice(debutTronquer, finTronquer) + '\n' + board.slice(debutParam, finParam), ctxBoard);

const offre = {
  id: 'abc123',
  title: 'Actuaire senior H/F',
  companies: { name: 'AXA' },
  jev_specialty: 'actuariat',
  contract_type: 'cdi',
  jev_experience: 'senior',
  source: 'axa',
};
ctxBoard.j = offre;
const paramsBoard = vm.runInContext('paramOffre(j, "board")', ctxBoard);

assert.ok(Array.isArray(paramsBoard.items), 'le board produit aussi un tableau items[]');
assert.equal(paramsBoard.items[0].item_id, 'abc123');
assert.equal(paramsBoard.items[0].item_name, 'Actuaire senior H/F');
assert.equal(paramsBoard.view_context, 'board');
assert.equal(paramsBoard.company_name, 'AXA');

// Mêmes clés des deux côtés : c est la condition pour que les rapports se lisent.
const clesFiche = Object.keys(params).sort();
const clesBoard = Object.keys(paramsBoard).sort();
assert.deepEqual(clesBoard, clesFiche,
  'le board et la fiche doivent transmettre les mêmes paramètres');

// ─────────────────────────────────────────────────────────────────────────
// G03 — L appel de view_item_list ne porte pas de paramètre « page ».
//
// Attention à ce que l on affirme ici. L audit a établi qu une affirmation
// antérieure — « page provoquerait un HTTP 400 sur tout l événement » —
// n est PAS démontrée : une dimension personnalisée nommée « page » a pu
// être créée sans refus. Ce que l on vérifie ici est un fait simple et
// vérifiable : l appel réel ne transmet pas de paramètre nommé « page ».
//
// GA4 possède ses propres dimensions de page (page_location, page_title).
// Un paramètre du même nom crée une ambiguïté, et la dimension « page »
// correspondante a été archivée le 19/10/2026.
// ─────────────────────────────────────────────────────────────────────────
const ctxMesure = vm.createContext({});
const debutMesure = board.indexOf('function mesurer(');
const finMesure = board.indexOf('\n}', debutMesure) + 2;
vm.runInContext(board.slice(debutMesure, finMesure), ctxBoard);

const captures = [];
ctxBoard.gtag = (...args) => captures.push(args);
ctxBoard.params = { results_count: 42, view_context: 'board', filters_count: 2 };
vm.runInContext('mesurer("view_item_list", params)', ctxBoard);

assert.ok(captures.length >= 1, 'la mesure doit être capturée');
const args = captures[captures.length - 1];
assert.equal(args[1], 'view_item_list');
assert.equal(args[2].results_count, 42, 'le nombre de résultats se transmet');
assert.equal(args[2].filters_count, 2, 'le nombre de filtres se transmet');

// L appel RÉEL de la liste ne doit comporter aucun paramètre nommé « page ».
const appelListe = board.slice(board.indexOf("mesurer('view_item_list'"));
const finAppelListe = appelListe.indexOf('});');
const blocListe = appelListe.slice(0, finAppelListe);
assert.ok(!/\bpage\s*:/.test(blocListe),
  'l appel de view_item_list ne doit pas transmettre de paramètre nommé page');

// mesurer() écarte les valeurs vides, et transmet les objets tels quels.
const captures2 = [];
ctxBoard.gtag = (...args) => captures2.push(args);
ctxBoard.params2 = { vide: '', nul: null, nombre: 7, tableau: [{ a: 1 }] };
vm.runInContext('mesurer("search", params2)', ctxBoard);
const p2 = captures2[captures2.length - 1][2];
assert.ok(!('vide' in p2), 'une chaîne vide ne se transmet pas');
assert.ok(!('nul' in p2), 'une valeur nulle ne se transmet pas');
assert.equal(p2.nombre, 7, 'un nombre se transmet');
assert.ok(Array.isArray(p2.tableau), 'un tableau traverse mesurer() sans être transformé');

console.log('GA4 : arguments réellement transmis, événements, cohérence board/fiche — OK');
