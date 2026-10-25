/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLES P01 à P03 — Parcours de recherche, filtres et pagination

   Ces parcours sont eprouves dans un navigateur reel, sur un serveur local
   qui simule le backend. Rien n'est lu dans le code : on agit comme un
   utilisateur et on observe le resultat.

   Ce qui est couvert ici :
   - P01 : l'accueil, sa recherche, ses chiffres, et son repli sur panne ;
   - P02 : la recherche et les combinaisons de filtres ;
   - P03 : la pagination, et les etats vide et erreur.

   Deux partis pris, repris de l'outillage :

   1. On attend une REPONSE, pas un delai. Une attente fixe lit l'ecran
      d'avant sur une machine chargee.

   2. Le compte du compteur doit correspondre au nombre de cartes affichees.
      C'est la coherence que l'utilisateur verrait.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

/* ── P01 — L'accueil ─────────────────────────────────────────────────────── */

test('P01 — l\'accueil affiche ses chiffres', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      const chiffres = await page.evaluate(() => {
        const lire = (id) => {
          const el = document.getElementById(id);
          return el ? el.textContent.trim() : null;
        };
        return {
          offres: lire('f-offres'),
          sources: lire('f-sources'),
          employeurs: lire('f-employeurs'),
          releve: lire('f-releve-libelle'),
          enAttente: document.querySelectorAll('.chiffres dt.attente').length,
        };
      });

      assert.ok(chiffres.offres !== null, 'le compteur d\'offres est introuvable');
      assert.equal(
        chiffres.enAttente, 0,
        'des chiffres sont restés en attente : la page ne s\'est pas chargée'
      );
      assert.ok(
        /\d/.test(chiffres.offres),
        `le nombre d'offres en ligne n'est pas un nombre : "${chiffres.offres}"`
      );
      assert.ok(
        /\d/.test(chiffres.sources),
        `le nombre de sources n'est pas un nombre : "${chiffres.sources}"`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P01 — l\'accueil affiche des offres et un lien vers le board', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      const cartes = await page.locator('#liste .oc, #liste .jc').count();
      assert.ok(cartes > 0, 'l\'accueil n\'affiche aucune offre');

      const lien = page.locator('#lien-board');
      assert.ok(await lien.count() > 0, 'le lien vers le board est introuvable');
      assert.equal(
        (await lien.getAttribute('href')).trim(), '/job-board.html',
        'le lien « Toutes les offres » ne mène pas au board'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P01 — la recherche de l\'accueil mène au board avec le critère', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await page.locator('#q').fill('actuaire');
      await page.locator('.btn-srch').click();

      await page.waitForURL(/job-board\.html/, { timeout: 15000 });
      await aide.attendre(page, 1500);

      const params = aide.parametresURL(page.url());
      assert.equal(
        params.q, 'actuaire',
        'le critère de recherche ne se retrouve pas dans l\'URL du board'
      );
      assert.equal(
        await page.locator('#q-input').inputValue(), 'actuaire',
        'le board ne reprend pas le critère dans son champ'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P01 — l\'accueil se replie proprement quand les statistiques tombent', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    await aide.controler({ statsKO: true });

    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 2000);

      /* La page ne doit ni rester bloquee sur « Chargement… », ni afficher
         un nombre faux. L'absence de chiffre est correcte ; un 0 ou un tiret
         laisse croire a une mesure. */
      const etat = await page.evaluate(() => {
        const el = document.getElementById('f-offres');
        return {
          texte: el ? el.textContent.trim() : null,
          enAttente: document.querySelectorAll('.chiffres dt.attente').length,
        };
      });

      assert.notEqual(
        etat.texte, '0',
        'la panne des statistiques affiche 0 offres : l\'utilisateur croit que le site est vide'
      );

      /* La panne est PROVOQUEE par ce test : le 500 et le message qui
         l'annonce sont attendus. Ce qu'on verifie, c'est qu'aucune autre
         erreur ne s'y glisse — une exception du code de la page, elle,
         serait un vrai defaut. */
      const inattendues = page.erreurs.filter(
        (e) => !/500 \(Internal Server Error\)/.test(e) &&
               !/chiffres indisponibles/.test(e)
      );
      assert.deepEqual(
        inattendues, [],
        `des erreurs inattendues sont apparues : ${JSON.stringify(inattendues)}`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── P02 — Recherche et filtres ──────────────────────────────────────────── */

test('P02 — la recherche du board filtre la liste', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      const avant = await aide.compterCartes(page);
      assert.ok(avant > 0, 'le board ne charge aucune offre au depart');

      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('#q-input').fill('Lyon');
          await page.keyboard.press('Enter');
        }
      );
      await aide.attendre(page, 1200);

      const apres = await aide.compterCartes(page);
      assert.ok(apres > 0, 'la recherche ne trouve aucune offre');
      assert.ok(
        apres < avant,
        `la recherche n'a pas filtre : ${avant} offre(s) avant, ${apres} apres`
      );

      /* Le compteur et les cartes doivent s'accorder. */
      const compteur = await aide.compteurOffres(page);
      const nombre = parseInt((compteur.match(/(\d+)/) || [])[1], 10);
      assert.equal(
        nombre, apres,
        `le compteur annonce ${nombre} offre(s) alors que ${apres} carte(s) sont affichees`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P02 — les filtres se combinent et se remettent à zéro', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      const total = await aide.compterCartes(page);

      /* Un filtre seul. */
      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('#contract-filter').selectOption('cdi');
        }
      );
      await aide.attendre(page, 1200);

      const apresFiltre = await aide.compterCartes(page);
      assert.ok(apresFiltre > 0, 'le filtre « CDI » ne trouve aucune offre');
      assert.ok(apresFiltre <= total, 'le filtre a augmente le nombre d\'offres');

      /* Un second filtre se combine au premier. */
      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('#experience-filter').selectOption('senior');
        }
      );
      await aide.attendre(page, 1200);

      const apresCombinaison = await aide.compterCartes(page);
      assert.ok(
        apresCombinaison <= apresFiltre,
        `la combinaison de filtres a augmente le nombre d'offres : ` +
        `${apresFiltre} puis ${apresCombinaison}`
      );

      /* La remise a zero vide les champs et rend la liste complete. */
      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('.chip', { hasText: 'Réinitialiser' }).first().click();
        }
      );
      await aide.attendre(page, 1200);

      const apresReset = await aide.compterCartes(page);
      assert.equal(
        apresReset, total,
        `la remise à zéro ne rend pas la liste complète : ${total} avant, ${apresReset} après`
      );
      assert.equal(
        await page.locator('#contract-filter').inputValue(), '',
        'le filtre « CDI » n\'a pas été vidé'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P02 — les filtres reçus par l\'URL sont appliqués', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      /* Un lien partage : l'accueil envoie /job-board.html?q=… . Le board
         doit lire ce parametre, le poser dans le champ, et charger la liste
         correspondant. Il ne le reecrit pas dans l'URL : la recherche vit
         cote serveur, et l'adresse reste partageable telle qu'elle est
         recue. */
      await page.goto(aide.BASE + '/job-board.html?q=actuaires%20%26%28data%29', {
        waitUntil: 'domcontentloaded',
      });
      await aide.attendre(page, 2000);

      assert.equal(
        await page.locator('#q-input').inputValue(), 'actuaires &(data)',
        'le critère reçu par l\'URL n\'est pas posé dans le champ'
      );

      /* Le critère est transmis intact a l'API, correctement encode. */
      const requetes = [];
      page.on('request', (r) => {
        if (r.url().includes('/api/v1/jobs')) requetes.push(r.url());
      });

      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('#q-input').fill('actuaires &(data)');
          await page.keyboard.press('Enter');
        }
      );
      await aide.attendre(page, 1200);

      const requete = requetes[0] || '';
      assert.ok(requete, 'aucune requete de liste n\'est partie');

      /* URLSearchParams connait la regle d'encodage des chaine de requete :
         le `+` y vaut l'espace. decodeURIComponent, lui, l'ignore. */
      const decode = (u) => new URL(u).searchParams.get('q');
      assert.equal(
        decode(requete), 'actuaires &(data)',
        `le critère n\\'est pas transmis intact a l\\'API : ${requete}`
      );
      assert.ok(
        !/[<>"']/.test(requete),
        'la requete contient des caracteres qui ne sont pas encodes : ' + requete
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

/* ── P03 — Pagination ────────────────────────────────────────────────────── */

test('P03 — « Voir plus d\'offres » ajoute la page suivante sans doublon', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      const premiere = await aide.identifiantsAffiches(page);
      const bouton = page.locator('#load-more-btn');
      assert.ok(await bouton.count() > 0, 'le bouton « Voir plus » est absent');

      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await bouton.first().click();
        }
      );
      await aide.attendre(page, 1500);

      const seconde = await aide.identifiantsAffiches(page);
      assert.ok(
        seconde.length > premiere.length,
        `« Voir plus » n'a rien ajoute : ${premiere.length} puis ${seconde.length} offres`
      );

      /* Les offres deja affichees ne doivent pas etre repetees. */
      const doublons = seconde.filter((id, i) => seconde.indexOf(id) !== i);
      assert.equal(
        doublons.length, 0,
        `« Voir plus » a repete des offres : ${JSON.stringify(doublons.slice(0, 4))}`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P03 — le bouton « Voir plus » disparaît à la dernière page', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      /* On charge toutes les pages, une par une. */
      for (let i = 0; i < 10; i++) {
        const bouton = page.locator('#load-more-btn');
        if (await bouton.count() === 0) break;
        await aide.avecReponse(
          page,
          aide.estListeDuBoard,
          async () => {
            await bouton.first().click();
          }
        );
        await aide.attendre(page, 1200);
      }

      assert.equal(
        await page.locator('#load-more-btn').count(), 0,
        'le bouton « Voir plus » est toujours present apres la dernière page'
      );

      const total = await aide.compterCartes(page);
      const compteur = await aide.compteurOffres(page);
      const nombre = parseInt((compteur.match(/(\d+)/) || [])[1], 10);
      assert.equal(
        nombre, total,
        `le compteur annonce ${nombre} alors que ${total} carte(s) sont affichees`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P03 — un résultat vide affiche un message, pas une page blanche', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('#q-input').fill('zzzintrouvablezzz');
          await page.keyboard.press('Enter');
        }
      );
      await aide.attendre(page, 1500);

      const cartes = await aide.compterCartes(page);
      assert.equal(cartes, 0, 'des offres sont affichees alors que la recherche ne trouve rien');

      const texte = await page.evaluate(() => {
        const feed = document.querySelector('#feed');
        return feed ? feed.textContent.trim() : '';
      });

      assert.ok(
        texte.length > 0,
        'le résultat vide affiche une zone vide, sans aucun message'
      );
      assert.ok(
        /aucun|trouvé|résultat|offre/i.test(texte),
        `le message de résultat vide n'explique rien : "${texte.slice(0, 90)}"`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('P03 — une erreur du backend se récupère sans casser la page', async () => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      await page.goto(aide.BASE + '/job-board.html', { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1800);

      /* Le backend tombe au moment de la recherche. */
      await aide.controler({ pannes: ['/jobs'] });

      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('#q-input').fill('actuaire');
          await page.keyboard.press('Enter');
        }
      );
      await aide.attendre(page, 1500);

      const etat = await page.evaluate(() => {
        const feed = document.querySelector('#feed');
        return {
          texte: feed ? feed.textContent.trim() : '',
          aReessai: Boolean(
            feed && feed.querySelector('button, a.btn, [role="button"]')
          ),
        };
      });

      assert.ok(
        etat.texte.length > 0,
        'la panne du backend laisse le feed vide, sans aucun message'
      );
      assert.ok(
        /erreur|réessayer|reessayer|indisponible|impossible|ne se chargent/i.test(etat.texte),
        `la panne n'est pas expliquée à l'utilisateur : "${etat.texte.slice(0, 90)}"`
      );

      /* Une fois le backend revenu, l'utilisateur doit pouvoir recommencer. */
      await aide.reinitialiserControle();

      await aide.avecReponse(
        page,
        aide.estListeDuBoard,
        async () => {
          await page.locator('#q-input').fill('actuaire');
          await page.keyboard.press('Enter');
        }
      );
      await aide.attendre(page, 1500);

      const cartes = await aide.compterCartes(page);
      assert.ok(
        cartes > 0,
        'la reprise après panne ne recharge pas la liste : l\'utilisateur reste bloqué'
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
