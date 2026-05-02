/**
 * GET /api/jobs
 * Proxy sécurisé vers l'API externe d'offres d'emploi.
 * La clé API est stockée en variable d'environnement Vercel (jamais exposée au front).
 *
 * Réponse : { jobs: [...], total: N, updatedAt: "ISO date" }
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const API_URL = process.env.JOBS_API_URL;
    const API_KEY = process.env.JOBS_API_KEY;

    // Si pas encore d'API branchée → retourne les offres fictives
    if (!API_URL) {
      return res.status(200).json({
        source: 'mock',
        updatedAt: new Date().toISOString(),
        total: 0,
        jobs: []
      });
    }

    const response = await fetch(API_URL, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json({
      source: 'api',
      updatedAt: new Date().toISOString(),
      total: data.length ?? 0,
      jobs: data
    });

  } catch (err) {
    console.error('[/api/jobs]', err.message);
    return res.status(500).json({
      error: 'Failed to fetch jobs',
      message: err.message
    });
  }
}
