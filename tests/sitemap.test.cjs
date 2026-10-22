// tests/sitemap.test.cjs
//
// Le sitemap est ce que Google lit. Une erreur dedans ne se voit pas : le
// site fonctionne, la page d accueil est belle, et les offres n entrent
// pas dans l index.
//
// Ce fichier couvre :
//   S04 — forme du sitemap : pagination, doublons, encodage
//   S05 — pannes : une page amont qui échoue ne doit pas produire un
//         sitemap qui a l air complet

const assert = require('node:assert/strict');
const path = require('node:path');
const { appeler } = require('./helpers/gestionnaire.cjs');
const { demarrer, REPONSES } = require('./helpers/serveur-simule.cjs');

const RACINE = path.join(__dirname, '..');

function charger(base) {
  process.env.API_URL = base;
  delete require.cache[require.resolve(path.join(RACINE, 'api/sitemap.js'))];
  return require(path.join(RACINE, 'api/sitemap.js'));
}

function urls(xml) {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
}

function entrees(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
}

(async () => {
  // ── S04 — cas nominal ────────────────────────────────────────────────────
  const serveur = await demarrer();
  const handler = charger(serveur.url + '/api/v1');
  const reponse = await appeler(handler, {});

  assert.equal(reponse.status, 200, 'le sitemap doit répondre 200');
  assert.match(reponse.entetes['Content-Type'] || '', /xml/, 'la réponse est du XML');

  const xml = reponse.corps;
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'le XML doit porter sa déclaration');
  assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'l espace de noms du sitemap est obligatoire');

  const liste = urls(xml);
  assert.ok(liste.length >= 6, 'le sitemap doit contenir les pages statiques et les offres');
  assert.ok(liste.includes('https://claimyourjob.fr/'), 'l accueil doit être déclaré');
  assert.ok(liste.includes('https://claimyourjob.fr/job-board.html'), 'le board doit être déclaré');

  // Les pages de pagination ne doivent pas être déclarées : le board est
  // rendu en JavaScript, la balise canonique le consolide.
  assert.ok(!liste.some((u) => u.includes('page=')), 'la pagination ne doit pas figurer dans le sitemap');

  // ── S04 — encodage ───────────────────────────────────────────────────────
  //
  // Les slugs portent des accents. Une adresse de sitemap doit être encodée,
  // sinon elle ne correspond à aucune ressource.
  const serveurAccents = await demarrer({
    offres: [{ id: 'x', slug: 'chargé-d-études-actuarielles-h-f-1234', source_published_at: '2026-10-01' }],
  });
  const handlerAccents = charger(serveurAccents.url + '/api/v1');
  const reponseAccents = await appeler(handlerAccents, {});
  const listeAccents = urls(reponseAccents.corps);

  const offreAccent = listeAccents.find((u) => u.includes('/offre/'));
  assert.ok(offreAccent, 'l offre accentuée doit figurer dans le sitemap');
  assert.ok(offreAccent.includes('%C3%A9'), 'les accents doivent être encodés en pourcent');
  assert.ok(!/[éèàçûô]/.test(offreAccent), 'aucun accent brut ne doit rester');

  // ── S04 — doublons ───────────────────────────────────────────────────────
  //
  // Deux offres de même slug, ou un slug répété, ne doivent pas produire
  // deux entrées : Google traiterait la seconde comme une autre page.
  const serveurDoublons = await demarrer({
    offres: [
      { id: 'a', slug: 'meme-offre', source_published_at: '2026-10-01' },
      { id: 'b', slug: 'meme-offre', source_published_at: '2026-10-02' },
    ],
  });
  const handlerDoublons = charger(serveurDoublons.url + '/api/v1');
  const reponseDoublons = await appeler(handlerDoublons, {});
  const listeDoublons = urls(reponseDoublons.corps);
  const offresDoublons = listeDoublons.filter((u) => u.includes('/offre/'));
  assert.equal(offresDoublons.length, new Set(offresDoublons).size,
    'le sitemap ne doit pas contenir deux fois la même offre');

  // ── S04 — pagination de la collecte ──────────────────────────────────────
  //
  // Le générateur demande 300 offres par page. Au-delà, il doit enchaîner.
  // On vérifie que le faux backend a bien reçu plusieurs requêtes.
  const many = [];
  for (let i = 0; i < 320; i++) many.push({ id: 'i' + i, slug: 'offre-' + i, source_published_at: '2026-10-01' });
  const serveurGrand = await demarrer({ offres: many });
  const handlerGrand = charger(serveurGrand.url + '/api/v1');
  const reponseGrand = await appeler(handlerGrand, {});

  const appelsListe = serveurGrand.appels.filter((a) => a.chemin === '/api/v1/jobs' || a.chemin === '/jobs');
  assert.ok(appelsListe.length >= 2, 'au-delà de 300 offres, la collecte doit se faire en plusieurs requêtes');

  const listeGrand = urls(reponseGrand.corps);
  const offresGrand = listeGrand.filter((u) => u.includes('/offre/'));
  assert.equal(offresGrand.length, 320, 'les 320 offres doivent figurer dans le sitemap');

  // ── S04 — lastmod ────────────────────────────────────────────────────────
  //
  // Une date absente ne doit pas devenir la date du jour : c est une
  // information fausse. Une date présente doit être respectée.
  const entreesGrand = entrees(reponseGrand.corps);
  const avecDate = entreesGrand.filter((e) => e.includes('<lastmod>2026-10-01</lastmod>'));
  assert.ok(avecDate.length >= 300, 'les offres datées doivent porter leur date de publication');

  const serveurSansDate = await demarrer({
    offres: [{ id: 'z', slug: 'sans-date', source_published_at: null }],
  });
  const handlerSansDate = charger(serveurSansDate.url + '/api/v1');
  const reponseSansDate = await appeler(handlerSansDate, {});
  const entreeSansDate = entrees(reponseSansDate.corps).find((e) => e.includes('/offre/sans-date'));
  assert.ok(entreeSansDate, 'l offre sans date doit figurer dans le sitemap');
  assert.ok(!entreeSansDate.includes('<lastmod>'),
    'une offre sans date de publication ne doit pas recevoir de lastmod : mieux vaut rien qu une date fausse');

  // ── S05 — une panne amont ne doit pas produire un sitemap tronqué en silence ──
  //
  // Le cas le plus grave : le backend répond 500, le sitemap renvoie 200 avec
  // seulement les pages statiques. Google lit un sitemap « complet » et ne
  // redemande rien. Les offres disparaissent de l index sans trace.
  const serveurEnPanne = await demarrer({
    detail: () => REPONSES.panne(),
    liste: () => REPONSES.panne(),
  });
  const handlerEnPanne = charger(serveurEnPanne.url + '/api/v1');
  const reponsePanne = await appeler(handlerEnPanne, {});

  assert.notEqual(reponsePanne.status, 200,
    'une panne du backend ne doit pas produire un sitemap qui a l air valide');
  assert.ok(reponsePanne.status >= 500, 'la panne doit se voir : attendu 5xx, obtenu ' + reponsePanne.status);

  // ── S05 — réponse amont illisible ────────────────────────────────────────
  const serveurInvalide = await demarrer({
    liste: () => ({ code: 200, corpsBrut: '{ pas du json' }),
  });
  const handlerInvalide = charger(serveurInvalide.url + '/api/v1');
  const reponseInvalide = await appeler(handlerInvalide, {});
  assert.notEqual(reponseInvalide.status, 200,
    'une réponse illisible ne doit pas produire un sitemap qui a l air valide');

  await serveur.arreter();
  await serveurAccents.arreter();
  await serveurDoublons.arreter();
  await serveurGrand.arreter();
  await serveurSansDate.arreter();
  await serveurEnPanne.arreter();
  await serveurInvalide.arreter();

  console.log('Sitemap : forme, encodage, doublons, pagination, pannes — OK');
})().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
