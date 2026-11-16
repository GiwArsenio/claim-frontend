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
/* Le bureau a sa propre colonne de liste : le titre y est aussi limite a
   deux lignes, depuis la meme regle. */
const BUREAU = { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false };

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

test('M01a — le bureau limite aussi les titres à deux lignes', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(BUREAU);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.jc', { timeout: 20000 });
      await aide.attendre(page, 1200);

      const releve = await page.evaluate(() => {
        const titres = [...document.querySelectorAll('.jc .ctitle')].map((t) => {
          const st = getComputedStyle(t);
          return {
            texte: t.textContent.trim(),
            lignes: t.getBoundingClientRect().height / parseFloat(st.lineHeight),
            retourLigne: st.whiteSpace,
          };
        });
        return {
          titres,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      assert.equal(releve.overflowX, 0, 'défilement horizontal en bureau');
      assert.ok(releve.titres.some((t) => t.lignes > 1.5),
        'aucun titre ne passe à deux lignes en bureau : la règle ne s\'applique pas');
      for (const t of releve.titres) {
        assert.equal(t.retourLigne, 'normal', `titre encore sur une seule ligne : « ${t.texte} »`);
        assert.ok(t.lignes <= 2.05,
          `le titre dépasse deux lignes en bureau (${t.lignes.toFixed(2)}) : « ${t.texte} »`);
      }
    } finally {
      await ctx.close();
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
      const ferme = await page.evaluate(() => {
        const p = document.querySelector('#filtres-panneau');
        return {
          range: getComputedStyle(p).display,
          bouton: getComputedStyle(document.querySelector('#btn-filtres')).display,
          expanded: document.querySelector('#btn-filtres').getAttribute('aria-expanded'),
          badge: document.querySelector('#badge-filtres').hidden,
          visibles: [...p.querySelectorAll('select')].filter((s) => s.getClientRects().length > 0).map((s) => s.id),
          role: p.getAttribute('role'),
        };
      });
      /* En haut de page, la rangée montre deux filtres — pas le panneau. */
      assert.equal(ferme.range, 'flex', 'la rangée de filtres n\'est pas affichée en haut de page');
      assert.deepEqual(ferme.visibles, ['contract-filter', 'specialty-filter'],
        'les deux filtres attendus ne sont pas les seuls visibles en haut de page');
      /* Inline, la rangée reste un groupe de filtres ; c'est à l'ouverture
         qu'elle devient une boîte de dialogue. */
      assert.equal(ferme.role, 'group', 'la rangée inline a perdu son rôle de groupe');
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
        ouvert: document.querySelector('#filtres-panneau').classList.contains('ouvert'),
        role: document.querySelector('#filtres-panneau').getAttribute('role'),
        defilement: getComputedStyle(document.querySelector('.pl')).overflowY,
        voile: document.querySelector('#voile-filtres').hidden,
      }));
      assert.equal(annule.valeur, '', 'Échap n\'a pas annulé le choix');
      assert.equal(annule.cartes, avant, 'Échap a modifié la liste');
      /* Fermer ramène la rangée inline, pas le vide : c'est l'état du haut
         de page, avec ses deux filtres visibles. */
      assert.equal(annule.ouvert, false, 'Échap ne referme pas le panneau');
      assert.equal(annule.panneau, 'flex', 'la rangée inline ne revient pas après la fermeture');
      assert.equal(annule.role, 'group', 'la rangée garde un rôle de dialogue après fermeture');
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
        ouvert: document.querySelector('#filtres-panneau').classList.contains('ouvert'),
        cartes: document.querySelectorAll('.jc').length,
      }));
      assert.equal(applique.valeur, 'cdi', 'la validation n\'a pas gardé le filtre');
      assert.equal(applique.badge, '1', 'le compteur n\'annonce pas le filtre appliqué');
      assert.equal(applique.badgeCache, false);
      assert.equal(applique.ouvert, false, 'le panneau reste ouvert après validation');
      assert.equal(applique.panneau, 'flex', 'la rangée inline ne revient pas après validation');
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
      /* Sur téléphone le bouton « Rechercher » a quitté la barre : la
         recherche part de la touche Entrée du champ. C'est ce geste-là
         qu'on éprouve, pas un bouton qui n'existe plus. */
      await page.fill('#q-input', 'actuaire');
      await aide.avecReponse(page, aide.estListeDuBoard, async () => {
        await page.press('#q-input', 'Enter');
      });
      await aide.attendre(page, 900);

      await page.click('#btn-filtres');
      await aide.attendre(page, 300);
      await page.selectOption('#experience-filter', 'senior');
      await page.fill('#city-input', 'Paris');
      await aide.avecReponse(page, aide.estListeDuBoard, async () => {
        await page.click('.fp-appliquer');
      });
      await aide.attendre(page, 900);

      /* « Réinitialiser » vide ce que le panneau montre — filtres ET
         localisation — et laisse les mots-clés, restés dans la barre. */
      await page.click('#btn-filtres');
      await aide.attendre(page, 300);
      await page.click('.fp-reinit');
      await aide.attendre(page, 200);

      const apres = await page.evaluate(() => ({
        mots: document.querySelector('#q-input').value,
        ville: document.querySelector('#city-input').value,
        experience: document.querySelector('#experience-filter').value,
        cartes: document.querySelectorAll('.jc').length,
      }));

      assert.equal(apres.mots, 'actuaire', 'la réinitialisation a effacé les mots-clés');
      assert.equal(apres.ville, 'Paris',
        'la réinitialisation a vidé une localisation restée dans la barre, hors du panneau');
      assert.equal(apres.experience, '', 'la réinitialisation n\'a pas vidé les filtres');
      assert.ok(apres.cartes > 0, 'la liste a été vidée par la réinitialisation');

      /* On referme avant de continuer : le panneau resté ouvert aurait
         recouvert le bouton Filtres, et le clic suivant serait tombé sur le
         voile. */
      await page.keyboard.press('Escape');
      await aide.attendre(page, 400);

      /* Une fois le bandeau resserré, la localisation est DANS le panneau :
         elle disparaît alors avec les filtres, parce qu'elle est visible. */
      await page.evaluate(() => { document.querySelector('.pl').scrollTop = 500; });
      await aide.attendre(page, 600);
      await page.click('#btn-filtres');
      await aide.attendre(page, 400);
      await page.fill('#city-input', 'Lyon');
      await page.click('.fp-reinit');
      await aide.attendre(page, 200);
      const resserre = await page.evaluate(() => ({
        ville: document.querySelector('#city-input').value,
        dansPanneau: !!document.querySelector('#city-input').closest('#filtres-panneau'),
      }));
      assert.equal(resserre.dansPanneau, true, 'le lieu n\'a pas rejoint le panneau une fois resserré');
      assert.equal(resserre.ville, '', 'la réinitialisation n\'a pas vidé le lieu pourtant visible');
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
      assert.equal(etat.role, 'group', 'la rangée ne retrouve pas son rôle de groupe en bureau');
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

test('M03 — le bloc titre a disparu, la barre complète reste', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      const releve = await page.evaluate(() => {
        const h1 = document.querySelector('#hero h1');
        const sub = document.querySelector('#hero .sub');
        const ville = document.querySelector('#city-input');
        const panneau = document.querySelector('#filtres-panneau');
        const r = (el) => el.getBoundingClientRect();
        return {
          /* Le titre reste dans le document — pour l'indexation et les
             lecteurs d'écran — mais ne doit plus rien occuper à l'écran. */
          titrePresent: !!h1 && !!h1.textContent.trim(),
          titreMasque: h1 ? (r(h1).width <= 2 || r(h1).height <= 2) : true,
          promesse: !!sub,
          hauteurHero: Math.round(r(document.querySelector('#hero')).height),
          /* En haut de page la barre est complète : lieu et bouton présents. */
          lieuDansBarre: !!(ville && ville.closest('.sbar')) && r(ville).height > 10,
          rechercheVisible: getComputedStyle(document.querySelector('.btn-srch')).display !== 'none',
          boutonFiltres: getComputedStyle(document.querySelector('#btn-filtres')).display,
          filtresVisibles: [...panneau.querySelectorAll('select')]
            .filter((s) => s.getClientRects().length > 0).map((s) => s.id),
          premiereCarteTop: Math.round(r(document.querySelector('.jc')).top),
        };
      });

      assert.ok(releve.titrePresent, 'le titre de niveau 1 a été supprimé du document');
      assert.ok(releve.titreMasque, 'le titre est encore visible à l\'écran');
      assert.equal(releve.promesse, false, 'la promesse est encore dans la page');

      assert.ok(releve.lieuDansBarre, 'la localisation n\'est pas dans la barre en haut de page');
      assert.ok(releve.rechercheVisible, 'le bouton Rechercher a disparu de la barre complète');
      assert.notEqual(releve.boutonFiltres, 'none', 'le bouton Filtres est absent');
      assert.deepEqual(releve.filtresVisibles, ['contract-filter', 'specialty-filter'],
        'les deux filtres attendus ne sont pas visibles sous le bouton');

      /* Le bouton et les deux filtres tiennent sur UNE ligne. */
      const rangee = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const b = r('#btn-filtres'), c = r('#contract-filter'), sp = r('#specialty-filter');
        return {
          memeLigne: Math.abs(b.top - c.top) <= 4 && Math.abs(c.top - sp.top) <= 4,
          memeHauteur: Math.abs(b.height - c.height) <= 4,
          dansEcran: sp.right <= window.innerWidth + 1 && b.left >= -1,
        };
      });
      assert.ok(rangee.memeLigne, 'le bouton Filtres et les deux filtres ne sont pas sur la même ligne');
      assert.ok(rangee.memeHauteur, 'les trois boîtes n\'ont pas la même hauteur');
      assert.ok(rangee.dansEcran, 'la rangée sort de l\'écran');

      /* La largeur suit le texte AFFICHÉ, pas l'option la plus longue :
         on choisit cette option, la boîte doit s'élargir, puis revenir. */
      const tailles = await page.evaluate(async () => {
        const sp = document.querySelector('#specialty-filter');
        const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
        const avant = sp.getBoundingClientRect().width;
        sp.value = 'souscription_technique';
        sp.dispatchEvent(new Event('change'));
        await attendre(500);
        const apres = sp.getBoundingClientRect().width;
        sp.value = '';
        sp.dispatchEvent(new Event('change'));
        await attendre(500);
        return { avant, apres, retour: sp.getBoundingClientRect().width };
      });
      assert.ok(tailles.apres > tailles.avant + 20,
        `la boîte ne s'élargit pas avec son texte : ${Math.round(tailles.avant)} → ${Math.round(tailles.apres)}`);
      assert.ok(Math.abs(tailles.retour - tailles.avant) <= 2,
        `la boîte ne revient pas à sa largeur : ${Math.round(tailles.retour)} au lieu de ${Math.round(tailles.avant)}`);
    } finally {
      await ctx.close();
    }

    /* En bureau : même retrait du titre, et le champ de localisation reste
       dans la barre — le panneau n'y existe pas. */
    const bureau = await aide.ouvrirPage(BUREAU);
    try {
      await bureau.page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await bureau.page.waitForSelector('.jc', { timeout: 20000 });
      await aide.attendre(bureau.page, 900);
      const b = await bureau.page.evaluate(() => {
        const h1 = document.querySelector('#hero h1');
        const ville = document.querySelector('#city-input');
        return {
          titreMasque: h1 ? h1.getBoundingClientRect().height <= 2 : true,
          promesse: !!document.querySelector('#hero .sub'),
          villeDansBarre: !!(ville && ville.closest('.sbar')),
          hauteurHero: Math.round(document.querySelector('#hero').getBoundingClientRect().height),
        };
      });
      assert.ok(b.titreMasque, 'le titre est encore visible en bureau');
      assert.equal(b.promesse, false, 'la promesse est encore là en bureau');
      assert.ok(b.villeDansBarre, 'le champ de localisation a quitté la barre de bureau');
      assert.ok(b.hauteurHero <= 160,
        `le bandeau de bureau mesure ${b.hauteurHero} px : le titre n'a pas disparu`);
    } finally {
      await bureau.ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── 3 bis. La barre reste, l'en-tête s'efface ──────────────────────────── */

test('M05 — au défilement, la barre reste et l\'en-tête s\'efface', async () => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await ouvrirBoard(390);
    try {
      const haut = await page.evaluate(() => {
        const barre = document.querySelector('.sbar').getBoundingClientRect();
        const ville = document.querySelector('#city-input');
        return {
          entete: Math.round(document.querySelector('#hd').getBoundingClientRect().height),
          collee: document.body.classList.contains('barre-collee'),
          hauteurHero: Math.round(document.querySelector('#hero').getBoundingClientRect().height),
          villeDansBarre: !!(ville && ville.closest('.sbar')),
          /* La barre est empilée : la localisation est SOUS les mots-clés. */
          villeSousRecherche: ville
            ? Math.round(ville.getBoundingClientRect().top) >
              Math.round(document.querySelector('#q-input').getBoundingClientRect().top)
            : false,
          barre: Math.round(barre.height),
        };
      });
      assert.ok(haut.entete > 0, 'l\'en-tête n\'est pas visible au chargement');
      assert.equal(haut.collee, false, 'la barre est déjà signalée comme collée en haut de page');
      assert.ok(haut.hauteurHero > 150,
        `le bandeau du haut mesure ${haut.hauteurHero} px : la barre complète n'est pas là`);
      assert.ok(haut.villeDansBarre, 'la localisation n\'est pas dans la barre avant défilement');
      assert.ok(haut.villeSousRecherche, 'la localisation n\'est pas empilée sous les mots-clés');

      /* C'est la LISTE qui défile sur ce board, pas le document. */
      await page.evaluate(() => { document.querySelector('.pl').scrollTop = 400; });
      await aide.attendre(page, 500);

      const bas = await page.evaluate(() => ({
        entete: Math.round(document.querySelector('#hd').getBoundingClientRect().height),
        heroTop: Math.round(document.querySelector('#hero').getBoundingClientRect().top),
        heroH: Math.round(document.querySelector('#hero').getBoundingClientRect().height),
        collee: document.body.classList.contains('barre-collee'),
        rechercheVisible: !!document.querySelector('#q-input').getClientRects().length,
      }));
      assert.equal(bas.collee, true, 'le défilement de la liste n\'a pas posé l\'état collé');
      assert.equal(bas.entete, 0, 'l\'en-tête occupe encore la place au défilement');
      assert.equal(bas.heroTop, 0, 'la barre n\'est pas remontée au bord haut de l\'écran');
      assert.ok(bas.heroH >= 55,
        `la barre s'est écrasée à ${bas.heroH} px : la recherche a disparu`);
      assert.ok(bas.rechercheVisible, 'le champ de recherche n\'est plus rendu au défilement');
      const lieu = await page.evaluate(() => {
        const v = document.querySelector('#city-input');
        return { dansPanneau: !!(v && v.closest('#filtres-panneau')) };
      });
      assert.ok(lieu.dansPanneau, 'la localisation n\'a pas rejoint le panneau une fois resserré');

      /* Remonter rend l'en-tête. */
      await page.evaluate(() => { document.querySelector('.pl').scrollTop = 0; });
      await aide.attendre(page, 500);
      const remonte = await page.evaluate(() => ({
        entete: Math.round(document.querySelector('#hd').getBoundingClientRect().height),
        collee: document.body.classList.contains('barre-collee'),
      }));
      assert.ok(remonte.entete > 0, 'l\'en-tête ne revient pas quand on remonte');
      assert.equal(remonte.collee, false, 'l\'état collé reste posé en haut de page');
    } finally {
      await ctx.close();
    }

    /* En bureau, le repli du bandeau reste celui d'avant : il doit encore
       s'effacer au défilement de la liste. */
    const bureau = await aide.ouvrirPage(BUREAU);
    try {
      await bureau.page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await bureau.page.waitForSelector('.jc', { timeout: 20000 });
      await aide.attendre(bureau.page, 900);
      await bureau.page.evaluate(() => { document.querySelector('.pl').scrollTop = 400; });
      await aide.attendre(bureau.page, 700);
      const b = await bureau.page.evaluate(() => ({
        collapsed: document.querySelector('#hero').classList.contains('collapsed'),
        entete: Math.round(document.querySelector('#hd').getBoundingClientRect().height),
      }));
      assert.ok(b.collapsed, 'en bureau, le bandeau ne se replie plus au défilement');
      assert.ok(b.entete > 0, 'l\'en-tête de bureau a disparu au défilement de la liste');
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
