'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const fixture={id:'id',slug:'actuaire-été',title:'Actuaire',source:'axa',city:'Paris',contract_type:'cdi',description_raw:'Une mission réelle en actuariat.',companies:{name:'AXA'}};
test('routeur réel : annuaire humain paginé, borné et canoniques distinctes',async()=>{
 const {default:worker}=await import('../src/index.js');const original=global.fetch;const calls=[];
 global.fetch=async url=>{calls.push(String(url));const payload={};payload.data=[fixture];payload.pagination={total:352};return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})};
 try{
  const env={API_URL:'https://api.test/api/v1'};
  for(const page of [1,2,18]){
   const url='https://claimyourjob.com/fr/offres.html'+(page>1?'?page='+page:'');
   const r=await worker.fetch(new Request(url),env);assert.equal(r.status,200);const h=await r.text();
   assert.ok(h.includes(`rel="canonical" href="${url}"`));assert.ok(h.includes('/fr/offre/actuaire-%C3%A9t%C3%A9'));assert.ok(h.includes('352 offres au total'));assert.ok(h.includes('1 offres sur cette page'));assert.ok(!h.includes('JobPosting'));assert.ok(calls.at(-1).includes(`limit=20&page=${page}`));
  }
  assert.equal((await worker.fetch(new Request('https://claimyourjob.com/fr/offres.html?page=19'),env)).status,404);
  for(const q of ['page=0','page=2x','q=foo','page=2&page=3'])assert.equal((await worker.fetch(new Request('https://claimyourjob.com/fr/offres.html?'+q),env)).status,400);
  const redirect=await worker.fetch(new Request('https://claimyourjob.com/fr/offres.html?page=1'),env);assert.equal(redirect.status,301);
  global.fetch=async()=>new Response('',{status:500});assert.equal((await worker.fetch(new Request('https://claimyourjob.com/fr/offres.html'),env)).status,503);
 }finally{global.fetch=original}
});
test('JobPosting ne fabrique ni date source ni expiration ni directApply',async()=>{
 const {construire}=await import('../src/pages/_offre-rendu.js');
 for(const date of [undefined,'2026-11-01T00:00:00Z','2026-02-30','invalid','2999-01-01']){
  const {html}=await construire({...fixture,source_published_at:date,created_at:'2026-11-01'},'https://claimyourjob.com/fr/offre/actuaire');
  const blocks=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const job=blocks.find(j=>j['@type']==='JobPosting');assert.ok(job);assert.equal(job.directApply,false);assert.ok(!('validThrough' in job));
  assert.equal(job.datePosted,date==='2026-11-01T00:00:00Z'?'2026-11-01':undefined);
 }
});
test('annuaire lié depuis les deux pages visibles, titres vrais liens',()=>{
 for(const p of ['index.html','job-board.html'])assert.match(fs.readFileSync(p,'utf8'),/href="\/fr\/offres.html"/);
 assert.match(fs.readFileSync('job-board.html','utf8'),/<a class="ctitle" href=/);
});
