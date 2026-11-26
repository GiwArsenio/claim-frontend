/* ─────────────────────────────────────────────────────────────────────────────
   FIXTURES CLAIM! — données de test synthétiques

   Aucune donnée réelle, aucun secret. Ces offres servent aux parcours
   navigateur : elles permettent de rejouer recherche, filtres, pagination,
   fiche, candidature et partage sans dépendre de la production.

   Le catalogue de référence (6.1 du document d'audit) demande des cas
   complets et des cas minimaux. Les deux sont ici. */
'use strict';

/* Une offre complète : tous les champs possibles, remplis. */
const OFFRE_COMPLETE = {
  id: 'offre-complete-1',
  title: 'Actuaire confirmé (H/F) — risques Non-Vie',
  slug: 'actuaire-confirme-risques-non-vie',
  city: 'Paris',
  region: 'Île-de-France',
  contract_type: 'cdi',
  specialty: 'actuariat_iard',
  specialty_tags: ['actuariat', 'modelisation'],
  risk_branches: ['iard'],
  experience_level: 'senior',
  description_raw: '<p>Vous rejoignez une direction actuarie de dix personnes.</p><p>Vous pilotez la refonte de la provision pour tail premium.</p>',
  description_html: '<div class="content-intro"><p>Vous rejoignez une direction actuarie de dix personnes.</p></div>',
  source: 'Actuaires Conseils',
  source_url: 'https://exemple.test/actuaire-confirme',
  source_published_at: '2026-10-15T09:00:00Z',
  salary_min: 55000,
  salary_max: 70000,
  url: 'https://exemple.test/actuaire-confirme',
  companies: {
    name: 'Actuaires Conseils',
    slug: 'actuaires-conseils',
    logo_url: null,
    type: 'cabinet_conseil',
    company_type: 'cabinet_conseil',
    sector: 'Conseil actuariel',
  },
};

/* Une offre minimale : seulement ce que l'interface sait afficher. */
const OFFRE_MINIMALE = {
  id: 'offre-minimale-1',
  title: 'Chargé d’études actuarielles',
  slug: 'charge-etudes-actuarielles',
  contract_type: '',
  specialty: '',
  risk_branches: [],
  experience_level: '',
  description_raw: '',
  source: 'Source inconnue',
  source_url: '',
  source_published_at: null,
  salary_min: null,
  salary_max: null,
  companies: { name: 'Employeur non renseigné', slug: '', logo_url: null },
};

/* Une offre sans salaire, sans date, sans lieu : le cas qui a produit D02. */
const OFFRE_SANS_SALAIRE = {
  ...OFFRE_COMPLETE,
  id: 'offre-sans-salaire-1',
  slug: 'actuaire-sans-salaire',
  title: 'Actuaire (H/F) — vie',
  risk_branches: ['epargne_retraite'],
  salary_min: null,
  salary_max: null,
};

/* Une offre à description très longue : le cas de la famille M06. */
const OFFRE_LONGUE = {
  ...OFFRE_COMPLETE,
  id: 'offre-longue-1',
  slug: 'actuaire-description-tres-longue',
  title: 'Actuaire généraliste (H/F) — tous risques, poste très longuement décrit pour éprouver la mise en page',
  description_raw: '<p>' + 'Paragraphe de test. '.repeat(120) + '</p>',
  description_html: '<div class="content-intro"><p>' + 'Paragraphe de test. '.repeat(120) + '</p></div>',
};

/* Une offre dont les sections sont des <h2> écrits en capitales : le profil
   des annonces AXA, Generali et d'autres (T11). Sans règle de style, le
   navigateur rend un <h2> à 1,5 fois le corps, donc plus gros que le titre de
   l'offre. Le texte est assez long pour mesurer des lignes pleines. */
const PARAGRAPHE_LONG = 'Au sein de la direction technique, vous participez au pilotage des provisions, à la revue des hypothèses de sinistralité et à la production des analyses destinées aux comités de souscription, en lien étroit avec les équipes de données, de réassurance et de gestion des risques du groupe.';
const OFFRE_SECTIONS_CAPITALES = {
  ...OFFRE_COMPLETE,
  id: 'offre-sections-capitales-1',
  slug: 'actuaire-sections-en-capitales',
  title: 'Actuaire pricing (H/F) — sections en capitales',
  description_raw: '<p>' + PARAGRAPHE_LONG + '</p>',
  description_html:
    '<h2>VOTRE RÔLE ET VOS MISSIONS</h2>' +
    '<p>' + PARAGRAPHE_LONG + '</p>' +
    '<h3>Ce que vous ferez</h3>' +
    '<ul><li>' + PARAGRAPHE_LONG + '</li><li>Vous animez des ateliers ALM et R&amp;D avec les équipes métier.</li></ul>' +
    '<h2>VOTRE PROFIL</h2>' +
    '<p>' + PARAGRAPHE_LONG + '</p>',
};

/* Une offre dont le titre est volontairement très long : le texte long ne se
   limite pas à la description. */
const OFFRE_TITRE_LONG = {
  ...OFFRE_COMPLETE,
  id: 'offre-titre-long-1',
  slug: 'actuaire-titre-tres-long',
  title: 'Actuaire (H/F) Direction des risques et de laMethode reference_longue_pour_test_de_débordement_horizontal',
};

/* Une offre malveillante : sert aux familles U01 et U02. */
const OFFRE_MALVEILLANTE = {
  ...OFFRE_COMPLETE,
  id: 'offre-malveillante-1',
  slug: 'actuaire-malveillant',
  title: 'Actuaire <script>alert("xss")</script> & Cie',
  description_raw: '<p onclick="alert(1)">Texte <img src=x onerror=alert(2)></p>',
  source_url: 'javascript:alert(3)',
};

/* Employeurs de référence, pour l'annuaire. */
const EMPLOYEURS = [
  { name: 'Actuaires Conseils', slug: 'actuaires-conseils', type: 'cabinet_conseil', company_type: 'cabinet_conseil', sector: 'Conseil actuariel' },
  { name: 'AXA Assurances', slug: 'axa-assurances', type: 'assureur', company_type: 'assureur', sector: 'Assurance' },
  { name: 'BNP Paribas Cardif', slug: 'bnp-paribas-cardif', type: 'bancassureur', company_type: 'bancassureur', sector: 'Assurance vie' },
  { name: 'Groupe MAIF', slug: 'groupe-maif', type: 'mutuelle', company_type: 'mutuelle', sector: 'Mutuelle' },
  { name: 'SCOR SE', slug: 'scor', type: 'reassureur', company_type: 'reassureur', sector: 'Réassurance' },
  { name: 'Alan', slug: 'alan', type: 'insurtech', company_type: 'insurtech', sector: 'InsurTech' },
  { name: 'Aon France', slug: 'aon', type: 'courtier', company_type: 'courtier', sector: 'Courtage' },
];

/* Générateur d'un catalogue diversifié : le board doit avoir assez de matière
   pour que la pagination, les filtres et les états vides soient réels. */
const VILLES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Toulouse', 'Strasbourg', 'Nice', 'Rennes'];
const CONTRATS = ['cdi', 'cdd', 'alternance', 'stage', 'freelance'];
const SPECIALITES = ['actuariat_iard', 'actuariat_vie', 'data', 'ia', 'risk', 'actuariat_finance'];
const EXPERIENCES = ['junior', 'confirme', 'senior', 'manager'];
const SECTEURS = ['Assurance', 'Banque', 'Conseil actuariel', 'Mutuelle', 'Courtier', 'Start-up', 'Réassurance'];
const JEUX_BRANCHES = [
  ['iard'],
  ['epargne_retraite'],
  ['prevoyance_sante'],
  ['emprunteur'],
  ['reassurance', 'iard'],
  [],
];

function offreAleatoire(index) {
  const emp = EMPLOYEURS[index % EMPLOYEURS.length];
  const ville = VILLES[index % VILLES.length];
  const contrat = CONTRATS[index % CONTRATS.length];
  const specialite = SPECIALITES[index % SPECIALITES.length];
  const experience = EXPERIENCES[index % EXPERIENCES.length];
  const avecSalaire = index % 4 !== 3;
  const avecDate = index % 5 !== 4;
  const slug = `offre-synthetique-${index + 1}`;

  return {
    id: `syn-${index + 1}`,
    title: `Actuaire ${experience} (H/F) — ${SECTEURS[index % SECTEURS.length]}`,
    slug,
    city: ville,
    region: 'Île-de-France',
    contract_type: contrat,
    specialty: specialite,
    specialty_tags: [specialite],
    risk_branches: JEUX_BRANCHES[index % JEUX_BRANCHES.length],
    experience_level: experience,
    description_raw: `<p>Poste ${index + 1} au sein de ${emp.name} à ${ville}.</p><p>Vous rejoignez une équipe de risques de dix personnes.</p>`,
    description_html: `<div class="content-intro"><p>Poste ${index + 1} au sein de ${emp.name} à ${ville}.</p></div>`,
    source: emp.name,
    source_url: `https://exemple.test/${slug}`,
    source_published_at: avecDate ? new Date(Date.UTC(2026, 9, 1 + (index % 20))).toISOString() : null,
    salary_min: avecSalaire ? 40000 + index * 500 : null,
    salary_max: avecSalaire ? 55000 + index * 700 : null,
    url: `https://exemple.test/${slug}`,
    companies: {
      name: emp.name,
      slug: emp.slug,
      logo_url: null,
      type: emp.type,
      company_type: emp.company_type || emp.type,
      sector: emp.sector,
    },
  };
}

/* 45 offres : assez pour paginer (20 par page → 3 pages), assez pour que les
   filtres produisent des sous-ensembles non vides et des résultats vides. */
const TOUTES = [
  OFFRE_COMPLETE,
  OFFRE_MINIMALE,
  OFFRE_SANS_SALAIRE,
  OFFRE_LONGUE,
  OFFRE_TITRE_LONG,
  OFFRE_MALVEILLANTE,
  ...Array.from({ length: 45 }, (_, i) => offreAleatoire(i)),
  /* En dernier : l'ordre et le contenu des premières pages ne changent pas. */
  OFFRE_SECTIONS_CAPITALES,
];

module.exports = {
  TOUTES,
  OFFRE_COMPLETE,
  OFFRE_MINIMALE,
  OFFRE_SANS_SALAIRE,
  OFFRE_LONGUE,
  OFFRE_TITRE_LONG,
  OFFRE_MALVEILLANTE,
  OFFRE_SECTIONS_CAPITALES,
  EMPLOYEURS,
};
