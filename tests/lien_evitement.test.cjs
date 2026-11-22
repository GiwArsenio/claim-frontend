/* ─────────────────────────────────────────────────────────────────────────────
   T02 — Lien d'évitement « Aller au contenu »

   Sans lien d'évitement, un utilisateur du clavier traverse tout le menu à
   chaque page avant d'atteindre le contenu. Le lien est posé par
   tools/codemod-lien-evitement.cjs ; ce test vérifie le RÉSULTAT dans un
   vrai navigateur, sur toutes les pages publiques :

   1. c'est le premier élément de <body> (hors scripts, styles et bandeau de
      consentement : sur quatre pages, ce bandeau est écrit dans le <head> et
      le navigateur le range donc AVANT le lien — il est masqué tant qu'aucun
      choix n'est fait, voir « limites » dans la PR) ;
   2. au premier Tab, il reçoit le focus et il est VISIBLE dans l'écran,
      avec un contraste texte/fond d'au moins 4,5:1 (jour et nuit) ;
   3. Entrée envoie le focus dans la zone principale (<main>) ;
   4. relancer le codemod ne change aucun fichier (idempotence).
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const aide = require('./aide-parcours.cjs');

const PAGES = [
  { nom: 'accueil', url: '/index.html', cible: 'contenu' },
  { nom: 'board', url: '/job-board.html', cible: 'split' },
  { nom: 'a-propos', url: '/a-propos.html', cible: 'contenu' },
  { nom: 'cgu', url: '/cgu.html', cible: 'contenu' },
  { nom: 'confidentialite', url: '/confidentialite.html', cible: 'contenu' },
  { nom: 'contact', url: '/contact.html', cible: 'contenu' },
  { nom: 'entreprises', url: '/claim-entreprises.html', cible: 'contenu' },
  { nom: 'observatoire', url: '/claim-observatoire.html', cible: 'contenu' },
  { nom: 'fiche /offre/{slug}', url: '/offre/actuaire-confirme-risques-non-vie', cible: 'contenu' },
  { nom: '404', url: '/public/404.html', cible: 'contenu' },
];

/* Lit, dans la page : le premier enfant de <body>, le lien focalisé, sa
   position et ses couleurs. */
const LIRE_LIEN = () => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const canaux = (css) => (css.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const a = document.activeElement;
  const premier = [...document.body.children].find((e) =>
    !/^(SCRIPT|STYLE|LINK|META|NOSCRIPT)$/.test(e.tagName) && e.id !== 'claim-consentement');
  const r = a.getBoundingClientRect();
  const cs = getComputedStyle(a);
  const l1 = lum(canaux(cs.color));
  const l2 = lum(canaux(cs.backgroundColor));
  return {
    premierEnfantEstLeLien: !!premier && premier.classList.contains('skip-link'),
    focusSurLeLien: a.classList.contains('skip-link'),
    href: a.getAttribute('href'),
    texte: (a.textContent || '').trim(),
    visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 &&
      r.bottom <= window.innerHeight && r.right <= window.innerWidth &&
      cs.visibility !== 'hidden' && cs.display !== 'none',
    couleurs: cs.color + ' sur ' + cs.backgroundColor + ' transition=' + cs.transitionDuration,
    contraste: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
  };
};

const LIRE_FOCUS = () => {
  const a = document.activeElement;
  return { balise: a.tagName.toLowerCase(), id: a.id, dansMain: !!a.closest('main') };
};

async function verifierPage(p, theme) {
  const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, theme ? { theme } : {});
  try {
    /* Un visiteur qui a déjà répondu au bandeau de consentement : le bandeau
       reste masqué et ne prend pas le premier Tab. */
    await ctx.addInitScript(() => {
      try { localStorage.setItem('claim-consentement', 'rien'); } catch (e) { /* stockage refusé */ }
    });
    await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
    await aide.attendre(page, 800);

    await page.keyboard.press('Tab');
    const lien = await page.evaluate(LIRE_LIEN);
    assert.ok(lien.premierEnfantEstLeLien, `${p.nom} : le lien doit être le premier élément de <body>`);
    assert.ok(lien.focusSurLeLien, `${p.nom} : le premier Tab doit focaliser le lien d'évitement`);
    assert.equal(lien.href, '#' + p.cible, `${p.nom} : cible du lien`);
    assert.equal(lien.texte, 'Aller au contenu');
    assert.ok(lien.visible, `${p.nom} : le lien focalisé doit être visible dans l'écran`);
    assert.ok(lien.contraste >= 4.5, `${p.nom} (${theme || 'jour'}) : contraste ${lien.contraste.toFixed(2)}:1 < 4,5:1 (${lien.couleurs})`);

    await page.keyboard.press('Enter');
    await aide.attendre(page, 200);
    const focus = await page.evaluate(LIRE_FOCUS);
    assert.equal(focus.id, p.cible, `${p.nom} : Entrée doit placer le focus sur #${p.cible} (reçu : ${JSON.stringify(focus)})`);
    if (p.nom !== 'entreprises' && p.nom !== 'observatoire') {
      assert.ok(focus.balise === 'main', `${p.nom} : la cible doit être le <main> (reçu : ${focus.balise})`);
    }
  } finally {
    await ctx.close();
  }
}

test('T02 — au clavier, le lien d\'évitement est le premier arrêt, visible, et mène au contenu', async (t) => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  try {
    for (const p of PAGES) {
      await t.test(p.nom, () => verifierPage(p));
    }
    // Le thème nuit change les couleurs « inverse » : on revérifie le contraste.
    await t.test('accueil, thème nuit', () => verifierPage(PAGES[0], 'nuit'));
    await t.test('board, thème nuit', () => verifierPage(PAGES[1], 'nuit'));
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('T02 — le codemod est idempotent (aucun fichier ne changerait)', () => {
  const r = spawnSync(process.execPath,
    [path.join(__dirname, '..', 'tools', 'codemod-lien-evitement.cjs'), '--verifier'],
    { encoding: 'utf8' });
  assert.equal(r.status, 0, `le codemod changerait des fichiers :\n${r.stdout}${r.stderr}`);
});
