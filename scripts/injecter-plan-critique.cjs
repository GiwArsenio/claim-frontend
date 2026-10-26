#!/usr/bin/env node
/* CLAIM! — Injecte le CSS critique du plan dans les pages.
 *
 * Le CSS critique (assets/plan-critique.css) doit etre pose DANS le
 * <head>, AVANT le lien vers assets/theme.css : il porte le fond du
 * plan et le desactivation du rebond, sans dependre d'aucune variable
 * — il doit fonctionner avant que la feuille externe n'arrive.
 *
 * Pourquoi une injection plutot qu'une copie a la main dans chaque
 * page : huit pages, un seul emplacement du code, et rien qui puisse
 * diverger. Une page ajoutee ou oubliee est traitee comme les autres.
 *
 * Deux formes de page, deux formes d'injection :
 *   - les pages statiques : le <link> vers theme.css, qu'on precede
 *     d'un <style> contenant le CSS critique ;
 *   - la page d'offre, rendue par le Worker : le meme <link>, mais
 *     dans un gabarit JavaScript. Elle est traitee a part.
 *
 * Usage : node scripts/injecter-plan-critique.cjs [--offre]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(RACINE, 'assets', 'plan-critique.css'), 'utf8');

// Le marqueur qui permet de relancer le script sans rien dupliquer.
const MARQUEUR = '/* CSS CRITIQUE DU PLAN — injecte, ne pas modifier ici */';

const PAGES = [
  'index.html',
  'job-board.html',
  'claim-entreprises.html',
  'claim-observatoire.html',
  'a-propos.html',
  'cgu.html',
  'confidentialite.html',
  'contact.html',
  // La page d'erreur du Worker : elle est publiee telle quelle, elle a
  // donc besoin du meme plan que les autres.
  path.join('public', '404.html'),
];

const LIEN_THEME = '<link rel="stylesheet" href="/assets/theme.css">';

/* La page d'offre : le gabarit est du JavaScript, le <link> y est
 * ecrit avec des guillemets simples. */
const RENDU_OFFRE = path.join(RACINE, 'src', 'pages', '_offre-rendu.js');
/* Le gabarit de la page d'offre est du JavaScript, mais le <link> y
 * est ecrit avec des guillemets doubles : c'est du HTML pose dans un
 * gabarit, pas une chaine JavaScript. */
const LIEN_THEME_OFFRE = LIEN_THEME;

function blocStyle(css) {
  return '<style id="plan-critique">\n' + MARQUEUR + '\n' + css + '\n</style>\n';
}

/* ── Les pages statiques ───────────────────────────────────────────────── */
let traites = 0;
for (const nom of PAGES) {
  const P = path.join(RACINE, nom);
  let s = fs.readFileSync(P, 'utf8');

  // Si le bloc est deja present, on le remplace (le CSS a pu changer).
  const debut = s.indexOf(MARQUEUR);
  if (debut > 0) {
    const finStyle = s.indexOf('</style>', debut);
    const avant = s.slice(0, debut);
    // On remonte au <style> qui ouvre le bloc.
    const ouverture = avant.lastIndexOf('<style');
    const apres = s.slice(finStyle + '</style>'.length).replace(/^\s*\n/, '');
    s = avant.slice(0, ouverture) + apres;
  }

  const i = s.indexOf(LIEN_THEME);
  if (i < 0) {
    console.warn('  ATTENTION %s : pas de lien vers theme.css, page non traitee', nom);
    continue;
  }
  s = s.slice(0, i) + blocStyle(CSS) + s.slice(i);
  fs.writeFileSync(P, s, 'utf8');
  traites++;
}
console.log('  %d page(s) statique(s) traitee(s)', traites);

/* ── La page d'offre, rendue par le Worker ─────────────────────────────── */
if (fs.existsSync(RENDU_OFFRE)) {
  let s = fs.readFileSync(RENDU_OFFRE, 'utf8');
  const debut = s.indexOf(MARQUEUR);
  if (debut > 0) {
    const finStyle = s.indexOf('</style>', debut);
    const avant = s.slice(0, debut);
    const ouverture = avant.lastIndexOf('<style');
    const apres = s.slice(finStyle + '</style>'.length).replace(/^\s*\n/, '');
    s = avant.slice(0, ouverture) + apres;
  }
  const i = s.indexOf(LIEN_THEME_OFFRE);
  if (i < 0) {
    console.warn('  ATTENTION : la page d offre n’a pas de lien vers theme.css');
  } else {
    // Le gabarit est du JavaScript : le style est pose dans une chaine.
    // Le gabarit est une chaine de template : il faut echapper ce qui
    // a un sens dedans — les accents graves casseraient la chaine, et
    // un dollar declencherait une interpolation.
    const bloc = '<style id="plan-critique">\\n' + MARQUEUR + '\\n'
      + CSS.replace(/\\/g, '\\\\')
           .replace(/`/g, '\\`')
           .replace(/\$\{/g, '\\${')
           .replace(/\n/g, '\\n')
      + '\\n</style>\\n';
    s = s.slice(0, i) + bloc + s.slice(i);
    fs.writeFileSync(RENDU_OFFRE, s, 'utf8');
    console.log('  la page d’offre est traitee');
  }
}
