/* Génération des captures de référence. Usage :
     node tests/generer-references.cjs
   Les images produites sont la base d'approbation : elles doivent être
   relues par un humain avant d'être acceptées. */
'use strict';

const aide = require('./aide-parcours.cjs');
const captures = require('./captures-reference.cjs');

(async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const resultats = await captures.capturerEtComparer(aide, { ecrireReferences: true });
    console.log(`${resultats.length} capture(s) de reference ecrites dans ${captures.DOSSIER_REFERENCE}`);
    for (const r of resultats) console.log('  ' + r.scenario);
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
})();
