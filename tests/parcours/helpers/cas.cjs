// tests/parcours/helpers/cas.cjs
//
// Le registre des cas de parcours.
//
// Pourquoi un registre : un parcours doit etre un cas nomme, reproductible,
// avec une attente explicite. Un cas sans identifiant ne peut etre compare
// d une execution a l autre, ni retrouve dans une trace.
//
// Deux modes de lancement, un seul code :
//   - runner    : npx playwright test
//   - autonome : node tests/parcours/<fichier>.test.cjs
//
// Le mode autonome existe pour depanner un cas sans relancer toute la
// suite. Il execute exactement le meme code que le runner : les assertions
// sont les memes, seul le harnais change.

const { test: testBase, expect } = require('@playwright/test');
const { demarrer } = require('./serveur-local.cjs');
const { OFFRES } = require('./donnees.cjs');

const CAS = {};

function definirCas(nom, description, corps) {
  CAS[nom] = { nom: nom, description: description, corps: corps };
  return corps;
}

// Detecte le mode runner.
//
// Playwright pose PLAYWRIGHT_TEST=1 dans le processus qui charge les fichiers
// de test (setPlaywrightTestProcessEnv). Execute directement par node, cette
// variable est absente.
//
// C'est le moment du chargement qui compte : les tests doivent s enregistrer
// dans le bon registre, sinon le runner ne voit rien.
function enModeRunner() {
  return process.env.PLAYWRIGHT_TEST === '1';
}

// Enregistre un cas de parcours.
//
// Ce helper ne s'appelle pas directement depuis un fichier de test : il
// serait alors attribue a ce module dans le rapport de la CI, et tous les
// parcours y seraient confondus.
//
// Chaque fichier de test declare donc son propre `test`, qui appelle
// `enregistrerCas` ci-dessous. L appel a lieu dans le fichier de test : le
// rapport de la CI montre alors le bon fichier pour chaque cas.
// Le mode runner est decide ici, mais l appel a testBase est fait par le
// fichier de test : Playwright rattache un cas au fichier depuis lequel
// test() est appele, et un appel passant par un module tiers attribuerait
// tous les cas a ce module.
function modeRunner() {
  return enModeRunner();
}

// Prepare l adaptateur du cas : le corps attend la page en premier argument,
// Playwright livre les fixtures.
function adapter(corps) {
  return async ({ page, context }) => corps(page, context);
}

// ── Attentes deterministes ────────────────────────────────────────────────
//
// attendreListe est la seule maniere de savoir que la liste est complete.
// Compter les cartes auHasard, c est lire un etat intermediaire : la liste
// peut encore etre en train de se remplir. Un parcours qui.positionne son
// scroll avant la fin du rendu lit une position qui n existe pas.

async function attendreListe(page, attendu) {
  await page.waitForFunction(
    (n) => document.querySelectorAll('#feed .jc').length === n,
    attendu,
    { timeout: 10000 }
  );
}

async function attendreDetail(page, fragment) {
  await page.waitForFunction(
    (f) => {
      const el = document.getElementById('detail');
      return !!el && el.textContent.indexOf(f) !== -1;
    },
    fragment,
    { timeout: 10000 }
  );
}

// ── Contexte de test ──────────────────────────────────────────────────────
//
// Le serveur local et la page sont lies : chaque cas part d un etat connu.
// Aucun cas ne depend de l ordre d execution des autres.
async function ouvrirPage(page, options) {
  const opts = options || {};
  const serveur = await demarrer(opts);

  // Le stub GA4 doit etre installe avant tout script de la page : celle-ci
  // redemarre dataLayer.push, et un stub pose trop tard perd les evenements.
  await page.addInitScript(() => {
    window.__evenementsGa4 = [];
    window.dataLayer = window.dataLayer || [];
    const pileOriginale = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function () {
      const args = Array.from(arguments);
      const premier = args[0];
      if (premier && premier[0] === 'event') {
        const evenement = {};
        evenement.nom = premier[1];
        evenement.params = premier[2] || {};
        window.__evenementsGa4.push(evenement);
      }
      return pileOriginale.apply(window.dataLayer, args);
    };
    window.gtag = function () {
      return window.dataLayer.push(arguments);
    };
  });

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.indexOf(serveur.url) === 0) {
      route.continue();
      return;
    }
    route.abort();
  });
  return serveur;
}

async function fermerPage(serveur) {
  if (serveur) await serveur.arreter();
}

// ── Lecture des evenements GA4 ────────────────────────────────────────────
//
// Les arguments GA4 sont un effet observable : on lit la pile dataLayer
// que le stub a enregistree. C'est plus solide qu une recherche de chaine
// dans le code source : on verifie ce qui a reellement ete emis.
async function lireGa4(page) {
  return page.evaluate(() => window.__evenementsGa4 || []);
}

async function ga4ParNom(page, nom) {
  const evenements = await lireGa4(page);
  return evenements.filter((e) => e.nom === nom);
}

// ── Mode autonome ─────────────────────────────────────────────────────────
//
// Hors runner, aucun cas n est joue automatiquement. Ce lanceur joue donc
// les cas enregistres un par un, avec un vrai navigateur.
//
// Le code joue est exactement celui du runner : memes assertions. Seule la
// presentation change.
async function lancerAutonomie() {
  const { chromium } = require('@playwright/test');
  const noms = Object.keys(CAS);
  if (!noms.length) return;

  const navigateur = await chromium.launch();
  let reussis = 0;
  let echecs = 0;
  const enEchec = [];

  for (const nom of noms) {
    const cas = CAS[nom];
    const contexte = await navigateur.newContext();
    const page = await contexte.newPage();
    try {
      await cas.corps(page, contexte);
      reussis += 1;
      console.log('  ok    ' + nom);
    } catch (e) {
      echecs += 1;
      enEchec.push(nom);
      console.log('  ECHEC ' + nom);
      console.log('        ' + String(e.message).split('\n')[0]);
    } finally {
      await contexte.close();
    }
  }

  await navigateur.close();
  console.log('');
  console.log('  ' + reussis + ' reussi(s), ' + echecs + ' echec(s)');
  if (enEchec.length) console.log('  en echec : ' + enEchec.join(', '));
  process.exitCode = echecs ? 1 : 0;
}

// Enregistre un cas pour le mode autonome. Appele par le `test` local de
// chaque fichier de parcours.
function enregistrerCasAutonome(nom, corps) {
  definirCas(nom, nom, corps);
}

module.exports = {
  modeRunner: enModeRunner,
  modeRunner: modeRunner,
  enregistrerCasAutonome: enregistrerCasAutonome,
  adapter: adapter,
  expect: expect,
  CAS: CAS,
  demarrer: demarrer,
  OFFRES: OFFRES,
  attendreListe: attendreListe,
  attendreDetail: attendreDetail,
  ouvrirPage: ouvrirPage,
  fermerPage: fermerPage,
  lireGa4: lireGa4,
  ga4ParNom: ga4ParNom,
  lancerAutonomie: lancerAutonomie,
};
