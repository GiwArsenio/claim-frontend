// tests/parcours/helpers/donnees.cjs
//
// Les 8 offres de référence des parcours navigateur.
//
// Pourquoi des identifiants numériques courts (101 à 108) : ils rendent
// l'ordre de rendu lisible dans les traces et permettent de déclencher
// volontairement une réponse tardive (voir P04). Rien d'autre n'est
// aléatoire : un parcours qui varie d'une exécution à l'autre ne prouve rien.
//
// Le contrat doit correspondre à celui que consomme job-board.html :
//   id, slug, title, ville, city, source, contract_type,
//   jev_specialty, jev_experience, jev_salaire_*,
//   source_published_at, source_url, description_raw, companies.

const COMMUN = {
  contract_type: 'cdi',
  jev_specialty: 'actuariat',
  jev_experience: 'confirmed',
  jev_salaire_bas: 55000,
  jev_salaire_haut: 70000,
  jev_salaire_libelle: '55–70 k€/an',
  jev_salaire_periodicite: 'annuel',
  source_published_at: '2026-10-15T09:00:00Z',
    // Une description longue : la fiche doit depasser la hauteur du panneau,
  // sinon il n y a rien a faire defiler et les tests de lecture n auraient
  // aucun sens.
  description_raw:
    "Rejoignez une equipe d actuaires pour modeliser des risques. "
    + "Le poste couvre la modelisation, la revue et la restitution aux metiers. "
    + "Vous pilotez des travaux de provisionnement et participez aux comites. "
    + "Vous accompagnez les equipes metier dans leurs prises de decision. "
    + "Ce poste s inscrit dans une organisation qui industrialise ses methodes "
    + "de calcul et le dialogue avec les directions Affiliatees. "
    + "Vos activites couvrent la redaction des hypotheses, la revue des modeles "
    + "et la documentation des travaux pour l audit. "
    + "Un poste pour quelqu un qui aime les chiffres et la clarte.",
};

function offre(id, rappel) {
  const suffixe = String(id);
  return Object.assign(
    {
      id,
      slug: 'actuaire-' + suffixe + '-parcours',
      title: 'Actuaire confirme ' + suffixe,
      ville: 'Paris',
      city: 'Paris',
      source: 'axa',
      source_url: 'https://exemple.test/offre/' + suffixe,
      companies: {
        name: 'AXA',
        slug: 'axa',
        logo_url: null,
        website_url: 'https://exemple.test/axa',
      },
      sections: [
        {
          titre: 'Le poste',
          paragraphes: [
            "Vous rejoignez une equipe d actuaires qui modelise des risques pour "
            + "un assureur de taille moyenne, et vous prenez en charge un "
            + "perimetre de provisions.",
            "Le poste couvre la modelisation, la revue des hypotheses et la "
            + "restitution aux metier comme a la direction financiere.",
          ],
        },
        {
          titre: 'Le profil',
          paragraphes: [
            "Vous avez cinq ans d experience en actuariat et vous maitrisez "
            + "les tables de mortalite et les methodes de provisions.",
            "Une pratique de Python et d un outil de modelisation est "
            + "souhaitee, sans etre un filtre.",
            "Vous savez restituer une etude a un comite sans vous perdre dans "
            + "les details techniques, et vous savez dire ce qui ne tient pas.",
            "Le poste est ouvert a une personne qui a envie de travailler sur "
            + "des donnees utiles et de rendre le risque lisible.",
          ],
        },
        {
          titre: 'Vos missions',
          paragraphes: [
            "Vous pilotez des travaux de provisionnement et participez aux "
            + "comites de calculation mensuels.",
            "Vous accompagnez les equipes metier dans leurs prises de decision "
            + "et vous documentez les travaux pour l audit.",
            "Vous contribuez a l industrialisation des methodes de calcul et "
            + "au dialogue avec les directions Affiliatees.",
          ],
        },
      ],
    },
    COMMUN,
    rappel || {}
  );
}

const OFFRES = [
  offre(101),
  offre(102, {
    title: 'Actuaire confirme 102',
    slug: 'actuaire-102-parcours',
    ville: 'Lyon',
    city: 'Lyon',
    source: 'swisslife',
    jev_experience: 'senior',
    source_published_at: '2026-10-16T09:00:00Z',
  }),
  offre(103, {
    title: 'Actuaire confirme 103',
    slug: 'actuaire-103-parcours',
    ville: 'Marseille',
    city: 'Marseille',
    source: 'axa',
    jev_experience: 'junior',
    source_published_at: '2026-10-17T09:00:00Z',
  }),
  offre(104, {
    title: 'Actuaire confirme 104',
    slug: 'actuaire-104-parcours',
    ville: 'Paris',
    city: 'Paris',
    source: 'generali',
    contract_type: 'cdd',
    jev_experience: 'confirmed',
    source_published_at: '2026-10-18T09:00:00Z',
  }),
  offre(105, {
    title: 'Actuaire confirme 105',
    slug: 'actuaire-105-parcours',
    ville: 'Bordeaux',
    city: 'Bordeaux',
    source: 'axa',
    contract_type: 'freelance',
    jev_experience: 'lead',
    source_published_at: '2026-10-19T09:00:00Z',
  }),
  offre(106, {
    title: 'Actuaire confirme 106',
    slug: 'actuaire-106-parcours',
    ville: 'Lille',
    city: 'Lille',
    source: 'swisslife',
    contract_type: 'cdi',
    jev_experience: 'senior',
    source_published_at: '2026-10-20T09:00:00Z',
  }),
  offre(107, {
    title: 'Actuaire confirme 107',
    slug: 'actuaire-107-parcours',
    ville: 'Paris',
    city: 'Paris',
    source: 'axa',
    contract_type: 'cdi',
    jev_experience: 'confirmed',
    source_published_at: '2026-10-21T09:00:00Z',
  }),
  offre(108, {
    title: 'Actuaire confirme 108',
    slug: 'actuaire-108-parcours',
    ville: 'Toulouse',
    city: 'Toulouse',
    source: 'generali',
    contract_type: 'cdd',
    jev_experience: 'junior',
    source_published_at: '2026-10-22T09:00:00Z',
  }),
];

module.exports = { OFFRES, offre, COMMUN };
