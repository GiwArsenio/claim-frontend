#!/usr/bin/env node
// tools/run-tests.cjs — Exécuteur de tests CLAIM!
//
// Un seul point d'entrée pour tous les tests du dépôt.
//
// Pourquoi un exécuteur maison plutôt que `node --test` : les tests du
// dépôt sont des scripts autonomes. Certains utilisent le module
// `node:test`, d'autres lèvent une assertion et s'arrêtent là. Les
// faire tourner dans un exécuteur qui sait les découvrir, les isoler et
// les chronométrer évite de les réécrire avant d'avoir des tests.
//
// Points importants :
//   - chaque fichier est un processus séparé : un test qui crash ne peut
//     pas masquer les autres, et un `process.exit` prématuré ne tue pas
//     la suite ;
//   - un fichier absent, vide ou qui ne produit aucun code de sortie est
//     un ÉCHEC, jamais une réussite — c'est le principe qui compte. Un
//     test qui ne s'exécute pas doit se voir ;
//   - un fichier de test qui n'est dans aucune famille ne s'exécuterait
//     jamais : c'est le pire des cas, et le lanceur le refuse ;
//   - chaque fichier a un délai maximal ;
//   - les familles permettent de séparer les tests hors réseau de ceux
//     qui parlent à la production.
//
// Usage :
//   node tools/run-tests.cjs                toutes les familles hors production
//   node tools/run-tests.cjs --famille=statique
//   node tools/run-tests.cjs --fichier=tests/x.test.cjs
//   node tools/run-tests.cjs --live         inclut la famille production
//   node tools/run-tests.cjs --liste        affiche les fichiers trouvés

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'tests');

// Familles de tests.
//
// Le nom du fichier décide de la famille : c'est ce qui permet de faire
// tourner « les tests qui ne parlent pas au réseau » sans avoir à
// toucher à chaque fichier.
//
// `navigateur` demande un vrai navigateur (Playwright). Ces tests sont
// lents — plusieurs secondes par cas — et ils ont besoin du paquet
// `playwright` et de son navigateur installé.
const FAMILLES = {
  // Ne touchent jamais le réseau. Doivent rester verts à chaque PR.
  statique: [
    'tests/cards.test.cjs',
    'tests/consentement.test.cjs',
    'tests/mesure_items.test.cjs',
    'tests/params_mesure.test.cjs',
    'tests/aide-parcours.cjs',
    'tests/captures-reference.cjs',
    'tests/audit-survol.cjs',
    'tests/defilement_fiche_conserve.test.cjs',
    'tests/detail_sans_entete.test.cjs',
    'tests/effacement_defilement_fiche.test.cjs',
    'tests/entete_fiche_sobre.test.cjs',
    'tests/fiche_rendu_immediat.test.cjs',
    'tests/fiche_style_offre.test.cjs',
    'tests/rail_fiche.test.cjs',
  ],
  // Demandent un navigateur. Lents, mais locaux : ils ouvrent le serveur
  // de test et n'appellent que lui.
  navigateur: [
    'tests/accessibilite-a02.test.cjs',
    'tests/affichage-a05.test.cjs',
    'tests/captures-a06.test.cjs',
    'tests/chrome-a08.test.cjs',
    'tests/confort-a04.test.cjs',
    'tests/parcours-p01-p03.test.cjs',
    'tests/parcours-p04-p06.test.cjs',
    'tests/pastille-a07.test.cjs',
    'tests/reseau-local.test.cjs',
    'tests/survol-a07.test.cjs',
    'tests/theme.test.cjs',
  ],
  // Parlent à la production. Une régression en ligne doit se voir, mais
  // elle ne doit pas bloquer une fusion : la production peut tomber sans
  // que le code soit en cause.
  production: [
    'tests/seo_offre.test.cjs',
    'tests/ga4_present.test.cjs',
    'tests/verifier-production.cjs',
    'tests/verifier-reference-prod.cjs',
    'tests/verifier-chrome-prod.cjs',
  ],
};

const DELAI_DEFAUT = 180000; // 3 minutes par fichier

const args = process.argv.slice(2);
const option = (nom) => args.includes(nom);
const valeur = (nom, defaut) => {
  const prefixe = `--${nom}=`;
  const trouve = args.find((a) => a.startsWith(prefixe));
  return trouve ? trouve.slice(prefixe.length) : defaut;
};

const LISTE = option('--liste');
const LIVE = option('--live');
const FAMILLE = valeur('famille', null);
const FICHIER = valeur('fichier', null);
const DELAI = Number(valeur('delai', DELAI_DEFAUT));

// ── Découverte ───────────────────────────────────────────────────────────

function decouvrir() {
  const trouve = [];
  for (const nom of fs.readdirSync(DOSSIER)) {
    if (!nom.endsWith('.test.cjs')) continue;
    const chemin = `tests/${nom}`;
    const famille = Object.keys(FAMILLES).find((f) => FAMILLES[f].includes(chemin));
    trouve.push({ chemin, famille: famille || 'non-reclasse' });
  }
  return trouve;
}

const fichiers = decouvrir();
const nonReclasse = fichiers.filter((f) => f.famille === 'non-reclasse');

// ── Sélection ────────────────────────────────────────────────────────────

let aExecuter = [];
if (FICHIER) {
  aExecuter = fichiers.filter((f) => f.chemin === FICHIER);
  if (aExecuter.length === 0) {
    console.error(`✘ ${FICHIER} : aucun fichier de ce nom dans tests/`);
    process.exit(1);
  }
} else if (FAMILLE) {
  if (!FAMILLES[FAMILLE]) {
    console.error(`✘ famille inconnue : ${FAMILLE}`);
    console.error(`  familles : ${Object.keys(FAMILLES).join(', ')}`);
    process.exit(1);
  }
  aExecuter = fichiers.filter((f) => f.famille === FAMILLE);
  // La liste declaree fait autorite : on execute ce qu elle dit, et
  // seulement cela. Si un fichier declare n existe pas, c est une
  // ERREUR — un test declare et absent ne doit pas passer en silence.
  const declares = FAMILLES[FAMILLE];
  const manquants = declares.filter((d) => !fs.existsSync(path.join(RACINE, d)));
  if (manquants.length) {
    console.error(`✘ ${FAMILLE} : fichiers declares absents du depot :`);
    for (const m of manquants) console.error(`  ${m}`);
    console.error('');
    process.exit(1);
  }
} else {
  aExecuter = fichiers.filter((f) => f.famille !== 'production');
  if (LIVE) aExecuter = fichiers;
}

if (LISTE) {
  console.log(`${fichiers.length} fichiers de test trouves\n`);
  for (const famille of Object.keys(FAMILLES)) {
    const dans = fichiers.filter((f) => f.famille === famille);
    if (!dans.length) continue;
    console.log(`${famille} (${dans.length})`);
    for (const f of dans) console.log(`  ${f.chemin}`);
    console.log('');
  }
  if (nonReclasse.length) {
    console.log(`non-reclasse (${nonReclasse.length}) — jamais executes :`);
    for (const f of nonReclasse) console.log(`  ${f.chemin}`);
  }
  process.exit(0);
}

if (nonReclasse.length) {
  console.error('✘ Ces fichiers de test ne sont dans aucune famille : ils ne');
  console.error('  s executeraient jamais. Rangez-les dans tools/run-tests.cjs.');
  for (const f of nonReclasse) console.error(`  ${f.chemin}`);
  console.error('');
  process.exit(1);
}

// ── Exécution ────────────────────────────────────────────────────────────

function executer(fichier) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const enfant = spawn(process.execPath, [path.join(RACINE, fichier.chemin)], {
      cwd: RACINE,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let sortie = '';
    enfant.stdout.on('data', (d) => { sortie += d; });
    enfant.stderr.on('data', (d) => { sortie += d; });

    let fini = false;
    const arreter = (raison, code) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      try { enfant.kill('SIGKILL'); } catch { /* deja mort */ }
      resolve({ fichier, code, sortie, duree: Date.now() - debut, raison });
    };

    const minuteur = setTimeout(
      () => arreter('delai depasse', 124),
      fichier.delai || DELAI,
    );

    enfant.on('error', (e) => arreter(`erreur : ${e.message}`, 125));
    enfant.on('close', (code) => arreter(null, code === null ? 1 : code));
  });
}

async function toutExecuter() {
  console.log(`== ${aExecuter.length} fichiers de test ==\n`);
  const resultats = [];
  for (const f of aExecuter) {
    const debut = Date.now();
    process.stdout.write(`  ${f.chemin} ... `);
    const r = await executer(f);
    const duree = ((Date.now() - debut) / 1000).toFixed(1);
    if (r.code === 0) {
      console.log(`OK (${duree}s)`);
    } else {
      const raison = r.raison ? ` [${r.raison}]` : '';
      console.log(`ECHEC (${duree}s, code ${r.code})${raison}`);
      // Les scripts autonomes n'impriment pas toujours d'explication :
      // on montre leurs dernieres lignes.
      const lignes = r.sortie.trim().split('\n').filter(Boolean);
      for (const l of lignes.slice(-12)) console.log(`      ${l}`);
    }
    resultats.push(r);
  }
  return resultats;
}

toutExecuter().then((resultats) => {
  const echecs = resultats.filter((r) => r.code !== 0);
  const secondes = (resultats.reduce((s, r) => s + r.duree, 0) / 1000).toFixed(1);

  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  BILAN');
  console.log('════════════════════════════════════════');
  console.log(`  total   : ${resultats.length}`);
  console.log(`  reussis : ${resultats.length - echecs.length}`);
  console.log(`  echecs  : ${echecs.length}`);
  console.log(`  duree   : ${secondes}s`);
  if (echecs.length) {
    console.log('');
    for (const e of echecs) console.log(`  ✘ ${e.fichier.chemin} (code ${e.code})`);
  }
  console.log('');
  process.exit(echecs.length ? 1 : 0);
});
