/* Test du thème jour/nuit — parcours navigateur.
 *
 * Ce test protège la refonte du thème : il vérifie que la bascule fonctionne,
 * que la préférence survit à un rechargement, que les surfaces suivent le
 * thème, et qu'aucun texte ne devient illisible.
 *
 * Il a été écrit après la refonte, mais il échoue sur la version précédente :
 * les boutons « Refuser » et « Postuler » y restaient blancs avec du texte
 * blanc, et les pastilles conservaient leur fond clair.
 *
 * Usage : node tests/theme.test.cjs
 *
 * Le serveur est demarre par le test lui-meme, sur un port libre obtenu par
 * le systeme. Avant, le fichier exigeait un serveur deja tourne sur le port
 * 8099 : lance seul, il echouait sur une connexion refusee, et un resultat
 * rouge ne distinguait pas un defaut du theme d'un environnement oublie.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const aide = require('./aide-parcours.cjs');

/* La base du serveur : soit celle imposee par l'environnement, soit celle
   du serveur que le test a demarre. La lire au moment de l'usage evite un
   ecrasement : BASE etait figee au chargement du fichier. */
function base() {
  return process.env.CLAIM_BASE || aide.BASE;
}

const PAGES = [
  { nom: 'accueil', url: '/index.html' },
  { nom: 'board', url: '/job-board.html' },
];

const FORMATS = [
  { nom: 'bureau', viewport: { width: 1440, height: 900 }, isMobile: false },
  { nom: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
];

/* ── Outils de couleur ───────────────────────────────────────────────────── */

function parseRGB(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
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

/* Fond effectif d'un élément : on remonte la cascade en composant les fonds
   translucides, sinon on mesure un contraste contre une couleur absente. */
const FOND_EFFECTIF = `(function (el) {
  function parse(s) {
    const m = /rgba?\\(([^)]+)\\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function compose(dessus, fond) {
    const a = dessus.a;
    return { r: dessus.r * a + fond.r * (1 - a),
             g: dessus.g * a + fond.g * (1 - a),
             b: dessus.b * a + fond.b * (1 - a), a: 1 };
  }
  let courant = el, acc = null;
  while (courant) {
    const c = parse(getComputedStyle(courant).backgroundColor);
    if (c && c.a > 0) {
      if (c.a >= 0.999) return acc ? compose(acc, c) : c;
      acc = acc ? compose(acc, c) : c;
    }
    courant = courant.parentElement;
  }
  return acc || { r: 255, g: 255, b: 255, a: 1 };
})`;

/* ── Page de test ────────────────────────────────────────────────────────── */

async function nouvellePage(browser, format) {
  const ctx = await browser.newContext({
    viewport: format.viewport,
    isMobile: format.isMobile,
    hasTouch: format.isMobile,
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    colorScheme: 'light',
  });

  /* Le backend simule repond a la place de la production : le test du theme
     ne doit dependre d'aucun service externe, ni de l'etat de la production
     au moment de l'execution. */
  if (!process.env.CLAIM_BASE) {
    await ctx.addInitScript((b) => {
      window.CLAIM_API_BASE = b + '/api/v1';
    }, aide.BASE);
  }

  const page = await ctx.newPage();
  return { ctx, page };
}

async function attendreStabilite(page) {
  await page.waitForLoadState('domcontentloaded');
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch (e) {}
  await page.waitForTimeout(1200);
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

/* Le serveur est demarre une fois pour toute la suite, puis arrete. Chaque
   test conserve son navigateur : seul l'etat du serveur est partage. */
let serveurPret = false;

test.before(async () => {
  if (!process.env.CLAIM_BASE) {
    await aide.demarrerServeur();
  }
  serveurPret = true;
});

test.after(async () => {
  if (serveurPret && !process.env.CLAIM_BASE) {
    await aide.arreterServeur();
  }
});

test('la bascule pose et retire l’attribut de thème', async () => {
  const browser = await chromium.launch();
  try {
    for (const format of FORMATS) {
      const { ctx, page } = await nouvellePage(browser, format);
      await page.goto(base() + '/index.html', { waitUntil: 'domcontentloaded' });
      await attendreStabilite(page);

      const bouton = page.locator('.bascule-theme').first();
      assert.ok(await bouton.count() > 0, 'le bouton de bascule doit exister');

      await bouton.click();
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
        'nuit', 'le clic doit poser le thème nuit'
      );

      await bouton.click();
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
        null, 'le second clic doit revenir au thème jour'
      );

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});

test('la préférence survit à un rechargement', async () => {
  const browser = await chromium.launch();
  try {
    const { ctx, page } = await nouvellePage(browser, FORMATS[0]);
    await page.goto(base() + '/index.html', { waitUntil: 'domcontentloaded' });
    await attendreStabilite(page);

    await page.locator('.bascule-theme').first().click();
    await page.waitForTimeout(300);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await attendreStabilite(page);

    assert.equal(
      await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
      'nuit', 'le thème doit survivre au rechargement'
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('claim-theme')),
      'nuit', 'la préférence doit être enregistrée'
    );

    await ctx.close();
  } finally {
    await browser.close();
  }
});

test('aucune surface ne reste claire en mode nuit', async () => {
  const browser = await chromium.launch();
  try {
    for (const p of PAGES) {
      for (const format of FORMATS) {
        const { ctx, page } = await nouvellePage(browser, format);
        await page.goto(base() + p.url, { waitUntil: 'domcontentloaded' });
        await attendreStabilite(page);

        await page.locator('.bascule-theme').first().click();
        await page.waitForTimeout(600);

        const claires = await page.evaluate(`(function () {
          const fondEffectif = ${FOND_EFFECTIF};
          const parse = function (s) {
            const m = /rgba?\\(([^)]+)\\)/.exec(s || '');
            if (!m) return null;
            const q = m[1].split(',').map(function (x) { return parseFloat(x); });
            return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 };
          };
          const lum = function (c) {
            const f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
          };
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            const st = getComputedStyle(el);
            if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            const aFond = parse(st.backgroundColor);
            if (!aFond || aFond.a < 0.01) continue;
            const bg = fondEffectif(el);
            if (lum(bg) <= 0.25) continue;
            // Seules les surfaces de contenu comptent : pas les logos d'employeurs,
            // dont la couleur est celle de la marque.
            const texte = (el.textContent || '').trim().slice(0, 30);
            out.push({ tag: el.tagName.toLowerCase(), classe: el.className, fond: bg, texte: texte });
          }
          return out;
        })()`);

        assert.equal(
          claires.length, 0,
          `${p.nom}/${format.nom} : ${claires.length} surface(s) restée claire(s) en mode nuit — ` +
          JSON.stringify(claires.slice(0, 5))
        );

        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('tout texte reste lisible en mode nuit', async () => {
  const browser = await chromium.launch();
  try {
    for (const p of PAGES) {
      for (const format of FORMATS) {
        const { ctx, page } = await nouvellePage(browser, format);
        await page.goto(base() + p.url, { waitUntil: 'domcontentloaded' });
        await attendreStabilite(page);

        await page.locator('.bascule-theme').first().click();
        await page.waitForTimeout(600);

        const illisibles = await page.evaluate(`(function () {
          const fondEffectif = ${FOND_EFFECTIF};
          const parse = function (s) {
            const m = /rgba?\\(([^)]+)\\)/.exec(s || '');
            if (!m) return null;
            const q = m[1].split(',').map(function (x) { return parseFloat(x); });
            return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 };
          };
          const lum = function (c) {
            const f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
          };
          const ratio = function (a, b) {
            const la = lum(a), lb = lum(b);
            return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
          };
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            const st = getComputedStyle(el);
            if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) continue;
            const texte = Array.from(el.childNodes).some(function (n) {
              return n.nodeType === 3 && n.textContent.trim().length > 0;
            });
            if (!texte) continue;
            const c = parse(st.color);
            if (!c || c.a < 0.1) continue;
            const bg = fondEffectif(el);
            const rr = ratio(c, bg);
            // On tolère un texte tres pale (icone decorative) : le seuil vise
            // le texte informatif, pas les pictogrammes.
            const grand = parseFloat(st.fontSize) >= 14;
            const seuil = grand ? 3 : 4.5;
            if (rr < seuil) {
              out.push({ texte: (el.textContent || '').trim().slice(0, 40),
                         ratio: Math.round(rr * 100) / 100,
                         couleur: st.color, taille: st.fontSize });
            }
          }
          return out;
        })()`);

        assert.equal(
          illisibles.length, 0,
          `${p.nom}/${format.nom} : ${illisibles.length} texte(s) illisible(s) en mode nuit — ` +
          JSON.stringify(illisibles.slice(0, 5))
        );

        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('le mode jour garde ses surfaces claires', async () => {
  const browser = await chromium.launch();
  try {
    for (const p of PAGES) {
      const { ctx, page } = await nouvellePage(browser, FORMATS[0]);
      await page.goto(base() + p.url, { waitUntil: 'domcontentloaded' });
      await attendreStabilite(page);

      /* Seules les surfaces de contenu sont verifiees. Les aplats de marque
         (en-tete teal, bouton plein, pastille d'employeur) sont volontairement
         sombres : ils ne doivent pas etre signales. */
      const sombres = await page.evaluate(`(function () {
        const fondEffectif = ${FOND_EFFECTIF};
        const parse = function (s) {
          const m = /rgba?\(([^)]+)\)/.exec(s || '');
          if (!m) return null;
          const q = m[1].split(',').map(function (x) { return parseFloat(x); });
          return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 };
        };
        const lum = function (c) {
          const f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        };
        const out = [];
        const els = document.querySelectorAll(
          '.card, .jc, .oc, .panneau, .dc, .pr, .chip, .sbar, .consent, .pied, .ec, .widget, .kpi-item'
        );
        for (const el of els) {
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const bg = fondEffectif(el);
          if (lum(bg) >= 0.25) continue;
          out.push({ classe: el.className, fond: bg });
        }
        return out;
      })()`);

      assert.equal(
        sombres.length, 0,
        `${p.nom} : ${sombres.length} surface(s) de contenu restée(s) sombre(s) en mode jour — ` +
        JSON.stringify(sombres.slice(0, 5))
      );

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});

test('le bandeau de consentement reste lisible dans les deux thèmes', async () => {
  const browser = await chromium.launch();
  try {
    for (const theme of ['jour', 'nuit']) {
      const { ctx, page } = await nouvellePage(browser, FORMATS[0]);
      await page.goto(base() + '/index.html', { waitUntil: 'domcontentloaded' });
      await attendreStabilite(page);

      if (theme === 'nuit') {
        await page.locator('.bascule-theme').first().click();
        await page.waitForTimeout(500);
      }

      const boutons = await page.evaluate(`(function () {
        const fondEffectif = ${FOND_EFFECTIF};
        const parse = function (s) {
          const m = /rgba?\\(([^)]+)\\)/.exec(s || '');
          if (!m) return null;
          const q = m[1].split(',').map(function (x) { return parseFloat(x); });
          return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 };
        };
        const lum = function (c) {
          const f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        };
        const ratio = function (a, b) {
          const la = lum(a), lb = lum(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };
        const out = [];
        for (const el of document.querySelectorAll('.consent button')) {
          const st = getComputedStyle(el);
          const c = parse(st.color);
          const bg = fondEffectif(el);
          out.push({ texte: el.textContent.trim(), ratio: Math.round(ratio(c, bg) * 100) / 100,
                     couleur: st.color, fond: st.backgroundColor });
        }
        return out;
      })()`);

      assert.ok(boutons.length >= 2, 'le bandeau doit exposer deux boutons');
      for (const b of boutons) {
        assert.ok(
          b.ratio >= 4.5,
          `mode ${theme} : le bouton « ${b.texte} » a un contraste de ${b.ratio} ` +
          `(couleur ${b.couleur} sur fond ${b.fond})`
        );
      }

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});
