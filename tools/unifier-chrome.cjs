/* ─────────────────────────────────────────────────────────────────────────────
   UNIFICATION DE L'EN-TÊTE ET DU PIED DE PAGE

   Le board (/job-board.html) est la référence : en-tête collant sur l'aplat
   de marque, pied navy complet avec ses quatre liens, tiroir mobile qui
   porte les mentions.

   Les trois autres pages avaient chacune leur version :
   - l'accueil : un en-tête `<header class="hd">` et un pied clair `<footer
     class="pied">`, sans les quatre liens ;
   - les pages Entreprises et Observatoire : un en-tête en `<div id="hd">`,
     et un pied `#ft` aux liens vides (`href="#"`).

   Ce script aligne les trois sur le board. Il travaille par REMPLACEMENT
   DE BLOCS, par offsets : on ne reconstruit pas le fichier HTML. Un
   fichier reconstruit à partir d'un gabarit perd ce que le gabarit ne
   sait pas — ici, tout le travail d'une page.

   Ce que le script corrige au passage :
   - le logo du pied devient un LIEN vers l'accueil (c'était du texte) ;
   - les quatre liens du pied pointent vers les pages réelles ;
   - le tiroir mobile porte les mentions, elles aussi en lien ;
   - le bouton « Contactez-nous » devient un lien vers la page contact :
     il le était sur l'accueil par un défilement, et il ne l'était nulle
     part ailleurs.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

/* ── L'en-tête de référence ─────────────────────────────────────────────── */
function entete(pageActive) {
  const liens = [
    { href: '/job-board.html', texte: "Offres d'emploi", on: pageActive === 'offres' },
    { href: '/claim-entreprises.html', texte: 'Entreprises', on: pageActive === 'entreprises' },
    { href: '/claim-observatoire.html', texte: "Observatoire de l'assurance", on: pageActive === 'observatoire' },
  ];
  const items = liens.map((l) =>
    `        <a href="${l.href}"${l.on ? ' class="on"' : ''}>${l.texte}</a>`
  ).join('\n');

  return `<header id="hd">
    <nav>
      <div style="display:flex;align-items:center;gap:2.5rem;">
        <a class="logo" href="/">Claim!</a>
        <div class="nav-links">
${items}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.75rem;">
        <a class="btn-cta" href="/contact.html">Contactez-nous</a>
        <button class="btn-burger" id="btn-burger" onclick="toggleBurger()" aria-label="Menu" aria-expanded="false" aria-controls="burger-menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  </header>`;
}

/* ── Le pied de référence ───────────────────────────────────────────────── */
function pied() {
  return `<footer id="ft">
    <div class="ft-top">
      <div>
        <a class="ft-logo" href="/">Claim!</a>
        <div class="ft-tagline">pour les actuaires, data scientists &amp; profils IA</div>
      </div>
      <div class="ft-links">
        <a href="/a-propos.html">À propos</a>
        <a href="/cgu.html">CGU</a>
        <a href="/confidentialite.html">Confidentialité</a>
        <a href="/contact.html">Contact</a>
      </div>
    </div>
    <div class="ft-divider"></div>
    <div class="ft-copy">
      <span>© 2026 Claim your job</span>
      <span>·</span>
      <span>Fait avec <span class="heart">♥</span> pour les experts du risque assurantiel</span>
      <span>·</span>
      <span>Logos : <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a></span>
    </div>
  </footer>`;
}

/* ── Le tiroir mobile ───────────────────────────────────────────────────── */
function tiroir(pageActive) {
  const liens = [
    { href: '/', icone: 'home', texte: 'Accueil', on: pageActive === 'accueil' },
    { href: '/job-board.html', icone: 'work', texte: "Offres d'emploi", on: pageActive === 'offres' },
    { href: '/claim-entreprises.html', icone: 'business', texte: 'Entreprises', on: pageActive === 'entreprises' },
    { href: '/claim-observatoire.html', icone: 'bar_chart', texte: "Observatoire de l'assurance", on: pageActive === 'observatoire' },
  ];
  const items = liens.map((l) =>
    `        <a href="${l.href}"${l.on ? ' class="on"' : ''} onclick="closeBurger()"><span class="ms">${l.icone}</span>${l.texte}</a>`
  ).join('\n');

  return `<div id="burger-menu">
    <div class="bm-overlay" onclick="closeBurger()"></div>
    <div class="bm-panel">
      <div class="bm-head">
        <a class="bm-logo" href="/" onclick="closeBurger()">Claim!</a>
        <button class="bm-close" onclick="closeBurger()" aria-label="Fermer le menu">
          <span class="ms">close</span>
        </button>
      </div>
      <nav class="bm-nav" aria-label="Navigation principale">
${items}
      </nav>
      <div class="bm-footer">
        <a class="btn-cta" href="/contact.html" onclick="closeBurger()">Contactez-nous</a>
        <div class="bm-mentions">
          <a href="/a-propos.html" onclick="closeBurger()">À propos</a>
          <a href="/cgu.html" onclick="closeBurger()">CGU</a>
          <a href="/confidentialite.html" onclick="closeBurger()">Confidentialité</a>
        </div>
      </div>
    </div>
  </div>`;
}

/* ── Remplacement d'un bloc par offsets ──────────────────────────────────── */
function remplacerBloc(source, debut, fin, remplacement, libelle) {
  const i = source.indexOf(debut);
  if (i === -1) { console.log('  INTROUVABLE  ' + libelle); return source; }
  const j = source.indexOf(fin, i);
  if (j === -1) { console.log('  FIN INTROUVABLE  ' + libelle); return source; }
  const sortie = source.slice(0, i) + remplacement + source.slice(j + fin.length);
  console.log('  remplacé  ' + libelle);
  return sortie;
}

/* ── Le CSS commun, celui du board ──────────────────────────────────────── */
const CSS_COMMUN = `
  /* ══ EN-TÊTE ET PIED — alignés sur le board ══ */
  #hd { background: var(--teal-fond); position: sticky; top: 0; z-index: 200; }
  #hd nav { display: flex; justify-content: space-between; align-items: center; padding: .75rem 2rem; }
  #ft { background: var(--teal-fond); color: rgba(255,255,255,.65);
        padding: 1.25rem 1.375rem 1rem; display: flex; flex-direction: column; gap: .75rem;
        border-top: 2px solid rgba(255,255,255,.1); }
  #ft .ft-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  #ft .ft-logo { font-size: 1.1rem; font-weight: 900; color: var(--blanc); letter-spacing: -.05em; text-decoration: none; }
  #ft .ft-logo:hover { color: var(--blanc-survol); }
  #ft .ft-tagline { font-size: 0.7rem; color: rgba(255,255,255,.5); font-style: italic; margin-top: 1px; }
  #ft .ft-links { display: flex; gap: .625rem; flex-wrap: wrap; }
  #ft .ft-links a { color: rgba(255,255,255,.6); text-decoration: none; font-size: 0.7rem; font-weight: 500;
                    padding: .2rem .5rem; border-radius: .25rem; border: 1px solid rgba(255,255,255,.15);
                    transition: background .15s, color .15s; }
  #ft .ft-links a:hover { background: var(--surbrillance); color: var(--blanc); }
  #ft .ft-divider { height: 1px; background: rgba(255,255,255,.1); }
  #ft .ft-copy { font-size: 0.65rem; color: rgba(255,255,255,.35); display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; }
  #ft .ft-copy .heart { color: var(--coeur); font-size: 0.75rem; }
  #ft .ft-copy a { color: rgba(255,255,255,.6); text-decoration: none; }
  #ft .ft-copy a:hover { color: var(--blanc); text-decoration: underline; }
  .bm-logo:hover { color: var(--blanc-survol); }
  .bm-mentions { display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
  .bm-mentions a { color: rgba(255,255,255,.6); font-size: .75rem; text-decoration: none; }
  .bm-mentions a:hover { color: var(--blanc); text-decoration: underline; }
  @media (max-width: 768px) {
    #hd nav { padding: .6rem 1rem; }
    #ft { padding: .875rem 1rem .75rem; }
    /* Les liens du pied resteraient inaccessibles sur téléphone si on les
       masquait : c'est le seul endroit où l'on peut lire les mentions. */
    #ft .ft-links { display: flex; }
    #ft .ft-tagline { display: none; }
  }`;

/* ── Le traitement d'une page ───────────────────────────────────────────── */
function traiterPage(fichier, pageActive) {
  console.log('\n── ' + fichier + ' ──');
  let s = fs.readFileSync(path.join(RACINE, fichier), 'utf8');

  /* 1. L'en-tête : peu importe sa forme d'origine, on le remplace. */
  const enTeteAncien = /<(?:header|div)[^>]*\bid="hd"[^>]*>|<header[^>]*\bclass="hd"[^>]*>/;
  const mEnTete = s.match(enTeteAncien);
  if (mEnTete) {
    const debut = mEnTete.index;
    const balise = mEnTete[0].toLowerCase().startsWith('</') ? 'header' : mEnTete[0];
    const fin = balise.includes('header') ? '</header>' : '</div>';
    s = remplacerBloc(s, mEnTete[0], fin, entete(pageActive), 'en-tête');
  } else {
    console.log('  INTROUVABLE  en-tête');
  }

  /* 2. Le pied. */
  const mPied = s.match(/<footer[^>]*\bclass="pied"[^>]*>|<div[^>]*\bid="ft"[^>]*>/);
  if (mPied) {
    const debut = mPied.index;
    const balise = mPied[0].toLowerCase().startsWith('<footer') ? '</footer>' : '</div>';
    s = remplacerBloc(s, mPied[0], balise, pied(), 'pied de page');
  } else {
    console.log('  INTROUVABLE  pied de page');
  }

  /* 3. Le tiroir mobile : le logo devient un lien, les mentions s'ajoutent. */
  const mTiroir = s.match(/<span[^>]*\bclass="bm-logo"[^>]*>Claim!<\/span>/);
  if (mTiroir) {
    s = remplacerBloc(
      s, mTiroir[0], mTiroir[0],
      '<a class="bm-logo" href="/" onclick="closeBurger()">Claim!</a>',
      'logo du tiroir mobile (span → lien)'
    );
  }

  /* 4. Le tiroir : on ajoute les mentions sous le bouton de contact. */
  if (s.includes('class="bm-footer"') && !s.includes('bm-mentions')) {
    const mBmFooter = s.match(/<div[^>]*\bclass="bm-footer"[^>]*>([\s\S]*?)<\/div>/);
    if (mBmFooter) {
      const bloc = mBmFooter[0];
      const nouveau = bloc.replace(
        /<\/div>\s*$/,
        `<div class="bm-mentions">
          <a href="/a-propos.html" onclick="closeBurger()">À propos</a>
          <a href="/cgu.html" onclick="closeBurger()">CGU</a>
          <a href="/confidentialite.html" onclick="closeBurger()">Confidentialité</a>
        </div>
      </div>`
      );
      s = s.replace(bloc, nouveau);
      console.log('  ajouté      mentions du tiroir mobile');
    }
  }

  /* 5. Le CSS commun, ajouté à la fin du bloc de style existant. */
  if (!s.includes('EN-TÊTE ET PIED — alignés sur le board')) {
    const dernierStyle = s.lastIndexOf('</style>');
    if (dernierStyle !== -1) {
      s = s.slice(0, dernierStyle) + CSS_COMMUN + '\n' + s.slice(dernierStyle);
      console.log('  ajouté      CSS commun en-tête/pied');
    }
  }

  fs.writeFileSync(path.join(RACINE, fichier), s, 'utf8');
}

traiterPage('index.html', 'accueil');
traiterPage('claim-entreprises.html', 'entreprises');
traiterPage('claim-observatoire.html', 'observatoire');
console.log('\nTerminé.');
