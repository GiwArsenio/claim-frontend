// api/sitemap.js — Sitemap dynamique CLAIM! (Vercel Serverless)
// Génère un sitemap XML incluant :
//   - Les pages statiques
//   - Les pages de pagination (?page=N) pour le job board
//   - Les offres individuelles (/offre/{slug})

const API_BASE = process.env.API_URL || 'https://claim-api-production-06b3.up.railway.app/api/v1';
const SITE_URL = process.env.SITE_URL || 'https://claimyourjob.fr';
const PAGE_SIZE = 20;

module.exports = async (req, res) => {
  try {
    // 1. Récupérer le total d'offres pour calculer le nb de pages
    const r = await fetch(`${API_BASE}/jobs?per_page=1&limit=1&page=1`);
    const d = await r.json();
    const total = d.pagination?.total || 0;
    const pages = Math.ceil(total / PAGE_SIZE);

    // 2. Récupérer tous les slugs pour les URLs individuelles
    const allSlugs = [];
    for (let p = 1; p <= Math.ceil(total / 300); p++) {
      const pr = await fetch(`${API_BASE}/jobs?per_page=300&limit=300&page=${p}`);
      const pd = await pr.json();
      (pd.data || []).forEach(j => {
        if (j.slug) allSlugs.push({ slug: j.slug, date: j.source_published_at });
      });
    }

    // 3. Pages statiques
    const staticPages = [
      { url: '/',                          priority: '1.0', changefreq: 'daily'   },
      { url: '/claim-job-board.html',      priority: '1.0', changefreq: 'daily'   },
      { url: '/claim-entreprises.html',    priority: '0.7', changefreq: 'weekly'  },
      { url: '/claim-observatoire.html',   priority: '0.6', changefreq: 'monthly' },
    ];

    // 4. Pages de pagination du job board
    const paginationPages = [];
    for (let p = 1; p <= pages; p++) {
      paginationPages.push({
        url:        p === 1 ? '/claim-job-board.html' : `/claim-job-board.html?page=${p}`,
        priority:   p === 1 ? '1.0' : '0.8',
        changefreq: 'daily',
      });
    }

    // 5. Pages offres individuelles
    const jobPages = allSlugs.map(({ slug, date }) => ({
      url:        `/offre/${slug}`,
      lastmod:    date ? date.slice(0, 10) : undefined,
      priority:   '0.6',
      changefreq: 'weekly',
    }));

    // 6. Générer le XML
    const today = new Date().toISOString().slice(0, 10);
    const urlEntries = [...staticPages, ...paginationPages, ...jobPages]
      .map(({ url, lastmod, priority, changefreq }) => `
  <url>
    <loc>${SITE_URL}${url}</loc>
    <lastmod>${lastmod || today}</lastmod>
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

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(xml);

  } catch (e) {
    console.error('[sitemap] error:', e);
    res.status(500).json({ error: e.message });
  }
};
