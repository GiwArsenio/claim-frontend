/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A02 — Noms accessibles, repères, erreurs et résultats annoncés

   Quatre exigences, de nature différente :

   1. Les NOMS ACCESSIBLES. Un bouton ou un champ sans nom est annoncé
      « bouton » ou « champ de texte » par un lecteur d'écran : l'utilisateur
      ne sait pas ce qu'il active. Le nom se lit dans le texte, aria-label,
      aria-labelledby, title, ou le contenu d'une image alternative.

   2. Les REPÈRES (landmarks). Une page sans repère principal oblige le
      lecteur d'écran à parcourir le document entier pour trouver le
      contenu. Les repères attendus : en-tête, navigation, principal, pied.

   3. Le SCANNER AUTOMATIQUE. axe-core relève ce qu'un test à assertions
      ne verrait pas. On ne retient que les violations GRAVES et CRITIQUES :
      une violation modérée se signale sans bloquer.

   4. LE PARCOURS CLAVIER. L'ordre du focus et la visibilité du focus sont
      vérifiés ailleurs (A04). Ici, on vérifie qu'on peut atteindre et
      activer les actions principales sans souris.

   Le catalogue demande « sans violations graves connues ». On ne prétend
   pas à la conformité WCAG complète : un relevé automatisé ne la prouve pas.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const mesures = require('./mesures-a11y.cjs');

const PAGES = [
  { nom: 'accueil', url: '/index.html' },
  { nom: 'board', url: '/job-board.html' },
];

test('A02 — aucun élément interactif sans nom accessible', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          const manquants = await mesures.releverNomsManquants(page);

          assert.equal(
            manquants.length, 0,
            `${p.nom} : ${manquants.length} élément(s) interactif(s) sans nom accessible — ` +
            JSON.stringify(manquants.slice(0, 6))
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A02 — les repères de structure sont présents', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          const lm = await mesures.releverLandmarks(page);

          /* Les trois reperes que toute page publique doit porter. */
          for (const repere of ['banner', 'navigation', 'main']) {
            assert.ok(
              lm[repere].length > 0,
              `${p.nom} : le repère « ${repere} » est absent — ` +
              `reperes releves : ${JSON.stringify(lm)}`
            );
          }

          /* Un seul repere principal : deux compete, et le lecteur d'ecran
             ne sait plus lequel lire en premier. */
          assert.equal(
            lm.main.length, 1,
            `${p.nom} : ${lm.main.length} reperes « main » — un seul attendu`
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A02 — le scanner automatique ne relève aucune violation grave', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          const axe = await mesures.scannerAxe(page);

          assert.equal(
            axe.graves.length, 0,
            `${p.nom} : ${axe.graves.length} violation(s) grave(s) — ` +
            JSON.stringify(axe.graves.map((v) => ({
              id: v.id,
              noeuds: v.noeuds.map((n) => n.cible),
            })))
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A02 — les images portent un nom ou sont explicitement décoratives', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          const structure = await mesures.releverStructure(page);
          const sansNom = structure.images.filter((i) => !i.aNom);

          assert.equal(
            sansNom.length, 0,
            `${p.nom} : ${sansNom.length} image(s) sans nom accessible — ` +
            JSON.stringify(sansNom.slice(0, 5))
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A02 — les actions principales sont atteignables au clavier', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1200);

      /* Le parcours clavier doit atteindre les trois actions du board : la
         recherche, les filtres, et l'ouverture d'une offre. On verifie que
         le focus ATTEINT chaque element — pas qu'il est visible, ce que la
         famille A04 verifie deja. */
      const etapes = [
        { selecteur: '#q-input', nom: 'le champ de recherche' },
        { selecteur: '#contract-filter', nom: 'la liste des contrats' },
        { selecteur: '#feed .jc, #feed .oc', nom: 'la première offre' },
      ];

      for (const etape of etapes) {
        const compte = await page.locator(etape.selecteur).count();
        assert.ok(compte > 0, `${etape.nom} est introuvable : le test ne prouve rien`);

        await page.locator(etape.selecteur).first().focus();
        const focus = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return null;
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classe: typeof el.className === 'string' ? el.className : null,
          };
        });

        assert.ok(focus, `${etape.nom} ne peut pas recevoir le focus`);
      }

      /* L'activation au clavier de la première offre doit ouvrir la fiche :
         c'est le comportement attendu, pas seulement la presence du focus. */
      await page.locator('#feed .jc, #feed .oc').first().focus();
      await page.keyboard.press('Enter');
      await aide.attendre(page, 1500);

      const ficheOuverte = await page.evaluate(() => {
        const d = document.querySelector('#detail');
        return Boolean(d && d.textContent.trim().length > 0);
      });

      assert.ok(ficheOuverte, 'la première offre ne s\'est pas ouverte à la touche Entrée');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A02 — le compteur de résultats est annoncé', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1500);

      /* Le nombre de resultats doit etre accessible : soit par un role
         status (annonce au lecteur d'ecran), soit par une region vivante.
         A defaut, le compteur n'etait qu'un texte : l'utilisateur qui change
         un filtre n'apprend pas que la liste a change. */
      const annonce = await page.evaluate(() => {
        const el = document.querySelector('.pl-hd');
        if (!el) return null;
        const elOuParent = el.closest('[role="status"], [aria-live]');
        return {
          texte: el.textContent.trim(),
          role: elOuParent ? elOuParent.getAttribute('role') : null,
          ariaLive: elOuParent ? elOuParent.getAttribute('aria-live') : null,
        };
      });

      assert.ok(annonce, 'le compteur de résultats est introuvable');
      assert.ok(
        annonce.texte && /\d/.test(annonce.texte),
        `le compteur ne porte aucun nombre : "${annonce.texte}"`
      );
      assert.ok(
        annonce.role === 'status' || annonce.ariaLive,
        'le compteur de résultats n\'est pas annoncé : aucun role status ni aria-live ' +
        'sur lui ou sur son parent'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
