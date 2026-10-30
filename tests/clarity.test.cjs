// Microsoft Clarity n'est chargé qu'après un accord explicite.
//
// Ce que ces contrôles prouvent — et ce qu'ils ne prouvent pas.
//
// Ils lisent le texte des fichiers : ils peuvent établir qu'aucune page
// n'appelle clarity.ms directement, que la balise est présente partout où
// elle doit l'être, que les champs de saisie sont masqués et que le
// chargeur n'appelle `charger()` que dans la branche d'accord. Ils ne
// peuvent pas établir le comportement du navigateur : c'est le rôle de
// tests/clarity-consentement.test.cjs, qui observe les requêtes réelles.
//
// Le défaut qu'on cherche à rendre impossible : une balise copiée dans le
// <head> « en attendant », qui enregistrerait des sessions avant tout
// accord. Ce défaut est invisible à l'œil et ne casse aucun test de rendu.
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');

// Les pages qui mesurent, plus la page de retrait : elle porte le bouton
// qui doit pouvoir couper Clarity, donc le chargeur.
const PAGES = [
  'index.html',
  'job-board.html',
  'claim-entreprises.html',
  'claim-observatoire.html',
  'confidentialite.html',
  'api/offre.js',
];

const CHARGEUR = 'assets/clarity.js';

let echecs = 0;
const echec = (message) => { console.error(`✘ ${message}`); echecs++; };

// ── 1. La balise est présente partout, et une seule fois ───────────────────
for (const page of PAGES) {
  const contenu = lire(page);
  const occurrences = (contenu.match(/\/assets\/clarity\.js/g) || []).length;
  if (occurrences !== 1) {
    echec(`${page} : ${occurrences} référence(s) au chargeur, 1 attendue.`);
  }
}

// ── 2. Aucune page n'appelle clarity.ms directement ────────────────────────
// L'appel réseau doit exister dans UN fichier, derrière la condition.
for (const page of PAGES) {
  if (lire(page).includes('clarity.ms')) {
    echec(`${page} : appelle clarity.ms dans la page. Le chargement doit passer par ${CHARGEUR}.`);
  }
}

// ── 3. Le chargeur porte la condition, le signal et le garde d'identifiant ─
const chargeur = lire(CHARGEUR);

if (!chargeur.includes("var ACCORD = 'tout';")) {
  echec(`${CHARGEUR} : la valeur d'accord attendue n'est pas 'tout'.`);
}
if (!/choix\(\) === ACCORD\) charger\(\)/.test(chargeur)) {
  echec(`${CHARGEUR} : le chargement au démarrage n'est pas conditionné au choix.`);
}
if (!chargeur.includes('if (!PROJET ||')) {
  echec(`${CHARGEUR} : sans identifiant de projet, le chargeur ferait un appel.`);
}
if (!chargeur.includes('consentv2')) {
  echec(`${CHARGEUR} : le signal de consentement (consentv2) n'est pas transmis.`);
}
if (!/ad_Storage:\s*'denied'/.test(chargeur)) {
  echec(`${CHARGEUR} : ad_Storage n'est pas refusé — aucun partage publicitaire n'est voulu.`);
}
if (!/analytics_Storage:\s*'granted'/.test(chargeur)) {
  echec(`${CHARGEUR} : analytics_Storage n'est pas accordé après acceptation.`);
}

// Le chargeur ne doit pas se déclencher depuis un autre chemin que le clic
// sur « Tout accepter » ou un choix déjà enregistré.
const appelsCharger = (chargeur.match(/charger\(\)/g) || []).length;
if (appelsCharger !== 3) {
  // définition + appel conditionnel au démarrage + appel sur clic accepté
  echec(`${CHARGEUR} : ${appelsCharger} appels à charger() — 3 attendus (définition comprise).`);
}

// ── 4. Le bandeau dit ce qui est réellement collecté ───────────────────────
for (const page of ['index.html', 'job-board.html', 'claim-entreprises.html', 'claim-observatoire.html', 'api/offre.js']) {
  const contenu = lire(page);
  if (!contenu.includes('Microsoft')) {
    echec(`${page} : le bandeau ne nomme pas Clarity.`);
  }
  if (contenu.includes("aucune donnée n'est partagée avec un tiers")) {
    echec(`${page} : le bandeau affirme encore qu'aucune donnée n'est partagée avec un tiers.`);
  }
}

// ── 5. Ce que le visiteur tape n'est pas rejoué ────────────────────────────
const MASQUES = {
  'index.html': ['id="q"'],
  'job-board.html': ['id="q-input"', 'id="city-input"', 'id="alerte-mail"'],
  'claim-entreprises.html': ['id="search-input"', 'id="chantier-email"'],
  'claim-observatoire.html': ['id="chantier-email"', 'class="nl-input"', 'class="nl-section-input"'],
};

for (const [page, champs] of Object.entries(MASQUES)) {
  const contenu = lire(page);
  for (const champ of champs) {
    // La balise <input> qui porte cet identifiant ou cette classe doit
    // porter l'attribut de masquage.
    const motif = new RegExp(`<input[^>]*${champ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`);
    const balise = contenu.match(motif);
    if (!balise) {
      echec(`${page} : champ ${champ} introuvable.`);
      continue;
    }
    if (!balise[0].includes('data-clarity-mask="true"')) {
      echec(`${page} : le champ ${champ} n'est pas masqué dans les enregistrements.`);
    }
  }
}

// ── 6. Le retrait est une action, pas un mode d'emploi ─────────────────────
const confidentialite = lire('confidentialite.html');
if (!confidentialite.includes('id="retirer-accord"')) {
  echec('confidentialite.html : pas de bouton de retrait du consentement.');
}
if (!confidentialite.includes('claimClarityRetirer')) {
  echec('confidentialite.html : le bouton de retrait ne prévient pas Clarity.');
}
if (!confidentialite.includes("localStorage.removeItem('claim-consentement')")) {
  echec('confidentialite.html : le retrait n\'efface pas le choix enregistré.');
}

// ── 7. Le gabarit Worker reste aligné sur la source ────────────────────────
// Les deux rendus de fiche doivent porter la même balise : sinon le Worker
// et la production mesurent deux périmètres différents, en silence.
const gabarit = lire('src/pages/_offre-rendu.js');
if (!gabarit.includes('/assets/clarity.js')) {
  echec('src/pages/_offre-rendu.js : le gabarit du Worker n\'est pas réaligné (scripts/aligner-rendu.py).');
}

if (echecs) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log('✓ Clarity : chargeur conditionnel, bandeau informé, champs masqués, retrait présent.');
