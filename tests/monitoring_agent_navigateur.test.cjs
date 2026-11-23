'use strict';
/* Onglet « Traitements » du dashboard de monitoring : rendu réel dans un navigateur.

   L'API est simulée (aucun réseau). Ce que ce test tient :
   1. un journal illisible s'écrit « Non disponible », jamais « 0 » ;
   2. « non démarré » n'est pas une panne (pas de rouge), « silencieux » en est une ;
   3. tout ce qui vient du journal est du TEXTE : une ligne piégée (<img onerror>,
      <script>) ne crée aucun élément et n'exécute rien ;
   4. sur téléphone, le journal se lit en cartes empilées : pas de défilement
      horizontal de la page, le résumé occupe presque toute la largeur.
   Les autres routes de l'API répondent 500 : l'aperçu affiche son bandeau
   d'erreur, ce qui n'a aucun rapport avec l'onglet testé. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

const il = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ZERO = { alerte_recue: 0, diagnostic: 0, battement: 0, proposition: 0, validation: 0, action: 0, resultat: 0 };
const ligne = (o) => ({ id: 'x', alert_key: null, palier: null, auteur: 'agent', run_ref: null, detail: null, detail_tronque: false, a_corps: false, ...o });

const SCENARIOS = {
  vide: {
    generated_at: il(0), period_days: 7, journal: { disponible: true, raison: null },
    agent: { statut: 'non_demarre', diagnostic: "L'agent n'a encore jamais donné signe de vie.", dernier_battement: null, age_heures: null, seuil_silence_heures: 26 },
    comptes: { ...ZERO }, evenements: [], tronque: false,
  },
  rempli: {
    generated_at: il(0), period_days: 7, journal: { disponible: true, raison: null },
    agent: { statut: 'actif', diagnostic: "L'agent a donné signe de vie récemment. <b>piège</b><img src=x onerror=\"window.__XSS=1\">", dernier_battement: il(2), age_heures: 2, seuil_silence_heures: 26 },
    comptes: { ...ZERO, alerte_recue: 2, diagnostic: 2, battement: 168, proposition: 1 },
    evenements: [
      ligne({ created_at: il(0.2), type: 'proposition', palier: 2, alert_key: 'source_erreur:swiss_life:2026-11-24', resume: 'Relancer la source swiss_life : défi Cloudflare levé depuis 03:10', detail: '{\n  "source": "swiss_life"\n}' }),
      ligne({ created_at: il(1.1), type: 'diagnostic', palier: 1, resume: 'Défi Cloudflare (HTTP 429) : même cause que le 21/11, aucune reprise utile' }),
      ligne({ created_at: il(1.4), type: 'alerte_recue', auteur: 'systeme', resume: 'collecte en échec : 1 source(s) sur 61', detail: '{\n  "envoyee": true\n}', a_corps: true }),
      ligne({ created_at: il(30), type: 'diagnostic', palier: 3, resume: '<img src=x onerror="window.__XSS=1"> <b>résumé hostile</b>', alert_key: '<b>cle</b>', detail: '<script>window.__XSS=1</script>', detail_tronque: true }),
    ],
    tronque: false,
  },
  silencieux: {
    generated_at: il(0), period_days: 7, journal: { disponible: true, raison: null },
    agent: { statut: 'silencieux', diagnostic: 'Aucun signe de vie depuis 40 h (seuil 26 h).', dernier_battement: il(40), age_heures: 40, seuil_silence_heures: 26 },
    comptes: { ...ZERO, alerte_recue: 1, battement: 30 }, evenements: [], tronque: false,
  },
  illisible: {
    generated_at: il(0), period_days: 7, journal: { disponible: false, raison: 'Lecture impossible <img src=x onerror="window.__XSS=1">' },
    agent: { statut: 'inconnu', diagnostic: "Le journal de l'agent n'a pas pu être lu.", dernier_battement: null, age_heures: null, seuil_silence_heures: 26 },
    comptes: null, evenements: [], tronque: false,
  },
};

function serveur() {
  return http.createServer((req, res) => {
    const chemin = decodeURIComponent(req.url.split('?')[0]);
    const fichier = path.join(RACINE, chemin === '/' ? 'monitoring.html' : chemin);
    if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
      res.writeHead(404); return res.end('introuvable');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
    fs.createReadStream(fichier).pipe(res);
  });
}

async function ouvrir(navigateur, scenario, largeur, hauteur, erreurs) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, locale: 'fr-FR' });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  await page.route('**/monitoring/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/session')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"expires_in":3600}' });
    if (url.includes('/agent')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SCENARIOS[scenario]) });
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"hors sujet pour ce test"}' });
  });
  return { contexte, page };
}

test('onglet Traitements : états, échappement et lisibilité sur téléphone', async () => {
  const srv = serveur();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const navigateur = await chromium.launch({ headless: true });
  const erreurs = [];
  try {
    for (const [nom, largeur, hauteur] of [['vide', 1280, 900], ['rempli', 1280, 900], ['rempli', 390, 844], ['silencieux', 1280, 900], ['illisible', 1280, 900], ['illisible', 390, 844]]) {
      const { contexte, page } = await ouvrir(navigateur, nom, largeur, hauteur, erreurs);
      await page.goto(`${base}/monitoring.html`, { waitUntil: 'domcontentloaded' });
      await page.click('#onglet-agent');
      await page.waitForSelector('#corps-agent tr');
      const etiquette = `${nom}/${largeur}`;

      const m = await page.evaluate(() => {
        const cartes = [...document.querySelectorAll('#agent-chiffres .chiffre')].map((c) => ({
          texte: c.textContent.replace(/\s+/g, ' ').trim(), ton: c.dataset.ton,
        }));
        const tr = document.querySelector('#corps-agent tr');
        const resume = document.querySelector('#corps-agent tr td:nth-child(3)');
        return {
          visible: !document.getElementById('panneau-agent').hidden,
          selectionne: document.getElementById('onglet-agent').getAttribute('aria-selected'),
          cartes,
          lignes: document.querySelectorAll('#corps-agent tr').length,
          intrus: document.querySelectorAll('#panneau-agent img, #panneau-agent script, #panneau-agent b').length,
          xss: window.__XSS === 1,
          texteJournal: document.getElementById('corps-agent').textContent,
          debordePage: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          affichageLigne: getComputedStyle(tr).display,
          enteteVisible: getComputedStyle(document.querySelector('#panneau-agent thead')).display !== 'none',
          largeurResume: resume ? resume.getBoundingClientRect().width : 0,
          boutons: document.querySelectorAll('#panneau-agent button, #panneau-agent [role="button"], #panneau-agent a[href]').length,
        };
      });

      assert.ok(m.visible && m.selectionne === 'true', `${etiquette} : l'onglet doit s'ouvrir`);
      assert.equal(m.boutons, 0, `${etiquette} : l'onglet est un suivi, aucune action ne doit s'y déclencher`);
      assert.equal(m.debordePage, false, `${etiquette} : la page ne doit pas défiler horizontalement`);
      assert.equal(m.xss, false, `${etiquette} : rien du journal ne doit s'exécuter`);
      assert.equal(m.intrus, 0, `${etiquette} : le journal est du texte, pas du HTML`);

      if (nom === 'vide') {
        assert.match(m.cartes[0].texte, /Non démarré/);
        assert.equal(m.cartes[0].ton, 'neutre', 'non démarré n\'est pas une panne');
        assert.match(m.texteJournal, /Aucun événement sur la période/);
      }
      if (nom === 'silencieux') {
        assert.match(m.cartes[0].texte, /Silencieux/);
        assert.equal(m.cartes[0].ton, 'critique', 'un agent silencieux est une panne');
      }
      if (nom === 'illisible') {
        assert.equal(m.cartes.length, 1);
        assert.match(m.cartes[0].texte, /Non disponible/);
        assert.doesNotMatch(m.cartes[0].texte, /\b0\b/, 'un journal illisible ne s\'affiche pas comme zéro');
        assert.match(m.texteJournal, /Journal non disponible/);
      }
      if (nom === 'rempli') {
        assert.equal(m.lignes, 4);
        assert.match(m.cartes[0].texte, /Actif/);
        assert.match(m.cartes[0].texte, /<b>piège<\/b>/, 'le texte de l\'agent doit apparaître comme texte dans les cartes');
        assert.match(m.texteJournal, /<img src=x onerror=/, 'la ligne piégée doit apparaître comme texte');
        assert.match(m.texteJournal, /<b>cle<\/b>/, 'la clé d\'alerte aussi');
        assert.match(m.texteJournal, /Palier : À valider|À valider/);
        if (largeur <= 700) {
          assert.equal(m.affichageLigne, 'grid', 'sur téléphone, une ligne est une carte');
          assert.equal(m.enteteVisible, false);
          assert.ok(m.largeurResume >= largeur * 0.8, `sur téléphone, le résumé doit occuper la largeur (${m.largeurResume} px sur ${largeur})`);
        } else {
          assert.equal(m.enteteVisible, true, 'sur ordinateur, le tableau garde son en-tête');
        }
      }
      await contexte.close();
    }
    assert.deepEqual(erreurs, [], `erreurs JavaScript : ${erreurs.join(' | ')}`);
  } finally {
    await navigateur.close();
    srv.close();
  }
});
