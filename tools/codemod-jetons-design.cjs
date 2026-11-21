#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   CODEMOD « JETONS DE DESIGN » — rayons de bordure et ombres.

   Pourquoi cet outil : le site avait dix rayons de bordure (dont des restes de
   conversions rem : 6,4 px, 10,4 px) et quatre à six ombres. Ce script ramène
   chaque valeur à l'échelle de assets/theme.css :

     rayons   --r-s (4 px) · --r-m (8 px) · --r-l (12 px)
              + deux formes hors échelle : 50 % (cercle) et 9999 px (pastille)
     ombres   --ombre-1 (posée) · --ombre-2 (flottante) · --ombre-forte (volet bas)

   Il est IDEMPOTENT : relancé sur un fichier déjà converti, il ne change rien.
   C'est ce qui permet de résoudre un conflit de fusion sans réfléchir : on
   garde un des deux côtés, on relance le script, les valeurs en dur qu'une
   autre branche aurait ajoutées sont ramenées à l'échelle.

   Usage
     node tools/codemod-jetons-design.cjs             applique aux fichiers
     node tools/codemod-jetons-design.cjs --verifier  ne change rien ; code 1 s'il
                                                      resterait quelque chose à faire
     node tools/codemod-jetons-design.cjs --fichier=index.html   un seul fichier

   Périmètre : index.html, job-board.html, assets/theme.css et les feuilles
   nouvelles de l'accueil (accueil-releve.css, accueil-pourquoi.css).
   Hors périmètre : monitoring.css, api/offre.js, les autres pages.

   Table des rayons (px = rem × 16)
     0, inherit, 50 %, 9999 px, var(--r-…)   inchangés
     999 px (ou toute valeur ≥ 100 px)       → 9999 px (même pastille, une seule valeur)
     ≤ 4 px  (2, 3, 4 ; .25rem) et 4.8 (.3rem) → var(--r-s)
     6, 6.4, 8 px (.375rem, .4rem, .5rem)    → var(--r-m)
     10, 10.4 px (.625rem)                   → var(--r-l)
     16, 17.6 px (1rem, 1.1rem : feuilles et fenêtres) → var(--r-l)
   Toute autre valeur (unité inconnue, valeur entre deux crans, p. ex. 5 ou 12 px
   en dur) est SIGNALÉE et fait échouer le script : elle demande un choix humain.

   Table des ombres : voir OMBRES plus bas. Une ombre inconnue est signalée.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const FICHIERS = [
  'index.html',
  'job-board.html',
  'assets/theme.css',
  'assets/accueil-releve.css',
  'assets/accueil-pourquoi.css',
];

/* ── Rayons ─────────────────────────────────────────────────────────────── */

/* Convertit une longueur en px, ou null si l'unité est inconnue. */
function enPx(valeur) {
  const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(valeur);
  if (!m) return null;
  return parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1);
}

/* Le jeton d'une longueur. Retourne { jeton } ou { erreur }. */
function jetonRayon(longueur) {
  if (longueur === '0' || longueur === 'inherit' || longueur === '50%' || longueur === '9999px') return { jeton: longueur };
  if (/^var\(--r-[sml]\)$/.test(longueur)) return { jeton: longueur };
  const px = enPx(longueur);
  if (px === null) return { erreur: `unité ou forme inconnue : « ${longueur} »` };
  if (px === 0) return { jeton: '0' };
  if (px >= 100) return { jeton: '9999px' };
  if (px <= 4 || px === 4.8) return { jeton: 'var(--r-s)' };
  if (px === 6 || px === 6.4 || px === 8) return { jeton: 'var(--r-m)' };
  if (px === 10 || px === 10.4 || px === 16 || px === 17.6) return { jeton: 'var(--r-l)' };
  return { erreur: `valeur hors table : « ${longueur} » (${px} px)` };
}

/* Convertit la valeur d'une déclaration border-radius (1 à 4 longueurs,
   éventuellement avec « / » : refusé, aucune n'existe dans le site). */
function convertirRayon(valeur) {
  const brut = valeur.trim().replace(/\s*!important\s*$/, '');
  const important = /!important\s*$/.test(valeur.trim()) ? ' !important' : '';
  /* var(--r-l, .625rem) : le repli est une valeur en dur de trop. */
  const sansRepli = brut.replace(/var\((--r-[sml])\s*,[^)]*\)/g, 'var($1)');
  if (sansRepli.includes('/')) return { erreur: `rayon elliptique non géré : « ${brut} »` };
  const morceaux = sansRepli.split(/\s+/);
  const sortie = [];
  for (const m of morceaux) {
    const r = jetonRayon(m);
    if (r.erreur) return { erreur: r.erreur };
    sortie.push(r.jeton);
  }
  return { valeur: sortie.join(' ') + important };
}

/* ── Ombres ─────────────────────────────────────────────────────────────── */

/* Forme canonique pour comparer : minuscules, espaces et zéros de tête
   normalisés (« 0.07 » = « .07 »). */
function canon(v) {
  return v.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\b0\.(\d)/g, '.$1')
    .replace(/\( /g, '(').replace(/ \)/g, ')');
}

const POSEE = 'var(--ombre-1)';
const FLOTTE = 'var(--ombre-2)';
const VOLET = 'var(--ombre-forte)';

/* Table exacte : valeur canonique → jeton. */
const OMBRES = new Map(Object.entries({
  // posées
  '0 1px 4px rgba(0,0,0,.07)': POSEE,                                          // barre de recherche
  '0 1px 2px rgba(25,44,52,.06),0 4px 14px rgba(25,44,52,.05)': POSEE,          // = l'ancien --ombre
  '0 2px 6px rgba(25,44,52,.08),0 5px 14px rgba(25,44,52,.04)': POSEE,          // carte au repos
  'var(--ombre)': POSEE,
  'var(--ombre-1)': POSEE,
  // flottantes
  '0 5px 16px rgba(25,44,52,.14)': FLOTTE,                                      // survol d'une carte
  '0 1px 6px rgba(0,0,0,.28)': FLOTTE,                                          // pastille du bandeau au survol
  '0 2px 10px rgba(0,0,0,.18)': FLOTTE,                                         // bouton au survol
  '0 10px 26px rgba(0,0,0,.22)': FLOTTE,                                        // liste déroulante
  '-4px 0 24px rgba(0,0,0,.18)': FLOTTE,                                        // tiroir latéral
  '0 24px 70px rgba(9,26,33,.32)': FLOTTE,                                      // fenêtre modale
  '0 26px 70px rgba(9,26,33,.34)': FLOTTE,                                      // fenêtre de filtres
  'var(--ombre-2)': FLOTTE,
  // volets collés au bas de l'écran
  '0 -14px 44px rgba(0,0,0,.34)': VOLET,
  '0 -18px 50px rgba(9,26,33,.28)': VOLET,
  'var(--ombre-forte)': VOLET,
  // anneau + ombre (carte sélectionnée / au focus) : l'anneau est gardé
  '0 0 0 3px rgba(0,104,118,.10),0 4px 12px rgba(25,44,52,.10)': '0 0 0 3px rgba(0, 104, 118, .10), var(--ombre-1)',
  '0 0 0 3px rgba(0,104,118,.16),0 5px 16px rgba(25,44,52,.14)': '0 0 0 3px rgba(0, 104, 118, .16), var(--ombre-2)',
  '0 0 0 3px rgba(0,104,118,.10),var(--ombre-1)': '0 0 0 3px rgba(0, 104, 118, .10), var(--ombre-1)',
  '0 0 0 3px rgba(0,104,118,.16),var(--ombre-2)': '0 0 0 3px rgba(0, 104, 118, .16), var(--ombre-2)',
  'none': 'none',
  'inherit': 'inherit',
}));

/* Ombres LAISSÉES EN L'ÉTAT, sciemment (voir tests/jetons_design.test.cjs).
   – le bandeau de consentement : exclu de la feuille de route (point 12) ;
   – le liséré de l'en-tête de fiche collé en haut : une ombre vers le bas, à
     rayon étalé négatif, qui n'est pas une élévation mais un trait de séparation. */
const LAISSEES = new Set([
  '0 -10px 30px rgba(25,44,52,.10)',
  '0 8px 12px -10px rgba(0,0,0,.28)',
]);

function convertirOmbre(valeur) {
  const brut = valeur.trim();
  /* Un repli en dur (« var(--ombre-1, var(--ombre)) » ou « var(--ombre, 0 1px 2px …) »)
     est une valeur en dur de trop : on ne garde que le jeton. */
  const sansRepli = brut
    .replace(/var\((--ombre(?:-[12]|-forte)?)\s*,\s*var\([^)]*\)\)/g, 'var($1)')
    .replace(/var\((--ombre(?:-[12]|-forte)?)\s*,(?:[^()]|\([^)]*\))*\)/g, 'var($1)');
  const c = canon(sansRepli);
  if (LAISSEES.has(c)) return { valeur: brut };
  if (OMBRES.has(c)) return { valeur: OMBRES.get(c) };
  return { erreur: `ombre hors table : « ${brut.replace(/\s+/g, ' ')} »` };
}

/* ── Application à un texte ─────────────────────────────────────────────── */

/* Une déclaration vit jusqu'au « ; » ou « } » (ou le guillemet d'un attribut
   style). Aucune valeur de ce site ne contient « ; » ou « } » en son sein. */
const RE_RAYON = /(border-radius\s*:\s*)([^;}"']+)/g;
const RE_OMBRE = /((?<![\w-])box-shadow\s*:\s*)([^;}"']+)/g;

function transformer(texte) {
  const erreurs = [];
  let changements = 0;
  const ligneDe = (index) => texte.slice(0, index).split('\n').length;

  function passe(re, convertir, nom) {
    texte = texte.replace(re, (tout, entete, valeur, index) => {
      const r = convertir(valeur);
      if (r.erreur) { erreurs.push({ ligne: ligneDe(index), nom, message: r.erreur }); return tout; }
      /* On garde les espaces de fin d'origine : le diff reste minimal. */
      const fin = /\s*$/.exec(valeur)[0];
      const nouveau = entete + r.valeur + fin;
      if (nouveau !== tout) changements++;
      return nouveau;
    });
  }
  passe(RE_RAYON, convertirRayon, 'border-radius');
  passe(RE_OMBRE, convertirOmbre, 'box-shadow');
  return { texte, changements, erreurs };
}

/* ── Programme ──────────────────────────────────────────────────────────── */

function main(argv) {
  const verifier = argv.includes('--verifier');
  const choix = argv.find((a) => a.startsWith('--fichier='));
  const cibles = choix ? [choix.slice('--fichier='.length)] : FICHIERS;
  let reste = 0;
  let ecrits = 0;
  let enErreur = 0;

  for (const rel of cibles) {
    const abs = path.join(RACINE, rel);
    if (!fs.existsSync(abs)) {
      console.log(`  ${rel} : absent, ignoré`);
      continue;
    }
    const avant = fs.readFileSync(abs, 'utf8');
    const { texte, changements, erreurs } = transformer(avant);
    for (const e of erreurs) {
      enErreur++;
      console.error(`  ${rel}:${e.ligne} ${e.nom} : ${e.message}`);
    }
    if (texte !== avant) {
      if (verifier) {
        reste += changements;
        console.log(`  ${rel} : ${changements} valeur(s) à convertir`);
      } else {
        fs.writeFileSync(abs, texte);
        ecrits++;
        console.log(`  ${rel} : ${changements} valeur(s) converties`);
      }
    } else {
      console.log(`  ${rel} : à jour`);
    }
  }

  if (enErreur) {
    console.error(`\n${enErreur} valeur(s) hors table : choisir un cran de l'échelle, puis compléter la table de ce script.`);
    return 2;
  }
  if (verifier && reste) {
    console.error(`\n${reste} valeur(s) restent à convertir : lancer « node tools/codemod-jetons-design.cjs ».`);
    return 1;
  }
  console.log(verifier ? '\nTout est à l’échelle.' : `\n${ecrits} fichier(s) modifié(s).`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { transformer, convertirRayon, convertirOmbre, FICHIERS };
