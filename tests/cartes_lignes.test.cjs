/* La règle des lignes des cartes d'offre (assets/cartes-lignes.js).
   FAITS : 4 par ligne au plus, 2 au moins (2 lignes au plus : ils sont 4 au plus).
   ÉTIQUETTES : une seule ligne de 4 éléments au plus, « +N » compris ; tout le reste dans « +N ». */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/cartes-lignes.js');

const faits = (n) => Array.from({ length: n }, (_, i) => ({ html: `<i>${i + 1}</i>` }));
const etiquettes = (n, fn) => Array.from({ length: n }, (_, i) => ({
  html: `<span class="etq">T${i + 1}</span>`, libelle: fn ? fn(i) : `T${i + 1}`,
}));

test('faits : 1→1, 2→2, 3→3, 4→4 (une ligne) ; avec un plafond de 3 ou 2 : 4→2+2', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => L.tailles(n)), [[], [1], [2], [3], [4]]);
  assert.deepEqual(L.tailles(4, 3), [2, 2]);
  assert.deepEqual(L.tailles(4, 2), [2, 2]);
  assert.deepEqual(L.tailles(5), [3, 2]);
  assert.deepEqual(L.tailles(5, 3), [3, 2]);
  assert.deepEqual(L.tailles(6, 2), [2, 2, 2]);
  assert.equal(L.valable(3, 2), false, '3 éléments à 2 par ligne laisseraient une ligne seule');
  assert.equal(L.valable(4, 2), true);
});

test('faits : jamais une ligne de moins de 2 éléments (sauf s\'il n\'y en a qu\'un), jamais plus de 4', () => {
  for (let n = 2; n <= 24; n++) {
    for (const m of [4, 3, 2]) {
      if (!L.valable(n, m)) continue;
      const t = L.tailles(n, m);
      assert.equal(t.reduce((a, b) => a + b, 0), n);
      assert.ok(t.every((x) => x >= 2 && x <= m), `${n} faits, ${m} au plus : ${t}`);
    }
  }
  assert.equal(L.html(L.repartir(faits(4)), 'x-l'), '<div class="x-l"><i>1</i><i>2</i><i>3</i><i>4</i></div>');
  assert.equal(L.html([], 'x-l'), '');
});

test('étiquettes : toutes jusqu\'à 4 ; à partir de 5, 3 + « +N »', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9, 30].map((n) => L.visibles(n)), [0, 1, 2, 3, 4, 3, 3, 3, 3]);
});

test('étiquettes : une seule ligne ; de 0 à 40 étiquettes, 4 éléments au plus avec « +N » ; rien de perdu', () => {
  assert.equal(L.etiquettesHtml([]), '');
  for (let n = 1; n <= 40; n++) {
    const h = L.etiquettesHtml(etiquettes(n));
    assert.equal((h.match(/class="ctags-l"/g) || []).length, 1, `${n} étiquettes : une seule ligne`);
    const montrees = (h.match(/<span class="etq">/g) || []).length;
    const cachees = (h.match(/<span hidden class="etq">/g) || []).length;
    const plus = h.match(/etq--plus" title="([^"]*)" aria-label="[^"]*">\+(\d+)</);
    assert.equal(montrees + cachees, n, `${n} étiquettes : toutes sont dans la page`);
    if (n <= 4) {
      assert.ok(!plus && cachees === 0, `${n} étiquettes : toutes affichées, pas de « +N »`);
    } else {
      assert.equal(montrees, 3, `${n} étiquettes : 3 affichées`);
      assert.equal(+plus[2], n - 3, `${n} étiquettes : « +${n - 3} »`);
      assert.equal(montrees + 1, 4, `${n} étiquettes : « +N » compris, 4 éléments`);
      assert.equal(plus[1], 'Autres compétences : ' + Array.from({ length: n - 3 }, (_, i) => 'T' + (i + 4)).join(', '), `${n} étiquettes : le titre liste les cachées`);
    }
  }
});

test('étiquettes : un libellé qui contient du HTML est écrit, pas interprété, dans le titre de « +N »', () => {
  const h = L.etiquettesHtml(etiquettes(5, (i) => (i === 4 ? '<img data-injecte>"' : 'T' + (i + 1))));
  assert.ok(!h.includes('<img data-injecte>'), h);
  assert.ok(h.includes('&lt;img data-injecte&gt;&quot;'), h);
});
