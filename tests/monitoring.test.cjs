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
  // Le monitoring est traité sur les deux domaines : la première
  // occurrence de chaque route suffit à établir l'ordre.
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



// ── Un changement d'onglet ne recharge pas l'aperçu ─────────────────────
//
// Le premier jet rechargeait l'aperçu complet à chaque clic d'onglet :
// trois appels réseau de plus pour une information déjà affichée. La
// latence perçue doublait pour rien. Ces contrôles verrouillent la
// règle : l'aperçu ne se recharge que sur une demande explicite.

verifier("un changement d'onglet ne charge que l'onglet demande", () => {
  const client = lire('assets/monitoring.js');
  // L'ancien code avait une ligne du type "si ce n'est pas l'aperçu,
  // recharge l'aperçu". Elle ne doit pas revenir.
  assert.ok(
    !/if \(etat\.onglet !== .apercu.\) await chargerApercu\(\)/.test(client),
    "le chargement d'un onglet ne doit pas recharger l'aperçu en doublon"
  );
  // La nouvelle règle : l'aperçu n'est rechargé que s'il n'est pas frais.
  assert.match(client, /etat\.apercuCharge/, "l'état doit porter la fraîcheur de l'aperçu");
});

verifier("l'aperçu se rafraîchit sur demande explicite, pas en silence", () => {
  const client = lire('assets/monitoring.js');
  // Le bouton "Actualiser", le retour de visibilité et le changement de
  // période sont les trois moments qui doivent reprendre l'aperçu.
  const appels = (client.match(/chargerTout\(\{ apercu: true \}\)/g) || []).length;
  assert.ok(appels >= 3, `seulement ${appels} rafraichissements explicites : il en faut au moins trois`);
});

verifier("le changement de periode invalide l'aperçu en mémoire", () => {
  const client = lire('assets/monitoring.js');
  // Une valeur calculée pour 7 jours ne vaut pas pour 30 : la période
  // change, l'aperçu doit être repris.
  assert.match(client, /etat\.apercuCharge = false/, "le changement de période doit marquer l'aperçu comme périmé");
});

verifier("le premier affichage charge l'aperçu", () => {
  const client = lire('assets/monitoring.js');
  // Le cache ne doit pas empêcher le tout premier rendu : sans lui, la
  // vue d'ensemble resterait vide jusqu'au premier clic.
  const debut = client.indexOf('async function demarrer');
  assert.ok(debut > 0, 'la fonction de démarrage manque');
  assert.match(client.slice(debut), /chargerTout\(\{ apercu: true \}\)/,
    "le démarrage doit charger l'aperçu, pas seulement l'onglet courant");
});

// ═══════════════════════════════════════════════════════════════════════════
// Lot 6 — Tests de non-régression
//
// Ces contrôles verrouillent les règles métier du dashboard. Une
// optimisation qui les casse n'est pas une optimisation, c'est une
// régression silencieuse.
//
// Cinq règles, cinq familles de contrôles :
//
//   1. une donnée absente reste absente (jamais un zéro) ;
//   2. une réponse tardive n'écrase jamais une réponse récente ;
//   3. les routes appelées par le client existent dans le relais ;
//   4. aucun secret côté navigateur ;
//   5. l'aperçu ne se recharge pas en doublon.
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Absence de zéro : valeur() et part() ──────────────────────────────
//
// `valeur()` et `part()` sont les deux seuls points de formatage des
// nombres. Chacun doit rendre un tiret cadratin pour `null`/`undefined` —
// jamais « 0 », qui se lirait comme une mesure réelle.

verifier("valeur() rend '—' pour null et undefined, jamais '0'", () => {
  const client = lire('assets/monitoring.js');
  const bloc = client.match(/function valeur\(v\) \{[\s\S]*?\n  \}/);
  assert.ok(bloc, "la fonction valeur() est introuvable");
  const corps = bloc[0];
  assert.match(corps, /if \(v === null \|\| v === undefined\) return '—'/,
    "valeur() doit rendre '—' pour null/undefined");
  assert.ok(!/return ['\"]0['\"]/.test(corps),
    "valeur() ne doit jamais rendre '0' pour une absence");
  // Le zéro mesuré reste un zéro : c'est le seul cas où 0 est affiché.
  assert.match(corps, /typeof v !== 'number'/,
    "valeur() doit distinguer les nombres des autres types");
});

verifier("part() rend '—' pour null et undefined, jamais '0 %'", () => {
  const client = lire('assets/monitoring.js');
  const bloc = client.match(/function part\(p\) \{[\s\S]*?\n  \}/);
  assert.ok(bloc, "la fonction part() est introuvable");
  const corps = bloc[0];
  assert.match(corps, /if \(p === null \|\| p === undefined\) return '—'/,
    "part() doit rendre '—' pour null/undefined");
  assert.ok(!/return ['\"]0/.test(corps),
    "part() ne doit jamais rendre '0 %' pour une absence");
});

verifier("aucun formatage de nombre ne convertit null en zéro", () => {
  const client = lire('assets/monitoring.js');
  // Le pattern dangereux : `(x || 0)` ou `(x ?? 0)` dans un formatage.
  // Un zéro affiché pour une absence est un mensonge.
  // On tolère `?? 0` dans les contextes de comptage de runs (où 0 est
  // correct : un jour sans passage est un jour à zéro passage), mais pas
  // dans les fonctions de formatage.
  const formatage = ['valeur', 'part', 'duree', 'heure', 'depuis'];
  for (const nom of formatage) {
    const bloc = client.match(new RegExp(`function ${nom}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
    if (!bloc) continue;
    assert.ok(!/\|\| 0\b|\?\? 0\b/.test(bloc[0]),
      `la fonction ${nom}() ne doit pas convertir une absence en zéro`);
  }
});

// ── 2. Réponse tardive : le compteur de chargement ───────────────────────
//
// Chaque chargement porte un numéro ; seul le dernier a le droit d'écrire.
// Sans cette garde, une réponse lente écraserait les données fraîches.

verifier("le compteur de chargement est initialisé dans l'état", () => {
  const client = lire('assets/monitoring.js');
  assert.match(client, /chargement:\s*0/,
    "etat.chargement doit être initialisé à 0");
});

verifier("la garde numero === etat.chargement est présente", () => {
  const client = lire('assets/monitoring.js');
  const gardes = client.match(/numero === etat\.chargement/g) || [];
  assert.ok(gardes.length >= 1,
    `la garde 'numero === etat.chargement' doit être présente (${gardes.length} trouvée(s))`);
  // Le compteur doit être incrémenté avant l'appel réseau.
  assert.match(client, /const numero = \+\+etat\.chargement/,
    "le compteur doit être incrémenté avant l'appel réseau");
});

// ── 3. Les routes appelées par le client existent dans le relais ────────
//
// Le relais du Worker transmet `reste` tel quel à `/admin/monitoring/${reste}`.
// Si le client appelle une route que le relais ne peut pas router, c'est
// une route orpheline.

verifier("les routes du client existent dans le relais du Worker", () => {
  const client = lire('assets/monitoring.js');
  const relais = lire('src/pages/monitoring.js');
  // Le relais doit reconstruire l'URL vers l'API avec le reste du chemin.
  assert.match(relais, /admin\/monitoring\/\$\{reste\}/,
    "le relais doit transmettre le reste du chemin à l'API");
  // Le client appelle `API + chemin` où API = '/monitoring/api'.
  assert.match(client, /const API = ['"]\/monitoring\/api['"]/,
    "le client doit pointer vers le relais /monitoring/api");
});

verifier("aucune route orpheline dans le client", () => {
  const client = lire('assets/monitoring.js');
  // Extraire toutes les routes appelées via appeler('...') ou appeler(`...`)
  const routes = new Set();
  for (const m of client.matchAll(/appeler\(\s*[`']([^`'\s?]+)/g)) {
    routes.add(m[1]);
  }
  // Les routes connues de l'API (déclarées dans claim-api/api/routers/monitoring.py)
  const routesAPI = new Set([
    '/session', '/overview', '/sources', '/alerts', '/quality',
    '/classification', '/cron', '/indexation', '/analytics', '/operations',
    // Lots D et E : décomposition par source et arbitrage des cas limites.
    '/classification/decomposition', '/limit-cases',
  ]);
  for (const route of routes) {
    // Les routes avec paramètres (ex: /alerts/${cle}/ack) sont vérifiées
    // par leur préfixe.
    const prefixe = route.split('/')[1];
    const connue = routesAPI.has(route) || routesAPI.has(`/${prefixe}`);
    assert.ok(connue, `route orpheline : ${route} n'existe pas dans l'API`);
  }
  assert.ok(routes.size >= 6, `seulement ${routes.size} routes trouvées dans le client`);
});

// ── 4. Aucun secret côté navigateur ──────────────────────────────────────
//
// La clé admin ne doit jamais vivre dans le navigateur. Un fichier servi
// qui contiendrait X-Admin-Key serait une fuite silencieuse.

verifier("aucun fichier servi ne contient X-Admin-Key", () => {
  for (const fichier of ['monitoring.html', 'assets/monitoring.js']) {
    const contenu = lire(fichier);
    assert.ok(!/x-admin-key/i.test(contenu),
      `${fichier} contient X-Admin-Key : la clé ne doit jamais vivre dans le navigateur`);
    assert.ok(!/ADMIN_API_KEY|claim-admin-key|CONSOLE_ADMIN/i.test(contenu),
      `${fichier} mentionne une variable de clé d'administration`);
  }
});

verifier("aucun secret dans localStorage ou sessionStorage", () => {
  const client = lire('assets/monitoring.js');
  assert.ok(!/localStorage/.test(client),
    "localStorage ne doit pas porter de session");
  assert.ok(!/sessionStorage/.test(client),
    "sessionStorage ne doit pas porter de session");
});

// ── 5. L'aperçu ne se recharge pas en doublon (lot 4) ───────────────────
//
// Déjà testé plus haut, mais on vérifie que les nouveaux tests ne se
// contredisent pas avec cette règle.

verifier("les règles de l'aperçu et de l'absence de zéro sont cohérentes", () => {
  const client = lire('assets/monitoring.js');
  // L'aperçu est mis en cache (etat.apercuCharge) ET les absences restent
  // absentes. Les deux règles ne doivent pas se contredire : le cache ne
  // doit pas transformer une absence en zéro.
  assert.match(client, /etat\.apercuCharge/,
    "l'aperçu doit être mis en cache");
  assert.match(client, /if \(v === null \|\| v === undefined\) return '—'/,
    "les absences doivent rester absentes même après cache");
});

verifier("le changement d'onglet ne recharge pas l'aperçu en doublon", () => {
  const client = lire('assets/monitoring.js');
  // L'ancien code avait une ligne du type "si ce n'est pas l'aperçu,
  // recharge l'aperçu". Elle ne doit pas revenir.
  assert.ok(!/if \(etat\.onglet !== ['"`]apercu['"`]\) await chargerApercu\(\)/.test(client),
    "le chargement d'un onglet ne doit pas recharger l'aperçu en doublon");
});



// ═══════════════════════════════════════════════════════════════════════════
// Lots D et E — Décomposition par source et arbitrage des cas limites
//
// Le frontend est codé en avance de phase sur les routes de l'API :
//
//   GET  /admin/monitoring/classification/decomposition
//   GET  /admin/monitoring/limit-cases
//   POST /admin/monitoring/limit-cases/{job_id}/decide
//
// Ces contrôles vérifient que le client les appelle, que l'arbitrage est
// accessible, et qu'aucune règle métier n'a glissé : pas de secret, pas
// de zéro pour une absence, garde anti-réponse tardive intacte.
// ═══════════════════════════════════════════════════════════════════════════

verifier("le client appelle les routes de décomposition et d'arbitrage", () => {
  const client = lire('assets/monitoring.js');
  assert.match(client, /appeler\(\s*['`]\/classification\/decomposition['`]/,
    "la décomposition par source doit être appelée");
  assert.match(client, /appeler\(\s*['`]\/limit-cases['`]/,
    "la liste des cas limites doit être appelée");
  assert.match(client, /\/limit-cases\/\$\{encodeURIComponent\(jobId\)\}\/decide/,
    "l'arbitrage doit viser /limit-cases/{job_id}/decide");
});

verifier("l'arbitrage envoie bien decision et comment", () => {
  const client = lire('assets/monitoring.js');
  const bloc = client.match(/async function arbitrerCasLimite[\s\S]*?\n  \}/);
  assert.ok(bloc, "la fonction d'arbitrage est introuvable");
  assert.match(bloc[0], /JSON\.stringify\(\{ decision: choix, comment:/,
    "le POST doit porter {decision, comment}");
  // Les deux seules décisions possibles, et elles viennent des boutons.
  assert.match(client, /data-decision="keep"/, 'bouton « Garder en cœur »');
  assert.match(client, /data-decision="exclude"/, 'bouton « Exclure »');
});

verifier("aucun secret ajouté par les lots D et E", () => {
  for (const fichier of ['monitoring.html', 'assets/monitoring.js']) {
    const contenu = lire(fichier);
    assert.ok(!/x-admin-key/i.test(contenu), `${fichier} contient X-Admin-Key`);
    assert.ok(!/ADMIN_API_KEY|claim-admin-key|CONSOLE_ADMIN/i.test(contenu),
      `${fichier} mentionne une variable de clé d'administration`);
  }
  const client = lire('assets/monitoring.js');
  assert.ok(!/localStorage|sessionStorage/.test(client),
    "aucun secret dans le stockage du navigateur");
});

verifier("le HTML généré contient les boutons d'arbitrage et le champ commentaire", () => {
  const client = lire('assets/monitoring.js');
  // Le gabarit est dans le client : il doit porter les deux boutons,
  // un groupement nommé pour les lecteurs d'écran, et une étiquette sur
  // la zone de commentaire.
  assert.match(client, /Garder en cœur/, "libellé du bouton garder");
  assert.match(client, />Exclure<|>Exclure`/, "libellé du bouton exclure");
  assert.match(client, /<textarea[^>]*data-commentaire=/, "champ commentaire");
  assert.match(client, /<span class="visuellement-cache">Commentaire pour/,
    "le commentaire doit porter une étiquette accessible");
  assert.match(client, /role="group" aria-label="Arbitrage de l’offre/,
    "le groupe de boutons doit être nommé");
  assert.match(client, /role="alert"/, "l'erreur d'arbitrage doit être annoncée");
});

verifier("la règle absence ≠ zéro est respectée dans les nouveaux blocs", () => {
  const client = lire('assets/monitoring.js');
  // Les cellules des nouvelles tables passent par valeur()/part(), les
  // deux seuls points de formatage qui rendent « — » pour null.
  const decomp = client.match(/function rendreDecompCuration[\s\S]*?\n  \}/);
  assert.ok(decomp, "rendreDecompCuration introuvable");
  assert.match(decomp[0], /valeur\(l\.total\)/, "les totaux passent par valeur()");
  assert.match(decomp[0], /valeur\(l\.sans_description\)/);
  assert.match(decomp[0], /valeur\(l\.avec_description\)/);
  // Pas de repli « || 0 » dans les nouveaux rendus : une absence reste
  // une absence.
  for (const nom of ['rendreDecompCuration', 'rendreDecompLimites', 'rendreCasLimites']) {
    const bloc = client.match(new RegExp(`function ${nom}[\\s\\S]*?\\n  \\}`));
    if (!bloc) continue;
    assert.ok(!/\|\| 0\b|\?\? 0\b/.test(bloc[0]),
      `${nom}() ne doit pas convertir une absence en zéro`);
  }
  const limites = client.match(/function rendreDecompLimites[\s\S]*?\n  \}/);
  assert.match(limites[0], /part\(l\.probabilite_moyenne\)/,
    "la probabilité moyenne passe par part()");
  // Une API muette n'est pas une table vide : la raison est écrite.
  assert.match(client, /Non disponible — /,
    "une donnée absente doit être annoncée « Non disponible » avec sa raison");
});

verifier("une réponse tardive ne déplace pas la pagination des cas limites", () => {
  const client = lire('assets/monitoring.js');
  // La pagination découpe une liste déjà en mémoire : elle ne déclenche
  // aucun appel réseau, donc aucune réponse tardive à craindre. En
  // revanche, le chargement de la liste doit repartir de la page 1 —
  // c'est écrit dans chargerDecomposition.
  const bloc = client.match(/async function chargerDecomposition[\s\S]*?\n  \}/);
  assert.ok(bloc, "chargerDecomposition introuvable");
  assert.match(bloc[0], /etat\.casLimitesPage = 1/,
    "une nouvelle liste doit repartir de la première page");
  // La garde générale reste intacte dans le fichier.
  assert.match(client, /numero === etat\.chargement/,
    "la garde anti-réponse tardive doit survivre aux lots D et E");
});

verifier("les boutons d'arbitrage sont désactivés pendant l'appel", () => {
  const client = lire('assets/monitoring.js');
  const bloc = client.match(/async function arbitrerCasLimite[\s\S]*?\n  \}/);
  assert.match(bloc[0], /b\.disabled = true/, "les boutons se désactivent pendant l'appel");
  assert.match(bloc[0], /b\.disabled = false/, "ils reviennent si l'appel échoue");
  // Une décision prise marque la ligne et désactive pour de bon.
  assert.match(bloc[0], /rendreCasLimites\(\)/, "la ligne est re-rendue après décision");
});

console.log(`\n${controles} contrôles passés.`);
