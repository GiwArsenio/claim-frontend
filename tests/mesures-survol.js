/* ─────────────────────────────────────────────────────────────────────────────
   MESURES DE SURVOL — code exécuté DANS la page

   Injecté par tests/mesures-survol.cjs. Expose window.__SURVOL__.

   Trois corrections que la première version a apprises à ses dépens :

   1. La couleur du texte est MESURÉE AVEC SON ALPHA. La navigation pose
      `rgba(255, 255, 255, .8)`, et le survol passe à `var(--blanc)`. Les
      deux se lisent « #ffffff » si l'on oublie l'alpha : la mesure concluait
      que rien ne changeait, alors que le texte s'éclaircit réellement.

   2. Un FILTRE compte comme un changement. `filter: brightness(1.08)`
      n'apparaît ni dans la couleur, ni dans le fond, ni dans la bordure :
      on le ratait, et le bouton « Rechercher » semblait inerte.

   3. La comparaison se fait en ΔE (CIE Lab), pas en soustraction de
      luminance. Sur un fond sombre, une variation de luminance de 0,02 est
      visible alors qu'elle paraîtrait nulle sur un fond clair. Le ΔE est
      l'écart perceptif standardisé : au-delà de 2,3, la différence se voit.
   ───────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function parse(s) {
    const m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (p.length < 3) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  function compose(dessus, fond) {
    const a = dessus.a;
    return {
      r: dessus.r * a + fond.r * (1 - a),
      g: dessus.g * a + fond.g * (1 - a),
      b: dessus.b * a + fond.b * (1 - a),
      a: 1,
    };
  }

  function lum(c) {
    const f = function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function hex(c) {
    const p = function (v) { return Math.round(v).toString(16).padStart(2, '0'); };
    return '#' + p(c.r) + p(c.g) + p(c.b);
  }

  function ratio(a, b) {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * L'espace perceptif CIE Lab.
   *
   * Une soustraction de luminance ne dit pas si une différence se VOIT.
   * Le ΔE est l'écart perceptif standardisé : 2,3 est le seuil classique du
   * « juste perceptible » sur une grande surface uniforme.
   */
  function versLab(c) {
    function f(v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    const r = f(c.r), g = f(c.g), b = f(c.b);

    /* Matrice sRGB -> XYZ (D65), puis XYZ -> Lab. */
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    const e = 216 / 24389, k = 24389 / 27;
    const fx = x > e ? Math.cbrt(x) : (k * x + 16) / 116;
    const fy = y > e ? Math.cbrt(y) : (k * y + 16) / 116;
    const fz = z > e ? Math.cbrt(z) : (k * z + 16) / 116;

    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  /**
   * Le fond RÉELLEMENT affiché sous un élément, dégradé compris.
   */
  function fondEffectif(el) {
    let courant = el;
    let acc = null;
    while (courant) {
      const st = getComputedStyle(courant);

      const image = st.backgroundImage;
      if (image && image !== 'none' && /gradient/.test(image)) {
        const couleurs = image.match(/rgba?\([^)]+\)/g) || [];
        if (couleurs.length) {
          let pire = null;
          let pireRatio = Infinity;
          for (const brut of couleurs) {
            const c = parse(brut);
            if (!c || c.a < 0.1) continue;
            const composee = acc ? compose(acc, c) : c;
            const r = ratio({ r: 255, g: 255, b: 255, a: 1 }, composee);
            if (r < pireRatio) { pireRatio = r; pire = composee; }
          }
          if (pire) return pire;
        }
      }

      const c = parse(st.backgroundColor);
      if (c && c.a > 0) {
        if (c.a >= 0.999) return acc ? compose(acc, c) : c;
        acc = acc ? compose(acc, c) : c;
      }
      courant = courant.parentElement;
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 };
  }

  /**
   * Applique un filtre CSS au fond mesuré.
   *
   * Seul `brightness` est géré : c'est le seul filtre employé par le site.
   * Un filtre inconnu est signalé, pour que la mesure ne le prenne pas
   * pour une absence de changement.
   */
  function appliquerFiltre(couleur, filtre) {
    if (!filtre || filtre === 'none') return { couleur: couleur, inconnu: false };
    const m = /brightness\(([\d.]+)\)/.exec(filtre);
    if (!m) return { couleur: couleur, inconnu: true };
    const k = parseFloat(m[1]);
    return {
      couleur: {
        r: Math.min(255, couleur.r * k),
        g: Math.min(255, couleur.g * k),
        b: Math.min(255, couleur.b * k),
        a: 1,
      },
      inconnu: false,
    };
  }

  function cheminDe(el) {
    const parts = [];
    let n = el;
    for (let i = 0; i < 4 && n && n.tagName !== 'BODY'; i++) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += '#' + n.id; parts.unshift(s); break; }
      if (n.classList && n.classList.length) {
        s += '.' + Array.from(n.classList).join('.');
      }
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(' > ');
  }

  /**
   * L'état visuel d'un élément : ce qui peut changer au survol.
   *
   * La couleur du texte est COMPOSÉE sur le fond : c'est elle qui est
   * affichée, pas la valeur déclarée.
   */
  function relever(el) {
    const st = getComputedStyle(el);
    const fondBrut = fondEffectif(el);
    const filtre = appliquerFiltre(fondBrut, st.filter);
    const fond = filtre.couleur;

    const texteBrut = parse(st.color) || { r: 0, g: 0, b: 0, a: 1 };
    const texte = texteBrut.a >= 0.999 ? texteBrut : compose(texteBrut, fond);

    const bordBrut = parse(st.borderTopColor) || { r: 0, g: 0, b: 0, a: 1 };
    const bord = bordBrut.a >= 0.999 ? bordBrut : compose(bordBrut, fond);
    /* La bordure du bas se mesure aussi : c'est elle qui distingue le
       lien de navigation actif, dont la couleur de texte ne change pas. */
    const bordBasBrut = parse(st.borderBottomColor) || bordBrut;
    const bordBas = bordBasBrut.a >= 0.999 ? bordBasBrut : compose(bordBasBrut, fond);

    const labFond = versLab(fond);
    const labTexte = versLab(texte);
    const labBord = versLab(bord);

    return {
      chemin: cheminDe(el),
      fond: hex(fond),
      fondLumiere: Math.round(lum(fond) * 1000) / 1000,
      fondLab: labFond,
      texte: hex(texte),
      texteLumiere: Math.round(lum(texte) * 1000) / 1000,
      texteLab: labTexte,
      contrasteTexte: Math.round(ratio(texte, fond) * 100) / 100,
      texteAlphaDeclare: texteBrut.a,
      bordCouleur: hex(bord),
      bordLumiere: Math.round(lum(bord) * 1000) / 1000,
      bordLab: labBord,
      bordBasCouleur: hex(bordBas),
      bordBasLab: versLab(bordBas),
      bordEpaisseur: st.borderTopWidth,
      transform: st.transform,
      boxShadow: st.boxShadow,
      filter: st.filter,
      filtreInconnu: filtre.inconnu,
      cursor: st.cursor,
      textDecorationLine: st.textDecorationLine,
      opacity: st.opacity,
    };
  }

  /**
   * Tous les éléments interactifs visibles de la page.
   *
   * On passe par TOUS les éléments cliquables, pas seulement les deux
   * exemples signalés : c'est la seule façon de voir l'ensemble du
   * problème, et pas seulement les symptômes connus.
   */
  function elementsInteractifs() {
    const selecteur = 'a[href], button, input, select, textarea, ' +
      '[role="button"], [role="link"], [onclick], [tabindex]:not([tabindex="-1"])';
    const out = [];

    /* Chaque élément reçoit un identifiant unique.
       Identifier un élément par son CHEMIN ne suffit pas : trois liens de
       navigation n'ont ni id ni classe, et partagent donc le même chemin.
       La mesure porta alors toujours sur le PREMIER d'entre eux, et le
       survol déclenché sur le second ne changeait rien au premier : le
       rapport concluait à tort que rien ne réagissait. */
    let compteur = 0;
    for (const el of document.querySelectorAll(selecteur)) {
      el.setAttribute('data-survol', String(compteur));
      compteur++;
    }

    for (const el of document.querySelectorAll(selecteur)) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      /* Hors de la fenêtre : le survol n'y arrivera pas. */
      if (r.top < 0 || r.left < 0) continue;
      if (r.bottom > document.documentElement.clientHeight) continue;
      if (r.right > document.documentElement.clientWidth) continue;

      /* Un champ de saisie reagit au FOCUS, pas au survol : changer
         d'apparence au passage de la souris sur un champ serait un
         anti-pattern d'interface. On le signale, et le test ne le juge
         pas sur ce critere. */
      const estChamp = el.tagName === 'INPUT' &&
        ['text', 'search', 'email', 'url', 'tel', ''].includes(
          (el.getAttribute('type') || '').toLowerCase());

      out.push({
        id: el.getAttribute('data-survol'),
        chemin: cheminDe(el),
        balise: el.tagName.toLowerCase(),
        estChamp: estChamp,
        type: el.getAttribute('type') || null,
        texte: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
      });
    }

    /* Deux éléments ne peuvent pas être mesurés en même temps : on
       élimine les chevauchements, le premier dans l'ordre du document
       garde la place. */
    const retenus = [];
    for (const el of out) {
      let chevauche = false;
      for (const r of retenus) {
        if (Math.abs(r.x - el.x) < 24 && Math.abs(r.y - el.y) < 24) { chevauche = true; break; }
      }
      if (!chevauche) retenus.push(el);
    }
    return retenus;
  }

  window.__SURVOL__ = {
    relever: relever,
    fondEffectif: fondEffectif,
    elementsInteractifs: elementsInteractifs,
    cheminDe: cheminDe,
    versLab: versLab,
  };
})();
