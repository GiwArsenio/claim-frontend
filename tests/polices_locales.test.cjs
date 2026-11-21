/* Inter est servie par le site, pas par Google (tache T09).
 *
 * Constat : toutes les pages demandaient Inter a fonts.googleapis.com
 * (+ preconnect Google). Le navigateur du visiteur contactait donc Google
 * avant tout consentement, alors que la page Confidentialite promet
 * l'absence de tiers publicitaires.
 *
 * Le correctif : un fichier Inter reduit (latin, axe de graisse 300-900,
 * ~66 Ko) dans assets/polices/, declare par assets/polices.css, precharge
 * par un <link rel="preload">. Les balises sont posees par
 * tools/codemod-polices.cjs.
 *
 * Ce test verifie quatre choses :
 *
 *   1. STATIQUE — plus aucune reference a Google Fonts dans les pages ni
 *      dans le gabarit de la fiche (api/offre.js et son double genere) ;
 *   2. POIDS — le fichier de police pese au plus 120 000 octets (le fichier
 *      de test complet fait 352 Ko : le reintroduire serait une regression
 *      de +300 Ko), et sa licence est a cote ;
 *   3. CODEMOD — relance, il ne change rien (idempotence) ;
 *   4. NAVIGATEUR — sur chaque page : zero requete vers googleapis/gstatic,
 *      Inter est bel et bien la police rendue (police web, pas locale), et
 *      les octets de police recus restent sous 120 000.
 *
 * La page de fiche (/offre/{slug}) utilise volontairement la police du
 * systeme : on verifie qu'elle ne charge PAS Inter (ni Google).
 *
 * Voisin : tests/aide-parcours.cjs ne remplace plus Google par une copie
 * locale (ce qui aurait masque un retour de l'appel tiers) : il le refuse et
 * le note dans page.requetesPolicesTierces.
 *
 * Usage : node tests/polices_locales.test.cjs
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const aide = require('./aide-parcours.cjs');
const { TOUTES } = require('./fixtures/offres.cjs');

const RACINE = path.join(__dirname, '..');
const POIDS_MAX = 120000;
const FICHIER_POLICE = 'assets/polices/Inter-latin-variable.woff2';
const TIERS = /fonts\.(googleapis|gstatic)\.com/;

const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');

/* Pages qui chargent Inter : tous les HTML du site, sauf la page de revue
   (outil interne qui n'a jamais chargé la police) ; plus la page 404. */
const PAGES_INTER = [
  ['accueil', '/index.html'],
  ['board', '/job-board.html'],
  ['a-propos', '/a-propos.html'],
  ['cgu', '/cgu.html'],
  ['confidentialite', '/confidentialite.html'],
  ['contact', '/contact.html'],
  ['entreprises', '/claim-entreprises.html'],
  ['observatoire', '/claim-observatoire.html'],
  ['monitoring', '/monitoring.html'],
  ['404', '/public/404.html'],
];

/* ── 1. Plus de Google Fonts dans les sources ───────────────────────────── */

test('aucune page, aucun gabarit n\'appelle Google Fonts', () => {
  const fichiers = [
    ...fs.readdirSync(RACINE).filter((f) => f.endsWith('.html')),
    'public/404.html',
    'api/offre.js',
    'src/pages/_offre-rendu.js',
    'src/pages/monitoring.js',
    ...fs.readdirSync(path.join(RACINE, 'assets')).filter((f) => f.endsWith('.css')).map((f) => 'assets/' + f),
  ];
  for (const rel of fichiers) {
    assert.doesNotMatch(lire(rel), TIERS,
      `${rel} appelle encore Google Fonts : relancer node tools/codemod-polices.cjs`);
  }
});

test('chaque page a la police locale : prechargement puis feuille polices.css', () => {
  for (const [nom, url] of PAGES_INTER) {
    const html = lire(url.replace(/^\//, ''));
    const iPreload = html.indexOf('rel="preload" href="/assets/polices/Inter-latin-variable.woff2" as="font" type="font/woff2" crossorigin');
    const iFeuille = html.indexOf('<link rel="stylesheet" href="/assets/polices.css"');
    assert.ok(iPreload > 0, `${nom} : prechargement de la police absent`);
    assert.ok(iFeuille > iPreload, `${nom} : polices.css absente ou avant le prechargement`);
    assert.ok(iFeuille < html.indexOf('</head>'), `${nom} : polices.css hors du <head>`);
  }
});

test('la pile de polices contient le repli aux memes proportions', () => {
  for (const [nom, url] of PAGES_INTER) {
    if (nom === 'monitoring') continue; // sa pile est dans assets/monitoring.css
    const html = lire(url.replace(/^\//, ''));
    assert.match(html, /'Inter', 'Inter Fallback'/, `${nom} : 'Inter Fallback' absent de la pile de polices`);
  }
  assert.match(lire('assets/monitoring.css'), /--police: 'Inter', 'Inter Fallback'/);
});

/* ── 2. Le poids ───────────────────────────────────────────────────────── */

test('le fichier de police est reduit (<= 120 000 octets) et sa licence est jointe', () => {
  const taille = fs.statSync(path.join(RACINE, FICHIER_POLICE)).size;
  assert.ok(taille > 10000, `fichier de police suspect : ${taille} octets`);
  assert.ok(taille <= POIDS_MAX, `fichier de police trop lourd : ${taille} octets (max ${POIDS_MAX})`);
  assert.ok(fs.existsSync(path.join(RACINE, 'assets/polices/Inter-LICENSE.txt')), 'licence Inter absente');
  const css = lire('assets/polices.css');
  assert.match(css, /font-family:\s*'Inter';[^}]*font-weight:\s*300 900;[^}]*font-display:\s*swap;[^}]*Inter-latin-variable\.woff2/s,
    'declaration @font-face d\'Inter incorrecte (famille, graisses 300 900, swap, fichier)');
});

/* ── 3. Le codemod est idempotent ──────────────────────────────────────── */

test('le codemod relance ne change rien', () => {
  const r = spawnSync(process.execPath, [path.join(RACINE, 'tools/codemod-polices.cjs'), '--verifier'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `le codemod voudrait encore modifier des fichiers :\n${r.stdout}${r.stderr}`);
});

/* ── 4. Dans le navigateur ─────────────────────────────────────────────── */

async function mesurer(page, chemin) {
  const octets = [];
  page.on('response', async (r) => {
    if (r.request().resourceType() !== 'font') return;
    try { octets.push({ url: r.url(), statut: r.status(), taille: (await r.body()).length }); } catch (e) { /* abandon */ }
  });
  await page.goto(aide.BASE + chemin, { waitUntil: 'load', timeout: 45000 });
  await aide.attendre(page, 1200);
  await page.evaluate(() => document.fonts.ready);

  const faces = await page.evaluate(() => [...document.fonts].map((f) => ({ famille: f.family.replace(/["']/g, ''), statut: f.status })));
  /* La police REELLEMENT rendue, d'apres le moteur (pas d'apres le CSS). */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const doc = await cdp.send('DOM.getDocument');
  let rendue = [];
  for (const sel of ['h1', 'h2', 'p', 'a']) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel });
    if (!nodeId) continue;
    const pf = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    if (pf.fonts.length) { rendue = pf.fonts; break; }
  }
  return { octets, faces, rendue };
}

test('navigateur : zero requete tierce, Inter locale rendue, poids <= 120 000', async (t) => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  t.after(async () => { await aide.arreterNavigateur(); await aide.arreterServeur(); });

  for (const [nom, chemin] of PAGES_INTER) {
    const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
    try {
      const m = await mesurer(page, chemin);

      assert.deepEqual(page.requetesPolicesTierces, [],
        `${nom} : requete(s) vers Google Fonts : ${JSON.stringify(page.requetesPolicesTierces)}`);
      assert.deepEqual(page.appelsExternes.filter((a) => TIERS.test(a.url)), [],
        `${nom} : le garde reseau a vu un appel vers Google Fonts`);

      const inter = m.faces.find((f) => f.famille === 'Inter');
      assert.ok(inter, `${nom} : aucune police « Inter » declaree (document.fonts : ${JSON.stringify(m.faces)})`);
      assert.equal(inter.statut, 'loaded', `${nom} : Inter n'est pas chargee (${inter.statut})`);

      assert.ok(m.rendue.some((f) => /^Inter/.test(f.familyName) && f.isCustomFont),
        `${nom} : le texte n'est pas rendu avec Inter (police web) : ${JSON.stringify(m.rendue)}`);

      assert.ok(m.octets.length >= 1 && m.octets.every((o) => o.statut === 200 && o.url.startsWith(aide.BASE + '/assets/polices/')),
        `${nom} : la police doit venir du site : ${JSON.stringify(m.octets)}`);
      const total = m.octets.reduce((a, o) => a + o.taille, 0);
      assert.ok(total <= POIDS_MAX, `${nom} : ${total} octets de police (max ${POIDS_MAX})`);
    } finally {
      await ctx.close();
    }
  }
});

test('navigateur : la fiche d\'offre garde la police du systeme (aucun Inter, aucun Google)', async (t) => {
  await aide.demarrerServeur();
  await aide.demarrerNavigateur();
  t.after(async () => { await aide.arreterNavigateur(); await aide.arreterServeur(); });

  const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
  try {
    const m = await mesurer(page, '/offre/' + TOUTES[0].slug);
    assert.deepEqual(page.requetesPolicesTierces, [], 'la fiche appelle Google Fonts');
    assert.deepEqual(m.octets, [], 'la fiche ne doit charger aucune police web : ' + JSON.stringify(m.octets));
    const famille = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    assert.match(famille, /system-ui/, 'la police de la fiche doit rester celle du systeme : ' + famille);
  } finally {
    await ctx.close();
  }
});
