// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — Le maillage interne sous /fr
//
// Le site est servi sous `claimyourjob.com/fr/`. Presque tous ses liens
// sont root-relative — `href="/"`, `href="/job-board.html"` — écrits
// quand le site vivait à la racine du .fr. Servis tels quels depuis
// /fr/, ils repartiraient vers la racine du .com, qui redirige vers
// /fr/ : deux redirections à chaque clic, et un signal SEO dilué.
//
// Ce module fait le pont. Il ne touche pas au HTML des pages : il
// réécrit, à la volée, les chemins absolus qui mènent au site pour les
// ramener sous /fr/.
//
// Ce qu'il NE réécrit pas, et pourquoi :
//
//   #…                  un fragment ne change pas de page
//   ?…                  une query absolue reste dans la page courante
//   //…                 un protocole relatif est un site externe
//   mailto:, tel:       pas un chemin du site
//   https://…           absolu : déjà une adresse complète
//   /fr/…               déjà sous /fr/ : ne pas doubler le préfixe
//
// La table EXEMPTS est le point de vigilance : un chemin du site qui doit
// rester hors /fr/ — les assets, qui vivent à la racine du domaine et
// sont servis par le CDN — y figure explicitement. Ajouter une famille
// d'adresses sans se poser la question fait casser silencieusement une
// page entière.
// ─────────────────────────────────────────────────────────────────────────────

export const PREFIXE_MARCHE = '/fr';

// Les chemins qui doivent rester à la racine du domaine, même servis
// depuis /fr/. Les assets sont dédupliqués par prepare-assets.sh : une
// seule copie, à la racine de public/, accessible depuis les deux
// espaces de noms.
const EXEMPTS = [
  '/assets/',
  '/logos/',
  '/favicon.ico',
];

export function estExempt(chemin) {
  // Un asset demandé sous /fr/assets/… reste un asset : il est servi à la
  // racine du domaine, et le préfixe de marché ne le concerne pas. Sans
  // cette borne, /fr/assets/theme.css passerait par la réécriture de page
  // et serait servi comme un document.
  const nu = (chemin === PREFIXE_MARCHE || chemin.startsWith(PREFIXE_MARCHE + '/')) ? chemin.slice(PREFIXE_MARCHE.length) || '/' : chemin;
  return EXEMPTS.some((p) => nu === p || nu.startsWith(p));
}

/**
 * Préfixe un chemin root-relative par le marché, s'il ne l'est pas déjà.
 * Renvoie `null` quand le chemin ne doit pas être touché.
 */
export function cheminMarche(chemin) {
  if (typeof chemin !== 'string' || chemin === '') return null;
  // Fragment, query absolue, protocole relatif : la page courante.
  if (chemin.startsWith('#') || chemin.startsWith('?') || chemin.startsWith('//')) return null;
  // Schéma ou navigateur : pas un chemin du site.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(chemin)) return null;
  // Le site lui-même, ou déjà sous /fr/.
  if (estExempt(chemin)) return null;
  if (chemin === PREFIXE_MARCHE || chemin.startsWith(PREFIXE_MARCHE + '/')) return null;
  if (!chemin.startsWith('/')) return null;
  return PREFIXE_MARCHE + chemin;
}

/**
 * Réécrit tous les attributs de lien d'un document HTML.
 * Un seul passage : `href`, `src`, `action`, `formaction`, `poster`.
 */
export function reecrireLiens(html) {
  return html.replace(
    /\b(href|src|action|formaction|poster)\s*=\s*("|')([^"']*)\2/gi,
    (entier, attribut, guillemet, valeur) => {
      const cible = cheminMarche(valeur);
      return cible ? `${attribut}=${guillemet}${cible}${guillemet}` : entier;
    }
  );
}

