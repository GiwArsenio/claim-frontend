/* ─────────────────────────────────────────────────────────────────────────────
   CODEMOD — LIEN D'ÉVITEMENT « Aller au contenu »

   Pose, comme PREMIER enfant de <body>, un lien d'évitement :

       <a class="skip-link" href="#contenu">Aller au contenu</a>

   et s'assure que le contenu principal de la page peut le recevoir : le
   <main> (ou, à défaut, la zone principale) porte `id` et `tabindex="-1"`,
   ce qui permet de lui donner le focus au clavier sans le rendre tabulable.

   Fichiers traités
   - tous les `*.html` de la racine, sauf les EXCEPTIONS ci-dessous ;
   - `public/404.html` (suivi par git, non copié par prepare-assets.sh) ;
   - le gabarit de la fiche d'offre, dans `api/offre.js`. Après son passage,
     lancer `npm run aligner:rendu` : `src/pages/_offre-rendu.js` est généré.

   Idempotent : un fichier qui porte déjà le lien n'est pas retouché, un
   <main> qui porte déjà `id` et `tabindex` non plus. Relancer le script
   après un rebase ne produit donc AUCUN diff : c'est ainsi que se règlent
   les conflits avec les autres tâches (on ne résout pas à la main, on
   relance).

   Cibles par page
   - la plupart des pages : `<main>` reçoit `id="contenu"` ;
   - accueil : `<main id="contenu">` existe déjà, on ajoute `tabindex` ;
   - board (job-board.html) : `<main id="split">` — l'id `split` est lu par
     le CSS, le JS et les tests, on ne le change pas : le lien vise `#split` ;
   - pages « en construction » (claim-entreprises, claim-observatoire) : pas
     de <main> ; la zone principale est `<section class="chantier">`, qui
     reçoit `id="contenu"` et `tabindex="-1"`. (Envelopper cette section dans
     un <main> changerait la mise en page : hors périmètre.)

   Exceptions documentées (aucun lien posé, pour ne pas créer de lien mort
   ni sortir du périmètre) :
   - monitoring.html et claim-review.html : outils internes, `noindex`, qui
     ne chargent pas assets/theme.css (où vit le style `.skip-link`) ;
   - PAGE_ABSENTE dans api/offre.js : page d'erreur minimale, sans <main>.

   Usage :
       node tools/codemod-lien-evitement.cjs             écrit les fichiers
       node tools/codemod-lien-evitement.cjs --verifier   n'écrit rien ; sort
                                                          en erreur si un
                                                          fichier changerait
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const VERIFIER = process.argv.includes('--verifier');

/* Pages sans lien d'évitement, avec la raison (voir l'en-tête). */
const EXCEPTIONS = {
  'monitoring.html': 'outil interne noindex, sans assets/theme.css',
  'claim-review.html': 'outil interne noindex, sans assets/theme.css',
};

/* Pages dont la cible n'est pas #contenu. */
const CIBLES = {
  'job-board.html': 'split',
};

const TEXTE_LIEN = 'Aller au contenu';
const lienPour = (cible) => `<a class="skip-link" href="#${cible}">${TEXTE_LIEN}</a>`;

/* Position de l'ouverture de <body> :
   - une page complète : le premier <body …> APRÈS </head> (des commentaires
     ou des chaînes de script peuvent contenir le mot « <body> » plus haut) ;
   - le gabarit de api/offre.js : le dernier <body> AVANT le <main> de la
     fiche (le fichier contient aussi PAGE_ABSENTE, qu'on ne touche pas). */
function ouvertureBody(html, mode) {
  if (mode === 'gabarit') {
    const mMain = /<main\b[^>]*class="enveloppe"[^>]*>/.exec(html);
    if (!mMain) return null;
    const iMain = mMain.index;
    const i = html.lastIndexOf('<body>', iMain);
    return i < 0 ? null : { debut: i, fin: i + '<body>'.length };
  }
  const iHead = html.indexOf('</head>');
  if (iHead < 0) return null;
  const re = /<body(?:\s[^>]*)?>/g;
  re.lastIndex = iHead;
  const m = re.exec(html);
  return m ? { debut: m.index, fin: m.index + m[0].length } : null;
}

/* Ajoute `id` et `tabindex="-1"` à une balise ouvrante, sans rien changer
   d'autre. Rend la balise inchangée si tout y est déjà. */
function equiperCible(balise, cible) {
  let b = balise;
  if (!/\sid\s*=/.test(b)) b = b.replace(/^<(\w+)/, `<$1 id="${cible}"`);
  if (!/\stabindex\s*=/.test(b)) b = b.replace(/>$/, ' tabindex="-1">');
  return b;
}

function traiter(html, { cible, mode }) {
  let sortie = html;

  /* 1. La cible du lien. */
  const motifs = [
    mode === 'gabarit' ? /<main\b[^>]*class="enveloppe"[^>]*>/ : null,
    cible === 'split' ? /<main\b[^>]*\bid="split"[^>]*>/ : null,
    /<main\b[^>]*>/,
    /<section\b[^>]*class="chantier"[^>]*>/,
  ].filter(Boolean);
  let trouve = false;
  for (const re of motifs) {
    /* On cherche après </head> : un <main> dans un commentaire de style
       ne doit pas être pris pour la page. Le gabarit n'a pas de </head>
       à cet endroit : on part alors du <body> trouvé plus bas. */
    const debut = mode === 'gabarit' ? 0 : Math.max(0, sortie.indexOf('</head>'));
    const m = re.exec(sortie.slice(debut));
    if (!m) continue;
    const i = debut + m.index;
    const neuve = equiperCible(m[0], cible);
    sortie = sortie.slice(0, i) + neuve + sortie.slice(i + m[0].length);
    trouve = true;
    break;
  }
  if (!trouve) throw new Error('aucune zone principale trouvée (<main> ou section.chantier)');

  /* 2. Le lien lui-même, premier enfant de <body>. */
  if (!sortie.includes('class="skip-link"')) {
    const o = ouvertureBody(sortie, mode);
    if (!o) throw new Error('ouverture de <body> introuvable');
    const suite = sortie.slice(o.fin);
    const saut = suite.startsWith('\n') ? '' : '\n';
    sortie = sortie.slice(0, o.fin) + '\n' + lienPour(cible) + saut + suite;
  }
  return sortie;
}

/* La cible d'une page déjà équipée est lue dans son lien, pas redevinée. */
function fichiers() {
  const liste = [];
  for (const nom of fs.readdirSync(RACINE).sort()) {
    if (!nom.endsWith('.html')) continue;
    if (EXCEPTIONS[nom]) continue;
    liste.push({ chemin: nom, cible: CIBLES[nom] || 'contenu', mode: 'page' });
  }
  liste.push({ chemin: 'public/404.html', cible: 'contenu', mode: 'page' });
  liste.push({ chemin: 'api/offre.js', cible: 'contenu', mode: 'gabarit' });
  return liste;
}

/* Deux temps : on calcule tout, puis on écrit. Une erreur sur un fichier
   ne laisse donc pas le dépôt à moitié modifié. */
const travaux = [];
for (const f of fichiers()) {
  const complet = path.join(RACINE, f.chemin);
  const avant = fs.readFileSync(complet, 'utf8');
  let apres;
  try {
    apres = traiter(avant, f);
  } catch (e) {
    console.error(`✘ ${f.chemin} : ${e.message}`);
    process.exit(1);
  }
  travaux.push({ f, complet, avant, apres });
}

let aChanger = 0;
for (const { f, complet, avant, apres } of travaux) {
  if (apres === avant) {
    console.log(`= ${f.chemin}`);
    continue;
  }
  aChanger++;
  if (VERIFIER) {
    console.log(`≠ ${f.chemin} (changerait)`);
  } else {
    fs.writeFileSync(complet, apres);
    console.log(`+ ${f.chemin}`);
  }
}
for (const [nom, raison] of Object.entries(EXCEPTIONS)) console.log(`· ${nom} : exception (${raison})`);

if (VERIFIER && aChanger) {
  console.error(`✘ ${aChanger} fichier(s) à mettre à jour : lancer node tools/codemod-lien-evitement.cjs`);
  process.exit(1);
}
