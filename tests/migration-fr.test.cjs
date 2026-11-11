'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {OFFRE_COMPLETE} = require('./fixtures/offres.cjs');

test('migration — assets réalistes, redirections et contenu final', async () => {
 const {default: worker} = await import('../src/index.js');
 const env = {SITE_URL:'https://claimyourjob.com/fr', API_URL:'https://api.test/api/v1', ASSETS:{fetch:async req => {
  const path = new URL(req.url).pathname;
  const file = `.${path}`;
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  return new Response(fs.readFileSync(exists ? file : './public/404.html'), {
   status:exists ? 200:404, headers:{'content-type':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html',etag:'obsolete'}
  });
 }}};
 const call = (path, host='claimyourjob.com', method='GET')=>worker.fetch(new Request(`https://${host}${path}`,{method}),env);
 for(const host of ['claimyourjob.com','claimyourjob.fr','www.claimyourjob.com','www.claimyourjob.fr']) {
  for(const [path,target] of [['/','/fr/'],['/job-board.html?q=x&page=2','/fr/job-board.html?q=x&page=2'],['/fr','/fr/'],['/fr/index.html','/fr/'],['/claim-job-board.html','/fr/job-board.html'],['/fr/claim-job-board.html','/fr/job-board.html']]) {
   const r=await call(path,host);
   assert.equal(r.status,301,host+path);
   assert.equal(r.headers.get('location'),`https://claimyourjob.com${target}`,host+path);
  }
 }
 // robots.txt est servi À LA RACINE (200) : Google ne lit pas les règles d'un
 // robots.txt en redirection (3xx = 404 pour lui). Il est statique, sans
 // dépendance à l'API. sitemap.xml reste redirigé, Google suit une redirection
 // de sitemap sans perdre d'information.
 {
  const r=await call('/robots.txt'); assert.equal(r.status,200, 'robots.txt doit être servi à la racine');
  const t=await r.text(); assert.ok(t.length>0, 'robots.txt doit avoir un contenu');
 }
 for(const path of ['/fr/','/fr/job-board.html','/fr/contact.html']) {
  const r=await call(path); assert.equal(r.status,200);
  const html=await r.text(); assert.match(html,/canonical[^>]+https:\/\/claimyourjob.com\/fr/);
  assert.match(html,/href="\/fr\//);
  assert.equal(r.headers.get('etag'),null);
 }
 assert.equal((await call('/assets/theme.css')).status,200);
 assert.equal((await call('/fr/absent')).status,404);
 assert.match(await (await call('/fr/absent')).text(),/href="\/fr\//);
 assert.equal((await call('/monitoring.html')).status,301);
 for (const path of ['/fr/monitoring%2Ehtml', '/fr/monitoring%252Ehtml']) {
  const r=await call(path);assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://claimyourjob.com/monitoring');
 }
 assert.equal((await call('/monitoring')).status,401);
 assert.equal((await call('/fr/monitoring/api/session','claimyourjob.com','POST')).status,307);
 assert.equal((await call('/fr/','claimyourjob.com','HEAD')).body,null);
 // L'interception ne dépend pas de la présence ou de l'absence du fichier.
 assert.match(fs.readFileSync('wrangler.jsonc','utf8'),/"run_worker_first": true/);
 // Pas de fausse classification de /france/assets.
 const {estExempt}=await import('../src/maillage.js'); assert.equal(estExempt('/france/assets/x'),false);
});

test('migration — sitemap et fiche construits, pas seulement les constantes', async () => {
 const {default:worker}=await import('../src/index.js');
 const original=global.fetch;
 global.fetch=async url => {
  const u=String(url);
  if(u.includes('/jobs?')) return Response.json({pagination:{total:1},data:[{slug:'chargé-actuaire',source_published_at:'2026-11-02'}]});
  if(u.includes('/jobs/')) return Response.json({...OFFRE_COMPLETE,slug:'chargé-actuaire'});
  return Response.json({});
 };
 try {
  const env={API_URL:'https://api.test/api/v1',SITE_URL:'https://claimyourjob.com/fr'};
  const sitemap=await worker.fetch(new Request('https://claimyourjob.com/fr/sitemap.xml'),env);
  assert.equal(sitemap.status,200); const xml=await sitemap.text();
  assert.match(xml,/https:\/\/claimyourjob.com\/fr\/offre\/charg%C3%A9-actuaire/);
  assert.doesNotMatch(xml,/claimyourjob\.fr/);
  const offer=await worker.fetch(new Request('https://claimyourjob.com/fr/offre/charg%C3%A9-actuaire'),env);
  assert.equal(offer.status,200); const html=await offer.text();
  assert.match(html,/canonical[^>]+https:\/\/claimyourjob.com\/fr\/offre\/charg%C3%A9-actuaire/);
  assert.match(html,/href="\/fr\/job-board.html"/);
 } finally {global.fetch=original;}
});


test('migration — panne temporaire API : pas de faux 404', async()=>{
 const {rendreOffre}=await import('../src/pages/offre.js');
 const original=global.fetch;
 try {
  global.fetch=async()=>new Response('Indisponible',{status:503});
  const r=await rendreOffre('actuaire',{API_URL:'https://api.test/api/v1'});
  assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');
 }finally{global.fetch=original;}
});

test('migration — les offres de test ne sont jamais exposées', async () => {
 const {rendreSitemap}=await import('../src/pages/sitemap.js');
 const {rendreOffre}=await import('../src/pages/offre.js');
 const original=global.fetch;
 try {
  global.fetch=async url => {
   const u=String(url);
   if(u.includes('/jobs?')) return Response.json({pagination:{total:3},data:[
    {slug:'actuaire-ffdfb676e02c',source:'test_source',source_published_at:'2026-10-16'},
    {slug:'test-lead-expert-ia-h-f-93f4b0c60ac9',source:'axa',source_published_at:'2026-08-31'},
    {slug:'actuaire-confirme-risques-non-vie',source:'scor',source_published_at:'2026-11-02'}
   ]});
   if(u.includes('/jobs/')) return Response.json({id:'d33b30bb-fbef-43d6-8274-edfe9f49c401',slug:'test-lead-expert-ia-h-f-93f4b0c60ac9',source:'axa',title:'Test Lead Expert IA (H/F)',description_raw:'Une description de test.'});
   return Response.json({});
  };
  const xml=await (await rendreSitemap({API_URL:'https://api.test/api/v1',SITE_URL:'https://claimyourjob.com/fr'})).text();
  assert.doesNotMatch(xml,/actuaire-ffdfb676e02c|test-lead-expert/);
  assert.match(xml,/actuaire-confirme-risques-non-vie/);
  const fiche=await rendreOffre('test-lead-expert-ia-h-f-93f4b0c60ac9',{API_URL:'https://api.test/api/v1',SITE_URL:'https://claimyourjob.com/fr'});
  assert.equal(fiche.status,404);
  assert.match(await fiche.text(),/noindex/);
 } finally {global.fetch=original;}
});

test('migration — directApply suit la candidature réelle', async () => {
 const {default:worker}=await import('../src/index.js');
 const original=global.fetch;
 try {
  global.fetch=async url => {
   const u=String(url);
   if(u.includes('/jobs/')) return Response.json({...OFFRE_COMPLETE,slug:'offre-externe-0001',source_url:'https://example.org/job/123'});
   return Response.json({});
  };
  const env={API_URL:'https://api.test/api/v1',SITE_URL:'https://claimyourjob.com/fr'};
  const r=await worker.fetch(new Request('https://claimyourjob.com/fr/offre/offre-externe-0001'),env);
  const html=await r.text();
  const m=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m,'un bloc JSON-LD est requis');
  const donnees=JSON.parse(m[1]);
  assert.equal(donnees.directApply,false,'la candidature part chez l\'employeur');
  assert.ok(!('validThrough' in donnees),'aucune date d\'expiration fabriquée');
 } finally {global.fetch=original;}
});
