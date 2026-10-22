// tests/offre_http.test.cjs
//
// Ce que le gestionnaire de fiche répond, selon ce que le backend répond.
//
// Défaut D03 : toute réponse amont non réussie était traitée comme une
// absence. Une panne du backend (500, 503, timeout) devenait donc une
// réponse 404. Or 404 signifie « cette offre n existe pas » : Google retire
// alors l URL du sitemap, et l offre revient sans que personne ne sache
// pourquoi. Une panne temporaire ne doit pas effacer une offre.
//
// Ce fichier couvre :
//   H01 — cas nominaux : slug valide, vide, inconnu
//   H02 — distinguer absence et indisponibilité
//   H03 — délai dépassé, JSON invalide, enveloppe inattendue
//   H05 — en-têtes et cache

const assert = require('node:assert/strict');
const path = require('node:path');
const { appeler } = require('./helpers/gestionnaire.cjs');
const { demarrer, REPONSES, OFFRE_COMPLETE } = require('./helpers/serveur-simule.cjs');

const RACINE = path.join(__dirname, '..');

// Le gestionnaire lit son URL de base dans l'environnement. On le recharge
// après avoir posé la variable, pour qu il vise le faux backend.
function chargerGestionnaire(base) {
  process.env.API_URL = base;
  delete require.cache[require.resolve(path.join(RACINE, 'api/offre.js'))];
  return require(path.join(RACINE, 'api/offre.js'));
}

(async () => {
  // ── H01 : cas nominaux ───────────────────────────────────────────────────
  const serveur = await demarrer();
  const handler = chargerGestionnaire(serveur.url + '/api/v1');

  const trouve = await appeler(handler, { query: { slug: OFFRE_COMPLETE.slug } });
  assert.equal(trouve.status, 200, 'une offre connue doit répondre 200');
  assert.match(trouve.entetes['Content-Type'] || '', /text\/html/, 'la réponse est du HTML');
  assert.ok(trouve.html.includes(OFFRE_COMPLETE.title), 'le titre de l offre est dans la page');

  const vide = await appeler(handler, { query: {} });
  assert.equal(vide.status, 404, 'sans slug, la page ne peut pas exister');
  assert.match(vide.html, /noindex/, 'une page sans offre ne doit pas être indexée');

  const inconnu = await appeler(handler, { query: { slug: 'offre-qui-nexiste-pas-0123456789' } });
  assert.equal(inconnu.status, 404, 'un slug inconnu doit répondre 404');
  assert.match(inconnu.html, /noindex/, 'et la page absente ne doit pas être indexée');

  // Un slug encodé doit être décodé avant l'appel : les accents sont
  // courants dans les intitulés de poste.
  const encode = await appeler(handler, { query: { slug: encodeURIComponent('actuaire-senior-h-f-test') } });
  assert.equal(encode.status, 200, 'un slug encodé doit être résolu');

  // ── H02 : absence et indisponibilité ne sont pas la même chose ──────────
  //
  // C'est le cœur de D03. Le backend répond 500 : la page doit le dire, et
  // ne pas prétendre que l'offre a disparu.
  const serveurEnPanne = await demarrer({
    detail: () => REPONSES.panne(),
  });
  const handlerEnPanne = chargerGestionnaire(serveurEnPanne.url + '/api/v1');

  const panne = await appeler(handlerEnPanne, { query: { slug: OFFRE_COMPLETE.slug } });
  assert.notEqual(
    panne.status, 404,
    'une panne du backend ne doit pas être présentée comme une offre absente'
  );
  assert.ok(
    [502, 503].includes(panne.status),
    'une panne doit répondre 502 ou 503, pas 404 — obtenu ' + panne.status
  );

  // Une offre réellement absente répond toujours 404, elle.
  const serveurAbsent = await demarrer({
    detail: () => REPONSES.introuvable(),
  });
  const handlerAbsent = chargerGestionnaire(serveurAbsent.url + '/api/v1');
  const absente = await appeler(handlerAbsent, { query: { slug: OFFRE_COMPLETE.slug } });
  assert.equal(absente.status, 404, 'une offre absente répond 404');
  assert.match(absente.html, /noindex/, 'et sa page n est pas indexable');

  // Une limitation de débit n est pas une absence non plus.
  const serveurLimite = await demarrer({ detail: () => REPONSES.rateLimite() });
  const handlerLimite = chargerGestionnaire(serveurLimite.url + '/api/v1');
  const limite = await appeler(handlerLimite, { query: { slug: OFFRE_COMPLETE.slug } });
  assert.notEqual(limite.status, 404, 'une limitation de débit n est pas une absence');

  // ── H03 : réponses invalides ─────────────────────────────────────────────
  const serveurInvalide = await demarrer({
    detail: () => ({ code: 200, corpsBrut: '{ ceci n est pas du JSON' }),
  });
  const handlerInvalide = chargerGestionnaire(serveurInvalide.url + '/api/v1');
  const invalide = await appeler(handlerInvalide, { query: { slug: OFFRE_COMPLETE.slug } });
  assert.notEqual(invalide.status, 200, 'une réponse illisible ne doit pas produire une page');
  assert.notEqual(invalide.status, 404, 'et elle ne doit pas non plus dire que l offre est absente');

  // ── H03 : le délai dépassé ───────────────────────────────────────────────
  //
  // Le gestionnaire n a pas de délai maximal. Sans lui, une requête qui
  // traîne immobilise la fonction serveur — et Vercel la tue au bout d un
  // certain temps, sans réponse propre. Ce test constate l absence de garde
  // : il doit échouer tant que le délai n est pas posé.
  const serveurLent = await demarrer({
    detail: () => REPONSES.lent(OFFRE_COMPLETE, 4000),
  });
  const handlerLent = chargerGestionnaire(serveurLent.url + '/api/v1');

  const debut = Date.now();
  const lent = await appeler(handlerLent, { query: { slug: OFFRE_COMPLETE.slug } });
  const duree = Date.now() - debut;

  assert.ok(
    duree < 3000,
    'le gestionnaire doit abandonner une requête lente avant 3 s — elle a pris ' + duree + ' ms'
  );
  assert.notEqual(lent.status, 200, 'une page ne doit pas être rendue sur une réponse trop tardive');

  // ── H05 : en-têtes ───────────────────────────────────────────────────────
  const cache = await appeler(handler, { query: { slug: OFFRE_COMPLETE.slug } });
  assert.ok(cache.entetes['Cache-Control'], 'la réponse doit porter une règle de cache');
  // Vercel lit s-maxage ; un max-age navigateur est aussi accepté. Les deux
  // doivent fixer une durée bornée.
  const regle = cache.entetes['Cache-Control'];
  const dureeCache = Number((regle.match(/s-maxage=(\d+)/) || regle.match(/max-age=(\d+)/) || [])[1] || 0);
  assert.ok(dureeCache > 0 && dureeCache <= 3600,
    'la règle de cache doit fixer une durée bornée — obtenu « ' + regle + ' »');

  // La page d erreur ne doit pas être mise en cache longtemps : une offre
  // peut revenir, et une page 404 cachée une heure ne se répare pas.
  const cacheAbsent = await appeler(handlerAbsent, { query: { slug: OFFRE_COMPLETE.slug } });
  const regleAbsente = cacheAbsent.entetes['Cache-Control'] || '';
  const dureeAbsente = Number((regleAbsente.match(/s-maxage=(\d+)/) || regleAbsente.match(/max-age=(\d+)/) || [])[1] || 0);
  assert.ok(
    dureeAbsente <= 300,
    'une page absente ne doit pas rester en cache plus de 5 minutes — obtenu ' + dureeAbsente + ' s'
  );

  await serveur.arreter();
  await serveurEnPanne.arreter();
  await serveurAbsent.arreter();
  await serveurLimite.arreter();
  await serveurInvalide.arreter();
  await serveurLent.arreter();

  console.log('HTTP fiche : nominaux, absence contre panne, réponses invalides, cache — OK');
})().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
