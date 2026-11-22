/* La règle des lignes des cartes d'offre (assets/cartes-lignes.js).
   4 éléments au plus par ligne, 2 au moins ; 2 lignes au plus par bloc, 3 pour la carte ;
   priorité aux faits : s'ils prennent 2 lignes, les étiquettes n'en ont qu'une ; tout ce
   qui ne tient pas dans les étiquettes est dans « +N » (qui compte comme un élément). */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/cartes-lignes.js');

const faits = (n) => Array.from({ length: n }, (_, i) => ({ html: `<i>${i + 1}</i>` }));
const etiquettes = (n, fn) => Array.from({ length: n }, (_, i) => ({
  html: `<span class="etq">T${i + 1}</span>`, libelle: fn ? fn(i) : `T${i + 1}`,
}));

test('découpage en lignes : 1→1 … 4→4, 5→3+2, 6→3+3, 7→4+3, 8→4+4 ; plafond de 3 ou 2 : 4→2+2', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => L.tailles(n)),
    [[], [1], [2], [3], [4], [3, 2], [3, 3], [4, 3], [4, 4]]);
  assert.deepEqual(L.tailles(4, 3), [2, 2]);
  assert.deepEqual(L.tailles(4, 2), [2, 2]);
  assert.deepEqual(L.tailles(7, 3), [3, 2, 2]);
  assert.equal(L.valable(3, 2), false, '3 éléments à 2 par ligne laisseraient une ligne seule');
  assert.equal(L.valable(4, 2), true);
});

test('jamais une ligne de moins de 2 éléments (sauf s\'il n\'y en a qu\'un), jamais plus de 4', () => {
  for (let n = 2; n <= 24; n++) {
    for (const m of [4, 3, 2]) {
      if (!L.valable(n, m)) continue;
      const t = L.tailles(n, m);
      assert.equal(t.reduce((a, b) => a + b, 0), n);
      assert.ok(t.every((x) => x >= 2 && x <= m), `${n} éléments, ${m} au plus : ${t}`);
    }
  }
  assert.equal(L.html(L.repartir(faits(4)), 'x-l'), '<div class="x-l"><i>1</i><i>2</i><i>3</i><i>4</i></div>');
  assert.equal(L.html([], 'x-l'), '');
});

test('budget : les étiquettes ont 2 lignes si les faits en prennent 1, une seule s\'ils en prennent 2', () => {
  assert.deepEqual([0, 1, 2].map((r) => L.lignesEtiquettes(r)), [2, 2, 1]);
  // Jamais plus de 3 lignes au total, jamais plus de 2 par bloc.
  for (const r1 of [1, 2]) assert.ok(r1 + L.lignesEtiquettes(r1) <= L.MAX_LIGNES_CARTE);
});

test('étiquettes montrées : 2 lignes → 8 tiennent, au-delà 7 + « +N » ; 1 ligne → 4 tiennent, au-delà 3 + « +N »', () => {
  assert.deepEqual([1, 4, 5, 8, 9, 10, 30].map((n) => L.visibles(n, 2)), [1, 4, 5, 8, 7, 7, 7]);
  assert.deepEqual([1, 4, 5, 8, 30].map((n) => L.visibles(n, 1)), [1, 4, 3, 3, 3]);
});

test('bloc des étiquettes avant mesure : 1 à 8 → toutes ; 9 ou plus → 7 + « +N » (N = tout le reste), sur 2 lignes au plus', () => {
  assert.equal(L.etiquettesHtml([]), '');
  for (let n = 1; n <= 40; n++) {
    const h = L.etiquettesHtml(etiquettes(n));
    const lignes = (h.match(/class="ctags-l"/g) || []).length;
    const montrees = (h.match(/<span class="etq">/g) || []).length;
    const cachees = (h.match(/<span hidden class="etq">/g) || []).length;
    const plus = h.match(/etq--plus" title="([^"]*)" aria-label="[^"]*">\+(\d+)</);
    assert.equal(montrees + cachees, n, `${n} étiquettes : toutes sont dans la page`);
    assert.ok(lignes >= 1 && lignes <= 2, `${n} étiquettes : ${lignes} lignes`);
    if (n <= 8) {
      assert.ok(!plus && cachees === 0, `${n} étiquettes : toutes affichées`);
    } else {
      assert.equal(montrees, 7, `${n} étiquettes : 7 affichées`);
      assert.equal(+plus[2], n - 7, `${n} étiquettes : « +${n - 7} » (tout le reste, sans plafond)`);
      assert.equal(plus[1], 'Autres compétences : ' + Array.from({ length: n - 7 }, (_, i) => 'T' + (i + 8)).join(', '), `${n} étiquettes : le titre liste les cachées`);
    }
    // Chaque ligne a de 2 à 4 éléments visibles (« +N » compris), sauf s'il n'y a qu'un élément.
    h.split('<div class="ctags-l">').slice(1).forEach((l) => {
      const v = (l.match(/<span class="etq[^"]*"/g) || []).length;
      assert.ok(v <= 4 && (n === 1 || v >= 2), `${n} étiquettes : une ligne de ${v}`);
    });
  }
});

test('un libellé qui contient du HTML est écrit, pas interprété, dans le titre de « +N »', () => {
  const h = L.etiquettesHtml(etiquettes(9, (i) => (i === 8 ? '<img data-injecte>"' : 'T' + (i + 1))));
  assert.ok(!h.includes('<img data-injecte>'), h);
  assert.ok(h.includes('&lt;img data-injecte&gt;&quot;'), h);
});
