/* ─────────────────────────────────────────────────────────────────────────────
   CARTES D'OFFRE — LA RÈGLE DES LIGNES

   Une carte a deux blocs : les faits (lieu, contrat, expérience, salaire) et les
   étiquettes (spécialité, compétences). Dans chaque bloc :

     • 4 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un seul) ;
     • les lignes sont équilibrées : on ne laisse jamais une ligne presque vide ;
     • les étiquettes tiennent sur 2 lignes au plus tant qu'il y en a 8 ou moins ;
     • au-delà, la pastille « +N » ne cache JAMAIS plus de 2 éléments : le reste
       est affiché, et le bloc prend alors une ligne de plus (3 lignes ou plus).
       « +2 » n'est utilisé que s'il fait gagner une ligne ; sinon tout s'affiche.

   Répartition (nombre de places → éléments par ligne) : 1→1, 2→2, 3→3, 4→4,
   5→3+2, 6→3+3, 7→4+3, 8→4+4, 9→3+3+3, 10→4+3+3, 11→4+4+3, 12→4+4+4, 13→4+3+3+3…

   Éléments → affichage : 1 à 8 → tous ; 9 → 7 + « +2 » ; 10 à 12 → tous ;
   13 → 11 + « +2 » ; 14 à 16 → tous ; 17 → 15 + « +2 »…

   « 4 au plus » est un plafond, pas un objectif : une fois la carte dessinée, chaque
   bloc est mesuré. Si une ligne coupe un texte (« Casablanca (M… »), le bloc est
   refait avec 3 puis 2 éléments au plus par ligne, jusqu'à ce que rien ne soit
   coupé (voir `ajuster`). Il est refait à chaque changement de largeur et quand
   les polices arrivent. Si même 2 par ligne coupent un texte, il reste coupé par
   « … » (son titre le dit en entier).

   La règle est ici, une seule fois : l'accueil et le board l'appellent tous deux,
   pour que leurs cartes ne divergent pas.
   ───────────────────────────────────────────────────────────────────────────── */
(function (racine) {
  'use strict';

  var MAX_PAR_LIGNE = 4;
  var MIN_PAR_LIGNE = 2;
  var MAX_CACHES = 2;
  var SEUIL_PLUS = 2 * MAX_PAR_LIGNE; // jusqu'à 8 éléments (2 lignes pleines), on affiche tout

  function nbLignes(places) { return Math.ceil(places / MAX_PAR_LIGNE); }

  /** Un découpage en lignes de `max` au plus est valable si aucune ligne n'a moins de 2 éléments. */
  function valable(n, max) {
    var k = Math.ceil(n / max);
    return n < MIN_PAR_LIGNE || Math.floor(n / k) >= MIN_PAR_LIGNE;
  }

  /**
   * Éléments par ligne pour `n` places, `max` par ligne au plus : le moins de
   * lignes possible, réparties à parts égales (les plus pleines en premier).
   */
  function tailles(n, max) {
    if (n <= 0) return [];
    max = max || MAX_PAR_LIGNE;
    var k = Math.ceil(n / max);
    var base = Math.floor(n / k);
    var plus = n % k;
    var lignes = [];
    for (var i = 0; i < k; i++) lignes.push(i < plus ? base + 1 : base);
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

  /* ── Ajustement à la largeur (navigateur seulement) ─────────────────────── */

  function coupe(el) {
    var v = el.querySelector ? (el.querySelector('.card-fact-value') || el) : el;
    return v.scrollWidth > v.clientWidth + 0.5;
  }

  function poser(bloc, elements, lignes, classe) {
    var doc = bloc.ownerDocument;
    while (bloc.firstChild) bloc.removeChild(bloc.firstChild);
    var debut = 0;
    lignes.forEach(function (t) {
      var l = doc.createElement('div');
      l.className = classe;
      elements.slice(debut, debut + t).forEach(function (e) { l.appendChild(e); });
      debut += t;
      bloc.appendChild(l);
    });
  }

  /**
   * Refait un bloc (.cm ou .ctags) : 4 éléments par ligne au plus, puis 3, puis 2
   * tant qu'une ligne coupe un texte. `classe` est celle des lignes (cm-l, ctags-l).
   */
  function ajusterBloc(bloc, classe) {
    var elements = [];
    Array.prototype.forEach.call(bloc.querySelectorAll('.' + classe), function (l) {
      Array.prototype.forEach.call(l.children, function (e) { elements.push(e); });
    });
    var n = elements.length;
    if (n < 2) return;
    var dernier = null;
    for (var m = MAX_PAR_LIGNE; m >= MIN_PAR_LIGNE; m--) {
      if (!valable(n, m)) continue;
      var t = tailles(n, m);
      if (dernier && String(t) === String(dernier)) continue;
      dernier = t;
      poser(bloc, elements, t, classe);
      if (!elements.some(coupe)) return;
    }
  }

  /** Ajuste toutes les cartes sous `racine` (le document par défaut). */
  function ajuster(racine) {
    var r = racine || document;
    Array.prototype.forEach.call(r.querySelectorAll('.cm'), function (b) { ajusterBloc(b, 'cm-l'); });
    Array.prototype.forEach.call(r.querySelectorAll('.ctags'), function (b) { ajusterBloc(b, 'ctags-l'); });
  }

  /** À appeler une fois : refait l'ajustement quand la largeur change et quand les polices arrivent. */
  var installe = false;
  function installer() {
    if (installe || typeof window === 'undefined') return;
    installe = true;
    var minuteur = null;
    var plusTard = function () {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () { ajuster(); }, 120);
    };
    window.addEventListener('resize', plusTard);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ajuster(); });
  }

  var api = {
    MAX_PAR_LIGNE: MAX_PAR_LIGNE, MIN_PAR_LIGNE: MIN_PAR_LIGNE, MAX_CACHES: MAX_CACHES,
    tailles: tailles, valable: valable, caches: caches, repartir: repartir, html: html,
    ajuster: ajuster, ajusterBloc: ajusterBloc, installer: installer,
  };
  racine.CARTES_LIGNES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
