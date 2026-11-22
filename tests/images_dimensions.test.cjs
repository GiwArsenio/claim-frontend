/* ──────────────────────────────────────────────────────────────
   DIMENSIONS D'IMAGES — toute balise <img> déclare width et height.

   Sans ces deux attributs, le navigateur ne sait pas quelle place réserver
   avant que l'image arrive : la page saute au chargement (CLS). Ce fichier
   ne touche ni au réseau ni au navigateur : il lit le code source.

   Il regarde deux endroits : les fichiers *.html, et les gabarits écrits
   dans le JavaScript (chaînes concaténées ou gabarits littéraux), qui
   fabriquent des <img> à la volée — logos des cartes, des employeurs, des
   fiches d'offre.
   ────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

/* Fichiers examinés. `public/` est une copie générée : seul `public/404.html`
   y est suivi par git, il est donc le seul à examiner. */
function fichiersAExaminer() {
  const liste = [];
  for (const f of fs.readdirSync(RACINE)) {
    if (f.endsWith('.html')) liste.push(f);
  }
  liste.push('public/404.html');
  for (const dossier of ['api', 'src', 'assets']) {
    const base = path.join(RACINE, dossier);
    const parcourir = (rel) => {
      for (const e of fs.readdirSync(path.join(RACINE, rel), { withFileTypes: true })) {
        const chemin = path.join(rel, e.name);
        if (e.isDirectory()) parcourir(chemin);
        /* Les fichiers cachés sont des copies temporaires du serveur de test. */
        else if (e.name.endsWith('.js') && !e.name.startsWith('.')) liste.push(chemin);
      }
    };
    if (fs.existsSync(base)) parcourir(dossier);
  }
  return liste.filter((f) => fs.existsSync(path.join(RACINE, f)));
}

/* Retire les commentaires : un <img> cité dans une explication n'en est pas un. */
function sansCommentaires(src, estHtml) {
  let s = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  if (!estHtml) {
    s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    s = s.replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, avant) => avant + ' '.repeat(m.length - avant.length));
  }
  return s;
}

/* Toutes les balises <img> d'un texte : de « <img » au premier « > » qui ne
   fait pas partie d'une flèche (=>). Les gabarits JS coupent la balise en
   plusieurs chaînes (« ' + ' ») : la fenêtre les contient, ce qui suffit pour
   chercher les attributs. */
function balisesImg(src, estHtml) {
  const texte = sansCommentaires(src, estHtml);
  const trouvees = [];
  const re = /<img\b/gi;
  let m;
  while ((m = re.exec(texte))) {
    let fin = m.index;
    while (fin < texte.length) {
      fin = texte.indexOf('>', fin + 1);
      if (fin === -1) { fin = texte.length; break; }
      if (texte[fin - 1] !== '=') break;
    }
    const balise = texte.slice(m.index, fin + 1);
    const ligne = texte.slice(0, m.index).split('\n').length;
    trouvees.push({ balise, ligne });
  }
  return trouvees;
}

const aUnAttribut = (balise, nom) => new RegExp(`[\\s'"\`]${nom}\\s*=`, 'i').test(balise);

const TOUTES = [];
for (const f of fichiersAExaminer()) {
  const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
  for (const b of balisesImg(src, f.endsWith('.html'))) TOUTES.push({ fichier: f, ...b });
}

test('A — le scanner voit bien les images (vignettes de villes et gabarits JS)', () => {
  const dansHtml = TOUTES.filter((b) => b.fichier.endsWith('.html'));
  const dansJs = TOUTES.filter((b) => b.fichier.endsWith('.js'));
  assert.ok(dansHtml.length >= 8, `${dansHtml.length} <img> trouvés dans les .html, 8 attendus au moins (villes)`);
  assert.ok(dansJs.length >= 2, `${dansJs.length} <img> trouvés dans les gabarits JS : le scanner est aveugle`);
  for (const f of ['index.html', 'job-board.html', 'claim-entreprises.html', 'api/offre.js']) {
    assert.ok(TOUTES.some((b) => b.fichier === f), `aucune image vue dans ${f}`);
  }
});

test('B — toute balise <img> déclare width ET height', () => {
  const fautives = TOUTES
    .filter((b) => !aUnAttribut(b.balise, 'width') || !aUnAttribut(b.balise, 'height'))
    .map((b) => `${b.fichier}:${b.ligne}  ${b.balise.replace(/\s+/g, ' ').slice(0, 110)}`);
  assert.deepEqual(fautives, [], `<img> sans width/height (décalage de mise en page) :\n  ${fautives.join('\n  ')}`);
});

test('C — les dimensions des vignettes de villes sont celles du fichier JPEG', () => {
  /* Lit la taille naturelle dans l'en-tête JPEG (marqueur SOFn). Une valeur
     fausse ne casserait pas le rendu — le CSS force la taille — mais elle
     fausserait le rapport largeur/hauteur réservé avant le chargement. */
  function tailleJpeg(fichier) {
    const buf = fs.readFileSync(fichier);
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marqueur = buf[i + 1];
      if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    throw new Error(`pas d'en-tête SOF dans ${fichier}`);
  }
  const villes = TOUTES.filter((b) => b.fichier === 'index.html' && /src="\/assets\/villes\/[^"]+\.jpg"/.test(b.balise));
  assert.ok(villes.length >= 8, `${villes.length} vignettes de villes trouvées, 8 attendues`);
  for (const v of villes) {
    const jpg = v.balise.match(/src="(\/assets\/villes\/[^"]+\.jpg)"/)[1];
    const { w, h } = tailleJpeg(path.join(RACINE, jpg));
    assert.match(v.balise, new RegExp(`width="${w}"`), `${jpg} : width devrait valoir ${w}`);
    assert.match(v.balise, new RegExp(`height="${h}"`), `${jpg} : height devrait valoir ${h}`);
  }
});

test('D — aucune image paresseuse parmi celles du haut de la page d\'accueil', () => {
  /* Une image candidate au plus grand affichage (LCP) ne doit pas être
     paresseuse. Sur l'accueil, aucune image n'est avant le titre : toute
     image située avant la section des villes doit donc être sans « lazy ». */
  const src = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const limite = src.indexOf('class="villes"');
  assert.ok(limite > 0, 'section des villes introuvable');
  const avant = balisesImg(src.slice(0, limite), true);
  for (const b of avant) {
    assert.doesNotMatch(b.balise, /loading\s*=\s*["']lazy/i, `image du haut de page paresseuse : ${b.balise.slice(0, 80)}`);
  }
});
