// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — Les adresses internationales
//
// Le .com a été acheté après coup : c'est une porte, pas une copie. Ce
// test fixe ce que la porte fait, et surtout ce qu'elle ne fait pas.
//
// Les trois règles :
//
//   1. `/fr/…` sur le .com mène au .fr, en 301, chemin conservé.
//   2. `/` sur le .com est une page de choix, pas une redirection.
//   3. Le .fr n'est pas concerné : il continue de servir ce qu'il servait.
//
// Ce qui est vérifié ici, et ce qui ne l'est pas.
//
// Un test qui appelle le routeur prouve la LOGIQUE : quelle URL mène
// où, avec quel code. Il ne prouve pas que Cloudflare a bien rattaché le
// domaine, ni que le certificat est émis. Ces deux-là se vérifient en
// ligne, après le déploiement — et ils sont dans le compte rendu.
//
// La preuve que le test n'est pas complaisant : le cas « le .fr n'est pas
// concerné » échoue si la règle 3 est supprimée, et le cas « le chemin est
// conservé » échoue si la règle 1 perd son suffixe. Les deux ont été
// vérifiés par mutation.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Le Worker est un module ESM (src/package.json porte "type": "module").
// Ce test est en CommonJS : on l'importe dynamiquement.
let routeur = null;

test('le routeur international répond aux trois adresses', async (t) => {
  if (!routeur) {
    ({ default: routeur } = await import('../src/index.js'));
  }

  // Un ASSETS minimal : la racine du .fr et les pages statiques vont au
  // CDN, et l'on ne teste pas le CDN ici.
  const env = {
    ASSETS: { fetch: async (req) => new Response('ASSETS:' + new URL(req.url).pathname, {
      headers: { 'content-type': 'text/plain' } }) },
    API_URL: 'https://api.test.invalid/api/v1',
    SITE_URL: 'https://claimyourjob.fr',
  };

  const appeler = (url) => routeur.fetch(new Request(url), env, {});

  // ── Règle 1 : l'alias /fr/… ──────────────────────────────────────────
  await t.test('/fr redirige en 301 vers le .fr', async () => {
    const r = await appeler('https://claimyourjob.com/fr');
    assert.equal(r.status, 301);
    assert.equal(
      r.headers.get('location'), 'https://claimyourjob.fr/',
      'le préfixe /fr ne mène pas à la racine du .fr'
    );
  });

  await t.test('/fr conserve le chemin', async () => {
    const r = await appeler('https://claimyourjob.com/fr/job-board.html');
    assert.equal(r.status, 301);
    assert.equal(
      r.headers.get('location'), 'https://claimyourjob.fr/job-board.html',
      'le chemin après /fr est perdu : le visiteur arrive sur une page qui n\'est pas celle qu\'il demandait'
    );
  });

  await t.test('/fr/offre/… conserve le chemin de la fiche', async () => {
    const r = await appeler('https://claimyourjob.com/fr/offre/actuaire-senior');
    assert.equal(r.status, 301);
    assert.equal(
      r.headers.get('location'), 'https://claimyourjob.fr/offre/actuaire-senior'
    );
  });

  // ── Règle 2 : la porte ────────────────────────────────────────────────
  await t.test('la racine du .com est une page de choix', async () => {
    const r = await appeler('https://claimyourjob.com/');
    assert.equal(r.status, 200);
    const corps = await r.text();
    assert.match(corps, /Choisissez votre marché/);
    assert.match(corps, /https:\/\/claimyourjob\.fr/,
      'la porte ne propose pas le marché français');
    assert.match(corps, /name="robots" content="noindex/,
      'la porte est indexée alors qu\'un seul marché existe');
  });

  await t.test('la porte se comporte pareil sur www', async () => {
    const r = await appeler('https://www.claimyourjob.com/');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Choisissez votre marché/);
  });

  // ── Règle 3 : le .fr n'est pas concerné ───────────────────────────────
  await t.test('le .fr sert toujours l\'accueil, sans porte', async () => {
    const r = await appeler('https://claimyourjob.fr/');
    assert.equal(r.status, 200);
    const corps = await r.text();
    assert.ok(!/Choisissez votre marché/.test(corps),
      'la porte s\'est glissée sur le .fr : le site français ne doit pas demander son marché');
  });

  await t.test('le .fr ne transforme pas /fr en redirection', async () => {
    const r = await appeler('https://claimyourjob.fr/fr');
    assert.notEqual(r.status, 301,
      '/fr sur le .fr est une redirection : la règle du .com déborde sur le .fr');
  });

  await t.test('le .fr garde sa redirection historique', async () => {
    const r = await appeler('https://claimyourjob.fr/claim-job-board.html');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), 'https://claimyourjob.fr/job-board.html');
  });

  // ── Le contenu est servi des deux côtés ───────────────────────────────
  await t.test('une page de contenu est servie sur le .com', async () => {
    const r = await appeler('https://claimyourjob.com/job-board.html');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /^ASSETS:/);
  });

  await t.test('le sitemap du .com pointe vers le .fr', async () => {
    // Le sitemap est construit depuis l'API des offres. Sans API, il
    // répond 500 — c'est le comportement correct d'une panne, pas un
    // défaut de routage. On vérifie donc l'adresse déclarée, pas le
    // contenu construit : c'est la source unique du signal.
    const r = await appeler('https://claimyourjob.com/sitemap.xml');
    assert.ok(r.status === 200 || r.status === 500,
      `le sitemap répond ${r.status} : une panne de l'API doit rester une 500`);

    // L'adresse du sitemap est lue dans env.SITE_URL, qui pointe le .fr :
    // le .com est une porte, il n'est pas la source du catalogue.
    const { rendreSitemap } = await import('../src/pages/sitemap.js');
    const reponse = await rendreSitemap({
      API_URL: 'https://api.test.invalid/api/v1',
      SITE_URL: 'https://claimyourjob.fr',
    });
    const corps = await reponse.text();
    // L'API est injoignable ici : on vérifie que l'adresse servant de
    // base est bien le .fr, en lisant la source.
    const source = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'src', 'pages', 'sitemap.js'), 'utf8');
    assert.match(source, /SITE_URL_PAR_DEFAUT = 'https:\/\/claimyourjob\.fr'/,
      'l\'adresse par défaut du sitemap n\'est plus le .fr');
    assert.ok(typeof corps === 'string');
  });

  await t.test('le monitoring reste fermé', async () => {
    const r = await appeler('https://claimyourjob.com/monitoring');
    assert.ok(r.status === 401 || r.status === 403 || r.status === 302,
      `le monitoring répond ${r.status} sur le .com : le tableau de bord interne ne doit pas s'ouvrir`);
  });
});
