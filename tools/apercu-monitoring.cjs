// Rendu du dashboard avec des données de démonstration, pour vérifier
// l'aspect réel de la page (et attraper les erreurs d'exécution).
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = '/tmp/claim-frontend';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };

const jours = ['2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29'];
const SOURCES = [
  ['axa','custom','ok',101,[88,101,101,100,99,101,102]],
  ['apicil','custom','erreur',0,[0,0,null,96,101,12,0]],
  ['bnp_cardif','custom','ok',160,[160,161,160,162,159,160,161]],
  ['covea','workday','retard',74,[74,73,74,null,null,74,74]],
  ['macif','api','ok',102,[100,101,102,102,101,102,102]],
  ['wttj_static','custom','bloquee',0,[31,29,null,null,null,null,null]],
  ['generali','custom','ok',54,[54,55,54,53,54,null,54]],
  ['allianz','custom','jamais',0,[null,null,null,null,null,null,null]],
];

const cartes = [
  { key:'service', label:'État du service', value:'Disponible', unit:null, status:'available', tone:'ok', detail:'Site, API publique et lecture de la base.' },
  { key:'sources_recentes', label:'Sources récentes', value:63, unit:'/ 63', status:'available', tone:'ok', detail:'Toutes les sources ont été rafraîchies récemment.' },
  { key:'offres_publiees', label:'Offres publiées', value:334, unit:'offres', status:'available', tone:'neutre', detail:'Même périmètre que le board public.' },
  { key:'nouveautes', label:'Nouvelles sur 7 j', value:29, unit:'offres', status:'available', tone:'neutre', detail:'Première apparition en base.' },
  { key:'a_classer', label:'Offres à classer', value:1370, unit:'offres', status:'available', tone:'attention', detail:'Classification métier en attente.' },
  { key:'recherches_vides', label:'Recherches sans résultat', value:null, unit:null, status:'unavailable', reason:'Instrumentation d’usage non branchée', tone:'inconnu', detail:'Disponible au lot 4.' },
];

const apercu = {
  generated_at: '2026-10-29T19:40:00+00:00', period_days: 7, cards: cartes,
  alerts: { critiques: 2, attention: 1, total: 3 },
  collection: { statut:'degrade', diagnostic:'3 sources à traiter sur 63.', sources_attendues:63, sources_a_jour:60, seuils:{retard_heures:48,blocage_heures:2} },
  coeur_actifs: 334, jours,
  serie: [
    {jour:'2026-10-23',runs:66,succes:3,echecs:63,offres:0},
    {jour:'2026-10-24',runs:211,succes:68,echecs:143,offres:5057},
    {jour:'2026-10-25',runs:132,succes:131,echecs:1,offres:10923},
    {jour:'2026-10-26',runs:125,succes:124,echecs:1,offres:10497},
    {jour:'2026-10-27',runs:129,succes:127,echecs:2,offres:10917},
    {jour:'2026-10-28',runs:127,succes:64,echecs:63,offres:5432},
    {jour:'2026-10-29',runs:63,succes:63,echecs:0,offres:5452},
  ],
  probes: { sondes: [], base: { disponible:true } },
};

const sources = {
  generated_at: apercu.generated_at, period_days: 7, jours,
  serie: apercu.serie,
  verdict: { statut:'degrade', diagnostic:'3 sources à traiter sur 63.', seuils:{retard_heures:48,blocage_heures:2} },
  sources: SOURCES.map(([slug, ats, etat, found, spark]) => ({
    source_slug: slug, ats_type: ats, etat, derniere_tentative:'2026-10-29T03:05:00+00:00',
    dernier_succes: etat === 'jamais' ? null : '2026-10-29T03:07:00+00:00',
    statut_run: etat === 'ok' ? 'success' : 'error', total_found: found,
    erreur: etat === 'erreur' ? 'HTTP 403 — Cloudflare' : null, etincelle: spark,
  })),
};

const alertes = {
  generated_at: apercu.generated_at, total: 4, ouverts: 3,
  seuils: { retard_heures: 48, blocage_heures: 2 },
  alertes: [
    { key:'source_erreur:apicil', rule:'source_erreur', subject:'apicil', gravite:'critique', titre:'Collecte en erreur — apicil', detail:null, acquittee:false },
    { key:'source_bloquee:wttj_static', rule:'source_bloquee', subject:'wttj_static', gravite:'critique', titre:'Collecte bloquée — wttj_static', detail:null, acquittee:false },
    { key:'source_retard:covea', rule:'source_retard', subject:'covea', gravite:'attention', titre:'Source en retard — covea', detail:null, acquittee:false },
    { key:'source_vide:bnp', rule:'source_vide', subject:'bnp', gravite:'attention', titre:'Source à zéro offre — bnp', detail:'Référence : 160 offres/jour', acquittee:true },
  ],
};

const qualite = {
  generated_at: apercu.generated_at, published: 334,
  champs: [
    { champ:'title', manquants:0, part:0 }, { champ:'company_id', manquants:1, part:0.3 },
    { champ:'city', manquants:1, part:0.3 }, { champ:'source_url', manquants:0, part:0 },
  ],
  liens: { verifies_valides:73, non_verifies:261, part_non_verifies:78.1 },
  classification: { a_classer:1370, coeur:334, exclu:4361, part_coeur:7.1 },
  ecart_coeur_publie: { value:0, status:'non_discriminant', reason:'coïncident' },
};

const operations = {
  generated_at: apercu.generated_at,
  probes: [
    { nom:'Site public', disponible:true, code:200, latence_ms:268, verifie_le: apercu.generated_at },
    { nom:'API publique', disponible:true, code:200, latence_ms:721, verifie_le: apercu.generated_at },
  ],
  sauvegarde: { status:'unavailable', reason:'Aucune preuve de sauvegarde exposée' },
  couts: { status:'unavailable', reason:'Coûts non importés' },
};

const serveur = http.createServer((req, res) => {
  const chemin = decodeURIComponent(req.url.split('?')[0]);
  const fichier = path.join(RACINE, chemin === '/' ? 'monitoring.html' : chemin);
  if (!fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
    res.writeHead(404); return res.end('nope');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
  fs.createReadStream(fichier).pipe(res);
});

(async () => {
  await new Promise((r) => serveur.listen(8124, r));
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const page = await ctx.newPage();

  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(`console: ${m.text()}`); });

  await page.route('**/monitoring/api/**', async (route) => {
    const url = route.request().url();
    const corps = url.includes('/session') ? { authenticated: true, expires_in: 3600 }
      : url.includes('/overview') ? apercu
      : url.includes('/sources') ? sources
      : url.includes('/alerts') ? alertes
      : url.includes('/quality') ? qualite
      : url.includes('/operations') ? operations
      : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });

  await page.goto('http://127.0.0.1:8124/monitoring.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/shot-apercu.png', fullPage: true });

  await page.click('#onglet-collecte');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/shot-collecte.png', fullPage: true });

  await page.click('#onglet-qualite');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/shot-qualite.png', fullPage: true });

  // Contrôles de mise en page
  const mesures = await page.evaluate(() => ({
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
    largeur: document.documentElement.scrollWidth,
    tableaux: document.querySelectorAll('table').length,
    chiffres: document.querySelectorAll('.chiffre').length,
    barres: document.querySelectorAll('.verdict__seg').length,
    eticelles: document.querySelectorAll('.eticelle i').length,
  }));

  // Vue mobile : le rail devient une barre horizontale, les chiffres
  // s'empilent. On vérifie surtout qu'aucun débordement horizontal
  // n'apparaît — c'est le défaut le plus courant d'un tableau dense.
  const ctxMobile = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const mobile = await ctxMobile.newPage();
  await mobile.route('**/monitoring/api/**', async (route) => {
    const url = route.request().url();
    const corps = url.includes('/session') ? { authenticated: true, expires_in: 3600 }
      : url.includes('/overview') ? apercu
      : url.includes('/sources') ? sources
      : url.includes('/alerts') ? alertes
      : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
  await mobile.goto('http://127.0.0.1:8124/monitoring.html', { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(600);
  await mobile.screenshot({ path: '/tmp/shot-mobile.png', fullPage: true });
  const mesuresMobile = await mobile.evaluate(() => ({
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
    largeur: document.documentElement.scrollWidth,
  }));

  console.log(JSON.stringify({ erreurs, mesures, mesuresMobile }, null, 2));
  await nav.close();
  serveur.close();
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
