// tests/helpers/serveur-simule.cjs
//
// Un faux backend, exécuté en local.
//
// Raison d'être : les tests ne doivent dépendre ni de la production ni du
// réseau. Une panne de Railway ne doit pas faire échouer un test unitaire,
// et un test doit pouvoir reproduire une panne à volonté.
//
// Le serveur expose exactement le contrat consommé par le frontend :
//   GET /jobs            → liste paginée
//   GET /jobs/:slug      → détail d'une offre
//
// Il permet de choisir la réponse : une offre précise, une erreur HTTP, un
// délai, un JSON invalide.

const http = require('node:http');

const OFFRE_COMPLETE = {
  id: 'aaaaaaaa-1111-2222-3333-444444444444',
  slug: 'actuaire-senior-h-f-test',
  title: 'Actuaire senior H/F',
  ville: 'Paris',
  city: 'Paris',
  source: 'axa',
  source_url: 'https://example.test/actuaire-senior',
  source_published_at: '2026-10-01T09:00:00Z',
  contract_type: 'cdi',
  description_raw: 'Premier paragraphe de l annonce, assez long pour servir de description du document et vérifier le repli sur le titre.',
  description_html: '<p>Premier paragraphe.</p><ul><li>Une mission</li></ul>',
  jev_specialty: 'actuariat',
  jev_experience: 'senior',
  jev_salaire_bas: 50000,
  jev_salaire_haut: 60000,
  jev_salaire_libelle: '50–60 k€/an',
  jev_salaire_periodicite: 'annuel',
  jev_publishable: { specialty: true, experience: true, salaire: true },
  companies: { name: 'AXA', slug: 'axa', logo_url: null, website_url: 'https://axa.test' },
  sections: [{ titre: 'Le poste', paragraphes: ['Un rôle.'] }],
};

const OFFRE_MINIMALE = {
  id: 'bbbbbbbb-1111-2222-3333-444444444444',
  slug: 'offre-minimale-test',
  title: 'Poste',
  source: 'inconnu',
  companies: {},
};

const OFFRE_SANS_SALAIRE = {
  ...OFFRE_COMPLETE,
  id: 'cccccccc-1111-2222-3333-444444444444',
  slug: 'actuaire-sans-salaire-test',
  jev_salaire_bas: null,
  jev_salaire_haut: null,
  jev_salaire_libelle: null,
};

const OFFRE_SANS_DATE = {
  ...OFFRE_COMPLETE,
  id: 'dddddddd-1111-2222-3333-444444444444',
  slug: 'actuaire-sans-date-test',
  source_published_at: null,
};

// Une offre dont les champs se contredisent : la publication doit refuser
// de montrer une spécialité non publiable.
const OFFRE_NON_PUBLIABLE = {
  ...OFFRE_COMPLETE,
  id: 'eeeeeeee-1111-2222-3333-444444444444',
  slug: 'actuaire-non-publiable-test',
  jev_publishable: { specialty: false, experience: true, salaire: true },
};

// Un titre et une description qui Tentent de casser le balisage.
const OFFRE_HOSTILE = {
  ...OFFRE_COMPLETE,
  id: 'ffffffff-1111-2222-3333-444444444444',
  slug: 'actuaire-hostile-test',
  title: 'Actuaire </script><script>alert(1)</script> "quoted" &amp; <b>gras</b>',
  ville: '<img src=x onerror=alert(1)>',
  companies: { name: '"><script>alert(2)</script>', slug: 'x', logo_url: null },
  description_raw: '</script><script>alert(3)</script>',
  jev_salaire_libelle: '</script><script>alert(4)</script>',
};

const OFFRES = [OFFRE_COMPLETE, OFFRE_MINIMALE, OFFRE_SANS_SALAIRE, OFFRE_SANS_DATE, OFFRE_NON_PUBLIABLE, OFFRE_HOSTILE];

// Réponses possibles pour une route.
const REPONSES = {
  ok: (donnees) => ({ code: 200, corps: donnees }),
  introuvable: () => ({ code: 404, corps: { detail: 'Offre introuvable' } }),
  rateLimite: () => ({ code: 429, corps: { detail: 'Trop de requêtes' } }),
  panne: () => ({ code: 500, corps: { detail: 'Erreur interne' } }),
  indisponible: () => ({ code: 503, corps: { detail: 'Service indisponible' } }),
  interdit: () => ({ code: 403, corps: { detail: 'Interdit' } }),
  invalide: () => ({ code: 200, corpsBrut: '{ ceci n est pas du JSON' }),
  lent: (donnees, ms) => ({ code: 200, corps: donnees, delai: ms }),
};

/**
 * Démarre un faux backend.
 * @param {object} options
 *   - base       : URL de base du frontend qui l'interroge (par défaut production)
 *   - offres     : liste renvoyée par /jobs
 *   - detail     : fonction (slug) → réponse
 *   - liste      : fonction (url) → réponse
 * @returns {Promise<{url:string, arreter:Function, appels:Array}>}
 */
function demarrer(options = {}) {
  const offres = options.offres || OFFRES;
  const detail = options.detail || ((slug) => {
    const trouve = offres.find((o) => o.slug === slug);
    return trouve ? REPONSES.ok(trouve) : REPONSES.introuvable();
  });
  const liste = options.liste || ((url) => {
    const page = Number(new URL(url).searchParams.get('page') || 1);
    const limite = Number(new URL(url).searchParams.get('per_page') || 300);
    const debut = (page - 1) * limite;
    const tranche = offres.slice(debut, debut + limite);
    return REPONSES.ok({ data: tranche, pagination: { total: offres.length, page, per_page: limite } });
  });

  const appels = [];

  const serveur = http.createServer((req, res) => {
    // req.url est relatif : sans base, new URL échoue.
    const url = new URL(req.url, 'http://127.0.0.1');
    appels.push({ methode: req.method, chemin: url.pathname, recherche: url.search });

    const repondre = (rep) => {
      const envoyer = () => {
        if (rep.corpsBrut !== undefined) {
          res.writeHead(rep.code, { 'Content-Type': 'application/json' });
          res.end(rep.corpsBrut);
          return;
        }
        res.writeHead(rep.code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rep.corps));
      };
      if (rep.delai) setTimeout(envoyer, rep.delai);
      else envoyer();
    };

    // Le frontend consomme l API sous un préfixe (/api/v1/jobs/…). Le
    // faux backend sert les deux formes : le préfixe éventuel est retiré.
    const chemin = url.pathname.replace(/^\/api\/v1/, '');

    if (chemin.startsWith('/jobs/')) {
      const slug = decodeURIComponent(chemin.slice('/jobs/'.length));
      repondre(detail(slug));
      return;
    }
    if (chemin === '/jobs') {
      repondre(liste(url.toString()));
      return;
    }
    repondre(REPONSES.introuvable());
  });

  return new Promise((resolve) => {
    serveur.listen(0, '127.0.0.1', () => {
      const port = serveur.address().port;
      resolve({
        url: 'http://127.0.0.1:' + port,
        appels,
        arreter: () => new Promise((r) => serveur.close(() => r())),
      });
    });
  });
}

module.exports = {
  demarrer,
  REPONSES,
  OFFRES,
  OFFRE_COMPLETE,
  OFFRE_MINIMALE,
  OFFRE_SANS_SALAIRE,
  OFFRE_SANS_DATE,
  OFFRE_NON_PUBLIABLE,
  OFFRE_HOSTILE,
};
