// CLAIM! — France uniquement : une source publique, https://claimyourjob.com/fr/.
// run_worker_first garantit que les fichiers existants passent aussi par ce routeur.
import { rendreOffre } from './pages/offre.js';
import { rendreSitemap } from './pages/sitemap.js';
import { rendreRobots } from './pages/robots.js';
import { relayerMonitoringApi, rendreMonitoring } from './pages/monitoring.js';
import { estExempt, reecrireLiens } from './maillage.js';

export const ORIGINE_MARCHE = 'https://claimyourjob.com';
const redirect = (path, search = '') => Response.redirect(`${ORIGINE_MARCHE}${path}${search}`, 301);
const sansMarche = path => path === '/fr' ? '/' : path.startsWith('/fr/') ? path.slice(3) : path;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const chemin = url.pathname;
    const nu = sansMarche(chemin);
    const autorise = ['claimyourjob.com', 'www.claimyourjob.com', 'claimyourjob.fr', 'www.claimyourjob.fr'];
    // Le domaine workers.dev et les domaines non attachés ne doivent pas indexer le site.
    // Les sondes locales testent la production via leur en-tête Host.
    if (!autorise.includes(url.hostname)) return new Response('Domaine non configuré', {status:404});

    // Surface interne : un seul chemin, /monitoring, avec cookie Path=/monitoring.
    // Les variantes /fr et www convergent avant tout relais, sinon la découpe API
    // et le cookie seraient incorrects. L'ancien domaine garde sa session existante.
    if (nu.startsWith('/monitoring/api/') || nu === '/monitoring' || nu === '/monitoring/') {
      if (chemin !== nu || url.hostname.startsWith('www.')) {
        const origin = url.hostname.endsWith('.fr') ? 'https://claimyourjob.fr' : ORIGINE_MARCHE;
        return Response.redirect(`${origin}${nu}${url.search}`, 307); // préserver les POST privés
      }
      if (chemin.startsWith('/monitoring/api/')) return relayerMonitoringApi(request, env);
      if (chemin === '/monitoring' || chemin === '/monitoring/') return rendreMonitoring(request, env);
    }
    // Le fichier du dashboard ne doit jamais être servi directement par les assets.
    if (nu === '/monitoring.html') return redirect('/monitoring', url.search);

    // Assets partagés, canoniques à la racine du .com. /fr/assets/... est un alias.
    if (estExempt(nu)) {
      if (url.hostname !== 'claimyourjob.com' || chemin !== nu) return redirect(nu, url.search);
      return servirStatique(request, env, nu);
    }
    const destination = nu === '/claim-job-board.html' ? '/fr/job-board.html'
      : nu === '/' || nu === '/index.html' ? '/fr/' : `/fr${nu}`;
    if (url.hostname !== 'claimyourjob.com' || chemin !== destination || url.protocol !== 'https:') {
      return redirect(destination, url.search);
    }
    if (nu === '/robots.txt') return rendreRobots(env);
    if (nu === '/sitemap.xml') return rendreSitemap(env);
    if (nu.startsWith('/offre/')) {
      let slug = nu.slice('/offre/'.length);
      try { slug = decodeURIComponent(slug); } catch { /* l'API traite le slug invalide */ }
      return rendreOffre(slug, env);
    }
    return servirStatique(request, env, nu === '/' ? '/index.html' : nu);
  }
};

async function servirStatique(request, env, chemin) {
  if (!env.ASSETS) return new Response('Non trouvé', {status:404});
  const cible = new URL(request.url);
  cible.pathname = chemin;
  const response = await env.ASSETS.fetch(new Request(cible, request));
  if (!(response.headers.get('content-type') || '').includes('text/html') || ![200,404].includes(response.status)) return response;
  // Réécrire aussi le maillage de la 404. Conserver statut et en-têtes, supprimer
  // les validateurs portant sur les octets d'origine devenus invalides.
  const headers = new Headers(response.headers);
  for (const key of ['content-length','etag','content-encoding']) headers.delete(key);
  if (response.status === 404) headers.set('x-robots-tag','noindex');
  const html = reecrireLiens(await response.text());
  return new Response(request.method === 'HEAD' ? null : html, {status:response.status, headers});
}
