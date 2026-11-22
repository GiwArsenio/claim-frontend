/* La règle des lignes des cartes d'offre (assets/cartes-lignes.js) :
   3 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un), 2 lignes
   au plus par bloc ; ce qui dépasse devient « +N », qui prend la 6e place. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/cartes-lignes.js');

const elements = (n) => Array.from({ length: n }, (_, i) => ({ html: `<i>${i + 1}</i>`, libelle: `L${i + 1}` }));
const plus = (caches) => `<b>+${caches.length}:${caches.map((c) => c.libelle).join(',')}</b>`;

test('répartition : 1→1, 2→2, 3→3, 4→2+2, 5→3+2, 6→3+3', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((n) => L.tailles(n)),
    [[], [1], [2], [3], [2, 2], [3, 2], [3, 3]]);
});

test('invariants pour 0 à 20 éléments : ≤ 3 par ligne, ≥ 2 sauf un seul, ≤ 2 lignes, rien de perdu', () => {
  for (let n = 0; n <= 20; n++) {
    const lignes = L.repartir(elements(n), plus);
    const tout = lignes.flat();
    assert.ok(lignes.length <= 2, `${n} éléments : ${lignes.length} lignes`);
    for (const l of lignes) {
      assert.ok(l.length <= 3, `${n} éléments : une ligne de ${l.length}`);
      if (n > 1) assert.ok(l.length >= 2, `${n} éléments : une ligne de ${l.length}`);
    }
    if (n <= 6) {
      assert.equal(tout.length, n, `${n} éléments : tous affichés`);
      assert.ok(!tout.some((h) => h.startsWith('<b>')), `${n} éléments : pas de +N`);
    } else {
      // 5 affichés + la pastille « +N » : 6 places, N = total − 5.
      assert.equal(tout.length, 6, `${n} éléments : 6 places`);
      assert.equal(tout[5], `<b>+${n - 5}:${Array.from({ length: n - 5 }, (_, i) => 'L' + (i + 6)).join(',')}</b>`,
        `${n} éléments : « +${n - 5} » en dernier, avec la liste des cachés`);
      assert.deepEqual(tout.slice(0, 5), elements(5).map((e) => e.html), `${n} éléments : les 5 premiers`);
    }
  }
});

test('html : un bloc par ligne, dans l\'ordre', () => {
  assert.equal(L.html(L.repartir(elements(4)), 'x-l'),
    '<div class="x-l"><i>1</i><i>2</i></div><div class="x-l"><i>3</i><i>4</i></div>');
  assert.equal(L.html([], 'x-l'), '');
});
