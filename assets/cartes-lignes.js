/* ─────────────────────────────────────────────────────────────────────────────
   CARTES D'OFFRE — LA RÈGLE DES LIGNES

   Une carte a deux blocs : les faits (lieu, contrat, expérience, salaire) et les
   étiquettes (spécialité, compétences). Dans chaque bloc :

     • 3 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un seul) ;
     • 2 lignes au plus par bloc, donc 4 lignes au plus par carte ;
     • ce qui ne tient pas dans ces 2 lignes devient une pastille « +N », qui
       prend la dernière place (6e) et dont le titre liste ce qu'elle remplace.

   Répartition (nombre d'éléments → éléments par ligne) :
     1 → 1        2 → 2        3 → 3        4 → 2 + 2        5 → 3 + 2        6 → 3 + 3
     7 ou plus → les 5 premiers, puis « +N » (N = total − 5) : 3 + 3

   La règle est ici, une seule fois : l'accueil et le board l'appellent tous deux,
   pour que leurs cartes ne divergent pas.
   ───────────────────────────────────────────────────────────────────────────── */
(function (racine) {
  'use strict';

  var MAX_PAR_LIGNE = 3;
  var MIN_PAR_LIGNE = 2;
  var MAX_LIGNES = 2;
  var PLACES = MAX_PAR_LIGNE * MAX_LIGNES;

  /** Éléments par ligne pour `n` éléments affichés (n ≤ PLACES). */
  function tailles(n) {
    if (n <= 0) return [];
    if (n <= MAX_PAR_LIGNE) return [n];
    // 4 → 2 + 2 ; 5 → 3 + 2 ; 6 → 3 + 3 : la première ligne prend le plus, sans
    // jamais laisser moins de MIN_PAR_LIGNE à la seconde.
    var premiere = Math.min(MAX_PAR_LIGNE, n - MIN_PAR_LIGNE);
    return [premiere, n - premiere];
  }

  /**
   * Répartit des éléments en lignes.
   *   elements : [{ html, libelle }] — `libelle` est le texte qu'un « +N » listera.
   *   plus     : function (caches) → html de la pastille « +N » (reçoit les éléments cachés).
   * Rend un tableau de lignes ; chaque ligne est un tableau de chaînes HTML.
   */
  function repartir(elements, plus) {
    var n = elements.length;
    var affiches = elements.map(function (e) { return e.html; });
    if (n > PLACES) {
      affiches = affiches.slice(0, PLACES - 1);
      affiches.push(plus(elements.slice(PLACES - 1)));
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
    MAX_PAR_LIGNE: MAX_PAR_LIGNE, MIN_PAR_LIGNE: MIN_PAR_LIGNE, MAX_LIGNES: MAX_LIGNES, PLACES: PLACES,
    tailles: tailles, repartir: repartir, html: html,
  };
  racine.CARTES_LIGNES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
