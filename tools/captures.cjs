/* Captures de référence CLAIM! — bureau et téléphone, jour et nuit.
   Usage :
     node tools/captures.cjs <dossier-de-sortie>
   Le thème est posé par localStorage (déterministe) ; un test séparé vérifie
   que le bouton de bascule produit le même résultat par un clic réel. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8099';
const DOSSIER = process.argv[2] || path.join(__dirname, '..', 'captures');

const FORMATS = [
  { id: 'bureau', viewport: { width: 1440, height: 900 }, isMobile: false, dsf: 1 },
  { id: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, dsf: 2 },
];

/* Chaque scénario : une page, une action, un nom de fichier. */
const SCENARIOS = [
  { nom: 'accueil', page: '/index.html' },
  { nom: 'board', page: '/job-board.html' },
  { nom: 'board-fiche', page: '/job-board.html', action: 'fiche' },
  { nom: 'board-menu', page: '/job-board.html', action: 'menu' },
  { nom: 'entreprises', page: '/claim-entreprises.html' },
  { nom: 'observatoire', page: '/claim-observatoire.html' },
  { nom: 'review', page: '/claim-review.html' },
];

async function stabiliser(page) {
  await page.waitForLoadState('domcontentloaded');
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch (e) {}
  await page.waitForTimeout(1400);
}

async function executerAction(page, action) {
  if (!action) return;
  if (action === 'fiche') {
    // Ouvre la première offre du board pour Observer la fiche de poste.
    const carte = page.locator('.jc, .oc').first();
    if (await carte.count()) {
      await carte.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1600);
    }
  }
  if (action === 'menu') {
    const burger = page.locator('.btn-burger').first();
    if (await burger.count() && await burger.isVisible().catch(() => false)) {
      await burger.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
}

(async () => {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const browser = await chromium.launch();
  const bilan = [];

  for (const fmt of FORMATS) {
    for (const sc of SCENARIOS) {
      for (const theme of ['jour', 'nuit']) {
        const ctx = await browser.newContext({
          viewport: fmt.viewport,
          isMobile: fmt.isMobile,
          hasTouch: fmt.isMobile,
          deviceScaleFactor: fmt.dsf,
          locale: 'fr-FR',
          colorScheme: 'light',
        });
        // Préférence posée avant le chargement : la page démarre dans le bon thème.
        await ctx.addInitScript((t) => {
          try { localStorage.setItem('claim-theme', t); } catch (e) {}
        }, theme);

        const page = await ctx.newPage();
        const erreurs = [];
        page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));

        try {
          await page.goto(BASE + sc.page, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e) {
          erreurs.push('goto: ' + e.message);
        }
        await stabiliser(page);
        await executerAction(page, sc.action);

        const fichier = path.join(DOSSIER, `${sc.nom}-${fmt.id}-${theme}.png`);
        await page.screenshot({ path: fichier, fullPage: true }).catch((e) => erreurs.push('shot: ' + e.message));

        const mesure = await page.evaluate(() => ({
          themeAttr: document.documentElement.getAttribute('data-theme') || 'jour',
          debord: document.documentElement.scrollWidth > window.innerWidth + 1,
          largeur: document.documentElement.scrollWidth,
          fenetre: window.innerWidth,
          bouton: (() => {
            const b = document.querySelector('.bascule-theme');
            if (!b) return 'absent';
            const r = b.getBoundingClientRect();
            if (getComputedStyle(b).display === 'none') return 'masque';
            return r.width >= 1 && r.height >= 1 ? 'visible' : 'nulle';
          })(),
        })).catch(() => ({}));

        bilan.push({ scenario: sc.nom, format: fmt.id, theme, ...mesure, erreurs });
        console.log(
          `${sc.nom.padEnd(16)} ${fmt.id.padEnd(7)} ${theme.padEnd(5)} theme=${mesure.themeAttr} ` +
          `debord=${mesure.debord} bouton=${mesure.bouton} erreurs=${erreurs.length}`
        );
        await ctx.close();
      }
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(DOSSIER, 'bilan.json'), JSON.stringify(bilan, null, 2));
})();
