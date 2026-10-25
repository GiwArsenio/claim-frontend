/* Le defilement doit s'arreter au pied de page.
 *
 * Sur iPad Safari, le document pouvait etre tire au-dela de sa fin : le
 * canvas du navigateur debordait du body, et une zone vide apparaissait
 * sous le pied de page, dans une couleur qui n'appartenait pas au site.
 *
 * Deux causes, verifiees ici :
 *
 *   1. LE PLAN DE PAGE. Le fond etait pose sur le body, mais pas sur
 *      html. Or c'est le body qui peint le canvas quand html n'a pas de
 *      fond — et le body ne couvre que la hauteur de son contenu. Sur
 *      une fenetre plus haute que le document, ou au moment du rebond,
 *      le canvas debordait. Le fond est desormais pose sur les deux,
 *      via le jeton --plan, que chaque page definit.
 *
 *   2. LE DEBORDEMENT. Le defilement au-dela des bornes est desactive :
 *      le document ne glisse plus sous le pied.
 *
 * Le test mesure la couleur de la derniere ligne de pixels de la
 * capture : elle doit etre le teal du pied, pas une zone vide. C'est la
 * seule verification qui parle de ce que voit l'oeil.
 *
 * Usage : node tests/pied_arret_defilement.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const aide = require('./aide-parcours.cjs');

const PAGES = [
  { slug: '/index.html', nom: 'accueil' },
  { slug: '/claim-entreprises.html', nom: 'entreprises' },
  { slug: '/claim-observatoire.html', nom: 'observatoire' },
  { slug: '/a-propos.html', nom: 'a-propos' },
  { slug: '/cgu.html', nom: 'cgu' },
  { slug: '/confidentialite.html', nom: 'confidentialite' },
  { slug: '/contact.html', nom: 'contact' },
];

/* Le teal du pied : rgb(0, 104, 118). */
const TEAL = { r: 0, g: 104, b: 118 };
const TOLERANCE = 40;

function estTeal(r, g, b) {
  return Math.abs(r - TEAL.r) <= TOLERANCE
      && Math.abs(g - TEAL.g) <= TOLERANCE
      && Math.abs(b - TEAL.b) <= TOLERANCE;
}

/* Un format qui reproduit la fenêtre d'un iPad : plus court que le
   document, pour que le pied ne soit pas colle au bas par hasard. */
const IPAD = { viewport: { width: 959, height: 700 }, isMobile: true, hasTouch: true };

test('le defilement s\'arrete au pied de page', async (t) => {
  const serveurPret = !process.env.CLAIM_BASE;
  if (serveurPret) await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();
  t.after(async () => {
    await aide.arreterNavigateur();
    if (serveurPret) await aide.arreterServeur();
  });

  for (const page of PAGES) {
    const ctx = await nav.newContext({
      viewport: IPAD.viewport,
      isMobile: IPAD.isMobile,
      hasTouch: IPAD.hasTouch,
      locale: 'fr-FR',
      deviceScaleFactor: 1,
    });
    const onglet = await ctx.newPage();
    await onglet.goto(aide.BASE + page.slug, { waitUntil: 'domcontentloaded' });
    await aide.attendre(onglet, 1800);

    /* Le bandeau de consentement disparait, pour ne pas masquer le pied. */
    await onglet.evaluate(() => {
      const b = document.querySelector('#claim-consentement button[data-consent="accepte"]')
             || document.querySelector('#claim-consentement button');
      if (b) b.click();
    });
    await aide.attendre(onglet, 500);

    /* On descend jusqu'en bas, par paliers. */
    for (let i = 0; i < 45; i++) {
      await onglet.evaluate(() => window.scrollBy(0, 500));
      await aide.attendre(onglet, 35);
    }
    await aide.attendre(onglet, 800);

    const mesure = await onglet.evaluate(() => {
      const html = document.documentElement;
      const ft = document.querySelector('#ft');
      const r = ft.getBoundingClientRect();
      return {
        plan: getComputedStyle(html).backgroundColor,
        overscroll: getComputedStyle(html).overscrollBehaviorY,
        piedBas: Math.round(r.bottom),
        fenetre: window.innerHeight,
      };
    });

    /* 1. Le plan de page est pose, et le debordement est desactive. */
    assert.notEqual(mesure.plan, 'rgba(0, 0, 0, 0)',
      `${page.nom} : le fond du plan est transparent — le canvas debordera du body`);
    assert.equal(mesure.overscroll, 'none',
      `${page.nom} : le defilement n'est pas arrete au pied`);

    /* 2. Le pied est bien en bas de la fenetre. */
    assert.ok(mesure.fenetre - mesure.piedBas <= 2,
      `${page.nom} : ${mesure.fenetre - mesure.piedBas} px de vide sous le pied`);

    /* 3. La derniere ligne de pixels est le teal du pied — ce que voit
          l'oeil, pas ce que dit la mesure. */
    const capture = await onglet.screenshot();
    const { PNG } = require('pngjs');
    const png = PNG.sync.read(capture);
    const x = Math.floor(png.width / 2);
    const y = png.height - 3;
    const i = (png.width * y + x) << 2;
    const r = png.data[i], g = png.data[i+1], b = png.data[i+2];
    assert.ok(estTeal(r, g, b),
      `${page.nom} : la derniere ligne est rgb(${r},${g},${b}), pas le teal du pied — une zone vide`);

    await ctx.close();
  }
});
