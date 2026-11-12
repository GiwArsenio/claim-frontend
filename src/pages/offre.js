// src/pages/offre.js — Fiche d'une offre, rendue côté serveur.
//
// Portage depuis api/offre.js (Vercel). Le HTML produit est strictement le
// même : la fabrication de la page est dans _offre-rendu.js, repris tel
// quel depuis le fichier Vercel. Ce fichier ne fait que lbracketing
// Workers : appeler l'API, puis renvoyer une Response.
//
// Adresse publique : /fr/offre/{slug}
//
// Le HTML est fabriqué par _offre-rendu.js, puis ramené sous /fr par
// reecrireLiens : la fiche porte les mêmes liens root-relative que le
// reste du site, et doit les voir partir vers le marché.

import { construire, configurerUrls } from './_offre-rendu.js';
import { reecrireLiens } from '../maillage.js';

const SITE_URL_PAR_DEFAUT = 'https://claimyourjob.com/fr';

// Page « offre expirée / introuvable » au design du site : mêmes variables de
// thème (theme.css), même pied de page que les fiches, mode nuit inclus.
// Statut 410 Gone pour une offre expirée : Google demande 404/410 pour les
// offres disparues (doc Job Posting) — pas une redirection, pas un 200.
function pageAbsente(titre, message, siteUrl) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre} — Claim!</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${siteUrl}/job-board.html">
<link rel="stylesheet" href="/assets/theme.css">
<style>
  .expir { max-width: 46rem; margin: 0 auto; padding: 4rem 1.5rem 3rem; text-align: center; }
  .expir__badge { display: inline-block; font: 700 .75rem/1 var(--police, system-ui);
    text-transform: uppercase; letter-spacing: .12em; color: var(--gris-doux, #5c6870);
    background: var(--surface-2, #f5f8f9); border: 1px solid var(--bord, #e2e9ec);
    border-radius: 999px; padding: .55rem 1.1rem; margin-bottom: 1.75rem; }
  .expir h1 { font: 800 clamp(1.75rem, 4vw, 2.5rem)/1.15 var(--police, system-ui);
    color: var(--encre, #191c1d); letter-spacing: -.03em; margin: 0 0 1rem; }
  .expir p { font-size: 1.05rem; line-height: 1.65; color: var(--gris-texte, #3c494c);
    margin: 0 auto 2.25rem; max-width: 34rem; }
  .expir__actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }
  .expir__cta { display: inline-flex; align-items: center; gap: .55rem;
    font: 700 .95rem/1 var(--police, system-ui); padding: .95rem 1.65rem;
    border-radius: 12px; text-decoration: none; }
  .expir__cta--principal { background: var(--teal, #006876); color: #fff; }
  .expir__cta--principal:hover { filter: brightness(1.08); }
  .expir__cta--secondaire { background: var(--surface, #fff); color: var(--encre, #191c1d);
    border: 1px solid var(--bord, #e2e9ec); }
  .expir__cta--secondaire:hover { background: var(--surface-2, #f5f8f9); }
</style>
</head>
<body>
<main class="enveloppe">
  <div class="expir">
    <span class="expir__badge">Offre expirée</span>
    <h1>${titre}</h1>
    <p>${message}</p>
    <div class="expir__actions">
      <a class="expir__cta expir__cta--principal" href="${siteUrl}/job-board.html">Voir les offres actuelles</a>
      <a class="expir__cta expir__cta--secondaire" href="${siteUrl}/">Retour à l'accueil</a>
    </div>
  </div>
</main>
<footer id="ft">
  <div class="ft-top">
    <div>
      <a class="ft-logo" href="/">Claim!</a>
      <div class="ft-copy">© 2026 Claim your job</div>
    </div>
    <div class="ft-links">
      <a href="/a-propos.html">À propos</a>
      <a href="/cgu.html">CGU</a>
      <a href="/confidentialite.html">Confidentialite</a>
      <a href="/contact.html">Contact</a>
    </div>
  </div>
</footer>
</body>
</html>`;
}

// Une offre expirée répond 410 Gone (doc Google Job Posting : 404/410 pour
// une offre disparue), et l'URL est notifiée à Google via l'Indexing API.
function reponseOffreAbsente(titre, message, siteUrl, statut = 410) {
  return new Response(pageAbsente(titre, message, siteUrl), {
    status: statut,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'no-store',
    },
  });
}

export async function rendreOffre(slug, env) {
  const apiBase = (env && env.API_URL) || 'https://claim-api-production-06b3.up.railway.app/api/v1';
  const siteUrl = (env && env.SITE_URL) || SITE_URL_PAR_DEFAUT;

  // Le module de rendu lit ses URLs dans des variables : on les lui donne
  // avant de construire la page.
  configurerUrls(apiBase, siteUrl);

  if (!slug) {
    return reponseOffreAbsente('Offre introuvable', 'Cette adresse ne correspond à aucune offre.', siteUrl);
  }

  try {
    const reponse = await fetch(`${apiBase}/jobs/${encodeURIComponent(slug)}`);
    if (!reponse.ok && ![404,410].includes(reponse.status)) {
      return new Response(pageAbsente('Service momentanément indisponible',
        `<a href="${siteUrl}/job-board.html">Retour aux offres</a>`, siteUrl), {
        status: 503,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '60' },
      });
    }
    if (!reponse.ok) {
      // Offre expirée (archivée) : 410 Gone, comme le demande la doc Google
      // Job Posting pour une offre disparue. La page reste utile pour l'humain.
      return reponseOffreAbsente('Cette offre n\'est plus disponible',
        'L\'offre que vous cherchez a été retirée ou a expiré. Découvrez les offres actuellement en ligne.',
        siteUrl);
    }
    const job = await reponse.json();
    // Une fiche de test ne se visite pas : 404, comme une offre retirée.
    if (job.source === 'test_source' || String(job.slug || '').startsWith('test-')) {
      return reponseOffreAbsente('Cette offre n\'est plus disponible',
        'Cette adresse ne correspond à aucune offre publiée.', siteUrl);
    }
    const urlCanonique = `${siteUrl}/offre/${encodeURIComponent(job.slug || slug)}`;
    const { html } = await construire(job, urlCanonique);
    return new Response(reecrireLiens(html), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Dix minutes de cache, puis une heure de service pendant la
        // revalidation. Mêmes valeurs que sur Vercel : c'est ce qui évite
        // que Google declenche 351 appels a l'API.
        'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch (erreur) {
    // Ne jamais rendre une page vide en silence : une panne doit se voir.
    console.error('[offre] echec pour', slug, erreur);
    return new Response(pageAbsente('Service momentanément indisponible',
      `<a href="${siteUrl}/job-board.html">Retour aux offres</a>`, siteUrl), {
      status: 502,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}
