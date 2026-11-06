const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();
 await p.goto('https://claimyourjob.com/fr/',{waitUntil:'networkidle',timeout:60000});
 await p.waitForTimeout(4000);
 const cards=await p.$$('a.oc');
 console.log('  cards sur l\'accueil:',cards.length);
 if(cards.length){
   const t=await p.evaluate(el=>el.querySelector('.ctitle')?.textContent, cards[1]);
   await cards[1].click();
   await p.waitForTimeout(4500);
   const retour=await p.evaluate(()=>document.getElementById('retour-offre')?.getAttribute('href'));
   console.log('  clic card 1 "'+(t||'').slice(0,30)+'" -> retour='+retour);
   await p.click('#retour-offre');
   await p.waitForTimeout(4500);
   const etat=await p.evaluate(()=>{
     const card=document.querySelector('a.oc[data-slug]');
     return {hash:location.hash, y:Math.round(window.scrollY),
       cardVisible: card ? Math.round(card.getBoundingClientRect().top) : -1};});
   console.log('  apres retour: hash='+etat.hash+' scrollY='+etat.y+' cardY='+etat.cardVisible);
 }
 await b.close();
})();
