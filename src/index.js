// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — Worker principal
//
// Rôle : servir les trois adresses rendues côté serveur, et laisser le CDN
// s'occuper de tout le reste.
//
// Les adresses rendues :
//   /offre/{slug}  — la fiche d'une offre, avec son balisage JobPosting
//   /sitemap.xml   — le sitemap des 351 fiches et des pages statiques
//   /robots.txt    — le robots.txt
//   /claim-job-board.html — redirection 301 vers /job-board.html
//
// Le reste du site (HTML, CSS, JS, images) est servi directement par le
// CDN, gratuitement et sans limite. C'est le point important : en
// Cloudflare Workers, les requêtes vers les fichiers statiques sont
// gratuites et illimitées, mais chaque invocation du Worker compte dans
// un quota (100 000/jour en gratuit). Le routage ci-dessous est donc
// volontairement sélectif : il n'est activé que pour les quatre
// adresses ci-dessus.
//
// Le rendu des trois pages vit dans src/pages/. Chaque fonction renvoie
// une Response Web standard — pas d'objets `req`/`res` de Node.
// ─────────────────────────────────────────────────────────────────────────────

import { rendreOffre } from './pages/offre.js';
import { rendreSitemap } from './pages/sitemap.js';
import { rendreRobots } from './pages/robots.js';

const SITE_URL = 'https://claimyourjob.fr';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const chemin = url.pathname;

    // ── Redirection historique ────────────────────────────────────────────
    // L'adresse du board a changé de nom. La page est indexée et des
    // liens pointent encore vers elle : une suppression sèche aurait
    // cassé les deux. Une 301 conserve le signal.
    if (chemin === '/claim-job-board.html') {
      return Response.redirect(`${SITE_URL}/job-board.html`, 301);
    }

    // ── Fiche d'offre ─────────────────────────────────────────────────────
    // Le slug est décodé : les accents sont encodés dans l'adresse
    // (encodeURIComponent dans le sitemap) et doivent revenir à leur
    // forme d'origine avant d'être envoyés à l'API.
    if (chemin.startsWith('/offre/')) {
      const brut = chemin.slice('/offre/'.length);
      let slug = brut;
      try {
        slug = decodeURIComponent(brut);
      } catch (e) {
        // Slug mal encodé : on le garde tel quel. L'API répondra 404.
      }
      return rendreOffre(slug, env);
    }

    // ── Sitemap ───────────────────────────────────────────────────────────
    if (chemin === '/sitemap.xml') {
      return rendreSitemap(env);
    }

    // ── Robots ────────────────────────────────────────────────────────────
    if (chemin === '/robots.txt') {
      return rendreRobots(env);
    }

    // ── La racine : l'accueil ────────────────────────────────────────────
    // Avec `html_handling: "none"`, Cloudflare sert l'adresse exacte et ne
    // résout plus `/` vers `/index.html`. Or la racine est l'accueil, et
    // c'est l'adresse la plus partagée du site.
    //
    // Le fichier lui-même reste `index.html` : on ne le renomme pas, on
    // sert ce fichier la racine. Les deux adresses répondent donc 200 avec
    // le meme contenu, et la balise canonique (`/`) reste la bonne.
    if (chemin === '/') {
      const accueil = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(accueil, request));
    }

    // ── Tout le reste : les fichiers statiques ───────────────────────────
    // Cette branche ne devrait pas être atteinte : le Worker n'est
    // interroge que pour les adresses ci-dessus, et le CDN sert le reste
    // directement, gratuitement et sans limite.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Non trouvé', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
