// src/pages/robots.js — robots.txt dynamique
//
// Portage depuis api/robots.js (Vercel). La logique est inchangée ; seule
// la forme de la réponse change : une Response Web standard au lieu de
// `res.setHeader(...)` + `res.status(...).send(...)`.

const SITE_URL = 'https://claimyourjob.fr';

export async function rendreRobots(env) {
  const site = (env && env.SITE_URL) || SITE_URL;
  const content = `User-agent: *
Allow: /

# La pagination du board (?page=N) n'est pas declaree dans le sitemap : la
# balise canonique la consolide vers l'accueil. Elle reste explorable — un
# Disallow empecherait Google de lire cette canonique.

# Sitemap
Sitemap: ${site}/sitemap.xml
`;
  return new Response(content, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Une journée : le robots.txt change rarement, et Google le demande
      // rarement. La même durée que sur Vercel.
      'cache-control': 's-maxage=86400',
    },
  });
}
