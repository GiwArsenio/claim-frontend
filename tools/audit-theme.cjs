/* Audit du thème jour/nuit : compare, élément par élément, les couleurs
   calculées en mode jour et en mode nuit.

   Un fond translucide n'est pas un fond : il faut le composer avec ce qu'il
   recouvre, sinon on mesure un contraste contre une couleur qui n'existe
   pas à l'écran. La composition est donc résolue en remontant la cascade
   jusqu'à un fond opaque. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8099';
const OUT = path.join(__dirname, '..', 'captures');

const PAGES = [
  { name: 'accueil', url: '/index.html' },
  { name: 'board', url: '/job-board.html' },
];

const FORMATS = [
  { id: 'bureau', viewport: { width: 1440, height: 900 }, isMobile: false },
  { id: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
];

function parseRGB(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

function over(fond, dessus) {
  // dessus est translucide, fond est opaque : on compose dessus sur fond.
  const a = dessus.a;
  return {
    r: dessus.r * a + fond.r * (1 - a),
    g: dessus.g * a + fond.g * (1 - a),
    b: dessus.b * a + fond.b * (1 - a),
    a: 1,
  };
}

function luminance(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contraste(a, b) {
  if (!a || !b) return null;
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* Relevé effectué DANS la page : on y a accès au DOM et aux styles calculés. */
async function relever(page) {
  return page.evaluate(() => {
    const parse = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s || '');
      if (!m) return null;
      const p = m[1].split(',').map((x) => parseFloat(x));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const compose = (dessus, fond) => {
      const a = dessus.a;
      return {
        r: dessus.r * a + fond.r * (1 - a),
        g: dessus.g * a + fond.g * (1 - a),
        b: dessus.b * a + fond.b * (1 - a),
        a: 1,
      };
    };

    /* Le fond effectif d'un élément : on remonte tant que le fond est
       translucide, en composant avec le parent. */
    function fondEffectif(el) {
      let courant = el;
      let acc = null;
      while (courant && courant !== document.documentElement.parentNode) {
        const st = getComputedStyle(courant);
        const c = parse(st.backgroundColor);
        if (c && c.a > 0) {
          if (c.a >= 0.999) {
            return acc ? compose(acc, c) : c;
          }
          acc = acc ? compose(acc, c) : c;
        }
        courant = courant.parentElement;
      }
      return acc || { r: 255, g: 255, b: 255, a: 1 };
    }

    const sorties = [];
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;

      const texteDirect = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0
      );
      const fondPropre = parse(st.backgroundColor);
      const aFond = fondPropre && fondPropre.a > 0.001;

      if (!texteDirect && !aFond) continue;

      const chemin = [];
      let n = el;
      while (n && n !== document.body && chemin.length < 4) {
        let s = n.tagName.toLowerCase();
        if (n.id) { s += '#' + n.id; break; }
        if (n.classList.length) s += '.' + Array.from(n.classList).join('.');
        chemin.unshift(s);
        n = n.parentElement;
      }

      sorties.push({
        sel: chemin.join(' > '),
        bg: st.backgroundColor,
        bgEffectif: fondEffectif(el),
        color: st.color,
        texte: texteDirect ? (el.textContent || '').trim().slice(0, 40) : '',
        aBordure: st.borderTopWidth !== '0px',
      });
    }
    return sorties;
  });
}

(async () => {
  const browser = await chromium.launch();
  const resultats = [];

  for (const fmt of FORMATS) {
    for (const p of PAGES) {
      const ctx = await browser.newContext({
        viewport: fmt.viewport, isMobile: fmt.isMobile, hasTouch: fmt.isMobile,
        deviceScaleFactor: 1, locale: 'fr-FR', colorScheme: 'light',
      });
      const page = await ctx.newPage();
      await page.goto(BASE + p.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      const jour = await relever(page);
      await page.locator('.bascule-theme').first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(700);
      const nuit = await relever(page);

      const indexNuit = new Map();
      for (const e of nuit) indexNuit.set(e.sel, e);

      const trous = [];
      const contrastes = [];

      for (const j of jour) {
        const n = indexNuit.get(j.sel);
        if (!n) continue;

        const bgN = parseRGB(n.bg);
        const bgEffectifN = n.bgEffectif;
        const coN = parseRGB(n.color);

        /* Un élément « à trous » garde un fond clair à l'écran en mode nuit,
           ou un texte noir. On se base sur le fond EFFECTIF (composé). */
        const fondResteClair = bgEffectifN && luminance(bgEffectifN) > 0.25;
        const texteNoirEnNuit = coN && coN.a > 0.1 && luminance(coN) < 0.15;

        if (fondResteClair || texteNoirEnNuit) {
          trous.push({
            sel: j.sel, bgJour: j.bg, bgNuit: n.bg,
            fondEffectifNuit: bgEffectifN,
            colorJour: j.color, colorNuit: n.color,
            texte: j.texte,
          });
        }

        /* Contraste texte/fond, mesuré sur le fond effectif. */
        if (j.texte && coN) {
          const c = contraste(coN, bgEffectifN);
          if (c !== null && c < 4.5) {
            contrastes.push({
              sel: j.sel, ratio: Number(c.toFixed(2)),
              color: n.color, bg: n.bg, texte: j.texte,
            });
          }
        }
      }

      const vus = new Set();
      const trousUniques = trous.filter((t) => { if (vus.has(t.sel)) return false; vus.add(t.sel); return true; });
      const vus2 = new Set();
      const contrastesUniques = contrastes.filter((t) => { if (vus2.has(t.sel)) return false; vus2.add(t.sel); return true; });

      resultats.push({
        page: p.name, format: fmt.id,
        totalElements: jour.length,
        trous: trousUniques.length,
        contrastesInsuffisants: contrastesUniques.length,
        detailTrous: trousUniques,
        detailContrastes: contrastesUniques,
      });

      console.log(`\n=== ${p.name} / ${fmt.id} ===`);
      console.log(`éléments visibles : ${jour.length} | trous de thème : ${trousUniques.length} | contrastes < 4.5 : ${contrastesUniques.length}`);
      trousUniques.slice(0, 12).forEach((t) =>
        console.log(`  TROU  ${t.sel}\n         fond effectif nuit ${JSON.stringify(t.fondEffectifNuit)} | texte ${t.colorJour} -> ${t.colorNuit} | "${t.texte}"`));
      contrastesUniques.slice(0, 12).forEach((t) =>
        console.log(`  RATIO ${t.ratio} ${t.sel} | "${t.texte}"`));

      await ctx.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'trous-theme.json'), JSON.stringify(resultats, null, 2));
})();
