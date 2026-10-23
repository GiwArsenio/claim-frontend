/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLES P04 à P06 — Fiche, position de lecture, candidature et partage

   Ces parcours eprouvent ce que l'utilisateur vit reellement :

   - P04 : la fiche s'ouvre immediatement, puis s'enrichit. Deux selections
     successives ne doivent pas se melanger : si A est selectionne, puis B,
     et que A repond tardivement, c'est B qui doit rester affiche.
   - P05 : la position de lecture est conservee. Sur mobile, la fiche
     s'ouvre depuis le haut, et la fermeture rend la liste.
   - P06 : « Postuler » mene a la source. Le partage passe par la feuille
     systeme, se replie sur la copie, et se replie encore si le presse-
     papier est refuse.

   Le serveur de test permet de retarder une reponse de detail pour
   eprouver la concurrence, et de faire tomber le backend pour eprouver la
   panne. Rien n'est simule cote navigateur : on agit, on observe.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

/* ── P04 — La fiche ─────────────────────────────────────────────────────── */

test('P04 — la fiche affiche un texte lisible avant même la réponse complète', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      /* La reponse de detail est retardee : l'utilisateur ne doit pas
         rester devant un ecran vide. */
      await aide.controler({ delaisDetail: { 'syn-1': 3000 } });

      await page.locator('#feed .jc, #feed .oc').first().click();
      await page.waitForTimeout(600);

      const etat = await page.evaluate(() => {
        const d = document.querySelector('#detail');
        return {
          texte: d ? d.textContent.trim() : '',
          chargement: (d ? d.textContent : '').includes('Chargement du détail'),
        };
      });

      assert.ok(
        etat.texte.length > 0,
        'la fiche est vide pendant que la reponse arrive'
      );
      assert.ok(
        etat.texte.length > 60,
        `la fiche ne montre presque rien pendant le chargement : "${etat.texte.slice(0, 60)}"`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P04 — une réponse tardive ne remplace pas la sélection courante', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      /* La premiere offre repond tardivement, la seconde tout de suite. */
      await aide.controler({ delaisDetail: { 'syn-1': 4000 } });

      const cartes = page.locator('#feed .jc, #feed .oc');
      const identifiants = await aide.identifiantsAffiches(page);

      /* Selection A : l'offre a reponse lente. */
      await cartes.nth(0).click();
      await page.waitForTimeout(400);

      /* Selection B : l'offre a reponse rapide. */
      await cartes.nth(1).click();
      await page.waitForTimeout(2500);

      const titreAffiche = await aide.titreFiche(page);
      const titreAttendu = await page.evaluate((id) => {
        const el = document.querySelector(`[data-id="${id}"] .ctitle`);
        return el ? el.textContent.trim() : null;
      }, identifiants[1]);

      assert.ok(
        titreAttendu,
        'impossible de retrouver le titre de la deuxieme offre : le test ne prouve rien'
      );
      assert.ok(
        titreAffiche.includes(titreAttendu.slice(0, 20)),
        `la fiche affiche « ${titreAffiche} » au lieu de la deuxieme offre « ${titreAttendu} » — ` +
        `une reponse tardive a ecrase la selection courante`
      );

      /* On attend que la reponse lente arrive : elle ne doit toujours pas
         ecraser la selection. */
      await page.waitForTimeout(3000);
      const titreFinal = await aide.titreFiche(page);
      assert.ok(
        titreFinal.includes(titreAttendu.slice(0, 20)),
        `la reponse tardive a remplace la fiche affichee : « ${titreFinal} » au lieu de « ${titreAttendu} »`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P04 — le préchargement ne double pas l\'appel ni l\'affichage', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      const appels = [];
      page.on('request', (r) => {
        if (aide.estDetailDuBoard(r.url())) appels.push(r.url());
      });

      /* Le survol declenche un prechargement, puis le clic ouvre la fiche. */
      await page.locator('#feed .jc, #feed .oc').nth(2).hover();
      await page.waitForTimeout(400);
      await page.locator('#feed .jc, #feed .oc').nth(2).click();
      await aide.attendre(page, 1500);

      /* Le prechargement et l'ouverture doivent sharing la meme reponse :
         une offre ne doit pas etre demandee deux fois. */
      const parOffre = {};
      for (const url of appels) {
        const id = decodeURIComponent(url.split('/jobs/')[1]);
        parOffre[id] = (parOffre[id] || 0) + 1;
      }
      const repetes = Object.entries(parOffre).filter(([, n]) => n > 1);

      assert.equal(
        repetes.length, 0,
        `le prechargement a demande la meme offre plusieurs fois : ${JSON.stringify(repetes)}`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── P05 — Position de lecture et mobile ─────────────────────────────────── */

test('P05 — la position de lecture de la liste est conservée', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      /* On descend dans la liste. */
      await page.evaluate(() => {
        const pl = document.querySelector('.pl');
        if (pl) pl.scrollTop = 600;
      });
      await page.waitForTimeout(400);

      const avant = await page.evaluate(() => {
        const pl = document.querySelector('.pl');
        return pl ? pl.scrollTop : 0;
      });
      assert.ok(avant > 100, `la liste n'a pas defile : ${avant}px`);

      /* On ouvre une fiche : la position de la liste ne doit pas sauter.

         On vise une carte VISIBLE dans la colonne. Playwright fait defiler
         l'element avant de cliquer : viser une carte hors champ
         mesurerait le defilement de l'outil, et non la position de lecture
         du site. C'est le cas d'un vrai utilisateur : il clique ce qu'il
         voit. */
      const indexVisible = await page.evaluate(() => {
        const pl = document.querySelector('.pl');
        const zone = pl.getBoundingClientRect();
        const cartes = Array.from(document.querySelectorAll('#feed .jc, #feed .oc'));
        for (let i = 0; i < cartes.length; i++) {
          const r = cartes[i].getBoundingClientRect();
          if (r.top >= zone.top + 10 && r.bottom <= zone.bottom - 10) return i;
        }
        return -1;
      });
      assert.ok(indexVisible >= 0, 'aucune carte visible dans la colonne');

      await page.locator('#feed .jc, #feed .oc').nth(indexVisible).click();
      await aide.attendre(page, 2000);

      const apres = await page.evaluate(() => {
        const pl = document.querySelector('.pl');
        return pl ? pl.scrollTop : 0;
      });

      assert.ok(
        apres > 100,
        `la position de lecture de la liste a ete perdue : ${avant}px avant, ${apres}px apres`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P05 — sur mobile, la fiche s\'ouvre depuis le haut', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.phone);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      /* Avant l'ouverture, la fiche est hors de l'ecran. */
      await page.locator('#feed .jc, #feed .oc').nth(1).click();
      await aide.attendre(page, 1800);

      const etat = await page.evaluate(() => {
        const pr = document.querySelector('#pr');
        const st = pr ? getComputedStyle(pr) : null;
        return {
          ouvert: document.body.classList.contains('detail-view'),
          left: pr ? Math.round(pr.getBoundingClientRect().left) : null,
          width: pr ? Math.round(pr.getBoundingClientRect().width) : null,
          viewport: document.documentElement.clientWidth,
          transform: st ? st.transform : null,
          scrollTop: pr ? pr.scrollTop : null,
        };
      });

      assert.ok(etat.ouvert, 'le mode fiche n\'est pas active sur mobile');

      /* La fiche doit couvrir l'ecran, ou y etre posee. Elle ne doit pas
         etre a moitie hors de l'ecran : l'utilisateur verrait une fiche
         cassee. */
      assert.ok(
        etat.left === null || etat.left < 40,
        `la fiche s'ouvre a ${etat.left}px de bord : elle n'est pas en place`
      );
      assert.ok(
        etat.width === null || etat.width >= etat.viewport - 40,
        `la fiche ne couvre que ${etat.width}px sur ${etat.viewport}px`
      );
      assert.ok(
        etat.scrollTop === null || etat.scrollTop < 5,
        `la fiche s'ouvre a ${etat.scrollTop}px de defilement : elle doit partir du haut`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P05 — la fermeture de la fiche rend la liste, sans écran vide', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.phone);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await page.locator('#feed .jc, #feed .oc').nth(1).click();
      await aide.attendre(page, 1800);

      /* Le bouton de retour est present dans la fiche mobile. */
      const retour = page.locator('#detail .btn-back').first();
      assert.ok(await retour.count() > 0, 'le bouton de retour est absent de la fiche');

      await retour.click();
      await aide.attendre(page, 1200);

      const etat = await page.evaluate(() => {
        const pr = document.querySelector('#pr');
        const pl = document.querySelector('.pl');
        return {
          ouvert: document.body.classList.contains('detail-view'),
          hauteurListe: pl ? Math.round(pl.getBoundingClientRect().height) : 0,
          hauteurFiche: pr ? Math.round(pr.getBoundingClientRect().height) : 0,
          cartes: document.querySelectorAll('#feed .jc, #feed .oc').length,
        };
      });

      assert.equal(etat.ouvert, false, 'la fiche est restee ouverte apres le retour');
      assert.ok(
        etat.hauteurListe > 100,
        `la liste est redevenue invisible apres le retour : ${etat.hauteurListe}px — l'écran est vide`
      );
      assert.ok(
        etat.cartes > 0,
        'la liste a disparu apres le retour : plus aucune offre'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── P06 — Candidature, partage et historique ───────────────────────────── */

test('P06 — « Postuler » mène à la source de l\'offre', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await page.locator('#feed .jc, #feed .oc').first().click();
      await aide.attendre(page, 1800);

      const lien = page.locator('#detail a.bap').first();
      assert.ok(await lien.count() > 0, 'le bouton « Postuler » est absent de la fiche');

      const href = await lien.getAttribute('href');
      const cible = await lien.getAttribute('target');

      assert.ok(
        /^https?:\/\//.test(href || ''),
        `« Postuler » ne mène pas à une URL absolue : "${href}"`
      );
      assert.equal(cible, '_blank', '« Postuler » ne s\'ouvre pas dans un nouvel onglet');
      assert.ok(
        /noopener/.test((await lien.getAttribute('rel')) || ''),
        '« Postuler » n\'a pas noopener : la page cible peut lire l\'origine'
      );

      /* Le lien doit mener a la source de l'OFFRE affichee, pas a une
         source generique. */
      const sourceAttendue = await page.evaluate(() => {
        const id = document.querySelector('#feed .jc.on, #feed .oc.on');
        return id ? id.getAttribute('data-id') : null;
      });
      assert.ok(sourceAttendue, 'aucune offre selectionnee dans la liste');

      const slug = await page.evaluate(async (id) => {
        const r = await fetch(`/api/v1/jobs/${id}`);
        const d = await r.json();
        return d.source_url;
      }, sourceAttendue);

      assert.equal(
        href, slug,
        '« Postuler » ne mène pas à la source de l\'offre affichee'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P06 — le partage natif est utilisé quand le système le propose', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      /* Le partage natif est appele et enregistre. */
      await page.addInitScript(() => {
        window.__partages = [];
        navigator.share = async (d) => { window.__partages.push(d); };
      });

      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await page.locator('#feed .jc, #feed .oc').first().click();
      await aide.attendre(page, 1800);

      await page.locator('#detail button.bsh').first().click();
      await page.waitForTimeout(900);

      const partages = await page.evaluate(() => window.__partages || []);
      assert.equal(partages.length, 1, `la feuille de partage systeme n'a pas ete appelee : ${partages.length} appel(s)`);
      assert.ok(
        partages[0].url && partages[0].url.includes('/offre/'),
        `le partage ne propose pas le lien de l'offre : "${partages[0].url}"`
      );
      assert.ok(
        partages[0].title && partages[0].title.length > 3,
        'le partage ne propose pas de titre d\'offre'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P06 — un partage annulé retombe sur la copie du lien', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      /* Le partage systeme est refuse : la copie doit prendre le relais. */
      await page.addInitScript(() => {
        window.__copie = null;
        navigator.share = async () => { throw new Error('annule'); };
        navigator.clipboard.writeText = async (t) => { window.__copie = t; };
      });

      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await page.locator('#feed .jc, #feed .oc').first().click();
      await aide.attendre(page, 1800);

      await page.locator('#detail button.bsh').first().click();
      await page.waitForTimeout(900);

      const copie = await page.evaluate(() => window.__copie);
      assert.ok(
        copie && copie.includes('/offre/'),
        `le partage annulé n'a pas repris par la copie du lien : "${copie}"`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P06 — un presse-papiers refusé ne laisse pas l\'utilisateur sans rien', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      /* Ni partage systeme, ni presse-papiers : il reste la fenetre de
         saisie. L'utilisateur doit toujours pouvoir recuperer le lien. */
      await page.addInitScript(() => {
        delete navigator.share;
        navigator.clipboard.writeText = async () => { throw new Error('refuse'); };
        window.__prompt = null;
        window.prompt = (m, v) => { window.__prompt = v; return v; };
      });

      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await page.locator('#feed .jc, #feed .oc').first().click();
      await aide.attendre(page, 1800);

      await page.locator('#detail button.bsh').first().click();
      await page.waitForTimeout(900);

      const lien = await page.evaluate(() => window.__prompt);
      assert.ok(
        lien && lien.includes('/offre/'),
        `aucun moyen de recuperer le lien : "${lien}"`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P06 — l\'adresse suit l\'offre, et le retour navigateur referme la fiche', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await page.locator('#feed .jc, #feed .oc').first().click();
      await aide.attendre(page, 1800);

      /* L'adresse doit permettre de partager l'offre affichee. */
      assert.ok(
        /\/offre\/[^/]+$/.test(page.url()),
        `l'adresse ne suit pas l'offre : ${page.url()}`
      );

      /* Le retour navigateur referme la fiche : sans cela, l'ecran et
         l'adresse divergeraient. */
      await page.goBack();
      await page.waitForTimeout(1200);

      const etat = await page.evaluate(() => ({
        ouvert: document.body.classList.contains('detail-view'),
        detailVide: (document.querySelector('#detail') || {}).textContent?.trim() === '',
      }));
      assert.equal(etat.ouvert, false, 'le retour navigateur n\'a pas referme la fiche');

      /* Et l'historique doit permettre de revenir a la fiche. */
      await page.goForward();
      await page.waitForTimeout(1200);

      const url = page.url();
      assert.ok(
        /\/offre\/[^/]+$/.test(url),
        `l'avance dans l'historique n'a pas rouvert la fiche : ${url}`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P06 — un lien profond ouvre la bonne fiche', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      /* Le lien profond est celui que l'on partage. Il ouvre la FICHE
         AUTONOME — la page que les moteurs de recherche indexent — et non
         le board. C'est la difference entre l'adresse partagee et
         l'adresse de navigation. */
      await page.goto(aide.BASE + '/offre/actuaire-confirme-risques-non-vie', {
        waitUntil: 'domcontentloaded',
      });
      await aide.attendre(page, 2500);

      const page_ = await page.evaluate(() => ({
        titre: document.title,
        h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent.trim()),
        description: (document.body.innerText || '').includes('direction actuarie'),
      }));

      assert.ok(
        page_.h1.some((t) => t.includes('Actuaire confirmé')),
        `le lien profond n'a pas ouvert la bonne fiche : ${JSON.stringify(page_.h1)}`
      );
      assert.ok(
        page_.titre.includes('Actuaire confirmé'),
        `le titre de la page ne nomme pas l'offre : "${page_.titre}"`
      );
      assert.ok(
        page_.description,
        'la fiche autonome ne montre pas la description de l\'offre'
      );

      /* La fiche autonome renvoie a l'Annonce d'origine : la candidature
         passe par la source, et la page n'invente pas de candidature. */
      const source = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll('a')).find(
          (x) => /annonce d'origine/i.test(x.textContent || '')
        );
        return a ? a.getAttribute('href') : null;
      });
      assert.ok(
        source && /^https?:\/\//.test(source),
        `la fiche autonome ne renvoie pas vers l'annonce d'origine : "${source}"`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
