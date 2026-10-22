#!/usr/bin/env node
// tools/run-tests.cjs — Exécuteur de tests CLAIM!
//
// Un seul point d entrée pour tous les tests du dépôt.
//
// Pourquoi un exécuteur maison plutôt que `node --test` : les tests
// existants sont des scripts autonomes (process.exit(1) en cas d échec),
// écrits avant tout cadre de test. Les faire tourner dans un exécuteur qui
// sait les découvrir, les isoler et les chronométrer évite de les réécrire
// avant d avoir des tests.
//
// Points importants :
//   - chaque fichier est un processus séparé : un test qui crash ne peut pas
//     masquer les autres, et un `process.exit` premature ne tue pas la suite ;
//   - un fichier absent, vide ou qui ne produit aucun code de sortie est
//     une ÉCHEC, jamais une réussite ;
//   - chaque fichier a un délai maximal ;
//   - les groupes permettent de séparer les suites locales des suites qui
//     parlent à la production.
//
// Usage :
//   node tools/run-tests.cjs                     toutes les suites hors production
//   node tools/run-tests.cjs --groupe=static     une seule famille
//   node tools/run-tests.cjs --fichier=tests/x   un seul fichier
//   node tools/run-tests.cjs --live              inclut les suites production
//   node tools/run-tests.cjs --liste             affiche les fichiers trouvés

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'tests');

// Familles de tests. Le nom du fichier décide de la famille : c est ce qui
// permet de faire tourner « les tests qui ne parlent pas au réseau » sans
// avoir à toucher à chaque fichier.
const FAMILLES = {
  // Ne touchent jamais le réseau. Doivent rester verts à chaque PR.
  static: [
    'tests/fondation.test.cjs',
    'tests/contrats_ga4.test.cjs',
    'tests/metier.test.cjs',
    'tests/annuaire.test.cjs',
    'tests/securite.test.cjs',
    'tests/sitemap.test.cjs',
    'tests/robots_routage.test.cjs',
  ],
  // Touchent le backend simulé local. Ne touchent pas la production.
  unit: [
    'tests/offre_http.test.cjs',
    'tests/offre_rendu.test.cjs',
    'tests/proxy_jobs.test.cjs',
  ],
  // Intégration : le gestionnaire de fiche avec un backend simulé.
  integration: [
    'tests/offre_seo_local.test.cjs',
    'tests/ga4_evenements.test.cjs',
  ],
  // Suites historiques : assertions textuelles, fragiles. Migrées au fil de
  // l eau. Ne bloquent pas encore la fusion. Elles sont remplacées une à une
  // par les suites des familles précédentes.
  legacy: [
    'tests/cards.test.cjs',
    'tests/consentement.test.cjs',
    'tests/defilement_fiche_conserve.test.cjs',
    'tests/detail_sans_entete.test.cjs',
    'tests/effacement_defilement_fiche.test.cjs',
    'tests/entete_fiche_sobre.test.cjs',
    'tests/fiche_rendu_immediat.test.cjs',
    'tests/fiche_style_offre.test.cjs',
    'tests/ga4_present.test.cjs',
    'tests/mesure_items.test.cjs',
    'tests/params_mesure.test.cjs',
    'tests/rail_fiche.test.cjs',
  ],
  // Touchent la production. Alerte seulement, jamais bloquantes.
  live: [
    'tests/seo_offre.test.cjs',
  ],
};


const DELAI_PAR_FICHIER = { legacy: 30000, live: 60000 };
const DELAI_PAR_DEFAUT = 20000;

// Variables d environnement propres à certains fichiers.
//
// Un test qui lit process.env.PAGE a besoin qu on le lui donne : sinon il
// échoue pour une raison qui n a rien à voir avec le code qu il vérifie.
// Chaque page est donc testée à son tour, dans le même processus.
const ENVIRONNEMENT = {
  'tests/ga4_present.test.cjs': { PAGE: 'index.html' },
};

// Un fichier qui se déclare « legacy » ou « live » est signalé, pas ignoré.
const GROUPE_PAR_DEFAUT = ['static', 'unit', 'integration'];

function analyserArgs() {
  const args = process.argv.slice(2);
  const out = { groupe: null, fichier: null, live: false, liste: false };
  for (const a of args) {
    if (a.startsWith('--groupe=')) out.groupe = a.slice('--groupe='.length);
    else if (a.startsWith('--fichier=')) out.fichier = a.slice('--fichier='.length);
    else if (a === '--live') out.live = true;
    else if (a === '--liste') out.liste = true;
    else if (a === '--tous') { out.groupe = 'all'; }
  }
  return out;
}

function relier(p) {
  return path.relative(RACINE, p).split(path.sep).join('/');
}

// Tous les fichiers de test réellement présents sur le disque.
function fichiersSurDisque() {
  if (!fs.existsSync(DOSSIER)) return [];
  return fs.readdirSync(DOSSIER)
    .filter((f) => f.endsWith('.test.cjs'))
    .map((f) => `tests/${f}`)
    .sort();
}

// Les fichiers déclarés dans les familles, plus ceux trouvés sur le disque.
// Un fichier sur le disque mais absent des familles ne doit pas passer
// inaperçu : c est le symptôme d un test oublié.
function collecter() {
  const surDisque = fichiersSurDisque();
  const declares = new Set();
  for (const liste of Object.values(FAMILLES)) for (const f of liste) declares.add(f);

  const orphelins = surDisque.filter((f) => !declares.has(f));
  const absents = [...declares].filter((f) => !surDisque.includes(f));

  return { surDisque, orphelins, absents };
}

function lancer(fichier) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const delai = DELAI_PAR_FICHIER[GROUPE_DE_FICHIER.get(fichier)] || DELAI_PAR_DEFAUT;

    const enfant = spawn(process.execPath, [path.join(RACINE, fichier)], {
      cwd: RACINE,
      env: { ...process.env, ...(ENVIRONNEMENT[fichier] || {}), CLAIM_TEST: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let sortie = '';
    let err = '';
    let fini = false;

    const minuteur = setTimeout(() => {
      if (fini) return;
      fini = true;
      enfant.kill('SIGKILL');
      resolve({ fichier, ok: false, code: null, duree: Date.now() - debut, sortie, err: 'délai dépassé (' + delai + ' ms)', delaiDepasse: true });
    }, delai);

    enfant.stdout.on('data', (d) => { sortie += d.toString(); });
    enfant.stderr.on('data', (d) => { err += d.toString(); });

    enfant.on('error', (e) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      resolve({ fichier, ok: false, code: null, duree: Date.now() - debut, sortie, err: 'impossible de lancer le fichier : ' + e.message });
    });

    enfant.on('close', (code) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      resolve({ fichier, ok: code === 0, code, duree: Date.now() - debut, sortie, err });
    });
  });
}

const GROUPE_DE_FICHIER = new Map();
for (const [groupe, liste] of Object.entries(FAMILLES)) for (const f of liste) GROUPE_DE_FICHIER.set(f, groupe);

(async () => {
  const args = analyserArgs();
  const { surDisque, orphelins, absents } = collecter();

  if (args.liste) {
    console.log('Fichiers de test trouvés (' + surDisque.length + ') :');
    for (const f of surDisque) console.log('  ' + f + '  [' + (GROUPE_DE_FICHIER.get(f) || 'NON CLASSÉ') + ']');
    if (orphelins.length) {
      console.log('\nOrphelins (présents mais sans famille) :');
      for (const f of orphelins) console.log('  ' + f);
    }
    if (absents.length) {
      console.log('\nDéclarés mais absents :');
      for (const f of absents) console.log('  ' + f);
    }
    process.exit(0);
  }

  // Un test déclaré mais absent est une erreur de configuration : on la
  // signale comme un échec, jamais comme un silence.
  if (absents.length) {
    console.error('Fichiers de test déclarés mais absents :');
    for (const f of absents) console.error('  ' + f);
    console.error('\nCes fichiers sont attendus par une famille. Créez-les ou corrigez la famille.');
    process.exit(1);
  }

  // Un test orphelin est un test qui ne s exécute jamais. On le signale fort.
  if (orphelins.length) {
    console.error('Fichiers de test sans famille : ils ne s"exécuteraient jamais.');
    for (const f of orphelins) console.error('  ' + f);
    console.error('\nChaque fichier doit être déclaré dans une famille de tools/run-tests.cjs.');
    process.exit(1);
  }

  let groupes;
  if (args.fichier) groupes = [args.fichier];
  else if (args.groupe === 'all') groupes = Object.keys(FAMILLES);
  else if (args.groupe) groupes = [args.groupe];
  else groupes = GROUPE_PAR_DEFAUT.concat(args.live ? ['live'] : []);

  const aExecuter = [];
  for (const g of groupes) {
    const liste = FAMILLES[g];
    if (!liste) {
      console.error('Groupe inconnu : ' + g);
      console.error('Groupes disponibles : ' + Object.keys(FAMILLES).join(', '));
      process.exit(1);
    }
    for (const f of liste) if (!aExecuter.includes(f)) aExecuter.push(f);
  }

  console.log('Exécution de ' + aExecuter.length + ' fichier(s) de test.');
  console.log('');

  const resultats = [];
  let echecs = 0;
  let totaux = 0;

  for (const f of aExecuter) {
    const r = await lancer(f);
    resultats.push(r);
    totaux += r.duree;
    if (r.ok) {
      console.log('  ✓ ' + f + '  (' + r.duree + ' ms)');
    } else {
      echecs++;
      console.log('  ✗ ' + f + '  (' + r.duree + ' ms)' + (r.code === null ? '  [sans code de sortie]' : '  [code ' + r.code + ']'));
      const detail = (r.err || r.sortie || '').trim();
      if (detail) {
        const lignes = detail.split('\n');
        for (const l of lignes.slice(-12)) console.log('      ' + l);
      }
    }
  }

  console.log('');
  console.log('Bilan : ' + (aExecuter.length - echecs) + ' réussi(s), ' + echecs + ' échec(s), ' + totaux + ' ms.');
  process.exit(echecs > 0 ? 1 : 0);
})();
