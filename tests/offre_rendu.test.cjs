// tests/offre_rendu.test.cjs
//
// Ce que la page d offre rend, champ par champ.
//
// Le test SEO de production vérifie qu une offre réelle se rend bien. Ce
// fichier vérifie le RENDU, avec des données choisies : une offre sans
// ville, sans salaire, sans date, sans source. C est le cas que la
// production ne couvre presque jamais, et c est celui qui casse.
//
// Ce fichier couvre :
//   M02, M04, M05 — ce qui s affiche quand la donnée manque
//   S02 — cohérence entre le JSON-LD et le texte visible

const assert = require('node:assert/strict');
const path = require('node:path');
const { appeler } = require('./helpers/gestionnaire.cjs');
const { demarrer, OFFRE_COMPLETE, OFFRE_MINIMALE, OFFRE_SANS_DATE, OFFRE_SANS_SALAIRE } =
  require('./helpers/serveur-simule.cjs');

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

  // ── L offre complète ────────────────────────────────────────────────────
  const complete = await appeler(handler, { query: { slug: OFFRE_COMPLETE.slug } });
  assert.equal(complete.status, 200);
  const html = complete.html;
  const donnees = jsonLd(html);

  assert.equal(donnees['@type'], 'JobPosting');
  assert.equal(donnees.title, OFFRE_COMPLETE.title, 'le titre du JSON-LD est celui de l offre');
  assert.equal(donnees.hiringOrganization.name, 'AXA', 'l employeur est nommé');
  assert.equal(donnees.jobLocation.address.addressCountry, 'FR', 'le pays est la France');
  assert.equal(donnees.jobLocation.address.addressLocality, 'Paris', 'la ville est renseignée');
  assert.equal(donnees.employmentType, 'FULL_TIME', 'un CDI est un emploi à durée indéterminée');
  assert.equal(donnees.datePosted, '2026-10-01', 'la date de publication est celle de la source');
  assert.equal(donnees.validThrough, '2026-12-30', 'la validité suit la règle des 90 jours');
  assert.equal(donnees.directApply, true);

  // Le texte visible porte les mêmes informations que le balisage.
  assert.ok(html.includes(OFFRE_COMPLETE.title), 'le titre est visible');
  assert.ok(html.includes('AXA'), 'l employeur est visible');
  assert.ok(html.includes('CDI'), 'le contrat est visible');
  assert.ok(html.includes('Paris'), 'la ville est visible');

  // ── L offre minimale : rien ne manque, rien n est inventé ───────────────
  const minimale = await appeler(handler, { query: { slug: OFFRE_MINIMALE.slug } });
  assert.equal(minimale.status, 200, 'une offre minimale se rend quand même');
  const hmin = minimale.html;
  const dmin = jsonLd(hmin);

  assert.equal(dmin.title, OFFRE_MINIMALE.title);
  assert.ok(!dmin.datePosted, 'sans date de publication, il ne doit pas y avoir de datePosted');
  assert.ok(!dmin.validThrough, 'sans date, il ne doit pas y avoir de validThrough');
  assert.ok(!dmin.jobLocation.address.addressLocality, 'sans ville, il ne doit pas y avoir de ville');
  assert.ok(!dmin.baseSalary, 'sans salaire publiable, il ne doit pas y avoir de salaire');
  assert.ok(!dmin.employmentType, 'sans contrat, il ne doit pas y avoir de type d emploi');
  assert.ok(!dmin.hiringOrganization.sameAs, 'sans site, il ne doit pas y avoir de lien');

  // La page doit tout de même avoir une description : le titre sert de repli.
  assert.match(hmin, /<meta name="description" content="[^"]{3,}"/,
    'une offre sans corps doit avoir une description de repli');
  assert.match(hmin, /<h1>[^<]+<\/h1>/, 'une offre sans corps doit avoir un titre visible');
  assert.match(hmin, /<p>[^<]*<\/p>/, 'la page doit avoir un corps, même minimal');

  // ── L offre sans date : pas de date inventée ───────────────────────────
  const sansDate = await appeler(handler, { query: { slug: OFFRE_SANS_DATE.slug } });
  const dSansDate = jsonLd(sansDate.html);
  assert.ok(!dSansDate.datePosted, 'une offre sans date de publication ne doit pas en recevoir une');
  assert.ok(!dSansDate.validThrough, 'ni de date de fin');

  // ── L offre sans salaire : pas de salaire de zéro ──────────────────────
  const sansSalaire = await appeler(handler, { query: { slug: OFFRE_SANS_SALAIRE.slug } });
  const dSansSalaire = jsonLd(sansSalaire.html);
  assert.ok(!dSansSalaire.baseSalary,
    'une offre sans salaire ne doit pas porter de salaire de 0 €');
  assert.ok(!sansSalaire.html.includes('0 k€'), 'et rien ne doit laisser croire à un salaire nul');

  // ── S02 — Le balisage ne doit pas contredire le texte visible ──────────
  //
  // Le titre du JSON-LD et le titre visible doivent être le même. Sinon
  // Google peut considérer que la page parle d autre chose.
  const h1 = hmin.match(/<h1>([^<]*)<\/h1>/);
  assert.ok(h1, 'la page doit avoir un titre visible');
  assert.equal(dmin.title, h1[1].trim(), 'le titre visible et le titre balisé doivent coïncider');

  // ── Le lien vers l annonce d origine ───────────────────────────────────
  assert.ok(html.includes('data-sortie="annonce"'), 'la page doit proposer un lien vers l annonce');
  assert.ok(html.includes(OFFRE_COMPLETE.source_url), 'le lien doit viser l adresse de la source');
  assert.ok(html.includes('rel="nofollow noopener"'), 'un lien externe doit être marqué nofollow et noopener');

  // ── Une offre sans adresse de source n a pas de lien ───────────────────
  const sansSource = { ...OFFRE_COMPLETE, id: 'g1', slug: 'sans-source-test', source_url: null };
  const serveur2 = await demarrer({ offres: [sansSource] });
  const handler2 = charger(serveur2.url + '/api/v1');
  const r2 = await appeler(handler2, { query: { slug: sansSource.slug } });
  assert.equal(r2.status, 200);
  // Le pied de page ne doit contenir ni le lien vers l annonce, ni le
  // mot Source quand l offre n en porte pas.
  //
  // On cherche une BALISE de lien, pas la mention du sélecteur dans le
  // script de mesure : le script interroge toujours a[data-sortie],
  // que le lien existe ou non.
  const pied = r2.html.slice(r2.html.indexOf('class="pied"'));
  assert.ok(!/<a\b[^>]*data-sortie=/.test(pied),
    'sans adresse de source, il ne doit pas y avoir de lien de candidature');
  assert.ok(!pied.includes('annonce d origine'),
    'sans adresse de source, il ne doit pas y avoir de lien d annonce');

  await serveur.arreter();
  await serveur2.arreter();
  console.log('Rendu de fiche : cas complets, cas minimaux, cohérence du balisage — OK');
})().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
