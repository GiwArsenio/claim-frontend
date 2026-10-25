/* ─────────────────────────────────────────────────────────────────────────────
   MESURES NAVIGATEUR — code exécuté DANS la page

   Ce fichier est injecté dans la page par tests/mesures-a11y.cjs. Il expose
   window.__MESURES__, un objet de fonctions de mesure.

   Pourquoi un fichier séparé plutôt qu'une longue chaîne dans le module Node :
   le code qui s'exécute dans la page est du JavaScript ordinaire, qu'on peut
   relire, corriger et déboguer comme tel. Une chaîne sérialisée dans une
   chaîne se dégrade à chaque retouche.
   ───────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Couleurs ───────────────────────────────────────────────────────────── */

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

  function ratio(a, b) {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * Le fond RÉELLEMENT affiché sous un élément.
   *
   * Un fond translucide n'est pas un fond : il faut remonter la cascade
   * jusqu'à une couleur opaque et composer les couches au passage.
   * Sans cela, on mesure un ratio contre une couleur jamais affichée.
   *
   * Un DÉGRADÉ est un fond de son côté : `backgroundColor` vaut transparent
   * et le dégradé se lit dans `backgroundImage`. Sans cette lecture, on
   * mesurait un texte blanc sur le blanc du parent — un rapport de 1,0
   * qui ne décrivait rien, et qui masquait le vrai défaut du bouton.
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

  /* ── Chemins d'éléments ────────────────────────────────────────────────── */

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

  function estVisible(el) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return !(r.width < 2 && r.height < 2);
  }

  /* ── Contrastes ─────────────────────────────────────────────────────────── */

  /**
   * Relève tous les textes visibles avec leur contraste réel.
   *
   * Le seuil dépend de la taille : un texte de grande taille (18,66 px ou
   * plus, ou 14 px en gras) n'exige que 3:1 ; un texte normal exige 4,5:1.
   */
  function releverTextes(options) {
    const opts = options || {};
    const grand = opts.seuilGrand || 3;
    const normal = opts.seuilNormal || 4.5;
    const out = [];

    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;

      const aTexte = Array.from(el.childNodes).some(function (n) {
        return n.nodeType === 3 && n.textContent.trim().length > 0;
      });
      if (!aTexte) continue;

      const c = parse(st.color);
      if (!c || c.a < 0.1) continue;

      const bg = fondEffectif(el);
      const rr = ratio(c, bg);
      const taille = parseFloat(st.fontSize) || 0;
      const gras = parseInt(st.fontWeight, 10) >= 700;
      const estGrand = taille >= 18.66 || (taille >= 14 && gras);

      out.push({
        texte: (el.textContent || '').trim().slice(0, 60),
        ratio: Math.round(rr * 100) / 100,
        seuil: estGrand ? grand : normal,
        couleur: st.color,
        fond: bg,
        taille: st.fontSize,
        gras: gras,
        chemin: cheminDe(el),
        /* Une couleur de marque est posee en dur par le code, dans un style
           inline : c'est la seule trace fiable d'une teinte d'employeur. Les
           jetons du theme ne sont pas marques, et restent mesures. */
        marque: /background\s*:\s*#[0-9a-f]{3,8}\b/i.test(el.getAttribute('style') || ''),
      });
    }
    return out;
  }

  /* ── Débordements ───────────────────────────────────────────────────────── */

  /**
   * Relève les débordements horizontaux.
   *
   * Seuls les débordements par la DROITE sont retenus : un débordement par
   * la gauche signale un contenu décalé, déjà visible ; un débordement par la
   * droite fait apparaître une barre de défilement horizontale.
   */
  function releverDebordements() {
    const largeur = document.documentElement.clientWidth;
    const out = [];

    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      /* Un élément fixe est volontairement calé sur la fenêtre : son
         débordement éventuel ne produit pas de barre horizontale. */
      if (st.position === 'fixed') continue;

      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;

      if (r.right > largeur + 1) {
        out.push({
          type: 'droite',
          chemin: cheminDe(el),
          droite: Math.round(r.right),
          largeur: Math.round(r.width),
          viewport: largeur,
          texte: (el.textContent || '').trim().slice(0, 40),
        });
      }
    }

    const scroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return { debordements: out, scrollHorizontal: scroll, viewport: largeur };
  }

  /* ── Hauteur utile ──────────────────────────────────────────────────────── */

  function mesurerHauteurUtile(sel) {
    const cible = sel ? document.querySelector(sel) : document.body;
    if (!cible) return { hauteur: 0, largeur: 0, viewport: { l: 0, h: 0 }, scrollHeight: 0 };
    const r = cible.getBoundingClientRect();
    return {
      hauteur: Math.round(r.height),
      largeur: Math.round(r.width),
      viewport: { l: window.innerWidth, h: window.innerHeight },
      scrollHeight: document.documentElement.scrollHeight,
    };
  }

  /* ── Focus ──────────────────────────────────────────────────────────────── */

  /**
   * Vérifie que le focus clavier est visible.
   *
   * Un element:focus sans contour ni ombre est un défaut : l'utilisateur
   * clavier ne sait plus où il se trouve.
   */
  function focusEstVisible(sel) {
    const el = sel ? document.querySelector(sel) : document.activeElement;
    if (!el || el === document.body) {
      return { visible: false, raison: 'aucun element focalise' };
    }
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      return { visible: false, raison: 'element invisible' };
    }
    const aContour = st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0;
    const aBoite = st.boxShadow && st.boxShadow !== 'none';
    return {
      visible: Boolean(aContour || aBoite),
      outline: st.outline,
      outlineWidth: st.outlineWidth,
      boxShadow: st.boxShadow,
      element: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
    };
  }

  /* ── Mouvements ─────────────────────────────────────────────────────────── */

  function releverMouvements() {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      const animation = st.animationName && st.animationName !== 'none'
        ? st.animationName : null;
      const transition = st.transitionProperty && st.transitionProperty !== 'none' &&
        parseFloat(st.transitionDuration) > 0 ? st.transitionProperty : null;
      if (!animation && !transition) continue;
      out.push({
        chemin: cheminDe(el),
        animation,
        transition,
        duree: st.transitionDuration,
      });
    }
    return out;
  }

  /* ── Reperes ────────────────────────────────────────────────────────────── */

  function releverLandmarks() {
    const selecteurs = {
      banner: 'header, [role="banner"]',
      navigation: 'nav, [role="navigation"]',
      main: 'main, [role="main"]',
      contentinfo: 'footer, [role="contentinfo"]',
      complementary: 'aside, [role="complementary"]',
      search: '[role="search"]',
      form: 'form',
      region: '[role="region"]',
    };
    const out = {};
    for (const nom of Object.keys(selecteurs)) {
      out[nom] = Array.from(document.querySelectorAll(selecteurs[nom]))
        .filter(estVisible)
        .map(function (el) {
          return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
        });
    }
    return out;
  }

  /* ── Noms accessibles ───────────────────────────────────────────────────── */

  function nomAccessible(el) {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();

    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const t = labelledby.split(/\s+/).map(function (id) {
        const cible = document.getElementById(id);
        return cible ? cible.textContent.trim() : '';
      }).join(' ').trim();
      if (t) return t;
    }

    const titre = el.getAttribute('title');
    if (titre && titre.trim()) return titre.trim();

    const texte = (el.textContent || '').trim();
    if (texte) return texte;

    const img = el.querySelector('img[alt]');
    if (img && img.getAttribute('alt')) return img.getAttribute('alt').trim();

    if (el.tagName === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') {
        return el.value || '';
      }
    }

    return '';
  }

  /**
   * Relève les éléments interactifs sans nom accessible.
   *
   * Un élément interactif sans nom est un défaut d'accessibilité, même
   * s'il est visible : un lecteur d'écran annoncera « bouton ».
   */
  function releverNomsManquants() {
    const selecteur = 'a[href], button, input, select, textarea, ' +
      '[role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
    const manquant = [];

    for (const el of document.querySelectorAll(selecteur)) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) continue;

      if (!nomAccessible(el)) {
        manquant.push({
          balise: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || null,
          classe: (typeof el.className === 'string') ? el.className : null,
          id: el.id || null,
          html: el.outerHTML.slice(0, 160),
        });
      }
    }
    return manquant;
  }

  /* ── Structure ──────────────────────────────────────────────────────────── */

  function releverStructure() {
    const titres = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter(estVisible)
      .map(function (el) {
        return {
          niveau: Number(el.tagName[1]),
          texte: (el.textContent || '').trim().slice(0, 60),
        };
      });

    const images = Array.from(document.querySelectorAll('img'))
      .filter(estVisible)
      .map(function (el) {
        /* Une image est correctement nommée si elle porte un texte
           alternatif, un nom explicite, ou si elle est explicitement
           décorative : aria-hidden, role=presentation ou role=none. Dans
           ce dernier cas, elle n'est pas annoncée, elle n'a donc pas à
           être nommée. */
        const decorative = el.getAttribute('aria-hidden') === 'true' ||
          el.getAttribute('role') === 'presentation' ||
          el.getAttribute('role') === 'none';
        return {
          src: (el.getAttribute('src') || '').slice(0, 80),
          alt: el.getAttribute('alt'),
          decorative: decorative,
          aNom: Boolean(
            (el.getAttribute('alt') && el.getAttribute('alt').trim()) ||
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            decorative
          ),
        };
      });

    return { titres, images };
  }

  /* ── Zone de texte tronquée ─────────────────────────────────────────────── */

  /**
   * Relève les éléments dont le texte visible est coupé alors que le
   * contenu est plus long : le texte est là, l'utilisateur ne le voit pas.
   */
  function releverTextesCoupes() {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      if (st.overflow === 'visible' || st.overflowY === 'visible') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      if (st.textOverflow !== 'ellipsis' && st.webkitLineClamp === 'none') continue;
      out.push({
        chemin: cheminDe(el),
        texte: (el.textContent || '').trim().slice(0, 60),
        visible: el.clientHeight,
        total: el.scrollHeight,
      });
    }
    return out;
  }

  window.__MESURES__ = {
    parse: parse,
    fondEffectif: fondEffectif,
    lum: lum,
    ratio: ratio,
    cheminDe: cheminDe,
    nomAccessible: nomAccessible,
    releverTextes: releverTextes,
    releverDebordements: releverDebordements,
    mesurerHauteurUtile: mesurerHauteurUtile,
    focusEstVisible: focusEstVisible,
    releverMouvements: releverMouvements,
    releverLandmarks: releverLandmarks,
    releverNomsManquants: releverNomsManquants,
    releverStructure: releverStructure,
    releverTextesCoupes: releverTextesCoupes,
  };
})();
