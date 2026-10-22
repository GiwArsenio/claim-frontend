// tests/parcours/helpers/reponses.cjs
//
// Les réponses du faux backend, séparées du serveur HTTP.
//
// Raison d'être : le serveur reste lisible. Chaque réponse simulée
// (liste, sélection, statistiques, détail) a sa fonction ici, testable
// seule, sans démarrer un port.

const { OFFRES } = require('./donnees.cjs');

function normaliser(valeur) {
  return String(valeur || '').toLowerCase().trim();
}

function correspondre(offre, params) {
  const q = normaliser(params.get('q'));
  if (q) {
    const nom = (offre.companies && offre.companies.name) || '';
    const foin = (offre.title + ' ' + nom).toLowerCase();
    if (!foin.includes(q)) return false;
  }
  const city = normaliser(params.get('city'));
  if (city && normaliser(offre.city) !== city) return false;
  const contract = params.get('contract');
  if (contract && offre.contract_type !== contract) return false;
  const specialty = params.get('specialty');
  if (specialty && offre.jev_specialty !== specialty) return false;
  const experience = params.get('experience');
  if (experience && offre.jev_experience !== experience) return false;
  const ats = params.get('ats');
  if (ats && offre.source !== ats) return false;
  return true;
}




function reponseListe(url, offres) {
  const params = new URL(url).searchParams;
  const page = Number(params.get('page') || 1);
  const limite = Number(params.get('per_page') || 20);
  const retenues = offres.filter((o) => correspondre(o, params));
  const debut = (page - 1) * limite;
  const tranche = retenues.slice(debut, debut + limite);
  const pages = Math.max(1, Math.ceil(retenues.length / limite));
  const pagination = {};
  pagination.total = retenues.length;
  pagination.page = page;
  pagination.per_page = limite;
  pagination.pages = pages;
  const corps = {};
  corps.data = tranche;
  corps.pagination = pagination;
  return { code: 200, corps: corps };
}

function reponseSelection(url, offres) {
  const params = new URL(url).searchParams;
  const limite = Number(params.get('limite') || 6);
  const retenues = offres.filter((o) => correspondre(o, params)).slice(0, limite);
  const pagination = {};
  pagination.total = retenues.length;
  pagination.page = 1;
  pagination.per_page = limite;
  pagination.pages = 1;
  const corps = {};
  corps.data = retenues;
  corps.pagination = pagination;
  return { code: 200, corps: corps };
}

function reponseStats(url, offres) {
  const sources = new Set();
  offres.forEach((o) => { if (o.source) sources.add(o.source); });
  const corps = {};
  corps.total = offres.length;
  corps.published = offres.length;
  corps.sources = sources.size;
  return { code: 200, corps: corps };
}

function reponseDetail(identifiant, offres) {
  const trouve = offres.find(
    (o) => String(o.id) === String(identifiant) || o.slug === identifiant
  );
  if (!trouve) return { code: 404, corps: { detail: 'Offre introuvable' } };
  return { code: 200, corps: trouve };
}

module.exports = {
  reponseListe: reponseListe,
  reponseSelection: reponseSelection,
  reponseStats: reponseStats,
  reponseDetail: reponseDetail,
  correspondre: correspondre,
  OFFRES: OFFRES,
};
