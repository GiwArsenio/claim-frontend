#!/usr/bin/env node
// tests/monitoring.test.cjs — Contrôles statiques du dashboard de monitoring.
//
// Ces vérifications ne parlent à aucun réseau. Elles portent sur des
// propriétés que la relecture oublie et qu'une revue ne rattrape pas :
//
//   - aucun secret ne doit se trouver dans un fichier servi au navigateur ;
//   - l'ordre des routes du Worker doit placer le relais API avant la page ;
//   - la page interne ne doit pas être mesurée par GA4 ni indexée ;
//   - le cookie doit rester confiné au chemin /monitoring.
//
// Un fichier de page qui contiendrait la clé admin serait une fuite
// silencieuse : le site fonctionnerait parfaitement, et le droit de
// déclencher des collectes serait public.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const lire = (relatif) => fs.readFileSync(path.join(RACINE, relatif), 'utf8');

let controles = 0;
function verifier(intitule, fonction) {
  fonction();
  controles += 1;
  console.log(`  ok  ${intitule}`);
}

console.log('Monitoring — contrôles statiques');

// ── Fichiers présents ────────────────────────────────────────────────────
verifier('les quatre fichiers du dashboard existent', () => {
  for (const fichier of [
    'monitoring.html',
    'assets/monitoring.js',
    'assets/monitoring.css',
    'src/pages/monitoring.js',
  ]) {
    assert.ok(fs.existsSync(path.join(RACINE, fichier)), `${fichier} manquant`);
  }
});

// ── Aucun secret côté navigateur ─────────────────────────────────────────
verifier('aucun fichier servi ne contient de clé admin ni d’en-tête X-Admin-Key', () => {
  for (const fichier of ['monitoring.html', 'assets/monitoring.js']) {
    const contenu = lire(fichier);
    assert.ok(
      !/x-admin-key/i.test(contenu),
      `${fichier} envoie ou mentionne X-Admin-Key : la clé ne doit jamais vivre dans le navigateur`
    );
    assert.ok(
      !/ADMIN_API_KEY|claim-admin-key|CONSOLE_ADMIN/i.test(contenu),
      `${fichier} mentionne une variable de clé d'administration`
    );
  }
});

verifier('le client n’écrit aucun secret dans le stockage local', () => {
  const contenu = lire('assets/monitoring.js');
  assert.ok(!/localStorage/.test(contenu), 'localStorage ne doit pas porter de session');
  assert.ok(!/sessionStorage/.test(contenu), 'sessionStorage ne doit pas porter de session');
});

// ── Page interne ─────────────────────────────────────────────────────────
verifier('la page est exclue de l’indexation et de la mesure d’audience', () => {
  const page = lire('monitoring.html');
  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  // Le dashboard n'a pas à alimenter GA4 : mêler des sessions internes aux
  // statistiques d'usage fausserait les taux du site public.
  assert.ok(!/googletagmanager|gtag\(/i.test(page), 'GA4 ne doit pas être chargé sur la page interne');
});

verifier('la page charge un CSS et un JS dédiés, pas ceux du site public', () => {
  const page = lire('monitoring.html');
  assert.match(page, /href="\/assets\/monitoring\.css"/);
  assert.match(page, /src="\/assets\/monitoring\.js"/);
  // Partager theme.css exposerait le dashboard aux règles du site public,
  // et réciproquement : c'est exactement l'incident qui a fait dérailler
  // un test de style de la fiche d'offre.
  assert.ok(!/theme\.css/.test(page), 'le dashboard ne doit pas dépendre de theme.css');
});

verifier('la page expose une navigation par onglets accessible', () => {
  const page = lire('monitoring.html');
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tabpanel"/);
  assert.match(page, /aria-selected/);
  assert.match(page, /aria-live="polite"/, 'les mises à jour doivent être annoncées');
});

verifier('le dashboard est écarté de l’exploration et du sitemap', () => {
  const robots = lire('src/pages/robots.js');
  assert.match(robots, /Disallow: \/monitoring/, 'robots.txt doit écarter une adresse fermée');
  const sitemap = lire('src/pages/sitemap.js');
  assert.ok(!/monitoring/.test(sitemap), 'une page privée ne doit pas figurer au sitemap');
});

// ── Worker : ordre des routes et relais ──────────────────────────────────
verifier('le relais API est routé avant la page', () => {
  const worker = lire('src/index.js');
  const positionRelais = worker.indexOf("chemin.startsWith('/monitoring/api/')");
  const positionPage = worker.indexOf("chemin === '/monitoring'");
  assert.ok(positionRelais > 0, 'route du relais absente');
  assert.ok(positionPage > 0, 'route de la page absente');
  assert.ok(
    positionRelais < positionPage,
    'le relais doit précéder la page : /monitoring/api/ commence aussi par /monitoring'
  );
});

verifier('le relais transmet l’adresse réelle du visiteur', () => {
  const module = lire('src/pages/monitoring.js');
  assert.match(
    module,
    /cf-connecting-ip/,
    'sans cet en-tête, toutes les tentatives de connexion viendraient d’une même adresse Cloudflare'
  );
  assert.match(module, /x-forwarded-for/);
});

verifier('le relais n’ouvre aucun CORS et ne réécrit pas le cookie', () => {
  const module = lire('src/pages/monitoring.js');
  assert.ok(
    !/access-control-allow-origin/i.test(module),
    'le relais rend CORS inutile : en ajouter un élargirait la surface'
  );
  assert.match(module, /no-store/, 'les réponses privées ne doivent pas être mises en cache');
});

verifier('la page n’est servie qu’avec un cookie présent', () => {
  const module = lire('src/pages/monitoring.js');
  assert.match(module, /if \(!lireCookie\(request\)\)/, 'la page doit être retenue sans cookie');
  assert.match(module, /status: 401/);
});

// ── Contrat avec l’API ───────────────────────────────────────────────────
verifier('le client appelle les routes réellement exposées par l’API', () => {
  const client = lire('assets/monitoring.js');
  const routesAttendues = ['/overview', '/alerts', '/sources', '/quality', '/operations', '/session'];
  for (const route of routesAttendues) {
    assert.ok(client.includes(`'${route}`) || client.includes(`\`${route}`), `route ${route} non appelée`);
  }
});

verifier('le client ne convertit jamais une absence en zéro', () => {
  const client = lire('assets/monitoring.js');
  // La fonction `valeur` est le seul point de formatage des nombres :
  // elle doit rendre un tiret pour null/undefined, pas « 0 ».
  // Les deux seuls points de formatage d'un nombre. Chacun doit rendre un
  // tiret cadratin pour `null` — jamais « 0 », qui se lirait comme une
  // mesure réelle.
  assert.match(client, /if \(v === null \|\| v === undefined\) return '—'/, 'formatage des valeurs');
  assert.match(client, /if \(p === null \|\| p === undefined\) return '—'/, 'formatage des parts');
});

verifier('le client protège contre une réponse tardive', () => {
  const client = lire('assets/monitoring.js');
  assert.match(client, /const numero = \+\+etat\.chargement/, 'un compteur de chargement doit exister');
  assert.match(client, /numero === etat\.chargement/, 'seul le dernier chargement doit écrire');
});

console.log(`\n${controles} contrôles passés.`);
