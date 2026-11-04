'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {chromium}=require('playwright');const fixture=require('./serveur-test.cjs');
test('annuaire SSR utile sans JS et liens board avec split view/nouvel onglet',async()=>{
 await new Promise(resolve=>fixture.serveur.listen(0,'127.0.0.1',resolve));
 const api=`http://127.0.0.1:${fixture.serveur.address().port}/api/v1`;
 const {default:worker}=await import('../src/index.js');
 const env={API_URL:api,ASSETS:{fetch:async req=>{
  const path=new URL(req.url).pathname;const file='.'+path;const ok=fs.existsSync(file)&&fs.statSync(file).isFile();
  return new Response(fs.readFileSync(ok?file:'public/404.html'),{status:ok?200:404,headers:{'content-type':path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html'}});
 }}};
 let browser;
 try{
  browser=await chromium.launch();
  const setup=async context=>{
   await context.route('https://claimyourjob.com/**',async route=>{const r=await worker.fetch(new Request(route.request().url()),env);await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});});
   await context.route('https://claim-api-production-06b3.up.railway.app/**',async route=>{const u=new URL(route.request().url());const r=await fetch(api+u.pathname.replace('/api/v1','')+u.search);await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});});
  };
  const plain=await browser.newContext({javaScriptEnabled:false});await setup(plain);const p=await plain.newPage();
  await p.goto('https://claimyourjob.com/fr/offres.html');assert.equal(await p.locator('article').count(),20);
  const first=await p.locator('article h2 a').first().getAttribute('href');
  await p.locator('a[rel=next]').first().click();assert.match(p.url(),/offres.html\?page=2$/);assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),p.url());
  assert.notEqual(await p.locator('article h2 a').first().getAttribute('href'),first);await plain.close();
  const context=await browser.newContext();await setup(context);const page=await context.newPage();await page.goto('https://claimyourjob.com/fr/job-board.html');
  const link=page.locator('#feed a.ctitle').first();await link.waitFor();assert.equal(await page.locator('#feed .jc').count(),20);assert.match(await link.getAttribute('href'),/^https:\/\/claimyourjob.com\/fr\/offre\//);
  await link.click();await page.waitForURL(/\/fr\/offre\//);assert.equal(await page.locator('#feed').count(),1); // même document, split view
  await page.goto('https://claimyourjob.com/fr/job-board.html');await page.locator('#feed a.ctitle').first().waitFor();
  const popup=context.waitForEvent('page');await page.locator('#feed a.ctitle').first().click({button:'middle'});const tab=await popup;await tab.waitForLoadState();assert.match(tab.url(),/\/fr\/offre\//);assert.equal(await tab.locator('h1').count(),1);assert.match(page.url(),/\/job-board.html$/);await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>fixture.serveur.close(resolve));}
});
