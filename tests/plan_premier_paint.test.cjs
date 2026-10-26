/* Le plan de page doit etre pose DÈS LE PREMIER PAINT.
 *
 * Le symptôme : sur iPad, au chargement d'une page, le défilement
 * semble dépasser le pied de page. Le fond sous le pied, d'une couleur
 * qui n'appartient pas au site, s'affiche pendant quelques instants,
 * puis tout se stabilise.
 *
 * Le test existant (pied_arret_defilement) verifie l'état FINAL : la
 * page est complètement chargée, le plan est bon, rien ne dépasse. Il
 * passait, et le symptôme persistait — parce que le défaut est dans la
 * PREMIÈRE image, pas dans la dernière.
 *
 * La cause : les règles qui posent le fond du plan vivaient dans
 * assets/theme.css, une feuille EXTERNE. Avant qu'elle n'arrive, le
 * navigateur ne sait rien. Mesure, en interceptant le document et en
 * retirant la feuille de theme — c'est l'état du document au premier
 * paint :
 *
 *   --plan = (vide)   --fond = (vide)   --champ = (vide)
 *   fond html = rgba(0, 0, 0, 0)    fond body = rgba(0, 0, 0, 0)
 *   overscroll-behavior-y = auto     min-height = 0px
 *
 * Le correctif : un bloc CSS critique, pose dans le <head> AVANT le
 * lien vers la feuille de theme, qui ne depend d'aucune variable — il
 * doit fonctionner meme si la feuille externe ne charge jamais.
 *
 * Ce test fait deux choses :
 *
 *   1. Il verifie que le bloc critique est present dans les pages, et
 *      qu'il precede le lien vers theme.css. C'est l'ordre qui compte :
 *      un bloc apres la feuille ne servirait a rien au premier paint.
 *
 *   2. Il rend chaque page SANS la feuille de theme et verifie que le
 *      plan est deja pose et que le rebond est desactive. C'est la
 *      preuve que le flash ne peut pas se produire.
 *
 * Usage : node tests/plan_premier_paint.test.cjs
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webkit } = require('playwright');
const aide = require('./aide-parcours.cjs');

const RACINE = path.join(__dirname, '..');

const PAGES = [
  { fichier: 'index.html', nom: 'accueil' },
  { fichier: 'job-board.html', nom: 'board' },
  { fichier: 'claim-entreprises.html', nom: 'entreprises' },
  { fichier: 'claim-observatoire.html', nom: 'observatoire' },
  { fichier: 'a-propos.html', nom: 'a-propos' },
  { fichier: 'cgu.html', nom: 'cgu' },
  { fichier: 'confidentialite.html', nom: 'confidentialite' },
  { fichier: 'contact.html', nom: 'contact' },
];

const MARQUEUR = 'CSS CRITIQUE DU PLAN';
const LIEN_THEME = '/assets/theme.css';

/* ── 1. Le bloc critique est present, et avant la feuille de theme ─────── */

test('le CSS critique du plan precede la feuille de theme', () => {
  for (const p of PAGES) {
    const chemin = path.join(RACINE, p.fichier);
    const html = fs.readFileSync(chemin, 'utf8');

    const iMarqueur = html.indexOf(MARQUEUR);
    assert.ok(iMarqueur > 0,
      `${p.nom} : le bloc CSS critique du plan est absent`);

    const iTheme = html.indexOf(LIEN_THEME);
    assert.ok(iTheme > 0,
      `${p.nom} : la feuille de theme n'est plus liee`);

    assert.ok(iMarqueur < iTheme,
      `${p.nom} : le bloc critique est APRES la feuille de theme — ` +
      `il ne servira pas au premier paint`);
  }
});

/* ── 2. Sans la feuille de theme, le plan est deja pose ─────────────────── */

test('le plan est pose des le premier paint, sans la feuille de theme', async (t) => {
  const serveurPret = !process.env.CLAIM_BASE;
  if (serveurPret) await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();
  t.after(async () => {
    await aide.arreterNavigateur();
    if (serveurPret) await aide.arreterServeur();
  });

  /* La base vient de l'aide, qui elle-meme l'a recue du serveur de
     test. Un port en dur ne fonctionne pas : le serveur attribue un
     port libre, et le test se connectait a un port qui n'ecoutait pas
     — ECONNREFUSED, en une demi-seconde. */
  const base = process.env.CLAIM_BASE || aide.BASE;

  for (const p of PAGES) {
    const ctx = await nav.newContext({
      viewport: { width: 959, height: 700 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      locale: 'fr-FR',
    });

    // On retire la feuille de theme : c'est l'etat du document avant
    // qu'elle n'arrive.
    await ctx.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const reponse = await route.fetch();
      const type = reponse.headers()['content-type'] || '';
      if (!type.includes('text/html')) return route.fulfill({ response: reponse });
      const corps = (await reponse.text())
        .replace(/<link[^>]*theme\.css[^>]*>/g, '');
      return route.fulfill({
        response: reponse,
        body: corps,
        headers: { ...reponse.headers(), 'content-type': 'text/html; charset=utf-8' },
      });
    });

    const page = await ctx.newPage();
    await page.goto(base + '/' + p.fichier, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(200);

    const etat = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        fondHtml: cs.backgroundColor,
        fondBody: getComputedStyle(document.body).backgroundColor,
        overscroll: cs.overscrollBehaviorY,
        minHeight: cs.minHeight,
      };
    });

    const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
    assert.ok(!transparent(etat.fondHtml),
      `${p.nom} : le fond du html est transparent sans la feuille de theme — ` +
      `le canvas debordera du body. (lu : ${etat.fondHtml})`);
    assert.ok(!transparent(etat.fondBody),
      `${p.nom} : le fond du body est transparent sans la feuille de theme ` +
      `(lu : ${etat.fondBody})`);
    assert.equal(etat.overscroll, 'none',
      `${p.nom} : le rebond du geste n'est pas desactive (lu : ${etat.overscroll})`);
    assert.notEqual(etat.minHeight, '0px',
      `${p.nom} : la hauteur minimale du plan n'est pas posee (lu : ${etat.minHeight})`);

    await page.close();
    await ctx.close();
  }
});
