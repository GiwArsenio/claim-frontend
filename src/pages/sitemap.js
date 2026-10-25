// src/pages/sitemap.js — Sitemap dynamique CLAIM!
//
// Portage depuis api/sitemap.js (Vercel). La logique est inchangée : mêmes
// appels à l'API, mêmes pages statiques, mêmes règles de priorité.
//
// Contenu :
//   - Les pages statiques
//   - Les offres individuelles (/offre/{slug})
//
// Les pages de pagination du job board (?page=N) ne sont pas declarees. Le
// board est rendu en JavaScript : ces adresses servent le meme document et ne
// se distinguent que par leur etat cote client. La balise canonique de la page
// les consolide vers le board — les declarer ici enverrait le signal inverse.

const SITE_URL_PAR_DEFAUT = 'https://claimyourjob.fr';

export async function rendreSitemap(env) {
  const apiBase = (env && env.API_URL) || 'https://api.claimyourjob.fr/api/v1';
  const siteUrl = (env && env.SITE_URL) || SITE_URL_PAR_DEFAUT;

  try {
    // 1. Connaître le nombre total d'offres
    const r = await fetch(`${apiBase}/jobs?per_page=1&limit=1&page=1`);
    const d = await r.json();
    const total = d.pagination?.total || 0;

    // 2. Récupérer tous les slugs pour les URLs individuelles
    const allSlugs = [];
    for (let p = 1; p <= Math.ceil(total / 300); p++) {
      const pr = await fetch(`${apiBase}/jobs?per_page=300&limit=300&page=${p}`);
      const pd = await pr.json();
      (pd.data || []).forEach(j => {
        if (j.slug) allSlugs.push({ slug: j.slug, date: j.source_published_at });
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // 3. Pages statiques
    const staticPages = [
      // L'accueil porte les chiffres du jour, et le board la liste : les deux
      // changent tous les matins, la date du jour y est exacte.
      { url: '/',                          lastmod: today, priority: '1.0', changefreq: 'daily' },
      { url: '/job-board.html',            lastmod: today, priority: '0.9', changefreq: 'daily' },
      // Ces deux pages changent rarement. Mieux vaut ne rien déclarer qu'une
      // date du jour systématiquement fausse : Google apprend à ignorer un
      // lastmod qui ne bouge jamais vraiment.
      { url: '/claim-entreprises.html',    priority: '0.7', changefreq: 'weekly'  },
      { url: '/claim-observatoire.html',   priority: '0.6', changefreq: 'monthly' },
    ];

    // 4. Pages offres individuelles
    const jobPages = allSlugs.map(({ slug, date }) => ({
      // Les slugs comportent des accents : une adresse de sitemap doit être
      // encodée, sinon elle ne correspond à aucune ressource.
      url:        `/offre/${encodeURIComponent(slug)}`,
      lastmod:    date ? date.slice(0, 10) : undefined,
      priority:   '0.6',
      changefreq: 'weekly',
    }));

    // 5. Générer le XML
    const urlEntries = [...staticPages, ...jobPages]
      .map(({ url, lastmod, priority, changefreq }) => `
  <url>
    <loc>${siteUrl}${url}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        // Une heure : le sitemap change chaque matin, après la collecte.
        'cache-control': 's-maxage=3600, stale-while-revalidate',
      },
    });

  } catch (e) {
    console.error('[sitemap] error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
