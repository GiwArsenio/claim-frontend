#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Vérification du rendu du portage Cloudflare Workers.
//
// Ce script fige la preuve qui a servi de base au portage : les trois
// adresses rendues côté serveur doivent produire exactement le même contenu
// que la production Vercel.
//
// Il compare deux origines :
//   - le Worker (par défaut http://127.0.0.1:8788, sur `wrangler dev`)
//   - la référence (par défaut https://claimyourjob.fr, la production Vercel)
//
// Deux modes :
//   node tests-portage/verifier-rendu.js                 # 1 offre témoin + les pages
//   node tests-portage/verifier-rendu.js --complet        # les 355 offres
//   node tests-portage/verifier-rendu.js --ref <origine>  # une autre référence
//
// Code de sortie : 0 si tout concorde, 1 sinon.
//
// Une divergence n'est pas forcément un défaut du portage : la production
// évolue (une offre est retirée, une description est corrigée). Dans ce cas,
// le script signale la différence sans échouer, sauf si --strict est donné.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const args = process.argv.slice(2);
const option = (nom) => args.includes(nom);
const valeur = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};

const WORKER = valeur('--worker', process.env.WORKER_URL || 'http://127.0.0.1:8788');
const REF = valeur('--ref', process.env.REF_URL || 'https://claimyourjob.fr');
const COMPLET = option('--complet');
const STRICT = option('--strict');

const TIMEOUT = 30000;

// Les pages que le Worker rend, ou qu'il sert : chacune a une adresse
// publique, donc une réponse observable.
const ADRESSES_FIXES = [
  { chemin: '/',                       attendu: 200, note: 'accueil' },
  { chemin: '/index.html',             attendu: 200, note: 'accueil par son fichier' },
  { chemin: '/job-board.html',         attendu: 200, note: 'board — ne doit pas basculer en 307' },
  { chemin: '/claim-entreprises.html', attendu: 200, note: 'entreprises' },
  { chemin: '/claim-observatoire.html',attendu: 200, note: 'observatoire' },
  { chemin: '/a-propos.html',          attendu: 200, note: 'à propos' },
  { chemin: '/robots.txt',             attendu: 200, note: 'robots' },
  { chemin: '/sitemap.xml',            attendu: 200, note: 'sitemap' },
  { chemin: '/claim-job-board.html',   attendu: 301, note: 'ancienne adresse du board' },
  { chemin: '/adresse-inexistante',    attendu: 404, note: 'adresse inconnue' },
];

// Les en-tetes qu un navigateur envoie quand on suit un lien ou qu on tape
// une adresse. Ils ne sont pas decoratifs.
//
// `Sec-Fetch-Mode: navigate` est ce qui distingue une navigation d une
// requete de ressource. Cloudflare court-circuite le Worker pour les
// navigations (drapeau assets_navigation_prefers_asset_serving) : sans
// cet en-tete, le harnais verrait 200 la ou le navigateur verrait 404.
//
// C est exactement ce qui est arrive le 25 octobre 2026 : l accueil
// repondait 200 a curl et a Googlebot, et 404 dans un vrai navigateur.
// Un harnais qui n imite pas le navigateur ne prouve rien pour le
// visiteur.
const EN_TETES_NAVIGATION = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

async function lire(url) {
  const reponse = await fetch(url, {
    redirect: 'manual',
    headers: { ...EN_TETES_NAVIGATION },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const corps = await reponse.text();
  return {
    status: reponse.status,
    type: reponse.headers.get('content-type') || '',
    cache: reponse.headers.get('cache-control') || '',
    location: reponse.headers.get('location') || '',
    corps,
  };
}

const verdicts = [];
const noter = (nom, ok, detail) => verdicts.push({ nom, ok, detail });

async function verifierAdressesFixes() {
  console.log(`\n${'═'.repeat(72)}\n  Adresses fixes — Worker ${WORKER}\n${'═'.repeat(72)}`);
  for (const a of ADRESSES_FIXES) {
    let r;
    try {
      r = await lire(WORKER + a.chemin);
    } catch (e) {
      noter(a.chemin, false, `erreur de lecture : ${e.message}`);
      console.log(`  ✗ ${a.chemin.padEnd(30)} ${a.note} — ${e.message}`);
      continue;
    }
    const ok = r.status === a.attendu;
    noter(a.chemin, ok, `statut ${r.status} (attendu ${a.attendu})`);
    console.log(`  ${ok ? '✓' : '✗'} ${a.chemin.padEnd(30)} ${String(r.status).padEnd(4)} ${a.note}`);
  }
}

async function trouverSlugs() {
  try {
    const r = await lire(`${REF}/sitemap.xml`);
    const slugs = [...r.corps.matchAll(/<loc>https?:\/\/[^<]*\/offre\/([^<]*)<\/loc>/g)].map((m) => m[1]);
    return slugs;
  } catch (e) {
    console.error(`  ✗ sitemap illisible (${e.message}) — impossible de lister les offres`);
    return [];
  }
}

// ATTENTION : `wrangler dev` n emule PAS le court-circuit de navigation.
// En local, une requete avec Sec-Fetch-Mode: navigate atteint toujours le
// Worker, alors qu en production Cloudflare la court-circuite (drapeau
// assets_navigation_prefers_asset_serving). Un Worker local peut donc
// paraitre correct alors qu il repond 404 a un navigateur.
//
// Ce controle n a de valeur que sur un Worker deploye. C est pourquoi le
// script compare par defaut a la production, et pourquoi la reference et
// l Worker doivent etre deux origines reelles.
//
// (Le 25 octobre 2026, l accueil repondait 404 dans le navigateur et 200
// a curl, a Googlebot, et a wrangler dev. Les trois etaient d accord : le
// defaut ne se voyait que chez le visiteur.)

// L'annuaire des entreprises doit etre UN SEUL fichier : le job board le
// charge dans le navigateur, le Worker l'importe. Une copie divergerait
// en silence — celle du portage initial avait divergi, et le rendu de la
// fiche n'affichait plus le logo de l'entreprise.
function verifierAnnuaireUnique() {
  const copies = [];
  const parcourir = (dossier) => {
    let entrees = [];
    try {
      entrees = require('node:fs').readdirSync(dossier, { withFileTypes: true });
    } catch { return; }
    for (const entree of entrees) {
      const chemin = dossier + '/' + entree.name;
      if (entree.isDirectory()) parcourir(chemin);
      else if (entree.name.startsWith('companies-data')) copies.push(chemin);
    }
  };
  parcourir('src');
  const ok = copies.length === 0;
  noter('annuaire unique', ok, ok ? 'source unique' : `copie(s) : ${copies.join(', ')}`);
  console.log(`  ${ok ? '\u2713' : '\u2717'} annuaire unique${ok ? '' : ' — ' + copies.join(', ')}`);
  return ok;
}

async function comparerOffres(slugs) {
  console.log(`\n${'═'.repeat(72)}\n  Fiches d'offre — Worker vs ${REF}\n${'═'.repeat(72)}`);
  let identiques = 0;
  let differents = [];

  for (let i = 0; i < slugs.length; i++) {
    const chemin = '/offre/' + slugs[i];
    let a, b;
    try {
      [a, b] = await Promise.all([lire(WORKER + chemin), lire(REF + chemin)]);
    } catch (e) {
      differents.push({ slug: slugs[i], raison: `erreur : ${e.message}` });
      continue;
    }
    if (a.status !== b.status) {
      differents.push({ slug: slugs[i], raison: `statut ${a.status} vs ${b.status}` });
    } else if (a.corps !== b.corps) {
      differents.push({ slug: slugs[i], raison: `corps différent (${a.corps.length} vs ${b.corps.length} octets)` });
    } else {
      identiques++;
    }
    if ((i + 1) % 25 === 0) {
      console.log(`  ... ${i + 1}/${slugs.length} (${identiques} identiques)`);
    }
  }

  console.log(`\n  total      : ${slugs.length}`);
  console.log(`  identiques : ${identiques}`);
  console.log(`  différents : ${differents.length}`);
  for (const d of differents.slice(0, 15)) {
    console.log(`    · ${d.slug} — ${d.raison}`);
  }
  noter('fiches d\'offre', differents.length === 0, `${identiques}/${slugs.length} identiques`);
  return differents.length === 0;
}

(async () => {
  console.log(`Worker : ${WORKER}`);
  console.log(`Référence : ${REF}`);
  console.log(`Mode : ${COMPLET ? 'complet' : 'témoin'}`);

  await verifierAdressesFixes();
  verifierAnnuaireUnique();

  const tous = await trouverSlugs();
  if (!tous.length) {
    console.log('\n  ✗ aucune offre trouvée dans le sitemap de référence');
    process.exit(1);
  }

  // En mode témoin, on prend quelques offres : une accentuée, une
  // ordinaire, une qui contient un tiret long.
  let slugs = tous;
  if (!COMPLET) {
    slugs = tous.slice(0, 3).concat(tous.filter((s) => /%C3%/.test(s)).slice(0, 2));
  }

  const offresOk = await comparerOffres(slugs);

  console.log(`\n${'═'.repeat(72)}\n  BILAN\n${'═'.repeat(72)}`);
  for (const v of verdicts) {
    console.log(`  ${v.ok ? '✓' : '✗'} ${v.nom.padEnd(30)} ${v.detail}`);
  }

  const echecs = verdicts.filter((v) => !v.ok);
  if (!offresOk && !STRICT) {
    console.log('\n  Note : les fiches divergent. C’est normal si la production a bougé');
    console.log('  depuis (offre retirée, description corrigée). Comparer à la main');
    console.log('  avant de conclure à un défaut du portage.');
  }
  console.log('');
  process.exit(echecs.length === 0 ? 0 : 1);
})();
