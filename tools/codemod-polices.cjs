/* ─────────────────────────────────────────────────────────────────────────────
   CODEMOD — POLICES AUTO-HÉBERGÉES (tâche T09)

   Ce que fait ce script, dans chaque page du site :
     1. il RETIRE les lignes qui appellent Google Fonts
        (deux « preconnect » et la feuille de style Inter) ;
     2. il POSE à leur place le préchargement du fichier de police et la
        feuille /assets/polices.css (qui déclare Inter et sa police de repli) ;
     3. il ajoute 'Inter Fallback' juste après 'Inter' dans la pile de polices
        (font-family: 'Inter', ...) pour que le repli ait les mêmes
        proportions qu'Inter.

   Pages traitées : tous les *.html de la racine, public/404.html, le gabarit
   de la fiche d'offre (api/offre.js) et la feuille assets/monitoring.css (qui
   porte la pile de polices de monitoring.html).

   Règle : on ne pose la police QUE sur une page qui chargeait Inter chez
   Google (ou qui porte déjà polices.css). Une page qui n'appelait pas Inter
   (la fiche d'offre /offre/{slug} et la page de revue, qui utilisent la
   police du système) n'est pas modifiée : lui ajouter 66 Ko serait une
   régression, et la police de la fiche est volontairement celle du système.

   IDEMPOTENT : relancé sur un fichier déjà traité, il ne change rien. C'est
   ainsi qu'on résout un conflit après un rebase : on ne fusionne pas à la
   main, on relance le script.

   Usage :
     node tools/codemod-polices.cjs            applique
     node tools/codemod-polices.cjs --verifier  ne modifie rien ; sort en erreur
                                                s'il y aurait quelque chose à faire
   Après toute modification de api/offre.js : npm run aligner:rendu
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const VERIFIER = process.argv.includes('--verifier');

const FICHIER_POLICE = '/assets/polices/Inter-latin-variable.woff2';
const FEUILLE = '/assets/polices.css';

const PRELOAD = `<link rel="preload" href="${FICHIER_POLICE}" as="font" type="font/woff2" crossorigin/>`;
const LIEN_FEUILLE = `<link rel="stylesheet" href="${FEUILLE}"/>`;

/* Une ligne qui appelle Google Fonts : preconnect (googleapis / gstatic) ou
   feuille de style, avec ou sans « / » final, guillemets simples ou doubles. */
const LIGNE_GOOGLE = /^[ \t]*<link\b[^>]*\bhref=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>[ \t]*\r?\n/gm;
const GOOGLE_INTER = /<link\b[^>]*\bhref=["']https:\/\/fonts\.googleapis\.com\/css2\?[^"']*family=Inter\b/;

/* 'Inter', → 'Inter', 'Inter Fallback',  (déclaration font-family ou --police) */
const PILE = /((?:font-family|--police)\s*:\s*)'Inter'(\s*,)(?!\s*'Inter Fallback')/g;

function fichiersCibles() {
  const html = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html')).sort();
  return [...html, 'public/404.html', 'api/offre.js', 'assets/monitoring.css'];
}

function traiter(rel) {
  const chemin = path.join(RACINE, rel);
  if (!fs.existsSync(chemin)) return { rel, etat: 'absent' };
  const avant = fs.readFileSync(chemin, 'utf8');
  let texte = avant;

  const aGoogle = GOOGLE_INTER.test(texte);
  const aDeja = texte.includes(FEUILLE);
  const estPage = !rel.endsWith('.css');

  if (estPage) {
    /* 1 et 2 : retirer Google ; poser la police locale à la place de la
       première ligne retirée. */
    let premiere = true;
    texte = texte.replace(LIGNE_GOOGLE, (ligne) => {
      if (!premiere || (!aGoogle && !aDeja)) return '';
      premiere = false;
      if (aDeja) return '';
      const indent = ligne.match(/^[ \t]*/)[0];
      const eol = ligne.endsWith('\r\n') ? '\r\n' : '\n';
      return `${indent}${PRELOAD}${eol}${indent}${LIEN_FEUILLE}${eol}`;
    });
    /* Une page qui n'a plus de ligne Google mais avait déjà la feuille : rien
       d'autre à faire. Une page sans Google et sans feuille : intacte. */
  }

  /* 3 : pile de polices — seulement là où la feuille est (ou sera) présente. */
  const porteLaFeuille = texte.includes(FEUILLE);
  const feuilleCss = rel === 'assets/monitoring.css';
  if (porteLaFeuille || feuilleCss) {
    texte = texte.replace(PILE, "$1'Inter', 'Inter Fallback'$2");
  }

  if (texte === avant) return { rel, etat: 'inchangé' };
  if (!VERIFIER) fs.writeFileSync(chemin, texte);
  return { rel, etat: VERIFIER ? 'à modifier' : 'modifié' };
}

const resultats = fichiersCibles().map(traiter);
for (const r of resultats) {
  if (r.etat === 'inchangé') continue;
  console.log(`${r.etat.padEnd(10)} ${r.rel}`);
}
const nb = resultats.filter((r) => r.etat === 'modifié' || r.etat === 'à modifier').length;
console.log(nb === 0 ? 'Rien à faire : toutes les pages sont déjà à jour.' : `${nb} fichier(s) ${VERIFIER ? 'à mettre à jour' : 'mis à jour'}.`);
if (VERIFIER && nb > 0) process.exit(1);
