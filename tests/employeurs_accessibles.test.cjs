/* ─────────────────────────────────────────────────────────────────────────────
   LE BANDEAU « ILS RECRUTENT » : ACCESSIBLE ET SOBRE

   Deux défauts relevés à l'audit du 21 novembre :
     • les logos portaient `alt=""` et `aria-hidden` : un lecteur d'écran
       n'apprenait le nom d'aucun employeur ;
     • les initiales (repli quand le logo manque) avaient chacune la couleur
       de leur marque, ce qui donnait un patchwork d'aspect provisoire.

   Ce fichier tient les deux, sans toucher à ce qui marche : le défilement,
   sa pause au survol, et son arrêt sous « réduire les animations ».

   Ce qu'on lit est l'arbre d'accessibilité (`ariaSnapshot`), c'est-à-dire ce
   qu'un lecteur d'écran annonce, pas le HTML.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');
const mesures = require('./mesures-a11y.cjs');
const annuaire = require('../assets/companies-data.js');

const NOMS = annuaire.PROFILS.map((p) => p.nom);

// Un PNG transparent de 1 pixel : sert de « logo qui charge bien ».
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/** Les noms annoncés par le lecteur d'écran, dans l'ordre. */
function nomsAnnonces(snapshot) {
  // `- listitem "Nom"` quand le nom vient d'un attribut, `- listitem: Nom`
  // quand il vient du texte contenu.
  return [...snapshot.matchAll(/^\s*- listitem(?: "(.*)"|: (.*))\s*$/gm)].map((m) => m[1] ?? m[2]);
}

async function ouvrirAccueil(format, options = {}, avant) {
  const { ctx, page } = await aide.ouvrirPage(format, options);
  if (avant) await avant(page);
  await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.employeurs-piste li', { state: 'attached', timeout: 20000 });
  await aide.attendre(page, 800);
  return { ctx, page };
}

test('T03 — monogramme : un sigle court reste entier, deux marques voisines se distinguent', () => {
  const m = annuaire.monogramme;
  assert.equal(typeof m, 'function', 'l\'annuaire doit exposer monogramme()');
  assert.equal(m('WTW'), 'WTW');
  assert.equal(m('EY'), 'EY');
  assert.equal(m('KPMG France'), 'KPMG', 'le mot « France » ne distingue personne');
  assert.equal(m('AXA France'), 'AXA');
  assert.equal(m('SCOR SE'), 'SCOR');
  assert.equal(m('Milliman'), 'MI');
  assert.equal(m('Société Générale Assurances'), 'SG');
  assert.equal(m('Malakoff Humanis'), 'MH');
  assert.equal(m(''), '?');
  assert.equal(m(null), '?');
  // Sur la liste réelle : jamais une seule lettre, et AXA ne ressemble plus à Allianz.
  const tous = annuaire.PROFILS.map((p) => m(p.nom));
  assert.ok(tous.every((x) => x.length >= 2), `un monogramme d'une lettre : ${tous}`);
  assert.notEqual(m('AXA France'), m('Allianz France'));
  assert.ok(new Set(tous).size >= tous.length - 1, `trop de monogrammes identiques : ${tous}`);
});

test('T03 — le bandeau des employeurs', async (t) => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();

  try {
    await t.test('le lecteur d\'écran lit une liste nommée, chaque employeur une seule fois', async () => {
      const { ctx, page } = await ouvrirAccueil(aide.FORMATS.bureau);
      try {
        const snap = await page.locator('#employeurs').ariaSnapshot();
        assert.match(snap, /^- list "Employeurs qui recrutent":/, `la liste doit être nommée : ${snap.slice(0, 80)}`);
        const noms = nomsAnnonces(snap);
        assert.deepEqual(noms, NOMS, 'les noms annoncés doivent être ceux de l\'annuaire, dans l\'ordre, une fois chacun');
        assert.equal(new Set(noms).size, noms.length, 'un employeur est annoncé deux fois');

        // Le nom doit venir du CONTENU, pas de l'infobulle (`title`) : un
        // lecteur d'écran ne lit pas toujours le `title`, qui sert de nom en
        // dernier recours. On retire donc tous les `title` et on relit.
        await page.evaluate(() => document.querySelectorAll('#employeurs [title]')
          .forEach((e) => e.removeAttribute('title')));
        const sansTitre = nomsAnnonces(await page.locator('#employeurs').ariaSnapshot());
        assert.deepEqual(sansTitre, NOMS, 'sans infobulle, les noms ne sont plus annoncés : ils doivent être dans le texte');
      } finally { await ctx.close(); }
    });

    await t.test('même sur un très grand écran (bandeau répété pour le remplir), pas de doublon vocal', async () => {
      const { ctx, page } = await ouvrirAccueil({ viewport: { width: 3200, height: 900 }, isMobile: false, hasTouch: false });
      try {
        const total = await page.locator('.employeurs-piste > li').count();
        assert.ok(total >= NOMS.length * 4, `à 3200 px la piste doit être répétée (${total} éléments)`);
        const noms = nomsAnnonces(await page.locator('#employeurs').ariaSnapshot());
        assert.deepEqual(noms, NOMS, `à 3200 px : ${noms.length} noms annoncés pour ${NOMS.length} employeurs`);
      } finally { await ctx.close(); }
    });

    await t.test('les copies de la boucle sont masquées et rien dans le bandeau n\'est atteignable au clavier', async () => {
      const { ctx, page } = await ouvrirAccueil(aide.FORMATS.bureau);
      try {
        const r = await page.evaluate(() => {
          const lis = [...document.querySelectorAll('.employeurs-piste > li')];
          return {
            total: lis.length,
            visibles: lis.filter((l) => l.getAttribute('aria-hidden') !== 'true').length,
            focalisables: document.querySelectorAll('#employeurs a, #employeurs button, #employeurs [tabindex]').length,
          };
        });
        assert.ok(r.total > r.visibles, 'la copie qui sert à boucler a disparu');
        assert.equal(r.visibles, NOMS.length);
        assert.equal(r.focalisables, 0, 'un élément du bandeau est atteignable au clavier');
      } finally { await ctx.close(); }
    });

    await t.test('un seul style de monogramme : aucune teinte propre à une entreprise (logos absents)', async () => {
      for (const theme of [undefined, 'nuit']) {
        const { ctx, page } = await ouvrirAccueil(aide.FORMATS.bureau, theme ? { theme } : {});
        try {
          const r = await page.evaluate(() => {
            const els = [...document.querySelectorAll('.employeurs-piste .sigle-repli, .employeurs-piste .sigle--mono')];
            const cs = els.map((e) => getComputedStyle(e));
            return {
              n: els.length,
              fonds: [...new Set(cs.map((c) => c.backgroundColor))],
              encres: [...new Set(cs.map((c) => c.color))],
              bordures: [...new Set(cs.map((c) => c.borderTopColor))],
              inline: els.filter((e) => /background|color/.test(e.getAttribute('style') || '')).length,
            };
          });
          const nom = theme || 'jour';
          assert.ok(r.n >= NOMS.length, `${nom} : ${r.n} monogrammes seulement`);
          assert.equal(r.fonds.length, 1, `${nom} : plusieurs fonds de monogramme ${JSON.stringify(r.fonds)}`);
          assert.equal(r.encres.length, 1, `${nom} : plusieurs encres ${JSON.stringify(r.encres)}`);
          assert.equal(r.bordures.length, 1, `${nom} : plusieurs bordures ${JSON.stringify(r.bordures)}`);
          assert.equal(r.inline, 0, `${nom} : une couleur est encore posée en ligne`);
          // Le fond est celui du thème, pas une teinte de marque.
          const surface2 = await page.evaluate(() => {
            const d = document.createElement('i');
            d.style.background = 'var(--surface-2)';
            document.body.appendChild(d);
            const v = getComputedStyle(d).backgroundColor;
            d.remove();
            return v;
          });
          assert.equal(r.fonds[0], surface2, `${nom} : le fond doit être --surface-2`);
        } finally { await ctx.close(); }
      }
    });

    await t.test('quand les logos chargent, aucun monogramme ne reste et le logo n\'est pas encadré', async () => {
      const { ctx, page } = await ouvrirAccueil(aide.FORMATS.bureau, {}, async (p) => {
        await p.route(/logos\.hunter\.io|google\.com\/s2\/favicons|\/logos\//, (route) =>
          route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }));
      });
      try {
        await aide.attendre(page, 800);
        const r = await page.evaluate(() => ({
          images: document.querySelectorAll('.employeurs-piste > li:not([aria-hidden]) .sigle img').length,
          repli: document.querySelectorAll('.employeurs-piste .sigle-repli').length,
          fondSigle: [...new Set([...document.querySelectorAll('.employeurs-piste .sigle:not(.sigle--mono)')]
            .map((e) => getComputedStyle(e).backgroundColor))],
        }));
        assert.ok(r.images > 0, 'aucun logo chargé : le test ne mesure rien');
        assert.equal(r.repli, 0, 'des monogrammes d\'attente restent sous des logos chargés');
        assert.deepEqual(r.fondSigle, ['rgba(0, 0, 0, 0)'], 'un logo a reçu un fond');
        // Les logos restent décoratifs pour le lecteur d'écran : le nom vient du texte.
        const noms = nomsAnnonces(await page.locator('#employeurs').ariaSnapshot());
        assert.deepEqual(noms, NOMS);
      } finally { await ctx.close(); }
    });

    await t.test('l\'animation est conservée : défilement, pause au survol, arrêt si « réduire les animations »', async () => {
      const { ctx, page } = await ouvrirAccueil(aide.FORMATS.bureau);
      try {
        const lire = () => page.evaluate(() => {
          const c = getComputedStyle(document.querySelector('.employeurs-piste'));
          return { nom: c.animationName, duree: parseFloat(c.animationDuration), etat: c.animationPlayState };
        });
        const a = await lire();
        assert.equal(a.nom, 'defile');
        assert.ok(a.duree >= 18, `durée ${a.duree}s`);
        assert.equal(a.etat, 'running');
        await page.locator('#employeurs').hover();
        await aide.attendre(page, 200);
        assert.equal((await lire()).etat, 'paused', 'le survol ne met plus le bandeau en pause');
      } finally { await ctx.close(); }

      const r = await ouvrirAccueil(aide.FORMATS.bureau, { reducedMotion: 'reduce' });
      try {
        const nom = await r.page.evaluate(() => getComputedStyle(document.querySelector('.employeurs-piste')).animationName);
        assert.equal(nom, 'none', 'le bandeau défile malgré « réduire les animations »');
      } finally { await r.ctx.close(); }
    });

    await t.test('axe ne trouve aucune violation dans le bandeau', async () => {
      const { ctx, page } = await ouvrirAccueil(aide.FORMATS.bureau);
      try {
        const axe = await mesures.scannerAxe(page);
        const dedans = axe.violations.filter((v) =>
          v.noeuds.some((n) => /employeurs/.test(n.cible)));
        assert.equal(dedans.length, 0, JSON.stringify(dedans));
      } finally { await ctx.close(); }
    });
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
