/* ─────────────────────────────────────────────────────────────────────────────
   LES ÉTIQUETTES DES CARTES : DEUX TRAITEMENTS, PAS QUATRE (T10, décision D8)

   Une carte portait quatre traitements : spécialité (orange, capitales),
   compétences (cyan, capitales), conditions du poste (gris) et lieu (teal). Ce
   fichier tient ce qui ne doit plus se défaire, sur l'accueil et sur le board :

     • au plus DEUX traitements visuels par carte, mesurés comme des
       combinaisons distinctes de `background-color` + `text-transform` parmi
       les pastilles (lieu, contrat, expérience, salaire, spécialité) ;
     • les compétences ne sont plus des pastilles : une ligne de texte, sans
       fond ni bordure ;
     • aucune information retirée : lieu, contrat, expérience, salaire,
       spécialité et les trois premières compétences sont toujours lisibles,
       les suivantes sont comptées (« +N ») et toutes figurent dans le titre ;
     • contraste ≥ 4,5:1 et police ≥ 11 px, en jour et en nuit, sur bureau et
       téléphone ; aucun défilement horizontal ;
     • une compétence est échappée (pas de HTML injecté).

   Les fixtures donnent `city` et peu d'étiquettes : les réponses de l'API sont
   complétées au vol (tests/fixtures/offres-completes.cjs).
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const { installerOffresCompletes } = require('./fixtures/offres-completes.cjs');

const SURFACES = [
  { nom: 'board', url: '/job-board.html', cartes: '#feed .jc' },
  { nom: 'accueil', url: '/index.html', cartes: '#liste .oc' },
];

/** Lit chaque carte telle qu'elle est rendue (exécuté dans la page). */
function lireCartes(sel) {
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const x = m[1].split(',').map(parseFloat);
    return { c: x.slice(0, 3), a: x.length > 3 ? x[3] : 1 };
  };
  const lum = (c) => {
    const a = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };
  const fond = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const b = parse(getComputedStyle(e).backgroundColor);
      if (b && b.a > 0.5) return b.c;
    }
    return [255, 255, 255];
  };
  const lire = (e) => {
    const cs = getComputedStyle(e);
    const L1 = lum(parse(cs.color).c);
    const L2 = lum(fond(e));
    return {
      classe: e.className,
      texte: e.textContent.trim(),
      titre: e.getAttribute('title') || '',
      fond: cs.backgroundColor,
      casse: cs.textTransform,
      taille: parseFloat(cs.fontSize),
      bordure: parseFloat(cs.borderTopWidth),
      contraste: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05),
      enfantsHtml: e.querySelectorAll('*').length,
    };
  };
  return [...document.querySelectorAll(sel)].map((carte) => ({
    titre: (carte.querySelector('.ctitle') || {}).textContent || '',
    pastilles: [...carte.querySelectorAll('.card-fact')].map(lire),
    competences: [...carte.querySelectorAll('.ccomp')].map(lire),
    anciennes: carte.querySelectorAll('.tag, .tm, .tn').length,
    debordeX: carte.scrollWidth > carte.clientWidth + 1,
  }));
}

async function ouvrir(surface, format, theme, options = {}) {
  const { ctx, page } = await aide.ouvrirPage(format, { theme });
  await installerOffresCompletes(page, options);
  await page.goto(aide.BASE + surface.url, { waitUntil: 'domcontentloaded' });
  await aide.attendre(page, 1800);
  await page.evaluate(() => { const b = document.querySelector('#claim-consentement'); if (b) b.remove(); });
  return { ctx, page };
}

const CAS = [];
for (const surface of SURFACES) {
  for (const [fn, format] of [['1440', aide.FORMATS.bureau], ['390', aide.FORMATS.phone]]) {
    for (const theme of ['jour', 'nuit']) CAS.push({ surface, fn, format, theme });
  }
}

test('T10 — au plus 2 traitements par carte, aucune information retirée, contraste tenu', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const { surface, fn, format, theme } of CAS) {
      const quoi = `${surface.nom} ${fn} px ${theme}`;
      const { ctx, page } = await ouvrir(surface, format, theme);
      try {
        const cartes = await page.evaluate(lireCartes, surface.cartes);
        assert.ok(cartes.length >= 4, `${quoi} : il faut des cartes (${cartes.length})`);

        let completes = 0;
        for (const c of cartes) {
          const ou = `${quoi} « ${c.titre.slice(0, 30)} »`;
          // 1. Le critère : combinaisons fond + casse distinctes parmi les pastilles.
          const traitements = new Set(c.pastilles.map((p) => `${p.fond}|${p.casse}`));
          assert.ok(traitements.size <= 2, `${ou} : ${traitements.size} traitements ${[...traitements].join(' ; ')}`);
          assert.ok(c.pastilles.every((p) => p.casse === 'none'), `${ou} : plus de capitales forcées`);
          assert.equal(c.anciennes, 0, `${ou} : les anciennes étiquettes (.tag/.tm/.tn) ont disparu`);

          // 2. Les compétences : du texte, pas une pastille.
          assert.ok(c.competences.length <= 1, `${ou} : une seule ligne de compétences`);
          for (const k of c.competences) {
            assert.equal(k.fond, 'rgba(0, 0, 0, 0)', `${ou} : la ligne de compétences n'a pas de fond`);
            assert.equal(k.bordure, 0, `${ou} : ni bordure`);
            assert.ok(k.casse === 'none', `${ou} : ni capitales`);
          }

          // 3. Lisibilité.
          for (const e of [...c.pastilles, ...c.competences]) {
            assert.ok(e.taille >= 11, `${ou} : « ${e.texte} » fait ${e.taille} px`);
            assert.ok(e.contraste >= 4.5, `${ou} : « ${e.texte} » contraste ${e.contraste.toFixed(2)}:1`);
          }
          assert.equal(c.debordeX, false, `${ou} : la carte déborde`);

          // 4. L'information : une carte complète garde ses six rubriques.
          const rubriques = c.pastilles.map((p) => p.titre.split(' : ')[0]);
          if (['Localisation', 'Contrat', 'Expérience', 'Salaire', 'Spécialité'].every((r) => rubriques.includes(r))
              && c.competences.length) completes++;
        }
        assert.ok(completes >= 3, `${quoi} : au moins 3 cartes portent les six rubriques (${completes})`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false,
          `${quoi} : défilement horizontal`);
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});

test('T10 — les valeurs sont les mêmes qu\'avant : lieu, contrat, expérience, salaire, spécialité, compétences', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      const { ctx, page } = await ouvrir(surface, aide.FORMATS.bureau, 'jour');
      try {
        const premiere = await page.evaluate((sel) => {
          const c = document.querySelector(sel);
          return {
            pastilles: [...c.querySelectorAll('.card-fact')].map((p) => p.getAttribute('title')),
            competences: [...c.querySelectorAll('.ccomp')].map((k) => ({ texte: k.textContent.trim(), titre: k.getAttribute('title') })),
          };
        }, surface.cartes);
        // Première offre complétée : Paris, CDI, Junior, 45–55 k€/an, Actuariat ; Python, SQL, Excel, Tableau / BI, Power BI, Solvabilité II, IFRS 17.
        assert.deepEqual(premiere.pastilles.slice(0, 4), [
          'Localisation : Paris', 'Contrat : CDI', 'Expérience : Junior', 'Salaire : 45–55 k€/an',
        ].map((t) => t), `${surface.nom} : lieu, contrat, expérience, salaire`);
        assert.ok(premiere.pastilles.some((t) => t === 'Spécialité : Actuariat'), `${surface.nom} : la spécialité`);
        assert.equal(premiere.competences.length, 1);
        const k = premiere.competences[0];
        assert.ok(k.texte.startsWith('Python · SQL · Excel'), `${surface.nom} : trois compétences écrites (${k.texte})`);
        if (surface.nom === 'board') {
          assert.ok(/\+4$/.test(k.texte), `board : le reste est compté (${k.texte})`);
          assert.ok(k.titre.includes('Tableau / BI') && k.titre.includes('IFRS 17'), 'board : le titre donne toutes les compétences');
        } else {
          // L'accueil ne lit que les outils et la réglementation.
          assert.ok(/\+2$/.test(k.texte), `accueil : le reste est compté (${k.texte})`);
          assert.ok(k.titre.includes('IFRS 17'), 'accueil : le titre donne toutes les compétences');
        }
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});

test('T10 — une compétence qui contient du HTML est écrite, pas interprétée', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      const { ctx, page } = await ouvrir(surface, aide.FORMATS.bureau, 'jour', { hostile: true });
      try {
        const r = await page.evaluate((sel) => {
          const k = document.querySelector(sel + ' .ccomp');
          return { texte: k ? k.textContent : '', enfants: k ? k.querySelectorAll('*').length : -1, injecte: !!document.querySelector('[data-injecte]') };
        }, surface.cartes);
        assert.equal(r.enfants, 0, `${surface.nom} : aucune balise dans la ligne de compétences`);
        assert.ok(r.texte.includes('<img data-injecte>'), `${surface.nom} : le texte est affiché tel quel (${r.texte})`);
        assert.equal(r.injecte, false, `${surface.nom} : rien n'a été injecté`);
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});
