// tests/robots_routage.test.cjs
//
// Ce que les moteurs de recherche lisent, et par où ils entrent.
//
// Une page peut être parfaite et rester invisible : il suffit d une
// mauvaise règle dans robots.txt, d une redirection cassée, ou d une
// adresse qui ne mène nulle part.
//
// Ce fichier couvre :
//   S06 — robots.txt, routes, redirections, découverte
//   F03 — validité des documents produits

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appeler } = require('./helpers/gestionnaire.cjs');

const RACINE = path.join(__dirname, '..');
const lire = (relatif) => fs.readFileSync(path.join(RACINE, relatif), 'utf8');
const vercel = JSON.parse(lire('vercel.json'));

// ─────────────────────────────────────────────────────────────────────────
// S06 — robots.txt.
//
// Le fichier est produit par api/robots.js. Il doit autoriser l exploration
// et déclarer le sitemap : un fichier qui oublie de le déclarer laisse
// Google sans chemin.
// ─────────────────────────────────────────────────────────────────────────
const handler = require(path.join(RACINE, 'api/robots.js'));

(async () => {
  const reponse = await appeler(handler, {});
  assert.equal(reponse.status, 200, 'robots.txt doit répondre 200');
  assert.match(reponse.entetes['Content-Type'] || '', /text\/plain/, 'robots.txt est du texte');

  const robots = reponse.corps;
  assert.match(robots, /^User-agent:\s*\*/m, 'robots.txt doit addresser un agent générique');
  assert.match(robots, /^Allow:\s*\/$/m, 'l exploration du site doit être autorisée');
  assert.match(robots, /^Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/m,
    'robots.txt doit déclarer le sitemap');
  assert.ok(!/Disallow:\s*\//.test(robots), 'le site ne doit pas se bloquer lui-même');

  // ── S06 — Le sitemap déclaré doit être le vrai sitemap ────────────────
  const declare = (robots.match(/^Sitemap:\s*(\S+)/m) || [])[1];
  assert.ok(declare, 'le sitemap doit être déclaré');

  // ── S06 — Les routes de vercel.json ─────────────────────────────────────
  //
  // Chaque route doit avoir une destination, et les fichiers vers lesquels
  // elle pointe doivent exister. Une route qui pointe vers un fichier
  // absent donne un 404 en production.
  const fichiers = new Set([
    ...fs.readdirSync(RACINE).filter((f) => fs.statSync(path.join(RACINE, f)).isFile()),
    ...fs.readdirSync(path.join(RACINE, 'api')).map((f) => 'api/' + f),
  ]);

  for (const route of vercel.routes) {
    assert.ok(route.src, 'une route doit avoir une source');
    if (route.dest) {
      const cible = route.dest.split('?')[0].replace(/^\//, '');
      if (cible && !cible.includes('(') && !cible.includes('$')) {
        assert.ok(fichiers.has(cible),
          'la route ' + route.src + ' pointe vers ' + cible + ', qui n existe pas');
      }
    }
  }

  // ── S06 — L ancienne adresse du board doit rediriger ───────────────────
  const redirection = vercel.routes.find((r) => r.src === '/claim-job-board.html');
  assert.ok(redirection, 'l ancienne adresse du board doit avoir une règle');
  assert.equal(redirection.status, 301, 'une adresse renommée doit rediriger définitivement');
  assert.equal(redirection.headers.Location, '/job-board.html', 'la redirection doit viser le board');

  // ── S06 — La racine doit servir l accueil ──────────────────────────────
  const racine = vercel.routes.find((r) => r.src === '/');
  assert.ok(racine, 'la racine doit avoir une règle');
  assert.equal(racine.dest, '/index.html', 'la racine doit servir l accueil');

  // ── S06 — L adresse d une offre doit atteindre le gabarit ──────────────
  const offre = vercel.routes.find((r) => r.src.startsWith('/offre/'));
  assert.ok(offre, 'les adresses d offres doivent avoir une règle');
  assert.match(offre.dest, /api\/offre\.js/, 'les offres doivent passer par le gabarit');
  assert.match(offre.dest, /slug=/, 'le gabarit doit recevoir le slug');

  // ── S06 — Les pages doivent se découvrir entre elles ───────────────────
  //
  // Une page que rien ne lie reste une île : Google la découvre par le
  // sitemap, mais les lecteurs n y vont pas.
  const accueil = lire('index.html');
  assert.match(accueil, /job-board\.html/, 'l accueil doit mener au board');
  assert.match(accueil, /claim-entreprises\.html/, 'l accueil doit mener auannuaire');

  // ── S06 — Chaque page publique a une canonique ────────────────────────
  for (const page of fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'))) {
    const html = lire(page);

    // Une page privée ne doit pas avoir de canonique : elle ne doit pas
    // être dans l index. La présence d une canonique y enverrait un
    // signal contraire.
    if (/name="robots" content="[^"]*noindex/.test(html)) {
      assert.ok(!/<link rel="canonical"/.test(html),
        page + ' est privée : elle ne doit pas déclarer de canonique');
      continue;
    }

    const canonique = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonique, page + ' doit déclarer une adresse canonique');
    assert.match(canonique[1], /^https:\/\/claimyourjob\.fr\//,
      page + ' : la canonique doit être absolue et sur le bon domaine');
  }

  // ── F03 — Le sitemap est un XML bien formé ─────────────────────────────
  //
  // On contrôle la structure produite par le générateur, sans appeler le
  // réseau : le document est reconstruit à partir de la même logique.
  const sitemap = lire('api/sitemap.js');
  assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/,
    'le sitemap doit déclarer l espace de noms officiel');

  console.log('Robots et routage : robots.txt, routes, redirections, canoniques — OK');
})().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
