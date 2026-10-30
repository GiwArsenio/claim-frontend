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
  { key:'offres_actives', label:'Offres actives', value:4695, unit:'offres', status:'available', tone:'neutre', detail:'Toute la base active, avant classement métier.' },
  { key:'offres_publiees', label:'Offres publiées', value:334, unit:'offres', status:'available', tone:'neutre', detail:'Même périmètre que le board public.' },
  { key:'offres_coeur', label:'Offres cœur', value:334, unit:'offres', status:'available', tone:'neutre', detail:'7,1 % des offres actives.' },
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
  cron: { statut: 'bloque', diagnostic: '1 passage(s) ouvert(s) depuis plus de 4 h.',
    ouverts: 1, bloques: ['2026-10-27'], retard: false,
    prochain: '2026-10-30T03:00:00+00:00', horaires_utc: [3, 4, 10], seuil_blocage_heures: 4,
    dernier: { business_date_utc: '2026-10-29', status: 'completed',
      started_at: '2026-10-29T03:04:20+00:00', finished_at: '2026-10-29T05:46:27+00:00' } },
  classification: { actifs: 4695, coeur: 334, exclu: 4361, a_classer: 1370, classes: 3325,
    cas_limites: 35, curation_attente: 4683, curation_echec: 0, part_coeur: 7.1, part_a_classer: 29.2 },
  // L'etat de la classification dans la vue d'ensemble. C'est l'etat
  // REEL du 30 octobre : les passages ont eu lieu, aucun ne portait de
  // compteur, la mesure n'est pas encore instrumentee.
  etat_classification: { statut: 'non_instrumentee',
    diagnostic: '850 passage(s) ont eu lieu, aucun ne portait de compteur : la mesure n\'est pas encore instrumentee.',
    depuis: null, jours_mesures: 0, jours_non_mesures: 7, passages: 850 },
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

const cron = {
  generated_at: apercu.generated_at, period_days: 7,
  resume: { statut: 'bloque', diagnostic: '1 passage(s) ouvert(s) depuis plus de 4 h.',
    ouverts: 1, bloques: ['2026-10-27'], retard: false,
    prochain: '2026-10-30T03:00:00+00:00', horaires_utc: [3, 4, 10], seuil_blocage_heures: 4 },
  dernier: { id: 'b1', business_date_utc: '2026-10-29', status: 'completed',
    started_at: '2026-10-29T03:04:20+00:00', finished_at: '2026-10-29T05:46:27+00:00',
    duree_minutes: 162, sources_attendues: 63, sources_traitees: 63 },
  work_items: { par_statut: { success: 63 }, total: 63 },
  batchs: [
    { business_date_utc: '2026-10-29', status: 'completed', started_at: '2026-10-29T03:04:20+00:00', finished_at: '2026-10-29T05:46:27+00:00', sources_attendues: 63 },
    { business_date_utc: '2026-10-28', status: 'completed', started_at: '2026-10-28T03:04:22+00:00', finished_at: '2026-10-28T05:39:58+00:00', sources_attendues: 63 },
    { business_date_utc: '2026-10-27', status: 'open', started_at: '2026-10-27T09:56:30+00:00', finished_at: null, sources_attendues: 0 },
  ],
};

// La grille est celle des 30 derniers jours, et elle est PARTAGÉE par les
// deux mesures : c'est la condition pour que deux graphiques côte à côte
// se comparent. Les jours sans création restent dans la grille, avec
// `sans_activite` — un jour vide n'est pas un jour à zéro.
const joursHisto = [];
for (let i = 29; i >= 0; i--) {
  joursHisto.push(new Date(Date.UTC(2026, 9, 30 - i)).toISOString().slice(0, 10));
}
const activite = {
  '2026-10-07': [1009, 48], '2026-10-09': [1610, 47], '2026-10-10': [293, 0],
  '2026-10-11': [47, 2], '2026-10-12': [16, 0], '2026-10-13': [105, 9],
  '2026-10-14': [86, 4], '2026-10-15': [87, 5], '2026-10-16': [105, 6],
  '2026-10-17': [95, 0], '2026-10-18': [34, 2], '2026-10-19': [392, 11],
  '2026-10-20': [131, 3], '2026-10-21': [118, 21], '2026-10-24': [444, 0],
  '2026-10-25': [1422, 1394], '2026-10-26': [10, 0], '2026-10-27': [104, 76],
  '2026-10-28': [97, 0], '2026-10-29': [78, 0], '2026-10-30': [84, 0],
};
const historique = joursHisto.map((j) => {
  const a = activite[j];
  if (!a) {
    return { jour: j, creees: 0, classees: 0, sans_description: 0, non_classees: 0, part_classee: null, sans_activite: true };
  }
  return {
    jour: j, creees: a[0], classees: a[1], sans_description: 0,
    non_classees: a[0] - a[1],
    part_classee: a[0] ? Math.round((1000 * a[1]) / a[0]) / 10 : null,
    sans_activite: false,
  };
});

// La mesure exacte ne commence qu'à l'instrumentation : les jours
// précédents ont eu des passages, mais aucun ne portait de compteur.
const mesureParPassage = joursHisto.map((j, i) => {
  const mesure = j >= '2026-10-29';
  return {
    jour: j,
    passages: 60 + (i % 9),
    mesures: mesure ? 1 : 0,
    classees: mesure ? 48 + (i % 14) : 0,
    non_classees: mesure ? 12 : 0,
    sans_description: 0,
  };
});

const classification = {
  generated_at: apercu.generated_at,
  classification: { actifs: 4695, coeur: 334, exclu: 4361, a_classer: 1370, classes: 3325,
    cas_limites: 35, curation_attente: 4683, curation_echec: 0, part_coeur: 7.1, part_a_classer: 29.2 },
  historique: historique,
  mesure_par_passage: mesureParPassage,
  jours: joursHisto,
  instrumentation_depuis: '2026-10-29',
  jours_non_measures: 28,
  alertes: [
    { gravite: 'attention', titre: '1370 offres actives non classées', detail: '29,2 % des offres actives n’ont pas encore de métier.' },
    { gravite: 'attention', titre: '4683 offres en attente de curation', detail: 'Résumé, compétences et salaire ne sont pas encore produits.' },
    { gravite: 'attention', titre: '35 cas limites', detail: 'Classés avec une confiance faible : un arbitrage humain est attendu.' },
  ],
};

const indexation = {
  generated_at: apercu.generated_at, status: 'unavailable',
  reason: 'Search Console non autorisée pour le compte de service : l’URL Inspection API répond 403 PERMISSION_DENIED.',
  a_faire: ['Ajouter le compte de service comme propriétaire dans Search Console',
    'Autoriser la propriété dans l’Indexing API', 'Exposer un jeton de lecture à l’API'],
  ce_qui_est_mesure: { fiches_publiees: 334, sondes: [
    { nom: 'Sitemap', disponible: true, code: 200 }, { nom: 'Robots', disponible: true, code: 200 }] },
};

const analytics = {
  generated_at: apercu.generated_at, status: 'unavailable',
  reason: 'Aucun accès de lecture à la propriété GA4 n’est configuré côté API.',
  a_faire: ['Créer une clé de compte de service avec le rôle Lecteur sur la propriété GA4',
    'La stocker comme secret Railway', 'Interroger la Data API et agréger par jour'],
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
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));

  await page.route('**/monitoring/api/**', async (route) => {
    const url = route.request().url();
    const corps = url.includes('/session') ? { authenticated: true, expires_in: 3600 }
      : url.includes('/overview') ? apercu
      : url.includes('/sources') ? sources
      : url.includes('/alerts') ? alertes
      : url.includes('/quality') ? qualite
      : url.includes('/cron') ? cron
      : url.includes('/classification') ? classification
      : url.includes('/indexation') ? indexation
      : url.includes('/analytics') ? analytics
      : url.includes('/operations') ? operations
      : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });

  await page.goto('http://127.0.0.1:8124/monitoring.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/shot-apercu.png', fullPage: true });

  for (const [onglet, fichier] of [['cron','cron'], ['collecte','collecte'], ['offres','offres'], ['indexation','indexation']]) {
    await page.click(`#onglet-${onglet}`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `/tmp/shot-${fichier}.png`, fullPage: true });
  }

  // Le bloc des deux mesures de classification : il est dans l'onglet
  // « offres », mais il ne se voit pas sur une capture pleine page de
  // l'ensemble. Sans ce cliché, un défaut de rendu passe inaperçu.
  //
  // L'ordre compte : le redimensionnement doit précéder la capture
  // bureau, sinon le cliché « mobile » est pris en 1440 px — et une
  // image qui ne montre pas ce qu'elle annonce est pire qu'aucune.
  await page.setViewportSize({ width: 1440, height: 980 });

  // La ligne de classification doit etre VISIBLE dans la vue
  // d'ensemble. C'est la correction qui manquait : la question « la
  // cascade a-t-elle tourné ? » ne se posait que dans un onglet, et rien
  // n'y menait — on pouvait regarder le tableau de bord sans la voir.
  await page.click('#onglet-apercu');
  await page.waitForTimeout(700);
  const ligneClassif = await page.evaluate(() => {
    const z = document.getElementById('ligne-classification');
    return {
      presente: !!z,
      visible: !!z && z.offsetParent !== null,
      etat: z ? z.dataset.etat : null,
      texte: z ? z.textContent.replace(/\s+/g, ' ').trim() : null,
      lien: z ? !!z.querySelector('[data-onglet="offres"]') : false,
    };
  });
  if (!ligneClassif.visible || !ligneClassif.texte) {
    erreurs.push('ligne de classification absente de la vue d ensemble : ' + JSON.stringify(ligneClassif));
  }
  console.log('Ligne de classification (vue d ensemble) :', JSON.stringify(ligneClassif));

  await page.click('#onglet-offres');
  await page.waitForTimeout(700);
  const bloc = await page.$('.deux-mesures');
  if (bloc) {
    await bloc.screenshot({ path: '/tmp/shot-mesures.png' });
  } else {
    erreurs.push('bloc .deux-mesures introuvable dans l\'onglet offres');
  }

  // Mobile : les deux colonnes s'y empilent, et les dates sous les
  // graphiques s'espacent. Le redimensionnement précède le rechargement
  // du rendu, sinon `matchMedia` renvoie encore la valeur du bureau.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(400);
  await page.click('#onglet-apercu');
  await page.waitForTimeout(300);
  await page.click('#onglet-offres');
  await page.waitForTimeout(900);
  const blocMobile = await page.$('.deux-mesures');
  if (blocMobile) {
    await blocMobile.screenshot({ path: '/tmp/shot-mesures-mobile.png' });
  }
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.waitForTimeout(400);

  // Le bloc des deux mesures doit se remplir. Un graphique vide passe
  // le contrôle de mise en page — aucune barre, aucun débordement — et
  // c'est exactement le défaut qu'on cherche à voir.
  await page.click('#onglet-offres');
  await page.waitForTimeout(800);
  const etatBloc = await page.evaluate(() => ({
    colonnes: document.querySelectorAll('.mesure__colonne').length,
    echelles: document.querySelectorAll('.mesure__echelle').length,
    dates: document.querySelectorAll('.mesure__dates span').length,
    mention: (document.getElementById('mesure-mention') || {}).textContent,
    avertissement_visible: !(document.getElementById('mesure-avertissement') || {}).hidden,
  }));
  if (!etatBloc.colonnes || !etatBloc.echelles || !etatBloc.dates) {
    erreurs.push(`bloc des deux mesures vide : ${JSON.stringify(etatBloc)}`);
  }
  console.log('Bloc des deux mesures :', JSON.stringify(etatBloc));

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
