// api/sitemap.js — Sitemap dynamique CLAIM! (Vercel Serverless)
// Génère un sitemap XML incluant :
//   - Les pages statiques
//   - Les offres individuelles (/offre/{slug})
//
// Les pages de pagination du job board (?page=N) ne sont pas declarees. Le
// board est rendu en JavaScript : ces adresses servent le meme document et ne
// se distinguent que par leur etat cote client. La balise canonique de la page
// les consolide vers le board — les declarer ici enverrait le signal inverse.

const API_BASE = process.env.API_URL || 'https://claim-api-production-06b3.up.railway.app/api/v1';
const SITE_URL = process.env.SITE_URL || 'https://claimyourjob.fr';

// Délai maximal de lecture du backend. Sans lui, une requête qui traîne
// immobilise la fonction serveur jusqu à la limite de la plateforme.
const DELAI_LECTURE_API_MS = 2500;

module.exports = async (req, res) => {
  try {
    // 1. Connaître le nombre total d'offres
    //
    // Chaque appel au backend doit être vérifié. Sans cela, une panne
    // produisait un sitemap "complet" contenant seulement les pages
    // statiques : Google le lisait, ne redemandait rien, et les offres
    // disparaissaient de l index sans que rien ne se plaigne.
    const lireJson = async (url) => {
      const reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_LECTURE_API_MS) });
      if (!reponse.ok) {
        throw new Error('backend en erreur : HTTP ' + reponse.status);
      }
      return reponse.json();
    };

    const d = await lireJson(`${API_BASE}/jobs?per_page=1&limit=1&page=1`);
    const total = d.pagination?.total || 0;

    // 2. Récupérer tous les slugs pour les URLs individuelles
    const allSlugs = [];
    const vus = new Set();
    for (let p = 1; p <= Math.ceil(total / 300); p++) {
      const pd = await lireJson(`${API_BASE}/jobs?per_page=300&limit=300&page=${p}`);
      (pd.data || []).forEach(j => {
        if (!j.slug) return;
        // Une même adresse ne doit pas figurer deux fois. Sans cette
        // déduplication, deux offres de même slug produisaient deux
        // entrées : Google y voyait deux pages, dont une inconnue.
        if (vus.has(j.slug)) return;
        vus.add(j.slug);
        allSlugs.push({ slug: j.slug, date: j.source_published_at });
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
    <loc>${SITE_URL}${url}</loc>
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

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(xml);

  } catch (e) {
    console.error('[sitemap] error:', e);
    res.status(500).json({ error: e.message });
  }
};
