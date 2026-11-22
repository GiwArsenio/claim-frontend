/* ─────────────────────────────────────────────────────────────────────────────
   « POURQUOI CLAIM! » : UN SEUL ENCADRÉ, SANS CARTES IMBRIQUÉES NI PASTILLES D'ICÔNE

   La section portait une carte blanche qui contenait trois cartes bordées,
   chacune avec une pastille d'icône carrée au-dessus du titre. Elle se lit
   désormais en trois colonnes séparées par un filet, dans un seul encadré
   blanc (le .panneau de « Ils recrutent en ce moment ») ; une colonne sur
   téléphone, filets horizontaux.

   Ce fichier tient :
     • le texte et la hiérarchie des titres (h2, puis trois h3) : inchangés ;
     • une seule carte (bordure complète, fond de carte, ombre) dans la
       section : l'encadré. Aucune carte dans une carte ;
     • aucune pastille d'icône : l'icône est nue, sans fond ni bordure ;
     • aucune numérotation : le contenu n'est pas une séquence ;
     • trois colonnes au bureau, une seule sur téléphone, sans débordement ;
     • le contraste du texte (≥ 4,5:1) de jour comme de nuit.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const BUREAU = { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

const TITRES = ['Là où les autres ne vont pas', 'Relevé chaque matin', 'Le métier, et lui seul'];
const TEXTES = [
  'Les sources sont relevées une par une, y compris les sites carrières que les agrégateurs laissent de côté. Une offre publiée chez un assureur régional y est, comme celle d\'un grand groupe.',
  'La collecte tourne tous les jours avant l\'ouverture. Une offre retirée le lendemain quitte le board le lendemain — pas dans trois semaines.',
  'Actuariat, data, IA, souscription : rien d\'autre. Pas d\'« informatique » noyée dans 1 200 annonces — le tri est fait à la collecte, pas à la main par le candidat.',
];

async function ouvrir(format, theme) {
  const { ctx, page } = await aide.ouvrirPage(format, { theme });
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.oc .ctitle', { timeout: 20000 });
  await aide.attendre(page, 800);
  await page.evaluate(() => {
    const b = document.querySelector('#claim-consentement');
    if (b) b.remove();
  });
  return { ctx, page };
}

/** Mesure tout ce que le test asserte, dans la page. */
function mesurer() {
  const h2 = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim() === 'Pourquoi Claim!');
  if (!h2) return null;
  const section = h2.closest('section');
  const norm = (t) => t.replace(/\s+/g, ' ').trim();

  /* Contraste WCAG : la couleur du texte contre le premier fond opaque
     rencontré en remontant. */
  const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const fond = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c.slice(0, 3);
    }
    return [255, 255, 255];
  };
  const ratio = (el, couleur) => {
    const a = lum(rgb(couleur || getComputedStyle(el).color).slice(0, 3));
    const b = lum(fond(el));
    return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
  };

  const tous = [section, ...section.querySelectorAll('*')];
  const cote = (cs, c) => parseFloat(cs['border' + c + 'Width']) > 0 && cs['border' + c + 'Style'] !== 'none';
  const cartes = tous.filter((e) => {
    const cs = getComputedStyle(e);
    const bordureComplete = ['Top', 'Right', 'Bottom', 'Left'].every((c) => cote(cs, c));
    const ombre = cs.boxShadow !== 'none';
    const rond = parseFloat(cs.borderTopLeftRadius) > 0;
    return bordureComplete || ombre || (rond && cs.backgroundColor !== 'rgba(0, 0, 0, 0)');
  }).map((e) => e.className || e.tagName);

  const pastilles = [...section.querySelectorAll('svg')].map((svg) => {
    const cs = getComputedStyle(svg.parentElement);
    const r = svg.parentElement.getBoundingClientRect();
    return {
      fond: cs.backgroundColor,
      bordure: cs.borderTopWidth,
      rayon: cs.borderTopLeftRadius,
      carre: Math.abs(r.width - r.height) < 2 && r.width <= 64,
    };
  });

  const h3 = [...section.querySelectorAll('h3')];
  const points = [...section.querySelectorAll('.pourquoi-point')];
  const rects = points.map((p) => p.getBoundingClientRect());
  const bordure = (p, c) => parseFloat(getComputedStyle(p)['border' + c + 'Width']);

  return {
    titresDansOrdre: [...section.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((e) => e.tagName),
    h3: h3.map((e) => norm(e.textContent)),
    paragraphes: points.map((p) => norm(p.querySelector('p').textContent)),
    cartes,
    pastilles,
    numerotation: {
      liste: section.querySelectorAll('ol, li').length,
      compteur: tous.some((e) => ['::before', '::after'].some((q) => /counter/.test(getComputedStyle(e, q).content))),
      chiffreEnTete: h3.some((e) => /^\s*\d/.test(e.textContent)),
    },
    colonnes: {
      nombre: points.length,
      hauts: rects.map((r) => Math.round(r.top)),
      largeurs: rects.map((r) => Math.round(r.width)),
      gauches: rects.map((r) => Math.round(r.left)),
      filetGauche: points.map((p) => bordure(p, 'Left')),
      filetHaut: points.map((p) => bordure(p, 'Top')),
    },
    deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    contrastes: {
      h2: ratio(h2),
      sousTitre: ratio(section.querySelector('.tete p')),
      h3: Math.min(...h3.map((e) => ratio(e))),
      texte: Math.min(...points.map((p) => ratio(p.querySelector('p')))),
      icone: Math.min(...[...section.querySelectorAll('svg')].map((s) => ratio(s, getComputedStyle(s).stroke))),
    },
    feuille: [...document.styleSheets].some((s) => /accueil-pourquoi\.css/.test(s.href || '')),
  };
}

for (const [nom, format] of [['bureau 1440 px', BUREAU], ['téléphone 390 px', PHONE]]) {
  for (const theme of ['jour', 'nuit']) {
    test(`Pourquoi Claim! — ${nom}, ${theme} : un seul encadré, sans pastilles, lisible`, async () => {
      await aide.demarrerServeur();
      await aide.demarrerNavigateur();
      try {
        const { ctx, page } = await ouvrir(format, theme);
        try {
          const m = await page.evaluate(mesurer);
          assert.ok(m, 'la section « Pourquoi Claim! » est introuvable');
          assert.ok(m.feuille, 'assets/accueil-pourquoi.css n\'est pas chargée');

          /* Texte et hiérarchie : inchangés. */
          assert.deepEqual(m.titresDansOrdre, ['H2', 'H3', 'H3', 'H3']);
          assert.deepEqual(m.h3, TITRES);
          assert.deepEqual(m.paragraphes, TEXTES);

          /* Un seul encadré, donc aucune carte imbriquée : ni dans l'encadré, ni autour. */
          assert.deepEqual(m.cartes, ['panneau'], `éléments en forme de carte : ${JSON.stringify(m.cartes)}`);

          /* Aucune pastille : le parent de l'icône n'a ni fond, ni bordure, ni rayon. */
          assert.equal(m.pastilles.length, 3, 'trois icônes attendues');
          for (const p of m.pastilles) {
            assert.equal(p.fond, 'rgba(0, 0, 0, 0)', 'l\'icône est posée sur un fond (pastille)');
            assert.equal(p.bordure, '0px', 'l\'icône est dans un cadre (pastille)');
            assert.equal(parseFloat(p.rayon), 0, 'l\'icône est dans un cadre arrondi (pastille)');
            assert.equal(p.carre, false, 'l\'icône est dans un bloc carré (pastille)');
          }

          /* Pas une séquence : aucune numérotation. */
          assert.deepEqual(m.numerotation, { liste: 0, compteur: false, chiffreEnTete: false });

          /* Mise en page. */
          assert.equal(m.deborde, false, 'la page déborde horizontalement');
          const c = m.colonnes;
          assert.equal(c.nombre, 3);
          if (format === BUREAU) {
            assert.equal(new Set(c.hauts).size, 1, `trois colonnes alignées en haut : ${c.hauts}`);
            assert.ok(Math.max(...c.largeurs) - Math.min(...c.largeurs) <= 2, `largeurs inégales : ${c.largeurs}`);
            assert.deepEqual(c.filetGauche.map((x) => x > 0), [false, true, true], 'filets verticaux attendus entre les colonnes');
            assert.deepEqual(c.filetHaut, [0, 0, 0]);
          } else {
            assert.equal(new Set(c.gauches).size, 1, `une seule colonne attendue : ${c.gauches}`);
            assert.ok(c.hauts[0] < c.hauts[1] && c.hauts[1] < c.hauts[2], 'colonnes empilées');
            assert.deepEqual(c.filetHaut.map((x) => x > 0), [false, true, true], 'filets horizontaux attendus entre les points');
            assert.deepEqual(c.filetGauche, [0, 0, 0]);
          }

          /* Contraste : 4,5:1 pour le texte, 3:1 pour l'icône. */
          for (const [cle, v] of Object.entries(m.contrastes)) {
            const seuil = cle === 'icone' ? 3 : 4.5;
            assert.ok(v >= seuil, `contraste « ${cle} » ${v}:1 sous ${seuil}:1 (${theme})`);
          }
        } finally {
          await ctx.close();
        }
      } finally {
        await aide.arreterNavigateur();
        await aide.arreterServeur();
      }
    });
  }
}
