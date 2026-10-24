/* ─────────────────────────────────────────────────────────────────────────────
   RÉFÉRENTIEL DE L'EN-TÊTE ET DU PIED

   Deux références, deux origines :

   - L'EN-TÊTE est celui de l'ACCUEIL. C'est la page la plus visitée, et
     son en-tête porte un « Contactez-nous » qui est un vrai lien vers la
     page contact. Celui du board etait un simple bouton, sans action.

   - Le PIED est celui du BOARD. C'est le seul qui portait les quatre
     menus. Il est sorti de la colonne de liste du board — ou il etait
     cantonne a 419 px de large, a gauche, dans un ecran plein en deux
     colonnes — pour devenir un pied de page pleine largeur.

   Ce module expose les deux gabarits, et une fonction qui les pose sur
   une page. Les pages ne portent plus qu'une declaration de reference.

   Usage : node tools/referentiel-chrome.cjs
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

/* ── L'en-tête de référence : celui de l'accueil ──────────────────────────
   Le lien de la page courante porte la classe « on » : c'est lui qui dit
   a l'utilisateur ou il se trouve. */
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

/* ── Le pied de référence : celui du board ──────────────────────────────── */
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
          <!-- Contrepartie exigée par Hunter pour l'usage gratuit de son API. -->
          <span>Logos : <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a></span>
        </div>
      </footer>`;
}

/* ── Le CSS de référence ───────────────────────────────────────────────────
   Celui de l'accueil pour l'en-tete, celui du board pour le pied. Il est
   pose en un seul endroit, a la fin du bloc de style de chaque page : les
   regles plus specifiques ne peuvent pas l'annuler, et la regle
   identique sur les huit pages garantit l'identite.

   Le pied passe en pleine largeur. Sur le board, il sort de la colonne
   de liste : un pied cantonne a 419 px n'est pas un pied de page. */
const CSS_REFERENTIEL = `
  /* ══ RÉFÉRENTIEL — en-tête de l'accueil, pied du board ══
     Ces regles sont posees en fin de feuille : plus specifiques que
     celles du milieu de la page, elles ne peuvent pas etre annulees
     par elles. Et elles sont IDENTIQUES sur les huit pages, ce qui
     garantit que l'en-tete et le pied se ressemblent exactement. */

  /* ── En-tête (référence : l'accueil) ── */
  #hd { background: var(--teal-fond); position: sticky; top: 0; z-index: 200; }
  #hd nav { display: flex; justify-content: space-between; align-items: center;
            padding: .75rem 2rem; }
  #hd .logo { font-size: 1.5rem; font-weight: 900; color: var(--blanc);
              letter-spacing: -.05em; text-decoration: none; }
  #hd .logo:hover { color: var(--blanc-survol); }
  #hd .nav-links { display: flex; gap: 2rem; }
  #hd .nav-links a { color: rgba(255, 255, 255, .8); text-decoration: none;
                     font-size: .925rem; font-weight: 600; }
  #hd .nav-links a:hover { color: var(--blanc); }
  #hd .nav-links a.on { color: var(--blanc); border-bottom: 2px solid #fff; padding-bottom: 2px; }
  #hd .nav-links a.on:hover { color: var(--blanc); border-bottom-color: var(--blanc-survol); }
  #hd .btn-cta { background: var(--surface); color: var(--teal); padding: .45rem 1.2rem;
                 border-radius: .5rem; font-weight: 700; font-size: .925rem; border: none;
                 cursor: pointer; font-family: inherit; white-space: nowrap;
                 text-decoration: none; display: inline-block;
                 transition: background .15s, border-color .15s, color .15s; }
  #hd .btn-cta:hover { background: var(--teal-survol-element); border-color: var(--teal);
                       color: var(--encre); }
  #hd .btn-burger { display: none; flex-direction: column; justify-content: center; gap: 5px;
                     width: 36px; height: 36px; background: rgba(255, 255, 255, .15);
                     border: none; border-radius: .4rem; cursor: pointer;
                     padding: 7px 8px; flex-shrink: 0; }
  #hd .btn-burger span { display: block; height: 2px; background: var(--surface);
                         border-radius: 2px; transition: transform .25s, opacity .2s; }
  #hd .btn-burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  #hd .btn-burger.open span:nth-child(2) { opacity: 0; }
  #hd .btn-burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* ── Pied (référence : le board), en pleine largeur ── */
  #ft { flex-shrink: 0; background: var(--teal-fond); color: rgba(255,255,255,0.9);
        padding: 1.25rem 1.375rem 1rem; display: flex; flex-direction: column; gap: .75rem;
        border-top: 2px solid rgba(255,255,255,.1); }
  #ft .ft-top { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
  #ft .ft-logo { font-size: 1.1rem; font-weight: 900; color: var(--blanc);
                 letter-spacing: -.05em; text-decoration: none; }
  #ft .ft-logo:hover { color: var(--blanc-survol); }
  #ft .ft-tagline { font-size: 0.7rem; color: rgba(255,255,255,0.9); font-style: italic; margin-top: 1px; }
  #ft .ft-links { display: flex; gap: .625rem; flex-wrap: wrap; }
  #ft .ft-links a { color: rgba(255,255,255,0.9); text-decoration: none; font-size: 0.7rem;
                    font-weight: 500; padding: .2rem .5rem; border-radius: .25rem;
                    border: 1px solid rgba(255,255,255,.15); transition: background .15s, color .15s; }
  #ft .ft-links a:hover { background: var(--surbrillance); color: var(--blanc); }
  #ft .ft-divider { height: 1px; background: rgba(255,255,255,0.9); }
  #ft .ft-copy { font-size: 0.65rem; color: rgba(255,255,255,0.9); display: flex;
                 align-items: center; gap: .3rem; flex-wrap: wrap; }
  #ft .ft-copy .heart { color: var(--coeur); font-size: 0.75rem; }
  #ft .ft-copy a { color: rgba(255,255,255,0.9); text-decoration: none; }
  #ft .ft-copy a:hover { color: var(--blanc); text-decoration: underline; }

  @media (max-width: 768px) {
    #hd nav { padding: .6rem 1rem; }
    #hd .nav-links, #hd .btn-cta { display: none; }
    #hd .btn-burger { display: flex; }
    #ft { padding: .875rem 1rem .75rem; }
  }`;

/* ── La pose sur une page ───────────────────────────────────────────────── */
function poser(fichier, pageActive) {
  console.log('\n── ' + fichier + ' ──');
  const chemin = path.join(RACINE, fichier);
  let s = fs.readFileSync(chemin, 'utf8');

  /* 1. L'en-tête. */
  const debutHd = s.indexOf('<header id="hd">');
  if (debutHd !== -1) {
    const finHd = s.indexOf('</header>', debutHd) + '</header>'.length;
    s = s.slice(0, debutHd) + entete(pageActive) + s.slice(finHd);
    console.log('  en-tête posé');
  } else {
    console.log('  en-tête INTROUVABLE');
  }

  /* 2. Le pied. */
  const debutFt = s.indexOf('<footer id="ft">');
  if (debutFt !== -1) {
    const finFt = s.indexOf('</footer>', debutFt) + '</footer>'.length;
    s = s.slice(0, debutFt) + pied() + s.slice(finFt);
    console.log('  pied posé');
  } else {
    console.log('  pied INTROUVABLE');
  }

  /* 3. Le CSS de référentiel, pose en fin de feuille. */
  if (!s.includes('RÉFÉRENTIEL — en-tête de l\'accueil')) {
    const dernierStyle = s.lastIndexOf('</style>');
    if (dernierStyle !== -1) {
      s = s.slice(0, dernierStyle) + CSS_REFERENTIEL + '\n' + s.slice(dernierStyle);
      console.log('  CSS de référentiel posé');
    }
  } else {
    /* Il est deja la : on le remplace, pour qu'il reste a jour. */
    const debutCss = s.indexOf('  /* ══ RÉFÉRENTIEL');
    const finCss = s.indexOf('</style>', debutCss);
    s = s.slice(0, debutCss) + CSS_REFERENTIEL + '\n' + s.slice(finCss);
    console.log('  CSS de référentiel mis à jour');
  }

  fs.writeFileSync(chemin, s, 'utf8');
}

/* ── Les pages ──────────────────────────────────────────────────────────── */
poser('index.html', 'accueil');
poser('job-board.html', 'offres');
poser('claim-entreprises.html', 'entreprises');
poser('claim-observatoire.html', 'observatoire');
poser('a-propos.html', 'propos');
poser('cgu.html', 'cgu');
poser('confidentialite.html', 'confidentialite');
poser('contact.html', 'contact');

console.log('\nTerminé.');
