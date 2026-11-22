/* ─────────────────────────────────────────────────────────────────────────────
   LES ÉTIQUETTES DES CARTES (T10, décision D8 : cahier des charges du propriétaire)

   Une carte (accueil `.oc`, board `.jc`) a deux blocs (assets/cartes-lignes.js,
   règles demandées par le propriétaire) :
     • FAITS : 4 éléments au plus par ligne, 2 au moins, 2 lignes au plus. 4 est un
       plafond : si 4 coupent un texte (« Casablanca (M… »), la ligne passe à 3 puis 2
       (mesure faite par `ajuster`, au chargement, à chaque changement de largeur et
       à l'arrivée des polices) ;
     • ÉTIQUETTES : UNE seule ligne, 4 éléments au plus, « +N » compris ; tout le reste
       est dans « +N » (5 étiquettes ou plus → 3 + « +N »). Si les étiquettes coupent
       un texte, on en montre moins et « +N » grandit : jamais de deuxième ligne.

   FAITS : lieu, contrat, expérience, salaire (quand il est publié).
     • ni pastille, ni fond, ni bordure ;
     • UNE icône de 14 px (décorative) par élément, puis le texte (12 px, 600) ;
     • un trait vertical de 1 px entre deux éléments voisins d'une même ligne, à
       TOUTES les largeurs (téléphone compris) ; jamais au début ni à la fin.
   ÉTIQUETTES — en pastilles : la spécialité (fond, bordure et texte teal, comme l'ancienne
     pastille du lieu) puis les compétences (fond gris, bordure grise), puis « +N »
     dont le titre liste les compétences cachées.
   La date ne recouvre jamais une pastille et ne la tronque pas : elle se range à
   droite des pastilles quand elle y tient, sinon dessous.
   Partout : casse normale, texte ≥ 11 px, contraste ≥ 4,5:1, jour et nuit,
   1440 et 390 px, cartes à éléments manquants, aucun défilement horizontal.

   Les fixtures donnent `city` et peu d'étiquettes : les réponses de l'API sont
   complétées au vol (tests/fixtures/offres-completes.cjs).
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const REGLE = require('../assets/cartes-lignes.js');
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
    teal: jeton('background-color', 'var(--teal-clair)'),
    tealBord: jeton('border-top-color', 'var(--teal-bord)'),
    tealTexte: jeton('color', 'var(--teal-texte)'),
    gris: jeton('background-color', 'var(--surface-2)'),
    trait: jeton('background-color', 'var(--bord-carte)'),
    bordGris: jeton('border-top-color', 'var(--bord-carte)'),
    rayon: jeton('border-top-left-radius', 'var(--r-s)'),
  };
  const px = (v) => parseFloat(v);

  const cartes = [...document.querySelectorAll(sel)].map((carte) => {
    const cm = carte.querySelector('.cm');
    const cmR = cm.getBoundingClientRect();
    const lignesFaits = [...cm.querySelectorAll('.cm-l')].map((l) => l.querySelectorAll('.card-fact').length);
    const items = [...cm.querySelectorAll('.card-fact')].map((e, k) => {
      const cs = getComputedStyle(e);
      const av = getComputedStyle(e, '::before');
      const ligne = [...cm.querySelectorAll('.cm-l')].indexOf(e.parentElement);
      const rang = [...e.parentElement.children].indexOf(e);
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
        gauche: r.left, haut: r.top, droite: r.right, ligne, rang,
        tronque: val.scrollWidth > val.clientWidth + 0.5,
        debutDeLigne: Math.abs(r.left - cmR.left) < 1,
        traitX: r.left + px(av.left),
      };
    });
    const lignesPastilles = [...carte.querySelectorAll('.ctags-l')].map((l) => l.querySelectorAll('.etq:not([hidden])').length);
    const cachees = [...carte.querySelectorAll('.ctags .etq[hidden]')].map((e) => e.textContent.trim());
    const dateEl = carte.querySelector('.cdate');
    const dateR = dateEl ? dateEl.getBoundingClientRect() : null;
    const carteR = carte.getBoundingClientRect();
    const pastilles = [...carte.querySelectorAll('.ctags .etq:not([hidden])')].map((e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return {
        tronque: e.scrollWidth > e.clientWidth + 0.5,
        chevauchee: !!(dateR && dateR.width > 0 && r.left < dateR.right && r.right > dateR.left && r.top < dateR.bottom && r.bottom > dateR.top),
        classe: e.className,
        texte: e.textContent.trim(),
        titre: e.getAttribute('title') || '',
        aria: e.getAttribute('aria-label') || '',
        fond: cs.backgroundColor,
        bordure: px(cs.borderTopWidth),
        bordureCouleur: cs.borderTopColor,
        couleur: cs.color,
        icones: e.querySelectorAll('svg').length,
        rayon: cs.borderTopLeftRadius,
        casse: cs.textTransform,
        taille: px(cs.fontSize),
        contraste: contraste(e),
      };
    });
    return {
      titre: (carte.querySelector('.ctitle') || {}).textContent || '',
      lignesFaits,
      lignesPastilles,
      cachees,
      cacheesAffichees: [...carte.querySelectorAll('.ctags .etq[hidden]')].filter((e) => getComputedStyle(e).display !== 'none').length,
      dateDansCarte: !dateR || dateR.width === 0 || (dateR.left >= carteR.left && dateR.right <= carteR.right && dateR.bottom <= carteR.bottom),
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
  const vu = { sansSalaire: 0, sansCompetences: 0, sansSpecialite: 0, sansLieu: 0, complete: 0, plus: 0, traits: 0 };

  for (const c of cartes) {
    const ou = `${quoi} « ${c.titre.slice(0, 28)} »`;
    assert.equal(c.anciennes, 0, `${ou} : les anciennes étiquettes ont disparu`);
    assert.equal(c.pastillesDansLigne1, 0, `${ou} : la ligne 1 n'a aucune pastille`);

    // ── La règle des lignes, pour les deux blocs ──
    const regle = (nom, lignes, total) => {
      for (const n of lignes) {
        assert.ok(n <= 4, `${ou} : ${nom} : une ligne de ${n} éléments (4 au plus)`);
        if (total > 1) assert.ok(n >= 2, `${ou} : ${nom} : une ligne de ${n} élément (2 au moins)`);
      }
      assert.equal(lignes.reduce((a, b) => a + b, 0), total, `${ou} : ${nom} : tous les éléments sont dans une ligne`);
      // Le découpage est celui que la règle calcule pour 4, 3 ou 2 éléments par ligne au plus.
      const permis = [4, 3, 2].filter((m) => REGLE.valable(total, m)).map((m) => String(REGLE.tailles(total, m)));
      assert.ok(total < 2 || permis.includes(String(lignes)), `${ou} : ${nom} : découpage ${lignes} hors de la règle (${permis.join(' | ')})`);
    };
    regle('les faits', c.lignesFaits, c.items.length);
    // Rien ne recouvre ni ne coupe une pastille ; la date reste dans la carte.
    assert.ok(c.dateDansCarte, `${ou} : la date sort de la carte`);
    for (const p of c.pastilles) {
      assert.equal(p.chevauchee, false, `${ou} « ${p.texte} » : recouverte par la date`);
      assert.equal(p.tronque, false, `${ou} « ${p.texte} » : texte coupé`);
    }
    for (const i of c.items) assert.equal(i.tronque, false, `${ou} ${i.rubrique} : texte coupé`);

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

    // ── Séparateurs : à toutes les largeurs, entre deux voisins d'une même ligne seulement ──
    c.items.forEach((i, k) => {
      const t = `${ou} ${i.rubrique}`;
      if (i.rang === 0) {
        // Premier de sa ligne : aucun trait (ni orphelin, ni au début).
        assert.equal(i.trait.affiche, false, `${t} : trait au début d'une ligne`);
        return;
      }
      assert.ok(i.trait.affiche && i.trait.largeur === 1 && i.trait.hauteur === 12, `${t} : trait fin de 1×12 px (${largeur} px)`);
      assert.equal(i.trait.fond, ref.trait, `${t} : trait en --bord-carte`);
      const prec = c.items[k - 1];
      assert.equal(prec.ligne, i.ligne, `${t} : le voisin est sur la même ligne`);
      assert.ok(i.traitX >= prec.droite && i.traitX < i.gauche,
        `${t} : le trait est entre l'élément précédent et celui-ci`);
      vu.traits++;
    });

    // ── LIGNE 2 : spécialité teal, puis compétences grises ──
    const spec = c.pastilles.filter((p) => /etq--spec/.test(p.classe));
    const comp = c.pastilles.filter((p) => /etq--comp/.test(p.classe) && !/etq--plus/.test(p.classe));
    const plus = c.pastilles.filter((p) => /etq--plus/.test(p.classe));
    assert.ok(spec.length <= 1, `${ou} : une seule spécialité`);
    if (spec.length) assert.equal(c.pastilles[0], spec[0], `${ou} : la spécialité vient en premier`);
    assert.ok(plus.length <= 1 && (!plus.length || c.pastilles[c.pastilles.length - 1] === plus[0]), `${ou} : « +N » en dernier`);
    // « +N » : ce qui n'est pas montré, et rien d'autre ; jamais seul sans étiquette ; en dernier.
    assert.equal(c.cacheesAffichees, 0, `${ou} : une étiquette cachée est dessinée`);
    const nVisibles = c.pastilles.length - plus.length;
    const total = nVisibles + c.cachees.length;
    assert.ok(nVisibles <= REGLE.visibles(total) || total === 0, `${ou} : ${nVisibles} étiquettes montrées pour ${total} (au plus ${REGLE.visibles(total)})`);
    if (total > 0) assert.ok(nVisibles >= 1, `${ou} : au moins une étiquette montrée`);
    if (c.cachees.length) {
      assert.equal(plus.length, 1, `${ou} : des étiquettes cachées exigent « +N »`);
      const n = +/^\+(\d+)$/.exec(plus[0].texte)[1];
      assert.equal(n, c.cachees.length, `${ou} : « ${plus[0].texte} » = ${c.cachees.length} étiquettes cachées`);
      assert.equal(plus[0].titre, 'Autres compétences : ' + c.cachees.join(', '), `${ou} : le titre de « +N » liste les cachées`);
      assert.equal(plus[0].aria, plus[0].titre, `${ou} : « +N » a le même nom accessible`);
      vu.plus++;
    } else {
      assert.equal(plus.length, 0, `${ou} : « +N » sans étiquette cachée`);
    }
    for (const p of c.pastilles) {
      const t = `${ou} « ${p.texte} »`;
      assert.equal(p.casse, 'none', `${t} : casse normale`);
      assert.equal(p.taille, 12, `${t} : 12 px`);
      assert.ok(p.taille >= 11 && p.contraste >= 4.5, `${t} : contraste ${p.contraste.toFixed(2)}:1`);
      assert.equal(p.rayon, ref.rayon, `${t} : rayon = jeton --r-s`);
      assert.equal(p.bordure, 1, `${t} : bordure de 1 px`);
      if (/etq--spec/.test(p.classe)) {
        // Exactement l'effet de l'ancienne pastille du lieu (.card-fact--loc) : fond, bordure et texte teal.
        assert.equal(p.fond, ref.teal, `${t} : spécialité sur fond teal`);
        assert.equal(p.bordureCouleur, ref.tealBord, `${t} : bordure teal`);
        assert.equal(p.couleur, ref.tealTexte, `${t} : texte teal`);
        assert.equal(p.icones, 0, `${t} : pas d'icône sur la spécialité`);
      } else {
        assert.equal(p.fond, ref.gris, `${t} : compétence sur fond gris`);
        assert.equal(p.bordureCouleur, ref.bordGris, `${t} : bordure grise`);
      }
    }
    assert.ok(c.pastilles.every((p) => p.fond === ref.teal || p.fond === ref.gris), `${ou} : deux fonds seulement`);
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
  assert.ok(vu.traits >= 3, `${quoi} : des traits entre voisins (${vu.traits})`);
  assert.equal(lecture.debordePage, false, `${quoi} : défilement horizontal`);
  return vu;
}

test('T10 — ligne 1 sans pastille avec icônes et traits, ligne 2 teal puis gris : 2 surfaces × 2 largeurs × 2 thèmes', async () => {
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

test('T10 — la règle des lignes et les traits tiennent à toutes les largeurs, 360 à 1440 px', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      for (const largeur of [360, 480, 481, 768, 1024]) {
        const { ctx, page } = await ouvrir(surface, FORMAT_481(largeur), 'jour');
        try {
          const vu = verifier(`${surface.nom} ${largeur} px`, await page.evaluate(lireCartes, surface.cartes), largeur);
          assert.ok(vu.traits >= 3, `${surface.nom} ${largeur} px : les traits sont aussi là sous 481 px`);
        } finally { await ctx.close(); }
      }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});

test('T10 — aucune information retirée : les valeurs de la première carte, et tout ce qui dépasse 4 étiquettes', async () => {
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
        assert.deepEqual(c.lignesFaits, [4], `${surface.nom} : quatre faits courts, une seule ligne de 4`);
        assert.ok(c.items.every((i) => i.texte === i.titre.split(' : ')[1]), 'le texte affiché est la valeur');
        if (surface.nom === 'board') {
          // Board : spécialité + 7 compétences (outils, données, réglementation) = 8 éléments :
          // 3 affichés + « +5 » ; le titre de « +5 » liste les 5 autres.
          assert.deepEqual(c.pastilles.map((p) => p.texte), ['Actuariat', 'Python', 'SQL', '+5']);
          assert.equal(c.pastilles[3].titre, 'Autres compétences : Excel, Tableau / BI, Power BI, Solvabilité II, IFRS 17');
        } else {
          // Accueil : outils et réglementation seulement = 6 éléments : 3 affichés + « +3 ».
          assert.deepEqual(c.pastilles.map((p) => p.texte), ['Actuariat', 'Python', 'SQL', '+3']);
          assert.equal(c.pastilles[3].titre, 'Autres compétences : Excel, Solvabilité II, IFRS 17');
        }
        assert.deepEqual(c.lignesPastilles, [4], `${surface.nom} : une seule ligne de 4 éléments, « +N » compris`);
        // Une carte à 4 étiquettes (spécialité + 3 compétences) les montre toutes, sans « +N ».
        // Une carte à 5 étiquettes : 3 + « +2 ».
        const cinq = cartes.find((x) => x.cachees.length === 2);
        assert.ok(cinq, `${surface.nom} : une carte avec « +2 »`);
        assert.equal(cinq.pastilles[cinq.pastilles.length - 1].texte, '+2', `${surface.nom} : « +2 »`);
        // La carte sans lieu : le premier élément est le contrat, pas de vide.
        const sansLieu = cartes.find((x) => !x.items.some((i) => i.rubrique === 'Localisation'));
        assert.ok(sansLieu && sansLieu.items[0].rubrique === 'Contrat', `${surface.nom} : sans lieu, la ligne commence par le contrat`);
        // Une carte à deux compétences : spécialité + 2 = 3 étiquettes sur la ligne, pas de « +N ».
        const deux = cartes.find((x) => x.pastilles.filter((p) => /etq--comp/.test(p.classe)).length === 2 && !x.pastilles.some((p) => /plus/.test(p.classe)));
        assert.ok(deux || surface.nom === 'accueil', `${surface.nom} : une carte avec exactement deux compétences n'a pas de « +N »`);
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

test('T10 — 4 par ligne quand ça tient, 2 + 2 quand ça coupe un texte (téléphone, 390 px)', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      const { ctx, page } = await ouvrir(surface, aide.FORMATS.phone, 'jour');
      try {
        const { cartes } = await page.evaluate(lireCartes, surface.cartes);
        // Quatre faits courts (Paris, CDI, Junior, 45–55 k€/an) : une seule ligne de 4.
        assert.deepEqual(cartes[0].lignesFaits, [4], `${surface.nom} : quatre faits courts tiennent sur une ligne`);
        // Quatre faits dont « Casablanca (Maroc) » : 4 coupent un texte, la ligne passe à 2 + 2, rien n'est coupé.
        const long = cartes.find((x) => x.items.length === 4 && x.items[0].titre === 'Localisation : Casablanca (Maroc)');
        assert.ok(long, `${surface.nom} : une carte à quatre faits avec Casablanca (Maroc)`);
        assert.deepEqual(long.lignesFaits, [2, 2], `${surface.nom} : Casablanca (Maroc) et trois autres faits : 2 + 2`);
        assert.ok(long.items.every((i) => !i.tronque), `${surface.nom} : aucun fait coupé`);
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});

test('T10 — la mesure suit la largeur : de 1440 à 390 px, les lignes se refont sans rien couper', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      const { ctx, page } = await ouvrir(surface, aide.FORMATS.bureau, 'jour');
      try {
        await page.setViewportSize({ width: 390, height: 900 });
        await aide.attendre(page, 600);
        const { cartes } = await page.evaluate(lireCartes, surface.cartes);
        const long = cartes.find((x) => x.items.length === 4 && x.items[0].titre === 'Localisation : Casablanca (Maroc)');
        assert.deepEqual(long.lignesFaits, [2, 2], `${surface.nom} : après le passage à 390 px : 2 + 2`);
        assert.ok(long.items.every((i) => !i.tronque), `${surface.nom} : aucun fait coupé après le changement de largeur`);
        // Et dans l'autre sens : retour à 1440 px, les quatre faits courts reprennent une ligne.
        await page.setViewportSize({ width: 1440, height: 900 });
        await aide.attendre(page, 600);
        const retour = (await page.evaluate(lireCartes, surface.cartes)).cartes;
        assert.deepEqual(retour[0].lignesFaits, [4], `${surface.nom} : retour à 1440 px : une ligne de 4`);
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});

test('T10 — noms longs : les étiquettes restent sur UNE ligne, on en montre moins et « +N » grandit', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const surface of SURFACES) {
      const { ctx, page } = await ouvrir(surface, aide.FORMATS.phone, 'jour', { longues: true });
      try {
        const { cartes } = await page.evaluate(lireCartes, surface.cartes);
        const c = cartes[0];
        // Spécialité + 3 compétences (dont deux très longues) = 4 étiquettes : côte à côte, elles coupent un texte.
        const total = c.pastilles.filter((p) => !/etq--plus/.test(p.classe)).length + c.cachees.length;
        assert.equal(total, 4, `${surface.nom} : 4 étiquettes au total`);
        assert.deepEqual(c.lignesPastilles.length, 1, `${surface.nom} : une seule ligne`);
        assert.ok(c.cachees.length >= 1, `${surface.nom} : au moins une étiquette passe dans « +N » (${c.cachees})`);
        assert.ok(c.pastilles.every((p) => !p.tronque), `${surface.nom} : aucune étiquette coupée`);
        assert.equal(c.pastilles[c.pastilles.length - 1].texte, '+' + c.cachees.length, `${surface.nom} : « +N » = les cachées`);
        // Et sur un grand écran, la place revient : plus rien de caché (4 étiquettes tiennent sur une ligne de bureau).
        await page.setViewportSize({ width: 1440, height: 900 });
        await aide.attendre(page, 600);
        const large = (await page.evaluate(lireCartes, surface.cartes)).cartes[0];
        assert.ok(large.cachees.length <= c.cachees.length, `${surface.nom} : plus de place, pas moins d'étiquettes montrées`);
      } finally { await ctx.close(); }
    }
  } finally { await aide.arreterNavigateur(); await aide.arreterServeur(); }
});
