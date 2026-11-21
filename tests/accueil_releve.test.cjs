/* ─────────────────────────────────────────────────────────────────────────────
   LE PANNEAU « RELEVÉ DU JOUR » DE L'ACCUEIL (T12)

   Le panneau remplace le bandeau de quatre chiffres (décision D7) et occupe la
   moitié droite du hero. Ce fichier tient ce qui ne doit plus se défaire :

     • le titre n'a plus de mots colorés (décision D5) ;
     • les valeurs viennent de /stats/published, au format français ;
     • la somme des spécialités n'est JAMAIS présentée comme le total : les
       fixtures donnent 51 offres pour 38 classées, et une ligne « Pas encore
       classées » porte les 13 restantes ;
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
  const barres = {};
  document.querySelectorAll('[data-barre]').forEach((el) => {
    barres[el.dataset.barre] = parseFloat(el.style.getPropertyValue('--part'));
  });
  const h1 = document.querySelector('h1');
  return {
    offres: txt('#f-offres'),
    employeurs: txt('#f-employeurs'),
    sources: txt('#f-sources'),
    releve: txt('#f-releve'),
    libelleReleve: txt('#f-releve-texte'),
    etat: txt('#releve-etat'),
    nombres,
    barres,
    enAttente: document.querySelectorAll('.chiffres dt.attente, .releve .n.attente').length,
    h1Texte: h1 ? h1.textContent.trim() : null,
    h1Balises: h1 ? h1.querySelectorAll('*').length : -1,
  };
}

test('T12 — le titre n\'a plus de mot coloré (D5)', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);
      const h1 = await page.evaluate(() => {
        const t = document.querySelector('h1');
        return {
          texte: t.textContent.trim(),
          balises: t.querySelectorAll('*').length,
          couleur: getComputedStyle(t).color,
          couleurCorps: getComputedStyle(document.body).color,
        };
      });
      assert.equal(h1.texte, 'Toutes les offres en actuariat, data et IA en assurance.');
      assert.equal(h1.balises, 0, 'le titre contient encore des balises (<em>, <span>…) de couleur');
      assert.equal(h1.couleur, h1.couleurCorps, 'le titre n\'a pas la couleur du texte principal');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T12 — le panneau montre les valeurs de /stats/published, sans prendre la somme pour le total', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await ouvrirAccueil(page);
      const p = await page.evaluate(lirePanneau);

      assert.equal(p.offres, '51', 'offres en ligne');
      assert.equal(p.employeurs, '7', 'employeurs qui recrutent');
      assert.equal(p.sources, '23', 'sources relevées');
      /* 05:00 UTC le 22 octobre 2026 : 07 h 00 à Paris (heure d'été). */
      assert.equal(p.releve, '07 h 00', 'heure du dernier relevé');
      assert.match(p.libelleReleve, /22 octobre/, 'date du dernier relevé');
      assert.equal(p.enAttente, 0, 'des chiffres sont restés en attente');
      assert.equal(p.etat, 'Mis à jour chaque matin', 'ligne d\'état au repos');

      assert.deepEqual(p.nombres, { actuariat: '21', ia_data: '11', souscription_technique: '6', autres: '13' });

      /* La somme des spécialités (38) est inférieure au total (51) : le total
         affiché reste 51 et l'écart a sa propre ligne. */
      const somme = 21 + 11 + 6;
      assert.ok(somme < 51, 'la fixture doit avoir un écart à montrer');
      assert.notEqual(p.offres, String(somme), 'la somme des spécialités est présentée comme le total');
      assert.equal(Number(p.nombres.autres), 51 - somme, 'la ligne « Pas encore classées » doit porter l\'écart');

      /* Les barres se mesurent sur le total (51), pas sur la somme (38). */
      assert.ok(Math.abs(p.barres.actuariat - 21 / 51) < 0.001, `barre actuariat : ${p.barres.actuariat}`);
      assert.ok(Math.abs(p.barres.autres - 13 / 51) < 0.001, `barre « autres » : ${p.barres.autres}`);

      /* Les identifiants du bandeau d'origine existent toujours. */
      const ids = await page.evaluate(() => ['f-offres', 'f-employeurs', 'f-sources', 'f-releve',
        'f-releve-libelle', 'chiffre-hero'].filter((id) => !document.getElementById(id)));
      assert.deepEqual(ids, [], 'des identifiants du bandeau ont disparu');

      /* Et le texte d'introduction reprend le total. */
      assert.match(await page.locator('#chiffre-hero').innerText(), /^51 offres$/);
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
        const nums = [...document.querySelectorAll('.releve dt, .releve .n')];
        const textes = [...document.querySelectorAll('.releve dd, .releve th, .releve h3, .releve-etat')];
        return {
          nums: nums.map((e) => getComputedStyle(e).fontVariantNumeric),
          capitales: textes.map((e) => getComputedStyle(e).textTransform).filter((t) => t !== 'none'),
          espaces: textes.map((e) => getComputedStyle(e).letterSpacing).filter((s) => s !== 'normal' && parseFloat(s) > 0.5),
          petits: [...document.querySelectorAll('.releve *')]
            .filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
            .map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((px) => px < 12),
        };
      });
      assert.ok(r.nums.length >= 8, 'les nombres du panneau sont introuvables');
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
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const format of [aide.FORMATS.bureau, aide.FORMATS.phone]) {
      const { ctx, page } = await aide.ouvrirPage(format);
      try {
        await page.addInitScript(() => {
          window.__decalages = 0;
          new PerformanceObserver((liste) => {
            for (const e of liste.getEntries()) {
              if (e.hadRecentInput) continue;
              /* Seuls comptent les décalages du hero lui-même. */
              const touche = (e.sources || []).some((s) => s.node && s.node.closest && s.node.closest('.hero'));
              if (touche) window.__decalages += e.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
        const tot = await page.evaluate(() => document.querySelector('.hero').getBoundingClientRect().height);
        await aide.attendre(page, 2000);
        const fin = await page.evaluate(() => ({
          hero: document.querySelector('.hero').getBoundingClientRect().height,
          decalages: window.__decalages,
          offres: document.getElementById('f-offres').textContent.trim(),
        }));
        assert.equal(fin.offres, '51', 'les chiffres ne sont pas arrivés');
        assert.ok(Math.abs(fin.hero - tot) <= 1, `le hero a changé de hauteur : ${tot} → ${fin.hero} px`);
        assert.ok(fin.decalages < 0.01, `décalage de mise en page dans le hero : ${fin.decalages}`);
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
          const cibles = ['.releve-tete h2', '.releve-etat', '.releve dt', '.releve-ligne--vedette dt',
            '.releve dd', '.releve-sous-titre', '.releve th', '.releve .n'];
          for (const sel of cibles) {
            const el = document.querySelector(sel);
            const b = fond(el);
            const c = compose(rgba(getComputedStyle(el).color), b);
            mesures.push({ sel, rapport: Math.round(rapport(c, b) * 100) / 100 });
          }
          /* La barre doit se distinguer de sa piste (3:1, élément graphique). */
          const barre = document.querySelector('.releve-barre');
          const piste = document.querySelector('.releve-piste');
          const rb = rapport(rgba(getComputedStyle(barre).backgroundColor), rgba(getComputedStyle(piste).backgroundColor));
          const mouvement = [...document.querySelectorAll('.releve, .releve *')].filter((e) => {
            const s = getComputedStyle(e);
            return (s.animationName !== 'none') || s.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
          }).length;
          return { mesures, barre: Math.round(rb * 100) / 100, mouvement,
                   theme: document.documentElement.getAttribute('data-theme') };
        });
        if (theme === 'nuit') assert.equal(r.theme, 'nuit', 'le thème nuit n\'est pas appliqué');
        for (const m of r.mesures) assert.ok(m.rapport >= 4.5, `${m.sel} : contraste ${m.rapport}:1 (${theme})`);
        assert.ok(r.barre >= 3, `la barre se distingue mal de sa piste : ${r.barre}:1 (${theme})`);
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
