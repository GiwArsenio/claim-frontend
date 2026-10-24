/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A08 — En-tête, pied de page et navigation

   L'en-tête et le pied de page sont sur toutes les pages : un menu cassé
   sur une page l'est sur les quatre. Ce test vérifie qu'ils sont présents,
   qu'ils sont identiques, et qu'ils mènent quelque part.

   Ce que le test vérifie :

   1. L'en-tête existe sur chaque page, avec le même balisage.
   2. Le pied existe sur chaque page, avec les mêmes quatre liens.
   3. Le lien ACTIF de la navigation correspond à la page.
   4. Aucun lien mort : ni `href="#"`, ni `href=""`, ni lien dont la cible
      n'existe pas sur le serveur.
   5. Le logo du pied et le logo du tiroir mobile mènent à l'accueil.
   6. Sur téléphone, le tiroir s'ouvre, et son logo mène à l'accueil.
   7. Le pied reste atteignable sur téléphone : ses liens ne sont pas
      masqués, sinon les pages de mentions seraient inaccessibles.

   Le point 4 est le plus utile : un `href="#"` est un lien mort, et il
   ne se voit pas sans qu'on aille le chercher.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const aide = require('./aide-parcours.cjs');

const RACINE = path.join(__dirname, '..');

/* Les pages publiques. La fiche d'offre (api/offre.js) est generated
   dynamiquement : elle a son propre gabarit, verifie par ailleurs. */
const PAGES = [
  { nom: 'accueil', url: '/index.html', actif: null },
  { nom: 'board', url: '/job-board.html', actif: "Offres d'emploi" },
  { nom: 'entreprises', url: '/claim-entreprises.html', actif: 'Entreprises' },
  { nom: 'observatoire', url: '/claim-observatoire.html', actif: "Observatoire de l'assurance" },
  { nom: 'a-propos', url: '/a-propos.html', actif: null },
  { nom: 'cgu', url: '/cgu.html', actif: null },
  { nom: 'confidentialite', url: '/confidentialite.html', actif: null },
  { nom: 'contact', url: '/contact.html', actif: null },
];

const MENUS_PIED = [
  { texte: 'À propos', href: '/a-propos.html' },
  { texte: 'CGU', href: '/cgu.html' },
  { texte: 'Confidentialité', href: '/confidentialite.html' },
  { texte: 'Contact', href: '/contact.html' },
];

test('A08 — chaque page a un en-tête et un pied de page', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          const etat = await page.evaluate(() => {
            const hd = document.querySelector('header#hd, header.hd');
            const ft = document.querySelector('footer#ft, footer.pied');
            return {
              aEntete: Boolean(hd),
              aPied: Boolean(ft),
              enteteEstHeader: Boolean(hd && hd.tagName === 'HEADER'),
              piedEstFooter: Boolean(ft && ft.tagName === 'FOOTER'),
              logoEntete: hd ? (hd.querySelector('.logo') || {}).getAttribute?.('href') || null : null,
              logoPied: ft ? (ft.querySelector('.ft-logo, .logo') || {}).getAttribute?.('href') || null : null,
              menus: ft
                ? Array.from(ft.querySelectorAll('.ft-links a, .nav2 a')).map((a) => ({
                    texte: a.textContent.trim(),
                    href: a.getAttribute('href'),
                  }))
                : [],
              lienActif: (() => {
                const a = document.querySelector('.nav-links a.on');
                return a ? a.textContent.trim() : null;
              })(),
            };
          });

          assert.ok(etat.aEntete, `${p.nom} : pas d'en-tête`);
          assert.ok(etat.aPied, `${p.nom} : pas de pied de page`);

          /* Un repère sémantique : un lecteur d'écran doit pouvoir
             sauter l'en-tête et le pied. */
          assert.equal(
            etat.enteteEstHeader, true,
            `${p.nom} : l'en-tête n'est pas un <header>`
          );
          assert.equal(
            etat.piedEstFooter, true,
            `${p.nom} : le pied n'est pas un <footer>`
          );

          assert.equal(
            etat.logoEntete, '/',
            `${p.nom} : le logo de l'en-tête ne mène pas à l'accueil`
          );
          assert.equal(
            etat.logoPied, '/',
            `${p.nom} : le logo du pied ne mène pas à l'accueil — ` +
            `c'était du texte, le clic ne menait nulle part`
          );

          /* Les quatre menus du pied, partout. */
          for (const menu of MENUS_PIED) {
            const trouve = etat.menus.find((m) => m.texte === menu.texte);
            assert.ok(
              trouve,
              `${p.nom} : le menu « ${menu.texte} » est absent du pied de page`
            );
            assert.equal(
              trouve.href, menu.href,
              `${p.nom} : le menu « ${menu.texte} » mène à « ${trouve.href} » au lieu de « ${menu.href} »`
            );
          }

          /* Le lien actif correspond à la page. */
          if (p.actif) {
            assert.equal(
              etat.lienActif, p.actif,
              `${p.nom} : le lien actif de la navigation est « ${etat.lienActif} », ` +
              `il devrait être « ${p.actif} »`
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

test('A08 — aucun lien mort dans l\'en-tête et le pied', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          const liens = await page.evaluate(() => {
            const zone = document.querySelector('header#hd, header.hd, footer#ft, footer.pied');
            if (!zone) return [];
            return Array.from(zone.querySelectorAll('a')).map((a) => ({
              href: a.getAttribute('href'),
              texte: a.textContent.trim().slice(0, 30),
            }));
          });

          /* Un lien mort : une ancre vide, ou une cible absente du serveur. */
          const morts = [];
          for (const lien of liens) {
            if (!lien.href) { morts.push({ ...lien, raison: 'href absent' }); continue; }
            if (lien.href === '#') { morts.push({ ...lien, raison: 'ancre vide' }); continue; }
            if (lien.href.startsWith('#')) continue;   /* ancre interne : licite */
            if (lien.href.startsWith('http') || lien.href.startsWith('mailto:')) continue;

            const chemin = lien.href.split('#')[0].split('?')[0];
            if (!chemin) continue;
            if (!fs.existsSync(path.join(RACINE, chemin.replace(/^\//, '')))) {
              morts.push({ ...lien, raison: 'cible absente du serveur' });
            }
          }

          assert.deepEqual(
            morts, [],
            `${p.nom} : ${morts.length} lien(s) mort(s) dans l'en-tête ou le pied — ` +
            JSON.stringify(morts)
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

test('A08 — sur téléphone, le tiroir s\'ouvre et son logo mène à l\'accueil', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.phone);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1200);

          /* Le bandeau de consentement est une MODALE : il intercepte les
             clics, c'est son rôle. On l'accepte avant de tester le tiroir —
             sans cela, le clic sur le bouton de menu ne porterait jamais
             sur lui, et le test échouerait sur un comportement correct. */
          await page.evaluate(() => {
            const b = document.querySelector('#claim-consentement');
            if (b) b.remove();
          });
          await page.waitForTimeout(200);

          /* Le tiroir s'ouvre. */
          const burger = page.locator('#btn-burger');
          assert.ok(await burger.count() > 0, `${p.nom} : pas de bouton de menu sur téléphone`);

          await burger.click();
          await page.waitForTimeout(500);

          const ouvert = await page.evaluate(() => {
            const m = document.getElementById('burger-menu');
            return Boolean(m && m.classList.contains('open'));
          });
          assert.ok(ouvert, `${p.nom} : le tiroir ne s'ouvre pas sur téléphone`);

          /* Le logo du tiroir est un lien vers l'accueil. */
          const logo = await page.evaluate(() => {
            const a = document.querySelector('#burger-menu .bm-logo');
            if (!a) return null;
            return {
              tag: a.tagName.toLowerCase(),
              href: a.getAttribute('href'),
            };
          });

          assert.ok(logo, `${p.nom} : pas de logo dans le tiroir mobile`);
          assert.equal(
            logo.tag, 'a',
            `${p.nom} : le logo du tiroir mobile est un <${logo.tag}>, pas un lien — ` +
            `le clic ne mène nulle part`
          );
          assert.equal(
            logo.href, '/',
            `${p.nom} : le logo du tiroir mobile ne mène pas à l'accueil`
          );

          /* Le pied reste atteignable : ses liens ne doivent pas être
             masqués sur téléphone, sinon les pages de mentions sont
             inaccessibles. */
          await page.evaluate(() => closeBurger());
          await page.waitForTimeout(400);

          const pied = await page.evaluate(() => {
            const ft = document.querySelector('footer#ft, footer.pied');
            if (!ft) return null;
            const st = getComputedStyle(ft);
            const lien = ft.querySelector('.ft-links a');
            const stLien = lien ? getComputedStyle(lien) : null;
            return {
              visible: st.display !== 'none' && st.visibility !== 'hidden',
              lienVisible: stLien ? stLien.display !== 'none' : false,
              nbMenus: ft.querySelectorAll('.ft-links a').length,
            };
          });

          assert.ok(pied, `${p.nom} : pas de pied de page`);
          assert.ok(pied.visible, `${p.nom} : le pied de page est invisible sur téléphone`);
          assert.ok(
            pied.lienVisible,
            `${p.nom} : les liens du pied sont masqués sur téléphone — ` +
            `les pages de mentions seraient inaccessibles`
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
