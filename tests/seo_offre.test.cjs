// Vérifie la page d'offre rendue côté serveur : contenu, balises, JobPosting.
const assert = require('node:assert/strict');
const handler = require('../api/offre.js');
const { execFileSync } = require('node:child_process');

function appeler(query) {
  return new Promise((resolve) => {
    const res = {
      statusCode: null, corps: null, entetes: {},
      status(c) { this.statusCode = c; return this; },
      setHeader(n, v) { this.entetes[n] = v; },
      send(v) { this.corps = v; resolve(this); },
    };
    handler({ query }, res);
  });
}

(async () => {
  // Un slug réel, pris dans l'API de production.
  const brut = execFileSync('curl', ['-s',
    'https://claim-api-production-06b3.up.railway.app/api/v1/jobs?limit=1'], { encoding: 'utf8' });
  const slug = JSON.parse(brut).data[0].slug;

  const r = await appeler({ slug });
  assert.equal(r.statusCode, 200, 'la page doit répondre 200');
  assert.match(r.entetes['Content-Type'] || '', /text\/html/);

  const h = r.corps;
  assert.match(h, new RegExp('<title>[^<]+</title>'), 'un titre est requis');
  assert.ok(!h.includes('<title>Claim your job</title>'), 'le titre doit être propre à l\'offre');
  assert.match(h, /<meta name="description" content="[^"]{20,}"/, 'une description est requise');
  assert.match(h, /rel="canonical" href="https:\/\/claimyourjob.fr\/offre\//);
  assert.match(h, /<h1>[^<]+<\/h1>/, 'un titre visible est requis');

  // Le balisage structuré doit être présent ET valide.
  const m = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'un bloc JSON-LD est requis');
  const donnees = JSON.parse(m[1]);
  assert.equal(donnees['@type'], 'JobPosting');
  assert.ok(donnees.title && donnees.description, 'titre et description sont obligatoires');
  assert.ok(donnees.hiringOrganization && donnees.hiringOrganization.name);
  assert.equal(donnees.jobLocation.address.addressCountry, 'FR');
  assert.ok(donnees.datePosted, 'la date de publication est attendue');
  // Directement lisible, sans JavaScript.
  assert.ok(h.includes(donnees.title), 'le titre doit apparaître dans le HTML servi');

  const mots = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  assert.ok(mots > 80, `contenu trop maigre : ${mots} mots`);

  // Une offre inconnue doit répondre 404, jamais 200.
  const absent = await appeler({ slug: 'offre-qui-nexiste-pas-0123456789' });
  assert.equal(absent.statusCode, 404, 'un slug inconnu doit répondre 404');
  assert.match(absent.corps, /noindex/, 'la page absente ne doit pas être indexée');

  console.log('SEO job page tests passed —', mots, 'mots |', donnees['@type']);
})();
