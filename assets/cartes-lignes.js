/* ─────────────────────────────────────────────────────────────────────────────
   CARTES D'OFFRE — LA RÈGLE DES LIGNES

   Une carte a deux blocs, chacun avec sa règle.

   LES FAITS (lieu, contrat, expérience, salaire : 4 au plus)
     • 4 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un) ;
     • 2 lignes au plus (donc 4 faits = 1 ligne de 4, ou 2 + 2 si 4 coupent un texte) ;
     • « 4 au plus » est un plafond : après dessin, le bloc est mesuré ; si une ligne
       coupe un texte (« Casablanca (M… »), il est refait avec 3 puis 2 éléments par
       ligne (voir `ajuster`).

   LES ÉTIQUETTES (spécialité, puis compétences)
     • UNE seule ligne, 4 éléments au plus ;
     • tout le reste tient dans une pastille « +N », qui compte comme un élément :
       1 à 4 étiquettes → toutes ; 5 ou plus → les 3 premières + « +N » (N = total − 3) ;
     • si les étiquettes coupent un texte (noms longs, écran étroit), on en montre
       moins (2, puis 1) et « +N » grandit d'autant : jamais de deuxième ligne.
     • « +N » a un titre qui liste les compétences cachées : rien n'est perdu en silence.

   Les mesures sont refaites à chaque changement de largeur et à l'arrivée des
   polices. Si même un seul élément coupe un texte, il reste coupé par « … » (son
   titre le dit en entier).

   La règle est ici, une seule fois : l'accueil et le board l'appellent tous deux,
   pour que leurs cartes ne divergent pas.
   ───────────────────────────────────────────────────────────────────────────── */
(function (racine) {
  'use strict';

  var MAX_PAR_LIGNE = 4;   // faits : 4 au plus par ligne
  var MIN_PAR_LIGNE = 2;   // faits : 2 au moins par ligne
  var MAX_ETIQUETTES = 4;  // étiquettes : 4 au plus sur leur unique ligne, « +N » compris

  function echapper(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Un découpage en lignes de `max` au plus est valable si aucune ligne n'a moins de 2 éléments. */
  function valable(n, max) {
    var k = Math.ceil(n / max);
    return n < MIN_PAR_LIGNE || Math.floor(n / k) >= MIN_PAR_LIGNE;
  }

  /**
   * Éléments par ligne pour `n` éléments, `max` par ligne au plus : le moins de
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

  /** Les faits en lignes : elements = [{ html }] ; rend un tableau de lignes (tableaux de chaînes HTML). */
  function repartir(elements) {
    var htmls = elements.map(function (e) { return e.html; });
    var lignes = [];
    var debut = 0;
    tailles(htmls.length).forEach(function (t) {
      lignes.push(htmls.slice(debut, debut + t));
      debut += t;
    });
    return lignes;
  }

  /** Combien d'étiquettes sont montrées au départ : toutes jusqu'à 4 ; sinon 3 + « +N ». */
  function visibles(n) {
    return n <= MAX_ETIQUETTES ? n : MAX_ETIQUETTES - 1;
  }

  /** La pastille « +N » : son titre liste les libellés cachés. */
  function pastillePlus(libelles) {
    var titre = echapper('Autres compétences : ' + libelles.join(', '));
    return '<span class="etq etq--comp etq--plus" title="' + titre + '" aria-label="' + titre + '">+' + libelles.length + '</span>';
  }

  /**
   * Le bloc des étiquettes : UNE ligne. elements = [{ html, libelle }] ; `html` commence par « <span ».
   * Les étiquettes au-delà de `visibles(n)` sont dans la page mais cachées (`hidden`), pour que la
   * mesure puisse en montrer davantage ou moins selon la largeur ; « +N » dit combien sont cachées.
   */
  function etiquettesHtml(elements) {
    var n = elements.length;
    if (!n) return '';
    var k = visibles(n);
    var corps = elements.map(function (e, i) {
      return i < k ? e.html : e.html.replace(/^<span /, '<span hidden ');
    }).join('');
    var reste = elements.slice(k).map(function (e) { return e.libelle; });
    return '<div class="ctags"><div class="ctags-l">' + corps + (reste.length ? pastillePlus(reste) : '') + '</div></div>';
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

  /** Refait le bloc des faits (.cm) : 4 par ligne au plus, puis 3, puis 2 tant qu'une ligne coupe un texte. */
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

  /**
   * Refait le bloc des étiquettes (.ctags) : une seule ligne ; on montre 4 étiquettes
   * (3 + « +N » s'il y en a plus), puis moins tant qu'un texte est coupé.
   */
  function ajusterEtiquettes(bloc) {
    var ligne = bloc.querySelector('.ctags-l');
    if (!ligne) return;
    var ancien = ligne.querySelector('.etq--plus');
    if (ancien) ligne.removeChild(ancien);
    var etiquettes = Array.prototype.slice.call(ligne.children);
    var n = etiquettes.length;
    if (!n) return;
    var libelles = etiquettes.map(function (e) { return e.textContent.trim(); });
    var doc = bloc.ownerDocument;
    function appliquer(k) {
      var plus = ligne.querySelector('.etq--plus');
      if (plus) ligne.removeChild(plus);
      etiquettes.forEach(function (e, i) { e.hidden = i >= k; });
      if (k < n) {
        var tmp = doc.createElement('div');
        tmp.innerHTML = pastillePlus(libelles.slice(k));
        ligne.appendChild(tmp.firstChild);
      }
    }
    var k = visibles(n);
    for (;;) {
      appliquer(k);
      var coupees = Array.prototype.some.call(ligne.children, function (e) { return !e.hidden && coupe(e); });
      if (!coupees || k <= 1) break;
      k--;
    }
  }

  /** Ajuste toutes les cartes sous `racine` (le document par défaut). */
  function ajuster(racine) {
    var r = racine || document;
    Array.prototype.forEach.call(r.querySelectorAll('.cm'), function (b) { ajusterBloc(b, 'cm-l'); });
    Array.prototype.forEach.call(r.querySelectorAll('.ctags'), function (b) { ajusterEtiquettes(b); });
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
    MAX_PAR_LIGNE: MAX_PAR_LIGNE, MIN_PAR_LIGNE: MIN_PAR_LIGNE, MAX_ETIQUETTES: MAX_ETIQUETTES,
    tailles: tailles, valable: valable, repartir: repartir, html: html,
    visibles: visibles, pastillePlus: pastillePlus, etiquettesHtml: etiquettesHtml,
    ajuster: ajuster, ajusterBloc: ajusterBloc, ajusterEtiquettes: ajusterEtiquettes, installer: installer,
  };
  racine.CARTES_LIGNES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
