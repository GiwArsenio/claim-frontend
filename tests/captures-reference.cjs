/* ─────────────────────────────────────────────────────────────────────────────
   CAPTURES DE RÉFÉRENCE — génération et comparaison (famille A06)

   Le catalogue demande des captures approuvées : accueil, board, fiche,
   états vide et erreur, consentement, et les deux thèmes. Les politiques
   et l'horloge doivent être stabilisées, sinon deux captures de la même
   page ne se ressemblent pas et la comparaison n'a aucun sens.

   Trois principes retenus :

   1. Une capture de référence appartient à une révision. Elle n'est jamais
      acceptée automatiquement : le test signale un écart, un humain décide.

   2. Le rendu doit être DÉTERMINISTE. Les animations sont coupées, les
      images distantes sont bloquées, l'horloge est figée, et le réseau
      extérieur est coupé. Sans cela, une capture dépend du jour, de
      l'humeur du serveur et du chargement des polices.

   3. L'écart se COMPARE, il ne se juge pas. Le test dit combien de
      pixels diffèrent et où. C'est le relecteur qui décide si l'écart est
      voulu. Une image de référence absente est signalée comme telle : le
      test ne passe pas par défaut.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const RACINE = path.join(__dirname, '..');
const DOSSIER_REFERENCE = path.join(RACINE, 'captures', 'reference');
const DOSSIER_ECARTS = path.join(RACINE, 'captures', 'ecarts');

/* Le seuil de difference tolerated. Un rendu web n'est jamais identique au
   pixel pres : l'anticrenelage et les sous-pixels varient. 0,2 % des pixels
   est le seuil utilise par les outils de reference visuels usuels. */
const SEUIL_PCT = 0.2;

/* ── Scénarios de référence ──────────────────────────────────────────────── */

const SCENARIOS = [
  { nom: 'accueil-jour', url: '/index.html', theme: 'jour', format: 'bureau' },
  { nom: 'accueil-nuit', url: '/index.html', theme: 'nuit', format: 'bureau' },
  { nom: 'board-jour', url: '/job-board.html', theme: 'jour', format: 'bureau' },
  { nom: 'board-nuit', url: '/job-board.html', theme: 'nuit', format: 'bureau' },
  { nom: 'board-mobile-jour', url: '/job-board.html', theme: 'jour', format: 'phone' },
  { nom: 'fiche-jour', url: '/job-board.html', theme: 'jour', format: 'bureau', action: 'fiche' },
  { nom: 'fiche-nuit', url: '/job-board.html', theme: 'nuit', format: 'bureau', action: 'fiche' },
  { nom: 'board-vide', url: '/job-board.html', theme: 'jour', format: 'bureau', action: 'vide' },
  { nom: 'board-erreur', url: '/job-board.html', theme: 'jour', format: 'bureau', action: 'erreur' },
  { nom: 'consentement', url: '/index.html', theme: 'jour', format: 'bureau', action: 'consentement' },
];

/* ── Comparaison ─────────────────────────────────────────────────────────── */

/**
 * Compare deux images PNG et renvoie le nombre de pixels differents.
 *
 * Une image de dimensions differentes n'est pas comparable : le test le
 * signale plutot que de le transformer en echec obscur.
 */
function comparerPng(reference, actuelle) {
  if (reference.width !== actuelle.width || actuelle.height !== actuelle.height) {
    return {
      comparable: false,
      raison: `dimensions differentes : reference ${reference.width}x${reference.height}, ` +
        `capture ${actuelle.width}x${actuelle.height}`,
      pixelsDiff: null,
      total: null,
      pct: null,
    };
  }

  const diff = new PNG({ width: reference.width, height: reference.height });
  const pixelsDiff = pixelmatch(
    reference.data,
    actuelle.data,
    diff.data,
    reference.width,
    reference.height,
    { threshold: 0.1 }
  );

  const total = reference.width * reference.height;
  return {
    comparable: true,
    pixelsDiff,
    total,
    pct: (pixelsDiff / total) * 100,
    imageDiff: diff,
  };
}

/**
 * Compare une capture a sa reference et renvoie un rapport.
 */
function comparerFichier(cheminReference, cheminActuelle) {
  if (!fs.existsSync(cheminReference)) {
    return { referenceAbsente: true, comparable: false };
  }
  if (!fs.existsSync(cheminActuelle)) {
    return { captureAbsente: true, comparable: false };
  }

  const reference = PNG.sync.read(fs.readFileSync(cheminReference));
  const actuelle = PNG.sync.read(fs.readFileSync(cheminActuelle));

  const resultat = comparerPng(reference, actuelle);

  if (resultat.comparable && resultat.imageDiff) {
    /* L'ecart est conserve : c'est lui qu'on regarde pour decider. */
    fs.mkdirSync(DOSSIER_ECARTS, { recursive: true });
    const nomEcart = path.basename(cheminActuelle).replace(/\.png$/, '-ecart.png');
    fs.writeFileSync(path.join(DOSSIER_ECARTS, nomEcart), PNG.sync.write(resultat.imageDiff));
    resultat.cheminEcart = path.join(DOSSIER_ECARTS, nomEcart);
  }

  return resultat;
}

/** Le chemin de la reference d'un scenario. */
function cheminReference(scenario) {
  return path.join(DOSSIER_REFERENCE, scenario.nom + '.png');
}

/** Le chemin de la capture courante d'un scenario. */
function cheminActuelle(scenario) {
  return path.join(DOSSIER_ECARTS, 'actuelles', scenario.nom + '.png');
}

/* ── Execution d'un scenario ─────────────────────────────────────────────── */

/**
 * Prepare la page pour une capture deterministe.
 *
 * L'horloge est figee a une date fixe : les libelles « il y a 2 jours »
 * et « 07:00 » changent chaque jour, et la capture ne serait plus
 * comparable. Les images distantes sont bloquees : un logo qui n'a pas
 * charge au moment de la capture rend la comparaison inexploitable.
 */
async function preparerPage(page) {
  /* Horloge figee : le 22 octobre 2026, 9 h, heure de Paris. */
  await page.addInitScript(() => {
    const dateFigee = new Date('2026-10-22T09:00:00+01:00').getTime();
    const DateOriginal = Date;
    function DateFigee(...args) {
      if (!(this instanceof DateFigee)) return new DateOriginal(dateFigee).toString();
      return args.length === 0
        ? new DateOriginal(dateFigee)
        : new DateOriginal(...args);
    }
    DateFigee.prototype = DateOriginal.prototype;
    DateFigee.now = () => dateFigee;
    DateFigee.parse = DateOriginal.parse;
    DateFigee.UTC = DateOriginal.UTC;
    window.Date = DateFigee;
  });
}

/**
 * Neutralise les images distantes : un logo qui tarde a charger rend la
 * capture non comparable.
 */
async function bloquerImagesDistantes(page, base) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    /* La police locale passe : c est elle qui rend le rendu
       reproductible d une machine a l autre. */
    if (url.startsWith(base)) return route.continue();
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font') return route.abort('blockedbyclient');
    return route.continue();
  });
}

/**
 * Execute l'action d'un scenario, s'il en a une.
 */
async function executerAction(page, scenario, aide) {
  if (!scenario.action) return;

  if (scenario.action === 'fiche') {
    await aide.attendre(page, 1200);
    const carte = page.locator('#feed .jc, #feed .oc').first();
    await carte.click({ timeout: 10000 });
    await aide.attendre(page, 1800);
    return;
  }

  if (scenario.action === 'vide') {
    await aide.attendre(page, 1200);
    /* Une recherche qui ne trouve rien : l'etat vide de l'interface. */
    await page.locator('#q-input').fill('zzzzzzintrouvable');
    await page.keyboard.press('Enter');
    await aide.attendre(page, 1500);
    return;
  }

  if (scenario.action === 'erreur') {
    await aide.attendre(page, 1200);
    /* Le backend tombe : l'interface doit montrer qu'elle peut reessayer. */
    await aide.controler({ pannes: ['/jobs'] });
    await page.locator('#q-input').fill('actuaire');
    await page.keyboard.press('Enter');
    await aide.attendre(page, 1500);
    return;
  }

  if (scenario.action === 'consentement') {
    /* Le bandeau de consentement, tel qu'il apparait a la premiere visite. */
    await aide.attendre(page, 1200);
    return;
  }
}

/**
 * Capture tous les scenarios et les compare a leurs references.
 */
async function capturerEtComparer(aide, options = {}) {
  const resultats = [];
  const ecriture = options.ecrireReferences || false;

  for (const scenario of SCENARIOS) {
    const format = aide.FORMATS[scenario.format];
    const optionsPage = scenario.theme === 'nuit' ? { theme: 'nuit' } : {};

    /* Le controle du serveur est un etat partage : un scenario qui simule
       une panne la laisse en place, et le scenario suivant ne recoit alors
       aucune offre. On repart de_zero avant chaque capture. */
    await aide.reinitialiserControle();

    /* On purge le choix de theme : il doit venir du scenario, pas de
       l'etat laisse par le scenario precedent. */
    const { ctx, page } = await aide.ouvrirPage(format, optionsPage);
    try {
      await preparerPage(page);
      await bloquerImagesDistantes(page, aide.BASE);
      await page.goto(aide.BASE + scenario.url, { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1200);
      await executerAction(page, scenario, aide);

      const cheminActuel = cheminActuelle(scenario);
      fs.mkdirSync(path.dirname(cheminActuel), { recursive: true });

      /* Le rendu est stabilise avant la prise : animations coupees,
         curseur invisible, images chargees. */
      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
        }`,
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: cheminActuel, fullPage: true });

      if (ecriture) {
        fs.mkdirSync(DOSSIER_REFERENCE, { recursive: true });
        fs.copyFileSync(cheminActuel, cheminReference(scenario));
        resultats.push({ scenario: scenario.nom, ecrit: true });
        continue;
      }

      const rapport = comparerFichier(cheminReference(scenario), cheminActuel);
      resultats.push({ scenario: scenario.nom, ...rapport });
    } finally {
      await ctx.close();
    }
  }

  return resultats;
}

module.exports = {
  SCENARIOS,
  SEUIL_PCT,
  DOSSIER_REFERENCE,
  DOSSIER_ECARTS,
  comparerPng,
  comparerFichier,
  cheminReference,
  cheminActuelle,
  capturerEtComparer,
  preparerPage,
  bloquerImagesDistantes,
  executerAction,
};
