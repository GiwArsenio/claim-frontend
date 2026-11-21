/* ─────────────────────────────────────────────────────────────────────────────
   LES ÉTIQUETTES DES CARTES (T10, décision D8 : cahier des charges du propriétaire)

   Une carte (accueil `.oc`, board `.jc`) se lit en deux lignes :

   LIGNE 1 — les faits : lieu, contrat, expérience, salaire (quand il est publié).
     • ni pastille, ni fond, ni bordure ;
     • UNE icône de 14 px (décorative) par élément, puis le texte (12 px, 600) ;
     • un trait vertical de 1 px entre deux éléments voisins, visible à partir de
       481 px, absent en dessous ; jamais au début, à la fin, ni orphelin.
   LIGNE 2 — en pastilles : la spécialité (fond cyan) puis les compétences (fond
     gris, bordure grise). Trois compétences au plus, puis « +N » dont le titre
     liste les autres.
   Partout : casse normale, texte ≥ 11 px, contraste ≥ 4,5:1, jour et nuit,
   1440 et 390 px, cartes à éléments manquants, aucun défilement horizontal.

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
  const fondDe = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const b = parse(getComputedStyle(e).backgroundColor);
      if (b && b.a > 0.5) return b.c;
    }
    return [255, 255, 255];
  };
  const contraste = (el) => {
    const L1 = lum(parse(getComputedStyle(el).color).c);
    const L2 = lum(fondDe(el));
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  // Valeur résolue d'un jeton : on le pose sur un élément témoin.
  const jeton = (propriete, valeur) => {
    const t = document.createElement('div');
    t.style.cssText = `position:absolute;visibility:hidden;${propriete}:${valeur}`;
    document.body.appendChild(t);
    const r = getComputedStyle(t)[propriete.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    t.remove();
    return r;
  };
  const ref = {
    cyan: jeton('background-color', 'var(--cyan-clair)'),
    gris: jeton('background-color', 'var(--surface-2)'),
    trait: jeton('background-color', 'var(--bord-carte)'),
    bordGris: jeton('border-top-color', 'var(--bord-carte)'),
    rayon: jeton('border-top-left-radius', 'var(--r-s)'),
  };
  const px = (v) => parseFloat(v);

  const cartes = [...document.querySelectorAll(sel)].map((carte) => {
    const cm = carte.querySelector('.cm');
    const cmR = cm.getBoundingClientRect();
    const items = [...cm.children].map((e) => {
      const cs = getComputedStyle(e);
      const av = getComputedStyle(e, '::before');
      const r = e.getBoundingClientRect();
      const svg = e.querySelectorAll('svg');
      const val = e.querySelector('.card-fact-value');
      const vcs = getComputedStyle(val);
      return {
        classe: e.className,
        rubrique: (e.getAttribute('title') || '').split(' : ')[0],
        titre: e.getAttribute('title') || '',
        aria: e.getAttribute('aria-label') || '',
        texte: val.textContent.trim(),
        fond: cs.backgroundColor,
        bordures: ['Top', 'Right', 'Bottom', 'Left'].map((c) => px(cs['border' + c + 'Width'])),
        ombre: cs.boxShadow,
        nbIcones: svg.length,
        iconeL: svg[0] ? svg[0].getBoundingClientRect().width : 0,
        iconeH: svg[0] ? svg[0].getBoundingClientRect().height : 0,
        iconeCachee: svg[0] ? svg[0].getAttribute('aria-hidden') === 'true' : false,
        iconeAvant: svg[0] ? !!(svg[0].compareDocumentPosition(val) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
        taille: px(vcs.fontSize),
        graisse: +vcs.fontWeight,
        contraste: contraste(val),
        trait: {
          affiche: av.content !== 'none' && av.display !== 'none',
          largeur: px(av.width), hauteur: px(av.height), fond: av.backgroundColor, gauche: px(av.left),
        },
        gauche: r.left, haut: r.top, droite: r.right,
        debutDeLigne: Math.abs(r.left - cmR.left) < 1,
        traitX: r.left + px(av.left),
      };
    });
    const pastilles = [...carte.querySelectorAll('.ctags > *')].map((e) => {
      const cs = getComputedStyle(e);
      return {
        classe: e.className,
        texte: e.textContent.trim(),
        titre: e.getAttribute('title') || '',
        aria: e.getAttribute('aria-label') || '',
        fond: cs.backgroundColor,
        bordure: px(cs.borderTopWidth),
        bordureCouleur: cs.borderTopColor,
        rayon: cs.borderTopLeftRadius,
        casse: cs.textTransform,
        taille: px(cs.fontSize),
        contraste: contraste(e),
      };
    });
    return {
      titre: (carte.querySelector('.ctitle') || {}).textContent || '',
      cmOverflow: getComputedStyle(cm).overflow,
      cmGauche: cmR.left,
      items,
      pastilles,
      anciennes: carte.querySelectorAll('.tag, .tm, .tn, .ccomp, .card-fact--loc, .card-fact--spec').length,
      pastillesDansLigne1: cm.querySelectorAll('.etq').length,
      debordeX: carte.scrollWidth > carte.clientWidth + 1,
    };
  });
  return { ref, cartes, debordePage: document.documentElement.scrollWidth > document.documentElement.clientWidth };
}

async function ouvrir(surface, format, theme, options = {}) {
  const { ctx, page } = await aide.ouvrirPage(format, { theme });
  await installerOffresCompletes(page, options);
  await page.goto(aide.BASE + surface.url, { waitUntil: 'domcontentloaded' });
  await aide.attendre(page, 1800);
  await page.evaluate(() => { const b = document.querySelector('#claim-consentement'); if (b) b.remove(); });
  return { ctx, page };
}

const FORMAT_481 = (largeur) => ({ viewport: { width: largeur, height: 900 }, isMobile: false, hasTouch: false });

const CAS = [];
for (const surface of SURFACES) {
  for (const [fn, format] of [['1440', aide.FORMATS.bureau], ['390', aide.FORMATS.phone]]) {
    for (const theme of ['jour', 'nuit']) CAS.push({ surface, fn, format, theme });
  }
}

/** Vérifie les règles de la ligne 1 et de la ligne 2 sur une surface rendue. */
function verifier(quoi, lecture, largeur) {
  const { ref, cartes } = lecture;
  assert.ok(cartes.length >= 4, `${quoi} : il faut des cartes (${cartes.length})`);
  const vu = { sansSalaire: 0, sansCompetences: 0, sansSpecialite: 0, sansLieu: 0, complete: 0, plus: 0, lignesCassees: 0 };

  for (const c of cartes) {
    const ou = `${quoi} « ${c.titre.slice(0, 28)} »`;
    assert.equal(c.anciennes, 0, `${ou} : les anciennes étiquettes ont disparu`);
    assert.equal(c.pastillesDansLigne1, 0, `${ou} : la ligne 1 n'a aucune pastille`);
    assert.equal(c.cmOverflow, 'hidden', `${ou} : la ligne 1 cache le trait du premier élément de chaque ligne`);

    // ── LIGNE 1 : ni fond, ni bordure, une icône par élément ──
    const rubriques = c.items.map((i) => i.rubrique);
    assert.deepEqual(rubriques, ['Localisation', 'Contrat', 'Expérience', 'Salaire'].filter((r) => rubriques.includes(r)),
      `${ou} : ordre lieu, contrat, expérience, salaire (${rubriques})`);
    assert.ok(rubriques.includes('Contrat'), `${ou} : le contrat est toujours là`);
    for (const i of c.items) {
      const t = `${ou} ${i.rubrique}`;
      assert.equal(i.fond, 'rgba(0, 0, 0, 0)', `${t} : pas de fond`);
      assert.deepEqual(i.bordures, [0, 0, 0, 0], `${t} : pas de bordure`);
      assert.equal(i.ombre, 'none', `${t} : pas d'ombre`);
      assert.equal(i.nbIcones, 1, `${t} : une icône`);
      assert.ok(i.iconeL === 14 && i.iconeH === 14, `${t} : icône de 14 px (${i.iconeL}×${i.iconeH})`);
      assert.ok(i.iconeCachee && i.iconeAvant, `${t} : icône décorative, avant le texte`);
      assert.ok(i.titre === i.aria && /^(Localisation|Contrat|Expérience|Salaire) : \S/.test(i.titre), `${t} : nom accessible « ${i.titre} »`);
      assert.equal(i.taille, 12, `${t} : texte de 12 px`);
      assert.equal(i.graisse, 600, `${t} : graisse 600`);
      assert.ok(i.contraste >= 4.5, `${t} : contraste ${i.contraste.toFixed(2)}:1`);
    }

    // ── Séparateurs : ≥ 481 px seulement, jamais orphelins ──
    const avecTrait = largeur >= 481;
    c.items.forEach((i, k) => {
      const t = `${ou} ${i.rubrique}`;
      if (!avecTrait) {
        assert.equal(i.trait.affiche, false, `${t} : pas de trait sous 481 px`);
        return;
      }
      assert.ok(i.trait.affiche && i.trait.largeur === 1 && i.trait.hauteur === 12, `${t} : trait fin de 1×12 px`);
      assert.equal(i.trait.fond, ref.trait, `${t} : trait en --bord-carte`);
      // Le trait est dessiné avant l'élément. S'il est en début de ligne (premier de la
      // carte ou renvoyé à la ligne), il tombe hors de la boîte cachée : invisible.
      const premierDeLigne = k === 0 || i.haut > c.items[k - 1].haut + 1;
      assert.equal(i.debutDeLigne, premierDeLigne, `${t} : début de ligne cohérent`);
      if (premierDeLigne) {
        assert.ok(i.traitX < c.cmGauche, `${t} : trait orphelin visible en début de ligne`);
        if (k > 0) vu.lignesCassees++;
      } else {
        assert.ok(i.traitX >= c.items[k - 1].droite && i.traitX < i.gauche,
          `${t} : le trait est entre l'élément précédent et celui-ci`);
      }
    });
    // Pas de trait après le dernier : rien ne le dessine (le trait appartient à l'élément suivant).

    // ── LIGNE 2 : spécialité cyan, puis compétences grises ──
    const spec = c.pastilles.filter((p) => /etq--spec/.test(p.classe));
    const comp = c.pastilles.filter((p) => /etq--comp/.test(p.classe) && !/etq--plus/.test(p.classe));
    const plus = c.pastilles.filter((p) => /etq--plus/.test(p.classe));
    assert.ok(spec.length <= 1, `${ou} : une seule spécialité`);
    if (spec.length) assert.equal(c.pastilles[0], spec[0], `${ou} : la spécialité vient en premier`);
    assert.ok(comp.length <= 3, `${ou} : trois compétences au plus (${comp.length})`);
    assert.ok(plus.length <= 1 && (!plus.length || c.pastilles[c.pastilles.length - 1] === plus[0]), `${ou} : « +N » en dernier`);
    if (plus.length) {
      assert.equal(comp.length, 3, `${ou} : « +N » seulement après trois compétences`);
      const n = +/^\+(\d+)$/.exec(plus[0].texte)[1];
      const liste = plus[0].titre.replace(/^Autres compétences : /, '').split(', ');
      assert.equal(liste.length, n, `${ou} : « ${plus[0].texte} » = ${liste.length} compétences dans le titre`);
      assert.equal(plus[0].aria, plus[0].titre, `${ou} : « +N » a le même nom accessible`);
      vu.plus++;
    }
    for (const p of c.pastilles) {
      const t = `${ou} « ${p.texte} »`;
      assert.equal(p.casse, 'none', `${t} : casse normale`);
      assert.equal(p.taille, 12, `${t} : 12 px`);
      assert.ok(p.taille >= 11 && p.contraste >= 4.5, `${t} : contraste ${p.contraste.toFixed(2)}:1`);
      assert.equal(p.rayon, ref.rayon, `${t} : rayon = jeton --r-s`);
      assert.equal(p.bordure, 1, `${t} : bordure de 1 px`);
      if (/etq--spec/.test(p.classe)) {
        assert.equal(p.fond, ref.cyan, `${t} : spécialité sur fond cyan`);
      } else {
        assert.equal(p.fond, ref.gris, `${t} : compétence sur fond gris`);
        assert.equal(p.bordureCouleur, ref.bordGris, `${t} : bordure grise`);
      }
    }
    assert.ok(c.pastilles.every((p) => p.fond === ref.cyan || p.fond === ref.gris), `${ou} : deux fonds seulement`);
    assert.equal(c.debordeX, false, `${ou} : la carte déborde`);

    // ── Éléments manquants : rien d'orphelin, rien de vide ──
    if (!rubriques.includes('Salaire')) vu.sansSalaire++;
    if (!rubriques.includes('Localisation')) vu.sansLieu++;
    if (!comp.length) vu.sansCompetences++;
    if (!spec.length) vu.sansSpecialite++;
    if (rubriques.length === 4 && spec.length && comp.length) vu.complete++;
  }
  assert.ok(vu.complete >= 3, `${quoi} : au moins 3 cartes complètes (${vu.complete})`);
  assert.ok(vu.sansSalaire >= 1 && vu.sansLieu >= 1, `${quoi} : cartes sans salaire / sans lieu présentes`);
  assert.ok(vu.sansCompetences >= 1 || cartes.length < 6, `${quoi} : cartes sans compétences présentes`);
  assert.ok(vu.sansSpecialite >= 1, `${quoi} : cartes sans spécialité présentes`);
  assert.ok(vu.plus >= 1, `${quoi} : au moins une carte avec « +N »`);
  assert.equal(lecture.debordePage, false, `${quoi} : défilement horizontal`);
  return vu;
}

test('T10 — ligne 1 sans pastille avec icônes et traits, ligne 2 cyan puis gris : 2 surfaces × 2 largeurs × 2 thèmes', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const { surface, fn, format, theme } of CAS) {
      const quoi = `${surface.nom} ${fn} px ${theme}`;
      const { ctx, page } = await ouvrir(surface, format, theme);
      try {
        verifier(quoi, await page.evaluate(lireCartes, surface.cartes), format.viewport.width);
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});

test('T10 — la frontière des 481 px : trait présent à 481, absent à 480, jamais orphelin quand la ligne passe à la suivante', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      for (const largeur of [480, 481, 520]) {
        const { ctx, page } = await ouvrir(surface, FORMAT_481(largeur), 'jour');
        try {
          const vu = verifier(`${surface.nom} ${largeur} px`, await page.evaluate(lireCartes, surface.cartes), largeur);
          if (surface.nom === 'board' && largeur === 481) {
            assert.ok(vu.lignesCassees >= 1, 'à 481 px, au moins une carte renvoie un élément à la ligne : le cas orphelin est exercé');
          }
        } finally { await ctx.close(); }
      }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});

test('T10 — aucune information retirée : les valeurs de la première carte, et tout ce qui est au-delà de 3 compétences', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      const { ctx, page } = await ouvrir(surface, aide.FORMATS.bureau, 'jour');
      try {
        const { cartes } = await page.evaluate(lireCartes, surface.cartes);
        const c = cartes[0];
        // Offre 0 complétée : Paris, CDI, Junior, 45–55 k€/an, Actuariat.
        assert.deepEqual(c.items.map((i) => i.titre), [
          'Localisation : Paris', 'Contrat : CDI', 'Expérience : Junior', 'Salaire : 45–55 k€/an',
        ], `${surface.nom} : lieu, contrat, expérience, salaire`);
        assert.ok(c.items.every((i) => i.texte === i.titre.split(' : ')[1]), 'le texte affiché est la valeur');
        assert.equal(c.pastilles[0].texte, 'Actuariat', `${surface.nom} : la spécialité`);
        assert.deepEqual(c.pastilles.slice(1, 4).map((p) => p.texte), ['Python', 'SQL', 'Excel'], `${surface.nom} : trois compétences`);
        const plus = c.pastilles[4];
        if (surface.nom === 'board') {
          // Board : outils, données, méthodes, logiciels, réglementation.
          assert.equal(plus.texte, '+4');
          assert.equal(plus.titre, 'Autres compétences : Tableau / BI, Power BI, Solvabilité II, IFRS 17');
        } else {
          // Accueil : outils et réglementation seulement.
          assert.equal(plus.texte, '+2');
          assert.equal(plus.titre, 'Autres compétences : Solvabilité II, IFRS 17');
        }
        // La carte sans lieu : le premier élément est le contrat, pas de vide.
        const sansLieu = cartes.find((x) => !x.items.some((i) => i.rubrique === 'Localisation'));
        assert.ok(sansLieu && sansLieu.items[0].rubrique === 'Contrat', `${surface.nom} : sans lieu, la ligne commence par le contrat`);
        // Exactement trois compétences : pas de « +N ».
        const trois = cartes.find((x) => x.pastilles.filter((p) => /etq--comp/.test(p.classe)).length === 3 && !x.pastilles.some((p) => /plus/.test(p.classe)));
        assert.ok(trois || surface.nom === 'accueil', `${surface.nom} : une carte avec exactement trois compétences n'a pas de « +N »`);
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
          const k = document.querySelector(sel + ' .etq--comp');
          return { texte: k ? k.textContent : '', enfants: k ? k.querySelectorAll('*').length : -1, injecte: !!document.querySelector('[data-injecte]') };
        }, surface.cartes);
        assert.equal(r.enfants, 0, `${surface.nom} : aucune balise dans la pastille`);
        assert.equal(r.texte, '<img data-injecte>', `${surface.nom} : le texte est affiché tel quel (${r.texte})`);
        assert.equal(r.injecte, false, `${surface.nom} : rien n'a été injecté`);
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});
