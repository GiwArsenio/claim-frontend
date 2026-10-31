/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE VISUEL — Le rendu correspond-il à la capture de référence ?

   Ce contrôle est sorti de la famille navigateur, et voici pourquoi. Une
   capture de référence appartient à la machine qui l'a produite : rendu des
   polices, anticrénelage, arrondis de sous-pixels. Comparer au pixel près
   entre deux systèmes d'exploitation ne teste pas le site, il teste la
   différence des systèmes — et il échoue sans qu'aucune régression existe.

   Conséquence assumée : cette famille n'est pas exécutée par défaut, et ne
   bloque pas un déploiement. Elle reste une PREUVE VISUELLE, à lancer là où
   les références ont été produites :

       node tools/run-tests.cjs --famille=visuel

   Ce qui continue de bloquer, dans tests/captures-a06.test.cjs :
     - chaque capture montre bien l'état qu'elle annonce ;
     - le détecteur d'écart réagit à une disparition réelle d'action.

   Autrement dit : on garde la preuve que le contrôle visuel sert à quelque
   chose, et on cesse d'exiger qu'il soit identique sur une autre machine.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const captures = require('./captures-reference.cjs');

/* ── 3. Le rendu courant correspond à la référence ───────────────────────── */

test('A06 — le rendu correspond à la capture de référence', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const resultats = await captures.capturerEtComparer(aide);

    for (const r of resultats) {
      await t.test(r.scenario, async () => {
        assert.equal(
          r.referenceAbsente, undefined,
          `la capture de référence « ${r.scenario} » est absente`
        );
        assert.equal(
          r.comparable, true,
          `« ${r.scenario} » n'est pas comparable : ${r.raison || 'raison inconnue'}`
        );
        assert.ok(
          r.pct <= captures.SEUIL_PCT,
          `« ${r.scenario} » : ${r.pixelsDiff} pixel(s) different(s), soit ` +
          `${r.pct.toFixed(3)} % — le seuil est de ${captures.SEUIL_PCT} %. ` +
          `L'écart est dans ${r.cheminEcart || 'le dossier captures/ecarts'}`
        );
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
