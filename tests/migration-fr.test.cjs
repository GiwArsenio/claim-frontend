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
  for(const [path,target] of [['/','/fr/'],['/job-board.html?q=x&page=2','/fr/job-board.html?q=x&page=2'],['/fr','/fr/'],['/fr/index.html','/fr/'],['/claim-job-board.html','/fr/job-board.html'],['/fr/claim-job-board.html','/fr/job-board.html'],['/robots.txt','/fr/robots.txt'],['/sitemap.xml','/fr/sitemap.xml']]) {
   const r=await call(path,host);
   assert.equal(r.status,301,host+path);
   assert.equal(r.headers.get('location'),`https://claimyourjob.com${target}`,host+path);
  }
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
