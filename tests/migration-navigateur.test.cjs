'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const fixture=require('./serveur-test.cjs');

test('migration /fr — assets, navigation, partage, historique et SSR', async()=>{
 await new Promise(resolve=>fixture.serveur.listen(0,'127.0.0.1',resolve));
 const api=`http://127.0.0.1:${fixture.serveur.address().port}/api/v1`;
 const {default:worker}=await import('../src/index.js');
 const env={API_URL:api,SITE_URL:'https://claimyourjob.com/fr',ASSETS:{fetch:async req=>{
  const p=new URL(req.url).pathname;
  const file='.'+p;
  const exists=fs.existsSync(file)&&fs.statSync(file).isFile();
  const type=p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.png')?'image/png':'text/html';
  return new Response(fs.readFileSync(exists?file:'public/404.html'),{status:exists?200:404,headers:{'content-type':type}});
 }}};
 let browser;
 try {
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const failures=[];
  await context.route('https://claimyourjob.com/**',async route=>{
   const response=await worker.fetch(new Request(route.request().url()),env);
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  await context.route('https://claim-api-production-06b3.up.railway.app/**',async route=>{
   const u=new URL(route.request().url());
   const response=await fetch(api+u.pathname.replace('/api/v1','')+u.search);
   await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
  });
  const page=await context.newPage();
  page.on('pageerror',error=>failures.push(String(error)));
  page.on('response',r=>{if(r.url().startsWith('https://claimyourjob.com/assets/')&&r.status()!==200)failures.push(r.url()+':'+r.status());});
  await page.goto('https://claimyourjob.com/fr/');
  await page.waitForSelector('#lien-board');
  assert.equal(await page.locator('#lien-board').getAttribute('href'),'/fr/job-board.html');
  await page.evaluate(()=>versBoard('q','actuaire'));
  await page.waitForURL(/\/fr\/job-board.html\?q=actuaire/);
  await page.goto('https://claimyourjob.com/fr/job-board.html');
  await page.locator('#feed .jc, #feed .oc').first().waitFor();
  await page.locator('#feed .jc, #feed .oc').first().click();
  await page.waitForURL(/\/fr\/offre\//);
  const deep=page.url();
  await page.goBack();
  await page.waitForURL(/\/fr\/job-board.html/);
  await page.goForward();
  await page.waitForURL(/\/fr\/offre\//);
  await page.evaluate(()=>{
   Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
   navigator.clipboard.writeText=async()=>{throw new Error('refus simulé');};
   window.prompt=(message,value)=>{window.__lien=value;return value;};
  });
  await page.locator('#detail button[onclick="partagerOffre()"]').click();
  await page.waitForFunction(()=>window.__lien);
  assert.match(await page.evaluate(()=>window.__lien),/^https:\/\/claimyourjob.com\/fr\/offre\//);
  const response=await page.goto(deep);
  assert.equal(response.status(),200);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),deep);
  assert.equal(await page.locator('a.retour').getAttribute('href'),'/fr/job-board.html');
  assert.deepEqual(failures,[]);
  await context.close();
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>fixture.serveur.close(resolve));
 }
});
