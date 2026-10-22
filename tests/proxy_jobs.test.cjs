// tests/proxy_jobs.test.cjs
//
// Le proxy /api/jobs.
//
// Point important relevé à l audit : le board ne consomme pas ce proxy. Il
// interroge directement le backend. Le proxy sert à /api/jobs, qui est aussi
// la cible du cron quotidien.
//
// Ce fichier couvre :
//   H04 — méthodes, configuration absente, forme de la réponse
//   H05 — en-têtes, CORS, absence de secret dans la réponse

const assert = require('node:assert/strict');
const path = require('node:path');
const { appeler } = require('./helpers/gestionnaire.cjs');
const { demarrer, REPONSES } = require('./helpers/serveur-simule.cjs');

const RACINE = path.join(__dirname, '..');

// api/jobs.js est un module ESM (export default). require() renvoie un
// objet module, pas la fonction : on prend la valeur par défaut.
const moduleJobs = require(path.join(RACINE, 'api/jobs.js'));

function charger() {
  return moduleJobs.default || moduleJobs;
}

(async () => {
  const handler = charger();

  // ── H04 — La configuration absente ne doit pas faire tomber le proxy ───
  delete process.env.JOBS_API_URL;
  delete process.env.JOBS_API_KEY;
  const sansConfig = await appeler(handler, { method: 'GET' });
  assert.equal(sansConfig.status, 200, 'sans configuration, le proxy doit répondre 200');
  assert.equal(sansConfig.corps.source, 'mock', 'sans configuration, la source est signalée comme fictive');
  assert.equal(sansConfig.corps.total, 0);
  assert.deepEqual(sansConfig.corps.jobs, []);

  // ── H04 — CORS et méthode OPTIONS ──────────────────────────────────────
  const options = await appeler(handler, { method: 'OPTIONS' });
  assert.equal(options.status, 200, 'la requête de pré-vérification doit répondre 200');
  assert.equal(options.entetes['Access-Control-Allow-Origin'], '*');
  assert.match(options.entetes['Access-Control-Allow-Methods'] || '', /GET/);

  const get = await appeler(handler, { method: 'GET' });
  assert.equal(get.entetes['Access-Control-Allow-Origin'], '*',
    'la réponse doit porter la permission CORS');

  // ── H04 — La forme de la réponse ───────────────────────────────────────
  // Le backend simulé répond l ENVELOPPE réelle : { data, pagination }.
  // C est la forme que le proxy doit savoir lire.
  const serveur = await demarrer({ offres: [{ id: 'a', slug: 'offre-a', title: 'Poste A' }] });
  process.env.JOBS_API_URL = serveur.url + '/api/v1/jobs';
  process.env.JOBS_API_KEY = 'jeton-de-test';
  const handlerConfigure = charger();

  const configure = await appeler(handlerConfigure, { method: 'GET' });
  assert.equal(configure.status, 200, 'avec configuration, le proxy doit répondre 200');
  assert.equal(configure.corps.source, 'api', 'la source doit être signalée comme l API');
  assert.ok(Array.isArray(configure.corps.jobs), 'la réponse doit porter une liste d offres');
  assert.equal(configure.corps.jobs.length, 1, 'la liste doit contenir ce que le backend a renvoyé');
  assert.equal(configure.corps.total, 1, 'le total doit accompagner la liste');
  assert.ok(configure.corps.updatedAt, 'la réponse doit porter la date de mise à jour');

  // ── H04 — Le secret ne doit jamais sortir ─────────────────────────────
  const texte = JSON.stringify(configure.corps);
  assert.ok(!texte.includes('jeton-de-test'), 'le jeton ne doit pas figurer dans la réponse');
  assert.ok(!texte.includes('JOBS_API_KEY'), 'le nom de la variable ne doit pas figurer dans la réponse');

  // ── H04 — Une erreur du backend doit être visible ──────────────────────
  const serveurEnPanne = await demarrer({ liste: () => REPONSES.panne() });
  process.env.JOBS_API_URL = serveurEnPanne.url + '/api/v1/jobs';
  const handlerEnPanne = charger();
  const panne = await appeler(handlerEnPanne, { method: 'GET' });
  assert.equal(panne.status, 500, 'une erreur du backend doit être signalée');
  assert.ok(panne.corps.error, 'la réponse d erreur doit dire ce qui s est passé');

  // ── H05 — Le message d erreur ne doit pas fuir de détail technique ─────
  const texteErreur = JSON.stringify(panne.corps);
  assert.ok(!texteErreur.includes('/api/v1'), 'le message ne doit pas exposer l adresse interne');

  await serveur.arreter();
  await serveurEnPanne.arreter();

  delete process.env.JOBS_API_URL;
  delete process.env.JOBS_API_KEY;

  console.log('Proxy des offres : méthodes, configuration, forme de la réponse, secret — OK');
})().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
