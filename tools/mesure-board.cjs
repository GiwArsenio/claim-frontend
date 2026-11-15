#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   MESURE DU BANDEAU DU BOARD — outil de baseline (Lot 0)

   Mesure, en pixels CSS, la place que le haut de page prend avant la
   première offre. Sert de référence avant/après pour la compaction du hero
   (Lot 1) et pour vérifier qu'aucune régression n'est introduite.

   Usage :
     node tools/mesure-board.cjs [--json] [--captures dossier]

   Le serveur de test fournit les fixtures : aucune requête vers la
   production, aucune écriture.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const aide = require('../tests/aide-parcours.cjs');

const LARGEURS = [
  { nom: 'bureau-large', width: 1440, height: 900 },
  { nom: 'bureau-standard', width: 1280, height: 800 },
  { nom: 'bureau-etroit', width: 1024, height: 768 },
  { nom: 'phone', width: 390, height: 844 },
];

/* Le harnais partage demarre le serveur, injecte la base de l'API simulee et
   coupe le reseau externe : la mesure porte sur les memes donnees d'un bout a
   l'autre, et ne depend pas de la production. */
async function demarrer() {
  await aide.demarrerServeur();
  return { base: aide.BASE };
}

async function mesurer(page) {
  return page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), height: +b.height.toFixed(1) };
    };
    const cartes = Array.from(document.querySelectorAll('#feed .jc')).map((el) => {
      const b = el.getBoundingClientRect();
      return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), height: +b.height.toFixed(1) };
    });
    const vh = window.innerHeight;
    const entierement = cartes.filter((c) => c.top >= 0 && c.bottom <= vh).length;
    const partiellement = cartes.filter((c) => c.top < vh && c.bottom > 0).length;
    return {
      vh,
      header: r('#hd'),
      hero: r('#hero'),
      h1: r('#hero h1'),
      sub: r('#hero .sub'),
      sbar: r('#hero .sbar'),
      chips: r('#hero .chips'),
      compteur: r('.pl-hd'),
      premiereCarte: cartes[0] || null,
      cartesEntieres: entierement,
      cartesPartielles: partiellement,
      overflowHorizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

(async () => {
  const args = process.argv.slice(2);
  const enJson = args.includes('--json');
  const iCaptures = args.indexOf('--captures');
  const dossierCaptures = iCaptures >= 0 ? args[iCaptures + 1] : null;
  if (dossierCaptures) fs.mkdirSync(dossierCaptures, { recursive: true });

  const { base } = await demarrer();
  const navigateur = await aide.demarrerNavigateur();
  const resultats = {};

  try {
    for (const etat of [{ theme: 'jour' }, { theme: 'nuit' }]) {
      for (const L of LARGEURS) {
        const format = {
          viewport: { width: L.width, height: L.height },
          isMobile: L.width < 500,
          hasTouch: L.width < 500,
        };
        // ouvrirPage injecte la base de l'API simulee et coupe le reseau
        // exterieur : la mesure ne depend pas de la production.
        const { ctx, page } = await aide.ouvrirPage(format, { theme: etat.theme });
        await page.goto(`${base}/job-board.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#feed .jc', { timeout: 20000 });
        await aide.attendreChargementTermine(page).catch(() => {});
        page.locator('#consentement .btn-accepter, [data-consent="accepter"]')
            .click({ timeout: 1000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);

        const m = await mesurer(page);
        resultats[`${L.nom}|${etat.theme}`] = m;

        if (dossierCaptures) {
          await page.screenshot({ path: path.join(dossierCaptures, `${L.nom}-${etat.theme}.png`) });
        }
        await ctx.close();
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }

  if (enJson) {
    console.log(JSON.stringify(resultats, null, 2));
  } else {
    for (const [cle, m] of Object.entries(resultats)) {
      const hero = m.hero ? m.hero.height : 0;
      const entete = m.header ? m.header.height : 0;
      const premiere = m.premiereCarte ? m.premiereCarte.top : '-';
      console.log(
        `${cle.padEnd(22)} hero=${String(hero).padStart(6)}  entete=${String(entete).padStart(5)}` +
        `  haut=${String(Math.round(hero + entete)).padStart(5)} px` +
        `  (${((hero + entete) / m.vh * 100).toFixed(1)} % du viewport)` +
        `  haut 1re carte=${String(premiere).padStart(6)}` +
        `  cartes entieres=${m.cartesEntieres}  overflowX=${m.overflowHorizontal}`
      );
    }
  }
})();
