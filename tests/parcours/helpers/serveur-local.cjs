// tests/parcours/helpers/serveur-local.cjs
//
// Le serveur unique des parcours navigateur : il sert a la fois le frontend
// et le faux backend, sur la meme origine.
//
// Deux exigences, une seule regle les motive :
//
//   1. Le frontend parle a un backend simule, jamais a Railway.
//      On reecrit donc API_BASE dans le HTML servi.
//   2. Aucun test de PR ne doit dependre du reseau.
//      Toute ressource externe non simulee est bloquee.
//
// Consequence : un parcours qui s appuie sur un CDN, une police distante ou
// un script tiers devient rouge immediatement. C est voulu.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const rep = require('./reponses.cjs');

const RACINE = path.resolve(__dirname, '..', '..', '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const MARQUEUR_API = /https:\/\/claim-api-production-06b3\.up\.railway\.app\/api\/v1/g;

function reecrireApi(html, apiBase) {
  return html.replace(MARQUEUR_API, apiBase);
}

function envoyerJson(res, code, corps) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corps));
}

function servirFichier(res, absolu, type) {
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(absolu).pipe(res);
}

function routeApi(chemin, url, port, options, offres, appels) {
  const api = chemin.replace(/^\/api\/v1/, '');

  if (api === '/jobs/selection') {
    const reponse = options.selection
      ? options.selection(url)
      : rep.reponseSelection(url, offres);
    return { brut: false, code: reponse.code || 200, corps: reponse.corps };
  }

  if (api === '/jobs' || api === '/jobs/search') {
    const reponse = options.liste
      ? options.liste(url)
      : rep.reponseListe(url, offres);
    return { brut: false, code: reponse.code || 200, corps: reponse.corps };
  }

  if (api.indexOf('/jobs/') === 0) {
    const identifiant = decodeURIComponent(api.slice(6).split('?')[0]);
    const reponse = options.detail
      ? options.detail(identifiant, url)
      : rep.reponseDetail(identifiant, offres);
    if (reponse.__brut) {
      return { brut: true, code: reponse.code || 200, corps: reponse.__brut };
    }
    return { brut: false, code: reponse.code || 200, corps: reponse.corps };
  }

  if (api === '/stats/published') {
    const reponse = options.stats
      ? options.stats(url)
      : rep.reponseStats(url, offres);
    return { brut: false, code: reponse.code || 200, corps: reponse.corps };
  }

  return null;
}

function servirStatique(res, chemin, port) {
  let fichier = chemin === '/' ? '/index.html' : chemin;
  fichier = path.normalize(fichier).replace(/^(\.\.[/\\])+/, '');
  const absolu = path.join(RACINE, fichier);

  const dedans = absolu === RACINE || absolu.indexOf(RACINE + path.sep) === 0;
  if (!dedans || !fs.existsSync(absolu) || fs.statSync(absolu).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
    return;
  }

  const extension = path.extname(absolu).toLowerCase();
  const type = TYPES[extension] || 'application/octet-stream';

  if (extension === '.html') {
    const html = reecrireApi(fs.readFileSync(absolu, 'utf8'), 'http://127.0.0.1:' + port + '/api/v1');
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(html);
    return;
  }

  servirFichier(res, absolu, type);
}

function demarrer(options) {
  const opts = options || {};
  const offres = opts.offres || rep.OFFRES;
  const appels = [];
  let port = 0;

  const serveur = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const chemin = url.pathname;
    appels.push({ methode: req.method, chemin: chemin, recherche: url.search });

    const api = routeApi(chemin, url, port, opts, offres, appels);
    if (api) {
      // Une latence peut etre demandee pour une offre precise : c est ainsi
      // qu on reproduit une reponse tardive qui ecrase la fiche active.
      const identifiant = chemin.split('/jobs/')[1];
      const latence = opts.latences && identifiant ? opts.latences[identifiant] : 0;
      const envoyer = () => {
        if (api.brut) {
          res.writeHead(api.code, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(api.corps);
          return;
        }
        envoyerJson(res, api.code, api.corps);
      };
      if (latence) setTimeout(envoyer, latence);
      else envoyer();
      return;
    }

    if (chemin.indexOf('/api/') === 0) {
      envoyerJson(res, 404, { detail: 'Route API inconnue' });
      return;
    }

    servirStatique(res, chemin, port);
  });

  return new Promise((resolve) => {
    serveur.listen(0, '127.0.0.1', () => {
      port = serveur.address().port;
      const base = 'http://127.0.0.1:' + port;
      resolve({
        url: base,
        apiBase: base + '/api/v1',
        appels: appels,
        // closeAllConnections : sans lui, close() attend les connexions
        // maintenues ouvertes par le navigateur, ce qui retarde chaque fin
        // de cas de plusieurs secondes.
        arreter: () => new Promise((r) => {
          if (typeof serveur.closeAllConnections === 'function') {
            serveur.closeAllConnections();
          }
          serveur.close(() => r());
        }),
      });
    });
  });
}

module.exports = {
  demarrer: demarrer,
  reecrireApi: reecrireApi,
  RACINE: RACINE,
};
