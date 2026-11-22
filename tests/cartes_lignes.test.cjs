/* La règle des lignes des cartes d'offre (assets/cartes-lignes.js) :
   4 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un) ; « +N » ne
   cache jamais plus de 2 éléments, et seulement s'il fait gagner une ligne ; sinon
   tout s'affiche et le bloc prend une ligne de plus. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/cartes-lignes.js');

const elements = (n) => Array.from({ length: n }, (_, i) => ({ html: `<i>${i + 1}</i>`, libelle: `L${i + 1}` }));
const plus = (caches) => `<b>+${caches.length}:${caches.map((c) => c.libelle).join(',')}</b>`;

test('places → lignes (4 au plus) : 1→1 … 4→4, 5→3+2, 6→3+3, 7→4+3, 8→4+4, 9→3+3+3, 10→4+3+3, 13→4+3+3+3', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => L.tailles(n)),
    [[], [1], [2], [3], [4], [3, 2], [3, 3], [4, 3], [4, 4], [3, 3, 3], [4, 3, 3], [4, 4, 3], [4, 4, 4], [4, 3, 3, 3]]);
});

test('places → lignes avec un plafond de 3 ou de 2 (quand 4 coupent un texte) : jamais une ligne seule', () => {
  assert.deepEqual(L.tailles(4, 3), [2, 2]);
  assert.deepEqual(L.tailles(7, 3), [3, 2, 2]);
  assert.deepEqual(L.tailles(8, 3), [3, 3, 2]);
  assert.deepEqual(L.tailles(4, 2), [2, 2]);
  assert.deepEqual(L.tailles(6, 2), [2, 2, 2]);
  // 5 éléments ne tiennent pas à 2 par ligne sans en laisser un seul : le découpage n'est pas valable.
  assert.equal(L.valable(5, 2), false);
  assert.equal(L.valable(3, 2), false);
  assert.equal(L.valable(4, 2), true);
  assert.equal(L.valable(5, 3), true);
  for (let n = 2; n <= 24; n++) {
    for (const m of [4, 3, 2]) {
      if (!L.valable(n, m)) continue;
      const t = L.tailles(n, m);
      assert.equal(t.reduce((a, b) => a + b, 0), n, `${n} éléments, ${m} au plus`);
      assert.ok(t.every((x) => x >= 2 && x <= m), `${n} éléments, ${m} au plus : ${t}`);
    }
  }
});

test('éléments → « +N » : 1 à 8 tous ; 9 → « +2 » ; 10 à 12 tous ; 13 → « +2 » ; 17 → « +2 »', () => {
  // « +2 » aux effectifs 9, 13, 17… : un de plus qu'un multiple de 4, dès 9.
  for (let n = 0; n <= 40; n++) assert.equal(L.caches(n), n >= 9 && n % 4 === 1 ? 2 : 0, `${n} éléments`);
});

test('invariants pour 0 à 40 éléments : lignes de 2 à 4 (1 si un seul), « +N » ≤ 2 et en dernier, rien de perdu', () => {
  for (let n = 0; n <= 40; n++) {
    const lignes = L.repartir(elements(n), plus);
    const tout = lignes.flat();
    for (const l of lignes) {
      assert.ok(l.length <= 4, `${n} éléments : une ligne de ${l.length}`);
      if (n > 1) assert.ok(l.length >= 2, `${n} éléments : une ligne de ${l.length}`);
    }
    if (n <= 8) assert.ok(lignes.length <= 2, `${n} éléments : ${lignes.length} lignes (2 au plus jusqu'à 8)`);
    const pastilles = tout.filter((h) => h.startsWith('<b>'));
    assert.ok(pastilles.length <= 1, `${n} éléments : une seule pastille « +N »`);
    if (pastilles.length) {
      const m = /^<b>\+(\d+):(.*)<\/b>$/.exec(pastilles[0]);
      assert.ok(+m[1] <= 2, `${n} éléments : « +${m[1]} » dépasse +2`);
      assert.equal(tout[tout.length - 1], pastilles[0], `${n} éléments : « +N » en dernier`);
      assert.equal(m[2], Array.from({ length: +m[1] }, (_, i) => 'L' + (n - +m[1] + i + 1)).join(','), `${n} éléments : les cachés sont les derniers`);
      // « +N » n'existe que s'il fait gagner une ligne.
      assert.ok(lignes.length < Math.ceil(n / 4), `${n} éléments : « +N » ne fait pas gagner de ligne`);
    }
    const visibles = tout.filter((h) => !h.startsWith('<b>'));
    assert.deepEqual(visibles, elements(visibles.length).map((e) => e.html), `${n} éléments : les premiers, dans l'ordre`);
    assert.equal(visibles.length + (pastilles.length ? +/\+(\d+)/.exec(pastilles[0])[1] : 0), n, `${n} éléments : rien de perdu`);
  }
});

test('html : un bloc par ligne, dans l\'ordre', () => {
  assert.equal(L.html(L.repartir(elements(5)), 'x-l'),
    '<div class="x-l"><i>1</i><i>2</i><i>3</i></div><div class="x-l"><i>4</i><i>5</i></div>');
  assert.equal(L.html([], 'x-l'), '');
});
