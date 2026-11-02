// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — Point d'entrée
//
// Une seule source indexable : claimyourjob.com/fr. Tout le reste
// redirige, en un seul saut, chemin et query conservés.
//
//   claimyourjob.com/fr/…       200   la source, servie
//   claimyourjob.com/fr         301   → /fr/
//   claimyourjob.com/…          301   → /fr/…
//   claimyourjob.fr/…           301   → https://claimyourjob.com/fr/…
//   www.…                       301   → l'apex .com
//
// Pourquoi une source unique, et pas deux sites identiques.
//
// Le .com a été acheté après le .fr. Le laisser en porte — une page qui
// demandait son marché au visiteur — aurait créé, le jour où un second
// marché s'ouvrirait, deux adresses pour le même contenu, et Google
// obligé de choisir laquelle indexer. En concentrant la source sur
// /fr dès aujourd'hui, la migration Search Console se fait une fois.
//
// Ce que ce fichier ne fait pas.
//
// Il ne traduit rien. La seule langue produite est le français, et elle
// vit sous /fr. Quand un marché réel s'ouvrira, il aura son propre
// préfixe et son propre contenu — pas une page vide qui prétend être
// du néerlandais.
// ─────────────────────────────────────────────────────────────────────────────

import { rendreOffre } from './pages/offre.js';
import { rendreSitemap } from './pages/sitemap.js';
import { rendreRobots } from './pages/robots.js';
import { relayerMonitoringApi, rendreMonitoring } from './pages/monitoring.js';
import { PREFIXE_MARCHE, estExempt, reecrireLiens } from './maillage.js';

// L'adresse canonique du marché. Une seule constante : la même sert de
// base aux redirections, aux canoniques et au sitemap.
export const ORIGINE_MARCHE = 'https://claimyourjob.com';

function reponse301(chemin) {
  return Response.redirect(chemin, 301);
}

// Le chemin servi, dépouillé de son préfixe de marché.
function nu(chemin) {
  return chemin.slice(PREFIXE_MARCHE.length) || '/';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const chemin = url.pathname;
    const recherche = url.search || '';

    const estFr = url.hostname === 'claimyourjob.fr' || url.hostname === 'www.claimyourjob.fr';
    const estCom = url.hostname === 'claimyourjob.com' || url.hostname === 'www.claimyourjob.com';

    // ── Le .fr est un alias. Tout, sauf les assets. ─────────────────────
    // Le .fr reste acquis durablement : ses anciennes adresses doivent
    // mener au même contenu, jamais à un 404. Un seul saut — c'est pour
    // cela qu'on cible directement /fr/… et non la racine du .com.
    if (estFr) {
      // Les assets et les fichiers techniques vivent à la racine du
      // domaine, servis par le CDN. Les rediriger créerait une boucle ou
      // un aller-retour pour chaque image.
      if (estExempt(chemin)) {
        return env.ASSETS.fetch(request);
      }
      // Le monitoring est une surface interne : fermé, partout. Le
      // rediriger vers /fr/monitoring le ferait migrer de chemin, et
      // ouvrirait la porte à son indexation.
      if (chemin.startsWith('/monitoring/api/')) {
        return relayerMonitoringApi(request, env);
      }
      if (chemin === '/monitoring' || chemin === '/monitoring/') {
        return rendreMonitoring(request, env);
      }
      // L'adresse historique du board : elle a sa destination propre,
      // avant la règle générale qui l'enverrait sur /fr/claim-job-board.html.
      if (chemin === '/claim-job-board.html') {
        return reponse301(`${ORIGINE_MARCHE}${PREFIXE_MARCHE}/job-board.html${recherche}`);
      }
      return reponse301(`${ORIGINE_MARCHE}${PREFIXE_MARCHE}${chemin === '/' ? '/' : chemin}${recherche}`);
    }

    // ── Le .com. Tout converge vers /fr. ────────────────────────────────
    if (estCom) {
      // /fr nu : une page, une seule adresse. Sans ce 301, /fr et /fr/
      // serviraient le même document.
      if (chemin === PREFIXE_MARCHE) {
        return reponse301(`${ORIGINE_MARCHE}${PREFIXE_MARCHE}/${recherche}`);
      }

      // Le monitoring est une surface interne : il ne migre pas de chemin,
      // et ne doit jamais devenir indexable en changeant d'adresse. Il
      // reste sur le domaine, fermé sans cookie.
      if (chemin.startsWith('/monitoring/api/')) {
        return relayerMonitoringApi(request, env);
      }
      if (chemin === '/monitoring' || chemin === '/monitoring/') {
        return rendreMonitoring(request, env);
      }

      // L'adresse historique du board : elle a sa destination propre,
      // avant la règle générale qui l'enverrait sur /fr/claim-job-board.html.
      // Le cas /fr/claim-job-board.html est couvert ici aussi : sous le
      // marché, la page est déjà dépouillée de son préfixe.
      if (chemin === '/claim-job-board.html') {
        return reponse301(`${ORIGINE_MARCHE}${PREFIXE_MARCHE}/job-board.html${recherche}`);
      }

      // Les www convergent vers l'apex. La règle est calculée sur le
      // CHEMIN CIBLE, pas sur le chemin reçu : un www qui converge vers
      // /job-board.html laisserait une seconde redirection à faire. Un
      // seul saut, c'est la règle.
      if (url.hostname.startsWith('www.')) {
        const cible = (chemin === '/' || chemin === PREFIXE_MARCHE)
          ? `${PREFIXE_MARCHE}/`
          : chemin.startsWith(PREFIXE_MARCHE + '/')
            ? chemin
            : (estExempt(chemin) ? chemin : `${PREFIXE_MARCHE}${chemin}`);
        return reponse301(`${ORIGINE_MARCHE}${cible}${recherche}`);
      }

      // La racine et les fichiers techniques : une seule source indexable.
      // /robots.txt et /sitemap.xml du .com pointent vers ceux de /fr,
      // pour qu'un robot qui demande l'un trouve l'autre.
      if (chemin === '/') {
        return reponse301(`${ORIGINE_MARCHE}${PREFIXE_MARCHE}/${recherche}`);
      }
      if (chemin === '/robots.txt' || chemin === '/sitemap.xml') {
        return reponse301(`${ORIGINE_MARCHE}${PREFIXE_MARCHE}${chemin}${recherche}`);
      }

      // Les assets restent à la racine du domaine, des deux côtés.
      if (estExempt(chemin)) {
        return env.ASSETS.fetch(request);
      }

      // Toute autre adresse hors /fr : elle appartient au marché. Anciens
      // liens publiés avant la migration (/job-board.html, /offre/…) inclus.
      if (!chemin.startsWith(PREFIXE_MARCHE + '/')) {
        return reponse301(`${ORIGINE_MARCHE}${PREFIXE_MARCHE}${chemin}${recherche}`);
      }

      // ── La source : /fr/… ─────────────────────────────────────────────
      return routerMarche(request, env, url, nu(chemin), recherche);
    }

    // ── Un autre domaine pointe sur ce Worker. ──────────────────────────
    // C'est une erreur de configuration, pas une page. On ne sert rien :
    // afficher le site ici créerait une troisième adresse indexable.
    return new Response('Domaine non configuré', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};

// ── Le routeur du marché, sous /fr ───────────────────────────────────────────
//
// Le chemin reçu est déjà dépouillé de son préfixe : ce routeur ne sait
// pas qu'il vit sous /fr, et n'a pas à le savoir. C'est ce qui le rend
// réutilisable le jour où un second marché s'ouvrira.
async function routerMarche(request, env, url, chemin, recherche) {
  const siteUrl = (env && env.SITE_URL) || `${ORIGINE_MARCHE}${PREFIXE_MARCHE}`;

  // ── Fiche d'offre ─────────────────────────────────────────────────────
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

  // ── Sitemap et robots : la source du marché ───────────────────────────
  if (chemin === '/sitemap.xml') {
    return rendreSitemap(env);
  }
  if (chemin === '/robots.txt') {
    return rendreRobots(env);
  }

  // ── Monitoring interne ────────────────────────────────────────────────
  // Hors du préfixe public : fermé sans cookie, jamais indexé.
  if (chemin.startsWith('/monitoring/api/')) {
    return relayerMonitoringApi(request, env);
  }
  if (chemin === '/monitoring' || chemin === '/monitoring/') {
    return rendreMonitoring(request, env);
  }

  // ── La racine : l'accueil ────────────────────────────────────────────
  if (chemin === '/') {
    return servirStatique(request, env, '/index.html');
  }

  // ── Tout le reste : les fichiers statiques ───────────────────────────
  return servirStatique(request, env, chemin);
}

// ── Le statique, avec son maillage ramené sous /fr ─────────────────────────
//
// Les pages ont été écrites quand le site vivait à la racine : leurs
// liens partent de la racine. On les ramène sous /fr à la volée, plutôt
// que de réécrire les 177 liens du dépôt — un lien oublié dans une
// réécriture manuelle crée une redirection silencieuse, ici la règle est
// unique et couvre tout le site.
//
// Les assets ne sont pas réécrits : ils vivent à la racine des deux
// côtés, et `estExempt` le dit explicitement.
async function servirStatique(request, env, chemin) {
  if (!env.ASSETS) {
    return new Response('Non trouvé', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // Un asset sert tel quel : réécrire un CSS ou un JS de thème n'aurait
  // aucun sens, et casserait sa signature de cache.
  if (estExempt(chemin)) {
    return env.ASSETS.fetch(request);
  }

  const origine = new URL(request.url).origin;
  const cible = new Request(new URL(chemin, origine), request);
  const reponse = await env.ASSETS.fetch(cible);

  // Un 404 reste un 404 : ne pas réécrire la page d'erreur.
  if (!reponse.ok || reponse.status !== 200) {
    return reponse;
  }

  const type = (reponse.headers.get('content-type') || '').toLowerCase();
  if (!type.includes('text/html')) {
    return reponse;
  }

  const html = reecrireLiens(await reponse.text());
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Les pages changent à chaque déploiement, pas davantage.
      'cache-control': 'public, s-maxage=300',
    },
  });
}
