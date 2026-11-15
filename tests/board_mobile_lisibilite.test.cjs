/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE M — Lisibilité et ergonomie du board sur téléphone

   Quatre demandes distinctes, un même écran :

   1. Le TITRE d'une carte tient sur deux lignes. Une seule ligne coupait
      « Stage - Actuaire / Analyste ALM & Allocation Stratégique d'Actifs
      (H/F) » avant le mot qui distingue l'offre ; trois lignes mangeraient
      la liste.

   2. Les FILTRES sont tous atteignables. La rangée défilante en montrait
      deux et demi : les derniers existaient sans qu'on les voie. Le
      panneau les montre tous, et un choix n'est appliqué qu'à la
      validation.

   3. Le BANDEAU se compacte, sans perdre le titre ni la promesse : la
      première offre remonte dans la fenêtre.

   4. Les TITRES DE SECTION de la fiche restent des titres. Les annonces
      AXA portent leurs sections en <h2> : sans règle, le navigateur les
      rendait à 1.5em, plus gros que le titre de l'offre.

   Ce que ces tests ne prouvent pas : un rendu sur un vrai téléphone, la
   police du système, ni le confort de lecture sur la durée. Ils mesurent
   le style calculé et la géométrie, qui sont exacts et déterministes.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const { OFFRE_COMPLETE } = require('./fixtures/offres.cjs');

const LARGEURS = [320, 360, 390, 430];

/* L'annonce AXA qui a motivé le lot 4 : ses sections sont des <h2> en
   capitales, telles que la rédaction de la source les a écrites. */
const DESCRIPTION_H2 = [
  '<h2>VOTRE RÔLE ET VOS MISSIONS</h2>',
  '<p>Dans le cadre de sa campagne de stage, AXA France recrute un chargé d\'études actuarielles (F/H).</p>',
  '<ul><li>Travailler sur l\'optimisation des process d\'inventaire.</li><li>Collaborer avec les équipes.</li></ul>',
  '<h2>VOTRE PROFIL</h2>',
  '<p>Vous êtes étudiant en Master 2 en actuariat.</p>',
  '<h2>POURQUOI NOUS REJOINDRE ?</h2>',
  '<p>Un environnement de travail exigeant et formateur.</p>',
  '<h2>VOTRE ENVIRONNEMENT DE TRAVAIL</h2>',
  '<p>Au sein de l\'équipe Actuariat Vie Collective.</p>',
].join('');

const OFFRE_AVEC_H2 = Object.assign({}, OFFRE_COMPLETE, {
  id: 'offre-sections-h2',
  slug: 'offre-sections-h2',
  title: 'Chargé d\'études actuarielles (F/H) - stage',
  description_html: DESCRIPTION_H2,
  sections: [],
});

/** Ouvre le board à une largeur donnée, puis attend la première carte. */
async function ouvrirBoard(largeur, hauteur = 844) {
  const format = { viewport: { width: largeur, height: hauteur }, isMobile: true, hasTouch: true };
  const { ctx, page } = await aide.ouvrirPage(format);
  await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.jc', { timeout: 20000 });
  await aide.attendre(page, 1200);
  return { ctx, page };
}

/* ── 1. Titres de cartes ────────────────────────────────────────────────── */

test('M01 — un titre de carte tient sur deux lignes au plus', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    for (const largeur of LARGEURS) {
      const { ctx, page } = await ouvrirBoard(largeur);
      try {
        const releve = await page.evaluate(() => {
          const cartes = [...document.querySelectorAll('.jc')];
          return {
            titres: cartes.map((c) => {
              const t = c.querySelector('.ctitle');
              const st = getComputedStyle(t);
              const r = t.getBoundingClientRect();
              return {
                texte: t.textContent.trim(),
                lignes: r.height / parseFloat(st.lineHeight),
                hauteur: r.height,
                interligne: parseFloat(st.lineHeight),
                retourLigne: st.whiteSpace,
              };
            }),
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });

        assert.ok(releve.titres.length > 0, `aucune carte à ${largeur} px`);
        assert.equal(releve.overflowX, 0, `défilement horizontal à ${largeur} px`);

        for (const t of releve.titres) {
          assert.equal(t.retourLigne, 'normal',
            `le titre reste sur une ligne à ${largeur} px : « ${t.texte} »`);
          /* Deux lignes, tolérance d'un pixel d'arrondi. Un titre qui
             déborde passerait à trois : c'est ce qu'on refuse. */
          assert.ok(t.lignes <= 2.05,
            `le titre dépasse deux lignes à ${largeur} px (${t.lignes.toFixed(2)}) : « ${t.texte} »`);
        }

        /* Le texte complet reste dans le lien : la troncature est visuelle,
           pas une chaîne coupée. Un lecteur d'écran lit le titre entier. */
        const titreLong = releve.titres.find((t) => t.texte.length > 45);
        assert.ok(titreLong, 'aucun titre long dans les fixtures : le test ne prouve rien');
        assert.ok(titreLong.texte.length > 45, 'le titre long a été tronqué dans le DOM');
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('M01b — la cible du favori fait la taille d\'un doigt', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      const cible = await page.evaluate(() => {
        const b = document.querySelector('.jc .bel');
        const r = b.getBoundingClientRect();
        return { largeur: Math.round(r.width), hauteur: Math.round(r.height) };
      });
      assert.ok(cible.largeur >= 44 && cible.hauteur >= 44,
        `la cible du favori mesure ${cible.largeur}×${cible.hauteur} px, moins que 44×44`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── 2. Panneau de filtres ──────────────────────────────────────────────── */

test('M02 — le panneau montre tous les filtres, sans en appliquer aucun avant validation', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      /* Fermé : la rangée n'existe plus, le bouton prend sa place. */
      const ferme = await page.evaluate(() => ({
        range: getComputedStyle(document.querySelector('#filtres-panneau')).display,
        bouton: getComputedStyle(document.querySelector('#btn-filtres')).display,
        expanded: document.querySelector('#btn-filtres').getAttribute('aria-expanded'),
        badge: document.querySelector('#badge-filtres').hidden,
      }));
      assert.equal(ferme.range, 'none', 'la rangée de filtres reste affichée sur téléphone');
      assert.notEqual(ferme.bouton, 'none', 'le bouton Filtres est introuvable');
      assert.equal(ferme.expanded, 'false');
      assert.equal(ferme.badge, true, 'le compteur s\'affiche alors qu\'aucun filtre n\'est actif');

      const avant = await page.locator('.jc').count();

      await page.click('#btn-filtres');
      await aide.attendre(page, 400);

      const ouvert = await page.evaluate(() => {
        const p = document.querySelector('#filtres-panneau');
        const selects = [...p.querySelectorAll('select')];
        return {
          display: getComputedStyle(p).display,
          role: p.getAttribute('role'),
          modal: p.getAttribute('aria-modal'),
          nomme: !!p.getAttribute('aria-labelledby'),
          nombre: selects.length,
          tousVisibles: selects.every((s) => s.getClientRects().length > 0),
          tousDansEcran: selects.every((s) => {
            const r = s.getBoundingClientRect();
            return r.left >= 0 && r.right <= window.innerWidth + 1;
          }),
          tousTactiles: selects.every((s) => s.getBoundingClientRect().height >= 44),
          focus: document.activeElement ? document.activeElement.id : '',
          listeFigee: getComputedStyle(document.querySelector('.pl')).overflowY,
        };
      });

      assert.equal(ouvert.display, 'flex', 'le panneau ne s\'ouvre pas');
      assert.equal(ouvert.role, 'dialog', 'le panneau n\'est pas annoncé comme une boîte de dialogue');
      assert.equal(ouvert.modal, 'true');
      assert.ok(ouvert.nomme, 'le panneau n\'a pas de nom accessible');
      assert.equal(ouvert.nombre, 5, 'tous les filtres ne sont pas dans le panneau');
      assert.ok(ouvert.tousVisibles, 'un filtre reste masqué dans le panneau');
      assert.ok(ouvert.tousDansEcran, 'un filtre sort de l\'écran');
      assert.ok(ouvert.tousTactiles, 'un filtre est plus court que 44 px');
      assert.equal(ouvert.focus, 'contract-filter', 'le focus n\'entre pas dans le panneau');
      assert.equal(ouvert.listeFigee, 'hidden', 'la liste continue de défiler derrière le panneau');

      /* Un choix dans le panneau ne déclenche AUCUNE requête : la liste ne
         bouge pas sous le doigt pendant qu'on compose sa recherche. */
      let requetes = 0;
      const compter = (r) => { if (aide.estListeDuBoard(r.url())) requetes += 1; };
      page.on('request', compter);

      await page.selectOption('#contract-filter', 'cdi');
      await aide.attendre(page, 600);
      page.off('request', compter);

      const brouillon = await page.evaluate(() => ({
        cartes: document.querySelectorAll('.jc').length,
        badge: document.querySelector('#badge-filtres').hidden,
        valeur: document.querySelector('#contract-filter').value,
      }));
      assert.equal(requetes, 0, 'le panneau a rechargé la liste avant validation');
      assert.equal(brouillon.cartes, avant, 'la liste a changé avant la validation');
      assert.equal(brouillon.badge, true, 'le compteur annonce un filtre non appliqué');
      assert.equal(brouillon.valeur, 'cdi', 'le choix n\'est pas conservé dans le panneau');

      /* Annuler rend l'état appliqué, sans toucher à la liste. */
      await page.keyboard.press('Escape');
      await aide.attendre(page, 400);
      const annule = await page.evaluate(() => ({
        valeur: document.querySelector('#contract-filter').value,
        cartes: document.querySelectorAll('.jc').length,
        focus: document.activeElement ? document.activeElement.id : '',
        panneau: getComputedStyle(document.querySelector('#filtres-panneau')).display,
        defilement: getComputedStyle(document.querySelector('.pl')).overflowY,
        voile: document.querySelector('#voile-filtres').hidden,
      }));
      assert.equal(annule.valeur, '', 'Échap n\'a pas annulé le choix');
      assert.equal(annule.cartes, avant, 'Échap a modifié la liste');
      assert.equal(annule.panneau, 'none', 'Échap ne ferme pas le panneau');
      assert.equal(annule.focus, 'btn-filtres', 'le focus ne revient pas au bouton Filtres');
      assert.notEqual(annule.defilement, 'hidden', 'la liste reste figée après la fermeture');
      assert.equal(annule.voile, true, 'le voile reste affiché après la fermeture');

      /* Valider applique, une fois, et ferme. */
      await page.click('#btn-filtres');
      await aide.attendre(page, 300);
      await page.selectOption('#contract-filter', 'cdi');
      await aide.attendre(page, 200);

      await aide.avecReponse(page, aide.estListeDuBoard, async () => {
        await page.click('.fp-appliquer');
      });
      await aide.attendre(page, 1200);

      const applique = await page.evaluate(() => ({
        valeur: document.querySelector('#contract-filter').value,
        badge: document.querySelector('#badge-filtres').textContent,
        badgeCache: document.querySelector('#badge-filtres').hidden,
        panneau: getComputedStyle(document.querySelector('#filtres-panneau')).display,
        cartes: document.querySelectorAll('.jc').length,
      }));
      assert.equal(applique.valeur, 'cdi', 'la validation n\'a pas gardé le filtre');
      assert.equal(applique.badge, '1', 'le compteur n\'annonce pas le filtre appliqué');
      assert.equal(applique.badgeCache, false);
      assert.equal(applique.panneau, 'none', 'le panneau reste ouvert après validation');
      assert.ok(applique.cartes > 0 && applique.cartes <= avant, 'la liste filtrée est incohérente');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('M02b — « Réinitialiser » ne vide que les filtres, jamais la recherche', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      await page.fill('#q-input', 'actuaire');
      await aide.avecReponse(page, aide.estListeDuBoard, async () => {
        await page.click('.btn-srch');
      });
      await aide.attendre(page, 900);

      await page.click('#btn-filtres');
      await aide.attendre(page, 300);
      await page.selectOption('#experience-filter', 'senior');
      await page.click('.fp-reinit');
      await aide.attendre(page, 200);

      const apres = await page.evaluate(() => ({
        mots: document.querySelector('#q-input').value,
        ville: document.querySelector('#city-input').value,
        experience: document.querySelector('#experience-filter').value,
        cartes: document.querySelectorAll('.jc').length,
      }));

      assert.equal(apres.mots, 'actuaire', 'la réinitialisation a effacé les mots-clés');
      assert.equal(apres.ville, '', 'la réinitialisation a touché la localisation');
      assert.equal(apres.experience, '', 'la réinitialisation n\'a pas vidé les filtres');
      assert.ok(apres.cartes > 0, 'la liste a été vidée par la réinitialisation');
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('M02c — le panneau ne survit pas au passage en bureau', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      await page.click('#btn-filtres');
      await aide.attendre(page, 300);
      await page.selectOption('#specialty-filter', 'ia_data');
      await aide.attendre(page, 200);

      await page.setViewportSize({ width: 1440, height: 900 });
      await aide.attendre(page, 500);

      const etat = await page.evaluate(() => ({
        ouvert: document.querySelector('#filtres-panneau').classList.contains('ouvert'),
        role: document.querySelector('#filtres-panneau').getAttribute('role'),
        valeur: document.querySelector('#specialty-filter').value,
        range: getComputedStyle(document.querySelector('#filtres-panneau')).display,
        bouton: getComputedStyle(document.querySelector('#btn-filtres')).display,
      }));

      assert.equal(etat.ouvert, false, 'le panneau reste ouvert en passant en bureau');
      assert.equal(etat.role, null, 'le rôle de dialogue reste posé en bureau');
      assert.equal(etat.valeur, '', 'le brouillon non validé a été conservé');
      assert.notEqual(etat.range, 'none', 'la rangée de filtres de bureau a disparu');
      assert.equal(etat.bouton, 'none', 'le bouton mobile reste affiché en bureau');
      assert.deepEqual(page.erreurs, [], `erreurs JavaScript : ${page.erreurs.join(' | ')}`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── 3. Bandeau compact ─────────────────────────────────────────────────── */

test('M03 — le bandeau compacte le titre sans le perdre', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      const releve = await page.evaluate(() => {
        const h1 = document.querySelector('#hero h1');
        const sub = document.querySelector('#hero .sub');
        const premiere = document.querySelector('.jc');
        const r = (el) => el.getBoundingClientRect();
        return {
          titreVide: !h1 || !h1.textContent.trim(),
          titreVisible: r(h1).height > 0,
          tailleTitre: parseFloat(getComputedStyle(h1).fontSize),
          taillePromesse: parseFloat(getComputedStyle(sub).fontSize),
          promesseVide: !sub || !sub.textContent.trim(),
          blocTitrePromesse: Math.round(r(sub).bottom - r(h1).top),
          premiereCarteTop: Math.round(r(premiere).top),
          premiereCarteBas: Math.round(r(premiere).bottom),
          fenetre: window.innerHeight,
        };
      });

      assert.equal(releve.titreVide, false, 'le titre de la page a disparu');
      assert.equal(releve.promesseVide, false, 'la promesse a disparu');
      assert.ok(releve.titreVisible, 'le titre n\'est pas rendu');
      assert.ok(releve.tailleTitre >= 15,
        `le titre tombe à ${releve.tailleTitre} px : la hiérarchie ne tient plus`);
      assert.ok(releve.tailleTitre > releve.taillePromesse,
        'le titre n\'est plus plus grand que la promesse');

      /* Le bloc mesuré valait 95 px avant le chantier. Vingt pour cent de
         moins : 76 px. La borne est explicite pour qu'une dérive se voie. */
      assert.ok(releve.blocTitrePromesse <= 78,
        `le bloc titre + promesse mesure ${releve.blocTitrePromesse} px, au-delà de 78`);

      assert.ok(releve.premiereCarteBas <= releve.fenetre,
        'la première offre n\'est pas entièrement visible au chargement');
    } finally {
      await ctx.close();
    }

    /* Le bureau garde son échelle : la compaction est mobile seulement. */
    const bureau = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await bureau.page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await bureau.page.waitForSelector('.jc', { timeout: 20000 });
      await aide.attendre(bureau.page, 900);
      const taille = await bureau.page.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector('#hero h1')).fontSize));
      assert.ok(taille >= 20, `le titre de bureau est descendu à ${taille} px`);
    } finally {
      await bureau.ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── 4. Titres de section de la fiche ───────────────────────────────────── */

test('M04 — les titres de section de la fiche restent des titres', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      /* L'annonce est dessinée directement : c'est le RENDU des titres de
         section qui est jugé ici, pas le transport. Passer par le réseau
         aurait mêlé deux causes de panne au même test — et le garde réseau
         du harnais intercepte avant toute route ajoutée après lui. */
      await page.evaluate((offre) => {
        dessinerDetail(offre, false);
        openDetail();
      }, OFFRE_AVEC_H2);
      await page.waitForSelector('.desc-source h2', { timeout: 10000 });
      await aide.attendre(page, 400);

      const releve = await page.evaluate(() => {
        const titres = [...document.querySelectorAll('.desc-source h2')];
        const offre = document.querySelector('.dtitle');
        return {
          nombre: titres.length,
          balises: titres.map((t) => t.tagName),
          textes: titres.map((t) => t.textContent.trim()),
          tailles: titres.map((t) => parseFloat(getComputedStyle(t).fontSize)),
          hauteurs: titres.map((t) => Math.round(t.getBoundingClientRect().height)),
          interlignes: titres.map((t) => parseFloat(getComputedStyle(t).lineHeight)),
          tailleOffre: offre ? parseFloat(getComputedStyle(offre).fontSize) : null,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      assert.equal(releve.nombre, 4, 'les quatre sections de l\'annonce ne sont pas rendues');
      assert.ok(releve.balises.every((b) => b === 'H2'),
        'une section a perdu sa balise de titre');
      assert.deepEqual(releve.textes, [
        'VOTRE RÔLE ET VOS MISSIONS',
        'VOTRE PROFIL',
        'POURQUOI NOUS REJOINDRE ?',
        'VOTRE ENVIRONNEMENT DE TRAVAIL',
      ], 'le texte des sections a été réécrit');
      assert.equal(releve.overflowX, 0, 'défilement horizontal dans la fiche');

      for (const taille of releve.tailles) {
        /* 17 px : la taille d'une section, pas celle d'un titre de page.
           Sans règle, le navigateur rendait ces <h2> à 24 px. */
        assert.ok(taille <= 17.5,
          `un titre de section mesure ${taille} px : il concurrence le titre de l'offre`);
      }

      assert.ok(releve.tailleOffre > Math.max(...releve.tailles),
        'le titre de l\'offre n\'est plus plus grand que ses sections');

      /* La première section tenait sur deux lignes avant le chantier. */
      assert.ok(releve.hauteurs[0] <= releve.interlignes[0] * 1.3,
        `« ${releve.textes[0]} » occupe encore ${releve.hauteurs[0]} px`);
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
