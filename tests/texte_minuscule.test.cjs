/* ─────────────────────────────────────────────────────────────────────────────
   TEXTE MINUSCULE — aucune taille de police lisible sous 11 px

   Règle (tâche T05) :
     • aucun texte lisible ne descend sous 11 px ;
     • le texte courant et légal (pied de page : liens, copyright) fait au
       moins 12 px ;
     • exception : les initiales décoratives d'un monogramme (aria-hidden).

   Test statique : il lit les déclarations `font-size` écrites en px ou en rem
   dans les feuilles de style des pages. Les tailles en em ou en % dépendent
   du parent : elles sont mesurées dans le navigateur, pas ici.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

// Pages de l'accueil, du board et de la fiche d'offre : toutes leurs tailles
// écrites en px ou rem doivent être >= 11 px.
const PAGES_STRICTES = ['index.html', 'job-board.html', 'api/offre.js'];

// Pied de page, présent sur toutes les pages : ses tailles seulement.
const PAGES_AVEC_PIED = [
  'index.html', 'job-board.html', 'api/offre.js', 'a-propos.html', 'cgu.html',
  'contact.html', 'confidentialite.html', 'claim-entreprises.html',
  'claim-observatoire.html',
];

function enPx(valeur, unite) {
  return unite === 'rem' ? parseFloat(valeur) * 16 : parseFloat(valeur);
}

test('T05 — aucune taille de police (px ou rem) sous 11 px sur l\'accueil, le board et la fiche', () => {
  for (const f of PAGES_STRICTES) {
    const trop = [];
    lire(f).split('\n').forEach((ligne, i) => {
      const re = /font-size\s*:\s*([0-9.]+)(px|rem)/g;
      let m;
      while ((m = re.exec(ligne))) {
        const px = enPx(m[1], m[2]);
        if (px < 11) trop.push(`${f}:${i + 1} ${m[1]}${m[2]} (${px.toFixed(1)} px)`);
      }
    });
    assert.deepEqual(trop, [], 'texte sous 11 px : ' + trop.join(' ; '));
  }
});

test('T05 — le pied de page (liens et copyright) fait au moins 12 px, sur toutes les pages', () => {
  for (const f of PAGES_AVEC_PIED) {
    const src = lire(f);
    const regles = src.match(/#ft \.ft-(?:links a|copy)\s*\{[^}]*\}/g) || [];
    assert.ok(regles.length >= 2, `${f} : règles du pied introuvables`);
    for (const regle of regles) {
      const m = /font-size\s*:\s*([0-9.]+)(px|rem)/.exec(regle);
      if (!m) continue; // règle de mise en page seule
      assert.ok(enPx(m[1], m[2]) >= 12,
        `${f} : « ${regle.slice(0, 40)}… » fait ${enPx(m[1], m[2])} px, il en faut 12`);
    }
  }
});

test('T05 — les étiquettes, compétences et dates de cartes font au moins 11 px', () => {
  for (const f of ['index.html', 'job-board.html']) {
    const src = lire(f);
    // T10 : les capitales `.tag` ont disparu ; la valeur d'une pastille et la ligne des
    // compétences prennent leur place, avec le même plancher de 11 px.
    for (const sel of ['\\.card-fact-value', '\\.ccomp', '(?:\\.oc )?\\.cdate']) {
      const re = new RegExp('(?:^|\\n)\\s*' + sel + '\\s*\\{[^}]*?font-size\\s*:\\s*([0-9.]+)px', 'g');
      let m; let trouve = 0;
      while ((m = re.exec(src))) { trouve++; assert.ok(+m[1] >= 11, `${f} ${sel} : ${m[1]} px`); }
      assert.ok(trouve >= 1, `${f} : règle ${sel} introuvable`);
    }
  }
});
