// src/pages/offre.js — Fiche d'une offre, rendue côté serveur.
//
// Portage depuis api/offre.js (Vercel). Le HTML produit est strictement le
// même : la fabrication de la page est dans _offre-rendu.js, repris tel
// quel depuis le fichier Vercel. Ce fichier ne fait que lbracketing
// Workers : appeler l'API, puis renvoyer une Response.
//
// Adresse publique : /offre/{slug}

import { construire, configurerUrls } from './_offre-rendu.js';

const SITE_URL_PAR_DEFAUT = 'https://claimyourjob.fr';

function pageAbsente(titre, message, siteUrl) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title><meta name="robots" content="noindex"><link rel="canonical" href="${siteUrl}/job-board.html"></head><body style="font-family:system-ui;padding:2rem"><h1>${titre}</h1><p>${message}</p></body></html>`;
}

export async function rendreOffre(slug, env) {
  const apiBase = (env && env.API_URL) || 'https://claim-api-production-06b3.up.railway.app/api/v1';
  const siteUrl = (env && env.SITE_URL) || SITE_URL_PAR_DEFAUT;

  // Le module de rendu lit ses URLs dans des variables : on les lui donne
  // avant de construire la page.
  configurerUrls(apiBase, siteUrl);

  if (!slug) {
    return new Response(pageAbsente('Offre introuvable', 'Cette adresse ne correspond à aucune offre.', siteUrl), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const reponse = await fetch(`${apiBase}/jobs/${encodeURIComponent(slug)}`);
    if (!reponse.ok) {
      // Une offre retirée doit répondre 404 : c'est ce que le sitemap garantit.
      return new Response(pageAbsente('Offre introuvable',
        `Cette offre n'est plus en ligne. <a href="${siteUrl}/job-board.html">Voir les offres actuelles</a>.`, siteUrl), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    const job = await reponse.json();
    const urlCanonique = `${siteUrl}/offre/${encodeURIComponent(job.slug || slug)}`;
    const { html } = await construire(job, urlCanonique);
    return new Response(html, {
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
