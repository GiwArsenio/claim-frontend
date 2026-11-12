// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — Les adresses internationales
//
// Le .com est le domaine de la marque ; le .fr, celui que le site a
// toujours eu. Depuis la migration, il n'y a qu'une SEULE source
// indexable : `claimyourjob.com/fr`. Tout le reste redirige, en un seul
// saut, chemin et query conservés.
//
// Ce que la migration change, et ce que ce test fixe :
//
//   1. `claimyourjob.com/fr/…` EST la source. 200, canonique .com/fr.
//   2. `claimyourjob.com/…` (hors /fr) redirige vers `/fr/…`.
//   3. `claimyourjob.fr/…` redirige vers `claimyourjob.com/fr/…`.
//   4. Les `www` convergent vers l'apex.
//   5. Une seule source : pas de sitemap, pas de robots, pas de canonique
//      qui laisse le .fr indexable à côté du .com/fr.
//
// Ce qui est vérifié ici, et ce qui ne l'est pas.
//
// Un test qui appelle le routeur prouve la LOGIQUE : quelle URL mène où,
// avec quel code. Il ne prouve pas que Cloudflare a bien rattaché le
// domaine, ni que le certificat est émis. Ces deux-là se vérifient en
// ligne, après le déploiement — et ils sont dans le compte rendu.
//
// La preuve que le test n'est pas complaisant, vérifiée par mutation :
//   - supprimer la règle d'alias du .fr   → 3 échecs ;
//   - supprimer la conservation du suffixe → 2 échecs.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Le Worker est un module ESM (src/package.json porte "type": "module").
// Ce test est en CommonJS : on l'importe dynamiquement.
let routeur = null;

const SOURCE = 'https://claimyourjob.com/fr';

test('le routage international converge vers une seule source', async (t) => {
  if (!routeur) {
    ({ default: routeur } = await import('../src/index.js'));
  }

  // Un ASSETS minimal : le statique est servi, et l'on ne teste pas le
  // CDN ici. Il répond HTML pour que la réécriture du maillage soit
  // observable.
  const env = {
    ASSETS: {
      fetch: async (req) => new Response(
        '<a href="/job-board.html">b</a><img src="/assets/theme.css">',
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      ),
    },
    API_URL: 'https://api.test.invalid/api/v1',
    SITE_URL: SOURCE,
  };

  const appeler = (url) => routeur.fetch(new Request(url), env, {});

  // ── Règle 1 : la source est /fr ───────────────────────────────────────
  await t.test('/fr/job-board.html sert la page', async () => {
    const r = await appeler('https://claimyourjob.com/fr/job-board.html');
    assert.equal(r.status, 200);
  });

  await t.test('/fr nu redirige vers /fr/', async () => {
    const r = await appeler('https://claimyourjob.com/fr');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), `${SOURCE}/`,
      '/fr et /fr/ serviraient la même page : il faut un seul canon');
  });

  await t.test('la query survit au /fr nu', async () => {
    const r = await appeler('https://claimyourjob.com/fr?q=actuaire');
    assert.equal(r.headers.get('location'), `${SOURCE}/?q=actuaire`,
      'la recherche partagée est perdue : le board n\'a plus ses paramètres');
  });

  // ── Règle 2 : la racine du .com rejoint le marché ─────────────────────
  await t.test('la racine du .com mène au marché', async () => {
    const r = await appeler('https://claimyourjob.com/');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), `${SOURCE}/`);
  });

  await t.test('la racine conserve la query', async () => {
    const r = await appeler('https://claimyourjob.com/?utm_source=x');
    assert.equal(r.headers.get('location'), `${SOURCE}/?utm_source=x`);
  });

  await t.test('robots.txt reste servi 200 à la racine, le sitemap rejoint /fr', async () => {
    // Depuis 38cf551, seul robots.txt est exempté de la redirection : Google ne
    // le demande qu'à la racine, et un robots.txt en 3xx vaut 404 pour lui.
    const robots = await appeler('https://claimyourjob.com/robots.txt');
    assert.equal(robots.status, 200,
      'robots.txt doit être servi 200 à la racine (3xx = 404 pour Google)');
    assert.match(await robots.text(), /Sitemap:/,
      'robots.txt doit annoncer le sitemap de la source');

    // Le sitemap, lui, reste canonique sous /fr : à la racine du .com il
    // redirige (301) en un seul saut vers la source.
    const sitemap = await appeler('https://claimyourjob.com/sitemap.xml');
    assert.equal(sitemap.status, 301, 'sitemap.xml à la racine doit rediriger');
    assert.equal(sitemap.headers.get('location'), `${SOURCE}/sitemap.xml`);
  });

  await t.test('un ancien lien du .com rejoint /fr, en un seul saut', async () => {
    const r = await appeler('https://claimyourjob.com/job-board.html');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), `${SOURCE}/job-board.html`,
      'le visiteur qui suit un lien partagé d\'avant la migration arrive au bon endroit');
  });

  await t.test('un ancien lien de fiche conserve sa query', async () => {
    const r = await appeler('https://claimyourjob.com/offre/actuaire-senior?ref=mail');
    assert.equal(r.headers.get('location'), `${SOURCE}/offre/actuaire-senior?ref=mail`);
  });

  await t.test('l\'adresse historique du board va au board', async () => {
    for (const h of ['claimyourjob.com', 'claimyourjob.fr', 'www.claimyourjob.com', 'www.claimyourjob.fr']) {
      const r = await appeler(`https://${h}/claim-job-board.html`);
      assert.equal(r.status, 301);
      assert.equal(r.headers.get('location'), `${SOURCE}/job-board.html`,
        `${h}/claim-job-board.html ne mène pas au board`);
    }
  });

  // ── Règle 3 : le .fr est un alias, tout entier ────────────────────────
  await t.test('le .fr redirige vers le marché, chemin conservé', async () => {
    for (const [avant, apres] of [
      ['/', '/'],
      ['/job-board.html', '/job-board.html'],
      ['/offre/actuaire-senior', '/offre/actuaire-senior'],
      ['/a-propos.html', '/a-propos.html'],
    ]) {
      const r = await appeler(`https://claimyourjob.fr${avant}`);
      assert.equal(r.status, 301, `claimyourjob.fr${avant} répond ${r.status}`);
      assert.equal(r.headers.get('location'), `${SOURCE}${apres}`,
        `claimyourjob.fr${avant} perd son chemin`);
    }
  });

  await t.test('le .fr conserve la query', async () => {
    const r = await appeler('https://claimyourjob.fr/job-board.html?q=actuaires%20%26%28data%29&page=2');
    assert.equal(
      r.headers.get('location'),
      `${SOURCE}/job-board.html?q=actuaires%20%26%28data%29&page=2`,
      'la recherche partagée est perdue dans la redirection'
    );
  });

  await t.test('le .fr ne laisse rien servir en dehors des assets', async () => {
    const r = await appeler('https://claimyourjob.fr/job-board.html');
    assert.equal(r.status, 301,
      'le .fr sert encore du contenu : deux adresses pour la même page, c\'est un doublon indexable');
  });

  await t.test('les assets du .fr convergent vers le .com', async () => {
    const r = await appeler('https://claimyourjob.fr/assets/theme.css');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), 'https://claimyourjob.com/assets/theme.css');
  });

  await t.test('les assets demandés sous /fr convergent vers la racine', async () => {
    const r = await appeler('https://claimyourjob.com/fr/assets/theme.css');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), 'https://claimyourjob.com/assets/theme.css');
  });

  // ── Règle 4 : les www convergent ──────────────────────────────────────
  await t.test('www converge vers l\'apex, chemin conservé', async () => {
    for (const h of ['www.claimyourjob.com', 'www.claimyourjob.fr']) {
      const r = await appeler(`https://${h}/job-board.html`);
      assert.equal(r.status, 301, `${h} ne converge pas`);
      assert.equal(r.headers.get('location'), `${SOURCE}/job-board.html`);
    }
    const racine = await appeler('https://www.claimyourjob.com/');
    assert.equal(racine.headers.get('location'), `${SOURCE}/`);
  });

  // ── Règle 5 : une seule source indexable ──────────────────────────────
  await t.test('le maillage servi reste sous /fr', async () => {
    const r = await appeler('https://claimyourjob.com/fr/job-board.html');
    const corps = await r.text();
    assert.ok(corps.includes('href="/fr/job-board.html"'),
      'un lien du site repart vers la racine : deux redirections par clic');
    assert.ok(!/href="\/job-board\.html"/.test(corps),
      'un lien root-relative subsiste dans le maillage');
  });

  await t.test('aucun chemin servi ne double le préfixe', async () => {
    const r = await appeler('https://claimyourjob.com/fr/a-propos.html');
    const corps = await r.text();
    assert.ok(!/\/fr\/fr\//.test(corps),
      'le préfixe est appliqué deux fois : la page mène à un 404');
  });

  await t.test('les assets et les liens externes ne sont pas touchés', async () => {
    const { reecrireLiens } = await import('../src/maillage.js');
    const entree = [
      '<a href="/job-board.html">b</a>',
      '<a href="#ancre">a</a>',
      '<a href="mailto:contact@claimyourjob.fr">m</a>',
      '<a href="https://exemple.org/x">e</a>',
      '<a href="//exemple.org/x">p</a>',
      '<a href="?page=2">q</a>',
      '<img src="/assets/theme.css">',
      '<img src="/fr/deja.png">',
    ].join('');
    const sortie = reecrireLiens(entree);
    assert.ok(sortie.includes('href="/fr/job-board.html"'), 'le chemin du site n\'est pas préfixé');
    assert.ok(sortie.includes('href="#ancre"'), 'un fragment a été réécrit : il ne change pas de page');
    assert.ok(sortie.includes('href="mailto:contact@claimyourjob.fr"'), 'un lien mailto a été réécrit');
    assert.ok(sortie.includes('href="https://exemple.org/x"'), 'un lien absolu a été réécrit');
    assert.ok(sortie.includes('href="//exemple.org/x"'), 'un protocole relatif a été réécrit');
    assert.ok(sortie.includes('href="?page=2"'), 'une query absolue a été réécrite');
    assert.ok(sortie.includes('src="/assets/theme.css"'), 'un asset a été réécrit');
    assert.ok(sortie.includes('src="/fr/deja.png"'), 'un chemin déjà sous /fr a été redoublé');
  });

  await t.test('le sitemap déclare la source unique', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'pages', 'sitemap.js'), 'utf8');
    assert.match(source, /SITE_URL_PAR_DEFAUT = 'https:\/\/claimyourjob\.com\/fr'/,
      'la valeur de repli du sitemap n\'est plus la source');
  });

  await t.test('le robots déclare la source unique', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'pages', 'robots.js'), 'utf8');
    assert.match(source, /Sitemap: \$\{site\}\/sitemap\.xml/,
      'le robots.txt ne mène plus au sitemap de la source');
    assert.ok(!/claimyourjob\.fr/.test(source),
      'le robots.txt cite encore le .fr : il laisserait croire qu\'il est la source');
  });

  await t.test('aucune page ne déclare le .fr en canonique', async () => {
    const pages = ['index.html', 'job-board.html', 'claim-entreprises.html',
      'claim-observatoire.html', 'a-propos.html', 'cgu.html',
      'confidentialite.html', 'contact.html'];
    for (const page of pages) {
      const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
      const canonique = /<link rel="canonical" href="([^"]+)"/.exec(html);
      if (!canonique) continue;
      assert.ok(canonique[1].startsWith(SOURCE),
        `${page} déclare ${canonique[1]} : le .fr et le .com/fr seraient tous deux indexables`);
    }
  });

  await t.test('le monitoring reste fermé, sur les deux domaines', async () => {
    for (const u of ['https://claimyourjob.com/monitoring', 'https://claimyourjob.fr/monitoring']) {
      const r = await appeler(u);
      assert.ok(r.status === 401 || r.status === 403 || r.status === 302,
        `le monitoring répond ${r.status} : le tableau de bord interne ne doit pas s'ouvrir`);
    }
  });
});
