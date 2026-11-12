'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ORIGIN='https://claimyourjob.com';
const report=[];
async function read(url,method='GET') {
 const r=await fetch(url,{method,redirect:'manual',headers:{'Sec-Fetch-Mode':'navigate','User-Agent':'Mozilla/5.0 CLAIM Migration Audit'},signal:AbortSignal.timeout(30000)});
 return {status:r.status,location:r.headers.get('location'),headers:Object.fromEntries(r.headers),body:await r.text()};
}
(async()=>{
 for(const host of ['claimyourjob.com','claimyourjob.fr','www.claimyourjob.com','www.claimyourjob.fr']) {
  for(const [p,target] of [['/','/fr/'],['/job-board.html?q=actuaire&page=2','/fr/job-board.html?q=actuaire&page=2'],['/fr','/fr/'],['/fr/index.html','/fr/'],['/fr/claim-job-board.html','/fr/job-board.html'],['/sitemap.xml','/fr/sitemap.xml']]) {
   const r=await read(`https://${host}${p}`);
   assert.equal(r.status,301,host+p);assert.equal(r.location,ORIGIN+target,host+p);
   report.push({url:`https://${host}${p}`,status:r.status,location:r.location});
  }
 }
 for(const p of ['/fr/','/fr/job-board.html','/fr/claim-entreprises.html','/fr/claim-observatoire.html','/fr/a-propos.html','/fr/cgu.html','/fr/confidentialite.html','/fr/contact.html']) {
  const r=await read(ORIGIN+p); assert.equal(r.status,200,p);
  assert.match(r.body,new RegExp('canonical[^>]+https://claimyourjob.com/fr'));
  assert.doesNotMatch(r.body,/Choisissez votre marché/);
  assert.match(r.body,/href="\/fr\//);
  report.push({url:ORIGIN+p,status:r.status});
 }
 for(const p of ['/assets/theme.css','/assets/theme.js','/assets/clarity.js','/assets/companies-data.js','/assets/og-image.png']) {
  const r=await read(ORIGIN+p);assert.equal(r.status,200,p);report.push({url:ORIGIN+p,status:r.status});
 }
 // Depuis le correctif SEO du 11/11, robots.txt est servi 200 à la racine :
 // un robots.txt en 3xx vaut 404 pour Google. Le sitemap, lui, reste canonique
 // sous /fr et redirige.
 const robots=await read(ORIGIN+'/robots.txt');
 assert.equal(robots.status,200,'robots.txt doit etre servi 200 a la racine');
 assert.ok(robots.body.includes('Sitemap:'),
   'robots.txt doit annoncer le sitemap');
 const body=await read(ORIGIN+'/fr/robots.txt');assert.match(body.body,/Sitemap: https:\/\/claimyourjob.com\/fr\/sitemap.xml/);
 const sitemap=await read(ORIGIN+'/fr/sitemap.xml');assert.equal(sitemap.status,200);
 const urls=[...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.ok(urls.length>4);
 assert.ok(urls.every(u=>u.startsWith(ORIGIN+'/fr/')));
 const offer=urls.find(u=>u.includes('/offre/'));assert.ok(offer);
 const page=await read(offer);assert.equal(page.status,200);assert.ok(page.body.includes(`rel="canonical" href="${offer}"`));
 report.push({url:offer,status:page.status,sitemapCount:urls.length});
 for(const host of ['claimyourjob.com','claimyourjob.fr']){const r=await read(`https://${host}/monitoring`);assert.equal(r.status,401);}
 const privateFile=await read(ORIGIN+'/monitoring.html');assert.equal(privateFile.status,301);assert.equal(privateFile.location,ORIGIN+'/monitoring');
 const missing=await read(ORIGIN+'/fr/adresse-inexistante');assert.equal(missing.status,404);assert.match(missing.body,/href="\/fr\//);
 const head=await read(ORIGIN+'/fr/','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');
 fs.writeFileSync('/tmp/preuves-migration.json',JSON.stringify(report,null,2));
 console.log(`Migration vérifiée : ${report.length} contrôles documentés, ${urls.length} URL de sitemap, fiche, robots, monitoring et 404 conformes.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
