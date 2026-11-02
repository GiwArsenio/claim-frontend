// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — Point d'entrée international
//
// Le site a deux adresses, et une seule collection de contenus.
//
//   claimyourjob.fr/…        la France, à sa place
//   claimyourjob.com/…       la façade internationale
//   claimyourjob.com/fr/…    un alias de la France, servie depuis le .com
//
// Pourquoi ce fichier existe.
//
// Le .com n'est pas une copie du .fr : ce serait deux sites pour le même
// contenu, et Google devrait choisir lequel indexer. Le .com est une
// PORTE. Il dit où se trouve chaque marché, et il mène à l'adresse qui
// sert ce marché.
//
// Trois règles, dans cet ordre :
//
//   1. `/fr/…` sur le .com est un ALIAS de la même page sur le .fr.
//      Le contenu est identique, la canonique reste sur le .fr : le .com
//      n'est pas une source, il est une porte. D'où un 301.
//
//   2. `/` sur le .com est un CHOIX. Un visiteur qui tape claimyourjob.com
//      doit voir une porte qui demande son marché — pas un 404, et pas
//      une copie du site français sous une autre adresse.
//
//   3. Toute autre adresse du .com est le CONTENU, servi comme sur le .fr.
//      Les canoniques de ces pages pointent déjà vers le .fr : le signal
//      de « où est la source » ne change pas.
//
// Ce que ce fichier ne fait pas.
//
// Il ne traduit rien. Une page `/be/` qui n'existe pas doit le dire, pas
// servir du français en prétendant être du néerlandais. Le .com est la
// porte ; le contenu d'un marché reste produit par ce marché.
// ─────────────────────────────────────────────────────────────────────────────

import { rendreOffre } from './pages/offre.js';
import { rendreSitemap } from './pages/sitemap.js';
import { rendreRobots } from './pages/robots.js';
import { relayerMonitoringApi, rendreMonitoring } from './pages/monitoring.js';

// Les marchés connus. `domain` est le domaine qui sert réellement ce
// marché : c'est là que vivent ses pages, et c'est là que pointe sa
// canonique.
//
// Un marché n'est déclaré ici que s'il a un contenu réel. Ajouter `/be/`
// parce que « ça pourrait servir plus tard » créerait une adresse qui ne
// mène nulle part, et une promesse que le site ne tiendrait pas.
const MARCHES = {
  fr: {
    nom: 'France',
    code: 'FR',
    drapeau: '🇫🇷',
    domain: 'https://claimyourjob.fr',
  },
};

function html(x) {
  return String(x)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── La porte du .com ───────────────────────────────────────────────────────
//
// Une page, pas une redirection : le visiteur doit pouvoir choisir. Et
// surtout, elle ne doit pas laisser croire qu'il existe déjà un contenu
// belge ou luxembourgeois.
function rendrePorte(url) {
  const entrees = Object.entries(MARCHES).map(([cle, m]) => {
    // Le chemin est conservé : /fr/job-board.html doit mener au board.
    const suffixe = url.pathname === '/' ? '' : url.pathname;
    return `
      <a class="marche" href="${m.domain}${suffixe}">
        <span class="marche-drapeau" aria-hidden="true">${m.drapeau}</span>
        <span class="marche-nom">${html(m.nom)}</span>
        <span class="marche-code">${html(m.code)}</span>
      </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claim! — Le job board de l'actuariat et de l'IA en assurance</title>
<meta name="description" content="Claim! — les offres d'emploi en actuariat, data et IA dans l'assurance. Choisissez votre marché.">
<!-- La porte n'est PAS indexée, tant qu'un seul marché existe.
     Elle est un point d'entrée pour l'international, pas une page à
     classer : laIndexer reviendrait à faire apparaître « Claim! » en
     page d'accueil d'un domaine qui n'a qu'une porte. Le jour où un
     second marché s'ouvre, l'indexation se décide — et cette ligne
     disparaît avec la décision. -->
<meta name="robots" content="noindex, follow">
<link rel="icon" type="image/png" sizes="512x512" href="/assets/favicon.png">
<link rel="stylesheet" href="/assets/theme.css">
<style>
/* La porte reprend la palette de la marque : --teal, --surface, --encre.
   Aucune couleur en dur : la feuille de theme les fournit, et le mode nuit
   les suit. */
.corps { min-height: 100dvh; display: flex; align-items: center; justify-content: center;
  padding: 2rem 1.25rem; background: var(--surface-2); }
.carte { width: 100%; max-width: 34rem; background: var(--surface); border: 1px solid var(--bord);
  border-radius: 1rem; padding: 2.25rem 1.75rem; text-align: center;
  box-shadow: 0 10px 40px rgba(25,44,52,.08); }
.marque { font-size: 2.25rem; font-weight: 900; letter-spacing: -.05em; color: var(--teal-fond);
  text-decoration: none; display: inline-block; }
.slogan { margin: .5rem 0 0; color: var(--gris); font-size: .95rem; }
.question { margin: 2rem 0 1rem; font-weight: 700; color: var(--encre); font-size: 1.05rem; }
.marches { display: flex; flex-direction: column; gap: .65rem; }
.marche { display: flex; align-items: center; gap: .8rem; text-decoration: none;
  border: 1px solid var(--bord-carte); border-radius: .7rem; padding: .95rem 1.1rem;
  background: var(--surface); transition: border-color .15s, background .15s; }
.marche:hover { border-color: var(--teal); background: var(--surface-2); }
.marche:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.marche-drapeau { font-size: 1.6rem; line-height: 1; }
.marche-nom { font-weight: 700; color: var(--encre); flex: 1; text-align: left; }
.marche-code { font-size: .75rem; font-weight: 700; letter-spacing: .06em; color: var(--gris);
  border: 1px solid var(--bord); border-radius: .3rem; padding: .15rem .45rem; }
.renvoi { margin: 1.75rem 0 0; font-size: .85rem; color: var(--gris-doux); }
.renvoi a { color: var(--teal); }
</style>
</head>
<body>
<div class="corps">
  <main class="carte">
    <a class="marque" href="/fr/">Claim!</a>
    <p class="slogan">Les offres d'emploi en actuariat, data et IA en assurance.</p>
    <p class="question">Choisissez votre marché</p>
    <nav class="marches" aria-label="Choisir un marché">
      ${entrees}
    </nav>
    <p class="renvoi">Vous cherchez le site français&nbsp;? <a href="https://claimyourjob.fr/">claimyourjob.fr</a></p>
  </main>
</div>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const chemin = url.pathname;
    const estCom = url.hostname === 'claimyourjob.com' || url.hostname === 'www.claimyourjob.com';

    // ── Le .fr n'est pas concerné par tout ce qui suit ───────────────────
    // Ce code ne s'exécute que sur le .com. Le .fr continue de servir
    // exactement ce qu'il servait : une régression ici ne doit pas
    // pouvoir le toucher.
    if (!estCom) {
      return routerPrincipal(request, env, url, chemin);
    }

    // ── L'ALIAS : /fr/… sur le .com ───────────────────────────────────────
    // 301 vers le .fr, chemin conservé. Le contenu est le même, donc la
    // canonique reste sur le .fr. Le redirect est définitif : l'alias ne
    // sera pas temporaire, il ne le deviendra pas.
    if (chemin === '/fr' || chemin.startsWith('/fr/')) {
      const suffixe = chemin.slice('/fr'.length);
      const destination = `https://claimyourjob.fr${suffixe || '/'}`;
      return Response.redirect(destination, 301);
    }

    // ── La PORTE : la racine du .com ──────────────────────────────────────
    if (chemin === '/' || chemin === '') {
      return new Response(rendrePorte(url), {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          // La porte change avec les marchés : une heure suffit.
          'cache-control': 'public, s-maxage=3600',
        },
      });
    }

    // ── Le reste : le contenu, tel quel ───────────────────────────────────
    // Un visiteur du .com qui ouvre une adresse de contenu (/job-board.html,
    // /offre/…) doit voir la page, pas un 404 : le contenu est le même. Les
    // canoniques de ces pages pointent déjà vers le .fr, ce qui indique à
    // Google où se trouve la source.
    return routerPrincipal(request, env, url, chemin);
  },
};

// ── Le routeur d'origine, inchangé ─────────────────────────────────────────
//
// C'est exactement le code qui servait le site avant. Il est sorti dans
// une fonction pour que la logique du .com n'ait pas à le dupliquer — et
// pour qu'une évolution du .fr ne doive être écrite qu'une fois.
async function routerPrincipal(request, env, url, chemin) {
  const SITE_URL = (env && env.SITE_URL) || 'https://claimyourjob.fr';

  // ── Redirection historique ────────────────────────────────────────────
  if (chemin === '/claim-job-board.html') {
    return Response.redirect(`${SITE_URL}/job-board.html`, 301);
  }

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

  // ── Sitemap ───────────────────────────────────────────────────────────
  if (chemin === '/sitemap.xml') {
    return rendreSitemap(env);
  }

  // ── Robots ────────────────────────────────────────────────────────────
  if (chemin === '/robots.txt') {
    return rendreRobots(env);
  }

  // ── La racine : l'accueil ────────────────────────────────────────────
  if (chemin === '/') {
    const accueil = new URL('/index.html', url.origin);
    return env.ASSETS.fetch(new Request(accueil, request));
  }

  // ── Monitoring interne ────────────────────────────────────────────────
  if (chemin.startsWith('/monitoring/api/')) {
    return relayerMonitoringApi(request, env);
  }
  if (chemin === '/monitoring' || chemin === '/monitoring/') {
    return rendreMonitoring(request, env);
  }

  // ── Tout le reste : les fichiers statiques ───────────────────────────
  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }
  return new Response('Non trouvé', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
