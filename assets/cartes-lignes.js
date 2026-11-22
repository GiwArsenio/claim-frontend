/* ─────────────────────────────────────────────────────────────────────────────
   CARTES D'OFFRE — LA RÈGLE DES LIGNES

   Une carte a deux blocs : les faits (lieu, contrat, expérience, salaire) et les
   étiquettes (spécialité, compétences). Dans chaque bloc :

     • 3 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un seul) ;
     • les faits (4 au plus) tiennent sur 2 lignes au plus ;
     • les étiquettes tiennent sur 2 lignes au plus tant qu'il y en a 6 ou moins ;
     • au-delà, la pastille « +N » ne cache JAMAIS plus de 2 éléments : le reste
       est affiché, et le bloc prend alors une ligne de plus (3 lignes ou plus).
       « +2 » n'est utilisé que s'il fait gagner une ligne ; sinon tout s'affiche.

   Répartition (nombre de places → éléments par ligne) : 1→1, 2→2, 3→3, 4→2+2,
   5→3+2, 6→3+3, 7→3+2+2, 8→3+3+2, 9→3+3+3, 10→3+3+2+2… (des lignes de 3, la
   dernière ou les deux dernières complétées pour ne jamais en laisser une seule).

   Éléments → affichage : 1 à 6 → tous ; 7 → 5 + « +2 » ; 8 ou 9 → tous ;
   10 → 8 + « +2 » ; 11 ou 12 → tous ; 13 → 11 + « +2 »…

   La règle est ici, une seule fois : l'accueil et le board l'appellent tous deux,
   pour que leurs cartes ne divergent pas.
   ───────────────────────────────────────────────────────────────────────────── */
(function (racine) {
  'use strict';

  var MAX_PAR_LIGNE = 3;
  var MIN_PAR_LIGNE = 2;
  var MAX_CACHES = 2;
  var SEUIL_PLUS = 6; // jusqu'à 6 éléments (2 lignes pleines), on affiche tout

  function nbLignes(places) { return Math.ceil(places / MAX_PAR_LIGNE); }

  /** Éléments par ligne pour `n` places : des lignes de 3, sans jamais en laisser une seule. */
  function tailles(n) {
    if (n <= 0) return [];
    if (n <= MAX_PAR_LIGNE) return [n];
    var k = nbLignes(n);
    var reste = n % MAX_PAR_LIGNE;
    var lignes = [];
    var pleines = reste === 0 ? k : (reste === 1 ? k - 2 : k - 1);
    for (var i = 0; i < pleines; i++) lignes.push(MAX_PAR_LIGNE);
    if (reste === 2) lignes.push(2);
    if (reste === 1) lignes.push(2, 2);
    return lignes;
  }

  /**
   * Combien d'éléments passent dans « +N » (0, 1 ou 2, jamais plus) : seulement
   * ce qui fait gagner une ligne. La pastille « +N » occupe elle-même une place.
   */
  function caches(n) {
    if (n <= SEUIL_PLUS) return 0;
    var meilleur = 0;
    var lignes = nbLignes(n);
    for (var h = 1; h <= MAX_CACHES; h++) {
      if (nbLignes(n - h + 1) < lignes) { meilleur = h; lignes = nbLignes(n - h + 1); }
    }
    return meilleur;
  }

  /**
   * Répartit des éléments en lignes.
   *   elements : [{ html, libelle }] — `libelle` est le texte qu'un « +N » listera.
   *   plus     : function (caches) → html de la pastille « +N » (reçoit les éléments cachés).
   * Rend un tableau de lignes ; chaque ligne est un tableau de chaînes HTML.
   */
  function repartir(elements, plus) {
    var n = elements.length;
    var h = caches(n);
    var affiches = elements.map(function (e) { return e.html; });
    if (h > 0) {
      affiches = affiches.slice(0, n - h);
      affiches.push(plus(elements.slice(n - h)));
    }
    var lignes = [];
    var debut = 0;
    tailles(affiches.length).forEach(function (t) {
      lignes.push(affiches.slice(debut, debut + t));
      debut += t;
    });
    return lignes;
  }

  /** Les lignes en HTML : un <div class="…"> par ligne. */
  function html(lignes, classe) {
    return lignes.map(function (l) {
      return '<div class="' + classe + '">' + l.join('') + '</div>';
    }).join('');
  }

  var api = {
    MAX_PAR_LIGNE: MAX_PAR_LIGNE, MIN_PAR_LIGNE: MIN_PAR_LIGNE, MAX_CACHES: MAX_CACHES,
    tailles: tailles, caches: caches, repartir: repartir, html: html,
  };
  racine.CARTES_LIGNES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
