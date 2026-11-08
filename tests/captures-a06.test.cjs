/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A06 — Captures de référence approuvées

   Le catalogue demande des captures pour l'accueil, le board, la fiche, les
   états vide et erreur, le consentement, et les deux thèmes.

   Deux exigences distinctes, souvent confondues :

   1. Les captures EXISTENT et montrent bien l'état qu'elles annoncent.
      Une capture de référence absente n'est pas une capture qui passe :
      le test la signale. De meme, une capture de l'etat vide qui ne montre
      aucun message ne prouve rien.

   2. Le rendu COURANT correspond à la référence, à un seuil près. Le
      seuil existe parce qu'un rendu web n'est jamais identique au pixel
      près : l'anticrenelage et les sous-pixels varient d'une machine à
      l'autre.

   Le catalogue ne demande pas d'accepter les écarts automatiquement :
   le test signale, un humain décide. Et il demande explicitement de
   vérifier que le test visuel détecte une disparition réelle d'action —
   c'est la preuve que la capture sert à quelque chose. Ce test retire donc
   volontairement un bouton et vérifie que l'ecart est detecte.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const aide = require('./aide-parcours.cjs');
const captures = require('./captures-reference.cjs');

/* ── 1. Les références existent ──────────────────────────────────────────── */

test('A06 — chaque scénario possède une capture de référence', () => {
  const manquantes = [];

  for (const scenario of captures.SCENARIOS) {
    const chemin = captures.cheminReference(scenario);
    if (!fs.existsSync(chemin)) {
      manquantes.push(scenario.nom);
      continue;
    }
    const taille = fs.statSync(chemin).size;
    assert.ok(
      taille > 1000,
      `la capture de référence « ${scenario.nom} » ne fait que ${taille} octets : ` +
      `elle est vide ou tronquée`
    );
  }

  assert.equal(
    manquantes.length, 0,
    `${manquantes.length} capture(s) de référence manquante(s) : ${manquantes.join(', ')} — ` +
    `elles se régénèrent par : node tests/generer-references.cjs`
  );
});

/* ── 2. Les captures montrent bien l'état qu'elles annoncent ────────────── */

test('A06 — chaque capture montre l\'état annoncé', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const scenario of captures.SCENARIOS) {
      await t.test(scenario.nom, async () => {
        const format = aide.FORMATS[scenario.format];
        const optionsPage = scenario.theme === 'nuit' ? { theme: 'nuit' } : {};
        const { ctx, page } = await aide.ouvrirPage(format, optionsPage);

        try {
          await captures.preparerPage(page);
          await captures.bloquerImagesDistantes(page, aide.BASE);
          await page.goto(aide.BASE + scenario.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);
          await captures.executerAction(page, scenario, aide);

          const etat = await page.evaluate(() => {
            const texte = (document.body.innerText || '').toLowerCase();
            return {
              texte,
              theme: document.documentElement.getAttribute('data-theme'),
              carteVisible: Boolean(
                document.querySelector('#feed .jc, #feed .oc, .oc')
              ),
              detailRempli: (() => {
                const d = document.querySelector('#detail');
                return Boolean(d && d.textContent.trim().length > 20);
              })(),
              consentVisible: (() => {
                const c = document.querySelector('#claim-consentement');
                if (!c) return false;
                const st = getComputedStyle(c);
                return st.display !== 'none' && st.visibility !== 'hidden' && !c.hasAttribute('hidden');
              })(),
              boutonPostuler: Boolean(
                Array.from(document.querySelectorAll('#detail .bap, #detail button, #detail a'))
                  .find((b) => /postuler/i.test(b.textContent || ''))
              ),
              compteur: (document.querySelector('.pl-hd') || {}).textContent || '',
            };
          });

          /* Chaque scenario a une attente propre : c'est ce qui distingue
             une capture d'etat d'une capture de page. */
          if (scenario.nom === 'board-vide') {
            assert.ok(
              !etat.carteVisible,
              'la capture « board-vide » montre des offres : elle ne documente pas l\'état vide'
            );
            assert.ok(
              etat.texte.includes('aucune') || etat.texte.includes('trouvé') ||
              etat.texte.includes('résultat') || etat.compteur.includes('0'),
              'la capture « board-vide » ne montre aucun message d\'état vide'
            );
          }

          if (scenario.nom === 'board-erreur') {
            assert.ok(
              !etat.carteVisible,
              'la capture « board-erreur » montre des offres : elle ne documente pas la panne'
            );
            assert.ok(
              etat.texte.includes('erreur') || etat.texte.includes('réessayer') ||
              etat.texte.includes('reessayer') || etat.texte.includes('indisponible') ||
              etat.texte.includes('ne se chargent'),
              'la capture « board-erreur » ne montre aucun message d\'erreur'
            );
          }

          if (scenario.nom === 'fiche-jour' || scenario.nom === 'fiche-nuit') {
            assert.ok(
              etat.detailRempli,
              `la capture « ${scenario.nom} » ne montre aucune fiche remplie`
            );
            assert.ok(
              etat.boutonPostuler,
              `la capture « ${scenario.nom} » ne montre aucune action de candidature`
            );
          }

          if (scenario.nom === 'consentement') {
            assert.ok(
              etat.consentVisible,
              'la capture « consentement » ne montre pas le bandeau'
            );
          }

          if (scenario.nom.endsWith('-nuit')) {
            assert.equal(
              etat.theme, 'nuit',
              `la capture « ${scenario.nom} » ne montre pas le mode nuit`
            );
          }

          if (scenario.nom.endsWith('-jour')) {
            assert.notEqual(
              etat.theme, 'nuit',
              `la capture « ${scenario.nom} » montre le mode nuit`
            );
          }
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

/* ── 4. Le test visuel détecte une disparition réelle ───────────────────── */

test('A06 — le test visuel détecte la disparition d\'une action', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    /* On retire le bouton de candidature de la fiche. La capture de
       reference ne doit plus correspondre : si elle correspond encore,
       le test visuel ne sert a rien. */
    const scenario = captures.SCENARIOS.find((s) => s.nom === 'fiche-jour');
    assert.ok(scenario, 'le scénario « fiche-jour » est introuvable');

    const format = aide.FORMATS[scenario.format];

    /* Le controle du serveur est partage : on repart d'un backend sain. */
    await aide.reinitialiserControle();

    const { ctx, page } = await aide.ouvrirPage(format);

    try {
      await captures.preparerPage(page);
      await captures.bloquerImagesDistantes(page, aide.BASE);
      await page.goto(aide.BASE + scenario.url, { waitUntil: 'domcontentloaded' });
      await aide.attendre(page, 1200);
      await captures.executerAction(page, scenario, aide);

      /* La suppression est faite APRES l'ouverture de la fiche : elle
         simule l'action qui disparait, pas une page qui ne s'ouvre pas. */
      const retire = await page.evaluate(() => {
        const boutons = Array.from(
          document.querySelectorAll('#detail .bap, #detail button, #detail a')
        ).filter((b) => /postuler/i.test(b.textContent || '') &&
          !b.closest('footer') && !b.closest('header') && !b.closest('nav'));
        if (!boutons.length) return 0;
        for (const b of boutons) b.remove();
        return boutons.length;
      });

      assert.ok(retire > 0, 'aucun bouton de candidature à retirer : la preuve ne vaut rien');

      const cheminActuel = captures.cheminActuelle(scenario);
      fs.mkdirSync(path.dirname(cheminActuel), { recursive: true });
      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation-duration: 0s !important; animation-delay: 0s !important;
          transition-duration: 0s !important; transition-delay: 0s !important;
          caret-color: transparent !important; scroll-behavior: auto !important;
        }`,
      });
      await page.waitForTimeout(400);

      /* La comparaison porte sur une fenêtre de TAILLE FIXE, celle de la
         référence. Une capture en pleine page changerait de hauteur avec
         n'importe quel ajout en bas de fiche : deux images de tailles
         différentes ne sont pas comparables, et la preuve ne se fait jamais.
         C'est ce qui bloquait le déploiement du site entier depuis octobre :
         la fiche avait grandi de 46 px, et chaque test visuel échouait sur
         « dimensions differentes » — pour un changement sans rapport.
         La fenêtre figée garde le bouton dans le champ : c'est lui qu'on
         vérifie, pas la longueur de la page. */
      const { PNG } = require('pngjs');
      const reference = PNG.sync.read(fs.readFileSync(captures.cheminReference(scenario)));

      /* Playwright plafonne le `clip` à la hauteur de la fenêtre : demander
         901 px dans une fenêtre de 900 en rend 900, et la comparaison refuse
         pour un pixel. La fenêtre est donc ouverte AU MOINS aussi haute que
         la référence — elle ne rétrécit jamais sous celle du format, pour ne
         pas changer le rendu qu'on veut éprouver. */
      const viewport = aide.FORMATS[scenario.format].viewport;
      const hauteurFenetre = Math.max(viewport.height, reference.height);
      await page.setViewportSize({ width: viewport.width, height: hauteurFenetre });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: cheminActuel,
        clip: { x: 0, y: 0, width: reference.width, height: reference.height },
      });

      const rapport = captures.comparerFichier(
        captures.cheminReference(scenario),
        cheminActuel
      );

      // Une comparaison impossible est une défaillance de preuve, pas une
      // validation : le détail de la raison doit rester lisible dans le CI.
      // La raison exacte doit être celle du rapport, pas un motif générique :
      // afficher « référence absente » pour des dimensions différentes masque
      // le vrai défaut et envoie chercher au mauvais endroit.
      const raison = rapport.raison ||
        (rapport.referenceAbsente ? 'référence absente'
          : rapport.captureAbsente ? 'capture absente' : 'format inconnu');
      assert.equal(rapport.comparable, true,
        'la comparaison n\'a pas pu se faire : ' + raison);
      assert.ok(
        rapport.pct > captures.SEUIL_PCT,
        `la disparition du bouton de candidature n'a pas été détectée : ` +
        `${rapport.pixelsDiff} pixel(s) different(s), soit ${rapport.pct.toFixed(3)} %. ` +
        `La capture de référence ne protège donc rien.`
      );
    } finally {
      await ctx.close();
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
