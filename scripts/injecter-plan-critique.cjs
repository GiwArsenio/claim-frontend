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

/* Toutes les pages n'ont pas le meme plan. Le gabarit porte deux
 * marqueurs ; on les remplace par la couleur de la page, lue dans son
 * propre attribut style sur <html>.
 *
 *   --plan: var(--champ)  ->  jour #f3f4f5   nuit #12181b
 *   --plan: var(--fond)   ->  jour #fff      nuit #0f1416
 *
 * Mettre le meme repli partout fut l'erreur de la version precedente :
 * les pages du pied affichaient du gris la ou elles doivent etre
 * blanches. */
const PLANS = {
  'var(--champ)': { jour: '#f3f4f5', nuit: '#12181b' },
  'var(--fond)': { jour: '#fff', nuit: '#0f1416' },
};

function couleurDuPlan(source, defaut) {
  const m = /--plan:\s*(var\(--[a-z0-9-]+\))/.exec(source);
  const cle = m ? m[1].replace(/\s+/g, '') : null;
  return PLANS[cle] || defaut;
}

/* Le pied colle ne s'applique pas a l'accueil (son contenu est deja
 * plus long que l'ecran) ni au board (application a hauteur fixe, son
 * document ne defile pas). */
const SANS_PIED_COLLE = ['index.html', 'job-board.html', path.join('public', '404.html')];

function retirerPiedColle(css) {
  return css.replace(/\/\* __DEBUT_PIED_COLLE__ \*\/[\s\S]*?\/\* __FIN_PIED_COLLE__ \*\//g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function blocStyle(css, plan) {
  const rempli = css
    .replace(/__PLAN_JOUR__/g, plan.jour)
    .replace(/__PLAN_NUIT__/g, plan.nuit);
  return '<style id="plan-critique">\n' + MARQUEUR + '\n' + rempli + '\n</style>\n';
}

/* ── Les pages statiques ───────────────────────────────────────────────── */
let traites = 0;
const plans = [];
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
  const plan = couleurDuPlan(s, PLANS['var(--champ)']);
  const css = SANS_PIED_COLLE.includes(nom) ? retirerPiedColle(CSS) : CSS;
  s = s.slice(0, i) + blocStyle(css, plan) + s.slice(i);
  fs.writeFileSync(P, s, 'utf8');
  plans.push(nom + ' -> ' + plan.jour);
  traites++;
}
console.log('  %d page(s) statique(s) traitee(s)', traites);
for (const p of plans) console.log('    ' + p);

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
    const planOffre = couleurDuPlan(s, PLANS['var(--champ)']);
    const cssOffre = CSS
      .replace(/__PLAN_JOUR__/g, planOffre.jour)
      .replace(/__PLAN_NUIT__/g, planOffre.nuit);
    const bloc = '<style id="plan-critique">\\n' + MARQUEUR + '\\n'
      + cssOffre.replace(/\\/g, '\\\\')
           .replace(/`/g, '\\`')
           .replace(/\$\{/g, '\\${')
           .replace(/\n/g, '\\n')
      + '\\n</style>\\n';
    s = s.slice(0, i) + bloc + s.slice(i);
    fs.writeFileSync(RENDU_OFFRE, s, 'utf8');
    console.log('  la page d’offre est traitee');
  }
}
