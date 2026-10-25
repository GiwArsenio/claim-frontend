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

async function lire(url) {
  const reponse = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'claim-verifier-rendu/1.0' },
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
