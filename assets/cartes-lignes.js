/* ─────────────────────────────────────────────────────────────────────────────
   CARTES D'OFFRE — LA RÈGLE DES LIGNES

   Une carte a deux blocs : les FAITS (lieu, contrat, expérience, salaire : 4 au
   plus) et les ÉTIQUETTES (spécialité, puis compétences). Règle commune :

     • 4 éléments au plus par ligne, 2 au moins (sauf s'il n'y en a qu'un) ;
     • 2 lignes au plus par bloc, et 3 lignes au plus pour la carte entière ;
     • la PRIORITÉ va aux faits : s'ils ont besoin de 2 lignes, les étiquettes n'en
       ont qu'une ; s'ils tiennent sur une, les étiquettes peuvent en avoir deux ;
     • tout ce qui ne tient pas dans les lignes permises des étiquettes est dans une
       pastille « +N », sans plafond sur N. « +N » compte comme un élément (le
       dernier) : avec 2 lignes, 8 étiquettes tiennent, 9 donnent 7 + « +N ».
       Avec 1 ligne : 4 étiquettes tiennent, 5 donnent 3 + « +N ».
     • « +N » a un titre qui liste les compétences cachées : rien n'est perdu en silence.

   « 4 par ligne » est un plafond. Après dessin, la carte est mesurée : si une ligne
   coupe un texte (« Casablanca (M… »), on essaie 3 puis 2 par ligne (les faits
   peuvent ainsi passer de 1 à 2 lignes, et les étiquettes perdre une ligne) ; si cela
   ne suffit pas, les étiquettes en montrent moins et « +N » grandit. La mesure est
   refaite à chaque changement de largeur et à l'arrivée des polices. Si même un
   seul élément coupe un texte, il reste coupé par « … » (son titre le dit en entier).

   La règle est ici, une seule fois : l'accueil et le board l'appellent tous deux,
   pour que leurs cartes ne divergent pas.
   ───────────────────────────────────────────────────────────────────────────── */
(function (racine) {
  'use strict';

  var MAX_PAR_LIGNE = 4;    // 4 éléments au plus par ligne
  var MIN_PAR_LIGNE = 2;    // 2 au moins (sauf un élément seul)
  var MAX_LIGNES_BLOC = 2;  // 2 lignes au plus par bloc
  var MAX_LIGNES_CARTE = 3; // 3 lignes au plus pour la carte

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

  /** Lignes permises aux étiquettes quand les faits en occupent `lignesFaits` : la priorité va aux faits. */
  function lignesEtiquettes(lignesFaits) {
    return Math.max(1, Math.min(MAX_LIGNES_BLOC, MAX_LIGNES_CARTE - lignesFaits));
  }

  /** Combien d'étiquettes sur `n` sont montrées avec `lignes` lignes : toutes si elles tiennent, sinon une place de moins pour « +N ». */
  function visibles(n, lignes) {
    var places = MAX_PAR_LIGNE * (lignes || MAX_LIGNES_BLOC);
    return n <= places ? n : places - 1;
  }

  /** La pastille « +N » : son titre liste les libellés cachés. */
  function pastillePlus(libelles) {
    var titre = echapper('Autres compétences : ' + libelles.join(', '));
    return '<span class="etq etq--comp etq--plus" title="' + titre + '" aria-label="' + titre + '">+' + libelles.length + '</span>';
  }

  /**
   * Le bloc des étiquettes, avant mesure (on suppose que les faits tiennent sur une ligne : 2 lignes
   * permises). elements = [{ html, libelle }] ; `html` commence par « <span ». Les étiquettes en trop
   * sont dans la page mais cachées (`hidden`), pour que la mesure puisse en montrer plus ou moins ;
   * « +N » dit combien sont cachées.
   */
  function etiquettesHtml(elements) {
    var n = elements.length;
    if (!n) return '';
    var k = visibles(n, MAX_LIGNES_BLOC);
    var cachees = elements.slice(k);
    var montrees = elements.slice(0, k).map(function (e) { return e.html; });
    if (cachees.length) montrees.push(pastillePlus(cachees.map(function (e) { return e.libelle; })));
    var masquees = cachees.map(function (e) { return e.html.replace(/^<span /, '<span hidden '); }).join('');
    var lignes = [];
    var debut = 0;
    var t = tailles(montrees.length);
    t.forEach(function (taille, i) {
      var items = montrees.slice(debut, debut + taille);
      debut += taille;
      // Les cachées gardent leur ordre : juste avant « +N », qui ferme la dernière ligne.
      if (i === t.length - 1 && cachees.length) items.splice(items.length - 1, 0, masquees);
      lignes.push('<div class="ctags-l">' + items.join('') + '</div>');
    });
    return '<div class="ctags">' + lignes.join('') + '</div>';
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
   * Refait le bloc des faits (.cm) : 4 par ligne au plus, puis 3, puis 2 tant qu'une ligne coupe un
   * texte. Rend le nombre de lignes obtenu.
   */
  function ajusterBloc(bloc, classe) {
    var elements = [];
    Array.prototype.forEach.call(bloc.querySelectorAll('.' + classe), function (l) {
      Array.prototype.forEach.call(l.children, function (e) { elements.push(e); });
    });
    var n = elements.length;
    if (n < 2) return n ? 1 : 0;
    var dernier = null;
    var lignes = 1;
    for (var m = MAX_PAR_LIGNE; m >= MIN_PAR_LIGNE; m--) {
      if (!valable(n, m)) continue;
      var t = tailles(n, m);
      if (dernier && String(t) === String(dernier)) continue;
      dernier = t;
      lignes = t.length;
      poser(bloc, elements, t, classe);
      if (!elements.some(coupe)) return lignes;
    }
    return lignes;
  }

  /** Pose les étiquettes : `k` montrées, réparties en `tailles` lignes, « +N » (s'il y en a) en dernier, les autres cachées. */
  function poserEtiquettes(bloc, etiquettes, libelles, k, t) {
    var doc = bloc.ownerDocument;
    while (bloc.firstChild) bloc.removeChild(bloc.firstChild);
    var n = etiquettes.length;
    var plus = null;
    if (k < n) {
      var tmp = doc.createElement('div');
      tmp.innerHTML = pastillePlus(libelles.slice(k));
      plus = tmp.firstChild;
    }
    var suite = etiquettes.slice(0, k).concat(plus ? [plus] : []);
    var debut = 0;
    t.forEach(function (taille, i) {
      var l = doc.createElement('div');
      l.className = 'ctags-l';
      suite.slice(debut, debut + taille).forEach(function (e) { l.appendChild(e); });
      debut += taille;
      if (i === t.length - 1) {
        // Les cachées (dans l'ordre), avant « +N ».
        etiquettes.slice(k).forEach(function (e) { l.insertBefore(e, plus); });
      }
      bloc.appendChild(l);
    });
    etiquettes.forEach(function (e, i) { e.hidden = i >= k; });
  }

  /**
   * Refait le bloc des étiquettes (.ctags) avec `lignes` lignes au plus : on montre le plus d'étiquettes
   * possible (toutes si elles tiennent, sinon une place de moins pour « +N »), sur 4, puis 3, puis 2 par
   * ligne ; si un texte est coupé, on en montre une de moins, et ainsi de suite.
   */
  function ajusterEtiquettes(bloc, lignes) {
    lignes = lignes || MAX_LIGNES_BLOC;
    var rangees = Array.prototype.slice.call(bloc.querySelectorAll('.ctags-l'));
    if (!rangees.length) return;
    var etiquettes = [];
    rangees.forEach(function (l) {
      Array.prototype.forEach.call(l.children, function (e) {
        if (!e.classList.contains('etq--plus')) etiquettes.push(e);
      });
    });
    var n = etiquettes.length;
    if (!n) return;
    var libelles = etiquettes.map(function (e) { return e.textContent.trim(); });
    for (var k = visibles(n, lignes); k >= 1; k--) {
      var places = k + (k < n ? 1 : 0);
      for (var m = MAX_PAR_LIGNE; m >= MIN_PAR_LIGNE; m--) {
        if (!valable(places, m)) continue;
        var t = tailles(places, m);
        if (t.length > lignes) continue;
        poserEtiquettes(bloc, etiquettes, libelles, k, t);
        if (!Array.prototype.some.call(bloc.querySelectorAll('.etq:not([hidden])'), coupe)) return;
      }
    }
  }

  /**
   * Ajuste toutes les cartes sous `racine` (le document par défaut) : d'abord les faits (priorité), puis
   * les étiquettes avec les lignes qui restent (3 au plus pour la carte).
   */
  function ajuster(racine) {
    var r = racine || document;
    Array.prototype.forEach.call(r.querySelectorAll('.jc, .oc'), function (carte) {
      var cm = carte.querySelector('.cm');
      var ct = carte.querySelector('.ctags');
      var lignesFaits = cm ? ajusterBloc(cm, 'cm-l') : 0;
      if (ct) ajusterEtiquettes(ct, lignesEtiquettes(lignesFaits));
    });
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
    MAX_PAR_LIGNE: MAX_PAR_LIGNE, MIN_PAR_LIGNE: MIN_PAR_LIGNE,
    MAX_LIGNES_BLOC: MAX_LIGNES_BLOC, MAX_LIGNES_CARTE: MAX_LIGNES_CARTE,
    tailles: tailles, valable: valable, repartir: repartir, html: html,
    lignesEtiquettes: lignesEtiquettes, visibles: visibles, pastillePlus: pastillePlus, etiquettesHtml: etiquettesHtml,
    ajuster: ajuster, ajusterBloc: ajusterBloc, ajusterEtiquettes: ajusterEtiquettes, installer: installer,
  };
  racine.CARTES_LIGNES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
