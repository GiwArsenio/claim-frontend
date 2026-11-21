#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   AUDIT DESIGN — la mesure « avant / après » de la feuille de route design.

   Pourquoi cet outil : chaque tâche de design doit prouver son effet par des
   chiffres identiques d'une tâche à l'autre. Il mesure le site servi par le
   serveur de fixtures local (tests/serveur-test.cjs), jamais la production.

   Usage
     node tools/audit-design.cjs --json sortie.json          mesure et enregistre
     node tools/audit-design.cjs --json sortie.json --rapide  accueil@bureau seulement, sans les pannes
     node tools/audit-design.cjs --json sortie.json --scenarios=a-propos@bureau,accueil@mobile
                                                             quelques scénarios, sans les pannes
     node tools/audit-design.cjs --comparer avant.json apres.json
                                                             tableau avant / après / cible
     node tools/audit-design.cjs --comparer avant.json apres.json --detail
                                                             ajoute le détail par page

   Ce qui est mesuré (clé JSON, voir DEFINITIONS plus bas)
     accueil, board (liste, puis détail de l'offre actuaire-confirme-risques-non-vie),
     a-propos, à 1440×900 (« bureau ») et 390×844 (« mobile ») ; accueil et board
     aussi en thème nuit (contrastes) ; trois pages en panne simulée (erreurs).

   Conditions de mesure (identiques à chaque lancement)
     - réseau tiers bloqué (googleapis, gstatic, googletagmanager, clarity) ;
       les polices Google sont remplacées par Inter servie en local, comme dans
       les tests, pour que la mise en page soit stable d'une machine à l'autre ;
     - mouvement réduit demandé : pas d'animation qui fausserait une mesure.

   Exécution sur la machine d'agents : /home/user/outillage/tn.sh node tools/audit-design.cjs ...
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const VERSION_SCHEMA = 1;
const OFFRE_DETAIL = 'actuaire-confirme-risques-non-vie';
const BLOQUES = /googleapis|gstatic|googletagmanager|clarity/;
const POLICES_TIERCES = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fonts\.adobe\.com/;

const FORMATS = {
  bureau: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

/* Les scénarios de mesure : page × format × thème. */
const SCENARIOS = [
  { id: 'accueil@bureau', page: 'accueil', format: 'bureau' },
  { id: 'accueil@mobile', page: 'accueil', format: 'mobile' },
  { id: 'board-liste@bureau', page: 'board-liste', format: 'bureau' },
  { id: 'board-liste@mobile', page: 'board-liste', format: 'mobile' },
  { id: 'board-detail@bureau', page: 'board-detail', format: 'bureau' },
  { id: 'board-detail@mobile', page: 'board-detail', format: 'mobile' },
  { id: 'a-propos@bureau', page: 'a-propos', format: 'bureau' },
  { id: 'a-propos@mobile', page: 'a-propos', format: 'mobile' },
  { id: 'accueil@bureau-nuit', page: 'accueil', format: 'bureau', theme: 'nuit' },
  { id: 'board-liste@bureau-nuit', page: 'board-liste', format: 'bureau', theme: 'nuit' },
];

const URLS = {
  accueil: '/index.html',
  'board-liste': '/job-board.html',
  'board-detail': '/job-board.html',
  'a-propos': '/a-propos.html',
};

/* Pages pour la mesure des états d'erreur. */
const PAGES_ERREUR = ['accueil', 'board-liste', 'board-detail'];

/* ── Définitions et cibles ───────────────────────────────────────────────────
   `synthese` est la table lue par --comparer. Chaque ligne : comment on la
   calcule, et la cible (feuille de route §T15). Types de cible :
     egal   : doit valoir exactement `v`
     max    : doit être ≤ `v`
     min    : doit être ≥ `v`
     pas_regression : pas pire que « avant » (`sens` : 'bas' = plus petit est mieux) */
const DEFINITIONS = [
  { cle: 'contraste.min', def: 'plus petit rapport de contraste du texte (tous scénarios, jour et nuit)', cible: { type: 'pas_regression', sens: 'haut' }, libelle: 'sans régression' },
  { cle: 'contraste.min_gabarit', def: 'idem, par la méthode simplifiée des gabarits (opacité du texte ignorée), pour recouper la feuille de route', cible: null, libelle: 'information' },
  { cle: 'contraste.echecs', def: 'paires texte/fond sous le seuil (4,5 ; 3 pour le grand texte)', cible: { type: 'pas_regression', sens: 'bas' }, libelle: 'sans régression' },
  { cle: 'texte.min_px', def: 'plus petite taille de texte lisible (px)', cible: { type: 'min', v: 11 }, libelle: '≥ 11' },
  { cle: 'texte.sous_11px', def: 'éléments de texte lisible sous 11 px', cible: { type: 'egal', v: 0 }, libelle: '0' },
  { cle: 'texte.sous_12px_legal', def: 'texte légal (pied de page…) ou courant sous 12 px', cible: { type: 'egal', v: 0 }, libelle: '0' },
  { cle: 'images.total', def: 'images dans le DOM (4 pages, bureau)', cible: null, libelle: 'information' },
  { cle: 'images.sans_dimensions', def: 'images sans width et height (4 pages, bureau)', cible: { type: 'egal', v: 0 }, libelle: '0' },
  { cle: 'images.alt_vide_informatif', def: 'images à alt vide qui portent une information', cible: { type: 'egal', v: 0 }, libelle: '0' },
  { cle: 'a11y.lien_evitement', def: 'lien « Aller au contenu » présent sur toutes les pages', cible: { type: 'egal', v: true }, libelle: 'oui' },
  { cle: 'a11y.reperes_manquants', def: 'repères header/nav/main/footer absents (page:balise)', cible: { type: 'pas_regression', sens: 'bas' }, libelle: 'sans régression' },
  { cle: 'a11y.pages_h1_invalides', def: 'scénarios dont le nombre de h1 visibles n’est pas 1', cible: { type: 'pas_regression', sens: 'bas' }, libelle: 'sans régression' },
  { cle: 'a11y.focus_sans_indicateur', def: 'éléments focalisés au clavier sans contour ni ombre (12 tabulations/page)', cible: { type: 'pas_regression', sens: 'bas' }, libelle: 'sans régression' },
  { cle: 'a11y.axe_violations', def: 'violations axe-core (toutes pages)', cible: { type: 'pas_regression', sens: 'bas' }, libelle: 'sans régression' },
  { cle: 'tactile.principales_sous_44', def: 'Rechercher, bascule de thème, burger sous 44 px (mobile)', cible: { type: 'egal', v: 0 }, libelle: '0' },
  { cle: 'tactile.sous_44', def: 'toutes les cibles tactiles sous 44 px (mobile)', cible: null, libelle: 'information' },
  { cle: 'css.rayons_distincts', def: 'rayons de bordure distincts (accueil, bureau)', cible: { type: 'max', v: 6 }, libelle: '≤ 6' },
  { cle: 'css.ombres_distinctes', def: 'ombres distinctes (accueil, bureau)', cible: null, libelle: 'information' },
  { cle: 'reseau.requetes_polices_tierces', def: 'requêtes vers des polices tierces (accueil, bureau)', cible: { type: 'egal', v: 0 }, libelle: '0' },
  { cle: 'reseau.poids_polices_octets', def: 'octets de polices reçues du serveur local (hors substituts de test)', cible: { type: 'max', v: 120000 }, libelle: '≤ 120 Ko' },
  { cle: 'reseau.poids_images_octets', def: 'octets d’images reçues (accueil, bureau)', cible: null, libelle: 'information' },
  { cle: 'erreur.texte_anglais_visible', def: 'texte anglais ou technique visible pendant une panne', cible: { type: 'egal', v: false }, libelle: 'non' },
  { cle: 'erreur.chargement_et_erreur_simultanes', def: '« Chargement… » et un message d’erreur visibles en même temps', cible: { type: 'egal', v: false }, libelle: 'non' },
];

/* Clés que le fichier JSON doit contenir (vérifié par le test statique). */
const CLES_MESURE = {
  contraste: ['min', 'echecs'],
  texte: ['min_px', 'sous_11px', 'sous_12px_legal'],
  images: ['total', 'sans_dimensions', 'alt_vide_informatif'],
  a11y: ['lien_evitement', 'reperes', 'h1_count', 'focus_visible', 'axe_violations'],
  tactile: ['sous_44', 'principales_sous_44'],
  css: ['rayons_distincts', 'ombres_distinctes'],
  reseau: ['requetes_polices_tierces', 'poids_polices_octets', 'poids_images_octets'],
};

/* ── Mesure dans la page ─────────────────────────────────────────────────────
   Fonction sérialisée par Playwright : elle doit être autonome (aucune
   référence à l'extérieur). Retourne tout ce qui se lit dans le DOM. */
function mesureDansPage(options) {
  const mobile = !!(options && options.mobile);

  const lum = (c) => {
    const a = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };
  const parse = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const x = m[1].split(/[,/\s]+/).filter(Boolean).map(parseFloat);
    return { c: x.slice(0, 3), a: x.length > 3 ? x[3] : 1 };
  };
  const composer = (fg, bg) => fg.c.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
    }
    return true;
  };
  const masque = (el) => !!el.closest('[aria-hidden="true"]');
  const decrire = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).filter(Boolean) : [];
    return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
  };
  const extrait = (el, n) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, n || 32);

  /* Fond effectif : on compose les fonds translucides en remontant jusqu'à un
     fond opaque. `incertain` : une image ou un dégradé est dessous, le rapport
     n'est pas calculable (artefact de dégradé, exclu de la mesure). */
  const fondDe = (el) => {
    const couches = [];
    let incertain = false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { incertain = true; break; }
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) { couches.push(bg); if (bg.a >= 0.999) break; }
    }
    let base = [255, 255, 255];
    for (let i = couches.length - 1; i >= 0; i--) base = composer(couches[i], base);
    return { rgb: base, incertain };
  };

  const textes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const ignores = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'PATH']);
  const vusContraste = new Set();
  const echecs = [];
  const plusBas = [];
  let minRatio = Infinity;
  let minGabarit = Infinity;
  let ignoresDegrade = 0;
  let minPx = Infinity;
  const sous11 = [];
  const sous12 = [];
  const vus11 = new Set();
  const vus12 = new Set();

  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (el.nodeType !== 1 || ignores.has(el.tagName.toUpperCase())) continue;
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!direct || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const taille = parseFloat(cs.fontSize);
    const gras = parseInt(cs.fontWeight, 10) >= 700;
    const cache = masque(el);

    /* Tailles. Les éléments décoratifs (aria-hidden) ne comptent pas : ils ne
       sont pas lus. */
    if (!cache && taille > 0) {
      if (taille < minPx) minPx = taille;
      const cle = decrire(el) + '|' + taille;
      const legal = !!el.closest('footer, #ft, [class*="ft-"], [class*="legal"], [class*="copyright"]');
      const long = (el.textContent || '').trim().length >= 40;
      if (taille < 11 && !vus11.has(cle)) { vus11.add(cle); sous11.push({ el: decrire(el), txt: extrait(el), px: +taille.toFixed(2) }); }
      if (taille < 12 && (legal || long) && !vus12.has(cle)) { vus12.add(cle); sous12.push({ el: decrire(el), txt: extrait(el), px: +taille.toFixed(2), legal }); }
    }

    /* Contraste. */
    const fg = parse(cs.color);
    if (!fg) continue;
    const fond = fondDe(el);
    if (fond.incertain) { ignoresDegrade++; continue; }
    const avant = fg.a < 1 ? composer(fg, fond.rgb) : fg.c;
    const L1 = lum(avant);
    const L2 = lum(fond.rgb);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < minRatio) minRatio = ratio;
    /* Méthode des gabarits de la feuille de route (annexes/mesures.js), gardée pour
       recouper les valeurs « attendues » : l'opacité du texte est ignorée et le fond
       est le premier ancêtre au moins à moitié opaque. */
    let ancetre = el; let fondG = [255, 255, 255];
    for (; ancetre; ancetre = ancetre.parentElement) { const g = parse(getComputedStyle(ancetre).backgroundColor); if (g && g.a > 0.5) { fondG = g.c; break; } }
    const LG1 = lum(fg.c); const LG2 = lum(fondG);
    const ratioG = (Math.max(LG1, LG2) + 0.05) / (Math.min(LG1, LG2) + 0.05);
    if (ratioG < minGabarit) minGabarit = ratioG;
    plusBas.push({ el: decrire(el), txt: extrait(el, 24), ratio: +ratio.toFixed(2), px: +taille.toFixed(2) });
    const grand = taille >= 24 || (taille >= 18.66 && gras);
    const seuil = grand ? 3 : 4.5;
    if (ratio < seuil) {
      const k = decrire(el) + '|' + ratio.toFixed(2);
      if (!vusContraste.has(k)) { vusContraste.add(k); echecs.push({ el: decrire(el), txt: extrait(el), ratio: +ratio.toFixed(2), seuil, px: +taille.toFixed(2) }); }
    }
  }

  /* Images. */
  const imgs = [...document.images];
  const informatif = (img) => {
    if (img.getAttribute('alt') !== '' || masque(img) || /^(presentation|none)$/.test(img.getAttribute('role') || '')) return false;
    const lien = img.closest('a, button');
    if (lien) {
      const propre = (lien.textContent || '').trim() || lien.getAttribute('aria-label') || lien.getAttribute('title');
      return !propre;
    }
    return img.getBoundingClientRect().width >= 64;
  };
  const images = {
    total: imgs.length,
    sans_dimensions: imgs.filter((i) => !(i.getAttribute('width') && i.getAttribute('height'))).length,
    sans_alt: imgs.filter((i) => !i.hasAttribute('alt')).length,
    alt_vide: imgs.filter((i) => i.getAttribute('alt') === '').length,
    alt_vide_informatif: imgs.filter(informatif).length,
    lazy: imgs.filter((i) => i.loading === 'lazy').length,
    sans_dimensions_liste: imgs.filter((i) => !(i.getAttribute('width') && i.getAttribute('height')))
      .slice(0, 30).map((i) => (i.getAttribute('src') || '').slice(-48)),
  };

  /* Repères et titres. */
  const reperes = {};
  for (const t of ['header', 'nav', 'main', 'footer']) reperes[t] = document.querySelectorAll(t).length;
  const h1s = [...document.querySelectorAll('h1')].filter(visible).length;
  const lienEvitement = !!([...document.querySelectorAll('a[href^="#"]')].find((a) =>
    /skip/i.test(a.className) || /^\s*(aller|passer|acc[eé]der) (au|vers le|directement au) (contenu|principal)/i.test(a.textContent || '')));

  /* Cibles tactiles (mobile seulement). */
  let sous44 = [];
  let principales = [];
  if (mobile) {
    const interactifs = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab]')]
      .filter(visible);
    for (const el of interactifs) {
      const r = el.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) continue;
      /* Lien dans une phrase : exempté par WCAG 2.5.8. */
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement &&
          (el.parentElement.textContent || '').trim().length > (el.textContent || '').trim().length + 12) continue;
      const nom = (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.title || '').replace(/\s+/g, ' ').trim().slice(0, 28);
      const entree = { el: decrire(el), nom, w: Math.round(r.width), h: Math.round(r.height) };
      sous44.push(entree);
      const marque = (el.className && String(el.className)) + ' ' + nom;
      const rechercher = /btn-srch/.test(marque) || /^rechercher$/i.test(nom);
      const bascule = /bascule-theme/.test(marque) || (el.tagName === 'BUTTON' && /th[eè]me|mode (nuit|jour|sombre|clair)/i.test(nom));
      const burger = /bm-toggle|burger/.test(marque) || (el.tagName === 'BUTTON' && /^(ouvrir )?(le )?menu/i.test(nom));
      if (rechercher || bascule || burger) principales.push(entree);
    }
  }

  /* Rayons et ombres : tous les éléments du DOM. */
  const rayons = new Set();
  const ombres = new Set();
  document.querySelectorAll('*').forEach((e) => {
    const cs = getComputedStyle(e);
    if (cs.borderRadius && cs.borderRadius !== '0px') rayons.add(cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') ombres.add(cs.boxShadow);
  });

  return {
    contraste: {
      min: minRatio === Infinity ? null : +minRatio.toFixed(2),
      min_gabarit: minGabarit === Infinity ? null : +minGabarit.toFixed(2),
      echecs,
      plus_bas: plusBas.sort((a, b) => a.ratio - b.ratio).filter((x, i, t) => t.findIndex((y) => y.el === x.el && y.ratio === x.ratio) === i).slice(0, 5),
      ignores_degrade: ignoresDegrade,
    },
    texte: {
      min_px: minPx === Infinity ? null : +minPx.toFixed(2),
      sous_11px: sous11,
      sous_12px_legal: sous12,
    },
    images,
    a11y: { lien_evitement: lienEvitement, reperes, h1_count: h1s },
    tactile: { sous_44: sous44, principales_sous_44: principales },
    css: { rayons_distincts: rayons.size, ombres_distinctes: ombres.size, rayons: [...rayons].sort(), ombres: [...ombres].sort().map((o) => o.slice(0, 90)) },
  };
}

/* Texte visible d'une page, pour juger les états d'erreur. */
function texteVisibleDansPage() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
    }
    return true;
  };
  const morceaux = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !visible(el)) continue;
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (t) morceaux.push(t);
  }
  return morceaux;
}

/* Un texte est « anglais ou technique » s'il montre à l'utilisateur un message
   de navigateur ou de code. */
const RE_ANGLAIS = /failed to fetch|networkerror|typeerror|load failed|unexpected token|\bHTTP\s?\d{3}\b|\b(?:error|errors|undefined|exception|timeout|unavailable|not found|internal server)\b|\bnull\b/i;
const RE_CHARGEMENT = /chargement/i;
const RE_ERREUR = /erreur|indisponible|impossible|ne se charge|momentan[eé]ment|échou|echou|failed/i;

function jugerErreur(morceaux) {
  const anglais = morceaux.filter((t) => RE_ANGLAIS.test(t));
  const chargement = morceaux.filter((t) => RE_CHARGEMENT.test(t));
  const erreur = morceaux.filter((t) => RE_ERREUR.test(t) && !RE_CHARGEMENT.test(t));
  return {
    texte_anglais_visible: anglais.length > 0,
    chargement_et_erreur_simultanes: chargement.length > 0 && (erreur.length > 0 || anglais.length > 0),
    extraits_anglais: anglais.slice(0, 5).map((t) => t.slice(0, 80)),
    extraits_chargement: chargement.slice(0, 5).map((t) => t.slice(0, 80)),
    extraits_erreur: erreur.slice(0, 5).map((t) => t.slice(0, 80)),
  };
}

/* ── Exécution ───────────────────────────────────────────────────────────── */

async function demarrerServeur() {
  const serveurTest = require('../tests/serveur-test.cjs');
  await new Promise((resolve, reject) => {
    serveurTest.serveur.once('error', reject);
    serveurTest.serveur.listen(0, '127.0.0.1', resolve);
  });
  const port = serveurTest.serveur.address().port;
  return { serveur: serveurTest.serveur, base: `http://127.0.0.1:${port}` };
}

async function controler(base, ordre) {
  const r = await fetch(`${base}/__controle__`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ordre) });
  return r.json();
}

async function ouvrirContexte(navigateur, base, scenario) {
  const format = FORMATS[scenario.format];
  const ctx = await navigateur.newContext({
    viewport: format.viewport,
    isMobile: format.isMobile,
    hasTouch: format.hasTouch,
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: scenario.theme === 'nuit' ? 'dark' : 'light',
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript((api) => { window.CLAIM_API_BASE = api; }, base + '/api/v1');
  if (scenario.theme === 'nuit') {
    await ctx.addInitScript(() => { try { localStorage.setItem('claim-theme-v2', 'nuit'); } catch (e) { /* ignoré */ } });
  }
  return ctx;
}

/* Bloque le réseau tiers ; remplace les polices Google par Inter locale
   (comme tests/aide-parcours.cjs) pour une mise en page stable. */
async function brancherReseau(page, base, suivi) {
  page.on('request', (req) => {
    if (POLICES_TIERCES.test(req.url())) suivi.polices_tierces.push(req.url().slice(0, 100));
  });
  page.on('response', (rep) => {
    const type = rep.request().resourceType();
    const url = rep.url();
    if (!url.startsWith(base) || (type !== 'font' && type !== 'image')) return;
    if (url.includes('/tests/polices/')) return; /* substituts de test, pas du site */
    suivi.attente.push(rep.body().then((b) => { suivi[type === 'font' ? 'poids_polices' : 'poids_images'] += b.length; }).catch(() => {}));
  });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (/fonts\.googleapis\.com/.test(url)) {
      const symboles = /Material(\+|%20)Symbols/.test(url);
      const css = symboles
        ? `@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:100 700;font-display:block;src:url('${base}/tests/polices/MaterialSymbolsOutlined.woff2') format('woff2');}`
        : `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:block;src:url('${base}/tests/polices/InterVariable.woff2') format('woff2');}`;
      return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: css });
    }
    if (BLOQUES.test(url) || /^https?:/.test(url)) return route.abort('blockedbyclient');
    return route.continue();
  });
}

async function attendrePage(page, nom, base) {
  await page.goto(base + URLS[nom], { waitUntil: 'load', timeout: 30000 });
  if (nom === 'accueil') {
    await page.waitForFunction(() => {
      const c = document.getElementById('compte-offres');
      return !c || !/chargement/i.test(c.textContent || '');
    }, null, { timeout: 15000 }).catch(() => {});
  } else if (nom.startsWith('board')) {
    await page.waitForSelector('.jc', { timeout: 15000 });
    if (nom === 'board-detail') {
      await page.click(`.jc[data-slug="${OFFRE_DETAIL}"]`);
      await page.waitForSelector('.dtitle', { timeout: 15000 });
    }
  }
  /* Parcourt la page pour déclencher les révélations au défilement, puis revient en haut. */
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
}

async function mesurerFocus(page, tabulations) {
  await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  const foyers = [];
  for (let i = 0; i < tabulations; i++) {
    await page.keyboard.press('Tab');
    foyers.push(await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const contour = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const ombre = cs.boxShadow !== 'none';
      return { el: e.tagName.toLowerCase() + ':' + (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20), contour, ombre };
    }));
  }
  const reels = foyers.filter(Boolean);
  const sans = reels.filter((f) => !f.contour && !f.ombre).map((f) => f.el);
  return { tabulations, focalises: reels.length, avec_indicateur: reels.length - sans.length, sans_indicateur: sans };
}

async function injecterAxe(page) {
  const chemin = require.resolve('axe-core/axe.min.js', { paths: [RACINE] });
  await page.addScriptTag({ content: fs.readFileSync(chemin, 'utf8') });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, noeuds: v.nodes.length }));
  });
}

async function mesurerScenario(navigateur, base, scenario) {
  const ctx = await ouvrirContexte(navigateur, base, scenario);
  const page = await ctx.newPage();
  const suivi = { polices_tierces: [], poids_polices: 0, poids_images: 0, attente: [] };
  await brancherReseau(page, base, suivi);
  await controler(base, { reset: true });
  await attendrePage(page, scenario.page, base);

  const m = await page.evaluate(mesureDansPage, { mobile: scenario.format === 'mobile' });
  const focus = await mesurerFocus(page, 12);
  m.a11y.focus_visible = focus;
  let axe = [];
  try { axe = await injecterAxe(page); } catch (e) { axe = [{ id: 'axe-indisponible', impact: null, noeuds: 0, erreur: String(e.message || e).slice(0, 80) }]; }
  m.a11y.axe_violations = axe.reduce((s, v) => s + (v.id === 'axe-indisponible' ? 0 : v.noeuds), 0);
  m.a11y.axe_regles = axe;
  await Promise.all(suivi.attente);
  m.reseau = {
    requetes_polices_tierces: suivi.polices_tierces.length,
    polices_tierces: [...new Set(suivi.polices_tierces)].slice(0, 10),
    poids_polices_octets: suivi.poids_polices,
    poids_images_octets: suivi.poids_images,
  };
  await ctx.close();
  return m;
}

/* États d'erreur : deux pannes. « panne » = le serveur répond 500 (canal
   /__controle__) ; « reseau » = la requête n'aboutit pas (cas « Failed to
   fetch » de la production). */
async function mesurerErreur(navigateur, base, nomPage, variante) {
  const scenario = { page: nomPage, format: 'bureau' };
  const ctx = await ouvrirContexte(navigateur, base, scenario);
  const page = await ctx.newPage();
  const suivi = { polices_tierces: [], poids_polices: 0, poids_images: 0, attente: [] };
  await brancherReseau(page, base, suivi);
  await controler(base, { reset: true });

  if (nomPage === 'board-detail') {
    /* La liste charge normalement ; la fiche demandée n'y figure pas (lien direct,
       historique) : seul le détail peut l'apporter, et il est en panne. Quand la
       liste contient déjà l'offre, le board la dessine sans erreur : ce cas-là
       n'est pas un défaut. */
    const ID_HORS_LISTE = 'offre-hors-liste';
    await attendrePage(page, 'board-liste', base);
    if (variante === 'panne') await controler(base, { pannes: [`/jobs/${ID_HORS_LISTE}`] });
    else await page.route(`**/api/v1/jobs/${ID_HORS_LISTE}`, (r) => r.abort('failed'));
    await page.evaluate((id) => { renderDetail(id); }, ID_HORS_LISTE);
    await page.waitForTimeout(2500);
  } else {
    if (variante === 'panne') await controler(base, { pannes: ['/jobs', '/stats'] });
    else await page.route('**/api/v1/**', (r) => r.abort('failed'));
    await page.goto(base + URLS[nomPage], { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2500);
  }
  const morceaux = await page.evaluate(texteVisibleDansPage);
  await controler(base, { reset: true });
  await ctx.close();
  return jugerErreur(morceaux);
}

/* ── Synthèse ────────────────────────────────────────────────────────────── */

function synthetiser(scenarios, erreurs) {
  const tous = Object.entries(scenarios);
  const bureau = tous.filter(([id]) => /@bureau$/.test(id)).map(([, m]) => m);
  const mobile = tous.filter(([id]) => /@mobile$/.test(id)).map(([, m]) => m);
  const accueil = scenarios['accueil@bureau'];
  const min = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? Math.min(...v) : null; };
  const somme = (xs) => xs.reduce((s, x) => s + (x || 0), 0);
  const unique = (xs) => [...new Set(xs)];

  const reperesManquants = [];
  const h1Invalides = [];
  for (const [id, m] of tous) {
    for (const [balise, n] of Object.entries(m.a11y.reperes)) if (n === 0) reperesManquants.push(`${id}:${balise}`);
    if (m.a11y.h1_count !== 1) h1Invalides.push(id);
  }
  const erreursListe = Object.values(erreurs).flatMap((v) => Object.values(v));

  return {
    'contraste.min': min(tous.map(([, m]) => m.contraste.min)),
    'contraste.min_gabarit': min(tous.map(([, m]) => m.contraste.min_gabarit)),
    'contraste.echecs': somme(tous.map(([, m]) => m.contraste.echecs.length)),
    'texte.min_px': min(tous.map(([, m]) => m.texte.min_px)),
    'texte.sous_11px': unique(tous.flatMap(([, m]) => m.texte.sous_11px.map((t) => `${t.el} ${t.px}px`))).length,
    'texte.sous_12px_legal': unique(tous.flatMap(([, m]) => m.texte.sous_12px_legal.map((t) => `${t.el} ${t.px}px`))).length,
    'images.total': somme(bureau.map((m) => m.images.total)),
    'images.sans_dimensions': somme(bureau.map((m) => m.images.sans_dimensions)),
    'images.alt_vide_informatif': somme(bureau.map((m) => m.images.alt_vide_informatif)),
    'a11y.lien_evitement': tous.every(([, m]) => m.a11y.lien_evitement),
    'a11y.reperes_manquants': reperesManquants.length,
    'a11y.pages_h1_invalides': h1Invalides.length,
    'a11y.focus_sans_indicateur': somme(tous.map(([, m]) => m.a11y.focus_visible.sans_indicateur.length)),
    'a11y.axe_violations': somme(tous.map(([, m]) => m.a11y.axe_violations)),
    'tactile.principales_sous_44': unique(mobile.flatMap((m) => m.tactile.principales_sous_44.map((t) => `${t.el}|${t.nom}`))).length,
    'tactile.sous_44': unique(mobile.flatMap((m) => m.tactile.sous_44.map((t) => `${t.el}|${t.nom}`))).length,
    'css.rayons_distincts': accueil.css.rayons_distincts,
    'css.ombres_distinctes': accueil.css.ombres_distinctes,
    'reseau.requetes_polices_tierces': accueil.reseau.requetes_polices_tierces,
    'reseau.poids_polices_octets': accueil.reseau.poids_polices_octets,
    'reseau.poids_images_octets': accueil.reseau.poids_images_octets,
    'erreur.texte_anglais_visible': erreursListe.some((e) => e.texte_anglais_visible),
    'erreur.chargement_et_erreur_simultanes': erreursListe.some((e) => e.chargement_et_erreur_simultanes),
  };
}

async function mesurerTout(options = {}) {
  const { chromium } = require('playwright');
  const { serveur, base } = await demarrerServeur();
  const navigateur = await chromium.launch();
  const scenarios = {};
  const erreurs = {};
  try {
    const liste = options.scenarios ? SCENARIOS.filter((s) => options.scenarios.includes(s.id)) : SCENARIOS;
    for (const s of liste) {
      process.stderr.write(`  mesure ${s.id} ... `);
      scenarios[s.id] = await mesurerScenario(navigateur, base, s);
      process.stderr.write('ok\n');
    }
    if (!options.sansErreurs) {
      for (const nom of PAGES_ERREUR) {
        erreurs[nom] = {};
        for (const variante of ['panne', 'reseau']) {
          process.stderr.write(`  erreur ${nom} (${variante}) ... `);
          erreurs[nom][variante] = await mesurerErreur(navigateur, base, nom, variante);
          process.stderr.write('ok\n');
        }
      }
    }
  } finally {
    await navigateur.close();
    await new Promise((r) => serveur.close(r));
  }
  return {
    schema: VERSION_SCHEMA,
    outil: 'tools/audit-design.cjs',
    conditions: { bureau: '1440x900', mobile: '390x844', reseau_tiers: 'bloque', polices: 'Inter locale en substitut', mouvement: 'reduit', offre_detail: OFFRE_DETAIL },
    synthese: synthetiser(scenarios, erreurs),
    scenarios,
    erreurs,
  };
}

/* ── Comparaison ─────────────────────────────────────────────────────────── */

function formater(v) {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number' && !Number.isInteger(v)) return String(v);
  return String(v);
}

function statut(def, avant, apres) {
  const c = def.cible;
  if (!c) return 'info';
  if (apres === null || apres === undefined) return '?';
  const tests = [];
  if (c.type === 'egal') tests.push(apres === c.v);
  if (c.type === 'max') tests.push(apres <= c.v);
  if (c.type === 'min') tests.push(apres >= c.v);
  if (c.type === 'pas_regression' || c.aussi === 'pas_regression') {
    if (avant === null || avant === undefined) tests.push(true);
    else tests.push(c.sens === 'bas' ? apres <= avant : apres >= avant - 0.01);
  }
  return tests.every(Boolean) ? 'ok' : 'ECART';
}

function comparer(avant, apres, options = {}) {
  const lignes = DEFINITIONS.map((d) => {
    const a = avant.synthese ? avant.synthese[d.cle] : undefined;
    const b = apres.synthese ? apres.synthese[d.cle] : undefined;
    return { cle: d.cle, avant: a, apres: b, cible: d.libelle, statut: statut(d, a, b), change: JSON.stringify(a) !== JSON.stringify(b) };
  });
  const detail = [];
  if (options.detail) {
    for (const id of Object.keys(apres.scenarios || {})) {
      const x = (avant.scenarios || {})[id];
      const y = apres.scenarios[id];
      if (!x) { detail.push(`${id} : nouveau scénario`); continue; }
      const f = (s) => ({
        'contraste.min': s.contraste.min, 'contraste.echecs': s.contraste.echecs.length, 'texte.min_px': s.texte.min_px,
        'texte.sous_11px': s.texte.sous_11px.length, 'texte.sous_12px_legal': s.texte.sous_12px_legal.length,
        'images.total': s.images.total, 'images.sans_dimensions': s.images.sans_dimensions, 'a11y.lien_evitement': s.a11y.lien_evitement,
        'a11y.axe_violations': s.a11y.axe_violations, 'tactile.sous_44': s.tactile.sous_44.length,
        'css.rayons_distincts': s.css.rayons_distincts, 'css.ombres_distinctes': s.css.ombres_distinctes,
        'reseau.requetes_polices_tierces': s.reseau.requetes_polices_tierces, 'reseau.poids_polices_octets': s.reseau.poids_polices_octets,
      });
      const fx = f(x); const fy = f(y);
      for (const k of Object.keys(fy)) if (JSON.stringify(fx[k]) !== JSON.stringify(fy[k])) detail.push(`${id} · ${k} : ${formater(fx[k])} → ${formater(fy[k])}`);
    }
  }
  return { lignes, detail };
}

function afficherComparaison(res) {
  const largeur = (k, f) => Math.max(k.length, ...res.lignes.map((l) => f(l).length));
  const w1 = largeur('Métrique', (l) => l.cle);
  const w2 = largeur('Avant', (l) => formater(l.avant));
  const w3 = largeur('Après', (l) => formater(l.apres));
  const w4 = largeur('Cible', (l) => l.cible);
  const ligne = (a, b, c, d, e) => `${a.padEnd(w1)}  ${b.padStart(w2)}  ${c.padStart(w3)}  ${d.padEnd(w4)}  ${e}`;
  const sortie = [ligne('Métrique', 'Avant', 'Après', 'Cible', 'État'), ligne('-'.repeat(w1), '-'.repeat(w2), '-'.repeat(w3), '-'.repeat(w4), '-----')];
  for (const l of res.lignes) sortie.push(ligne(l.cle, formater(l.avant), formater(l.apres), l.cible, l.change ? `${l.statut} *` : l.statut));
  sortie.push('', '* = valeur modifiée par rapport à « avant ». ECART = cible non atteinte ou régression.');
  if (res.detail.length) sortie.push('', 'Détail par scénario (valeurs modifiées) :', ...res.detail.map((d) => '  ' + d));
  return sortie.join('\n');
}

/* ── Programme principal ─────────────────────────────────────────────────── */

async function main(argv) {
  const iJson = argv.indexOf('--json');
  const iComp = argv.indexOf('--comparer');
  if (iComp >= 0) {
    const [fa, fb] = [argv[iComp + 1], argv[iComp + 2]];
    if (!fa || !fb) { console.error('Usage : --comparer avant.json apres.json [--detail]'); return 2; }
    const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log(afficherComparaison(comparer(lire(fa), lire(fb), { detail: argv.includes('--detail') })));
    return 0;
  }
  if (iJson >= 0 && argv[iJson + 1]) {
    const sortie = argv[iJson + 1];
    const rapide = argv.includes('--rapide');
    const choix = argv.find((a) => a.startsWith('--scenarios='));
    const scenarios = choix ? choix.slice('--scenarios='.length).split(',') : (rapide ? ['accueil@bureau'] : null);
    const resultat = await mesurerTout({ sansErreurs: rapide || !!choix, scenarios });
    fs.writeFileSync(sortie, JSON.stringify(resultat, null, 1) + '\n');
    console.log(`Mesures écrites dans ${sortie}`);
    for (const [k, v] of Object.entries(resultat.synthese)) console.log(`  ${k} = ${formater(v)}`);
    return 0;
  }
  console.error('Usage :\n  node tools/audit-design.cjs --json sortie.json\n  node tools/audit-design.cjs --comparer avant.json apres.json [--detail]');
  return 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
}

module.exports = { mesureDansPage, texteVisibleDansPage, jugerErreur, synthetiser, comparer, afficherComparaison, statut, DEFINITIONS, CLES_MESURE, SCENARIOS, VERSION_SCHEMA, RE_ANGLAIS };
