/* ─────────────────────────────────────────────────────────────────────────────
   SERVEUR DE TEST CLAIM! — niveau B, hors-ligne

   Le front-end appelle le backend en dur :
     const API_BASE = 'https://claim-api-production-06b3.up.railway.app/api/v1';
   Pour tester les parcours sans dépendre de la production, ce serveur
   intercepte les appels a /api/v1 et repond avec des fixtures.

   Il sert aussi les pages statiques, avec deux routes en plus :
     /offre/{slug}  — la fiche autonome, executee comme le fait Vercel
     /__controle__  — un canal de controle pour les tests

   Le canal de controle permet de simuler une panne, de retarder une reponse,
   d'inverser l'ordre de deux reponses. Sans lui, les tests ne pourraient
   pas eprouver les cas de panne ni de concurrence.

   Usage : node tests/serveur-test.cjs [port]
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const { TOUTES, OFFRE_COMPLETE } = require('./fixtures/offres.cjs');

/* Port par defaut. Le module n'ecoute pas tout seul : c'est l'aide qui
   appelle listen(), sur un port libre obtenu par le systeme. Un port fixe
   ferait cohabiter deux suites et la seconde parlerait a la premiere. */
const PORT_PAR_DEFAUT = Number(process.argv[2] || 8096);
const PAGE_SIZE = 20;

/* ── État de contrôle, modifié par les tests ─────────────────────────────── */
const etat = {
  /* Chemins d'API à faire échouer. */
  pannes: new Set(),
  /* Délai en ms par chemin. */
  delais: new Map(),
  /* Offres dont la réponse de détail est retardée, en ms. */
  delaisDetail: new Map(),
  /* Offres dont la réponse de détail doit partir avant une autre. */
  ordreDetail: null,
  /* Nombre de réponses de détail déjà renvoyées. */
  appelsDetail: 0,
  /* Interrompt le board. */
  statsKO: false,
};

function reinitialiser() {
  etat.pannes.clear();
  etat.delais.clear();
  etat.delaisDetail.clear();
  etat.ordreDetail = null;
  etat.appelsDetail = 0;
  etat.statsKO = false;
}

/* ── Filtrage, comme le backend ──────────────────────────────────────────── */
function filtrer(q) {
  let offres = TOUTES.slice();

  /* La production cherche dans le titre, la description et l'identifiant de
     source. Une offre peut donc apparaitre alors que son titre ne contient
     pas le mot cherche : c'est le comportement attendu, et le test doit
     s'en tenir a la coherence du compte. */
  const recherche = (q.get('q') || '').toLowerCase();
  if (recherche.length >= 2) {
    offres = offres.filter((o) =>
      (o.title || '').toLowerCase().includes(recherche) ||
      (o.description_raw || '').toLowerCase().includes(recherche) ||
      (o.source || '').toLowerCase().includes(recherche)
    );
  }
  const ville = (q.get('city') || '').toLowerCase();
  if (ville) offres = offres.filter((o) => (o.city || '').toLowerCase().includes(ville));
  const contrat = q.get('contract');
  if (contrat) offres = offres.filter((o) => o.contract_type === contrat);
  const specialite = q.get('specialty');
  if (specialite) offres = offres.filter((o) => o.specialty === specialite);
  const experience = q.get('experience');
  if (experience) offres = offres.filter((o) => o.experience_level === experience);

  return offres;
}

function repondreJSON(res, code, objet) {
  const corps = JSON.stringify(objet);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corps),
    'Cache-Control': 'no-store',
  });
  res.end(corps);
}

const Types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function servirStatique(res, chemin) {
  const fichier = path.join(RACINE, chemin);
  if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
    return;
  }
  res.writeHead(200, {
    'Content-Type': Types[path.extname(fichier)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(fichier).pipe(res);
}

/* ── Réponses API simulées ───────────────────────────────────────────────── */
async function traiterAPI(req, res, url) {
  const chemin = url.pathname.replace(/^\/api\/v1/, '').replace(/^\/+/, '/');
  const q = url.searchParams;

  /* Une panne declaree sur '/jobs' doit aussi arreter '/jobs/search' : le
     prefixe designe la famille de routes, pas une route unique. */
  const enPanne = [...etat.pannes].some((p) => chemin === p || chemin.startsWith(p + '/'));
  if (enPanne) {
    repondreJSON(res, 500, { detail: 'Panne simulée' });
    return;
  }

  const delai = etat.delais.get(chemin) || 0;
  if (delai) await new Promise((r) => setTimeout(r, delai));

  /* Statistiques de l'accueil. */
  if (chemin === '/stats/published') {
    if (etat.statsKO) { repondreJSON(res, 500, { detail: 'Stats indisponibles' }); return; }
    repondreJSON(res, 200, {
      jobs_online: TOUTES.length,
      companies_hiring: 7,
      sources_tracked: 23,
      last_collection_at: '2026-10-22T05:00:00Z',
    });
    return;
  }

  /* Selection de l'accueil : une offre par employeur. */
  if (chemin === '/jobs/selection') {
    const limite = Number(q.get('limite') || 6);
    const vus = new Set();
    const data = [];
    for (const o of TOUTES) {
      const cle = o.companies?.slug || o.source;
      if (vus.has(cle)) continue;
      vus.add(cle);
      data.push(o);
      if (data.length >= limite) break;
    }
    repondreJSON(res, 200, { data });
    return;
  }

  /* Liste paginee, avec recherche. */
  if (chemin === '/jobs' || chemin === '/jobs/search') {
    const page = Number(q.get('page') || 1);
    const perPage = Number(q.get('per_page') || q.get('limit') || PAGE_SIZE);
    const toutes = filtrer(q);
    const debut = (page - 1) * perPage;
    const data = toutes.slice(debut, debut + perPage);
    repondreJSON(res, 200, {
      query: q.get('q') || '',
      data,
      pagination: {
        page,
        per_page: perPage,
        total: toutes.length,
        pages: toutes.length === 0 ? 0 : Math.ceil(toutes.length / perPage),
      },
    });
    return;
  }

  /* Detail d'une offre. */
  if (chemin.startsWith('/jobs/')) {
    const id = decodeURIComponent(chemin.slice('/jobs/'.length));
    const offre = TOUTES.find((o) => o.id === id || o.slug === id);
    if (!offre) { repondreJSON(res, 404, { detail: 'Offre introuvable' }); return; }

    const delaiOffre = etat.delaisDetail.get(id) || 0;
    if (delaiOffre) await new Promise((r) => setTimeout(r, delaiOffre));

    repondreJSON(res, 200, {
      ...offre,
      description_html: offre.description_html || offre.description_raw,
      sections: [],
    });
    return;
  }

  repondreJSON(res, 404, { detail: `Route inconnue : ${chemin}` });
}

/* ── Fiche autonome, executee comme le fait Vercel ────────────────────────
   Le module est prepare quand le serveur ecoute, parce que l'adresse du
   backend doit etre celle du port reellement attribue. Il est ecrit dans
   api/ : le require('../assets/companies-data.js') doit.resolve depuis ce
   repertoire. */
let handlerOffre = null;

function preparerFicheAutonome(port) {
  try {
    const src = fs.readFileSync(path.join(RACINE, 'api', 'offre.js'), 'utf8');
    const modif = src.replace(
      /const API_BASE\s*=\s*[^;]+;/,
      `const API_BASE = 'http://127.0.0.1:${port}/api/v1';`
    );
    const fichier = path.join(RACINE, 'api', `.offre-test-${process.pid}.js`);
    fs.writeFileSync(fichier, modif);
    delete require.cache[require.resolve(fichier)];
    handlerOffre = require(fichier);
    process.on('exit', () => { try { fs.unlinkSync(fichier); } catch (e) {} });
  } catch (e) {
    console.error('[serveur-test] api/offre.js indisponible :', e.message);
  }
}

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  /* Canal de controle. */
  if (url.pathname === '/__controle__') {
    if (req.method === 'POST') {
      let corps = '';
      for await (const morceau of req) corps += morceau;
      let ordre = {};
      try { ordre = JSON.parse(corps || '{}'); } catch (e) { /* corps vide */ }
      if (ordre.reset) reinitialiser();
      if (ordre.pannes) etat.pannes = new Set(ordre.pannes);
      if (ordre.delais) etat.delais = new Map(Object.entries(ordre.delais));
      if (ordre.delaisDetail) etat.delaisDetail = new Map(Object.entries(ordre.delaisDetail));
      if (ordre.ordreDetail) etat.ordreDetail = ordre.ordreDetail;
      if (ordre.statsKO !== undefined) etat.statsKO = !!ordre.statsKO;
      repondreJSON(res, 200, { ok: true });
      return;
    }
    repondreJSON(res, 200, { ok: true, offres: TOUTES.length, pageSize: PAGE_SIZE });
    return;
  }

  /* API simulee. */
  if (url.pathname.startsWith('/api/v1')) {
    await traiterAPI(req, res, url);
    return;
  }

  /* Fiche autonome. */
  if (url.pathname.startsWith('/offre/') && handlerOffre) {
    const slug = decodeURIComponent(url.pathname.split('/').pop());
    const reponse = {
      status(c) { this.code = c; return this; },
      setHeader() {},
      send(html) {
        res.writeHead(this.code || 200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      },
      json(o) { repondreJSON(res, this.code || 200, o); },
    };
    try {
      await handlerOffre({ query: { slug }, headers: {} }, reponse);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(e));
    }
    return;
  }

  /* Pages statiques. La racine sert l'accueil. */
  const chemin = url.pathname === '/' ? '/index.html' : url.pathname;
  servirStatique(res, chemin);
});

if (require.main === module) {
  serveur.listen(PORT_PAR_DEFAUT, '127.0.0.1', () => {
    preparerFicheAutonome(PORT_PAR_DEFAUT);
    console.log(`serveur de test sur http://127.0.0.1:${PORT_PAR_DEFAUT} — ${TOUTES.length} offres`);
  });
}

module.exports = { serveur, PORT_PAR_DEFAUT, etat, reinitialiser, preparerFicheAutonome, TOUTES, OFFRE_COMPLETE };
