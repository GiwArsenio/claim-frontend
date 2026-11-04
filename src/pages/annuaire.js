// Annuaire public, identique pour les humains et les robots : 20 offres/page.
// Le board conserve sa split view et son chargement incrémental.
const BASE = 'https://claimyourjob.com/fr';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const adresse = p => `${BASE}/offres.html${p > 1 ? `?page=${p}` : ''}`;
export async function rendreAnnuaire(request, env) {
  const params = new URL(request.url).searchParams;
  const page = params.get('page') || '1';
  const error = (status, text) => new Response(text, {status, headers:{'content-type':'text/plain; charset=utf-8','x-robots-tag':'noindex','cache-control':'no-store'}});
  if ([...params.keys()].some(k => k !== 'page') || params.getAll('page').length > 1 || !/^[1-9]\d{0,5}$/.test(page)) return error(400, 'Pagination invalide. Aucun filtre dans cet annuaire : utilisez le job board.');
  if (params.has('page') && page === '1') return Response.redirect(adresse(1),301);
  try {
    const base = env.API_URL || 'https://claim-api-production-06b3.up.railway.app/api/v1';
    const response = await fetch(`${base}/jobs?per_page=20&limit=20&page=${page}&order=desc`);
    if (!response.ok) return error(503, 'Les offres sont temporairement indisponibles.');
    const data = await response.json();
    const total = data.pagination?.total;
    if (!Number.isInteger(total) || total < 0 || !Array.isArray(data.data)) return error(503,'Réponse des offres invalide.');
    const pages = Math.max(1,Math.ceil(total/20));
    if (Number(page) > pages) return error(404, 'Cette page n’existe pas.');
    const jobs = data.data.slice(0,20);
    if (total > 0 && jobs.length === 0) return error(503,'Liste temporairement indisponible.');
    const rows = jobs.map(j => `<li><article><h2><a href="${BASE}/offre/${encodeURIComponent(j.slug)}">${esc(j.title)}</a></h2><p>${esc(j.companies?.name || j.source)} · ${esc(j.city || 'Lieu non précisé')}${j.contract_type ? ' · '+esc(j.contract_type.toUpperCase()) : ''}</p><a href="${BASE}/job-board.html">Lire dans le job board</a></article></li>`).join('');
    const nav = `<nav aria-label="Pagination des offres">${Number(page)>1 ? `<a rel="prev" href="${adresse(Number(page)-1)}">← Page précédente</a>` : ''} <span>Page ${page} sur ${pages}</span> ${Number(page)<pages ? `<a rel="next" href="${adresse(Number(page)+1)}">Page suivante →</a>` : ''}</nav>`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offres d’emploi assurance et actuariat — page ${page} | CLAIM!</title><meta name="description" content="Parcourez les offres d’emploi actuariat, assurance et data. Page ${page} sur ${pages}."><link rel="canonical" href="${adresse(Number(page))}"><style>body{font-family:system-ui;max-width:960px;margin:auto;padding:1.5rem;line-height:1.6;background:#f8fafb;color:#172d35}a{color:#005563}a:focus-visible{outline:3px solid #005563;outline-offset:4px}ul{list-style:none;padding:0}article{background:white;border:1px solid #c6d9df;border-radius:12px;padding:1rem;margin:1rem 0}h2{font-size:1.15rem;margin:0}nav{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}</style></head><body><header><a href="${BASE}/">CLAIM! — Accueil</a> · <a href="${BASE}/job-board.html">Rechercher et filtrer dans le job board</a></header><main><h1>Offres d’emploi actuariat, assurance et data</h1><p>${total} offres au total · ${jobs.length} offres sur cette page. Pour filtrer ou comparer les offres, utilisez le <a href="${BASE}/job-board.html">job board</a>.</p>${nav}<ul>${rows}</ul>${nav}</main></body></html>`;
    return new Response(request.method === 'HEAD' ? null : html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, s-maxage=300'}});
  } catch { return error(503,'Les offres sont temporairement indisponibles.'); }
}
