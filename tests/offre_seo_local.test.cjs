// tests/offre_seo_local.test.cjs
//
// Le SEO de la fiche, sans dépendre de la production.
//
// Le test historique seo_offre.test.cjs interroge Railway : il dépend de
// la production, de la disponibilité du réseau, et d une offre réelle dont
// la date et la longueur changent. Ce fichier le remplace pour la PR.
//
// Ce fichier couvre :
//   S01 — titre, description, canonique, titre visible
//   S02 — balisage structuré complet et cohérent
//   S03 — règles d expiration
//   S06 — découverte : liens internes, fil d Ariane

const assert = require('node:assert/strict');
const path = require('node:path');
const { appeler } = require('./helpers/gestionnaire.cjs');
const { demarrer, OFFRE_COMPLETE } = require('./helpers/serveur-simule.cjs');

const RACINE = path.join(__dirname, '..');

function charger(base) {
  process.env.API_URL = base;
  delete require.cache[require.resolve(path.join(RACINE, 'api/offre.js'))];
  return require(path.join(RACINE, 'api/offre.js'));
}

function jsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'la page doit porter un bloc JSON-LD');
  return JSON.parse(m[1]);
}

(async () => {
  const serveur = await demarrer();
  const handler = charger(serveur.url + '/api/v1');
  const reponse = await appeler(handler, { query: { slug: OFFRE_COMPLETE.slug } });
  const html = reponse.html;

  // ── S01 — Les balises de base ───────────────────────────────────────────
  const titre = html.match(/<title>([^<]*)<\/title>/);
  assert.ok(titre, 'la page doit avoir un titre');
  assert.ok(titre[1].includes(OFFRE_COMPLETE.title), 'le titre doit nommer le poste');
  assert.ok(titre[1].includes('AXA'), 'le titre doit nommer l employeur');
  assert.ok(titre[1].includes('Claim!'), 'le titre doit nommer le site');
  assert.ok(!titre[1].includes('Claim your job'), 'le titre ne doit pas être celui du site seul');

  const description = html.match(/<meta name="description" content="([^"]*)"/);
  assert.ok(description, 'la page doit avoir une description');
  assert.ok(description[1].length >= 20, 'la description doit avoir du contenu');
  assert.ok(description[1].length <= 200, 'la description ne doit pas être trop longue');

  const canonique = html.match(/<link rel="canonical" href="([^"]+)"/);
  assert.ok(canonique, 'la page doit avoir une canonique');
  assert.equal(canonique[1], 'https://claimyourjob.fr/offre/' + encodeURIComponent(OFFRE_COMPLETE.slug),
    'la canonique doit viser l adresse de l offre');

  const h1 = html.match(/<h1>([^<]*)<\/h1>/);
  assert.ok(h1, 'la page doit avoir un titre visible');
  assert.equal(h1[1].trim(), OFFRE_COMPLETE.title, 'le titre visible est celui du poste');

  // ── S01 — La page se lit sans JavaScript ───────────────────────────────
  //
  // Une page d offre qui ne se lit qu avec JavaScript n existe pas pour un
  // moteur de recherche. Le contenu doit être dans le HTML servi.
  const corps = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean);
  assert.ok(corps.length > 80, 'la page doit avoir du contenu sans JavaScript : ' + corps.length + ' mots');
  assert.ok(html.includes('Une mission'), 'le contenu de l offre doit être dans la page servie');

  // ── S02 — Le balisage structuré ────────────────────────────────────────
  const donnees = jsonLd(html);
  assert.equal(donnees['@context'], 'https://schema.org/');
  assert.equal(donnees['@type'], 'JobPosting');
  assert.equal(donnees.title, OFFRE_COMPLETE.title);
  assert.ok(donnees.description, 'la description est obligatoire');
  assert.ok(donnees.hiringOrganization, 'l employeur est obligatoire');
  assert.equal(donnees.hiringOrganization.name, 'AXA');
  assert.ok(donnees.jobLocation, 'le lieu est obligatoire');
  assert.equal(donnees.jobLocation.address.addressCountry, 'FR');
  assert.ok(donnees.identifier, 'l identifiant est obligatoire');
  assert.equal(donnees.identifier.value, OFFRE_COMPLETE.id);

  // ── S03 — Les règles d expiration ──────────────────────────────────────
  assert.equal(donnees.datePosted, '2026-10-01');
  assert.equal(donnees.validThrough, '2026-12-30');
  const ecart = (new Date(donnees.validThrough) - new Date(donnees.datePosted)) / 86400000;
  assert.equal(ecart, 90, 'la validité doit couvrir 90 jours');

  // ── S06 — La page se découvre et se quitte ─────────────────────────────
  assert.ok(html.includes('href="https://claimyourjob.fr/job-board.html"') ||
            html.includes('href="${SITE_URL}/job-board.html"') ||
            html.includes('/job-board.html'),
    'la fiche doit proposer un retour vers le board');
  assert.match(html, /<a class="retour" href="\/job-board\.html">/,
    'le retour vers le board doit être visible en haut de la fiche');

  // ── S01 — Les balises sociales ──────────────────────────────────────────
  const ogTitre = html.match(/<meta property="og:title" content="([^"]*)"/);
  assert.ok(ogTitre, 'la page doit avoir un titre social');
  const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/);
  assert.ok(ogImage, 'la page doit avoir une image sociale');
  assert.ok(ogImage[1].startsWith('https://'), 'l image sociale doit être absolue');
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/,
    'la carte Twitter doit être déclarée');

  // ── S01 — La mesure est présente sur la fiche ──────────────────────────
  assert.ok(html.includes('G-SKQQXZW4LH'), 'la fiche doit porter la balise de mesure');

  await serveur.arreter();
  console.log('SEO local : balises, balisage structuré, expiration, découverte — OK');
})().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
