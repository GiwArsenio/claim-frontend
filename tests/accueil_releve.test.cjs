/* ─────────────────────────────────────────────────────────────────────────────
   LE PANNEAU « RELEVÉ DU JOUR » DE L'ACCUEIL (T12)

   Le panneau remplace le bandeau de quatre chiffres (décision D7) et occupe la
   moitié droite du hero : une demi-jauge (total des offres au centre, bande
   découpée par spécialité), deux tuiles, quatre pastilles. Ce fichier tient ce
   qui ne doit plus se défaire :

     • le titre garde ses trois mots en teal (actuariat, data, IA ; la décision
       D5 « H1 sans accent » est annulée par le propriétaire) ;
     • les valeurs viennent de /stats/published, au format français ;
     • la somme des spécialités n'est JAMAIS présentée comme le total : les
       fixtures donnent TOTAL offres pour 38 classées, et une pastille « Pas
       classées » porte les restantes ; la jauge est mesurée sur le total ;
     • chaque pastille a un rond de la couleur de sa part dans la jauge, et
       les pastilles tiennent sur deux lignes à toutes les largeurs ;
     • les chiffres s'alignent (`tabular-nums`) ;
     • en panne : « — » et un message, sans que la page change de hauteur ;
     • bureau : le panneau est à droite du titre ; téléphone : sous la
       recherche, sans défilement horizontal ;
     • contrastes ≥ 4,5:1 en jour et en nuit ; aucun mouvement.

   Les chiffres viennent du serveur de fixtures (tests/serveur-test.cjs).
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const { TOUTES } = require('./fixtures/offres.cjs');

/* Le total vient des fixtures : le serveur de test répond jobs_online = TOUTES.length,
   et d'autres tests y ajoutent des offres. La répartition par spécialité, elle, est fixe
   (21 + 11 + 6 = 38 classées) : l'écart est donc TOTAL - 38. */
const TOTAL = TOUTES.length;
const CLASSEES = 21 + 11 + 6;
const AUTRES = TOTAL - CLASSEES;

async function ouvrirAccueil(page, attente = 1800) {
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await aide.attendre(page, attente);
  await page.evaluate(() => {
    const b = document.querySelector('#claim-consentement');
    if (b) b.remove();
  });
}

/** Lit le panneau tel qu'il est rendu. */
function lirePanneau() {
  const txt = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : null;
  };
  const nombres = {};
  document.querySelectorAll('[data-nombre]').forEach((el) => {
    nombres[el.dataset.nombre] = el.textContent.trim();
  });
  /* La jauge : fin de chaque part, en degrés sur 180 (posée par le script). */
  const arc = document.querySelector('.releve-arc');
  const angles = arc ? ['--a1', '--a2', '--a3'].map((v) => parseFloat(arc.style.getPropertyValue(v))) : [];
  const h1 = document.querySelector('h1');
  return {
    offres: txt('#f-offres'),
    employeurs: txt('#f-employeurs'),
    sources: txt('#f-sources'),
    releve: txt('#f-releve'),
    libelleReleve: txt('#f-releve-texte'),
    etat: txt('#releve-etat'),
    nombres,
    angles,
    texteJauge: arc ? arc.getAttribute('aria-label') : null,
    enAttente: document.querySelectorAll('.chiffres dt.attente, .releve .attente').length,
    h1Texte: h1 ? h1.textContent.trim() : null,
    h1Balises: h1 ? h1.querySelectorAll('*').length : -1,
  };
}

for (const theme of ['jour', 'nuit']) {
  test(`T12 — le titre a ses trois mots en teal, lisibles (${theme})`, async () => {
    await aide.demarrerServeur();
    await aide.demarrerNavigateur();
    try {
      const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, { theme });
      try {
        await ouvrirAccueil(page);
        const h1 = await page.evaluate(() => {
          const rgba = (c) => {
            const m = c.match(/rgba?\(([^)]+)\)/);
            const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
            return { r, g, b, a };
          };
          const lum = ({ r, g, b }) => {
            const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const fond = (el) => {
            for (let e = el; e; e = e.parentElement) {
              const c = rgba(getComputedStyle(e).backgroundColor);
              if (c.a > 0.99) return c;
            }
            return { r: 255, g: 255, b: 255, a: 1 };
          };
          const t = document.querySelector('h1');
          const teal = (() => {
            const i = document.createElement('i');
            i.style.color = 'var(--teal)'; t.appendChild(i);
            const c = getComputedStyle(i).color; i.remove(); return c;
          })();
          const mots = [...t.querySelectorAll('em')].map((e) => {
            const s = getComputedStyle(e);
            const [x, y] = [lum(rgba(s.color)), lum(fond(e))].sort((p, q) => q - p);
            return { texte: e.textContent, couleur: s.color, style: s.fontStyle,
                     rapport: Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100 };
          });
          return { texte: t.textContent.trim(), mots, teal, couleur: getComputedStyle(t).color,
                   theme: document.documentElement.getAttribute('data-theme') };
        });
        if (theme === 'nuit') assert.equal(h1.theme, 'nuit', 'le thème nuit n\'est pas appliqué');
        assert.equal(h1.texte, 'Toutes les offres en actuariat, data et IA en assurance.');
        assert.deepEqual(h1.mots.map((m) => m.texte), ['actuariat', 'data', 'IA']);
        for (const m of h1.mots) {
          assert.equal(m.couleur, h1.teal, `« ${m.texte} » n'est pas en teal (${theme})`);
          assert.equal(m.style, 'normal', `« ${m.texte} » est en italique`);
          assert.ok(m.rapport >= 4.5, `« ${m.texte} » : contraste ${m.rapport}:1 (${theme})`);
        }
        assert.notEqual(h1.couleur, h1.teal, 'le reste du titre ne doit pas être teal');
      } finally {
        await ctx.close();
      }
    } finally {
      await aide.arreterNavigateur();
      await aide.arreterServeur();
    }
  });
}

test('T12 — le panneau montre les valeurs de /stats/published, sans prendre la somme pour le total', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);
      const p = await page.evaluate(lirePanneau);

      assert.equal(p.offres, String(TOTAL), 'offres en ligne');
      assert.equal(p.employeurs, '7', 'employeurs qui recrutent');
      assert.equal(p.sources, '23', 'sources relevées');
      /* 05:00 UTC le 22 octobre 2026 : 07 h 00 à Paris (heure d'été). */
      assert.equal(p.releve, '07 h 00', 'heure du dernier relevé');
      assert.match(p.libelleReleve, /22 octobre/, 'date du dernier relevé');
      assert.equal(p.enAttente, 0, 'des chiffres sont restés en attente');
      assert.equal(p.etat, 'Mis à jour chaque matin', 'ligne d\'état au repos');
      const repos = await page.evaluate(() => ({
        etatVisible: document.querySelector('.releve-etat').getBoundingClientRect().width > 2,
        libelleVisible: document.querySelector('.releve-libelle').getBoundingClientRect().width > 2,
        classes: document.querySelector('.releve').className,
      }));
      assert.equal(repos.etatVisible, false, 'la ligne d\'état est visible alors que tout va bien');
      assert.equal(repos.libelleVisible, true, 'le libellé « offres en ligne » a disparu');
      assert.match(repos.classes, /releve--charge/, 'la jauge n\'est pas passée en mode chargé');
      assert.doesNotMatch(repos.classes, /releve--panne/);

      assert.deepEqual(p.nombres, { actuariat: '21', ia_data: '11', souscription_technique: '6', autres: String(AUTRES) });

      /* La somme des spécialités (38) est inférieure au total : le total affiché reste le total, l'écart a sa propre ligne. */
      const somme = CLASSEES;
      assert.ok(somme < TOTAL, 'la fixture doit avoir un écart à montrer');
      assert.notEqual(p.offres, String(somme), 'la somme des spécialités est présentée comme le total');
      assert.equal(Number(p.nombres.autres), TOTAL - somme, 'la ligne « Pas encore classées » doit porter l\'écart');

      /* La jauge se mesure sur le total, pas sur la somme des spécialités : les
         trois premières parts, puis « autres » jusqu'à 180°. */
      const [a1, a2, a3] = p.angles;
      assert.equal(p.angles.length, 3, 'les angles de la jauge n\'ont pas été posés');
      assert.ok(Math.abs(a1 - 180 * 21 / TOTAL) < 0.05, `part actuariat : ${a1}°`);
      assert.ok(Math.abs((a2 - a1) - 180 * 11 / TOTAL) < 0.05, `part IA / Data : ${a2 - a1}°`);
      assert.ok(Math.abs((a3 - a2) - 180 * 6 / TOTAL) < 0.05, `part souscription : ${a3 - a2}°`);
      assert.ok(Math.abs((180 - a3) - 180 * AUTRES / TOTAL) < 0.05, `part « autres » : ${180 - a3}°`);
      assert.ok(a3 < 180, 'la jauge se ferme sur la somme des spécialités au lieu du total');

      /* Le texte alternatif redit ce que la jauge montre : rien ne tient à la couleur seule. */
      assert.match(p.texteJauge, new RegExp(`actuariat 21, IA / Data 11, souscription 6, pas encore classées ${AUTRES}`));

      /* Les identifiants du bandeau d'origine existent toujours. */
      const ids = await page.evaluate(() => ['f-offres', 'f-employeurs', 'f-sources', 'f-releve',
        'f-releve-libelle', 'chiffre-hero'].filter((id) => !document.getElementById(id)));
      assert.deepEqual(ids, [], 'des identifiants du bandeau ont disparu');

      /* Et le texte d'introduction reprend le total. */
      assert.equal(await page.locator('#chiffre-hero').innerText(), `${TOTAL} offres`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T12 — les chiffres sont à chasse fixe et les libellés en casse normale', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);
      const r = await page.evaluate(() => {
        const nums = [...document.querySelectorAll('.releve dt, .releve .n, .releve #f-offres')];
        const textes = [...document.querySelectorAll('.releve dd, .releve-nom, .releve-libelle, .releve-quand, .releve-etat')];
        return {
          nums: nums.map((e) => getComputedStyle(e).fontVariantNumeric),
          capitales: textes.map((e) => getComputedStyle(e).textTransform).filter((t) => t !== 'none'),
          espaces: textes.map((e) => getComputedStyle(e).letterSpacing).filter((s) => s !== 'normal' && parseFloat(s) > 0.5),
          petits: [...document.querySelectorAll('.releve *')]
            .filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
            .map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((px) => px < 12),
        };
      });
      assert.ok(r.nums.length >= 7, 'les nombres du panneau sont introuvables');
      for (const v of r.nums) assert.match(v, /tabular-nums/, `un nombre n'est pas à chasse fixe : ${v}`);
      assert.deepEqual(r.capitales, [], 'des libellés sont en capitales');
      assert.deepEqual(r.espaces, [], 'des libellés ont des lettres espacées');
      assert.deepEqual(r.petits, [], 'du texte du panneau est sous 12 px');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T12 — bureau : le panneau remplit la droite du hero', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);
      const g = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const h1 = r('.hero h1'), barre = r('.hero .sbar'), sub = r('.hero .sub'), panneau = r('.releve');
        const gauche = Math.max(h1.right, barre.right, sub.right);
        return {
          largeur: window.innerWidth,
          panneauGauche: panneau.left, panneauDroite: panneau.right, panneauHaut: panneau.top,
          h1Droite: h1.right, h1Bas: h1.bottom, gauche,
          deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          ancienBandeau: document.querySelectorAll('.chiffres').length,
        };
      });
      assert.ok(g.panneauGauche >= g.h1Droite, 'le panneau n\'est pas à droite du titre');
      assert.ok(g.panneauHaut < g.h1Bas, 'le panneau n\'est pas à hauteur du titre');
      /* Aucune zone vide de plus de 40 % de la largeur à droite du titre. */
      assert.ok(g.largeur - g.h1Droite - (g.panneauDroite - g.panneauGauche) < 0.4 * g.largeur,
        'le hero garde une zone vide trop large à droite du titre');
      assert.ok(g.panneauGauche - g.gauche < 0.4 * g.largeur, 'trop de vide entre le texte et le panneau');
      assert.ok(g.panneauDroite <= g.largeur, 'le panneau sort de l\'écran');
      assert.equal(g.deborde, false, 'la page déborde horizontalement');
      assert.equal(g.ancienBandeau, 1, 'le panneau doit REMPLACER le bandeau, pas s\'y ajouter');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T12 — téléphone : le panneau passe sous la recherche, sans défilement horizontal', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.phone);
    try {
      await ouvrirAccueil(page);
      const g = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const form = r('.hero .sbar'), filtres = r('.filtres-entrees'), p = r('.releve');
        return {
          largeur: window.innerWidth,
          formBas: form.bottom, filtresBas: filtres.bottom, panneauHaut: p.top,
          panneauGauche: p.left, panneauDroite: p.right,
          deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      assert.ok(g.panneauHaut >= g.formBas, 'le panneau doit venir après la barre de recherche');
      assert.ok(g.panneauHaut >= g.filtresBas, 'le panneau doit venir après les filtres');
      assert.ok(g.panneauGauche >= 0 && g.panneauDroite <= g.largeur + 1, 'le panneau sort de l\'écran');
      assert.equal(g.deborde, false, 'la page déborde horizontalement');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

for (const [nom, format] of [['bureau', aide.FORMATS.bureau], ['téléphone', aide.FORMATS.phone]]) {
  test(`T12 — panne des statistiques (${nom}) : « — », un message, et aucun saut de mise en page`, async () => {
    await aide.demarrerServeur();
    await aide.demarrerNavigateur();
    try {
      /* Référence : la hauteur du hero quand tout va bien. */
      let hauteurNormale;
      {
        const { ctx, page } = await aide.ouvrirPage(format);
        try {
          await ouvrirAccueil(page);
          hauteurNormale = await page.evaluate(() => ({
            hero: document.querySelector('.hero').getBoundingClientRect().height,
            panneau: document.querySelector('.releve').getBoundingClientRect().height,
          }));
        } finally {
          await ctx.close();
        }
      }

      await aide.controler({ statsKO: true });
      const { ctx, page } = await aide.ouvrirPage(format);
      try {
        /* Hauteur au premier rendu, avant toute réponse de l'API… */
        await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
        const tot = await page.evaluate(() => document.querySelector('.hero').getBoundingClientRect().height);
        await aide.attendre(page, 2000);
        const p = await page.evaluate(lirePanneau);
        const apres = await page.evaluate(() => ({
          hero: document.querySelector('.hero').getBoundingClientRect().height,
          panneau: document.querySelector('.releve').getBoundingClientRect().height,
        }));

        for (const cle of ['offres', 'employeurs', 'sources', 'releve']) {
          assert.equal(p[cle], '—', `« ${cle} » doit rester « — » en panne, pas ${p[cle]}`);
        }
        for (const [code, v] of Object.entries(p.nombres)) assert.equal(v, '—', `la ligne ${code} doit rester « — »`);
        assert.equal(p.etat, 'Chiffres momentanément indisponibles');
        const panne = await page.evaluate(() => ({
          classes: document.querySelector('.releve').className,
          etatVisible: document.querySelector('.releve-etat').getBoundingClientRect().width > 2,
          libelleVisible: document.querySelector('.releve-libelle').getBoundingClientRect().width > 2,
        }));
        assert.match(panne.classes, /releve--panne/);
        assert.doesNotMatch(panne.classes, /releve--charge/, 'la jauge montre des parts alors que les chiffres manquent');
        assert.equal(panne.etatVisible, true, 'le message de panne n\'est pas visible');
        assert.equal(panne.libelleVisible, false, 'le libellé et le message de panne se superposent');
        assert.ok(!/failed|error|http|undefined|nan/i.test(JSON.stringify(p)), 'un texte technique est visible');

        assert.ok(Math.abs(apres.hero - tot) <= 1,
          `le hero change de hauteur après la panne : ${tot} → ${apres.hero} px`);
        assert.ok(Math.abs(apres.panneau - hauteurNormale.panneau) <= 1,
          `le panneau n'a pas la même hauteur en panne (${apres.panneau}) et chargé (${hauteurNormale.panneau})`);
        assert.ok(Math.abs(apres.hero - hauteurNormale.hero) <= 1,
          `le hero n'a pas la même hauteur en panne (${apres.hero}) et chargé (${hauteurNormale.hero})`);
      } finally {
        await ctx.close();
      }
    } finally {
      await aide.reinitialiserControle();
      await aide.arreterNavigateur();
      await aide.arreterServeur();
    }
  });
}

test('T12 — au chargement normal, le hero ne bouge pas quand les chiffres arrivent', async () => {
  /* On mesure la position et la hauteur des éléments du hero juste avant et
     bien après l'arrivée des chiffres. Un score de décalage de mise en page
     n'est pas assez précis ici : il attribue au hero toute l'entrée dès qu'un
     seul de ses éléments y participe, donc il compte aussi ce qui bouge plus
     bas dans la page (les cartes d'offres qui arrivent). Le 22/11/2026, c'est
     ainsi qu'un vrai saut de 27,7 px (le sous-titre perdait une ligne, la
     recherche remontait) a été signalé en CI, puis une valeur résiduelle qui
     ne venait pas du hero. */
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const format of [aide.FORMATS.bureau, aide.FORMATS.phone]) {
      const { ctx, page } = await aide.ouvrirPage(format);
      try {
        /* Inter est bloquée : le remplacement de police a son propre test, plus
           bas. Les chiffres sont retardés de 400 ms pour que la première mesure
           tombe sûrement avant leur arrivée, quelle que soit la vitesse de la
           machine (sans cela le test pourrait ne rien comparer). */
        await page.route('**/assets/polices/*.woff2', (r) => r.abort());
        await page.route('**/stats/published*', async (r) => {
          await new Promise((ok) => setTimeout(ok, 400));
          r.fallback();
        });
        await page.addInitScript(() => {
          const SEL = { titre: '.hero h1', sous_titre: '.hero .sub', recherche: '.hero .sbar',
                        filtres: '.hero .filtres-entrees', panneau: '.hero aside' };
          const mesure = () => {
            const m = {};
            for (const [nom, sel] of Object.entries(SEL)) {
              const el = document.querySelector(sel);
              if (!el) return null;
              const r = el.getBoundingClientRect();
              m[nom] = { haut: r.top + window.scrollY, hauteur: r.height };
            }
            return m;
          };
          window.__premiere = null;
          const boucle = () => {
            if (!window.__premiere) window.__premiere = mesure();
            if (!window.__premiere || performance.now() < 3000) requestAnimationFrame(boucle);
          };
          requestAnimationFrame(boucle);
          window.__mesure = mesure;
        });
        await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
        await aide.attendre(page, 2500);
        const r = await page.evaluate(() => ({
          premiere: window.__premiere,
          fin: window.__mesure(),
          offres: document.getElementById('f-offres').textContent.trim(),
          texte: document.getElementById('chiffre-hero').textContent.trim(),
        }));
        assert.equal(r.offres, String(TOTAL), 'les chiffres ne sont pas arrivés');
        assert.ok(r.premiere, 'aucune mesure avant l\'arrivée des chiffres');
        assert.notEqual(r.texte, 'Les offres', 'le sous-titre n\'a pas reçu son chiffre');
        for (const nom of Object.keys(r.premiere)) {
          const d = r.fin[nom].haut - r.premiere[nom].haut;
          const h = r.fin[nom].hauteur - r.premiere[nom].hauteur;
          assert.ok(Math.abs(d) <= 1 && Math.abs(h) <= 1,
            `« ${nom} » a bougé à l'arrivée des chiffres : position ${d.toFixed(1)} px, hauteur ${h.toFixed(1)} px`);
        }
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T12 — le remplacement de la police de secours par Inter décale le hero de moins de 0,1', async () => {
  /* Le remplacement d'une police change un peu les retours à la ligne : un
     décalage résiduel existe (mesuré de 0,0004 à 0,028 selon la largeur, police
     retardée de 1,5 s). Il n'est pas nul, et un seuil à 0,01 serait faux. Ce
     test garde ce décalage sous 0,1, le seuil « bon » des Web Vitals : un
     changement qui le dégraderait franchement serait vu. */
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const format of [aide.FORMATS.bureau, aide.FORMATS.phone]) {
      const { ctx, page } = await aide.ouvrirPage(format);
      try {
        await page.route('**/assets/polices/*.woff2', async (r) => {
          await new Promise((ok) => setTimeout(ok, 800));
          r.fallback();
        });
        await page.addInitScript(() => {
          window.__decalages = 0;
          new PerformanceObserver((liste) => {
            for (const e of liste.getEntries()) {
              if (e.hadRecentInput) continue;
              const touche = (e.sources || []).some((s) => s.node && s.node.closest && s.node.closest('.hero'));
              if (touche) window.__decalages += e.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
        await aide.attendre(page, 2500);
        const fin = await page.evaluate(() => ({
          decalages: window.__decalages,
          inter: document.fonts.check('16px Inter'),
        }));
        assert.ok(fin.inter, 'Inter devrait être arrivée (le test attend 2,5 s, la police est retardée de 0,8 s)');
        assert.ok(fin.decalages < 0.1, `décalage du hero au remplacement de la police : ${fin.decalages}`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

for (const theme of ['jour', 'nuit']) {
  test(`T12 — contrastes du panneau ≥ 4,5:1 (${theme}), aucun mouvement`, async () => {
    await aide.demarrerServeur();
    await aide.demarrerNavigateur();
    try {
      const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, { theme });
      try {
        await ouvrirAccueil(page);
        const r = await page.evaluate(() => {
          const rgba = (c) => {
            const m = c.match(/rgba?\(([^)]+)\)/);
            const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
            return { r, g, b, a };
          };
          const compose = (fg, bg) => ({
            r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a),
            b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
          });
          const lum = ({ r, g, b }) => {
            const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const rapport = (a, b) => {
            const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
            return (x + 0.05) / (y + 0.05);
          };
          /* Le fond réel : on remonte jusqu'à un fond opaque. */
          const fond = (el) => {
            let e = el;
            while (e) {
              const c = rgba(getComputedStyle(e).backgroundColor);
              if (c.a > 0.99) return c;
              e = e.parentElement;
            }
            return { r: 255, g: 255, b: 255, a: 1 };
          };
          const mesures = [];
          const cibles = ['.releve-tete h2', '.releve-quand', '.releve-centre strong', '.releve-libelle',
            '.releve-tuile dt', '.releve-tuile dd', '.releve-nom', '.releve .n'];
          for (const sel of cibles) {
            const el = document.querySelector(sel);
            const b = fond(el);
            const c = compose(rgba(getComputedStyle(el).color), b);
            mesures.push({ sel, rapport: Math.round(rapport(c, b) * 100) / 100 });
          }
          /* Le rond de chaque pastille a EXACTEMENT la couleur de sa part dans la
             jauge : c'est ce qui permet de les associer. On compare avec la
             couleur que la feuille donne à la variable de la part, et on vérifie
             que la jauge la reprend. */
          const lire = (v) => {
            const t = document.createElement('i');
            t.style.cssText = `position:absolute;width:1px;height:1px;background:var(${v})`;
            document.querySelector('.releve').appendChild(t);
            const c = getComputedStyle(t).backgroundColor; t.remove(); return c;
          };
          const ronds = [...document.querySelectorAll('.releve-pt')].map((e) => getComputedStyle(e).backgroundColor);
          const parts = ['--c1', '--c2', '--c3', '--c4'].map(lire);
          const fondJauge = getComputedStyle(document.querySelector('.releve-arc')).backgroundImage;
          const mouvement = [...document.querySelectorAll('.releve, .releve *')].filter((e) => {
            const s = getComputedStyle(e);
            return (s.animationName !== 'none') || s.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
          }).length;
          return { mesures, ronds, parts, jaugeReprendLesParts: parts.every((c) => fondJauge.includes(c)),
                   distinctes: new Set(parts).size, mouvement,
                   theme: document.documentElement.getAttribute('data-theme') };
        });
        if (theme === 'nuit') assert.equal(r.theme, 'nuit', 'le thème nuit n\'est pas appliqué');
        for (const m of r.mesures) assert.ok(m.rapport >= 4.5, `${m.sel} : contraste ${m.rapport}:1 (${theme})`);
        assert.deepEqual(r.ronds, r.parts, `les ronds des pastilles n'ont pas la couleur de leur part (${theme})`);
        assert.equal(r.distinctes, 4, `deux parts de la jauge ont la même couleur (${theme})`);
        assert.ok(r.jaugeReprendLesParts, `la jauge ne reprend pas les couleurs des parts (${theme})`);
        assert.equal(r.mouvement, 0, 'le panneau contient un mouvement (transition ou animation)');
      } finally {
        await ctx.close();
      }
    } finally {
      await aide.arreterNavigateur();
      await aide.arreterServeur();
    }
  });
}

test('T12 — les pastilles des spécialités tiennent sur deux lignes, texte entier, de 350 à 1440 px', async () => {
  /* Deux colonnes, donc deux pastilles par ligne : quelle que soit la largeur,
     jamais trois ou quatre lignes, et jamais un texte coupé. Limite mesurée en CI
     (Chromium 156, polices du runner) le 22/11/2026 : propre dès 340 px après le
     resserrage des marges, mais d'à peine 2 px ; on garantit donc 350 px. Sous
     340 px (très vieux téléphones) du texte est coupé ; on ne le prétend pas. */
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const largeur of [350, 360, 390, 430, 768, 1024, 1180, 1280, 1440]) {
      const mobile = largeur < 768;
      const format = { viewport: { width: largeur, height: 900 }, isMobile: mobile, hasTouch: mobile };
      const { ctx, page } = await aide.ouvrirPage(format);
      try {
        /* Des nombres réalistes (jusqu'à trois chiffres par spécialité) : avec les
           petits nombres des fixtures, les pastilles tiendraient sur deux lignes
           même sans la grille, et le test ne prouverait rien. */
        await page.route('**/stats/published*', (r) => r.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ jobs_online: 1243, companies_hiring: 58, sources_tracked: 61,
            last_collection_at: '2026-11-22T03:04:00Z', generated_at: '2026-11-22T07:30:00+00:00',
            by_specialty: { actuariat: 312, souscription_technique: 140, ia_data: 205 }, classified_jobs: 657 }),
        }));
        await ouvrirAccueil(page);
        const r = await page.evaluate(() => {
          const li = [...document.querySelectorAll('.releve-pastilles li')];
          return {
            nombre: li.length,
            lignes: new Set(li.map((e) => Math.round(e.getBoundingClientRect().top))).size,
            coupees: li.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()),
            petits: li.map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((px) => px < 12),
            deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          };
        });
        assert.equal(r.nombre, 4, `${largeur} px : quatre pastilles attendues`);
        assert.equal(r.lignes, 2, `${largeur} px : les pastilles sont sur ${r.lignes} lignes au lieu de 2`);
        assert.deepEqual(r.coupees, [], `${largeur} px : texte de pastille coupé`);
        assert.deepEqual(r.petits, [], `${largeur} px : texte de pastille sous 12 px`);
        assert.equal(r.deborde, false, `${largeur} px : la page déborde horizontalement`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
