/* ─────────────────────────────────────────────────────────────────────────────
   LE LIEU, TEL QU'ON LE LIT (T04)

   L'API publie « FR, Paris » ou « MA, Casablanca ». Un code pays brut ne se lit
   pas : l'interface affiche « Paris » et « Casablanca (Maroc) ». Ce test tient
   quatre promesses :

   A. la fonction pure assets/lieu.js (France, étranger, inconnu, vide, déjà
      propre) et la couverture de la table ;
   B. aucun « e.g. » anglais dans l'interface (HTML et JS) ;
   C. les trois surfaces (accueil, board, fiche autonome) utilisent la fonction ;
   D. une ville n'apparaît qu'une fois sur une fiche, et la donnée envoyée aux
      moteurs de recherche (JSON-LD) n'est PAS modifiée (observation O1).
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
const formaterLieu = require('../assets/lieu.js');

// ── A. La fonction ─────────────────────────────────────────────────────────
assert.equal(typeof formaterLieu, 'function');
assert.equal(formaterLieu('FR, Paris'), 'Paris', 'France : le pays ne se dit pas');
assert.equal(formaterLieu('MA, Casablanca'), 'Casablanca (Maroc)', 'étranger : pays entre parenthèses');
assert.equal(formaterLieu('IN, Bengaluru'), 'Bengaluru (Inde)');
assert.equal(formaterLieu('FR,Lyon'), 'Lyon', 'espace après la virgule facultatif');
assert.equal(formaterLieu('  GB, Londres '), 'Londres (Royaume-Uni)', 'espaces autour ignorés');

// Tous les pays de la fiche de tâche.
const attendus = {
  FR: 'France', MA: 'Maroc', IN: 'Inde', GB: 'Royaume-Uni', DE: 'Allemagne', ES: 'Espagne',
  BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg', IE: 'Irlande', US: 'États-Unis',
  NL: 'Pays-Bas', IT: 'Italie', PT: 'Portugal',
};
for (const [code, pays] of Object.entries(attendus)) {
  const rendu = formaterLieu(code + ', Ville');
  assert.equal(rendu, code === 'FR' ? 'Ville' : 'Ville (' + pays + ')', 'code ' + code);
}

// Code inconnu : la valeur brute, jamais d'erreur ni de pays inventé.
assert.equal(formaterLieu('XX, Quelquepart'), 'XX, Quelquepart');
// Vide ou absent : chaîne vide, sans erreur.
for (const v of ['', '   ', null, undefined]) assert.equal(formaterLieu(v), '', JSON.stringify(v));
assert.equal(formaterLieu('FR,'), 'FR,', 'code sans lieu : rendu brut');
// Déjà sans code : inchangé, donc idempotent.
assert.equal(formaterLieu('Paris'), 'Paris');
assert.equal(formaterLieu('Casablanca (Maroc)'), 'Casablanca (Maroc)');
for (const v of ['FR, Paris', 'MA, Casablanca', 'XX, Foo', 'Paris']) {
  assert.equal(formaterLieu(formaterLieu(v)), formaterLieu(v), 'idempotence : ' + v);
}
// Un nombre ou un objet ne fait pas tomber la fonction.
assert.doesNotThrow(() => { formaterLieu(42); formaterLieu({}); formaterLieu([]); });

// Les lieux des fixtures (sans code) passent tels quels ; ceux qui portent un
// code sont couverts par la table.
const { TOUTES: liste } = require('./fixtures/offres.cjs');
assert.ok(liste.length > 0, 'les fixtures doivent fournir des offres');
for (const o of liste) {
  const brut = o.ville || o.city;
  if (!brut) continue;
  const code = /^([A-Z]{2}),/.exec(brut);
  if (code) assert.notEqual(formaterLieu(brut), brut, 'code des fixtures non couvert : ' + code[1]);
  else assert.equal(formaterLieu(brut), brut, 'un lieu sans code reste inchangé : ' + brut);
}

// ── B. Plus de « e.g. » ────────────────────────────────────────────────────
for (const f of ['index.html', 'job-board.html', 'api/offre.js', 'src/pages/_offre-rendu.js']) {
  assert.ok(!/e\.g\./.test(lire(f)), f + ' contient encore « e.g. »');
}
assert.ok(lire('index.html').includes('placeholder="Mots-clés (ex. Actuaire, Data Scientist)"'));
const board = lire('job-board.html');
assert.ok(board.includes('placeholder="Mots-clés (ex. Actuaire, Data Scientist)"'), 'HTML du board');
assert.ok(board.includes(": 'Mots-clés (ex. Actuaire, Data Scientist)';"), 'chaîne JS (logique responsive)');

// ── C. Les trois surfaces appellent la fonction ────────────────────────────
const accueil = lire('index.html');
assert.ok(accueil.includes('<script src="/assets/lieu.js"></script>'), "l'accueil charge lieu.js");
assert.ok(board.includes('<script src="/assets/lieu.js"></script>'), 'le board charge lieu.js');
assert.ok(/function badgeLieu\(brut\) \{\s*const ville = formaterLieu\(brut\);/.test(accueil), "carte de l'accueil");
assert.ok(/function cardLocationHtml\(j\) \{[\s\S]*?const ville = formaterLieu\(j\.ville\);/.test(board), 'carte du board');
assert.ok(board.includes("escapeHtml(formaterLieu(j.ville) || 'Lieu non précisé')"), 'pastille du détail');
const offreJs = lire('api/offre.js');
assert.ok(offreJs.includes("require('../assets/lieu.js')"), 'la fiche autonome charge lieu.js');
assert.ok(lire('src/pages/_offre-rendu.js').includes("import formaterLieu from '../../assets/lieu.js';"), 'rendu du Worker');
assert.ok(lire('scripts/aligner-rendu.py').includes("import formaterLieu from '../../assets/lieu.js';"),
  "l'alignement du Worker ajoute l'import");

// ── D. Une seule mention de la ville, et le JSON-LD intact ─────────────────
const dco = /<div class="dco">([^<]*(?:<(?!\/div>)[^<]*)*)<\/div>/.exec(board);
assert.ok(dco, 'bloc .dco du détail introuvable');
assert.ok(!/ville/.test(dco[1]), 'le détail ne répète plus la ville sous le titre');
assert.ok(!/<div class="societe">.*ville/.test(offreJs.replace(/\n/g, ' ')), 'la fiche ne répète plus la ville');

(async () => {
  const handler = require('../api/offre.js');
  const job = {
    slug: 'offre-test-lieu', title: 'Actuaire junior', source: 'welcome',
    ville: 'MA, Casablanca', contract_type: 'cdi',
    companies: { name: 'Société Exemple', slug: 'societe-exemple' },
    description_raw: '<p>Poste à pourvoir au sein d\'une équipe de risques.</p>',
  };
  const fetchOrigine = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => job });
  let rendu;
  try {
    rendu = await new Promise((resolve) => {
      const res = {
        statusCode: null, corps: null, setHeader() {},
        status(c) { this.statusCode = c; return this; },
        send(v) { this.corps = v; resolve(this); },
      };
      handler({ query: { slug: job.slug } }, res);
    });
  } finally {
    global.fetch = fetchOrigine;
  }
  assert.equal(rendu.statusCode, 200);
  const h = rendu.corps;

  const pastille = /<span class="pastille pastille-ville">([^<]*)<\/span>/.exec(h);
  assert.ok(pastille, 'pastille de ville absente');
  assert.equal(pastille[1], 'Casablanca (Maroc)', 'la pastille affiche le lieu lisible');

  // Texte visible (hors scripts, styles et balises <head>) : « Casablanca »
  // n'y figure qu'une fois.
  const visible = h.replace(/<head>[\s\S]*?<\/head>/, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  assert.equal((visible.match(/Casablanca/g) || []).length, 1, 'la ville ne doit apparaître qu\'une fois sur la fiche');
  assert.ok(!/Société Exemple\s*·/.test(visible), 'plus de « Société · Ville » sous le titre');

  // Observation O1 : la donnée structurée n'est pas touchée par cette tâche.
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h)[1]);
  assert.equal(ld.jobLocation.address.addressLocality, 'MA, Casablanca', 'le JSON-LD garde la valeur de l\'API');

  console.log('Lieux et textes : tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
