// src/pages/_competences-familles.js — Familles de compétences, source unique.
//
// Deux surfaces affichent les compétences : la fiche (`api/offre.js`, reprise
// par le Worker) et le board (`job-board.html`). Le board est une page statique
// dont le JS est en ligne : il ne peut pas importer ce module. La table y est
// donc recopiée par scripts/aligner-familles.py, qui vérifie aussi que les deux
// copies restent identiques.
//
// Sans cette source unique, une famille ajoutée d'un côté disparaîtrait de
// l'autre en silence — exactement ce qui s'est produit quand la table vivait
// en deux exemplaires indépendants.

export const SKILLS_FAMILIES = {
  outils: 'Outils',
  data: 'Données et BI',
  methodes: 'Méthodes et IA',
  actuariat: 'Logiciels actuariels',
  reglementation: 'Réglementation',
};
