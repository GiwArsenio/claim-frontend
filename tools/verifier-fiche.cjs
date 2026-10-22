/* Vérifie le rendu de la fiche autonome (api/offre.js) en jour et en nuit.
   La fonction serveur est executee localement, avec le vrai backend. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..');
const PORT = 8097;
const SLUG = process.argv[2] || 'data-scientist-internship-6-months-4ba884089329';

/* api/offre.js interroge le backend en dur. On le pointe sur la production. */
const source = fs.readFileSync(path.join(RACINE, 'api', 'offre.js'), 'utf8');
const modif = source.replace(
  /const API_BASE\s*=\s*[^;]+;/,
  "const API_BASE = 'https://claim-api-production-06b3.up.railway.app/api/v1';"
);
fs.writeFileSync('/tmp/offre-local.js', modif);
const handler = require('/tmp/offre-local.js');

function parseRGB(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function luminance(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contraste(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith('/offre/')) {
    const reponse = {
      status(c) { this.code = c; return this; },
      setHeader() {},
      send(html) { res.writeHead(this.code || 200, {'Content-Type':'text/html; charset=utf-8'}); res.end(html); },
      json(o) { res.writeHead(this.code || 200); res.end(JSON.stringify(o)); },
    };
    try { await handler({ query: { slug: SLUG }, headers: {} }, reponse); }
    catch (e) { res.writeHead(500); res.end(String(e)); }
    return;
  }
  let c = url.pathname === '/' ? '/index.html' : url.pathname;
  const f = path.join(RACINE, c);
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('x'); return; }
  const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png' };
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => serveur.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();

  for (const theme of ['jour', 'nuit']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('claim-theme', t); } catch (e) {} }, theme);
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/offre/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const mesure = await page.evaluate(() => {
      const parse = (s) => {
        const m = /rgba?\(([^)]+)\)/.exec(s || '');
        if (!m) return null;
        const q = m[1].split(',').map((x) => parseFloat(x));
        return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 };
      };
      const body = parse(getComputedStyle(document.body).backgroundColor);
      const encre = parse(getComputedStyle(document.body).color);
      const bouton = document.querySelector('.bascule-theme');
      return {
        theme: document.documentElement.getAttribute('data-theme') || 'jour',
        fond: body, encre,
        aLeTheme: Array.from(document.styleSheets).some((s) => (s.href || '').includes('theme.css')),
        bouton: !!bouton,
        titre: (document.querySelector('h1') || {}).textContent || '(aucun)',
      };
    });

    const ratio = mesure.fond && mesure.encre ? contraste(mesure.encre, mesure.fond) : null;
    console.log(`[${theme}] theme=${mesure.theme} fond=${mesure.fond && mesure.fond.rgb} texte=${mesure.encre && mesure.encre.rgb} contraste=${ratio ? ratio.toFixed(2) : '?'} bouton=${mesure.bouton} theme.css=${mesure.aLeTheme} erreurs=${erreurs.length}`);
    console.log(`        titre: ${mesure.titre.slice(0, 70)}`);

    await page.screenshot({ path: `/tmp/fiche-${theme}.png`, fullPage: true });
    await ctx.close();
  }

  await browser.close();
  serveur.close();
})();
