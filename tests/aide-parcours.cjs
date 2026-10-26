/* ─────────────────────────────────────────────────────────────────────────────
   OUTILLAGE PARTAGE DES TESTS NAVIGATEUR

   Chaque suite de parcours a besoin du meme socle : un serveur local, un
   navigateur, une maniere de poser une panne, de lire un etat de l'interface.

   Ce socle est ici pour que chaque test dise ce qu'il verifie, et non comment
   il branche les cables. */
'use strict';

const { chromium } = require('playwright');

/* Le port est choisi par le systeme : chaque suite a le sien. Un port fixe
   faisait cohabiter deux suites, et la seconde parlait a la premiere — avec
   le code de la premiere, ce qui produit des echecs incomprehensibles. */
let PORT = Number(process.env.CLAIM_TEST_PORT || 0);
let BASE = '';

/* Les largeurs que la famille A05 impose. */
const LARGEURS = [360, 390, 768, 769, 1280, 1920];

/* Les formats usuels. */
const FORMATS = {
  bureau: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

/* ── Serveur ─────────────────────────────────────────────────────────────── */

let serveur = null;

async function demarrerServeur() {
  if (serveur) return serveur;
  const { serveur: s } = require('./serveur-test.cjs');
  await new Promise((resolve, reject) => {
    s.once('error', reject);
    s.listen(PORT, '127.0.0.1', resolve);
  });
  PORT = s.address().port;
  BASE = `http://127.0.0.1:${PORT}`;

  /* La fiche autonome (api/offre.js) appelle le backend : son module doit
     pointer vers le port reellement attribue, prepare apres l'ecoute. */
  const { preparerFicheAutonome } = require('./serveur-test.cjs');
  preparerFicheAutonome(PORT);

  serveur = s;
  return serveur;
}

async function arreterServeur() {
  if (!serveur) return;
  const aDemarrer = serveur;
  serveur = null;
  await new Promise((resolve) => aDemarrer.close(resolve));
}

/* ── Controle ────────────────────────────────────────────────────────────── */

async function controler(ordre) {
  if (!BASE) throw new Error('le serveur doit etre demarre avant de controler');
  const r = await fetch(`${BASE}/__controle__`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordre || {}),
  });
  return r.json();
}

async function reinitialiserControle() {
  await controler({ reset: true });
}

/* ── Navigateur ──────────────────────────────────────────────────────────── */

let navigateur = null;

async function demarrerNavigateur() {
  if (navigateur) return navigateur;
  navigateur = await chromium.launch();
  return navigateur;
}

async function arreterNavigateur() {
  if (!navigateur) return;
  await navigateur.close();
  navigateur = null;
}

/**
 * Sert la police Inter depuis le serveur de test local.
 *
 * Le site charge Inter depuis Google Fonts. Le reseau externe etant
 * coupe dans les suites locales, cette police n arrive jamais : le rendu
 * retombe sur la police systeme, qui n est pas la meme d une machine a
 * l autre. La hauteur de page change, et les captures de reference ne
 * sont plus comparables.
 *
 * On intercepte donc la requete vers Google Fonts et on la sert par le
 * serveur local. Le site n a pas a changer : seule la maniere de lui
 * fournir la police change. Le rendu devient identique partout, sur le
 * runner de GitHub comme en local.
 */
function servirPoliceInter(page, base) {
  return page.route('**/fonts.googleapis.com/**', async (route) => {
    /* Le site charge DEUX polices depuis Google Fonts : Inter pour le
     * texte, Material Symbols pour les icones. Il faut servir les deux :
     * les icones rendues avec une police de substitution n ont pas la
     * meme largeur, et la page change de hauteur. */
    const url = route.request().url();
    const symboles = url.includes('Material+Symbols') || url.includes('Material%20Symbols');

    const css = symboles
      ? `@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 100 700;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  font-display: block;
  src: url('${base}/tests/polices/MaterialSymbolsOutlined.woff2') format('woff2');
}`
      : `@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url('${base}/tests/polices/InterVariable.woff2') format('woff2');
}`;

    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: css,
    });
  });
}

/**
 * Bloque tout appel reseau hors du serveur local de test.
 *
 * La regle du catalogue (4.2) est explicite : le reseau externe est interdit
 * dans les suites locales. Un test qui joint la production ne verifie pas ce
 * que la production fait au moment du test : il verifie ce qu'elle faisait
 * quand le test a passe. Le blocage rend l'echec visible au lieu de le
 * masquer.
 *
 * On note les tentatives dans page.appelsExternes : un test peut alors
 * affirmer qu'aucune sortie n'a ete tentee.
 */
function installerGardeReseau(page, options = {}) {
  const autorises = options.autorises || [];
  const tentatives = [];

  page.appelsExternes = tentatives;

  page.route('**/*', async (route) => {
    const url = route.request().url();

    /* Les requetes vers le serveur local passent : c'est la source de verite. */
    if (url.startsWith(BASE)) return route.continue();

    /* Les domaines explicitement autorises passent, et restent traces. */
    if (autorises.some((d) => url.includes(d))) {
      tentatives.push({ url, autorise: true });
      return route.continue();
    }

    tentatives.push({ url, autorise: false });
    return route.abort('blockedbyclient');
  });

  return tentatives;
}

/**
 * Ouvre une page prete a etre testee.
 *
 * La base de l'API est injectee avant le chargement : les pages la lisent
 * depuis la globale CLAIM_API_BASE. Le backend simule repond donc a la place
 * de la production, et le test ne depend d'aucun service externe.
 */
async function ouvrirPage(format = FORMATS.bureau, options = {}) {
  const nav = await demarrerNavigateur();
  const ctx = await nav.newContext({
    viewport: format.viewport,
    isMobile: format.isMobile,
    hasTouch: format.hasTouch,
    deviceScaleFactor: format.isMobile ? 2 : 1,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: options.theme === 'nuit' ? 'dark' : 'light',
    reducedMotion: options.reducedMotion || 'no-preference',
  });

  // La globale porte la base complete de l'API, chemin compris : le front-end
  // y ajoute lui-meme '/jobs'. La valeur doit donc finir par '/api/v1'.
  if (!BASE) throw new Error('le serveur doit etre demarre avant d\'ouvrir une page');
  await ctx.addInitScript((base) => {
    window.CLAIM_API_BASE = base + '/api/v1';
  }, BASE);

  if (options.theme) {
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('claim-theme-v2', t); } catch (e) {}
    }, options.theme);
  }

  const page = await ctx.newPage();
  const erreurs = [];

  /* Une ressource bloquee par le garde produit une erreur console systeme :
     ce n'est pas une erreur du site, c'est le garde qui a fait son travail.
     On la distingue des vraies erreurs, sinon tout test qui verrait une
     police distante bloquerait le site. */
  const estBloquee = (texte) =>
    /ERR_BLOCKED_BY_CLIENT/.test(texte) ||
    (/Failed to load resource/.test(texte) &&
      /fonts\.googleapis|logos\.|gstatic|googletagmanager/.test(texte));

  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (estBloquee(m.text())) return;
    erreurs.push(m.text());
  });
  page.erreurs = erreurs;

  /* La police est servie par le serveur de test, meme quand le reseau
     est libre : c est elle qui rend le rendu reproductible d une
     machine a l autre. Elle est installee AVANT le garde reseau, qui
     laisse passer la base de toute facon. */
  await servirPoliceInter(page, BASE);

  /* Le reseau externe est coupe par defaut : une suite locale qui sort
     d'elle-meme doit echouer, pas dependre du monde. */
  if (options.reseau !== 'libre') {
    installerGardeReseau(page, { autorises: options.domainesAutorises || [] });
  }

  return { ctx, page };
}

/** Ouvre une page et attend qu'elle soit stable. */
async function ouvrirEtAttendre(url, format, options) {
  const { ctx, page } = await ouvrirPage(format, options);
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await attendre(page);
  return { ctx, page };
}

/**
 * Declenche une action et attend la reponse HTTP qui en decoule.
 *
 * Une attente fixe (1200 ms) n'est pas une preuve : sur une machine
 * chargee, la reponse arrive apres, et le test lit l'ecran d'avant. On
 * attend donc la reponse, puis on laisse le rendu se faire.
 */
async function avecReponse(page, predicat, action, timeout = 20000) {
  const promesse = page.waitForResponse(predicat, { timeout });
  await action();
  const reponse = await promesse;
  return reponse;
}

/**
 * Extrait le chemin d'une URL, qu'on donne sous forme de chaine ou
 * d'objet Response.
 *
 * Playwright passe un OBJET Response au predicat de waitForResponse, et une
 * simple chaine a une comparaison manuelle. Les deux doivent fonctionner :
 * une fonction qui n'accepte que la chaine renvoie toujours faux sur un
 * objet Response — et le test attend alors une reponse qui ne vient jamais.
 */
function cheminDeUrl(url) {
  const brut = (url && typeof url === 'object' && typeof url.url === 'function')
    ? url.url()
    : url;
  try { return new URL(brut).pathname; } catch (e) { return ''; }
}

/**
 * Le predicat qui identifie la reponse de LISTE du board.
 *
 * Le chemin doit finir exactement par '/jobs' ou '/jobs/search'. Une simple
 * recherche de '/api/v1/jobs' attrapait aussi les requetes de detail
 * ('/api/v1/jobs/{id}') que le survol declenche : le test attendait alors la
 * reponse d'une offre, et lisait l'ecran d'avant.
 */
function estListeDuBoard(url) {
  return /\/api\/v1\/jobs(\/search)?\/?$/.test(cheminDeUrl(url));
}

/** Le predicat qui identifie la reponse de DETAIL d'une offre. */
function estDetailDuBoard(url) {
  return /\/api\/v1\/jobs\/[^/]+$/.test(cheminDeUrl(url));
}

/**
 * Attend la fin du chargement initial de la liste.
 *
 * Sans cette attente, une action lancee trop tot est ecrasee par la
 * reponse du chargement : le test verrait un defaut de course plutot que
 * le comportement qu'il veut=eprouver.
 */
async function attendreChargementTermine(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.pl-hd');
    if (!el) return false;
    return /\d/.test(el.textContent || '');
  }, { timeout }).catch(() => {});
}

async function attendre(page, ms = 900) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}
  await page.waitForTimeout(ms);
}

/* ── Lectures de l'interface ─────────────────────────────────────────────── */

/** Le nombre de cartes d'offres affichees. */
async function compterCartes(page) {
  return page.locator('#feed .jc, #feed .oc, .feed .jc').count();
}

/** Le titre de la fiche affichee, ou une chaine vide. */
async function titreFiche(page) {
  const t = page.locator('#detail .dtitle, #detail h1, .dc h1');
  if (await t.count() === 0) return '';
  return (await t.first().innerText()).trim();
}

/**
 * Les identifiants des offres affichees, dans l'ordre.
 *
 * On lit le data-id de la carte, et non son titre : deux offres peuvent
 * legitimement porter le meme titre. Comparer les titres ferait crier
 * « doublon » sur des offres distinctes.
 */
async function identifiantsAffiches(page) {
  return page.evaluate(() => {
    const ids = [];
    for (const el of document.querySelectorAll('#feed .jc, #feed .oc')) {
      const id = el.getAttribute('data-id');
      if (id) { ids.push(id); continue; }
      const t = el.querySelector('.ctitle');
      ids.push(t ? t.textContent.trim() : '');
    }
    return ids;
  });
}

/** Le texte du compteur d'offres. */
async function compteurOffres(page) {
  const el = page.locator('.pl-hd');
  if (await el.count() === 0) return '';
  return (await el.first().innerText()).trim();
}

/** L'etat d'une URL : parametres presents. */
function parametresURL(url) {
  const p = new URL(url).searchParams;
  const o = {};
  for (const [k, v] of p) o[k] = v;
  return o;
}

/* ── Largeurs et affichage ───────────────────────────────────────────────── */

/**
 * Le format correspondant a une largeur donnee.
 *
 * Une largeur de 769 px est le premier pixel en mode bureau : c'est le
 * point de bascule de la grille. Elle est traitee comme un cas a part
 * entiere, car c'est la ou un media query oublie se voit.
 */
function formatPourLargeur(largeur, hauteur = 900) {
  const mobile = largeur < 768;
  return {
    viewport: { width: largeur, height: hauteur },
    isMobile: mobile,
    hasTouch: mobile,
    nom: `${largeur}px`,
  };
}

/* ── Exports ─────────────────────────────────────────────────────────────── */

module.exports = {
  /* BASE et PORT changent quand le serveur demarre : ce sont des getters,
     pas des valeurs figees au moment de l'export. */
  get BASE() { return BASE; },
  get PORT() { return PORT; },
  LARGEURS,
  FORMATS,
  demarrerServeur,
  arreterServeur,
  controler,
  reinitialiserControle,
  demarrerNavigateur,
  arreterNavigateur,
  ouvrirPage,
  ouvrirEtAttendre,
  installerGardeReseau,
  servirPoliceInter,
  attendre,
  attendreChargementTermine,
  avecReponse,
  cheminDeUrl,
  estListeDuBoard,
  estDetailDuBoard,
  compterCartes,
  titreFiche,
  identifiantsAffiches,
  compteurOffres,
  parametresURL,
  formatPourLargeur,
};
