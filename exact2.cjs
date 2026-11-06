const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();
 await p.goto('https://claimyourjob.com/fr/',{waitUntil:'networkidle',timeout:60000});
 // Les cards arrivent par fetch : on attend qu'elles soient la.
 await p.waitForSelector('a.oc[data-slug]',{timeout:20000}).catch(()=>{});
 await p.waitForTimeout(1500);
 const cards=await p.$$('a.oc[data-slug]');
 console.log('  cards rendues:',cards.length);
 if(cards.length){
   const slug=await p.evaluate(el=>el.dataset.slug, cards[1]);
   const t=await p.evaluate(el=>el.querySelector('.ctitle')?.textContent, cards[1]);
   await cards[1].click();
   await p.waitForTimeout(5000);
   const retour=await p.evaluate(()=>document.getElementById('retour-offre')?.getAttribute('href'));
   console.log('  clic "'+(t||'').slice(0,28)+'" (slug='+slug.slice(0,22)+')');
   console.log('  retour pointe vers:', retour);
   await p.click('#retour-offre');
   await p.waitForTimeout(5000);
   const etat=await p.evaluate(()=>{
     const h=location.hash.replace('#','');
     const c=h.startsWith('card-')?document.getElementById(h):null;
     return {hash:location.hash, scrollY:Math.round(window.scrollY),
             cible: c?Math.round(c.getBoundingClientRect().top):null};});
   console.log('  apres retour: hash='+etat.hash+' scrollY='+etat.scrollY
     +(etat.cible!==null?' cardY='+etat.cible+' (0 = en haut de l ecran)':''));
 }
 await b.close();
})();
