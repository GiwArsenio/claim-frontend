/* La règle des lignes des cartes d'offre (assets/cartes-lignes.js) :
   3 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un) ; « +N » ne
   cache jamais plus de 2 éléments, et seulement s'il fait gagner une ligne ; sinon
   tout s'affiche et le bloc prend une ligne de plus. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/cartes-lignes.js');

const elements = (n) => Array.from({ length: n }, (_, i) => ({ html: `<i>${i + 1}</i>`, libelle: `L${i + 1}` }));
const plus = (caches) => `<b>+${caches.length}:${caches.map((c) => c.libelle).join(',')}</b>`;

test('places → lignes : 1→1, 2→2, 3→3, 4→2+2, 5→3+2, 6→3+3, 7→3+2+2, 8→3+3+2, 9→3+3+3, 10→3+3+2+2', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => L.tailles(n)),
    [[], [1], [2], [3], [2, 2], [3, 2], [3, 3], [3, 2, 2], [3, 3, 2], [3, 3, 3], [3, 3, 2, 2]]);
});

test('éléments → « +N » : 1 à 6 tous ; 7 → « +2 » ; 8 et 9 tous ; 10 → « +2 » ; 11 et 12 tous ; 13 → « +2 »', () => {
  // « +2 » aux effectifs 7, 10, 13, 16, 19… : un de plus qu'un multiple de 3, dès 7.
  for (let n = 0; n <= 40; n++) assert.equal(L.caches(n), n >= 7 && n % 3 === 1 ? 2 : 0, `${n} éléments`);
});

test('invariants pour 0 à 40 éléments : lignes de 2 à 3 (1 si un seul), « +N » ≤ 2 et en dernier, rien de perdu', () => {
  for (let n = 0; n <= 40; n++) {
    const lignes = L.repartir(elements(n), plus);
    const tout = lignes.flat();
    for (const l of lignes) {
      assert.ok(l.length <= 3, `${n} éléments : une ligne de ${l.length}`);
      if (n > 1) assert.ok(l.length >= 2, `${n} éléments : une ligne de ${l.length}`);
    }
    if (n <= 6) assert.ok(lignes.length <= 2, `${n} éléments : ${lignes.length} lignes (2 au plus jusqu'à 6)`);
    const pastilles = tout.filter((h) => h.startsWith('<b>'));
    assert.ok(pastilles.length <= 1, `${n} éléments : une seule pastille « +N »`);
    if (pastilles.length) {
      const m = /^<b>\+(\d+):(.*)<\/b>$/.exec(pastilles[0]);
      assert.ok(+m[1] <= 2, `${n} éléments : « +${m[1]} » dépasse +2`);
      assert.equal(tout[tout.length - 1], pastilles[0], `${n} éléments : « +N » en dernier`);
      assert.equal(m[2], Array.from({ length: +m[1] }, (_, i) => 'L' + (n - +m[1] + i + 1)).join(','), `${n} éléments : les cachés sont les derniers`);
      // « +N » n'existe que s'il fait gagner une ligne.
      assert.ok(lignes.length < Math.ceil(n / 3), `${n} éléments : « +N » ne fait pas gagner de ligne`);
    }
    const visibles = tout.filter((h) => !h.startsWith('<b>'));
    assert.deepEqual(visibles, elements(visibles.length).map((e) => e.html), `${n} éléments : les premiers, dans l'ordre`);
    assert.equal(visibles.length + (pastilles.length ? +/\+(\d+)/.exec(pastilles[0])[1] : 0), n, `${n} éléments : rien de perdu`);
  }
});

test('html : un bloc par ligne, dans l\'ordre', () => {
  assert.equal(L.html(L.repartir(elements(4)), 'x-l'),
    '<div class="x-l"><i>1</i><i>2</i></div><div class="x-l"><i>3</i><i>4</i></div>');
  assert.equal(L.html([], 'x-l'), '');
});
