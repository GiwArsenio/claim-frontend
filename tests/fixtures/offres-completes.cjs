/* ─────────────────────────────────────────────────────────────────────────────
   OFFRES COMPLÈTES POUR LES CARTES (T10)

   Le serveur de fixtures répond avec `city` alors que le front lit `ville`, et
   la plupart des offres n'ont ni spécialité curée, ni expérience, ni salaire,
   ni compétences. Une carte réaliste en porte six ou sept : lieu, contrat,
   expérience, salaire, spécialité, compétences.

   Une carte sur deux a des éléments manquants (sans salaire, sans compétences,
   sans spécialité, sans lieu…) : la mise en page doit les tenir (T10).

   Plutôt que de changer tests/fixtures/offres.cjs (que d'autres tests lisent),
   on complète les réponses de l'API au vol, dans le navigateur : `completer()`
   ajoute les champs que le front sait lire, sans toucher aux autres.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const LIEUX = ['FR, Paris', 'FR, Lyon', 'MA, Casablanca', 'FR, Nanterre', 'GB, Londres'];
const SPECIALITES = ['actuariat', 'ia_data', 'souscription_technique'];
const EXPERIENCES = ['junior', 'confirmed', 'senior', 'lead'];
const SALAIRES = ['45–55 k€/an', '≥ 60 k€/an', '38–42 k€/an'];

/* Compétences : toutes les familles que lisent le board et l'accueil. Les
   listes sont de longueurs différentes pour exercer les règles de la ligne des étiquettes (4 au plus, « +N » compris) sur le board ET sur l'accueil, qui ne lit que deux familles : 1re offre 8 / 6 étiquettes (board / accueil) ; 2e 10 / 9 ; 3e 5 / 5 ; 4e 9 / 6. */
const COMPETENCES = [
  { outils: ['Python', 'SQL', 'Excel'], data: ['Tableau / BI', 'Power BI'], reglementation: ['Solvabilité II', 'IFRS 17'] },
  { outils: ['R', 'SAS', 'Excel', 'VBA', 'Access', 'Qlik', 'Prophet'], data: ['Power BI'], reglementation: ['IFRS 17'] },
  { outils: ['Python', 'SQL', 'Excel', 'VBA'], data: [], reglementation: [] },
  { outils: ['Python', 'SQL', 'VBA', 'Excel'], data: ['Tableau / BI'], actuariat: ['Prophet', 'Igloo'], reglementation: ['Solvabilité II'] },
];

/* Éléments manquants : l'indice de l'offre modulo 8 retire une partie des
   étiquettes. Les cartes 0 à 2 restent complètes (6 à 7 éléments). */
const MANQUES = {
  3: ['salaire'],
  4: ['competences', 'lieu'],
  5: ['specialite'],
  6: ['experience', 'salaire', 'competences-sauf-une'],
  7: ['lieu', 'competences-exactement-deux'],
};

/** Renvoie une copie de l'offre avec tous les champs d'affichage des cartes. */
function completer(offre, i, options = {}) {
  const manque = MANQUES[i % 8] || [];
  let skills = COMPETENCES[i % COMPETENCES.length];
  if (manque.includes('competences')) skills = {};
  if (manque.includes('competences-sauf-une')) skills = { outils: ['Python'] };
  if (manque.includes('competences-exactement-deux')) skills = { outils: ['Python', 'SQL'] };
  // Cas hostile : la première compétence de la première offre est du HTML.
  if (options.hostile && i === 0) skills = { ...skills, outils: ['<img data-injecte>', ...skills.outils.slice(1)] };
  // Cas des noms longs : la 1re offre porte des compétences qui ne tiennent pas côte à côte sur un téléphone.
  if (options.longues && i === 0) skills = { outils: ['Solvabilité II (modèle interne)', 'Calibrage actuariel avancé', 'Python'] };
  return {
    ...offre,
    experience_level: manque.includes('experience') ? '' : offre.experience_level,
    ville: manque.includes('lieu') ? '' : LIEUX[i % LIEUX.length],
    contract_type: offre.contract_type || ['cdi', 'cdd', 'stage', 'alternance'][i % 4],
    jev_curation_status: 'done',
    jev_publishable: {
      specialty: !manque.includes('specialite'),
      experience: !manque.includes('experience'),
      salaire: !manque.includes('salaire'),
    },
    jev_specialty: SPECIALITES[i % SPECIALITES.length],
    jev_experience: EXPERIENCES[i % EXPERIENCES.length],
    jev_salaire_libelle: SALAIRES[i % SALAIRES.length],
    skills,
  };
}

/** Complète toute réponse de liste ou de sélection renvoyée par l'API. */
async function installerOffresCompletes(page, options = {}) {
  await page.route(/\/api\/v1\/jobs(\/selection|\/search)?(\?|$)/, async (route) => {
    const reponse = await route.fetch();
    let corps;
    try { corps = await reponse.json(); } catch (e) { return route.fulfill({ response: reponse }); }
    if (Array.isArray(corps.data)) corps.data = corps.data.map((o, i) => completer(o, i, options));
    return route.fulfill({ response: reponse, json: corps });
  });
}

module.exports = { completer, installerOffresCompletes, COMPETENCES };
